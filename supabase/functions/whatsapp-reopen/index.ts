import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'

/**
 * Retoma uma conversa cuja janela de 24 horas ja fechou.
 *
 * Fora da janela a Meta so aceita template aprovado. Este envio nao resolve o
 * assunto - ele reabre a porta: o paciente responde, a janela volta a contar, e
 * a equipe escreve livremente de novo pela tela de sempre.
 *
 * Recusa de proposito quando a janela AINDA esta aberta. Ali o texto livre
 * funciona, chega mais completo e (ate outubro de 2026) e gratuito; gastar um
 * template no lugar dele seria pagar para dizer menos.
 */

const JANELA_HORAS = 24

type ReopenRequest = { conversationId?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

    const body = (await req.json()) as ReopenRequest
    if (!body.conversationId) return json({ error: 'Conversa não informada.' }, 400)

    // A RLS e a autorizacao: so aparece conversa de clinica onde o usuario e
    // membro ativo. Se nao vier nada, ele nao pode escrever para esta pessoa.
    const scoped = userClient(authorization)
    const { data: visivel, error: visivelError } = await scoped
      .from('whatsapp_conversations')
      .select('id,clinic_id,patient_id,wa_id,status,profile_name')
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

    const { data: ultimaEntrada } = await admin
      .from('whatsapp_messages')
      .select('created_at')
      .eq('conversation_id', visivel.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ultimaEntrada) {
      const fechaEm = new Date(
        new Date(ultimaEntrada.created_at).getTime() + JANELA_HORAS * 3600 * 1000,
      )
      if (Date.now() <= fechaEm.getTime()) {
        return json({
          error: 'A janela ainda está aberta. Responda com texto livre, que chega mais completo.',
          code: 'WINDOW_OPEN',
        }, 409)
      }
    }

    const { data: settings } = await admin
      .from('clinic_settings')
      .select('whatsapp_phone_number_id,whatsapp_reopen_template_name,whatsapp_template_language')
      .eq('clinic_id', visivel.clinic_id)
      .single()

    if (!settings?.whatsapp_phone_number_id) {
      return json({ error: 'Configuração do WhatsApp incompleta.', code: 'INCOMPLETE' }, 409)
    }

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
    if (!token) return json({ error: 'Token do WhatsApp não configurado.', code: 'NO_TOKEN' }, 503)

    // O nome de quem recebe. Sem cadastro, vale o nome do perfil do WhatsApp; e
    // sem nenhum dos dois, um tratamento neutro - a Meta recusa a mensagem
    // inteira se a variavel vier vazia.
    let nome = (visivel.profile_name ?? '').trim()
    if (visivel.patient_id) {
      const { data: paciente } = await admin
        .from('patients')
        .select('name')
        .eq('id', visivel.patient_id)
        .maybeSingle()
      if (paciente?.name) nome = paciente.name
    }
    const primeiroNome = (nome.split(/\s+/)[0] || 'tudo bem').slice(0, 60)

    const templateName = settings.whatsapp_reopen_template_name || 'retomar_atendimento'
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
          type: 'template',
          template: {
            name: templateName,
            language: { code: settings.whatsapp_template_language || 'pt_BR' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: primeiroNome }] }],
          },
        }),
      },
    )

    const corpo = await resposta.json()
    // O historico guarda o que a mensagem FAZ, e nao o nome tecnico do modelo:
    // quem abrir a conversa amanha precisa entender o que o paciente recebeu.
    const resumo = `Mensagem enviada para retomar o atendimento com ${primeiroNome}.`

    if (!resposta.ok) {
      const motivo = corpo?.error?.message || 'Meta recusou o envio.'
      await admin.from('whatsapp_messages').insert({
        clinic_id: visivel.clinic_id,
        conversation_id: visivel.id,
        patient_id: visivel.patient_id,
        direction: 'outbound',
        automatic: false,
        message_type: 'template',
        template_name: templateName,
        body: resumo,
        status: 'failed',
        failed_at: agora,
        failure_reason: motivo,
      })
      // 132001 = template inexistente ou ainda nao aprovado naquele idioma. E o
      // erro esperado enquanto a Meta nao aprovou, e merece texto proprio.
      const naoAprovado = corpo?.error?.code === 132001 || /template/i.test(String(motivo))
      return json({
        error: naoAprovado
          ? `O modelo "${templateName}" ainda não está aprovado na Meta. Assim que a aprovação sair, este botão funciona.`
          : 'A Meta recusou o envio.',
        code: naoAprovado ? 'TEMPLATE_NOT_APPROVED' : 'META_REJECTED',
        details: motivo,
      }, 502)
    }

    const { error: salvaError } = await admin.from('whatsapp_messages').insert({
      clinic_id: visivel.clinic_id,
      conversation_id: visivel.id,
      patient_id: visivel.patient_id,
      external_message_id: corpo?.messages?.[0]?.id ?? null,
      direction: 'outbound',
      automatic: false,
      message_type: 'template',
      template_name: templateName,
      body: resumo,
      status: 'accepted',
      sent_at: agora,
    })

    if (salvaError) {
      console.error('Message insert failed', salvaError)
      return json({
        error: 'A mensagem foi enviada mas não pôde ser registrada.',
        code: 'SAVE_FAILED',
      }, 500)
    }

    await admin
      .from('whatsapp_conversations')
      .update({ needs_attention: false, last_message_at: agora })
      .eq('id', visivel.id)

    return json({ ok: true, enviadoPara: primeiroNome })
  } catch (causa) {
    console.error('whatsapp-reopen failed', causa)
    return json({ error: 'Falha inesperada ao enviar.', code: 'UNEXPECTED' }, 500)
  }
})
