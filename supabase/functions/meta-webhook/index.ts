import '../_shared/whatsapp.ts'
import { adminClient, digits, sha256HmacHex, safeEqual } from '../_shared/whatsapp.ts'
import { type Estado, tratarConversa } from '../_shared/atendimento.ts'

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

type WebhookMessage = {
  type?: string
  text?: { body?: string }
  button?: { text?: string; payload?: string }
  interactive?: {
    button_reply?: { title?: string }
    list_reply?: { title?: string }
  }
}

type DeliveryError = { title?: string; message?: string }

function messageBody(message: WebhookMessage) {
  if (message.type === 'text') return message.text?.body ?? ''
  if (message.type === 'button') return message.button?.text ?? message.button?.payload ?? ''
  if (message.type === 'interactive') {
    return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? ''
  }
  return `[${message.type || 'mensagem'}]`
}

function normalizedReply(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

const statusRank: Record<string, number> = {
  queued: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')?.trim()
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (verifyToken && mode === 'subscribe' && token === verifyToken && challenge) return text(challenge)
    return text('Webhook verification failed', 403)
  }

  if (req.method !== 'POST') return text('Method not allowed', 405)

  const rawBody = await req.text()
  const appSecret = Deno.env.get('META_APP_SECRET')?.trim()
  const providedSignature = req.headers.get('x-hub-signature-256') ?? ''
  if (!appSecret || !providedSignature.startsWith('sha256=')) return text('Unauthorized', 401)

  const expected = `sha256=${await sha256HmacHex(appSecret, rawBody)}`
  if (!safeEqual(expected, providedSignature)) return text('Invalid signature', 401)

  try {
    const payload = JSON.parse(rawBody)
    const admin = adminClient()

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value ?? {}
        const phoneNumberId = String(value.metadata?.phone_number_id ?? '')
        if (!phoneNumberId) continue

        const { data: settings } = await admin
          .from('clinic_settings')
          .select(
            'clinic_id,whatsapp_autoreply_enabled,whatsapp_autoreply_text,whatsapp_autoreply_known_text,whatsapp_menu_info_text',
          )
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .maybeSingle()
        if (!settings?.clinic_id) continue
        const clinicId = settings.clinic_id

        // A Meta manda em `contacts` o nome que a pessoa configurou no WhatsApp
        // dela. Nao e nome verificado, mas para um contato sem cadastro e a
        // unica coisa que a equipe tem para saber com quem esta falando.
        const nomePorWaId = new Map<string, string>()
        for (const contato of value.contacts ?? []) {
          const id = digits(String(contato?.wa_id ?? ''))
          const nome = String(contato?.profile?.name ?? '').trim()
          if (id && nome) nomePorWaId.set(id, nome.slice(0, 120))
        }

        for (const message of value.messages ?? []) {
          const externalId = String(message.id ?? '')
          if (!externalId) continue

          const { error: eventError } = await admin.from('whatsapp_webhook_events').insert({
            event_key: `message:${externalId}`,
            event_kind: 'message',
            payload: { entry_id: entry.id, change },
          })
          if (eventError?.code === '23505') continue
          if (eventError) throw eventError

          const waId = digits(String(message.from ?? ''))
          const localDigits = waId.startsWith('55') ? waId.slice(2) : waId
          // Todos os pacientes deste telefone, e nao o primeiro que aparecer.
          // Numa gastropediatria a mae cadastra os dois filhos com o proprio
          // celular; escolher sozinho marcava consulta no nome do irmao errado.
          const { data: patientRows } = await admin
            .from('patients')
            .select('id,name')
            .eq('clinic_id', clinicId)
            .is('archived_at', null)
            .or(`phone_digits.eq.${waId},phone_digits.eq.${localDigits}`)
            .order('name')

          const pacientes = (patientRows ?? []).map((p) => ({
            id: p.id as string,
            name: (p.name as string) ?? '',
          }))
          // Para ligar a conversa e as mensagens basta um: sao da familia toda.
          // Quem precisa de precisao e a consulta, e essa o robo pergunta.
          const patient = pacientes[0] ?? null

          // Consultas futuras deste telefone. Alimentam a opcao 4 do menu e o
          // aviso de "voce ja tem uma marcada" antes de criar uma segunda.
          const { data: futurasRows } = await admin
            .from('appointments')
            .select('id,starts_at,unit_id,contact_name,patient_id,confirmed_by_clinic')
            .eq('clinic_id', clinicId)
            .eq('status', 'scheduled')
            .gte('starts_at', new Date().toISOString())
            .or(`contact_phone.eq.${waId},contact_phone.eq.${localDigits}`)
            .order('starts_at')

          const idsUnidades = [...new Set((futurasRows ?? []).map((a) => a.unit_id))]
          const unidadesPorId = new Map<string, { name: string; address: string }>()
          if (idsUnidades.length > 0) {
            const { data: us } = await admin
              .from('clinic_units')
              .select('id,name,address')
              .in('id', idsUnidades)
            for (const u of us ?? []) unidadesPorId.set(u.id, { name: u.name, address: u.address })
          }

          const nomePorPacienteId = new Map(pacientes.map((p) => [p.id, p.name]))
          const consultas = (futurasRows ?? []).map((a) => ({
            id: a.id as string,
            inicio: a.starts_at as string,
            unidade: unidadesPorId.get(a.unit_id)?.name ?? 'nossa unidade',
            endereco: unidadesPorId.get(a.unit_id)?.address ?? '',
            paciente:
              (a.patient_id ? nomePorPacienteId.get(a.patient_id) : null) ??
              (a.contact_name as string) ??
              '',
            confirmada: Boolean(a.confirmed_by_clinic),
          }))

          // Estado da conversa ANTES de gravar esta mensagem. E o que diz se a
          // pessoa e nova: depois do upsert a linha ja existe sempre.
          const { data: conversaAnterior } = await admin
            .from('whatsapp_conversations')
            .select(
              'id,booking_state,booking_options,booking_unit_id,booking_patient_id,' +
                'booking_replaces_id,needs_attention,profile_name',
            )
            .eq('clinic_id', clinicId)
            .eq('wa_id', waId)
            .maybeSingle()

          // A ultima coisa que NOS mandamos foi um lembrete de consulta ou um
          // acompanhamento? So nesse caso "1", "2" e "3" significam confirmar,
          // remarcar e cancelar. Fora dele sao opcoes de menu.
          //
          // Antes isso era decidido por "esta no meio de um agendamento?", o
          // que deixava o numero ambiguo em toda conversa parada. Amarrar a
          // leitura ao que acabamos de perguntar acaba com a duvida.
          let respondendoEnvioNosso = false
          // Alguem da EQUIPE escreveu para esta pessoa ha pouco: conversa humana
          // em andamento, e o robo nao entra no meio dela oferecendo menu.
          //
          // A pergunta precisa ser sobre gente. Ate 30/08/2026 ela era so "saiu
          // alguma mensagem daqui?", e o robo se calava por causa da propria
          // voz: respondeu 11:36, a pessoa escreveu "Oi" as 14:28 e nao recebeu
          // nada.
          let equipeFalouRecentemente = false
          if (conversaAnterior?.id) {
            const [ultimoNossoResult, ultimoHumanoResult] = await Promise.all([
              admin
                .from('whatsapp_messages')
                .select('followup_id,appointment_id,created_at')
                .eq('conversation_id', conversaAnterior.id)
                .eq('direction', 'outbound')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              admin
                .from('whatsapp_messages')
                .select('created_at')
                .eq('conversation_id', conversaAnterior.id)
                .eq('direction', 'outbound')
                .eq('automatic', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            ])

            const ultimoNosso = ultimoNossoResult.data
            const desdeOUltimo = ultimoNosso?.created_at
              ? Date.now() - new Date(ultimoNosso.created_at).getTime()
              : Number.POSITIVE_INFINITY

            respondendoEnvioNosso = Boolean(
              desdeOUltimo < 48 * 3600 * 1000 &&
                (ultimoNosso?.followup_id || ultimoNosso?.appointment_id),
            )

            const humanoEm = ultimoHumanoResult.data?.created_at
            equipeFalouRecentemente = Boolean(
              humanoEm && Date.now() - new Date(humanoEm).getTime() < 12 * 3600 * 1000,
            )
          }

          const body = messageBody(message)
          const reply = normalizedReply(body)
          const optedOut = reply === 'sair' || reply === 'nao quero receber'
          const isWell = reply === 'estou bem'
          // Respostas ao lembrete de consulta. Aceita a palavra sozinha ou o
          // numero do botao, porque o paciente escreve dos dois jeitos.
          const confirma =
            respondendoEnvioNosso &&
            (reply === 'confirmar' || reply === 'confirmo' || reply === '1')
          const remarca =
            respondendoEnvioNosso &&
            (reply === 'reagendar' || reply === 'remarcar' || reply === 'reagendar consulta' || reply === '2')
          const cancela =
            respondendoEnvioNosso &&
            (reply === 'cancelar' || reply === 'cancelo' || reply === 'cancelar consulta' || reply === '3')
          const respondeuLembrete = confirma || remarca || cancela
          // Remarcar e cancelar exigem alguem da equipe: no primeiro caso
          // ninguem escolheu o novo horario ainda; no segundo a agenda abriu um
          // buraco que a recepcao pode querer preencher.
          const pediuAjuda = reply === 'preciso de ajuda'
          const motivoAtencao = remarca
            ? 'remarcacao'
            : cancela
              ? 'cancelamento'
              : pediuAjuda
                ? 'ajuda'
                : null
          const receivedAt = message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString()

          // A bandeira de atencao so sobe aqui, nunca desce: quem baixa e a
          // equipe, abrindo a conversa na tela. Antes cada nova mensagem do
          // paciente apagava o pedido anterior - quem escrevia duas vezes
          // sumia da lista de quem esperava retorno.
          const aguardandoEquipe = Boolean(conversaAnterior?.needs_attention)
          const marcarAtencao = aguardandoEquipe || Boolean(motivoAtencao)

          // Sem nome novo no evento, mantem o que ja estava gravado em vez de
          // apagar: nem todo evento traz o bloco `contacts`.
          const nomeDoPerfil = nomePorWaId.get(waId) ?? ''

          const { data: conversation, error: conversationError } = await admin
            .from('whatsapp_conversations')
            .upsert({
              clinic_id: clinicId,
              patient_id: patient?.id ?? null,
              wa_id: waId,
              display_phone: waId,
              status: optedOut ? 'opted_out' : 'open',
              needs_attention: marcarAtencao,
              last_message_at: receivedAt,
              ...(nomeDoPerfil ? { profile_name: nomeDoPerfil } : {}),
            }, { onConflict: 'clinic_id,wa_id' })
            .select('id,unread_count')
            .single()
          if (conversationError) throw conversationError

          const atualizacaoConversa: Record<string, unknown> = {
            unread_count: (conversation.unread_count ?? 0) + 1,
            needs_attention: marcarAtencao,
            status: optedOut ? 'opted_out' : 'open',
          }
          if (motivoAtencao) atualizacaoConversa.attention_reason = motivoAtencao
          if (nomeDoPerfil) atualizacaoConversa.profile_name = nomeDoPerfil
          await admin
            .from('whatsapp_conversations')
            .update(atualizacaoConversa)
            .eq('id', conversation.id)

          const { error: messageError } = await admin.from('whatsapp_messages').insert({
            clinic_id: clinicId,
            conversation_id: conversation.id,
            patient_id: patient?.id ?? null,
            external_message_id: externalId,
            direction: 'inbound',
            message_type: message.type || 'text',
            body,
            status: 'delivered',
            delivered_at: receivedAt,
          })
          if (messageError?.code !== '23505' && messageError) throw messageError

          if (patient?.id && optedOut) {
            await admin.from('patients').update({ whatsapp_opt_out_at: receivedAt }).eq('id', patient.id)
          }

          /** Envia texto livre. Vale porque a mensagem que acabou de chegar
              abriu a janela de 24h - nao precisa de modelo aprovado. */
          async function responder(texto: string, appointmentId: string | null = null) {
            const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
            if (!token || !texto.trim()) return false
            const graphVersion = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'
            const enviadoEm = new Date().toISOString()

            const envio = await fetch(
              `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: waId,
                  type: 'text',
                  text: { preview_url: false, body: texto },
                }),
              },
            )
            const corpoEnvio = await envio.json()

            await admin.from('whatsapp_messages').insert({
              clinic_id: clinicId,
              conversation_id: conversation.id,
              patient_id: patient?.id ?? null,
              appointment_id: appointmentId,
              external_message_id: envio.ok ? corpoEnvio?.messages?.[0]?.id ?? null : null,
              direction: 'outbound',
              message_type: 'text',
              body: texto,
              // Quem falou foi o robo. E o que impede ele de se confundir com a
              // secretaria e ficar mudo depois da propria mensagem.
              automatic: true,
              status: envio.ok ? 'accepted' : 'failed',
              sent_at: envio.ok ? enviadoEm : null,
              failed_at: envio.ok ? null : enviadoEm,
              failure_reason: envio.ok ? null : corpoEnvio?.error?.message ?? 'Meta recusou o envio.',
            })
            return envio.ok
          }

          // ---- Atendimento automatico ----
          //
          // Um unico ponto decide o que responder: menu, informacoes,
          // agendamento ou silencio. Antes eram dois blocos independentes que
          // podiam falar juntos.
          //
          // Nao roda quando a pessoa esta respondendo um lembrete: ali "1" e
          // confirmacao de consulta, e o trecho mais abaixo cuida disso.
          if (!optedOut && !respondeuLembrete && !isWell && settings.whatsapp_autoreply_enabled) {
            const resultado = await tratarConversa({
              admin,
              clinicId,
              conversationId: conversation.id,
              estadoAtual: (conversaAnterior?.booking_state ?? null) as Estado | null,
              opcoesAtuais: conversaAnterior?.booking_options ?? null,
              unidadeEmAndamento: conversaAnterior?.booking_unit_id ?? null,
              podeIniciarMenu: !respondendoEnvioNosso && !equipeFalouRecentemente,
              aguardandoEquipe,
              texto: body,
              telefone: waId,
              pacientes,
              pacienteEmAndamento: conversaAnterior?.booking_patient_id ?? null,
              consultas,
              consultaASubstituir: conversaAnterior?.booking_replaces_id ?? null,
              nomeDoPerfil: nomeDoPerfil || conversaAnterior?.profile_name || '',
              textos: {
                saudacao: settings.whatsapp_autoreply_text ?? '',
                saudacaoConhecida: settings.whatsapp_autoreply_known_text ?? '',
                informacoes: settings.whatsapp_menu_info_text ?? '',
              },
            })

            if (resultado) {
              await responder(resultado.resposta)
              if (resultado.atencao) {
                await admin
                  .from('whatsapp_conversations')
                  .update({ needs_attention: true, attention_reason: resultado.atencao })
                  .eq('id', conversation.id)
              }
            }
          }

          // Confirmar, remarcar ou cancelar referem-se sempre a ultima consulta
          // sobre a qual mandamos lembrete nesta conversa.
          if (patient?.id && respondeuLembrete) {
            const { data: ultimoLembrete } = await admin
              .from('whatsapp_messages')
              .select('appointment_id')
              .eq('conversation_id', conversation.id)
              .eq('direction', 'outbound')
              .not('appointment_id', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (ultimoLembrete?.appointment_id) {
              // Cancelar muda o status: o indice unico de horario ignora
              // canceladas, entao a vaga volta a aparecer como livre na hora.
              const mudanca = confirma
                ? { confirmed_at: receivedAt, reschedule_requested_at: null }
                : cancela
                  ? { status: 'cancelled', cancelled_at: receivedAt, confirmed_at: null }
                  : { reschedule_requested_at: receivedAt, confirmed_at: null }

              await admin
                .from('appointments')
                .update(mudanca)
                .eq('id', ultimoLembrete.appointment_id)
                .eq('status', 'scheduled')
            }

            // Ate aqui o sistema anotava a resposta e nao dizia nada de volta.
            // Quem confirmava a consulta ficava sem saber se tinha dado certo.
            const aviso = confirma
              ? 'Consulta confirmada, obrigado! Até lá.'
              : cancela
                ? 'Consulta cancelada. Se quiser marcar outra data, responda AGENDAR.'
                : 'Certo! Já avisei a nossa equipe para remarcar com você. Alguém retorna por aqui.'
            await responder(`${aviso}\n\nDigite MENU se precisar de mais alguma coisa.`)
          }

          // "Preciso de ajuda" explicito, e nao qualquer coisa que acendeu a
          // bandeira de atencao: um pedido de remarcacao nao reabre um
          // acompanhamento clinico.
          if (patient?.id && (isWell || pediuAjuda)) {
            const { data: lastOutbound } = await admin
              .from('whatsapp_messages')
              .select('followup_id')
              .eq('conversation_id', conversation.id)
              .eq('direction', 'outbound')
              .not('followup_id', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (lastOutbound?.followup_id) {
              await admin.from('followups').update(isWell
                ? { status: 'completed', completed_at: receivedAt }
                : { status: 'opened' })
                .eq('id', lastOutbound.followup_id)
            }
          }
        }

        for (const delivery of value.statuses ?? []) {
          const externalId = String(delivery.id ?? '')
          const status = String(delivery.status ?? '')
          if (!externalId || statusRank[status] === undefined) continue

          const eventKey = `status:${externalId}:${status}:${delivery.timestamp ?? ''}`
          const { error: eventError } = await admin.from('whatsapp_webhook_events').insert({
            event_key: eventKey,
            event_kind: `status_${status}`,
            payload: { entry_id: entry.id, change },
          })
          if (eventError?.code === '23505') continue
          if (eventError) throw eventError

          const { data: stored } = await admin
            .from('whatsapp_messages')
            .select('id,status,followup_id')
            .eq('external_message_id', externalId)
            .maybeSingle()
          if (!stored || statusRank[status] < (statusRank[stored.status] ?? 0)) continue

          const at = delivery.timestamp
            ? new Date(Number(delivery.timestamp) * 1000).toISOString()
            : new Date().toISOString()
          const errorText = delivery.errors
            ?.map((item: DeliveryError) => item.title || item.message)
            .filter(Boolean)
            .join('; ') || null
          const update: Record<string, unknown> = { status }
          if (status === 'sent') update.sent_at = at
          if (status === 'delivered') update.delivered_at = at
          if (status === 'read') update.read_at = at
          if (status === 'failed') {
            update.failed_at = at
            update.failure_reason = errorText || 'Falha informada pela Meta.'
          }
          await admin.from('whatsapp_messages').update(update).eq('id', stored.id)

          if (stored.followup_id) {
            const followupUpdate: Record<string, unknown> = {}
            if (status === 'delivered') followupUpdate.whatsapp_delivered_at = at
            if (status === 'read') followupUpdate.whatsapp_read_at = at
            if (status === 'failed') {
              followupUpdate.whatsapp_failed_at = at
              followupUpdate.whatsapp_failure_reason = errorText || 'Falha informada pela Meta.'
            }
            if (Object.keys(followupUpdate).length) {
              await admin.from('followups').update(followupUpdate).eq('id', stored.followup_id)
            }
          }
        }
      }
    }

    return text('EVENT_RECEIVED')
  } catch (error) {
    console.error(error)
    // A non-2xx response asks Meta to retry transient failures.
    return text('Processing failed', 500)
  }
})
