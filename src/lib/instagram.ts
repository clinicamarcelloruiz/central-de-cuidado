import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { apagarParametrosDoEndereco, parametrosDoEndereco } from '@/lib/endereco'
import { enderecoDoLogin, PAGINA_DE_VOLTA } from '../../supabase/functions/_shared/instagram-login.ts'

/**
 * Instagram da clinica na tela (16/10/2026). Ver supabase/functions/instagram-webhook
 * e instagram-equipe. Tabelas novas: toda leitura em try/catch, e sem elas a aba
 * do Instagram simplesmente nao aparece (a atualizacao do banco ainda nao
 * chegou), sem derrubar a tela de Respostas.
 */
const semTipo = supabase as unknown as SupabaseClient

export type ContaInstagram = {
  igUserId: string
  username: string | null
  whatsapp: string
  tokenExpiraEm: string | null
  roboDirect: boolean
  roboComentarios: boolean
  ultimoErro: string | null
  ultimoErroEm: string | null
}

export type ConversaInstagram = {
  id: string
  igsid: string
  username: string | null
  status: 'aberta' | 'concluida'
  precisaEquipe: boolean
  motivo: string | null
  naoLidas: number
  ultimaMensagemEm: string
  ultimaDaPessoaEm: string | null
}

export type MensagemInstagram = {
  id: string
  direcao: 'entrada' | 'saida' | 'nota'
  texto: string | null
  automatica: boolean
  anexoUrl: string | null
  status: string
  erro: string | null
  createdAt: string
}

export type ComentarioInstagram = {
  commentId: string
  mediaId: string | null
  autorUsername: string | null
  texto: string | null
  precisaEquipe: boolean
  respondidoNoDirectEm: string | null
  respostaPublica: string | null
  erro: string | null
  createdAt: string
}

/**
 * disponivel=false: o banco ainda nao tem as tabelas (atualizacao nao chegou).
 * conta=null: tabelas ok, Instagram nao conectado. Nos dois casos a aba some.
 */
export async function estadoDoInstagram(clinicId: string): Promise<{ disponivel: boolean; conta: ContaInstagram | null }> {
  try {
    const { data, error } = await semTipo
      .from('instagram_contas')
      .select('ig_user_id,username,whatsapp,token_expira_em,robo_direct,robo_comentarios,ultimo_erro,ultimo_erro_em')
      .eq('clinic_id', clinicId)
      .maybeSingle()
    if (error) throw error
    if (!data) return { disponivel: true, conta: null }
    const d = data as Record<string, unknown>
    return { disponivel: true, conta: {
      igUserId: String(d.ig_user_id),
      username: (d.username as string | null) ?? null,
      whatsapp: String(d.whatsapp ?? ''),
      tokenExpiraEm: (d.token_expira_em as string | null) ?? null,
      roboDirect: Boolean(d.robo_direct),
      roboComentarios: Boolean(d.robo_comentarios),
      ultimoErro: (d.ultimo_erro as string | null) ?? null,
      ultimoErroEm: (d.ultimo_erro_em as string | null) ?? null,
    } }
  } catch (erro) {
    console.warn('Instagram: sem a tabela instagram_contas (atualizacao do banco ainda nao chegou?)', erro)
    return { disponivel: false, conta: null }
  }
}

export async function listarConversasInstagram(clinicId: string): Promise<ConversaInstagram[]> {
  const { data, error } = await semTipo
    .from('instagram_conversas')
    .select('id,igsid,username,status,precisa_equipe,motivo,nao_lidas,ultima_mensagem_em,ultima_da_pessoa_em')
    .eq('clinic_id', clinicId)
    .order('ultima_mensagem_em', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
    id: String(d.id),
    igsid: String(d.igsid),
    username: (d.username as string | null) ?? null,
    status: d.status === 'concluida' ? 'concluida' : 'aberta',
    precisaEquipe: Boolean(d.precisa_equipe),
    motivo: (d.motivo as string | null) ?? null,
    naoLidas: Number(d.nao_lidas ?? 0),
    ultimaMensagemEm: String(d.ultima_mensagem_em),
    ultimaDaPessoaEm: (d.ultima_da_pessoa_em as string | null) ?? null,
  }))
}

export async function listarMensagensInstagram(conversaId: string): Promise<MensagemInstagram[]> {
  const { data, error } = await semTipo
    .from('instagram_mensagens')
    .select('id,direcao,texto,automatica,anexo_url,status,erro,created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
    id: String(d.id),
    direcao: d.direcao as MensagemInstagram['direcao'],
    texto: (d.texto as string | null) ?? null,
    automatica: Boolean(d.automatica),
    anexoUrl: (d.anexo_url as string | null) ?? null,
    status: String(d.status),
    erro: (d.erro as string | null) ?? null,
    createdAt: String(d.created_at),
  }))
}

export async function listarComentariosInstagram(clinicId: string): Promise<ComentarioInstagram[]> {
  const { data, error } = await semTipo
    .from('instagram_comentarios')
    .select('comment_id,media_id,autor_username,texto,precisa_equipe,respondido_no_direct_em,resposta_publica,erro,created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
    commentId: String(d.comment_id),
    mediaId: (d.media_id as string | null) ?? null,
    autorUsername: (d.autor_username as string | null) ?? null,
    texto: (d.texto as string | null) ?? null,
    precisaEquipe: Boolean(d.precisa_equipe),
    respondidoNoDirectEm: (d.respondido_no_direct_em as string | null) ?? null,
    respostaPublica: (d.resposta_publica as string | null) ?? null,
    erro: (d.erro as string | null) ?? null,
    createdAt: String(d.created_at),
  }))
}

export async function marcarConversaInstagram(conversaId: string, mudanca: { status?: 'aberta' | 'concluida'; precisaEquipe?: boolean; lida?: boolean }) {
  const linha: Record<string, unknown> = {}
  if (mudanca.status) linha.status = mudanca.status
  if (mudanca.precisaEquipe !== undefined) {
    linha.precisa_equipe = mudanca.precisaEquipe
    if (!mudanca.precisaEquipe) linha.motivo = null
  }
  if (mudanca.lida) linha.nao_lidas = 0
  const { error } = await semTipo.from('instagram_conversas').update(linha).eq('id', conversaId)
  if (error) throw new Error(error.message)
}

export async function marcarComentarioVisto(commentId: string) {
  const { error } = await semTipo.from('instagram_comentarios').update({ precisa_equipe: false }).eq('comment_id', commentId)
  if (error) throw new Error(error.message)
}

export async function salvarRoboInstagram(clinicId: string, campos: { roboDirect?: boolean; roboComentarios?: boolean; whatsapp?: string }) {
  const linha: Record<string, unknown> = {}
  if (campos.roboDirect !== undefined) linha.robo_direct = campos.roboDirect
  if (campos.roboComentarios !== undefined) linha.robo_comentarios = campos.roboComentarios
  if (campos.whatsapp !== undefined) linha.whatsapp = campos.whatsapp.replace(/\D/g, '')
  const { error } = await semTipo.from('instagram_contas').update(linha).eq('clinic_id', clinicId)
  if (error) throw new Error(error.message)
}

async function motivo(causa: unknown, data: unknown, padrao: string): Promise<string> {
  const contexto = (causa as { context?: unknown }).context
  if (contexto instanceof Response) {
    try {
      const corpo = (await contexto.clone().json()) as { error?: string } | null
      if (corpo?.error) return corpo.error
    } catch {
      // Corpo vazio ou que nao e JSON: fica o texto padrao.
    }
  }
  return (data as { error?: string } | null)?.error || padrao
}

async function chamarEquipe(body: Record<string, unknown>, padrao: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('instagram-equipe', { body })
  if (error) throw new Error(await motivo(error, data, padrao))
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
  return (data ?? {}) as Record<string, unknown>
}

export const responderInstagram = (conversaId: string, texto: string) =>
  chamarEquipe({ acao: 'responder', conversaId, texto }, 'Não foi possível enviar pelo Instagram.')

export const comentarioNoDirect = (commentId: string, texto?: string) =>
  chamarEquipe({ acao: 'comentario_direct', commentId, texto }, 'Não foi possível mandar no direct.')

export const comentarioEmPublico = (commentId: string, texto: string) =>
  chamarEquipe({ acao: 'comentario_publico', commentId, texto }, 'Não foi possível responder o comentário.')

export const conectarInstagram = (clinicId: string, token: string, whatsapp: string) =>
  chamarEquipe({ acao: 'conectar', clinicId, token, whatsapp }, 'Não foi possível conectar o Instagram.') as Promise<{ username?: string; aviso?: string }>

export const desconectarInstagram = (clinicId: string) =>
  chamarEquipe({ acao: 'desconectar', clinicId }, 'Não foi possível desconectar o Instagram.')

export const buscarComentariosInstagram = (clinicId: string) =>
  chamarEquipe({ acao: 'buscar_comentarios', clinicId }, 'Não foi possível buscar os comentários.') as Promise<{
    posts?: number
    encontrados?: number
    novos?: number
    falhas?: number
  }>

const conectarComCodigo = (clinicId: string, code: string, redirectUri: string, whatsapp: string) =>
  chamarEquipe({ acao: 'conectar_codigo', clinicId, code, redirectUri, whatsapp }, 'Não foi possível conectar o Instagram.') as Promise<{
    username?: string
    aviso?: string
  }>

/**
 * Login oficial do Instagram (16/10/2026). O pedido fica guardado no
 * localStorage, e nao no sessionStorage: no celular o login pode abrir no app
 * do Instagram e voltar numa aba nova do navegador.
 */
const PEDIDO_DE_LOGIN = 'central:instagram-login'
const VALIDADE_DO_PEDIDO = 15 * 60 * 1000

type PedidoDeLogin = { state: string; clinicId: string; whatsapp: string; em: number }

export function entrarComInstagram(clinicId: string, whatsapp: string) {
  const state = crypto.randomUUID()
  const pedido: PedidoDeLogin = { state, clinicId, whatsapp: whatsapp.replace(/\D/g, ''), em: Date.now() }
  try {
    localStorage.setItem(PEDIDO_DE_LOGIN, JSON.stringify(pedido))
  } catch {
    // Sem armazenamento (aba anonima restrita): a volta avisa que nao reconheceu o pedido.
  }
  window.location.assign(enderecoDoLogin(new URL(PAGINA_DE_VOLTA, window.location.href).toString(), state))
}

/**
 * Le a volta do login (a pagina instagram-retorno.html repassa com nomes
 * proprios), apaga do endereco na hora e troca o codigo pelo acesso. null quando
 * nao e volta de login. Apagar antes de chamar o servidor evita trocar o mesmo
 * codigo duas vezes (o codigo so vale uma).
 */
export async function concluirLoginDoInstagram(): Promise<null | { ok: true; username?: string; aviso?: string } | { ok: false; erro: string }> {
  const p = parametrosDoEndereco()
  const code = p.get('instagram_code')
  const state = p.get('instagram_state')
  const erro = p.get('instagram_erro')
  if (!code && !erro) return null
  apagarParametrosDoEndereco(['instagram_code', 'instagram_state', 'instagram_erro'])
  let pedido: PedidoDeLogin | null = null
  try {
    pedido = JSON.parse(localStorage.getItem(PEDIDO_DE_LOGIN) ?? 'null') as PedidoDeLogin | null
    localStorage.removeItem(PEDIDO_DE_LOGIN)
  } catch {
    pedido = null
  }
  if (erro) return { ok: false, erro: `O Instagram não concluiu o login: ${erro}` }
  if (!pedido || pedido.state !== state || Date.now() - pedido.em > VALIDADE_DO_PEDIDO) {
    return { ok: false, erro: 'Não reconheci esta volta do Instagram (o pedido expirou ou foi feito em outro aparelho). Clique em Entrar com o Instagram de novo.' }
  }
  try {
    const r = await conectarComCodigo(pedido.clinicId, String(code), new URL(PAGINA_DE_VOLTA, window.location.href).toString(), pedido.whatsapp)
    return { ok: true, username: r.username, aviso: r.aviso }
  } catch (causa) {
    return { ok: false, erro: causa instanceof Error ? causa.message : 'Não foi possível conectar o Instagram.' }
  }
}
