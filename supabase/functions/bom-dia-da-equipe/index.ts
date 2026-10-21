import { adminClient, corsHeaders, json } from '../_shared/whatsapp.ts'
import { precisaDoBomDia, textoDoBomDia, type MensagemDaFila } from '../_shared/bom-dia-da-equipe.ts'
import { chaveDoWhatsApp, foraDaListaDeTeste, listaDeTeste } from '../_shared/whatsapp-teste.ts'

/**
 * Bom dia das 8h para quem chamou a equipe de madrugada (21/10/2026).
 *
 * Chamada pelo pg_cron as 8h, todo dia (migration
 * 20261021120000_bom_dia_todo_dia), com x-cron-secret. A regra mora em
 * _shared/bom-dia-da-equipe.ts; aqui so se le o banco e envia.
 *
 * Falhar aqui nao pode passar calado: cada recusa da Meta fica gravada na
 * conversa (status failed, com o motivo) e no log, e o resumo da resposta diz
 * quantas falharam.
 */

const GRAPH = () => Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const esperado = Deno.env.get('CRON_SECRET')?.trim()
  if (!esperado) return json({ error: 'CRON_SECRET não configurado no servidor.' }, 503)
  if (req.headers.get('x-cron-secret')?.trim() !== esperado) return json({ error: 'Não autorizado.' }, 401)

  const admin = adminClient()
  const agora = new Date()
  const resumo = { enviados: 0, falhas: 0, conferidas: 0 }
  const texto = textoDoBomDia(agora)

  try {
    const { data: clinicas, error } = await admin
      .from('clinic_settings')
      .select('clinic_id,whatsapp_phone_number_id')
    if (error) throw error

    for (const ajustes of clinicas ?? []) {
      const clinicId = String(ajustes.clinic_id)
      const phoneNumberId = String(ajustes.whatsapp_phone_number_id ?? '').trim()
      if (!phoneNumberId) continue
      const token = chaveDoWhatsApp(phoneNumberId)
      if (!token) {
        console.warn('Bom dia da equipe: sem token do WhatsApp para', phoneNumberId)
        resumo.falhas++
        continue
      }
      const lista = await listaDeTeste(admin, clinicId)

      // So conversas abertas que se mexeram nas ultimas 24h: as outras ja
      // passaram da janela da Meta.
      const { data: conversas, error: erroConversas } = await admin
        .from('whatsapp_conversations')
        .select('id,clinic_id,wa_id,patient_id')
        .eq('clinic_id', clinicId)
        .eq('status', 'open')
        .gt('last_message_at', new Date(agora.getTime() - 24 * 3600 * 1000).toISOString())
      if (erroConversas) {
        console.warn('Bom dia da equipe: nao consegui ler as conversas', clinicId, erroConversas)
        resumo.falhas++
        continue
      }

      for (const conversa of conversas ?? []) {
        if (foraDaListaDeTeste(lista, String(conversa.wa_id))) continue
        resumo.conferidas++
        const { data: ultimas, error: erroMensagens } = await admin
          .from('whatsapp_messages')
          .select('direction,body,automatic,created_at')
          .eq('conversation_id', conversa.id)
          .order('created_at', { ascending: false })
          .limit(8)
        if (erroMensagens) {
          console.warn('Bom dia da equipe: nao li as mensagens', conversa.id, erroMensagens)
          resumo.falhas++
          continue
        }
        const mensagens = ((ultimas ?? []) as MensagemDaFila[]).reverse()
        if (!precisaDoBomDia(mensagens, agora)) continue

        const enviadoEm = new Date().toISOString()
        const resposta = await fetch(`https://graph.facebook.com/${GRAPH()}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: conversa.wa_id,
            type: 'text',
            text: { body: texto },
          }),
        })
        const corpo = await resposta.json().catch(() => ({}))
        const { error: erroRegistro } = await admin.from('whatsapp_messages').insert({
          clinic_id: conversa.clinic_id,
          conversation_id: conversa.id,
          patient_id: conversa.patient_id,
          external_message_id: resposta.ok ? corpo?.messages?.[0]?.id ?? null : null,
          direction: 'outbound',
          message_type: 'text',
          body: texto,
          automatic: true,
          status: resposta.ok ? 'accepted' : 'failed',
          sent_at: resposta.ok ? enviadoEm : null,
          failed_at: resposta.ok ? null : enviadoEm,
          failure_reason: resposta.ok ? null : corpo?.error?.message ?? 'Meta recusou o envio.',
        })
        if (erroRegistro) console.warn('Bom dia da equipe: enviado mas nao registrado', conversa.id, erroRegistro)
        if (resposta.ok) resumo.enviados++
        else {
          console.warn('Bom dia da equipe: Meta recusou', conversa.id, corpo?.error ?? corpo)
          resumo.falhas++
        }
      }
    }
    return json({ ok: true, ...resumo })
  } catch (erro) {
    console.error('Bom dia da equipe falhou', erro)
    return json({ error: 'Falha no bom dia da equipe.', ...resumo }, 500)
  }
})
