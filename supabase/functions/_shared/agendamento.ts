// deno-lint-ignore-file no-explicit-any
/**
 * Agendamento pelo WhatsApp.
 *
 * O paciente escreve "agendar", o sistema pergunta a unidade, lista os horarios
 * livres e marca. Como o webhook nao guarda memoria entre mensagens, a etapa
 * atual fica na propria conversa (booking_state e booking_options).
 *
 * Regra da clinica:
 *  - paciente ja cadastrado marca direto;
 *  - pessoa sem cadastro gera solicitacao com a vaga reservada por 24h, e a
 *    recepcao confirma.
 *
 * Este arquivo so decide e escreve no banco. Quem envia a mensagem e o
 * meta-webhook, que ja tem o token e o numero em maos.
 */

const HORAS_RESERVA = 24
const MAX_HORARIOS = 8

export type ResultadoAgendamento = { resposta: string } | null

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Frases que abrem o fluxo. Curtas de proposito: e o que a pessoa digita. */
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

function cancelouFluxo(texto: string) {
  const t = normalizar(texto)
  return t === 'cancelar' || t === 'parar' || t === 'sair' || t === 'voltar'
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

async function limparEstado(admin: any, conversationId: string) {
  await admin
    .from('whatsapp_conversations')
    .update({
      booking_state: null,
      booking_options: null,
      booking_unit_id: null,
      booking_updated_at: null,
    })
    .eq('id', conversationId)
}

async function unidadesAtivas(admin: any, clinicId: string) {
  const { data } = await admin
    .from('clinic_units')
    .select('id,name,address')
    .eq('clinic_id', clinicId)
    .is('archived_at', null)
    .order('name')
  return (data ?? []) as { id: string; name: string; address: string }[]
}

async function horariosLivres(admin: any, unitId: string) {
  // Libera reservas vencidas antes de listar: sem isso o horario aparece livre
  // aqui e a marcacao falha depois, no indice unico.
  await admin.rpc('liberar_reservas_vencidas')
  const { data } = await admin.rpc('available_slots', { p_unit_id: unitId })
  return ((data ?? []) as { slot_start: string; slot_end: string }[]).slice(0, MAX_HORARIOS)
}

async function perguntarUnidade(
  admin: any,
  clinicId: string,
  conversationId: string,
): Promise<ResultadoAgendamento> {
  const unidades = await unidadesAtivas(admin, clinicId)

  if (unidades.length === 0) {
    return { resposta: 'Ainda não temos horários publicados aqui. Entre em contato com a recepção.' }
  }

  // Uma unidade so: nao faz sentido perguntar, ja mostra os horarios.
  if (unidades.length === 1) {
    return await perguntarHorario(admin, clinicId, conversationId, unidades[0])
  }

  const linhas = unidades.map((u, i) => `${i + 1}. ${u.name}`).join('\n')
  await admin
    .from('whatsapp_conversations')
    .update({
      booking_state: 'aguardando_unidade',
      booking_options: unidades.map((u) => u.id),
      booking_unit_id: null,
      booking_updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  return {
    resposta:
      `Vamos agendar. Em qual unidade você prefere ser atendido?\n\n${linhas}\n\n` +
      'Responda com o número da opção.',
  }
}

async function perguntarHorario(
  admin: any,
  clinicId: string,
  conversationId: string,
  unidade: { id: string; name: string; address: string },
): Promise<ResultadoAgendamento> {
  const { data: clinic } = await admin
    .from('clinics')
    .select('timezone')
    .eq('id', clinicId)
    .maybeSingle()
  const timezone = clinic?.timezone || 'America/Sao_Paulo'

  const horarios = await horariosLivres(admin, unidade.id)

  if (horarios.length === 0) {
    await limparEstado(admin, conversationId)
    return {
      resposta:
        `No momento não há horários livres em ${unidade.name}. ` +
        'Nossa equipe entra em contato para encontrar uma data. Você também pode responder AGENDAR para ver outra unidade.',
    }
  }

  const linhas = horarios
    .map((h, i) => `${i + 1}. ${formatarData(h.slot_start, timezone)}`)
    .join('\n')

  await admin
    .from('whatsapp_conversations')
    .update({
      booking_state: 'aguardando_horario',
      booking_options: horarios.map((h) => ({ inicio: h.slot_start, fim: h.slot_end })),
      booking_unit_id: unidade.id,
      booking_updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  return {
    resposta:
      `Horários disponíveis em ${unidade.name}:\n\n${linhas}\n\n` +
      'Responda com o número do horário desejado, ou CANCELAR para desistir.',
  }
}

async function marcar(
  admin: any,
  clinicId: string,
  conversationId: string,
  unitId: string,
  paciente: { id: string; name: string } | null,
  telefone: string,
  slot: { inicio: string; fim: string },
): Promise<ResultadoAgendamento> {
  const { data: unidade } = await admin
    .from('clinic_units')
    .select('name,address')
    .eq('id', unitId)
    .maybeSingle()
  const { data: clinic } = await admin
    .from('clinics')
    .select('timezone')
    .eq('id', clinicId)
    .maybeSingle()
  const timezone = clinic?.timezone || 'America/Sao_Paulo'

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
          'Esse horário acabou de ser ocupado por outra pessoa. ' +
          'Responda AGENDAR para ver os horários atualizados.',
      }
    }
    console.error('Falha ao marcar consulta', error)
    return {
      resposta:
        'Não consegui concluir o agendamento agora. Nossa equipe vai entrar em contato para ajudar.',
    }
  }

  const quando = formatarData(slot.inicio, timezone)
  const onde = `${unidade?.name ?? 'nossa unidade'}${unidade?.address ? `\n${unidade.address}` : ''}`

  if (cadastrado) {
    return {
      resposta:
        `Consulta marcada!\n\n${quando}\n${onde}\n\n` +
        'Um dia antes enviamos um lembrete para você confirmar. Até lá!',
    }
  }

  return {
    resposta:
      `Recebemos sua solicitação para ${quando}, em ${unidade?.name ?? 'nossa unidade'}.\n\n` +
      'O horário está reservado para você. Nossa equipe confirma em até 24 horas e retorna por aqui.',
  }
}

/**
 * Ponto de entrada. Devolve a resposta a enviar, ou null quando a mensagem nao
 * tem nada a ver com agendamento - nesse caso o webhook segue seu curso normal.
 */
export async function tratarAgendamento(opcoes: {
  admin: any
  clinicId: string
  conversationId: string
  estadoAtual: string | null
  opcoesAtuais: unknown
  unidadeEmAndamento: string | null
  texto: string
  telefone: string
  paciente: { id: string; name: string } | null
}): Promise<ResultadoAgendamento> {
  const { admin, clinicId, conversationId, estadoAtual, texto } = opcoes

  if (estadoAtual && cancelouFluxo(texto)) {
    await limparEstado(admin, conversationId)
    return { resposta: 'Tudo bem, agendamento cancelado. Se precisar, responda AGENDAR quando quiser.' }
  }

  if (!estadoAtual) {
    if (!pediuAgendamento(texto)) return null
    return await perguntarUnidade(admin, clinicId, conversationId)
  }

  if (estadoAtual === 'aguardando_unidade') {
    const ids = Array.isArray(opcoes.opcoesAtuais) ? (opcoes.opcoesAtuais as string[]) : []
    const indice = escolha(texto, ids.length)
    if (indice === null) {
      return { resposta: 'Não entendi. Responda com o número da unidade, ou CANCELAR para desistir.' }
    }
    const unidades = await unidadesAtivas(admin, clinicId)
    const escolhida = unidades.find((u) => u.id === ids[indice])
    if (!escolhida) {
      await limparEstado(admin, conversationId)
      return { resposta: 'Essa unidade não está mais disponível. Responda AGENDAR para recomeçar.' }
    }
    return await perguntarHorario(admin, clinicId, conversationId, escolhida)
  }

  if (estadoAtual === 'aguardando_horario') {
    const lista = Array.isArray(opcoes.opcoesAtuais)
      ? (opcoes.opcoesAtuais as { inicio: string; fim: string }[])
      : []
    const indice = escolha(texto, lista.length)
    if (indice === null) {
      return { resposta: 'Não entendi. Responda com o número do horário, ou CANCELAR para desistir.' }
    }
    if (!opcoes.unidadeEmAndamento) {
      await limparEstado(admin, conversationId)
      return { resposta: 'Perdi o fio da conversa. Responda AGENDAR para recomeçar.' }
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
