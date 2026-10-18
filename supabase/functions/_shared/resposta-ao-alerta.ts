import { BOTOES_DO_ALERTA, MODELO_DO_PEDIDO, parametrosDoPedido, payloadDoVeredito, type Veredito } from './alerta-de-urgencia.ts'
import { montarConteudo } from './conteudo.ts'
import { linkDoWhatsApp, semFormatacaoDoWhatsApp } from './instagram.ts'
import { textoDoModelo } from './modelos.ts'
import { quemAtende, type QuemAtende } from './quem-atende.ts'
import { mesmoTelefone } from './telefone-br.ts'

/**
 * A resposta do medico ao alerta de urgencia, pelo WhatsApp dele (17/10/2026).
 *
 * Pedido do Edu: o alerta chega no celular do Dr. Marcello, e a resposta dele
 * tem de voltar para a familia sem ele abrir a Central. Dois jeitos:
 *   - toca num botao do alerta: e urgente (pronto-socorro agora), pode aguardar
 *     (a familia ganha o botao de marcar), eu respondo (ele assume a conversa);
 *   - escreve a orientacao. O robo mostra o que vai mandar e espera o "Enviar":
 *     e orientacao medica em nome dele, e um "liga pra ela" que era para a
 *     equipe nao pode chegar na mae.
 *
 * Quem e quem: o primeiro numero do alerta e o do medico; os outros sao
 * equipe. So o medico classifica (urgente / pode aguardar); a equipe pode dizer
 * que vai responder e mandar mensagem, que sai como "equipe do consultorio".
 *
 * A familia nunca espera por isto: o robo ja respondeu na hora (pronto-socorro
 * no risco de vida, horario mais proximo na urgencia comum). A resposta do
 * medico chega depois, como confirmacao ou alivio.
 *
 * Mensagem desses numeros so vira resposta ao alerta quando e um toque nos
 * botoes, quando responde em cima de um alerta, ou quando houve alerta nas
 * ultimas 6 horas. Fora disso segue o robo de sempre - e assim que o Edu
 * continua testando o robo pelo proprio celular.
 */

// Coluna e tabela novas: o resto e lido em consulta separada.
type Admin = { from: (tabela: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
type Consulta = ReturnType<Admin['from']>

const JANELA_DO_ALERTA_MS = 6 * 3600 * 1000
const JANELA_DA_META_MS = 24 * 3600 * 1000

export type MensagemRecebida = {
  type?: string
  text?: { body?: string }
  button?: { text?: string; payload?: string }
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } }
  /** A mensagem nossa em cima da qual ele respondeu. */
  context?: { id?: string }
}

export type RespostaDaEquipe =
  | { tipo: 'veredito'; alertaId: string; veredito: Veredito }
  | { tipo: 'confirmacao'; alertaId: string; acao: 'enviar' | 'cancelar' }
  | { tipo: 'texto'; texto: string; citado: string | null }
  | { tipo: 'visto'; citado: string | null }
  | { tipo: 'midia'; citado: string | null }

export const payloadDaConfirmacao = (alertaId: string, acao: 'enviar' | 'cancelar') => `URGTXT:${alertaId}:${acao}`

// "ok", "vi", um 👍: e o medico dizendo que viu, nao orientacao para a mae.
const VISTO = /^(ok|okay|oks|vi|visto|certo|ciente|beleza|blz|obrigad[oa]|valeu|ta bom|tá bom|entendi|combinado|👍|👌|🙏|✅)[\s!.👍👌🙏✅]*$/iu
const MIDIA = ['image', 'audio', 'voice', 'video', 'document', 'sticker']

export function lerRespostaDaEquipe(m: MensagemRecebida): RespostaDaEquipe | null {
  const citado = m.context?.id ? String(m.context.id) : null
  // A lista (18/10/2026, escolha da familia com mais de 2 avisos) volta em list_reply.
  const toque =
    m.type === 'button'
      ? String(m.button?.payload ?? '')
      : m.type === 'interactive'
        ? String(m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? '')
        : ''
  const veredito = /^URG:([0-9a-f-]{36}):(urgente|aguardar|responde)$/.exec(toque)
  if (veredito) return { tipo: 'veredito', alertaId: veredito[1], veredito: veredito[2] as Veredito }
  const confirmacao = /^URGTXT:([0-9a-f-]{36}):(enviar|cancelar)$/.exec(toque)
  if (confirmacao) return { tipo: 'confirmacao', alertaId: confirmacao[1], acao: confirmacao[2] as 'enviar' | 'cancelar' }
  // Outro botao (do lembrete, do menu): nao e daqui.
  if (toque) return null
  if (m.type === 'text') {
    const texto = String(m.text?.body ?? '').trim()
    if (!texto) return null
    return VISTO.test(texto) ? { tipo: 'visto', citado } : { tipo: 'texto', texto, citado }
  }
  if (MIDIA.includes(String(m.type))) return { tipo: 'midia', citado }
  return null
}

/** O primeiro numero do alerta e o do medico; os outros, equipe; fora da lista, ninguem. */
export function papelDoNumero(numero: string, numeros: string[]): 'medico' | 'equipe' | null {
  const i = numeros.findIndex((n) => mesmoTelefone(n, numero))
  return i < 0 ? null : i === 0 ? 'medico' : 'equipe'
}

/**
 * O que a familia le. Os textos em nome do medico precisam do aval dele
 * (17/10/2026: rascunho, mostrado ao Edu para levar ao Dr. Marcello).
 * null = a equipe nao classifica urgencia.
 */
export function textoParaAFamilia(
  tipo: Veredito | 'texto',
  papel: 'medico' | 'equipe',
  quem: Pick<QuemAtende, 'o' | 'O'>,
  opcoes: { texto?: string; canal?: 'WhatsApp' | 'Instagram'; link?: string } = {},
): string | null {
  const marcar =
    opcoes.canal === 'Instagram'
      ? `Se quiser, marque o horário mais próximo pelo nosso WhatsApp:\n${opcoes.link ?? ''}`
      : 'Se quiser, toque em *Marcar uma consulta* para ver os horários mais próximos.'
  if (papel === 'medico') {
    if (tipo === 'urgente') return `🚨 ${quem.O} viu a sua mensagem e orienta: procure agora o pronto-socorro mais próximo ou ligue 192.`
    if (tipo === 'aguardar') return `${quem.O} viu a sua mensagem. Pelo que você contou, dá para aguardar a consulta.\n\n${marcar} Se a criança piorar, é só escrever aqui.`
    if (tipo === 'responde') return `${quem.O} viu a sua mensagem e vai falar com você por aqui.`
    return `💬 Mensagem d${quem.o}: ${opcoes.texto ?? ''}`
  }
  if (tipo === 'responde') return 'Nossa equipe viu a sua mensagem e vai falar com você por aqui.'
  if (tipo === 'texto') return `💬 Mensagem da equipe do consultório: ${opcoes.texto ?? ''}`
  return null
}

export type Alerta = {
  id: string
  canal: 'WhatsApp' | 'Instagram'
  conversa_whatsapp: string | null
  conversa_instagram: string | null
  teste: boolean
  quem: string
  mensagens: string[]
  veredito: string | null
  rascunho: string | null
  rascunho_de: string | null
  rascunho_em: string | null
  criado_em: string
}

/** A ultima resposta deste numero: a que aviso e quando (ver ultimaResposta). */
export type UltimaResposta = { id: string; em: string } | null

/**
 * De qual familia e o texto. Em cima de um alerta: aquele. Sem citar: o
 * alerta das ultimas 6 horas, se for um so. Com mais de um, o da ultima
 * resposta deste numero, enquanto nao chegar aviso novo depois dela
 * (18/10/2026: o Edu tocou "Eu respondo" no aviso do Heitor e cada mensagem
 * seguinte voltava "Ha 2 alertas recentes"). Aviso novo depois da ultima
 * resposta: pergunta, porque a mensagem pode ser para a familia nova.
 */
export function escolherAlerta(
  recentes: Alerta[],
  citado: string | null,
  agora: Date,
  ultima: UltimaResposta = null,
): { alerta: Alerta } | { ambiguos: Alerta[] } | null {
  if (citado) {
    const exato = recentes.find((a) => (a.mensagens ?? []).includes(citado))
    if (exato) return { alerta: exato }
  }
  const candidatos = recentes.filter((a) => agora.getTime() - Date.parse(a.criado_em) <= JANELA_DO_ALERTA_MS)
  if (candidatos.length === 1) return { alerta: candidatos[0] }
  if (candidatos.length > 1) {
    const daConversa = ultima ? candidatos.find((a) => a.id === ultima.id) : undefined
    const chegouOutro = candidatos.some((a) => a.id !== ultima?.id && Date.parse(a.criado_em) > Date.parse(ultima?.em ?? ''))
    if (daConversa && !chegouOutro) return { alerta: daConversa }
    return { ambiguos: candidatos }
  }
  return null
}

type Enviado = { ok: true; id: string | null } | { ok: false; erro: string }

export type AmbienteDaResposta = {
  admin: Admin
  clinicId: string
  agora: Date
  /** Os numeros do alerta, ja lidos (o primeiro e o do medico). */
  numeros: string[]
  /** Uma mensagem pelo WhatsApp da clinica: para o medico ou para a familia. */
  enviarWhatsApp: (para: string, conteudo: Record<string, unknown>) => Promise<Enviado>
  enviarDirect: (conta: { ig_user_id: string; access_token: string }, igsid: string, texto: string) => Promise<{ ok: true; mid: string | null } | { ok: false; erro: string }>
}

/** O envio de verdade, para o webhook. */
export function whatsAppPelaApi(phoneNumberId: string, token: string | undefined, buscar: typeof fetch = fetch): AmbienteDaResposta['enviarWhatsApp'] {
  const versao = (typeof Deno !== 'undefined' ? Deno.env.get('META_GRAPH_VERSION')?.trim() : '') || 'v25.0'
  return async (para, conteudo) => {
    if (!token) return { ok: false, erro: 'WhatsApp da clínica sem token no servidor' }
    try {
      const r = await buscar(`https://graph.facebook.com/${versao}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, ...conteudo }),
      })
      const j = await r.json().catch(() => ({}))
      return r.ok ? { ok: true, id: j?.messages?.[0]?.id ?? null } : { ok: false, erro: String(j?.error?.message ?? `HTTP ${r.status}`) }
    } catch (erro) {
      return { ok: false, erro: String(erro).slice(0, 200) }
    }
  }
}

const COLUNAS = 'id,canal,conversa_whatsapp,conversa_instagram,teste,quem,mensagens,veredito,rascunho,rascunho_de,rascunho_em,criado_em'

async function alertasRecentes(amb: AmbienteDaResposta): Promise<Alerta[] | null> {
  try {
    const { data, error } = await amb.admin
      .from('alertas_de_urgencia')
      .select(COLUNAS)
      .eq('clinic_id', amb.clinicId)
      .gte('criado_em', new Date(amb.agora.getTime() - JANELA_DA_META_MS).toISOString())
      .order('criado_em', { ascending: false })
      .limit(20)
    if (error) throw error
    return (data ?? []) as Alerta[]
  } catch (erro) {
    // Sem a tabela, a mensagem segue o caminho de sempre: nada se perde.
    console.error('Resposta ao alerta: nao li alertas_de_urgencia', erro)
    return null
  }
}

/**
 * Colunas de 18/10/2026 (migration 20261018180000), lidas e gravadas a parte:
 * sem elas, so volta a pergunta de qual familia, nada mais quebra.
 */
async function ultimaResposta(amb: AmbienteDaResposta, numero: string): Promise<UltimaResposta> {
  try {
    const { data, error } = await amb.admin
      .from('alertas_de_urgencia')
      .select('id,respondido_em')
      .eq('clinic_id', amb.clinicId)
      .eq('respondido_por', numero)
      .gte('respondido_em', new Date(amb.agora.getTime() - JANELA_DO_ALERTA_MS).toISOString())
      .order('respondido_em', { ascending: false })
      .limit(1)
    if (error) throw error
    const linha = (data as { id: string; respondido_em: string }[] | null)?.[0]
    return linha ? { id: linha.id, em: linha.respondido_em } : null
  } catch (erro) {
    console.warn('Resposta ao alerta: sem respondido_em; a conversa ativa nao vale', erro)
    return null
  }
}

async function marcarRespondido(amb: AmbienteDaResposta, id: string, numero: string) {
  try {
    const { error } = await amb.admin
      .from('alertas_de_urgencia')
      .update({ respondido_em: amb.agora.toISOString(), respondido_por: numero })
      .eq('id', id)
    if (error) throw error
  } catch (erro) {
    console.warn('Resposta ao alerta: respondido_em nao gravado', erro)
  }
}

/** Apaga o texto esperando confirmacao em todos os avisos deste numero. */
async function apagarRascunhos(amb: AmbienteDaResposta, numero: string) {
  await amb.admin
    .from('alertas_de_urgencia')
    .update({ rascunho: null, rascunho_de: null, rascunho_em: null })
    .eq('clinic_id', amb.clinicId)
    .eq('rascunho_de', numero)
}

/** Nome curto para botao (20 letras) ou linha de lista (24). */
function nomeCurto(nome: string, limite: number): string {
  const n = nome.trim() || 'Família'
  if (n.length <= limite) return n
  const partes = n.split(/\s+/)
  const doisNomes = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : n
  return doisNomes.length <= limite ? doisNomes : `${n.slice(0, limite - 1)}…`
}

async function alertaPorId(amb: AmbienteDaResposta, id: string): Promise<Alerta | null> {
  const { data } = await amb.admin.from('alertas_de_urgencia').select(COLUNAS).eq('id', id).eq('clinic_id', amb.clinicId).maybeSingle()
  return (data as Alerta | null) ?? null
}

const ROTULO: Record<Veredito | 'texto', string> = {
  urgente: 'é urgente',
  aguardar: 'pode aguardar a consulta',
  responde: 'vai responder',
  texto: 'mandou uma mensagem',
}

function primeiroNome(perfil: string | null | undefined): string | null {
  const primeiro = String(perfil ?? '').trim().split(/\s+/)[0] ?? ''
  return /^[A-Za-zÀ-ÿ]{2,}$/.test(primeiro) ? primeiro : null
}

/**
 * Manda para a familia, pelo canal do alerta. WhatsApp com a janela de 24 h
 * aberta vai como texto (com o botao de marcar, se pedido); fechada, pelo
 * modelo resposta_da_clinica. Instagram nao tem modelo: fechada, nao sai, e o
 * medico fica sabendo.
 */
async function enviarParaAFamilia(
  amb: AmbienteDaResposta,
  alerta: Alerta,
  tipo: Veredito | 'texto',
  papel: 'medico' | 'equipe',
  texto: string | undefined,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { admin, clinicId, agora } = amb
  const quem = quemAtende(clinicId)
  // "Eu respondo" e o texto dele sao gente falando: o robo fica quieto um tempo.
  const automatico = tipo === 'urgente' || tipo === 'aguardar'
  const agoraIso = agora.toISOString()

  if (alerta.conversa_instagram) {
    const { data: conversa } = await admin.from('instagram_conversas').select('id,igsid,ultima_da_pessoa_em').eq('id', alerta.conversa_instagram).maybeSingle()
    const { data: conta } = await admin.from('instagram_contas').select('ig_user_id,access_token,whatsapp').eq('clinic_id', clinicId).maybeSingle()
    if (!conversa?.igsid || !conta) return { ok: false, erro: 'conversa do Instagram não encontrada' }
    if (!conversa.ultima_da_pessoa_em || agora.getTime() - Date.parse(conversa.ultima_da_pessoa_em) > JANELA_DA_META_MS) {
      return { ok: false, erro: 'a janela de 24 horas do Instagram fechou' }
    }
    const escrito = textoParaAFamilia(tipo, papel, quem, { texto, canal: 'Instagram', link: linkDoWhatsApp(conta.whatsapp) })
    if (!escrito) return { ok: false, erro: 'só o médico classifica a urgência' }
    const final = semFormatacaoDoWhatsApp(escrito)
    const envio = await amb.enviarDirect(conta, conversa.igsid, final)
    await admin.from('instagram_mensagens').insert({
      clinic_id: clinicId,
      conversa_id: conversa.id,
      direcao: 'saida',
      texto: final,
      automatica: automatico,
      status: envio.ok ? 'enviada' : 'falhou',
      mid: envio.ok ? envio.mid : null,
      erro: envio.ok ? null : envio.erro,
    })
    await admin
      .from('instagram_conversas')
      .update({ ultima_mensagem_em: agoraIso, ...(tipo === 'aguardar' ? { motivo: 'atendente' } : {}) })
      .eq('id', conversa.id)
    return envio.ok ? { ok: true } : { ok: false, erro: envio.erro }
  }

  if (!alerta.conversa_whatsapp) return { ok: false, erro: 'alerta sem conversa' }
  const { data: conversa } = await admin
    .from('whatsapp_conversations')
    .select('id,wa_id,patient_id,profile_name')
    .eq('id', alerta.conversa_whatsapp)
    .maybeSingle()
  if (!conversa?.wa_id) return { ok: false, erro: 'conversa do WhatsApp não encontrada' }
  const escrito = textoParaAFamilia(tipo, papel, quem, { texto, canal: 'WhatsApp' })
  if (!escrito) return { ok: false, erro: 'só o médico classifica a urgência' }

  // Ultima mensagem RECEBIDA, como em whatsapp-reply: a janela e dela.
  const { data: ultima } = await admin
    .from('whatsapp_messages')
    .select('created_at')
    .eq('conversation_id', conversa.id)
    .eq('direction', 'inbound')
    .neq('message_type', 'unsupported')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const aberta = Boolean(ultima?.created_at) && agora.getTime() - Date.parse(ultima.created_at) < JANELA_DA_META_MS

  let conteudo: Record<string, unknown>
  let tipoDaMensagem: string
  let modelo: string | null = null
  let noHistorico = escrito
  if (aberta) {
    conteudo = montarConteudo(escrito, tipo === 'aguardar' ? { botoes: [{ id: 'MARCAR_AGORA', titulo: 'Marcar uma consulta' }] } : undefined)
    tipoDaMensagem = String(conteudo.type)
  } else {
    const { data: ajustes } = await admin
      .from('clinic_settings')
      .select('whatsapp_reply_template_name,whatsapp_template_language')
      .eq('clinic_id', clinicId)
      .maybeSingle()
    const nomeDoModelo: string = ajustes?.whatsapp_reply_template_name || 'resposta_da_clinica'
    modelo = nomeDoModelo
    // Parametro de modelo nao aceita quebra de linha nem espacos seguidos.
    const parametros = [primeiroNome(conversa.profile_name) ?? 'tudo bem', escrito.replace(/\s+/g, ' ').trim().slice(0, 900)]
    conteudo = {
      type: 'template',
      template: {
        name: nomeDoModelo,
        language: { code: ajustes?.whatsapp_template_language || 'pt_BR' },
        components: [{ type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) }],
      },
    }
    tipoDaMensagem = 'template'
    noHistorico = textoDoModelo(nomeDoModelo, parametros) ?? escrito
  }

  const envio = await amb.enviarWhatsApp(conversa.wa_id, conteudo)
  const { error: erroDoRegistro } = await admin.from('whatsapp_messages').insert({
    clinic_id: clinicId,
    conversation_id: conversa.id,
    patient_id: conversa.patient_id ?? null,
    external_message_id: envio.ok ? envio.id : null,
    direction: 'outbound',
    automatic: automatico,
    message_type: tipoDaMensagem,
    template_name: modelo,
    body: noHistorico,
    status: envio.ok ? 'accepted' : 'failed',
    ...(envio.ok ? { sent_at: agoraIso } : { failed_at: agoraIso, failure_reason: envio.erro }),
  })
  if (erroDoRegistro) console.error('Resposta ao alerta: mensagem a familia nao registrada', erroDoRegistro)
  await admin
    .from('whatsapp_conversations')
    .update({
      last_message_at: agoraIso,
      // "Pode aguardar": sai da lista de urgencia, a equipe segue com ela.
      ...(tipo === 'aguardar' ? { needs_attention: true, attention_reason: 'atendente' } : {}),
    })
    .eq('id', conversa.id)
  return envio.ok ? { ok: true } : { ok: false, erro: envio.erro }
}

/** Nota na conversa (a equipe ve na Central) e evento nos Numeros do WhatsApp. */
async function registrarResposta(
  amb: AmbienteDaResposta,
  alerta: Alerta,
  papel: 'medico' | 'equipe',
  tipo: Veredito | 'texto' | 'visto',
  envio: { ok: true } | { ok: false; erro: string } | null,
) {
  const quem = papel === 'medico' ? quemAtende(amb.clinicId).O : 'A equipe'
  const oQue = tipo === 'visto' ? 'viu o alerta' : `respondeu ao alerta: ${ROTULO[tipo]}`
  const nota =
    `🩺 ${quem} ${oQue} (pelo WhatsApp).` +
    (envio && !envio.ok ? ` ⚠️ A mensagem NÃO chegou à família: ${envio.erro}. Responda por aqui.` : '')
  try {
    if (alerta.conversa_whatsapp) {
      await amb.admin.from('conversation_notes').insert({ clinic_id: amb.clinicId, conversation_id: alerta.conversa_whatsapp, texto: nota })
      await amb.admin.from('whatsapp_bot_events').insert({
        clinic_id: amb.clinicId,
        conversation_id: alerta.conversa_whatsapp,
        evento: 'veredito_urgencia',
        detalhe: `${tipo} (${papel})${envio && !envio.ok ? ' nao chegou' : ''}`.slice(0, 120),
      })
    }
    if (alerta.conversa_instagram) {
      await amb.admin
        .from('instagram_mensagens')
        .insert({ clinic_id: amb.clinicId, conversa_id: alerta.conversa_instagram, direcao: 'nota', texto: nota, automatica: true })
    }
  } catch (erro) {
    console.error('Resposta ao alerta: registro nao gravado', erro)
  }
}

const TESTE = '✅ Era um alerta de teste: a resposta funcionou, e nada foi enviado a nenhuma família.'

/**
 * Trata a mensagem se ela for resposta a um alerta. Devolve true quando tratou
 * (o webhook nao passa a mensagem ao robo da familia).
 */
export async function tratarRespostaDaEquipe(amb: AmbienteDaResposta, numero: string, m: MensagemRecebida): Promise<boolean> {
  const papel = papelDoNumero(numero, amb.numeros)
  if (!papel) return false
  const r = lerRespostaDaEquipe(m)
  if (!r) return false
  const recentes = await alertasRecentes(amb)
  if (recentes === null) return false

  const quem = quemAtende(amb.clinicId)
  const responder = (texto: string, botoes?: { id: string; titulo: string }[]) =>
    amb.enviarWhatsApp(numero, montarConteudo(texto, botoes ? { botoes } : undefined))
  const nomeDaFamilia = (a: Alerta) => a.quem || 'a família'

  if (r.tipo === 'veredito' || r.tipo === 'confirmacao') {
    const alerta = recentes.find((a) => a.id === r.alertaId) ?? (await alertaPorId(amb, r.alertaId))
    if (!alerta) {
      await responder('Não achei esse alerta. Se precisar, responda a família pela Central.')
      return true
    }
    if (alerta.teste) {
      await responder(TESTE)
      return true
    }

    if (r.tipo === 'veredito') {
      if (papel === 'equipe' && r.veredito !== 'responde') {
        await responder(`Só ${quem.o} classifica a urgência pelos botões. Para mandar algo à família, escreva aqui a mensagem, que ela vai como equipe.`)
        return true
      }
      // Vale a primeira classificacao. "Eu respondo" e mensagem nao classificam:
      // o medico ainda pode dizer "e urgente" depois deles.
      const permitido = r.veredito === 'responde' ? [] : ['responde', 'texto']
      const marcar = (filtro: (q: Consulta) => Consulta) =>
        filtro(amb.admin.from('alertas_de_urgencia').update({ veredito: r.veredito, veredito_por: numero, veredito_em: amb.agora.toISOString() }).eq('id', alerta.id)).select('id')
      let { data: marcados } = await marcar((q) => q.is('veredito', null))
      if (!marcados?.length && permitido.length) ({ data: marcados } = await marcar((q) => q.in('veredito', permitido)))
      if (!marcados?.length) {
        const atual = await alertaPorId(amb, alerta.id)
        const rotulo = atual?.veredito ? ROTULO[atual.veredito as Veredito | 'texto'] ?? atual.veredito : 'respondido'
        await responder(`Esse alerta já foi respondido (${rotulo}). Nada novo foi enviado à família.`)
        return true
      }
      const envio = await enviarParaAFamilia(amb, alerta, r.veredito, papel, undefined)
      if (envio.ok) await marcarRespondido(amb, alerta.id, numero)
      await registrarResposta(amb, alerta, papel, r.veredito, envio)
      await responder(envio.ok ? `✅ Enviado para ${nomeDaFamilia(alerta)}.` : `⚠️ Não consegui enviar para ${nomeDaFamilia(alerta)}: ${envio.erro}. Responda pela Central.`)
      return true
    }

    // Confirmacao do texto.
    if (r.acao === 'cancelar') {
      // Na escolha da familia o mesmo texto fica em varios avisos: apaga todos.
      await apagarRascunhos(amb, numero)
      await amb.admin.from('alertas_de_urgencia').update({ rascunho: null, rascunho_de: null, rascunho_em: null }).eq('id', alerta.id)
      await responder('Cancelado: nada foi enviado à família.')
      return true
    }
    const atual = (await alertaPorId(amb, alerta.id)) ?? alerta
    const velho = !atual.rascunho_em || amb.agora.getTime() - Date.parse(atual.rascunho_em) > JANELA_DO_ALERTA_MS
    if (!atual.rascunho || velho) {
      await responder('Não achei a mensagem para enviar. Escreva de novo, em cima do alerta.')
      return true
    }
    if (!atual.rascunho_de || !mesmoTelefone(atual.rascunho_de, numero)) {
      await responder('Essa mensagem foi escrita por outra pessoa: só ela pode confirmar o envio.')
      return true
    }
    const envio = await enviarParaAFamilia(amb, atual, 'texto', papel, atual.rascunho)
    // O mesmo texto pode estar nos outros avisos (escolha da familia): sai de todos.
    await apagarRascunhos(amb, numero)
    await amb.admin.from('alertas_de_urgencia').update({ rascunho: null, rascunho_de: null, rascunho_em: null }).eq('id', alerta.id)
    if (envio.ok) {
      await marcarRespondido(amb, atual.id, numero)
      await amb.admin.from('alertas_de_urgencia').update({ veredito: 'texto', veredito_por: numero, veredito_em: amb.agora.toISOString() }).eq('id', alerta.id).is('veredito', null)
    }
    await registrarResposta(amb, atual, papel, 'texto', envio)
    await responder(envio.ok ? `✅ Enviado para ${nomeDaFamilia(atual)}.` : `⚠️ Não consegui enviar para ${nomeDaFamilia(atual)}: ${envio.erro}. Responda pela Central.`)
    return true
  }

  // Texto, "ok" ou arquivo: de qual alerta?
  const escolha = escolherAlerta(recentes, r.citado, amb.agora, await ultimaResposta(amb, numero))
  if (!escolha) return false
  if ('ambiguos' in escolha) {
    // Texto: a familia e escolhida num toque, e o toque ja e o "Enviar"
    // (18/10/2026). O texto fica guardado em cada aviso; o escolhido manda, e
    // os outros sao apagados (apagarRascunhos).
    if (r.tipo === 'texto') {
      const opcoes = escolha.ambiguos.slice(0, 9)
      const guardado = r.texto.slice(0, 900)
      await amb.admin
        .from('alertas_de_urgencia')
        .update({ rascunho: guardado, rascunho_de: numero, rascunho_em: amb.agora.toISOString() })
        .in('id', opcoes.map((a) => a.id))
      const pergunta = `Para qual família vai esta mensagem?\n\n"${guardado}"\n\nAs próximas seguem para a mesma família, até chegar um aviso novo.`
      const cancelar = { id: payloadDaConfirmacao(opcoes[0].id, 'cancelar'), titulo: 'Cancelar' }
      await amb.enviarWhatsApp(
        numero,
        opcoes.length <= 2
          ? montarConteudo(pergunta, { botoes: [...opcoes.map((a) => ({ id: payloadDaConfirmacao(a.id, 'enviar'), titulo: nomeCurto(nomeDaFamilia(a), 20) })), cancelar] })
          : montarConteudo(pergunta, {
              lista: {
                rotulo: 'Escolher família',
                linhas: [...opcoes.map((a) => ({ id: payloadDaConfirmacao(a.id, 'enviar'), titulo: nomeCurto(nomeDaFamilia(a), 24) })), cancelar],
              },
            }),
      )
      return true
    }
    const nomes = escolha.ambiguos.map(nomeDaFamilia).join(', ')
    await responder(`Há ${escolha.ambiguos.length} avisos recentes (${nomes}). Para eu saber de qual família é, segure a mensagem do aviso certo e toque em Responder.`)
    return true
  }
  const alerta = escolha.alerta
  if (alerta.teste) {
    await responder(TESTE)
    return true
  }
  if (r.tipo === 'visto') {
    await registrarResposta(amb, alerta, papel, 'visto', null)
    await responder('👍 Anotado.')
    return true
  }
  if (r.tipo === 'midia') {
    await responder('Por aqui eu só consigo repassar texto para a família. Escreva a orientação, ou mande o arquivo pela Central.')
    return true
  }

  const texto = r.texto.slice(0, 900)
  await amb.admin
    .from('alertas_de_urgencia')
    .update({ rascunho: texto, rascunho_de: numero, rascunho_em: amb.agora.toISOString() })
    .eq('id', alerta.id)
  const como = papel === 'medico' ? `mensagem d${quem.o}` : 'mensagem da equipe do consultório'
  await responder(`Vou mandar para ${nomeDaFamilia(alerta)}, como ${como}:\n\n"${texto}"\n\nConfirma?`, [
    { id: payloadDaConfirmacao(alerta.id, 'enviar'), titulo: 'Enviar' },
    { id: payloadDaConfirmacao(alerta.id, 'cancelar'), titulo: 'Cancelar' },
  ])
  return true
}

/**
 * A resposta da familia de volta aos celulares (18/10/2026).
 *
 * Pedido do Edu, no primeiro dia de uso: "e quando a familia responder, da
 * para voltar para ele e para mim a mensagem tambem?". Quando alguem respondeu
 * a um aviso desta conversa pelo WhatsApp nas ultimas 6 horas, a conversa esta
 * acontecendo por la: cada mensagem da familia vai aos numeros do alerta, e a
 * mensagem repassada entra nos ids do aviso, para a resposta em cima dela
 * voltar a mesma familia (escolherAlerta).
 *
 * Texto livre chega a quem escreveu para o numero da clinica nas ultimas 24
 * horas (quem acabou de responder). Para os outros, a Meta recusa, e vai o
 * modelo pedido_equipe com o botao "Eu respondo" do mesmo aviso.
 *
 * Devolve true quando repassou: o webhook nao manda outro pedido a equipe.
 */
const MIDIA_DA_FAMILIA: Record<string, string> = {
  '[image]': '📷 Mandou uma foto (veja na Central)',
  '[audio]': '🎤 Mandou um áudio (ouça na Central)',
  '[voice]': '🎤 Mandou um áudio (ouça na Central)',
  '[video]': '🎥 Mandou um vídeo (veja na Central)',
  '[document]': '📄 Mandou um documento (veja na Central)',
  '[sticker]': 'Mandou uma figurinha',
}

export async function repassarRespostaDaFamilia(
  amb: Pick<AmbienteDaResposta, 'admin' | 'clinicId' | 'agora' | 'numeros' | 'enviarWhatsApp'>,
  p: { conversaWhatsApp: string; quem: string; texto: string; idioma?: string },
): Promise<boolean> {
  try {
    if (!amb.numeros.length) return false
    const { data, error } = await amb.admin
      .from('alertas_de_urgencia')
      .select('id,mensagens,quem')
      .eq('clinic_id', amb.clinicId)
      .eq('conversa_whatsapp', p.conversaWhatsApp)
      .gte('respondido_em', new Date(amb.agora.getTime() - JANELA_DO_ALERTA_MS).toISOString())
      .order('respondido_em', { ascending: false })
      .limit(1)
    if (error) throw error
    const alerta = (data as { id: string; mensagens: string[] | null; quem: string }[] | null)?.[0]
    if (!alerta) return false

    const quem = p.quem.trim() || alerta.quem || 'A família'
    const fala = MIDIA_DA_FAMILIA[p.texto.trim()] ?? p.texto.trim()
    const livre = montarConteudo(
      `💬 ${quem} respondeu:

"${fala.slice(0, 900)}"

Para responder, escreva aqui: vai para ${quem}.`,
      { botoes: [{ id: payloadDoVeredito(alerta.id, 'responde'), titulo: 'Eu respondo' }] },
    )
    const parametros = parametrosDoPedido({ quem, canal: 'WhatsApp', texto: fala, agora: amb.agora, assunto: 'respondeu à sua mensagem' })
    const modelo = {
      type: 'template',
      template: {
        name: MODELO_DO_PEDIDO,
        language: { code: p.idioma || 'pt_BR' },
        components: [
          { type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) },
          { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: payloadDoVeredito(alerta.id, 'responde') }] },
        ],
      },
    }
    const ids: string[] = []
    for (const numero of amb.numeros) {
      let envio = await amb.enviarWhatsApp(numero, livre)
      if (!envio.ok) envio = await amb.enviarWhatsApp(numero, modelo)
      if (envio.ok && envio.id) ids.push(envio.id)
      if (!envio.ok) console.error('Repasse da familia nao chegou a', numero.slice(-4), envio.erro)
    }
    if (ids.length) {
      const { error: erroDosIds } = await amb.admin
        .from('alertas_de_urgencia')
        .update({ mensagens: [...(alerta.mensagens ?? []), ...ids] })
        .eq('id', alerta.id)
      if (erroDosIds) console.error('Repasse da familia: ids nao gravados', erroDosIds)
    }
    return ids.length > 0
  } catch (erro) {
    // Sem as colunas de 18/10 ou sem a tabela: segue o pedido de sempre.
    console.warn('Repasse da familia: nao consegui ver a conversa no WhatsApp do medico', erro)
    return false
  }
}

// Os titulos dos botoes, para quem monta o modelo na Meta e para os testes.
export const TITULOS_DOS_BOTOES = BOTOES_DO_ALERTA.map((b) => b.titulo)
