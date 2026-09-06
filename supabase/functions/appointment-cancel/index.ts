import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'

/**
 * Cancela uma consulta e avisa o paciente pelo WhatsApp.
 *
 * As duas coisas juntas de proposito. Enquanto eram separadas, o botao da
 * agenda apenas liberava o horario e ninguem avisava a familia: o paciente
 * aparecia na unidade no dia, com a crianca, e descobria na recepcao.
 *
 * O aviso nem sempre chega, e a funcao nao esconde isso. Fora da janela de 24
 * horas da Meta so passa template aprovado, e a clinica ainda nao tem um para
 * cancelamento. Quando nao da, a consulta e cancelada do mesmo jeito - o
 * horario precisa ser liberado - mas a resposta diz que ninguem foi avisado,
 * para a recepcao telefonar. Cancelar em silencio achando que avisou seria o
 * pior dos dois mundos.
 */

const JANELA_HORAS = 24

type Pedido = {
  appointmentId?: string
  /** Rotulo escolhido na tela, ou o texto que a pessoa escreveu. */
  motivo?: string
  /** Falso quando a equipe prefere ligar em vez de mandar mensagem. */
  avisarPaciente?: boolean
}

/**
 * O que o paciente le.
 *
 * O motivo entra na mensagem porque "sua consulta foi cancelada" sem explicacao
 * soa a descaso. A excecao e quando o cancelamento partiu da propria familia:
 * ali repetir o motivo de volta seria estranho, e a mensagem vira confirmacao.
 */
function mensagemParaPaciente(
  nome: string,
  quando: string,
  unidade: string | null,
  motivo: string,
) {
  const tratamento = nome ? `Olá, ${nome}! ` : 'Olá! '
  const onde = unidade ? ` em ${unidade}` : ''

  if (/pedido (do|da) paciente|pedido da fam[ií]lia/i.test(motivo)) {
    return (
      `${tratamento}Confirmando: sua consulta de *${quando}*${onde} foi cancelada, ` +
      'conforme você pediu.\n\n' +
      'Quando quiser remarcar, é só responder aqui. Digite *2* para ver os horários.'
    )
  }

  return (
    `${tratamento}Precisamos cancelar sua consulta de *${quando}*${onde}.\n\n` +
    `Motivo: ${motivo}.\n\n` +
    'Sentimos muito pelo transtorno. Para escolher uma nova data, digite *2* ' +
    'aqui mesmo, ou responda esta mensagem que a nossa equipe ajuda.'
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

  try {
    const corpo = (await req.json()) as Pedido
    if (!corpo.appointmentId) return json({ error: 'Consulta não informada.' }, 400)

    const motivo = (corpo.motivo ?? '').trim()
    if (!motivo) return json({ error: 'Escolha ou escreva o motivo.' }, 400)

    const escopo = userClient(autorizacao)
    const admin = adminClient()

    // A RLS e a autorizacao: consulta de outra clinica nao aparece.
    const { data: consulta } = await escopo
      .from('appointments')
      .select('id,clinic_id,patient_id,starts_at,status,unit_id')
      .eq('id', corpo.appointmentId)
      .maybeSingle()

    if (!consulta) return json({ error: 'Consulta não encontrada.', code: 'NOT_VISIBLE' }, 403)
    if (consulta.status === 'cancelled') {
      return json({ error: 'Esta consulta já estava cancelada.', code: 'JA_CANCELADA' }, 409)
    }

    const { data: usuario } = await escopo.auth.getUser()
    const agora = new Date().toISOString()

    // Primeiro cancela. O horario tem de ser liberado mesmo que o aviso falhe:
    // o pior resultado possivel seria uma vaga presa por causa da Meta.
    const { error: erroCancelar } = await admin
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: agora,
        cancellation_reason: motivo.slice(0, 300),
        cancelled_by: usuario?.user?.id ?? null,
      })
      .eq('id', consulta.id)
      .neq('status', 'cancelled')

    if (erroCancelar) {
      console.error('Falha ao cancelar', erroCancelar)
      return json({ error: 'Não foi possível cancelar a consulta.' }, 500)
    }

    if (corpo.avisarPaciente === false) {
      return json({ ok: true, avisado: false, motivoDoSilencio: 'A equipe escolheu não avisar.' })
    }

    // ---- Aviso ao paciente ----

    const { data: conversa } = await admin
      .from('whatsapp_conversations')
      .select('id,wa_id,status,profile_name')
      .eq('clinic_id', consulta.clinic_id)
      .eq('patient_id', consulta.patient_id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conversa) {
      return json({
        ok: true,
        avisado: false,
        motivoDoSilencio: 'Este paciente nunca conversou pelo WhatsApp da clínica.',
      })
    }
    if (conversa.status === 'opted_out') {
      return json({
        ok: true,
        avisado: false,
        motivoDoSilencio: 'Este contato pediu para não receber mensagens.',
      })
    }

    const { data: ultimaEntrada } = await admin
      .from('whatsapp_messages')
      .select('created_at')
      .eq('conversation_id', conversa.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const dentroDaJanela = ultimaEntrada
      ? Date.now() - new Date(ultimaEntrada.created_at).getTime() < JANELA_HORAS * 3600 * 1000
      : false

    if (!dentroDaJanela) {
      return json({
        ok: true,
        avisado: false,
        motivoDoSilencio:
          'O paciente não escreve há mais de 24 horas, e nesse caso a Meta só aceita ' +
          'mensagem por modelo aprovado. Ligue para avisar.',
      })
    }

    const { data: paciente } = await admin
      .from('patients')
      .select('name')
      .eq('id', consulta.patient_id)
      .maybeSingle()

    const { data: unidade } = consulta.unit_id
      ? await admin.from('clinic_units').select('name').eq('id', consulta.unit_id).maybeSingle()
      : { data: null }

    const { data: ajustes } = await admin
      .from('clinic_settings')
      .select('whatsapp_phone_number_id')
      .eq('clinic_id', consulta.clinic_id)
      .maybeSingle()

    // O fuso vive em clinics, e nao em clinic_settings. Sem ele, uma consulta
    // das 15:00 seria anunciada como 18:00 para o paciente.
    const { data: clinica } = await admin
      .from('clinics')
      .select('timezone')
      .eq('id', consulta.clinic_id)
      .maybeSingle()

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
    if (!token || !ajustes?.whatsapp_phone_number_id) {
      return json({
        ok: true,
        avisado: false,
        motivoDoSilencio: 'O WhatsApp da clínica não está configurado.',
      })
    }

    const fuso = clinica?.timezone || 'America/Sao_Paulo'
    const quando = new Date(consulta.starts_at).toLocaleString('pt-BR', {
      timeZone: fuso,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace('-feira', '')

    const primeiroNome = (paciente?.name ?? conversa.profile_name ?? '')
      .trim()
      .split(/\s+/)[0] ?? ''

    const texto = mensagemParaPaciente(primeiroNome, quando, unidade?.name ?? null, motivo)
    const versao = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'

    const envio = await fetch(
      `https://graph.facebook.com/${versao}/${ajustes.whatsapp_phone_number_id}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: conversa.wa_id,
          type: 'text',
          text: { preview_url: false, body: texto },
        }),
      },
    )

    const resposta = await envio.json()

    await admin.from('whatsapp_messages').insert({
      clinic_id: consulta.clinic_id,
      conversation_id: conversa.id,
      patient_id: consulta.patient_id,
      appointment_id: consulta.id,
      external_message_id: resposta?.messages?.[0]?.id ?? null,
      direction: 'outbound',
      automatic: true,
      message_type: 'text',
      body: texto,
      status: envio.ok ? 'accepted' : 'failed',
      sent_at: envio.ok ? agora : null,
      failed_at: envio.ok ? null : agora,
      failure_reason: envio.ok ? null : String(resposta?.error?.message ?? '').slice(0, 300),
    })

    if (!envio.ok) {
      console.error('Meta recusou o aviso de cancelamento', resposta)
      return json({
        ok: true,
        avisado: false,
        motivoDoSilencio: 'A Meta recusou o envio. Ligue para avisar.',
      })
    }

    await admin
      .from('appointments')
      .update({ cancellation_notified_at: agora })
      .eq('id', consulta.id)

    return json({ ok: true, avisado: true, enviadoPara: primeiroNome || null })
  } catch (causa) {
    console.error('appointment-cancel falhou', causa)
    return json({ error: causa instanceof Error ? causa.message : 'Falha inesperada.' }, 500)
  }
})
