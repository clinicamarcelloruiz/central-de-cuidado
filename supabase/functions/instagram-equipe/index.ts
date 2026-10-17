/**
 * O que a equipe faz no Instagram pela tela da Central (16/10/2026).
 *
 *   responder           texto no direct (so ate 24 h depois da ultima mensagem da pessoa)
 *   comentario_direct   resposta privada a um comentario (uma por comentario, ate 7 dias)
 *   comentario_publico  resposta embaixo do comentario
 *   conectar            dono da clinica cola o token do Instagram (tela de Configuracoes)
 *   conectar_codigo     dono da clinica entrou pelo login oficial; troca o codigo pelo token
 *   desconectar         dono da clinica desliga a conta
 *   buscar_comentarios  traz os comentarios dos ultimos 7 dias dos posts recentes
 *
 * A RLS e a autorizacao: so passa conversa e comentario de clinica onde o usuario
 * e membro. O envio usa o token da conta, que so o servidor le.
 */
import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'
import {
  comentarioAindaRespondivel,
  comentariosParaImportar,
  dentroDaJanela,
  respostaPrivadaAoComentario,
  type ComentarioParaGravar,
} from '../_shared/instagram.ts'
import { codigoDaVolta, INSTAGRAM_APP_ID, permissoesQueFaltam, voltaPermitida } from '../_shared/instagram-login.ts'
import {
  assinarAvisos,
  comentariosDoPost,
  enviarDirect,
  postsRecentes,
  quemEDono,
  responderComentarioEmPublico,
  responderComentarioNoDirect,
  trocarCodigoPorToken,
} from '../_shared/instagram-api.ts'
import { quemAtende } from '../_shared/quem-atende.ts'

type Pedido = {
  acao?: string
  conversaId?: string
  commentId?: string
  clinicId?: string
  texto?: string
  token?: string
  whatsapp?: string
  code?: string
  redirectUri?: string
}

const LIMITE = 1000

async function contaDaClinica(admin: ReturnType<typeof adminClient>, clinicId: string) {
  const { data } = await admin
    .from('instagram_contas')
    .select('clinic_id,ig_user_id,username,access_token,whatsapp')
    .eq('clinic_id', clinicId)
    .maybeSingle()
  return data as { clinic_id: string; ig_user_id: string; username: string | null; access_token: string; whatsapp: string } | null
}

async function gritar(admin: ReturnType<typeof adminClient>, clinicId: string, erro: string) {
  await admin.from('instagram_contas').update({ ultimo_erro: erro.slice(0, 500), ultimo_erro_em: new Date().toISOString() }).eq('clinic_id', clinicId)
}

/**
 * Grava a conta e liga os avisos, venha o token colado ou do login oficial.
 * `aviso` volta para a tela quando algo ficou pela metade (conectou, mas os
 * avisos nao ligaram, ou faltou autorizar uma permissao): nunca em silencio.
 */
async function gravarConta(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  token: string,
  whatsapp: string,
  expiraEm: string,
  faltam: string[] = [],
) {
  const dono = await quemEDono(token)
  if (!dono.ok) return json({ error: `O Instagram não aceitou o acesso: ${dono.erro}`, code: 'TOKEN_RECUSADO' }, 400)
  const agora = new Date().toISOString()
  const { error } = await admin.from('instagram_contas').upsert(
    {
      clinic_id: clinicId,
      ig_user_id: dono.userId,
      username: dono.username,
      access_token: token,
      whatsapp,
      // O webhook renova antes de vencer (60 dias).
      token_expira_em: expiraEm,
      token_renovado_em: agora,
      ultimo_erro: null,
      ultimo_erro_em: null,
      updated_at: agora,
    },
    { onConflict: 'clinic_id' },
  )
  if (error) return json({ error: 'Não consegui gravar a conta.', details: error.message }, 500)
  const avisos: string[] = []
  if (faltam.length) avisos.push(`faltou autorizar ${faltam.join(', ')} no Instagram; entre de novo e deixe tudo marcado`)
  const assinatura = await assinarAvisos({ ig_user_id: dono.userId, access_token: token })
  if (!assinatura.ok) avisos.push(`os avisos de mensagem não foram ligados: ${assinatura.erro}`)
  if (avisos.length) {
    const texto = `Conectado, mas ${avisos.join('; ')}.`
    await gritar(admin, clinicId, texto)
    return json({ ok: true, username: dono.username, aviso: texto })
  }
  return json({ ok: true, username: dono.username })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)
    const escopo = userClient(authorization)
    const admin = adminClient()
    const pedido = (await req.json()) as Pedido
    const texto = (pedido.texto ?? '').trim()

    // ------------------------------------------------------------ conectar / desconectar
    if (pedido.acao === 'conectar' || pedido.acao === 'conectar_codigo' || pedido.acao === 'desconectar') {
      const clinicId = String(pedido.clinicId ?? '')
      const { data: usuario } = await escopo.auth.getUser()
      if (!clinicId || !usuario?.user?.id) return json({ error: 'Clínica não informada.' }, 400)
      const { data: dono } = await escopo
        .from('clinic_memberships')
        .select('clinic_id')
        .eq('clinic_id', clinicId)
        .eq('user_id', usuario.user.id)
        .eq('role', 'owner')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (!dono) return json({ error: 'Só o responsável pela clínica conecta o Instagram.', code: 'SO_DONO' }, 403)

      if (pedido.acao === 'desconectar') {
        const { error } = await admin.from('instagram_contas').delete().eq('clinic_id', clinicId)
        if (error) return json({ error: 'Não consegui desconectar.', details: error.message }, 500)
        return json({ ok: true })
      }

      const whatsapp = String(pedido.whatsapp ?? '').replace(/\D/g, '')
      if (whatsapp.length < 12 || !whatsapp.startsWith('55')) {
        return json({ error: 'Informe o WhatsApp da clínica com 55 e DDD, por exemplo 5513999990000.' }, 400)
      }

      if (pedido.acao === 'conectar_codigo') {
        const code = codigoDaVolta(pedido.code)
        const redirectUri = String(pedido.redirectUri ?? '')
        if (!code) return json({ error: 'O Instagram não devolveu o código do login. Tente entrar de novo.' }, 400)
        if (!voltaPermitida(redirectUri)) return json({ error: 'Endereço de volta do login não reconhecido.' }, 400)
        const segredo = Deno.env.get('INSTAGRAM_APP_SECRET')?.trim()
        if (!segredo) {
          console.error('instagram-equipe: login oficial sem INSTAGRAM_APP_SECRET')
          return json({ error: 'Falta o segredo INSTAGRAM_APP_SECRET no servidor: avise o suporte.', code: 'SEM_SEGREDO' }, 500)
        }
        const appId = Deno.env.get('INSTAGRAM_APP_ID')?.trim() || INSTAGRAM_APP_ID
        const troca = await trocarCodigoPorToken(code, redirectUri, appId, segredo)
        if (!troca.ok) return json({ error: `O Instagram não concluiu o login: ${troca.erro}`, code: 'LOGIN_RECUSADO' }, 400)
        return await gravarConta(admin, clinicId, troca.token, whatsapp, troca.expiraEm, permissoesQueFaltam(troca.permissoes))
      }

      const token = String(pedido.token ?? '').trim()
      if (!token) return json({ error: 'Cole o token do Instagram.' }, 400)
      // Token gerado no painel da Meta vale 60 dias.
      return await gravarConta(admin, clinicId, token, whatsapp, new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString())
    }

    // ------------------------------------------------------------ buscar comentarios
    if (pedido.acao === 'buscar_comentarios') {
      const clinicId = String(pedido.clinicId ?? '')
      if (!clinicId) return json({ error: 'Clínica não informada.' }, 400)
      // A RLS deixa ver a linha da conta (sem o token) so para quem e da clinica.
      const { data: visivel } = await escopo.from('instagram_contas').select('clinic_id').eq('clinic_id', clinicId).maybeSingle()
      if (!visivel) return json({ error: 'O Instagram desta clínica não está conectado.', code: 'NOT_VISIBLE' }, 403)
      const conta = await contaDaClinica(admin, clinicId)
      if (!conta) return json({ error: 'O Instagram desta clínica não está conectado.' }, 409)

      const posts = await postsRecentes(conta, 10)
      if (!posts.ok) {
        await gritar(admin, clinicId, `Buscar comentários: ${posts.erro}`)
        return json({ error: `O Instagram recusou: ${posts.erro}`, code: 'RECUSADO' }, 502)
      }
      const linhas: (ComentarioParaGravar & { clinic_id: string })[] = []
      const falhas: string[] = []
      for (const mediaId of posts.ids) {
        const r = await comentariosDoPost(conta, mediaId)
        if (!r.ok) {
          falhas.push(r.erro)
          continue
        }
        for (const l of comentariosParaImportar(mediaId, r.lista, { igUserId: conta.ig_user_id, username: conta.username })) {
          linhas.push({ ...l, clinic_id: clinicId })
        }
      }
      let novos = 0
      if (linhas.length) {
        // Comentario que o webhook ja gravou (ou uma busca anterior) fica como esta.
        const { data, error } = await admin
          .from('instagram_comentarios')
          .upsert(linhas, { onConflict: 'comment_id', ignoreDuplicates: true })
          .select('comment_id')
        if (error) return json({ error: 'Não consegui gravar os comentários.', details: error.message }, 500)
        novos = data?.length ?? 0
      }
      if (falhas.length) await gritar(admin, clinicId, `Buscar comentários: ${falhas.length} post(s) sem resposta do Instagram (${falhas[0]})`)
      return json({ ok: true, posts: posts.ids.length, encontrados: linhas.length, novos, falhas: falhas.length })
    }

    // ------------------------------------------------------------ responder no direct
    if (pedido.acao === 'responder') {
      if (!pedido.conversaId) return json({ error: 'Conversa não informada.' }, 400)
      if (!texto) return json({ error: 'Escreva a mensagem antes de enviar.' }, 400)
      if (texto.length > LIMITE) return json({ error: `A mensagem passa de ${LIMITE} caracteres.` }, 400)
      const { data: visivel } = await escopo
        .from('instagram_conversas')
        .select('id,clinic_id,igsid,ultima_da_pessoa_em')
        .eq('id', pedido.conversaId)
        .maybeSingle()
      if (!visivel) return json({ error: 'Conversa não encontrada.', code: 'NOT_VISIBLE' }, 403)
      if (!dentroDaJanela(visivel.ultima_da_pessoa_em)) {
        return json({
          error: 'Passaram 24 h desde a última mensagem da pessoa: o Instagram não deixa responder pelo sistema. Responda pelo app do Instagram ou espere ela escrever de novo.',
          code: 'JANELA_FECHADA',
        }, 409)
      }
      const conta = await contaDaClinica(admin, visivel.clinic_id)
      if (!conta) return json({ error: 'O Instagram desta clínica não está conectado.' }, 409)
      // Grava antes de enviar, como o robo: o eco da Meta reconhece a mensagem pelo texto.
      const { data: linha } = await admin
        .from('instagram_mensagens')
        .insert({ clinic_id: conta.clinic_id, conversa_id: visivel.id, direcao: 'saida', texto, automatica: false, status: 'enviando' })
        .select('id')
        .single()
      const envio = await enviarDirect(conta, visivel.igsid, texto)
      if (linha?.id) {
        await admin
          .from('instagram_mensagens')
          .update({ mid: envio.ok ? envio.mid : null, status: envio.ok ? 'enviada' : 'falhou', erro: envio.ok ? null : envio.erro })
          .eq('id', linha.id)
      }
      if (!envio.ok) {
        await gritar(admin, conta.clinic_id, envio.erro)
        return json({ error: `O Instagram recusou: ${envio.erro}`, code: 'RECUSADO' }, 502)
      }
      await admin
        .from('instagram_conversas')
        .update({ precisa_equipe: false, motivo: null, nao_lidas: 0, ultima_mensagem_em: new Date().toISOString() })
        .eq('id', visivel.id)
      return json({ ok: true })
    }

    // ------------------------------------------------------------ comentarios
    if (pedido.acao === 'comentario_direct' || pedido.acao === 'comentario_publico') {
      if (!pedido.commentId) return json({ error: 'Comentário não informado.' }, 400)
      const { data: visivel } = await escopo
        .from('instagram_comentarios')
        .select('comment_id,clinic_id,autor_username,created_at,respondido_no_direct_em')
        .eq('comment_id', pedido.commentId)
        .maybeSingle()
      if (!visivel) return json({ error: 'Comentário não encontrado.', code: 'NOT_VISIBLE' }, 403)
      const conta = await contaDaClinica(admin, visivel.clinic_id)
      if (!conta) return json({ error: 'O Instagram desta clínica não está conectado.' }, 409)
      const agora = new Date().toISOString()

      if (pedido.acao === 'comentario_direct') {
        if (visivel.respondido_no_direct_em) return json({ error: 'Este comentário já recebeu mensagem no direct.', code: 'JA_RESPONDIDO' }, 409)
        if (!comentarioAindaRespondivel(visivel.created_at)) {
          return json({ error: 'O Instagram só deixa responder no direct até 7 dias depois do comentário.', code: 'PRAZO' }, 409)
        }
        const corpo = texto || respostaPrivadaAoComentario(visivel.autor_username ?? '', { medico: quemAtende(conta.clinic_id).o, whatsapp: conta.whatsapp })
        const envio = await responderComentarioNoDirect(conta, visivel.comment_id, corpo)
        if (!envio.ok) {
          await admin.from('instagram_comentarios').update({ erro: envio.erro }).eq('comment_id', visivel.comment_id)
          return json({ error: `O Instagram recusou: ${envio.erro}`, code: 'RECUSADO' }, 502)
        }
        await admin.from('instagram_comentarios').update({ respondido_no_direct_em: agora, precisa_equipe: false, erro: null }).eq('comment_id', visivel.comment_id)
        return json({ ok: true })
      }

      if (!texto) return json({ error: 'Escreva a resposta antes de enviar.' }, 400)
      const envio = await responderComentarioEmPublico(conta, visivel.comment_id, texto)
      if (!envio.ok) {
        await admin.from('instagram_comentarios').update({ erro: envio.erro }).eq('comment_id', visivel.comment_id)
        return json({ error: `O Instagram recusou: ${envio.erro}`, code: 'RECUSADO' }, 502)
      }
      await admin
        .from('instagram_comentarios')
        .update({ resposta_publica: texto, respondido_em_publico_em: agora, precisa_equipe: false, erro: null })
        .eq('comment_id', visivel.comment_id)
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (erro) {
    console.error('instagram-equipe falhou', erro)
    return json({ error: 'Não foi possível concluir.', details: String(erro).slice(0, 200) }, 500)
  }
})
