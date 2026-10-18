import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'
import { chavesDaClinica, entregar } from '../_shared/push-da-equipe.ts'
import { descreverEnvio, enviarAlertaDeUrgencia } from '../_shared/alerta-de-urgencia.ts'
import { quemEscreveu } from '../_shared/aviso-da-equipe.ts'

/**
 * Notificacoes no celular: o lado que o navegador chama (28/09/2026).
 *
 *   { acao: 'chave' }            -> chave publica VAPID, para o celular se inscrever
 *   { acao: 'teste', clinicId }  -> manda "teste" para os aparelhos DA PESSOA
 *   { acao: 'alerta_teste', clinicId } -> o alerta de urgencia, no WhatsApp
 *                                   dos numeros salvos (17/10/2026)
 *   { acao: 'encaminhar', clinicId, conversaId } -> a conversa, como pedido,
 *                                   nos mesmos numeros (18/10/2026)
 *
 * O aviso de verdade (mensagem da familia) nao passa por aqui: sai do proprio
 * meta-webhook, por _shared/push-da-equipe.ts, sem uma segunda requisicao que
 * pudesse falhar calada no meio.
 *
 * O botao de teste existe porque notificacao tem muitos jeitos de nao chegar
 * sem erro nenhum - permissao negada, iPhone fora da tela de inicio, modo foco.
 * A pessoa aperta, ve (ou nao ve) chegar, e sabe na hora.
 */

type Pedido = { acao?: 'chave' | 'teste' | 'alerta_teste' | 'encaminhar'; clinicId?: string; conversaId?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

  try {
    const corpo = (await req.json().catch(() => ({}))) as Pedido
    const admin = adminClient()

    if (corpo.acao === 'chave') {
      const chaves = await chavesDaClinica(admin)
      return json({ chave: chaves.publica })
    }

    if (corpo.acao === 'teste') {
      if (!corpo.clinicId) return json({ error: 'Clínica não informada.' }, 400)
      // Pela sessao da pessoa: a RLS so devolve as inscricoes DELA, e so de
      // clinica em que ela esta ativa.
      const escopo = userClient(autorizacao)
      const { data: linhas, error } = await escopo
        .from('push_inscricoes')
        .select('id,user_id,endpoint,p256dh,auth')
        .eq('clinic_id', corpo.clinicId)
      if (error) return json({ error: `Não consegui ler os aparelhos: ${error.message}` }, 500)
      if (!linhas?.length) return json({ error: 'Nenhum aparelho seu está ativado nesta clínica.' }, 404)

      const chaves = await chavesDaClinica(admin)
      const r = await entregar(
        admin,
        linhas,
        {
          titulo: 'Teste da Central de Cuidado',
          corpo: 'Se você está lendo isto, as mensagens das famílias vão chegar aqui. ✅',
          etiqueta: 'teste',
          conversa: '',
          urgente: false,
        },
        chaves,
      )
      return json(r)
    }

    // Alerta de urgencia de teste (17/10/2026): a mesma mensagem que o medico
    // recebe, para os numeros salvos na tela. E o jeito de saber, antes da
    // primeira urgencia de verdade, se o modelo foi aprovado e se os numeros
    // estao certos - o alerta que nao chega nao avisa que nao chegou.
    if (corpo.acao === 'alerta_teste') {
      if (!corpo.clinicId) return json({ error: 'Clínica não informada.' }, 400)
      // Pela sessao da pessoa: a RLS so devolve a clinica em que ela esta ativa.
      const { data: daClinica, error: erroDaClinica } = await userClient(autorizacao)
        .from('clinic_settings')
        .select('clinic_id')
        .eq('clinic_id', corpo.clinicId)
        .maybeSingle()
      if (erroDaClinica || !daClinica) return json({ error: 'Sem acesso a esta clínica.' }, 403)
      const envios = await enviarAlertaDeUrgencia(admin, {
        clinicId: corpo.clinicId,
        canal: 'WhatsApp',
        quem: 'Teste da Central',
        texto: 'Este é um teste do alerta de urgência. Nenhuma família foi afetada.',
        agora: new Date(),
      })
      if (!envios.length) return json({ error: 'Nenhum número salvo para o alerta.' }, 404)
      return json({ envios, ...descreverEnvio(envios) })
    }

    // "Mandar para o celular" na conversa aberta da Central (18/10/2026): o
    // mesmo pedido que sai sozinho quando a familia chama a equipe, para os
    // casos em que o robo nao chamou e alguem quer a opiniao do medico. A
    // resposta dele volta para a familia pelo mesmo caminho (resposta-ao-alerta.ts).
    if (corpo.acao === 'encaminhar') {
      if (!corpo.clinicId || !corpo.conversaId) return json({ error: 'Conversa não informada.' }, 400)
      // Pela sessao da pessoa: a RLS so devolve conversa de clinica em que ela esta ativa.
      const { data: conversa, error: erroDaConversa } = await userClient(autorizacao)
        .from('whatsapp_conversations')
        .select('id,wa_id,profile_name,patient_id')
        .eq('clinic_id', corpo.clinicId)
        .eq('id', corpo.conversaId)
        .maybeSingle()
      if (erroDaConversa || !conversa) return json({ error: 'Sem acesso a esta conversa.' }, 403)
      const { data: paciente } = conversa.patient_id
        ? await admin.from('patients').select('name').eq('id', conversa.patient_id).maybeSingle()
        : { data: null }
      const { data: ultima } = await admin
        .from('whatsapp_messages')
        .select('body')
        .eq('conversation_id', conversa.id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const envios = await enviarAlertaDeUrgencia(admin, {
        tipo: 'pedido',
        assunto: 'encaminhado pela Central',
        clinicId: corpo.clinicId,
        canal: 'WhatsApp',
        quem: quemEscreveu({
          pacientes: paciente?.name ? [{ name: String(paciente.name) }] : [],
          nomeDoPerfil: String(conversa.profile_name ?? ''),
          telefone: String(conversa.wa_id ?? ''),
        }),
        texto: String(ultima?.body ?? '').trim() || 'Sem mensagem da família nesta conversa.',
        agora: new Date(),
        conversaWhatsApp: conversa.id,
      })
      if (!envios.length) return json({ error: 'Nenhum número salvo em Atendente com IA para receber no celular.' }, 404)
      return json({ envios, ...descreverEnvio(envios, 'pedido') })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (erro) {
    console.warn('notificar-equipe falhou', erro)
    return json({ error: erro instanceof Error ? erro.message : String(erro) }, 500)
  }
})
