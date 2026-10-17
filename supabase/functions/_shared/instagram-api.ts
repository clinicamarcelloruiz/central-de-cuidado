/**
 * Chamadas a API do Instagram (Instagram API com login do Instagram), 16/10/2026.
 *
 * Tudo devolve { ok, ... } em vez de lancar: quem chama decide como gritar. Uma
 * resposta que a Meta recusou nao pode sumir no log - ela vira mensagem com
 * status "falhou" na conversa e ultimo_erro na conta, que a tela mostra em
 * vermelho (lembrar o lembrete da vespera que parou tres semanas em silencio).
 */
import type { Opcao } from './instagram.ts'
import { OPCOES } from './instagram.ts'

export type ContaInstagram = { ig_user_id: string; access_token: string }
export type Envio = { ok: true; mid: string | null } | { ok: false; erro: string; codigo?: number }

function versao() {
  return Deno.env.get('INSTAGRAM_GRAPH_VERSION')?.trim() || Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'
}

const BASE = () => `https://graph.instagram.com/${versao()}`

async function chamar(caminho: string, token: string, corpo?: Record<string, unknown>, metodo = 'POST'): Promise<{ ok: boolean; json: Record<string, any> }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const r = await fetch(`${BASE()}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
    const json = await r.json().catch(() => ({}))
    return { ok: r.ok && !json?.error, json }
  } catch (erro) {
    return { ok: false, json: { error: { message: `Sem conexão com o Instagram: ${String(erro).slice(0, 120)}` } } }
  }
}

function falha(json: Record<string, any>): Envio { // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ok: false, erro: String(json?.error?.message ?? 'O Instagram recusou o envio.'), codigo: Number(json?.error?.code) || undefined }
}

/** Mensagem no direct, com botoes de resposta rapida quando houver. */
export async function enviarDirect(conta: ContaInstagram, igsid: string, texto: string, opcoes: Opcao[] = []): Promise<Envio> {
  const message: Record<string, unknown> = { text: texto.slice(0, 1000) }
  if (opcoes.length) {
    message.quick_replies = opcoes.map((id) => ({ content_type: 'text', title: OPCOES[id], payload: id }))
  }
  const { ok, json } = await chamar(`/${conta.ig_user_id}/messages`, conta.access_token, { recipient: { id: igsid }, message })
  return ok ? { ok: true, mid: json?.message_id ?? null } : falha(json)
}

/** Resposta privada a um comentario: chega no direct da pessoa (uma por comentario, ate 7 dias). */
export async function responderComentarioNoDirect(conta: ContaInstagram, commentId: string, texto: string): Promise<Envio> {
  const { ok, json } = await chamar(`/${conta.ig_user_id}/messages`, conta.access_token, {
    recipient: { comment_id: commentId },
    message: { text: texto.slice(0, 1000) },
  })
  return ok ? { ok: true, mid: json?.message_id ?? null } : falha(json)
}

/** Resposta publica embaixo do comentario. */
export async function responderComentarioEmPublico(conta: ContaInstagram, commentId: string, texto: string): Promise<Envio> {
  const { ok, json } = await chamar(`/${commentId}/replies`, conta.access_token, { message: texto.slice(0, 2200) })
  return ok ? { ok: true, mid: json?.id ?? null } : falha(json)
}

/** O @ de quem escreveu no direct (so funciona para quem mandou mensagem a conta). */
export async function perfilDe(conta: ContaInstagram, igsid: string): Promise<string | null> {
  const { ok, json } = await chamar(`/${igsid}?fields=username`, conta.access_token, undefined, 'GET')
  return ok && json?.username ? String(json.username) : null
}

/** Quem e o dono do token: o id que chega no webhook (user_id) e o @. */
export async function quemEDono(token: string): Promise<{ ok: true; userId: string; username: string } | { ok: false; erro: string }> {
  const { ok, json } = await chamar('/me?fields=user_id,username', token, undefined, 'GET')
  if (!ok || !json?.user_id) return { ok: false, erro: String(json?.error?.message ?? 'Token não aceito pelo Instagram.') }
  return { ok: true, userId: String(json.user_id), username: String(json.username ?? '') }
}

/** Liga os avisos de mensagem e de comentario desta conta para o webhook do app. */
export async function assinarAvisos(conta: ContaInstagram): Promise<Envio> {
  const { ok, json } = await chamar(`/${conta.ig_user_id}/subscribed_apps?subscribed_fields=messages,comments`, conta.access_token)
  return ok ? { ok: true, mid: null } : falha(json)
}

/** Os posts mais recentes da conta (para buscar comentarios). */
export async function postsRecentes(conta: ContaInstagram, limite = 10): Promise<{ ok: true; ids: string[] } | { ok: false; erro: string }> {
  const { ok, json } = await chamar(`/${conta.ig_user_id}/media?fields=id,timestamp&limit=${limite}`, conta.access_token, undefined, 'GET')
  if (!ok) return { ok: false, erro: String(json?.error?.message ?? 'O Instagram não devolveu os posts.') }
  return { ok: true, ids: ((json?.data ?? []) as { id?: unknown }[]).map((m) => String(m?.id ?? '')).filter(Boolean) }
}

/** Comentarios de um post, com quem escreveu e quando. */
export async function comentariosDoPost(conta: ContaInstagram, mediaId: string): Promise<{ ok: true; lista: Record<string, any>[] } | { ok: false; erro: string }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { ok, json } = await chamar(`/${mediaId}/comments?fields=id,text,timestamp,username,from&limit=50`, conta.access_token, undefined, 'GET')
  if (!ok) return { ok: false, erro: String(json?.error?.message ?? 'O Instagram não devolveu os comentários.') }
  return { ok: true, lista: Array.isArray(json?.data) ? json.data : [] }
}

/**
 * Login oficial: troca o codigo da volta por um token de 1 hora e esse por um
 * de 60 dias. Precisa do segredo do app do Instagram (INSTAGRAM_APP_SECRET), o
 * mesmo que confere a assinatura do webhook.
 */
export async function trocarCodigoPorToken(
  code: string,
  redirectUri: string,
  appId: string,
  segredo: string,
): Promise<{ ok: true; token: string; expiraEm: string; permissoes: unknown } | { ok: false; erro: string }> {
  try {
    const r1 = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: appId, client_secret: segredo, grant_type: 'authorization_code', redirect_uri: redirectUri, code }),
    })
    const j1 = await r1.json().catch(() => ({}))
    // Versoes antigas devolviam { data: [ {...} ] }; as novas, o objeto direto.
    const curto = j1?.access_token ?? j1?.data?.[0]?.access_token
    if (!r1.ok || !curto) {
      return { ok: false, erro: String(j1?.error_message ?? j1?.error?.message ?? 'O Instagram não aceitou o login.') }
    }
    const r2 = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(segredo)}&access_token=${encodeURIComponent(curto)}`,
    )
    const j2 = await r2.json().catch(() => ({}))
    if (!r2.ok || !j2?.access_token) return { ok: false, erro: String(j2?.error?.message ?? 'O Instagram não deu o acesso de 60 dias.') }
    const segundos = Number(j2.expires_in) || 60 * 24 * 3600
    return {
      ok: true,
      token: String(j2.access_token),
      expiraEm: new Date(Date.now() + segundos * 1000).toISOString(),
      permissoes: j1?.permissions ?? j1?.data?.[0]?.permissions ?? null,
    }
  } catch (erro) {
    return { ok: false, erro: `Sem conexão com o Instagram: ${String(erro).slice(0, 120)}` }
  }
}

/** Token de longa duracao renovado por mais 60 dias. */
export async function renovarToken(token: string): Promise<{ ok: true; token: string; expiraEm: string } | { ok: false; erro: string }> {
  try {
    const r = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    )
    const json = await r.json().catch(() => ({}))
    if (!r.ok || !json?.access_token) return { ok: false, erro: String(json?.error?.message ?? 'O Instagram não renovou o token.') }
    const segundos = Number(json.expires_in) || 60 * 24 * 3600
    return { ok: true, token: String(json.access_token), expiraEm: new Date(Date.now() + segundos * 1000).toISOString() }
  } catch (erro) {
    return { ok: false, erro: `Sem conexão com o Instagram: ${String(erro).slice(0, 120)}` }
  }
}
