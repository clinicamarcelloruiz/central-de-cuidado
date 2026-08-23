import '../_shared/whatsapp.ts'
import {
  adminClient,
  corsHeaders,
  formatDateBR,
  json,
  toBrazilE164,
  userClient,
} from '../_shared/whatsapp.ts'

type SendRequest = {
  followupId?: string
  consentConfirmed?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

    const body = (await req.json()) as SendRequest
    if (!body.followupId) return json({ error: 'Acompanhamento não informado.' }, 400)

    // The user-scoped query is the authorization check: RLS only exposes follow-ups
    // from clinics where the signed-in user is an active member.
    const scoped = userClient(authorization)
    const { data: visibleFollowup, error: visibleError } = await scoped
      .from('followups')
      .select('id,clinic_id')
      .eq('id', body.followupId)
      .maybeSingle()
    if (visibleError || !visibleFollowup) return json({ error: 'Acesso não autorizado.' }, 403)

    const admin = adminClient()
    const { data: followup, error: followupError } = await admin
      .from('followups')
      .select('id,clinic_id,patient_id,consultation_id,followup_key,due_date,archived_at')
      .eq('id', body.followupId)
      .maybeSingle()
    if (followupError || !followup || followup.archived_at) {
      return json({ error: 'Acompanhamento não encontrado.' }, 404)
    }

    const { data: previous } = await admin
      .from('whatsapp_messages')
      .select('id,external_message_id,status')
      .eq('followup_id', followup.id)
      .eq('direction', 'outbound')
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (previous) return json({ ok: true, alreadySent: true, message: previous })

    const [{ data: patient }, { data: consultation }, { data: settings }] = await Promise.all([
      admin.from('patients').select('id,name,phone,whatsapp_opt_in_at,whatsapp_opt_out_at').eq('id', followup.patient_id).single(),
      admin.from('consultations').select('consultation_date').eq('id', followup.consultation_id).single(),
      admin.from('clinic_settings').select('whatsapp_phone_number_id,whatsapp_template_name,whatsapp_template_language').eq('clinic_id', followup.clinic_id).single(),
    ])

    if (!patient?.phone || !consultation || !settings?.whatsapp_phone_number_id) {
      return json({ error: 'Cadastro ou configuração do WhatsApp incompleta.' }, 409)
    }
    if (patient.whatsapp_opt_out_at) return json({ error: 'Este contato pediu para não receber mensagens.' }, 409)
    if (!patient.whatsapp_opt_in_at && !body.consentConfirmed) {
      return json({ error: 'Confirme o consentimento do paciente ou responsável antes do envio.', code: 'CONSENT_REQUIRED' }, 409)
    }
    if (!patient.whatsapp_opt_in_at && body.consentConfirmed) {
      await admin.from('patients').update({
        whatsapp_opt_in_at: new Date().toISOString(),
        whatsapp_consent_source: 'clinic_system',
      }).eq('id', patient.id)
    }

    const waId = toBrazilE164(patient.phone)
    const now = new Date().toISOString()
    const { data: conversation, error: conversationError } = await admin
      .from('whatsapp_conversations')
      .upsert({
        clinic_id: followup.clinic_id,
        patient_id: patient.id,
        wa_id: waId,
        display_phone: patient.phone,
        status: 'open',
        last_message_at: now,
      }, { onConflict: 'clinic_id,wa_id' })
      .select('id')
      .single()
    if (conversationError) throw conversationError

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
    if (!token) return json({ error: 'Token do WhatsApp ainda não foi configurado no servidor.' }, 503)

    const graphVersion = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'
    const graphResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${settings.whatsapp_phone_number_id}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: waId,
          type: 'template',
          template: {
            name: settings.whatsapp_template_name || 'acompanhamento_pos_consulta',
            language: { code: settings.whatsapp_template_language || 'pt_BR' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: patient.name },
                { type: 'text', text: formatDateBR(consultation.consultation_date) },
              ],
            }],
          },
        }),
      },
    )
    const graphBody = await graphResponse.json()
    if (!graphResponse.ok) {
      await admin.from('whatsapp_messages').insert({
        clinic_id: followup.clinic_id,
        conversation_id: conversation.id,
        patient_id: patient.id,
        followup_id: followup.id,
        direction: 'outbound',
        message_type: 'template',
        template_name: settings.whatsapp_template_name,
        status: 'failed',
        failed_at: now,
        failure_reason: graphBody?.error?.message || 'Meta recusou o envio.',
      })
      return json({ error: 'A Meta recusou o envio.', details: graphBody?.error?.message }, 502)
    }

    const externalMessageId = graphBody?.messages?.[0]?.id ?? null
    const { data: savedMessage, error: saveError } = await admin
      .from('whatsapp_messages')
      .insert({
        clinic_id: followup.clinic_id,
        conversation_id: conversation.id,
        patient_id: patient.id,
        followup_id: followup.id,
        external_message_id: externalMessageId,
        direction: 'outbound',
        message_type: 'template',
        template_name: settings.whatsapp_template_name,
        status: 'accepted',
        sent_at: now,
      })
      .select('id,external_message_id,status')
      .single()
    if (saveError) throw saveError

    await admin.from('followups').update({
      status: 'opened',
      opened_at: now,
      whatsapp_sent_at: now,
      whatsapp_failure_reason: null,
      whatsapp_failed_at: null,
    }).eq('id', followup.id)

    return json({ ok: true, message: savedMessage })
  } catch (error) {
    console.error(error)
    return json({ error: 'Não foi possível enviar a mensagem agora.' }, 500)
  }
})

