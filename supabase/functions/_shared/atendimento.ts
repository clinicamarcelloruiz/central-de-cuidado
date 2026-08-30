/**
 * Atendimento automatico do WhatsApp.
 *
 * Quem escreve para a clinica cai num menu de tres opcoes: informacoes,
 * agendar, ou falar com a equipe. O agendamento e um sub-fluxo (unidade ->
 * horario) e nao um destino final: de qualquer etapa da a para voltar.
 *
 * Duas regras guiam todo o texto daqui:
 *  1. nenhuma resposta termina sem dizer o que fazer em seguida;
 *  2. MENU sempre volta ao inicio, e isso aparece escrito na mensagem.
 *
 * Regra da clinica para marcar:
 *  - paciente ja cadastrado marca direto;
 *  - pessoa sem cadastro gera solicitacao com a vaga reservada por 24h, e a
 *    recepcao confirma.
 *
 * Este arquivo so decide e escreve no banco. Quem envia a mensagem e o
 * meta-webhook, que ja tem o token e o numero em maos.
 */

import type { adminClient } from './whatsapp.ts'

const HORAS_RESERVA = 24
const MAX_HORARIOS = 8

/**
 * O cliente com service_role que o webhook ja tem em maos. Tipar pelo retorno
 * de adminClient() em vez de `any` mantem o lint honesto sem repetir aqui a
 * definicao inteira do banco.
 */
type Admin = ReturnType<typeof adminClient>

export type Estado = 'menu' | 'aguardando_unidade' | 'aguardando_horario' | 'atendente'
export type MotivoAtencao = 'atendente' | 'falha'

export type Resultado = {
  resposta: string
  /** Preenchido quando a conversa precisa de alguem da equipe. */
  atencao?: MotivoAtencao
} | null

type Unidade = { id: string; name: string; address: string }
type Horario = { inicio: string; fim: string }

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Frases que abrem o agendamento sem passar pelo menu. */
export function pediuAgendamento(texto: string) {
  const t = normalizar(texto)
  return (
    t === 'agendar' ||
    t === 'agendamento' ||
    t === 'marcar' ||
    t === 'marcar consulta' ||
    t === 'agendar consulta' ||
    t === 'quero agendar' ||
    t === 'quero marcar' ||
    t === 'horarios' ||
    t === 'horario'
  )
}

/** A saida de emergencia. Vale em qualquer etapa, inclusive com a equipe. */
function pediuMenu(texto: string) {
  const t = normalizar(texto)
  return (
    t === 'menu' ||
    t === '0' ||
    t === 'inicio' ||
    t === 'voltar ao menu' ||
    t === 'menu principal' ||
    t === 'opcoes'
  )
}

/** Um passo atras, nao ate o inicio. */
function pediuVoltar(texto: string) {
  const t = normalizar(texto)
  return t === 'voltar' || t === 'anterior'
}

/**
 * Chamar a equipe por palavra, e nao por numero.
 *
 * Dentro do agendamento "3" e a terceira unidade da lista, entao oferecer "3
 * para falar com a equipe" ali criaria justamente a duvida que este menu
 * existe para evitar. Palavra funciona em qualquer etapa sem colidir.
 */
function pediuAtendente(texto: string) {
  const t = normalizar(texto)
  return (
    t === 'atendente' ||
    t === 'secretaria' ||
    t === 'equipe' ||
    t === 'falar com atendente' ||
    t === 'falar com a equipe' ||
    t === 'ajuda'
  )
}

function desistiu(texto: string) {
  const t = normalizar(texto)
  return t === 'cancelar' || t === 'sair' || t === 'parar' || t === 'desistir'
}

/** Le "2" ou "2." e devolve o indice na lista mostrada. */
function escolha(texto: string, total: number): number | null {
  const limpo = normalizar(texto).replace(/[^0-9]/g, '')
  if (!limpo) return null
  const numero = Number.parseInt(limpo, 10)
  if (!Number.isFinite(numero) || numero < 1 || numero > total) return null
  return numero - 1
}

function formatarData(iso: string, timezone: string) {
  const data = new Date(iso)
  const dia = data.toLocaleDateString('pt-BR', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
  const hora = data.toLocaleTimeString('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dia} às ${hora}`
}

const OPCOES = [
  '1 - Informações sobre a consulta',
  '2 - Agendar consulta',
  '3 - Falar com a nossa equipe',
].join('\n')

const VOLTA = 'Digite MENU a qualquer momento para voltar ao início.'
const SAIDAS = 'Digite ATENDENTE para falar com a nossa equipe, ou MENU para voltar ao início.'

async function salvarEstado(
  admin: Admin,
  conversationId: string,
  campos: Record<string, unknown>,
) {
  await admin
    .from('whatsapp_conversations')
    .update({ booking_updated_at: new Date().toISOString(), ...campos })
    .eq('id', conversationId)
}

async function limparEstado(admin: Admin, conversationId: string) {
  await salvarEstado(admin, conversationId, {
    booking_state: null,
    booking_options: null,
    booking_unit_id: null,
  })
}

async function unidadesAtivas(admin: Admin, clinicId: string) {
  const { data } = await admin
    .from('clinic_units')
    .select('id,name,address')
    .eq('clinic_id', clinicId)
    .is('archived_at', null)
    .order('name')
  return (data ?? []) as Unidade[]
}

async function fusoDaClinica(admin: Admin, clinicId: string) {
  const { data } = await admin
    .from('clinics')
    .select('timezone')
    .eq('id', clinicId)
    .maybeSingle()
  return data?.timezone || 'America/Sao_Paulo'
}

/**
 * Horarios livres de uma unidade.
 *
 * Devolve `falhou` separado de "lista vazia" de proposito. Ate 30/08/2026 os
 * dois casos se confundiam e o paciente ouvia "nao temos horarios" quando na
 * verdade a consulta ao banco tinha sido recusada por permissao. Dizer que a
 * agenda esta vazia quando ela esta cheia e pior do que admitir a falha.
 */
async function horariosLivres(
  admin: Admin,
  unitId: string,
): Promise<{ horarios: Horario[]; falhou: boolean }> {
  // Libera reservas vencidas antes de listar: sem isso o horario aparece livre
  // aqui e a marcacao falha depois, no indice unico.
  const { error: erroFaxina } = await admin.rpc('liberar_reservas_vencidas')
  if (erroFaxina) console.error('liberar_reservas_vencidas falhou', erroFaxina)

  const { data, error } = await admin.rpc('available_slots', { p_unit_id: unitId })
  if (error) {
    console.error('available_slots falhou', { unitId, error })
    return { horarios: [], falhou: true }
  }

  const lista = ((data ?? []) as { slot_start: string; slot_end: string }[])
    .slice(0, MAX_HORARIOS)
    .map((h) => ({ inicio: h.slot_start, fim: h.slot_end }))
  return { horarios: lista, falhou: false }
}

const AVISO_FALHA =
  'Tive um problema para consultar a agenda agora. Já avisei a nossa equipe, ' +
  'que retorna por aqui para marcar com você.\n\n' + VOLTA

// ---------------------------------------------------------------
// Menu principal
// ---------------------------------------------------------------

async function mostrarMenu(
  admin: Admin,
  conversationId: string,
  saudacao: string,
  aviso = '',
): Promise<Resultado> {
  await salvarEstado(admin, conversationId, {
    booking_state: 'menu',
    booking_options: null,
    booking_unit_id: null,
    menu_sent_at: new Date().toISOString(),
  })

  // Com aviso, o aviso ja e a instrucao. Repetir "Como podemos ajudar?" logo
  // depois de "Nao entendi, responda com o numero" dava duas ordens seguidas.
  const cabecalho = aviso || `${saudacao}\n\nComo podemos ajudar? Responda com o número:`
  return { resposta: `${cabecalho}\n\n${OPCOES}` }
}

async function chamarEquipe(admin: Admin, conversationId: string): Promise<Resultado> {
  await salvarEstado(admin, conversationId, {
    booking_state: 'atendente',
    booking_options: null,
    booking_unit_id: null,
  })
  // O primeiro paragrafo diz o que esta acontecendo agora; o segundo da uma
  // tarefa util para o tempo de espera; o terceiro diz quando esperar resposta.
  // Sem os tres, "vou te transferir" vira promessa vaga.
  return {
    resposta:
      'Estou direcionando você para um atendente da clínica.\n\n' +
      'Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento ' +
      'vai ler tudo antes de responder.\n\n' +
      'Atendemos de segunda a sexta, das 8h às 18h. Fora desse horário, ' +
      'respondemos no próximo dia útil.\n\n' + VOLTA,
    atencao: 'atendente',
  }
}

// ---------------------------------------------------------------
// Opcao 2: agendar
// ---------------------------------------------------------------

async function perguntarUnidade(
  admin: Admin,
  clinicId: string,
  conversationId: string,
): Promise<Resultado> {
  const unidades = await unidadesAtivas(admin, clinicId)

  if (unidades.length === 0) {
    return {
      resposta:
        'Ainda não temos unidades publicadas para agendamento por aqui.\n\n' + SAIDAS,
      atencao: 'atendente',
    }
  }

  // Uma unidade so: nao faz sentido perguntar, ja mostra os horarios.
  if (unidades.length === 1) {
    return await perguntarHorario(admin, clinicId, conversationId, unidades[0], false)
  }

  // Consulta a agenda de cada unidade antes de listar. Custa uma chamada por
  // unidade, mas evita o pior roteiro possivel: a pessoa escolhe, espera, e
  // descobre que ali nao tinha nada.
  const comAgenda = await Promise.all(
    unidades.map(async (u) => ({ unidade: u, ...(await horariosLivres(admin, u.id)) })),
  )

  if (comAgenda.every((u) => u.falhou)) {
    await limparEstado(admin, conversationId)
    return { resposta: AVISO_FALHA, atencao: 'falha' }
  }

  const abertas = comAgenda.filter((u) => u.horarios.length > 0)

  if (abertas.length === 0) {
    await limparEstado(admin, conversationId)
    return {
      resposta:
        'No momento não temos horários abertos para agendamento pelo WhatsApp.\n\n' + SAIDAS,
      atencao: 'atendente',
    }
  }

  const linhas = comAgenda
    .map((u, i) => {
      const marca = u.horarios.length > 0 ? '' : ' (sem horários no momento)'
      return `${i + 1} - ${u.unidade.name}${marca}`
    })
    .join('\n')

  await salvarEstado(admin, conversationId, {
    booking_state: 'aguardando_unidade',
    booking_options: unidades.map((u) => u.id),
    booking_unit_id: null,
  })

  return {
    resposta:
      `Vamos agendar sua consulta.\n\nEm qual unidade você prefere ser atendido?\n\n${linhas}\n\n` +
      `Responda com o número. ${SAIDAS}`,
  }
}

async function perguntarHorario(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  unidade: Unidade,
  /** Falso quando a clinica so tem uma unidade: nao existe "outra" para trocar. */
  podeTrocarUnidade = true,
): Promise<Resultado> {
  const timezone = await fusoDaClinica(admin, clinicId)
  const { horarios, falhou } = await horariosLivres(admin, unidade.id)

  if (falhou) {
    await limparEstado(admin, conversationId)
    return { resposta: AVISO_FALHA, atencao: 'falha' }
  }

  if (horarios.length === 0) {
    if (!podeTrocarUnidade) {
      await limparEstado(admin, conversationId)
      return {
        resposta:
          `No momento não temos horários abertos em ${unidade.name}.\n\n` + SAIDAS,
        atencao: 'atendente',
      }
    }
    // Continua em aguardando_unidade: assim o proximo numero ja escolhe outra
    // unidade, sem obrigar a recomecar.
    return {
      resposta:
        `No momento não temos horários abertos em ${unidade.name}.\n\n` +
        'Você pode responder com o número de outra unidade da lista acima.\n' + SAIDAS,
    }
  }

  const linhas = horarios.map((h, i) => `${i + 1} - ${formatarData(h.inicio, timezone)}`).join('\n')

  await salvarEstado(admin, conversationId, {
    booking_state: 'aguardando_horario',
    booking_options: horarios,
    booking_unit_id: unidade.id,
  })

  return {
    resposta:
      `Horários disponíveis em ${unidade.name}:\n\n${linhas}\n\n` +
      'Responda com o número do horário desejado.\n' +
      (podeTrocarUnidade
        ? 'Digite VOLTAR para escolher outra unidade, ATENDENTE para falar com a nossa equipe, ou MENU para o início.'
        : SAIDAS),
  }
}

async function marcar(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  unitId: string,
  paciente: { id: string; name: string } | null,
  telefone: string,
  slot: Horario,
): Promise<Resultado> {
  const { data: unidade } = await admin
    .from('clinic_units')
    .select('name,address')
    .eq('id', unitId)
    .maybeSingle()
  const timezone = await fusoDaClinica(admin, clinicId)

  const cadastrado = Boolean(paciente?.id)
  const agora = new Date()

  const { error } = await admin.from('appointments').insert({
    clinic_id: clinicId,
    unit_id: unitId,
    patient_id: paciente?.id ?? null,
    starts_at: slot.inicio,
    ends_at: slot.fim,
    status: 'scheduled',
    source: 'whatsapp',
    contact_name: paciente?.name ?? '',
    contact_phone: telefone,
    // Cadastrado marca direto. Pessoa nova fica reservada por 24h ate a
    // recepcao confirmar - foi a regra que a clinica escolheu.
    confirmed_by_clinic: cadastrado,
    hold_expires_at: cadastrado
      ? null
      : new Date(agora.getTime() + HORAS_RESERVA * 3600 * 1000).toISOString(),
  })

  await limparEstado(admin, conversationId)

  if (error) {
    // 23505 = alguem pegou o mesmo horario entre a listagem e a escolha.
    if ((error as { code?: string }).code === '23505') {
      return {
        resposta:
          'Esse horário acabou de ser ocupado por outra pessoa.\n\n' +
          'Digite 2 para ver os horários atualizados, ou MENU para voltar ao início.',
      }
    }
    console.error('Falha ao marcar consulta', error)
    return {
      resposta:
        'Não consegui concluir o agendamento agora. Já avisei a nossa equipe, ' +
        'que entra em contato por aqui.\n\n' + VOLTA,
      atencao: 'falha',
    }
  }

  const quando = formatarData(slot.inicio, timezone)
  const onde = `${unidade?.name ?? 'nossa unidade'}${unidade?.address ? `\n${unidade.address}` : ''}`

  if (cadastrado) {
    return {
      resposta:
        `Consulta marcada!\n\n${quando}\n${onde}\n\n` +
        'Um dia antes enviamos um lembrete para você confirmar.\n\n' + VOLTA,
    }
  }

  return {
    resposta:
      `Recebemos sua solicitação para ${quando}, em ${unidade?.name ?? 'nossa unidade'}.\n\n` +
      'O horário está reservado para você. Nossa equipe confirma em até 24 horas e ' +
      'retorna por aqui.\n\n' + VOLTA,
  }
}

// ---------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------

/**
 * Decide a resposta automatica. Devolve null quando o robo deve ficar calado -
 * porque a equipe assumiu, porque a mensagem e resposta a um acompanhamento,
 * ou porque o menu ja foi mostrado ha pouco.
 */
export async function tratarConversa(opcoes: {
  admin: Admin
  clinicId: string
  conversationId: string
  estadoAtual: Estado | null
  opcoesAtuais: unknown
  unidadeEmAndamento: string | null
  /**
   * Falso quando o robo nao deve puxar assunto: a pessoa esta respondendo um
   * acompanhamento, ou alguem da equipe escreveu ha pouco e a conversa e
   * humana. Quem calcula e o webhook, que tem o historico em maos.
   */
  podeIniciarMenu: boolean
  aguardandoEquipe: boolean
  texto: string
  telefone: string
  paciente: { id: string; name: string } | null
  textos: { saudacao: string; saudacaoConhecida: string; informacoes: string }
}): Promise<Resultado> {
  const { admin, clinicId, conversationId, estadoAtual, texto } = opcoes

  const primeiroNome = (opcoes.paciente?.name ?? '').trim().split(/\s+/)[0] ?? ''
  const saudacao = (
    opcoes.paciente?.id && opcoes.textos.saudacaoConhecida.trim()
      ? opcoes.textos.saudacaoConhecida.replace(/\{nome\}/g, primeiroNome)
      : opcoes.textos.saudacao
  ).trim() || 'Olá! Aqui é o consultório do Dr. Marcello Ruiz.'

  // MENU vem antes de tudo, ate de "a equipe assumiu": e a saida de emergencia
  // que prometemos em toda mensagem, e promessa que falha uma vez nao vale.
  if (pediuMenu(texto)) {
    return await mostrarMenu(admin, conversationId, saudacao)
  }

  // Equipe assumiu a conversa. O robo cala a boca - falar por cima de uma
  // pessoa que esta atendendo e pior do que nao responder.
  if (estadoAtual === 'atendente') return null

  // A bandeira de "esperando a equipe" so silencia quem esta parado. Quem
  // digitou MENU e escolheu uma opcao esta conversando com o sistema agora, e
  // deixar essa pessoa sem resposta seria justamente o vacuo que o menu veio
  // eliminar.
  if (!estadoAtual && opcoes.aguardandoEquipe) return null

  // Pedir gente vale de qualquer etapa, e nao so da opcao 3 do menu.
  if (pediuAtendente(texto)) {
    return await chamarEquipe(admin, conversationId)
  }

  if (desistiu(texto) && estadoAtual) {
    return await mostrarMenu(
      admin,
      conversationId,
      saudacao,
      'Tudo bem, parei por aqui. Posso ajudar em mais alguma coisa?',
    )
  }

  // ---- Sem etapa em andamento ----
  if (!estadoAtual) {
    if (pediuAgendamento(texto)) {
      return await perguntarUnidade(admin, clinicId, conversationId)
    }
    // Sem etapa aberta, o menu e uma iniciativa nossa - e iniciativa tem hora.
    // Mandar menu depois de "Estou bem, obrigada", ou no meio de uma conversa
    // que a secretaria esta tocando, atrapalha em vez de ajudar.
    if (!opcoes.podeIniciarMenu) return null

    return await mostrarMenu(admin, conversationId, saudacao)
  }

  // ---- Menu ----
  if (estadoAtual === 'menu') {
    const escolhido = escolha(texto, 3)

    if (escolhido === 0) {
      const informacoes = opcoes.textos.informacoes.trim()
      if (!informacoes) {
        return await mostrarMenu(admin, conversationId, saudacao)
      }
      // Segue em 'menu': assim a pessoa le os valores e responde 2 na hora.
      await salvarEstado(admin, conversationId, { booking_state: 'menu' })
      return {
        resposta:
          `${informacoes}\n\n` +
          'Digite 2 para agendar, 3 para falar com a nossa equipe, ou MENU para ver as opções.',
      }
    }

    if (escolhido === 1) {
      return await perguntarUnidade(admin, clinicId, conversationId)
    }

    if (escolhido === 2) {
      return await chamarEquipe(admin, conversationId)
    }

    if (pediuAgendamento(texto)) {
      return await perguntarUnidade(admin, clinicId, conversationId)
    }

    return await mostrarMenu(
      admin,
      conversationId,
      saudacao,
      'Não entendi. Responda com o número da opção:',
    )
  }

  // ---- Escolha da unidade ----
  if (estadoAtual === 'aguardando_unidade') {
    const ids = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []

    // "3" aqui e ambiguo: pode ser a terceira unidade ou "falar com a equipe".
    // A lista manda, porque foi ela que a pessoa acabou de ler.
    const indice = escolha(texto, ids.length)
    if (indice === null) {
      if (pediuVoltar(texto)) return await mostrarMenu(admin, conversationId, saudacao)
      return {
        resposta:
          'Não entendi. Responda com o número da unidade da lista acima.\n\n' + VOLTA,
      }
    }

    const unidades = await unidadesAtivas(admin, clinicId)
    const escolhida = unidades.find((u) => u.id === ids[indice])
    if (!escolhida) {
      return await mostrarMenu(
        admin,
        conversationId,
        saudacao,
        'Essa unidade não está mais disponível. Vamos recomeçar:',
      )
    }
    return await perguntarHorario(admin, clinicId, conversationId, escolhida)
  }

  // ---- Escolha do horario ----
  if (estadoAtual === 'aguardando_horario') {
    if (pediuVoltar(texto)) {
      return await perguntarUnidade(admin, clinicId, conversationId)
    }

    const lista = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as Horario[]) : []
    const indice = escolha(texto, lista.length)
    if (indice === null) {
      return {
        resposta:
          'Não entendi. Responda com o número do horário da lista acima.\n' +
          'Digite VOLTAR para escolher outra unidade, ou MENU para o início.',
      }
    }
    if (!opcoes.unidadeEmAndamento) {
      return await mostrarMenu(
        admin,
        conversationId,
        saudacao,
        'Perdi o fio da conversa, desculpe. Vamos recomeçar:',
      )
    }
    return await marcar(
      admin,
      clinicId,
      conversationId,
      opcoes.unidadeEmAndamento,
      opcoes.paciente,
      opcoes.telefone,
      lista[indice],
    )
  }

  return null
}
