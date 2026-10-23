import { adminClient, corsHeaders, json } from '../_shared/whatsapp.ts'
import { marcaDoTexto, precisaDoSobre, type MensagemDaConversa } from '../_shared/depois-do-convenio.ts'
import { chaveDoWhatsApp, foraDaListaDeTeste, listaDeTeste } from '../_shared/whatsapp-teste.ts'

/**
 * "Sobre o Dr. Marcello" 30 minutos depois de quem perguntou convenio ou preco
 * e nao escreveu mais (23/10/2026).
 *
 * Chamada pelo pg_cron a cada 10 minutos (migration
 * 20261023120000_depois_do_convenio), com x-cron-secret. A regra de quando
 * mandar mora em _shared/depois-do-convenio.ts, coberta por testes; o texto e
 * a resposta pronta com a chave "Mandar sozinha depois de convenio ou preco"
 * ligada (bot_answers.after_price_silence). Sem nenhuma ligada, nada sai.
 *
 * Falhar aqui nao pode passar calado: recusa da Meta fica gravada na conversa
 * (status failed, com o motivo) e no log, e o resumo diz quantas falharam. A
 * coluna nova faltando grita no log em vez de parecer "ninguem precisava".
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
  const resumo = { enviados: 0, falhas: 0, conferidas: 0, semTexto: 0 }

  try {
    const { data: clinicas, error } = await admin
      .from('clinic_settings')
      .select('clinic_id,whatsapp_phone_number_id,whatsapp_autoreply_enabled')
    if (error) throw error

    for (const ajustes of clinicas ?? []) {
      const clinicId = String(ajustes.clinic_id)
      const phoneNumberId = String(ajustes.whatsapp_phone_number_id ?? '').trim()
      if (!phoneNumberId) continue
      // Robo desligado pelo botao das Conversas (23/10/2026): esta mensagem
      // tambem e do robo, e quem desligou espera silencio.
      if (ajustes.whatsapp_autoreply_enabled === false) {
        console.warn('depois-do-convenio: robo desligado na clinica; nada enviado', clinicId)
        continue
      }

      // O texto: a resposta pronta marcada para isso. Coluna nova, lida a
      // parte - sem ela, nada sai e o log diz por que.
      let texto = ''
      try {
        const { data: marcada, error: erroTexto } = await admin
          .from('bot_answers')
          .select('answer')
          .eq('clinic_id', clinicId)
          .eq('after_price_silence', true)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (erroTexto) throw erroTexto
        texto = String(marcada?.answer ?? '').trim()
      } catch (erro) {
        console.warn('Depois do convenio: nao li o texto (coluna after_price_silence?)', clinicId, erro)
        resumo.falhas++
        continue
      }
      if (!texto) {
        resumo.semTexto++
        continue
      }

      const token = chaveDoWhatsApp(phoneNumberId)
      if (!token) {
        console.warn('Depois do convenio: sem token do WhatsApp para', phoneNumberId)
        resumo.falhas++
        continue
      }
      const lista = await listaDeTeste(admin, clinicId)
      const marca = marcaDoTexto(texto)

      // Abertas, sem a equipe cuidando, que se mexeram dentro da janela da Meta
      // e paradas ha pelo menos 30 minutos.
      const { data: conversas, error: erroConversas } = await admin
        .from('whatsapp_conversations')
        .select('id,clinic_id,wa_id,patient_id,needs_attention')
        .eq('clinic_id', clinicId)
        .eq('status', 'open')
        .gt('last_message_at', new Date(agora.getTime() - 24 * 3600 * 1000).toISOString())
        .lt('last_message_at', new Date(agora.getTime() - 30 * 60 * 1000).toISOString())
      if (erroConversas) {
        console.warn('Depois do convenio: nao consegui ler as conversas', clinicId, erroConversas)
        resumo.falhas++
        continue
      }

      // Robo desligado so nesta conversa pela equipe (23/10/2026): esta
      // mensagem tambem e do robo. Coluna nova, lida a parte; sem ela, nenhuma
      // conversa sai desta rodada - melhor um dia sem o texto que falar com
      // quem a equipe calou.
      const roboDesligadoEm = new Set<string>()
      try {
        const ids = (conversas ?? []).map((c) => String(c.id))
        if (ids.length) {
          const { data: desligadas, error: erroDaChave } = await admin
            .from('whatsapp_conversations')
            .select('id')
            .in('id', ids)
            .not('robo_desligado_em', 'is', null)
          if (erroDaChave) throw erroDaChave
          for (const d of (desligadas ?? []) as { id: string }[]) roboDesligadoEm.add(String(d.id))
        }
      } catch (erro) {
        console.warn('Depois do convenio: sem whatsapp_conversations.robo_desligado_em; nada sai nesta rodada', clinicId, erro)
        resumo.falhas++
        continue
      }

      for (const conversa of conversas ?? []) {
        if (conversa.needs_attention) continue
        if (roboDesligadoEm.has(String(conversa.id))) continue
        if (foraDaListaDeTeste(lista, String(conversa.wa_id))) continue
        resumo.conferidas++

        // Quem pediu para nao receber mensagens.
        if (conversa.patient_id) {
          const { data: paciente } = await admin
            .from('patients')
            .select('whatsapp_opt_out_at')
            .eq('id', conversa.patient_id)
            .maybeSingle()
          if (paciente?.whatsapp_opt_out_at) continue
        }

        const { data: ultimas, error: erroMensagens } = await admin
          .from('whatsapp_messages')
          .select('direction,body,automatic,created_at')
          .eq('conversation_id', conversa.id)
          .order('created_at', { ascending: false })
          .limit(12)
        if (erroMensagens) {
          console.warn('Depois do convenio: nao li as mensagens', conversa.id, erroMensagens)
          resumo.falhas++
          continue
        }
        const mensagens = ((ultimas ?? []) as MensagemDaConversa[]).reverse()
        if (!precisaDoSobre(mensagens, agora, false)) continue

        // Uma vez por familia: procura o comeco do texto no historico inteiro.
        const { data: anterior, error: erroAnterior } = await admin
          .from('whatsapp_messages')
          .select('id')
          .eq('conversation_id', conversa.id)
          .eq('direction', 'outbound')
          .like('body', `${marca.replace(/[%_]/g, '\\$&')}%`)
          .limit(1)
          .maybeSingle()
        if (erroAnterior) {
          console.warn('Depois do convenio: nao conferi se ja recebeu; nao mando', conversa.id, erroAnterior)
          resumo.falhas++
          continue
        }
        if (anterior?.id) continue

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
        if (erroRegistro) console.warn('Depois do convenio: enviado mas nao registrado', conversa.id, erroRegistro)
        if (resposta.ok) resumo.enviados++
        else {
          console.warn('Depois do convenio: Meta recusou', conversa.id, corpo?.error ?? corpo)
          resumo.falhas++
        }
      }
    }
    return json({ ok: true, ...resumo })
  } catch (erro) {
    console.error('Depois do convenio falhou', erro)
    return json({ error: 'Falha no envio depois do convênio.', ...resumo }, 500)
  }
})
