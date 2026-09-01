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
/** Dias oferecidos de uma vez. Cabe a quinzena inteira numa mensagem so. */
const MAX_DIAS = 10
/** Horarios de um dia. Um expediente de 8h as 18h em blocos de 40min da 15. */
const MAX_HORARIOS_DIA = 15
/** Teto do WhatsApp para linhas de uma lista tocavel. */
const MAX_TOQUES = 10

/**
 * O cliente com service_role que o webhook ja tem em maos. Tipar pelo retorno
 * de adminClient() em vez de `any` mantem o lint honesto sem repetir aqui a
 * definicao inteira do banco.
 */
type Admin = ReturnType<typeof adminClient>

export type Estado =
  | 'menu'
  | 'minha_consulta'
  | 'confirmar_cancelamento'
  | 'ja_tem_consulta'
  | 'aguardando_paciente'
  | 'aguardando_unidade'
  | 'aguardando_dia'
  | 'aguardando_horario'
  | 'atendente'
export type MotivoAtencao = 'atendente' | 'falha' | 'cancelou_sozinho'

/**
 * Botao ou linha de lista tocavel no WhatsApp.
 *
 * O `id` e o que volta quando a pessoa toca, e ele e escrito de proposito com
 * exatamente o mesmo texto que o robo ja aceita digitado ("2", "CANCELAR",
 * "SIM"). Assim tocar e digitar entram pelo mesmo caminho, e quem prefere
 * escrever - ou usa um aparelho que nao mostra a lista - continua atendido.
 */
export type Toque = { id: string; titulo: string; descricao?: string }

export type Resultado = {
  resposta: string
  /** Preenchido quando a conversa precisa de alguem da equipe. */
  atencao?: MotivoAtencao
  /** Ate tres botoes lado a lado. Acima disso, use lista. */
  botoes?: Toque[]
  /** Lista tocavel: o rotulo abre o menu, as linhas sao as opcoes (max. 10). */
  lista?: { rotulo: string; linhas: Toque[] }
} | null

type Unidade = { id: string; name: string; address: string }
type Paciente = { id: string; name: string }
type Horario = { inicio: string; fim: string }

/** Consulta futura ja marcada para este telefone. */
export type ConsultaMarcada = {
  id: string
  inicio: string
  unidade: string
  endereco: string
  paciente: string
  confirmada: boolean
}

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

/**
 * Le uma hora escrita por extenso: "10h", "09:20", "as 9 h".
 *
 * So conta como hora quando ha marca explicita (`h` ou `:`). Numero solto
 * continua sendo indice da lista, que e o que a mensagem pede.
 *
 * Existe por causa de um erro silencioso: num dia com 15 horarios, quem
 * digitava "10h" era entendido como "opcao 10" e saia marcado as 14:00,
 * convencido de que tinha marcado as 10:00. Errar calado e pior do que nao
 * entender.
 */
function horaEscrita(texto: string): { hora: number; minuto: number | null } | null {
  const t = normalizar(texto)
  if (!/[h:]/.test(t)) return null
  const m = t.match(/(\d{1,2})\s*[:h]\s*(\d{2})?/)
  if (!m) return null
  const hora = Number(m[1])
  const minuto = m[2] === undefined ? null : Number(m[2])
  if (hora > 23) return null
  if (minuto !== null && minuto > 59) return null
  return { hora, minuto }
}

/** Le "31/08" e devolve dia e mes, para quem responde a data em vez do numero. */
function dataEscrita(texto: string): { dia: number; mes: number } | null {
  const m = normalizar(texto).match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  return { dia, mes }
}

/** Le "2" ou "2." e devolve o indice na lista mostrada. */
function escolha(texto: string, total: number): number | null {
  const limpo = normalizar(texto).replace(/[^0-9]/g, '')
  if (!limpo) return null
  const numero = Number.parseInt(limpo, 10)
  if (!Number.isFinite(numero) || numero < 1 || numero > total) return null
  return numero - 1
}

function formatarDia(iso: string, timezone: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

function formatarHora(iso: string, timezone: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarData(iso: string, timezone: string) {
  return `${formatarDia(iso, timezone)} às ${formatarHora(iso, timezone)}`
}

/** Chave estavel do dia no fuso da clinica, no formato AAAA-MM-DD. */
function chaveDoDia(iso: string, timezone: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: timezone })
}

/**
 * Agrupa os horarios livres por dia, preservando a ordem cronologica.
 *
 * O paciente pensa em dia antes de pensar em hora. Uma lista corrida de 42
 * horarios so mostrava os 8 primeiros - dois dias - e dava a impressao de que a
 * agenda acabava ali, escondendo os outros cinco dias abertos.
 */
function agruparPorDia(horarios: Horario[], timezone: string) {
  const porDia = new Map<string, Horario[]>()
  for (const h of horarios) {
    const chave = chaveDoDia(h.inicio, timezone)
    const lista = porDia.get(chave)
    if (lista) lista.push(h)
    else porDia.set(chave, [h])
  }
  return [...porDia.entries()].map(([chave, lista]) => ({ chave, horarios: lista }))
}

const OPCOES = [
  '1 - Informações sobre a consulta',
  '2 - Agendar consulta',
  '3 - Falar com a nossa equipe',
  '4 - Ver ou cancelar minha consulta',
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

/**
 * Encerra a etapa mas deixa o menu no ar.
 *
 * Serve para toda mensagem que termina oferecendo um numero ("digite 2 para
 * ..."). Com o estado zerado, esse numero caia na regra de silencio quando a
 * conversa estava marcada para a equipe - foi o que aconteceu depois de um
 * cancelamento em 30/08/2026: o robo prometeu "digite 2" e emudeceu.
 */
async function voltarAoMenuAtivo(admin: Admin, conversationId: string) {
  await salvarEstado(admin, conversationId, {
    booking_state: 'menu',
    booking_options: null,
    booking_unit_id: null,
    booking_patient_id: null,
    booking_replaces_id: null,
  })
}

async function limparEstado(admin: Admin, conversationId: string) {
  await salvarEstado(admin, conversationId, {
    booking_state: null,
    booking_options: null,
    booking_unit_id: null,
    booking_patient_id: null,
    booking_replaces_id: null,
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

  // Sem corte aqui: quem decide quanto mostrar e a etapa (dias ou horarios do
  // dia). Cortar na origem foi o que escondeu cinco dias de agenda.
  const lista = ((data ?? []) as { slot_start: string; slot_end: string }[]).map((h) => ({
    inicio: h.slot_start,
    fim: h.slot_end,
  }))
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
  return {
    resposta: `${cabecalho}\n\n${OPCOES}`,
    lista: {
      rotulo: 'Ver opções',
      linhas: [
        { id: '1', titulo: 'Informações', descricao: 'Valores, contatos e orientações' },
        { id: '2', titulo: 'Agendar consulta', descricao: 'Escolher unidade, dia e horário' },
        { id: '3', titulo: 'Falar com a equipe', descricao: 'Alguém do consultório responde' },
        { id: '4', titulo: 'Minha consulta', descricao: 'Ver, cancelar ou remarcar' },
      ],
    },
  }
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
// Opcao 4: minha consulta
// ---------------------------------------------------------------

function descreverConsulta(c: ConsultaMarcada, timezone: string) {
  const linhas = [formatarData(c.inicio, timezone), c.unidade]
  if (c.endereco) linhas.push(c.endereco)
  if (c.paciente) linhas.unshift(c.paciente)
  if (!c.confirmada) linhas.push('(aguardando confirmação da equipe)')
  return linhas.join('\n')
}

async function mostrarMinhaConsulta(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  consultas: ConsultaMarcada[],
): Promise<Resultado> {
  const timezone = await fusoDaClinica(admin, clinicId)

  if (consultas.length === 0) {
    await salvarEstado(admin, conversationId, { booking_state: 'menu' })
    return {
      resposta:
        'Não encontrei nenhuma consulta marcada para este número.\n\n' +
        'Digite 2 para agendar, ou MENU para ver as opções.',
    }
  }

  await salvarEstado(admin, conversationId, {
    booking_state: 'minha_consulta',
    booking_options: consultas.map((c) => c.id),
  })

  if (consultas.length === 1) {
    return {
      resposta:
        `Sua consulta:\n\n${descreverConsulta(consultas[0], timezone)}\n\n` +
        'Digite CANCELAR para desmarcar, REMARCAR para trocar a data, ou MENU para voltar.',
      botoes: [
        { id: 'REMARCAR', titulo: 'Remarcar' },
        { id: 'CANCELAR', titulo: 'Cancelar consulta' },
        { id: 'MENU', titulo: 'Voltar ao menu' },
      ],
    }
  }

  const linhas = consultas
    .map((c, i) => `${i + 1} - ${formatarData(c.inicio, timezone)} · ${c.unidade}`)
    .join('\n')
  return {
    resposta:
      `Você tem ${consultas.length} consultas marcadas:\n\n${linhas}\n\n` +
      'Responda com o número da que quer cancelar ou remarcar, ou MENU para voltar.',
  }
}

/** Cancelamento e destrutivo: nunca acontece sem um sim explicito. */
async function pedirConfirmacaoCancelamento(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  consulta: ConsultaMarcada,
  remarcar: boolean,
): Promise<Resultado> {
  const timezone = await fusoDaClinica(admin, clinicId)
  await salvarEstado(admin, conversationId, {
    booking_state: 'confirmar_cancelamento',
    booking_options: [consulta.id],
    booking_replaces_id: remarcar ? consulta.id : null,
  })
  return {
    resposta:
      (remarcar
        ? 'Vamos remarcar esta consulta:\n\n'
        : 'Confirma o cancelamento desta consulta?\n\n') +
      `${descreverConsulta(consulta, timezone)}\n\n` +
      (remarcar
        ? 'Responda SIM para escolher a nova data. A consulta atual só será cancelada depois que a nova estiver marcada.'
        : 'Responda SIM para cancelar, ou MENU para deixar como está.'),
    botoes: [
      { id: 'SIM', titulo: remarcar ? 'Sim, escolher data' : 'Sim, cancelar' },
      { id: 'MENU', titulo: 'Não, manter' },
    ],
  }
}

async function cancelarConsulta(admin: Admin, appointmentId: string) {
  const { error } = await admin
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('status', 'scheduled')
  if (error) console.error('Falha ao cancelar consulta', { appointmentId, error })
  return !error
}

// ---------------------------------------------------------------
// Opcao 2: agendar
// ---------------------------------------------------------------

/**
 * Primeira etapa quando o telefone atende a mais de um paciente.
 *
 * Numa gastropediatria e o caso comum: a mae cadastra os dois filhos com o
 * proprio celular. Sem esta pergunta o sistema escolhia sozinho e marcava a
 * consulta no nome do irmao errado.
 */
async function perguntarPaciente(
  admin: Admin,
  conversationId: string,
  pacientes: Paciente[],
): Promise<Resultado> {
  const linhas = pacientes.map((p, i) => `${i + 1} - ${p.name}`).join('\n')

  await salvarEstado(admin, conversationId, {
    booking_state: 'aguardando_paciente',
    booking_options: pacientes.map((p) => p.id),
    booking_unit_id: null,
    booking_patient_id: null,
  })

  return {
    resposta:
      `Vamos agendar. Para quem é a consulta?\n\n${linhas}\n\n` +
      `Responda com o número. ${SAIDAS}`,
  }
}

/**
 * Entrada do agendamento. Pergunta o paciente antes de tudo quando ha mais de
 * um no mesmo telefone; caso contrario segue direto para a unidade.
 */
async function iniciarAgendamento(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  pacientes: Paciente[],
  consultas: ConsultaMarcada[] = [],
  jaAvisouDaOutra = false,
): Promise<Resultado> {
  // Ja existe consulta futura para este telefone. Seguir direto para as datas
  // produziria uma segunda consulta em silencio - e na maioria das vezes a
  // pessoa queria justamente trocar a data da que ja tem.
  if (consultas.length > 0 && !jaAvisouDaOutra) {
    const timezone = await fusoDaClinica(admin, clinicId)
    await salvarEstado(admin, conversationId, {
      booking_state: 'ja_tem_consulta',
      booking_options: [consultas[0].id],
      booking_replaces_id: null,
    })
    return {
      resposta:
        `Você já tem uma consulta marcada:\n\n${descreverConsulta(consultas[0], timezone)}\n\n` +
        'O que você prefere?\n\n' +
        '1 - Remarcar (trocar por outra data)\n' +
        '2 - Marcar mais uma consulta, além dessa\n\n' +
        VOLTA,
      botoes: [
        { id: '1', titulo: 'Remarcar essa' },
        { id: '2', titulo: 'Marcar mais uma' },
        { id: 'MENU', titulo: 'Voltar ao menu' },
      ],
    }
  }

  if (pacientes.length > 1) {
    return await perguntarPaciente(admin, conversationId, pacientes)
  }
  await salvarEstado(admin, conversationId, {
    booking_patient_id: pacientes[0]?.id ?? null,
  })
  return await perguntarUnidade(admin, clinicId, conversationId)
}

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

  // Uma unidade so: nao faz sentido perguntar, ja mostra as datas.
  if (unidades.length === 1) {
    return await perguntarDia(admin, clinicId, conversationId, unidades[0], false)
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
    lista: {
      rotulo: 'Escolher unidade',
      linhas: comAgenda.slice(0, MAX_TOQUES).map((u, i) => ({
        id: String(i + 1),
        titulo: u.unidade.name,
        descricao:
          u.horarios.length > 0
            ? `${u.horarios.length} horário${u.horarios.length === 1 ? '' : 's'} livre${u.horarios.length === 1 ? '' : 's'}`
            : 'sem horários no momento',
      })),
    },
  }
}

/** Primeira etapa da agenda: em que dia. */
async function perguntarDia(
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

  const dias = agruparPorDia(horarios, timezone)
  const mostrados = dias.slice(0, MAX_DIAS)

  const linhas = mostrados
    .map((d, i) => {
      const quantos = d.horarios.length
      return `${i + 1} - ${formatarDia(d.horarios[0].inicio, timezone)} (${quantos} ${
        quantos === 1 ? 'horário' : 'horários'
      })`
    })
    .join('\n')

  await salvarEstado(admin, conversationId, {
    booking_state: 'aguardando_dia',
    booking_options: mostrados.map((d) => d.chave),
    booking_unit_id: unidade.id,
  })

  // Sem agenda alem da quinzena nao adianta prometer: quem precisa de data
  // distante fala com a equipe, que enxerga o calendario inteiro.
  const rodape = podeTrocarUnidade
    ? 'Digite VOLTAR para escolher outra unidade, ATENDENTE se precisar de uma data mais distante, ou MENU para o início.'
    : 'Digite ATENDENTE se precisar de uma data mais distante, ou MENU para o início.'

  return {
    resposta:
      `Datas disponíveis em ${unidade.name}:\n\n${linhas}\n\n` +
      `Responda com o número do dia.\n${rodape}`,
    lista: {
      rotulo: 'Escolher o dia',
      linhas: mostrados.slice(0, MAX_TOQUES).map((d, i) => ({
        id: String(i + 1),
        titulo: formatarDia(d.horarios[0].inicio, timezone),
        descricao: `${d.horarios.length} horário${d.horarios.length === 1 ? '' : 's'}`,
      })),
    },
  }
}

/** Segunda etapa: a que horas, dentro do dia escolhido. */
async function perguntarHorario(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  unitId: string,
  diaEscolhido: string,
): Promise<Resultado> {
  const timezone = await fusoDaClinica(admin, clinicId)
  const { horarios, falhou } = await horariosLivres(admin, unitId)

  if (falhou) {
    await limparEstado(admin, conversationId)
    return { resposta: AVISO_FALHA, atencao: 'falha' }
  }

  const doDia = horarios
    .filter((h) => chaveDoDia(h.inicio, timezone) === diaEscolhido)
    .slice(0, MAX_HORARIOS_DIA)

  if (doDia.length === 0) {
    // Alguem ocupou o dia inteiro entre a listagem e a escolha. Volta um passo
    // em vez de encerrar.
    const { data: unidade } = await admin
      .from('clinic_units')
      .select('id,name,address')
      .eq('id', unitId)
      .maybeSingle()
    if (!unidade) {
      await limparEstado(admin, conversationId)
      return { resposta: AVISO_FALHA, atencao: 'falha' }
    }
    return await perguntarDia(admin, clinicId, conversationId, unidade as Unidade)
  }

  const linhas = doDia.map((h, i) => `${i + 1} - ${formatarHora(h.inicio, timezone)}`).join('\n')

  await salvarEstado(admin, conversationId, {
    booking_state: 'aguardando_horario',
    booking_options: doDia,
    booking_unit_id: unitId,
  })

  return {
    // Acima de dez a lista tocavel nao cabe, e a mensagem numerada continua
    // valendo sozinha - por isso o `lista` sai condicional, e nao truncado.
    ...(doDia.length <= MAX_TOQUES
      ? {
          lista: {
            rotulo: 'Escolher horário',
            linhas: doDia.map((h, i) => ({
              id: String(i + 1),
              titulo: formatarHora(h.inicio, timezone),
            })),
          },
        }
      : {}),
    resposta:
      `Horários de ${formatarDia(doDia[0].inicio, timezone)}:\n\n${linhas}\n\n` +
      'Responda com o número do horário.\n' +
      'Digite VOLTAR para escolher outro dia, ATENDENTE para falar com a nossa equipe, ou MENU para o início.',
  }
}

async function marcar(
  admin: Admin,
  clinicId: string,
  conversationId: string,
  unitId: string,
  paciente: Paciente | null,
  telefone: string,
  nomeDoPerfil: string,
  slot: Horario,
  /** Consulta antiga a cancelar assim que a nova entrar (remarcacao). */
  substitui: string | null = null,
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
    // Sem cadastro, o nome do WhatsApp e tudo que a recepcao tem para saber
    // quem esta esperando confirmacao. Melhor do que so um numero de telefone.
    contact_name: paciente?.name || nomeDoPerfil || '',
    contact_phone: telefone,
    // Cadastrado marca direto. Pessoa nova fica reservada por 24h ate a
    // recepcao confirmar - foi a regra que a clinica escolheu.
    confirmed_by_clinic: cadastrado,
    hold_expires_at: cadastrado
      ? null
      : new Date(agora.getTime() + HORAS_RESERVA * 3600 * 1000).toISOString(),
  })

  // Tambem termina oferecendo numero quando da errado, entao o menu fica ativo.
  if (error) await voltarAoMenuAtivo(admin, conversationId)
  else await limparEstado(admin, conversationId)

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

  // A nova esta garantida: so agora a antiga cai. Fazer o contrario deixaria a
  // pessoa sem consulta nenhuma se ela desistisse no meio do caminho.
  let remarcou = false
  if (substitui) remarcou = await cancelarConsulta(admin, substitui)

  const quando = formatarData(slot.inicio, timezone)
  const onde = `${unidade?.name ?? 'nossa unidade'}${unidade?.address ? `\n${unidade.address}` : ''}`
  const aviso = remarcou ? 'Consulta remarcada!' : 'Consulta marcada!'

  if (cadastrado) {
    return {
      resposta:
        `${aviso}\n\n${quando}\n${onde}\n\n` +
        'Um dia antes enviamos um lembrete para você confirmar.\n\n' + VOLTA,
    }
  }

  return {
    resposta:
      `${remarcou ? 'Remarcamos! ' : ''}Recebemos sua solicitação para ${quando}, ` +
      `em ${unidade?.name ?? 'nossa unidade'}.\n\n` +
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
  texto: string
  telefone: string
  /**
   * Todos os pacientes cadastrados com este telefone, em ordem de nome. Vazio
   * quando ninguem foi reconhecido. Mais de um e o caso da mae com dois filhos.
   */
  pacientes: Paciente[]
  /** Paciente ja escolhido nesta conversa, quando a pergunta ja foi feita. */
  pacienteEmAndamento: string | null
  /** Consultas futuras ja marcadas para este telefone, da mais proxima em diante. */
  consultas: ConsultaMarcada[]
  /** Consulta a cancelar assim que a nova entrar, num fluxo de remarcacao. */
  consultaASubstituir: string | null
  /** Nome que a pessoa usa no WhatsApp. Vazio quando o evento nao trouxe. */
  nomeDoPerfil: string
  textos: { saudacao: string; saudacaoConhecida: string; informacoes: string }
}): Promise<Resultado> {
  const { admin, clinicId, conversationId, estadoAtual, texto } = opcoes

  // Chamar pelo nome so quando ha um paciente neste telefone. Com dois irmaos
  // cadastrados, usar o nome de um deles seria adivinhar - e adivinhar errado
  // metade das vezes.
  const unico = opcoes.pacientes.length === 1 ? opcoes.pacientes[0] : null
  const primeiroNome = (unico?.name ?? '').trim().split(/\s+/)[0] ?? ''
  const saudacao = (
    unico && opcoes.textos.saudacaoConhecida.trim()
      ? opcoes.textos.saudacaoConhecida.replace(/\{nome\}/g, primeiroNome)
      : opcoes.textos.saudacao
  ).trim() || 'Olá! Aqui é o consultório do Dr. Marcello Ruiz.'

  /** Quem vai no prontuario da consulta: o escolhido, ou o unico que existe. */
  const pacienteDaConsulta =
    opcoes.pacientes.find((p) => p.id === opcoes.pacienteEmAndamento) ?? unico ?? null

  // MENU vem antes de tudo, ate de "a equipe assumiu": e a saida de emergencia
  // que prometemos em toda mensagem, e promessa que falha uma vez nao vale.
  if (pediuMenu(texto)) {
    return await mostrarMenu(admin, conversationId, saudacao)
  }

  // Equipe assumiu a conversa. O robo cala a boca - falar por cima de uma
  // pessoa que esta atendendo e pior do que nao responder.
  if (estadoAtual === 'atendente') return null

  // Nao existe mais silencio por causa da bandeira de atencao.
  //
  // A bandeira acumulava dois papeis: avisar a equipe e calar o robo. Sao
  // coisas diferentes. Quem cancelou a consulta sozinho acende a bandeira
  // porque a vaga interessa a recepcao - mas nao esta esperando ninguem falar
  // com ele, e ficava mudo ate alguem abrir a conversa na tela.
  //
  // Quem realmente pediu gente cai no estado 'atendente' logo acima, e quem
  // esta em conversa humana e barrado por equipeFalouRecentemente, calculado no
  // webhook. Esses dois bastam, e nao criam becos sem saida.

  // Pedir gente vale de qualquer etapa, e nao so da opcao 3 do menu.
  if (pediuAtendente(texto)) {
    return await chamarEquipe(admin, conversationId)
  }

  // "Cancelar" muda de sentido dentro de "minha consulta": ali nao e desistir
  // do fluxo, e desmarcar a consulta. Sem esta excecao a palavra era engolida
  // aqui e a pessoa nunca chegava a poder cancelar de fato.
  const naEtapaDeCancelar =
    estadoAtual === 'minha_consulta' || estadoAtual === 'confirmar_cancelamento'

  if (desistiu(texto) && estadoAtual && !naEtapaDeCancelar) {
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
      return await iniciarAgendamento(
        admin, clinicId, conversationId, opcoes.pacientes, opcoes.consultas,
      )
    }
    // Sem etapa aberta, o menu e uma iniciativa nossa - e iniciativa tem hora.
    // Mandar menu depois de "Estou bem, obrigada", ou no meio de uma conversa
    // que a secretaria esta tocando, atrapalha em vez de ajudar.
    if (!opcoes.podeIniciarMenu) return null

    return await mostrarMenu(admin, conversationId, saudacao)
  }

  // ---- Menu ----
  if (estadoAtual === 'menu') {
    const escolhido = escolha(texto, 4)

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
      return await iniciarAgendamento(
        admin, clinicId, conversationId, opcoes.pacientes, opcoes.consultas,
      )
    }

    if (escolhido === 2) {
      return await chamarEquipe(admin, conversationId)
    }

    if (escolhido === 3) {
      return await mostrarMinhaConsulta(admin, clinicId, conversationId, opcoes.consultas)
    }

    if (pediuAgendamento(texto)) {
      return await iniciarAgendamento(
        admin, clinicId, conversationId, opcoes.pacientes, opcoes.consultas,
      )
    }

    return await mostrarMenu(
      admin,
      conversationId,
      saudacao,
      'Não entendi. Responda com o número da opção:',
    )
  }

  // ---- Minha consulta ----
  if (estadoAtual === 'minha_consulta') {
    const ids = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []
    const t = normalizar(texto)
    const querRemarcar = t === 'remarcar' || t === 'trocar' || t === 'mudar'
    const querCancelar = t === 'cancelar' || t === 'desmarcar'

    // Com uma consulta so, CANCELAR e REMARCAR ja apontam para ela.
    if (opcoes.consultas.length === 1 && (querCancelar || querRemarcar)) {
      return await pedirConfirmacaoCancelamento(
        admin, clinicId, conversationId, opcoes.consultas[0], querRemarcar,
      )
    }

    const indice = escolha(texto, ids.length)
    const alvo = indice === null ? null : opcoes.consultas.find((c) => c.id === ids[indice])
    if (alvo) {
      await salvarEstado(admin, conversationId, { booking_options: [alvo.id] })
      const timezone = await fusoDaClinica(admin, clinicId)
      return {
        resposta:
          `${descreverConsulta(alvo, timezone)}\n\n` +
          'Digite CANCELAR para desmarcar, REMARCAR para trocar a data, ou MENU para voltar.',
      }
    }

    return {
      resposta:
        'Não entendi. Digite CANCELAR para desmarcar, REMARCAR para trocar a data, ' +
        'ou MENU para voltar ao início.',
    }
  }

  // ---- Confirmacao do cancelamento ----
  if (estadoAtual === 'confirmar_cancelamento') {
    const t = normalizar(texto)
    if (t !== 'sim' && t !== 'confirmar' && t !== 'confirmo' && t !== 'pode cancelar') {
      return await mostrarMenu(
        admin, conversationId, saudacao,
        'Tudo bem, sua consulta continua marcada. Posso ajudar em mais alguma coisa?',
      )
    }

    const ids = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []
    const alvo = opcoes.consultas.find((c) => c.id === ids[0]) ?? opcoes.consultas[0]
    if (!alvo) {
      return await mostrarMenu(admin, conversationId, saudacao, 'Não encontrei mais essa consulta.')
    }

    // Remarcar nao cancela agora: primeiro escolhe a nova data, e a antiga cai
    // so quando a nova estiver garantida.
    if (opcoes.consultaASubstituir === alvo.id) {
      return await iniciarAgendamento(
        admin, clinicId, conversationId, opcoes.pacientes, opcoes.consultas, true,
      )
    }

    const ok = await cancelarConsulta(admin, alvo.id)
    // Menu ativo, e nao estado zerado: a resposta abaixo oferece "digite 2".
    await voltarAoMenuAtivo(admin, conversationId)
    if (!ok) {
      return {
        resposta:
          'Não consegui cancelar agora. Já avisei a nossa equipe, que resolve isso por aqui.\n\n' + VOLTA,
        atencao: 'falha',
      }
    }
    return {
      // A vaga que abriu interessa a recepcao: por isso a conversa acende.
      resposta:
        'Consulta cancelada. Obrigado por avisar!\n\n' +
        'Se quiser marcar outra data, digite 2. ' + VOLTA,
      atencao: 'cancelou_sozinho',
    }
  }

  // ---- Ja tem consulta marcada ----
  if (estadoAtual === 'ja_tem_consulta') {
    const escolhido = escolha(texto, 2)
    if (escolhido === 0) {
      const alvo = opcoes.consultas[0]
      if (!alvo) return await mostrarMenu(admin, conversationId, saudacao)
      return await pedirConfirmacaoCancelamento(admin, clinicId, conversationId, alvo, true)
    }
    if (escolhido === 1) {
      return await iniciarAgendamento(
        admin, clinicId, conversationId, opcoes.pacientes, opcoes.consultas, true,
      )
    }
    return {
      resposta:
        'Não entendi. Responda 1 para remarcar, 2 para marcar mais uma consulta, ' +
        'ou MENU para voltar ao início.',
    }
  }

  // ---- Escolha do paciente ----
  if (estadoAtual === 'aguardando_paciente') {
    if (pediuVoltar(texto)) return await mostrarMenu(admin, conversationId, saudacao)

    const ids = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []
    const indice = escolha(texto, ids.length)
    if (indice === null) {
      return {
        resposta:
          'Não entendi. Responda com o número do paciente da lista acima.\n\n' + VOLTA,
      }
    }

    const escolhido = opcoes.pacientes.find((p) => p.id === ids[indice])
    if (!escolhido) {
      return await mostrarMenu(
        admin,
        conversationId,
        saudacao,
        'Esse paciente não está mais disponível. Vamos recomeçar:',
      )
    }

    await salvarEstado(admin, conversationId, { booking_patient_id: escolhido.id })
    return await perguntarUnidade(admin, clinicId, conversationId)
  }

  // ---- Escolha da unidade ----
  if (estadoAtual === 'aguardando_unidade') {
    const ids = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []

    // "3" aqui e ambiguo: pode ser a terceira unidade ou "falar com a equipe".
    // A lista manda, porque foi ela que a pessoa acabou de ler.
    const indice = escolha(texto, ids.length)
    if (indice === null) {
      if (pediuVoltar(texto)) {
        return opcoes.pacientes.length > 1
          ? await perguntarPaciente(admin, conversationId, opcoes.pacientes)
          : await mostrarMenu(admin, conversationId, saudacao)
      }
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
    return await perguntarDia(admin, clinicId, conversationId, escolhida)
  }

  // ---- Escolha do dia ----
  if (estadoAtual === 'aguardando_dia') {
    if (pediuVoltar(texto)) {
      return await perguntarUnidade(admin, clinicId, conversationId)
    }

    const dias = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []

    // "31/08" e uma resposta natural. Aqui nao ha o risco do horario - uma data
    // nunca cai dentro da faixa de indices - mas entender custa pouco.
    const data = dataEscrita(texto)
    const porData = data
      ? dias.findIndex((chave) => {
          const [, mes, dia] = chave.split('-').map(Number)
          return dia === data.dia && mes === data.mes
        })
      : -1

    const indice = porData >= 0 ? porData : escolha(texto, dias.length)
    if (indice === null) {
      return {
        resposta:
          'Não entendi. Responda com o número do dia da lista acima.\n' +
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
    return await perguntarHorario(
      admin,
      clinicId,
      conversationId,
      opcoes.unidadeEmAndamento,
      dias[indice],
    )
  }

  // ---- Escolha do horario ----
  if (estadoAtual === 'aguardando_horario') {
    if (pediuVoltar(texto)) {
      if (!opcoes.unidadeEmAndamento) {
        return await perguntarUnidade(admin, clinicId, conversationId)
      }
      const { data: unidade } = await admin
        .from('clinic_units')
        .select('id,name,address')
        .eq('id', opcoes.unidadeEmAndamento)
        .maybeSingle()
      if (!unidade) return await perguntarUnidade(admin, clinicId, conversationId)
      return await perguntarDia(admin, clinicId, conversationId, unidade as Unidade)
    }

    const lista = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as Horario[]) : []

    // Hora escrita vem antes do indice, e nao depois: num dia com dez ou mais
    // horarios, "10h" tambem e um indice valido - e apontaria para outra hora.
    const pedida = horaEscrita(texto)
    if (pedida) {
      const timezone = await fusoDaClinica(admin, clinicId)
      const daHora = lista.filter((h) => {
        const [hh, mm] = formatarHora(h.inicio, timezone).split(':').map(Number)
        return hh === pedida.hora && (pedida.minuto === null || mm === pedida.minuto)
      })

      if (daHora.length === 1) {
        if (!opcoes.unidadeEmAndamento) {
          return await mostrarMenu(admin, conversationId, saudacao, 'Perdi o fio da conversa, desculpe. Vamos recomeçar:')
        }
        return await marcar(
          admin, clinicId, conversationId, opcoes.unidadeEmAndamento,
          pacienteDaConsulta, opcoes.telefone, opcoes.nomeDoPerfil, daHora[0],
          opcoes.consultaASubstituir,
        )
      }

      // Ambiguidade de "10h" e entre 10:00 e 10:40, e nao entre os quinze do
      // dia. Repetir a lista inteira aqui empurraria de volta o trabalho que a
      // pessoa ja tinha feito.
      if (daHora.length > 1) {
        const opcoesHora = daHora.map((h) => formatarHora(h.inicio, timezone))
        return {
          resposta:
            `Nesse horário temos ${opcoesHora.slice(0, -1).join(', ')} e ${opcoesHora.at(-1)}.\n\n` +
            'Responda com o horário exato, ou com o número da lista acima.',
        }
      }

      const linhas = lista
        .map((h, i) => `${i + 1} - ${formatarHora(h.inicio, timezone)}`)
        .join('\n')
      return {
        resposta:
          `Esse horário não está entre os livres deste dia. Os disponíveis são:\n\n${linhas}\n\n` +
          'Responda com o número, ou digite VOLTAR para escolher outro dia.',
      }
    }

    const indice = escolha(texto, lista.length)
    if (indice === null) {
      return {
        resposta:
          'Não entendi. Responda com o número do horário da lista acima.\n' +
          'Digite VOLTAR para escolher outro dia, ou MENU para o início.',
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
      pacienteDaConsulta,
      opcoes.telefone,
      opcoes.nomeDoPerfil,
      lista[indice],
      opcoes.consultaASubstituir,
    )
  }

  return null
}
