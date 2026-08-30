import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'

/**
 * Resposta livre da equipe para um paciente, a partir da tela de Conversas.
 *
 * A regra que manda aqui e a janela de atendimento da Meta: texto livre so pode
 * ser enviado ate 24 horas depois da ULTIMA mensagem do paciente. Passado isso,
 * so template aprovado. A funcao recusa antes de chamar a Meta para o erro
 * chegar na tela em portugues, e nao como um codigo cru da Graph API.
 */

const JANELA_HORAS = 24
const LIMITE_CARACTERES = 4096

type ReplyRequest = {
  conversationId?: string
  text?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

    const body = (await req.json()) as ReplyRequest
    const texto = (body.text ?? '').trim()
    if (!body.conversationId) return json({ error: 'Conversa não informada.' }, 400)
    if (!texto) return json({ error: 'Escreva a mensagem antes de enviar.' }, 400)
    if (texto.length > LIMITE_CARACTERES) {
      return json({ error: `A mensagem passa de ${LIMITE_CARACTERES} caracteres.` }, 400)
    }

    // A RLS e a autorizacao: so aparece conversa de clinica onde o usuario e
    // membro ativo. Se nao vier nada, ele nao pode responder.
    const scoped = userClient(authorization)
    const { data: visivel, error: visivelError } = await scoped
      .from('whatsapp_conversations')
      .select('id,clinic_id,patient_id,wa_id,status')
      .eq('id', body.conversationId)
      .maybeSingle()

    if (visivelError) {
      console.error('RLS lookup failed', visivelError)
      return json({ error: 'Falha ao verificar a conversa.', code: 'RLS_LOOKUP_FAILED' }, 500)
    }
    if (!visivel) {
      return json({ error: 'Esta conversa não pertence à sua clínica.', code: 'NOT_VISIBLE' }, 403)
    }
    if (visivel.status === 'opted_out') {
      return json({
        error: 'Este contato pediu para não receber mensagens.',
        code: 'OPTED_OUT',
      }, 409)
    }

    const admin = adminClient()

    // Ultima mensagem RECEBIDA. Nao serve o last_message_at da conversa, que
    // tambem se move quando a clinica envia - isso faria a janela parecer
    // aberta para sempre.
    const { data: ultimaEntrada } = await admin
      .from('whatsapp_messages')
      .select('created_at')
      .eq('conversation_id', visivel.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!ultimaEntrada) {
      return json({
        error: 'Este contato ainda não escreveu para a clínica, então só é possível enviar um modelo aprovado.',
        code: 'NO_INBOUND',
      }, 409)
    }

    const fechaEm = new Date(new Date(ultimaEntrada.created_at).getTime() + JANELA_HORAS * 3600 * 1000)
    if (Date.now() > fechaEm.getTime()) {
      return json({
        error: 'A janela de 24 horas fechou. Para retomar, é preciso enviar um modelo aprovado pela Meta.',
        code: 'WINDOW_CLOSED',
        windowClosedAt: fechaEm.toISOString(),
      }, 409)
    }

    const { data: settings } = await admin
      .from('clinic_settings')
      .select('whatsapp_phone_number_id')
      .eq('clinic_id', visivel.clinic_id)
      .single()

    if (!settings?.whatsapp_phone_number_id) {
      return json({ error: 'Configuração do WhatsApp incompleta.', code: 'INCOMPLETE' }, 409)
    }

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
    if (!token) return json({ error: 'Token do WhatsApp não configurado.', code: 'NO_TOKEN' }, 503)

    const graphVersion = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'
    const agora = new Date().toISOString()

    const resposta = await fetch(
      `https://graph.facebook.com/${graphVersion}/${settings.whatsapp_phone_number_id}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: visivel.wa_id,
          type: 'text',
          text: { preview_url: false, body: texto },
        }),
      },
    )

    const corpo = await resposta.json()

    if (!resposta.ok) {
      const motivo = corpo?.error?.message || 'Meta recusou o envio.'
      await admin.from('whatsapp_messages').insert({
        clinic_id: visivel.clinic_id,
        conversation_id: visivel.id,
        patient_id: visivel.patient_id,
        direction: 'outbound',
        message_type: 'text',
        body: texto,
        status: 'failed',
        failed_at: agora,
        failure_reason: motivo,
      })
      return json({ error: 'A Meta recusou o envio.', code: 'META_REJECTED', details: motivo }, 502)
    }

    const { data: salva, error: salvaError } = await admin
      .from('whatsapp_messages')
      .insert({
        clinic_id: visivel.clinic_id,
        conversation_id: visivel.id,
        patient_id: visivel.patient_id,
        external_message_id: corpo?.messages?.[0]?.id ?? null,
        direction: 'outbound',
        message_type: 'text',
        body: texto,
        status: 'accepted',
        sent_at: agora,
      })
      .select('id,status,created_at')
      .single()

    if (salvaError) {
      console.error('Message insert failed', salvaError)
      return json({
        error: 'A mensagem foi enviada mas não pôde ser registrada.',
        code: 'SAVE_FAILED',
      }, 500)
    }

    // Respondeu: a conversa deixa de pedir atencao e some o contador de novas.
    await admin
      .from('whatsapp_conversations')
      .update({ needs_attention: false, unread_count: 0, last_message_at: agora })
      .eq('id', visivel.id)

    return json({ ok: true, message: salva, windowClosesAt: fechaEm.toISOString() })
  } catch (error) {
    console.error(error)
    return json({ error: 'Não foi possível enviar a mensagem agora.' }, 500)
  }
})
