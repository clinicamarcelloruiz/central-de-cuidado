import '../_shared/whatsapp.ts'
import { adminClient, digits, sha256HmacHex, safeEqual } from '../_shared/whatsapp.ts'

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
          .select('clinic_id')
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .maybeSingle()
        if (!settings?.clinic_id) continue
        const clinicId = settings.clinic_id

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
          const { data: patient } = await admin
            .from('patients')
            .select('id')
            .eq('clinic_id', clinicId)
            .is('archived_at', null)
            .or(`phone_digits.eq.${waId},phone_digits.eq.${localDigits}`)
            .limit(1)
            .maybeSingle()

          const body = messageBody(message)
          const reply = normalizedReply(body)
          const optedOut = reply === 'sair' || reply === 'nao quero receber'
          const isWell = reply === 'estou bem'
          // Respostas ao lembrete de consulta. Aceita a palavra sozinha ou o
          // numero do botao, porque o paciente escreve dos dois jeitos.
          const confirma = reply === 'confirmar' || reply === 'confirmo' || reply === '1'
          const remarca =
            reply === 'reagendar' || reply === 'remarcar' || reply === 'reagendar consulta' || reply === '2'
          // Remarcar exige alguem da equipe: o paciente pediu, mas ninguem
          // escolheu o novo horario ainda.
          const needsAttention = reply === 'preciso de ajuda' || remarca
          const receivedAt = message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString()

          const { data: conversation, error: conversationError } = await admin
            .from('whatsapp_conversations')
            .upsert({
              clinic_id: clinicId,
              patient_id: patient?.id ?? null,
              wa_id: waId,
              display_phone: waId,
              status: optedOut ? 'opted_out' : 'open',
              needs_attention: needsAttention,
              last_message_at: receivedAt,
            }, { onConflict: 'clinic_id,wa_id' })
            .select('id,unread_count')
            .single()
          if (conversationError) throw conversationError

          await admin.from('whatsapp_conversations').update({
            unread_count: (conversation.unread_count ?? 0) + 1,
            needs_attention: needsAttention,
            status: optedOut ? 'opted_out' : 'open',
          }).eq('id', conversation.id)

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

          // Confirmacao ou pedido de remarcacao referem-se sempre a ultima
          // consulta sobre a qual mandamos lembrete nesta conversa.
          if (patient?.id && (confirma || remarca)) {
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
              await admin
                .from('appointments')
                .update(
                  confirma
                    ? { confirmed_at: receivedAt, reschedule_requested_at: null }
                    : { reschedule_requested_at: receivedAt, confirmed_at: null },
                )
                .eq('id', ultimoLembrete.appointment_id)
                .eq('status', 'scheduled')
            }
          }

          // "Preciso de ajuda" explicito, e nao qualquer coisa que acendeu a
          // bandeira de atencao: um pedido de remarcacao nao reabre um
          // acompanhamento clinico.
          if (patient?.id && (isWell || reply === 'preciso de ajuda')) {
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
