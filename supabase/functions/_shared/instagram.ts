/**
 * O robo da Central de Cuidado no Instagram da clinica (16/10/2026).
 *
 * Pedido do Edu: o mesmo atendimento do WhatsApp no direct e nos comentarios
 * do Instagram do Dr. Marcello. Caminho simples, combinado com ele: no direct o
 * robo tira duvidas (valores, convenio, endereco, telemedicina) e, para marcar,
 * manda o link do WhatsApp com a mensagem pronta "Vim pelo Instagram". O
 * agendamento, o cadastro, o lembrete da vespera e os acompanhamentos continuam
 * no WhatsApp, que ja tem tudo isso testado - o Instagram so deixa responder ate
 * 24 h depois da ultima mensagem da pessoa e nao tem modelo aprovado.
 *
 * Os comentarios viram conversa: quem comenta "quero agendar", "valor",
 * "atende convenio?" recebe uma mensagem no direct e o comentario ganha "te
 * mandei no direct". Motivo: no mapeamento de 16/10/2026, um pedido de retorno
 * de consulta ficou 3 semanas sem resposta nos comentarios do reel mais visto.
 *
 * Aqui so ha decisao (funcoes puras, testadas em tests/instagram.test.mjs). Quem
 * le o banco e fala com a Meta e o supabase/functions/instagram-webhook.
 */
import {
  despedida,
  pediuAgendamento,
  pediuMudarConsulta,
  pediuSegundaVia,
  pediuUrgencia,
  sinalDeAlarme,
  soAgradecimento,
  soCumprimento,
} from './atendimento.ts'
import { acharResposta, assuntoClinico, type RespostaPronta } from './respostas.ts'
// O login fica em arquivo sem dependencias (a tela importa); daqui sai junto
// para os testes acharem tudo do Instagram num lugar so.
export { codigoDaVolta, enderecoDoLogin, permissoesQueFaltam, voltaPermitida } from './instagram-login.ts'

/** A frase do link: o robo do WhatsApp responde a ela abrindo o agendamento (testado no simulador em 16/10/2026). */
export const FRASE_DO_LINK = 'Olá! Vim pelo Instagram e quero agendar uma consulta.'

/** Botoes de resposta rapida do direct. O texto do botao volta como payload. */
export const OPCOES = {
  agendar: 'Agendar consulta',
  valores: 'Valores e convênio',
  onde: 'Onde atendemos',
  tele: 'Telemedicina',
  equipe: 'Falar com a equipe',
} as const
export type Opcao = keyof typeof OPCOES

export type MotivoInstagram = 'urgencia' | 'medico' | 'atendente'

export type RespostaDoDirect = {
  texto: string
  /** Botoes de resposta rapida (no maximo 13 na Meta; aqui nunca passa de 5). */
  opcoes?: Opcao[]
  /** Preenchido quando a conversa precisa de alguem da equipe. */
  atencao?: MotivoInstagram
  /** Para os numeros e o log: o que o robo decidiu. */
  acao: string
}

export type Unidade = { nome: string; endereco: string; texto: string }

export type ContextoDoDirect = {
  /** "Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico." */
  saudacao: string
  /** "o Dr. Marcello" */
  medico: string
  /** So digitos, com o 55: "5513996811279". */
  whatsapp: string
  respostas: RespostaPronta[]
  unidades: Unidade[]
  /** Texto da telemedicina, ou null quando a clinica nao atende online. */
  tele: string | null
  /** A pessoa nunca escreveu antes: o cumprimento vai junto da primeira resposta. */
  primeiraVez: boolean
  /** Horario da equipe por extenso, para quem pede para falar com alguem. */
  horarioDaEquipe: string
}

export function linkDoWhatsApp(numero: string, texto: string = FRASE_DO_LINK): string {
  return `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}

function normalizar(texto: string) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * As respostas prontas e os cartoes das unidades foram escritos para o robo do
 * WhatsApp: "digite *2*", "responda com o número", "digite 9". No Instagram nao
 * ha menu numerado, e a frase manda a familia fazer algo que nao funciona.
 * Sai a linha inteira; o resto do texto fica como a equipe escreveu.
 */
export function semInstrucoesDoRobo(texto: string): string {
  return String(texto ?? '')
    .split('\n')
    .filter((linha) => !/\bdigite\b|respond[ae]\s+com\s+(o\s+|um\s+)?n[uú]mero/i.test(linha))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Respostas prontas, IA e os textos deste arquivo escrevem no formato do
 * WhatsApp (*negrito*). No primeiro teste de verdade (16/10/2026) o Instagram no
 * computador mostrou o negrito, mas a tela de Respostas da Central mostrava
 * "*R$ 450,00*" com os asteriscos, e o app do celular nao foi conferido. Texto
 * puro sai igual em todo lugar; vira texto puro antes de gravar e enviar (o eco
 * compara o texto gravado com o que a Meta devolve, entao os dois tem de ser o
 * mesmo). Sublinhado so sai quando e marca de italico: @maria_teste e links ficam.
 */
/**
 * O texto de um erro qualquer (17/10/2026). O erro do Supabase nao e um Error:
 * e um objeto { message, details, code }, e String(erro) gravou "[object
 * Object]" no cartao do Instagram as 08:00 - um erro que grita sem dizer nada,
 * e o Edu perguntou se era algo. Erro que aparece tem de explicar.
 */
export function textoDoErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message || erro.name || 'erro sem descrição'
  if (erro && typeof erro === 'object') {
    const e = erro as { message?: unknown; details?: unknown; code?: unknown; error?: { message?: unknown } }
    const partes = [e.message ?? e.error?.message, e.details, e.code ? `(${e.code})` : null]
      .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
      .map(String)
    if (partes.length) return partes.join(' ')
    try {
      return JSON.stringify(erro)
    } catch {
      return 'erro sem descrição'
    }
  }
  return String(erro ?? 'erro sem descrição')
}

export function semFormatacaoDoWhatsApp(texto: string): string {
  return String(texto ?? '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/gm, '$1$2')
    .replace(/(^|[\s(])~([^~\n]+)~(?=$|[\s).,!?:;])/gm, '$1$2')
}

/** O botao tocado volta como payload; texto digitado igual ao botao conta tambem. */
export function opcaoTocada(texto: string, payload: string | null | undefined): Opcao | null {
  const chave = String(payload ?? '').trim().toLowerCase()
  if (chave && chave in OPCOES) return chave as Opcao
  const t = normalizar(texto)
  for (const [id, rotulo] of Object.entries(OPCOES)) if (normalizar(rotulo) === t) return id as Opcao
  return null
}

function comCumprimento(ctx: ContextoDoDirect, texto: string) {
  return ctx.primeiraVez ? `${ctx.saudacao}\n\n${texto}` : texto
}

function agendar(ctx: ContextoDoDirect, antes = ''): RespostaDoDirect {
  return {
    texto: comCumprimento(
      ctx,
      `${antes ? `${antes}\n\n` : ''}📅 *Para agendar*, toque no link: você cai no nosso WhatsApp e escolhe a unidade, o dia e o horário na hora.\n${linkDoWhatsApp(ctx.whatsapp)}`,
    ),
    opcoes: ['valores', 'onde'],
    acao: 'agendar',
  }
}

function ondeAtendemos(ctx: ContextoDoDirect): RespostaDoDirect {
  const linhas = ctx.unidades.map((u) => `📍 *${u.nome}*${u.endereco ? `\n${u.endereco}` : ''}`)
  if (ctx.tele) linhas.push('💻 *Telemedicina*\nConsulta por vídeo, de onde você estiver.')
  return {
    texto: comCumprimento(ctx, linhas.length ? linhas.join('\n\n') : 'A equipe te passa os endereços por aqui.'),
    opcoes: ['agendar', 'valores'],
    acao: 'onde',
  }
}

function valores(ctx: ContextoDoDirect): RespostaDoDirect {
  const pronta =
    acharResposta('valor da consulta pagamento convenio reembolso', ctx.respostas) ??
    acharResposta('valor', ctx.respostas)
  if (pronta) {
    return { texto: comCumprimento(ctx, semInstrucoesDoRobo(pronta.resposta)), opcoes: ['agendar', 'onde'], acao: 'valores' }
  }
  // Sem resposta pronta de valor, os cartoes das unidades: neles o valor esta escrito.
  const cartoes = ctx.unidades.filter((u) => u.texto.trim()).map((u) => semInstrucoesDoRobo(u.texto))
  if (cartoes.length) return { texto: comCumprimento(ctx, cartoes.join('\n\n')), opcoes: ['agendar'], acao: 'valores' }
  return equipe(ctx, 'Vou confirmar os valores com a equipe, que te responde por aqui.')
}

function telemedicina(ctx: ContextoDoDirect): RespostaDoDirect {
  if (!ctx.tele) return { texto: comCumprimento(ctx, 'No momento as consultas são presenciais.'), opcoes: ['onde', 'agendar'], acao: 'tele' }
  return { texto: comCumprimento(ctx, semInstrucoesDoRobo(ctx.tele)), opcoes: ['agendar'], acao: 'tele' }
}

function equipe(ctx: ContextoDoDirect, texto?: string): RespostaDoDirect {
  return {
    texto: comCumprimento(ctx, texto ?? `Certo! Já avisei a nossa equipe, que responde por aqui ${ctx.horarioDaEquipe}.`),
    atencao: 'atendente',
    acao: 'equipe',
  }
}

/**
 * O que o robo responde a uma mensagem no direct.
 *
 * A ordem importa e e a mesma do WhatsApp: urgencia antes de tudo (uma mae com
 * o filho mal nao pode receber um menu), depois assunto clinico (o robo nunca
 * orienta conduta), depois o que a pessoa pediu.
 */
export function responderDirect(texto: string, payload: string | null | undefined, ctx: ContextoDoDirect): RespostaDoDirect {
  const t = String(texto ?? '').trim()

  // Sinal de alarme sem a palavra "urgente" vale aqui tambem (17/10/2026), nos
  // dois niveis do WhatsApp: risco de vida manda ao pronto-socorro; urgencia
  // comum avisa o medico e oferece o horario mais proximo pelo link.
  const sinal = sinalDeAlarme(t)
  if (sinal?.risco !== 'vida' && (pediuUrgencia(t) || sinal)) {
    return {
      texto:
        '🚨 Entendo a preocupação. Já avisei o médico e a nossa equipe, que vão avaliar o que você contou e responder por aqui.\n\n' +
        `Se quiser já garantir o horário mais próximo, é pelo nosso WhatsApp, inclusive hoje, se houver vaga:\n${linkDoWhatsApp(ctx.whatsapp)}\n\n` +
        'Se for uma emergência com risco de vida, procure o *pronto-socorro mais próximo* ou ligue *192*.',
      atencao: 'urgencia',
      acao: 'urgencia',
    }
  }
  if (sinal) {
    return {
      texto:
        '🚨 Se a criança está mal agora, procure o *pronto-socorro mais próximo* ou ligue *192*.\n\n' +
        'Já avisei a nossa equipe, que responde por aqui assim que possível.',
      atencao: 'urgencia',
      acao: 'urgencia',
    }
  }

  const opcao = opcaoTocada(t, payload)
  if (opcao === 'agendar') return agendar(ctx)
  if (opcao === 'valores') return valores(ctx)
  if (opcao === 'onde') return ondeAtendemos(ctx)
  if (opcao === 'tele') return telemedicina(ctx)
  if (opcao === 'equipe') return equipe(ctx)

  if (!t) {
    // Foto, audio ou figurinha sem texto: a equipe ve no historico.
    return equipe(ctx, 'Recebemos! Já passei para a nossa equipe, que responde por aqui.')
  }

  // Antes do assunto clinico: "segunda via da receita" tem "receita", que a
  // lista clinica pega, mas e pedido de servico - no WhatsApp tambem vem antes.
  if (pediuMudarConsulta(t) || pediuSegundaVia(t)) {
    return {
      texto: comCumprimento(
        ctx,
        `Isso é pelo nosso WhatsApp, onde fica o seu cadastro: lá você vê, remarca ou cancela a consulta e pede 2ª via.\n${linkDoWhatsApp(ctx.whatsapp, 'Olá! Vim pelo Instagram.')}`,
      ),
      acao: 'whatsapp',
    }
  }

  if (assuntoClinico(t)) {
    return {
      texto: comCumprimento(
        ctx,
        `Sobre sintomas e remédios, quem orienta é ${ctx.medico}, com a criança avaliada. Já passei sua mensagem para a equipe, que responde por aqui.\n\nSe quiser marcar a consulta, toque em *${OPCOES.agendar}*.`,
      ),
      opcoes: ['agendar'],
      atencao: 'medico',
      acao: 'clinico',
    }
  }

  if (pediuAgendamento(t)) return agendar(ctx)

  const pronta = acharResposta(t, ctx.respostas)
  if (pronta) {
    return {
      texto: comCumprimento(ctx, semInstrucoesDoRobo(pronta.resposta)),
      opcoes: ['agendar', 'equipe'],
      acao: `pronta:${pronta.assunto}`,
    }
  }

  if (soAgradecimento(t) || despedida(t)) return { texto: 'Por nada! Qualquer coisa, é só chamar por aqui 💙', acao: 'despedida' }

  if (soCumprimento(t) || ctx.primeiraVez) {
    return { texto: `${ctx.saudacao}\n\nComo podemos ajudar?`, opcoes: ['agendar', 'valores', 'onde', 'tele', 'equipe'], acao: 'menu' }
  }

  // Nao entendeu: a equipe le e responde. Sem menu de novo - repetir o menu
  // para quem escreveu uma pergunta foi o defeito mais reclamado no WhatsApp.
  return equipe(ctx, 'Já passei sua mensagem para a nossa equipe, que responde por aqui. Se quiser agendar, toque no botão abaixo.')
}

/**
 * O "robo" que a atendente com IA aciona no Instagram (ver _shared/assistente.ts).
 *
 * No WhatsApp, abrir_fluxo manda ao robo "quero marcar uma consulta", "menu",
 * "4" (minha consulta) e "5" (2a via), que sao passos do menu de la. Aqui nao ha
 * menu numerado: "4" e "5" cairiam em "nao entendi" e iriam para a equipe sem
 * ninguem ter pedido. Cada fluxo vira a resposta certa do Instagram.
 */
export function respostaDoFluxo(texto: string, ctx: ContextoDoDirect): RespostaDoDirect {
  const t = normalizar(texto)
  if (t === 'menu') return { texto: `${ctx.saudacao}\n\nComo podemos ajudar?`, opcoes: ['agendar', 'valores', 'onde', 'tele', 'equipe'], acao: 'menu' }
  if (t === '4' || t === '5') return responderDirect('quero remarcar a consulta', null, { ...ctx, primeiraVez: false })
  return responderDirect(texto, null, { ...ctx, primeiraVez: false })
}

/**
 * O conhecimento da clinica (conhecimentoDaClinica, em atendimento.ts) foi
 * escrito para o WhatsApp: "marca... por aqui mesmo, pelo WhatsApp", "2a via:
 * pedida por aqui", "lembrete por aqui". Lido no direct, a IA diria a mae que
 * da para marcar pelo Instagram. Cada "por aqui" de agenda vira "pelo WhatsApp
 * da clinica". Se o texto de la mudar, a troca so deixa de acontecer - e a
 * instrucao do canal (assistente.ts) continua dizendo que agenda e no WhatsApp.
 */
export function conhecimentoParaOInstagram(texto: string): string {
  return String(texto ?? '')
    .replace(/por aqui mesmo, pelo WhatsApp, na hora/g, 'pelo WhatsApp da clínica (o link vai na conversa), na hora')
    .replace(/já emitidos: pedida por aqui/g, 'já emitidos: pedida pelo WhatsApp da clínica')
    .replace(/recebe um lembrete por aqui/g, 'recebe um lembrete pelo WhatsApp')
}

// ---------------------------------------------------------------- comentarios

const PEDE_CONTATO = [
  /\b(agend|marc)ar\b/,
  /\bagendamento\b/,
  /\bconsulta\b/,
  /\b(valor|valores|preco|precos|quanto custa|quanto e)\b/,
  /\b(convenio|plano de saude|unimed|amil|bradesco|sulamerica|reembolso)\b/,
  /\b(endereco|onde (fica|atende|e o consultorio))\b/,
  /\b(telemedicina|online|por video)\b/,
  /\b(atende|atendem)\b/,
  /\b(whats|whatsapp|zap|contato|telefone|numero)\b/,
  /\b(como (faco|faz) (pra|para)|quero (ir|levar|marcar|agendar|consultar))\b/,
  /\bretorn(o|ar) (a|da)? ?consulta\b/,
]

/**
 * O comentario pede contato com o consultorio? Entao vira conversa no direct.
 *
 * Lista de proposito curta e de servico: elogio ("excelente 👏"), depoimento e
 * pergunta medica nao entram. Pergunta medica em publico nao se responde
 * sozinha; vai para a equipe pela tela (comentarioEPergunta).
 */
export function comentarioPedeContato(texto: string): boolean {
  const t = normalizar(texto)
  if (!t) return false
  return PEDE_CONTATO.some((r) => r.test(t))
}

/** Pergunta que nao e de servico: a equipe decide se e como responder. */
export function comentarioEPergunta(texto: string): boolean {
  const t = normalizar(texto)
  return /\?/.test(t) || /^(o que|qual|quais|como|quando|por que|porque|pode|posso|e normal|e possivel)\b/.test(t)
}

export function respostaPrivadaAoComentario(username: string, ctx: Pick<ContextoDoDirect, 'medico' | 'whatsapp'>): string {
  const quem = username ? `@${username.replace(/^@/, '')}` : ''
  return (
    `Olá${quem ? `, ${quem}` : ''}! Vi seu comentário 💙\n\n` +
    `📅 Para agendar com ${ctx.medico}, toque no link: você cai no nosso WhatsApp e escolhe a unidade, o dia e o horário na hora.\n` +
    `${linkDoWhatsApp(ctx.whatsapp)}\n\nSe tiver alguma dúvida, é só responder aqui.`
  )
}

const PUBLICAS = ['Te mandei uma mensagem no direct 💙', 'Te chamei no direct 💙', 'Enviamos as informações no seu direct 💙']

/**
 * Resposta publica curta, variando: o Instagram trata a mesma frase repetida em
 * muitos comentarios como comportamento de robo e pode esconder. A escolha sai
 * do id do comentario (sem Math.random: o mesmo comentario, a mesma frase).
 */
export function respostaPublicaAoComentario(commentId: string): string {
  let h = 0
  for (const c of String(commentId)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PUBLICAS[h % PUBLICAS.length]
}

// ---------------------------------------------------------------- janela de 24 h

const DIA_MS = 24 * 3600 * 1000

/** A Meta so deixa responder no direct ate 24 h depois da ultima mensagem da pessoa. */
export function dentroDaJanela(ultimaDaPessoa: string | null | undefined, agora: Date = new Date()): boolean {
  if (!ultimaDaPessoa) return false
  const t = Date.parse(ultimaDaPessoa)
  return Number.isFinite(t) && agora.getTime() - t < DIA_MS
}

/** Resposta privada a um comentario: ate 7 dias depois dele. */
export function comentarioAindaRespondivel(criadoEm: string | null | undefined, agora: Date = new Date()): boolean {
  if (!criadoEm) return false
  const t = Date.parse(criadoEm)
  return Number.isFinite(t) && agora.getTime() - t < 7 * DIA_MS
}

// ---------------------------------------------------------------- buscar comentarios

export type ComentarioDaApi = {
  id?: unknown
  text?: unknown
  timestamp?: unknown
  username?: unknown
  from?: { id?: unknown; username?: unknown } | null
}

export type ComentarioParaGravar = {
  comment_id: string
  media_id: string
  autor_id: string | null
  autor_username: string | null
  texto: string
  precisa_equipe: boolean
  created_at: string
}

/** "2026-10-16T22:20:31+0000": o Instagram manda o fuso sem os dois-pontos. */
function dataDoInstagram(valor: unknown): string | null {
  const t = Date.parse(String(valor ?? '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/**
 * "Buscar comentarios" na tela (16/10/2026). A Meta so manda aviso de
 * comentario para app aprovado na analise; ate la, e depois disso para o que o
 * aviso perdeu, a equipe busca os comentarios dos posts recentes. Entram so os
 * dos ultimos 7 dias (depois disso o Instagram nao deixa responder no direct),
 * e nunca os da propria conta (as respostas da clinica). O robo nao responde
 * sozinho o que veio pela busca: pedido de contato e pergunta ficam marcados
 * para a equipe, que responde pela tela.
 */
export function comentariosParaImportar(
  mediaId: string,
  lista: ComentarioDaApi[],
  conta: { igUserId: string; username: string | null },
  agora: Date = new Date(),
): ComentarioParaGravar[] {
  const linhas: ComentarioParaGravar[] = []
  const nossaConta = (conta.username ?? '').replace(/^@/, '').toLowerCase()
  for (const c of lista ?? []) {
    const id = String(c?.id ?? '')
    const criadoEm = dataDoInstagram(c?.timestamp)
    if (!id || !criadoEm || !comentarioAindaRespondivel(criadoEm, agora)) continue
    const autorId = c?.from?.id ? String(c.from.id) : null
    const autor = String(c?.from?.username ?? c?.username ?? '').replace(/^@/, '') || null
    if (autorId === conta.igUserId || (autor && nossaConta && autor.toLowerCase() === nossaConta)) continue
    const texto = String(c?.text ?? '')
    linhas.push({
      comment_id: id,
      media_id: mediaId,
      autor_id: autorId,
      autor_username: autor,
      texto,
      precisa_equipe: comentarioPedeContato(texto) || comentarioEPergunta(texto),
      created_at: criadoEm,
    })
  }
  return linhas
}

/** A busca automatica roda a cada 10 minutos; 30 de janela deixa duas rodadas de folga. */
export const JANELA_DA_RESPOSTA_AUTOMATICA_MS = 30 * 60 * 1000

/**
 * Busca automatica de comentarios (16/10/2026, pedido do Edu): o aviso de
 * comentario da Meta so vem para "Tech Provider", cadastro sem volta que a
 * clinica nao quis. A cada 10 minutos o sistema busca os comentarios e:
 *
 *   responder  comentario novo de ate 30 minutos: o robo trata como se fosse o
 *              aviso da Meta (link no direct, "te mandei no direct" no post)
 *   soGravar   comentario mais antigo: entra na lista da equipe, sem resposta
 *              sozinha. Assim ligar a busca nao manda mensagem para quem
 *              comentou dias atras, e uma busca parada por uma hora nao vira
 *              uma rajada de respostas atrasadas quando volta.
 *
 * Comentario que ja esta no banco (webhook, botao ou rodada anterior) nunca
 * volta: quem cuidou dele antes ja cuidou.
 */
export function separarComentariosDaBusca(
  linhas: ComentarioParaGravar[],
  jaGravados: Set<string>,
  agora: Date = new Date(),
): { responder: ComentarioParaGravar[]; soGravar: ComentarioParaGravar[] } {
  const responder: ComentarioParaGravar[] = []
  const soGravar: ComentarioParaGravar[] = []
  for (const l of linhas) {
    if (jaGravados.has(l.comment_id)) continue
    const idade = agora.getTime() - Date.parse(l.created_at)
    if (idade <= JANELA_DA_RESPOSTA_AUTOMATICA_MS) responder.push(l)
    else soGravar.push(l)
  }
  return { responder, soGravar }
}

/** Token de longa duracao: 60 dias. Renova quando faltam menos de 15. */
export function tokenPrecisaRenovar(expiraEm: string | null | undefined, agora: Date = new Date()): boolean {
  if (!expiraEm) return true
  const t = Date.parse(expiraEm)
  return !Number.isFinite(t) || t - agora.getTime() < 15 * DIA_MS
}
