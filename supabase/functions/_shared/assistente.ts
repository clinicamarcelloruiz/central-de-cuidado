/**
 * Atendente com IA (Claude), em teste (15/10/2026).
 *
 * Pedido do Edu para ver do que um modelo de linguagem e capaz no WhatsApp da
 * clinica, com um botao para voltar ao robo de sempre. Tres modos, por clinica
 * (clinic_settings.assistente_ia):
 *
 *   desligado  o robo de regras, como sempre. E o padrao.
 *   sombra     o robo responde; o Claude escreve, como nota interna da
 *              conversa, o que ELE responderia. Ninguem de fora ve. Serve para
 *              comparar sem risco.
 *   ligado     o Claude responde a familia.
 *
 * Mesmo ligado, o Claude nao age sozinho no banco. Marcar, remarcar, cancelar,
 * ver a consulta e pedir 2a via continuam sendo do robo, que ja tem os passos
 * testados: o Claude so ABRE o fluxo (abrir_fluxo) ou traduz uma resposta que o
 * robo nao entendeu (responder_etapa). O que ele faz sozinho e conversar,
 * explicar o que esta escrito nos cartoes e nas respostas prontas, e consultar
 * horarios livres sem reservar nada.
 *
 * Fica sempre com o robo, mesmo ligado: anexo (o Claude nao ve a imagem),
 * urgencia, assunto clinico e resposta automatica de empresa. Os tres primeiros
 * tem resposta escrita e conferida; o ultimo, solto com uma IA, vira duas
 * maquinas conversando.
 *
 * Os quatro assuntos que sao da equipe (combinado com o Edu em 15/10): conduta
 * medica, documento assinado, excecao as regras, dinheiro e conflito. Pedido de
 * "falar com alguem" fora desses o Claude resolve.
 *
 * Qualquer falha (sem chave, Anthropic fora, demora) cai no robo e fica no log e
 * nos Numeros do WhatsApp (evento ia_falhou). Familia nunca fica sem resposta
 * por causa da IA.
 */
import type { ConsultaMarcada, MotivoAtencao, Resultado } from './atendimento.ts'
import { conhecimentoDaClinica, pediuUrgencia, respostaAutomaticaDaFamilia } from './atendimento.ts'
import { assuntoClinico } from './respostas.ts'
import { dentroDoExpediente } from './expediente.ts'

export type ModoDoAssistente = 'desligado' | 'sombra' | 'ligado'
export const MODELO_PADRAO = 'claude-haiku-5-5'

export function lerModo(valor: unknown): ModoDoAssistente {
  return valor === 'sombra' || valor === 'ligado' ? valor : 'desligado'
}

/**
 * CPF, e-mail e telefone saem antes de qualquer coisa ir para fora (LGPD).
 * O Claude nao precisa deles para conversar: o cadastro e do fluxo do robo.
 */
export function semDadosPessoais(texto: string): string {
  return String(texto ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]')
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g, '[telefone]')
}

export type Situacao = {
  /** A mensagem que acabou de chegar. */
  texto: string
  anexo: boolean
  /** Etapa do robo (booking_state), ou nula. */
  etapa: string | null
  /** A ultima mensagem do consultorio, que costuma ser a pergunta em aberto. */
  ultimaDoConsultorio: string | null
  historico: { de: 'familia' | 'consultorio'; texto: string }[]
  /** Primeiros nomes das criancas cadastradas neste telefone. */
  criancas: string[]
  /** "qua, 21/10 08:00 · Livance · Santos" */
  consultas: string[]
  /** Ver conhecimentoDaClinica em atendimento.ts. */
  conhecimento: string
  /** "o Dr. Marcello" */
  quemAtende: string
  agora: Date
  /** Alguem da equipe falou ha pouco: quem responde e ela, nao robo nem IA. */
  equipeConversando: boolean
}

export type Ferramentas = {
  /** O robo, como se a familia tivesse escrito `texto`. */
  robo: (texto: string, etapa: 'mesma' | 'menu' | 'nenhuma') => Promise<Resultado | null>
  horarios: (unidade: string) => Promise<string>
  equipe: (motivo: MotivoAtencao, texto: string) => Promise<Resultado>
}

type Bloco =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

export type ChamarClaude = (corpo: Record<string, unknown>, limiteMs: number) => Promise<{ content: Bloco[] }>

export function claudePelaApi(chave: string, buscar: typeof fetch = fetch): ChamarClaude {
  return async (corpo, limiteMs) => {
    const controle = new AbortController()
    const relogio = setTimeout(() => controle.abort(), limiteMs)
    try {
      const resposta = await buscar('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: controle.signal,
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(`Claude recusou (${resposta.status}): ${json?.error?.message ?? 'sem detalhe'}`)
      return json as { content: Bloco[] }
    } finally {
      clearTimeout(relogio)
    }
  }
}

export type Desfecho = {
  resultado: Resultado | null
  origem: 'robo' | 'ia'
  eventos: { evento: string; detalhe?: string }[]
  /** Modo sombra: o que o Claude teria respondido, para virar nota interna. */
  nota?: string
}

const FLUXOS: Record<string, { texto: string; etapa: 'menu' | 'nenhuma' }> = {
  agendar: { texto: 'quero marcar uma consulta', etapa: 'nenhuma' },
  minha_consulta: { texto: '4', etapa: 'menu' },
  segunda_via: { texto: '5', etapa: 'menu' },
  menu: { texto: 'menu', etapa: 'nenhuma' },
}

const MOTIVOS: Record<string, MotivoAtencao> = {
  urgencia: 'urgencia',
  documento: 'documento',
}

function ferramentasDoClaude(emEtapa: boolean) {
  const lista: Record<string, unknown>[] = [
    {
      name: 'ver_horarios',
      description: 'Consulta os dias e horários livres de uma unidade (só leitura, não reserva). Use antes de dizer quando tem vaga.',
      input_schema: {
        type: 'object',
        properties: { unidade: { type: 'string', description: 'Nome da unidade, como aparece em <clinica>.' } },
        required: ['unidade'],
      },
    },
    {
      name: 'chamar_equipe',
      description:
        'Passa a conversa para a equipe humana. Obrigatório nos quatro assuntos da equipe e na urgência. ' +
        'O texto é o que a família vai ler agora.',
      input_schema: {
        type: 'object',
        properties: {
          motivo: { type: 'string', enum: ['medico', 'documento', 'excecao', 'financeiro', 'pessoa', 'urgencia', 'sem_informacao'] },
          texto: { type: 'string', description: 'Mensagem curta para a família: a equipe vai responder por aqui.' },
        },
        required: ['motivo', 'texto'],
      },
    },
  ]
  if (emEtapa) {
    lista.push({
      name: 'responder_etapa',
      description:
        'A família está num passo do sistema e o sistema não entendeu a resposta dela. Envia ao sistema a resposta ' +
        'equivalente, com o texto exato de uma opção (o número da lista, o dia como aparece, o horário como 14:00, PULAR...).',
      input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
    })
  } else {
    lista.push({
      name: 'abrir_fluxo',
      description:
        'Abre um fluxo do sistema, que conduz a família com botões: agendar (marcar consulta ou retorno), ' +
        'minha_consulta (ver, remarcar ou cancelar), segunda_via (receita ou pedido de exame já emitidos), menu.',
      input_schema: {
        type: 'object',
        properties: { fluxo: { type: 'string', enum: Object.keys(FLUXOS) } },
        required: ['fluxo'],
      },
    })
  }
  return lista
}

function instrucoes(s: Situacao, emEtapa: boolean): string {
  return [
    `Você é o atendente virtual do consultório de ${s.quemAtende.replace(/^(o|a) /, '')}, gastroenterologista pediátrico, no WhatsApp. Fala com mães, pais e responsáveis.`,
    '',
    'Como responder:',
    '- Português do Brasil, acolhedor e direto. Mensagens curtas, no máximo 4 frases, no estilo do WhatsApp. Pode usar *negrito*. Sem listas longas.',
    '- Use SOMENTE o que está em <clinica>. Se a resposta não estiver lá, não invente: diga que vai confirmar com a equipe e use chamar_equipe com motivo sem_informacao.',
    '- Nunca invente valor, endereço, horário, convênio, prazo ou regra.',
    '- Para marcar, remarcar, cancelar, ver a consulta ou pedir 2ª via, use abrir_fluxo: o sistema conduz a família com botões. Você pode responder antes, em uma frase, o que ela perguntou.',
    '- Para dizer quando tem vaga, use ver_horarios. Não prometa horário: quem reserva é o fluxo de agendamento.',
    '- Não peça CPF, e-mail nem dados da criança: o cadastro é feito pelo fluxo de agendamento.',
    '',
    'Sempre da equipe (use chamar_equipe e diga que a equipe responde por aqui, sem responder o conteúdo):',
    '1. Conduta médica: sintoma, remédio, dose, resultado de exame, se é grave, se precisa de consulta.',
    '2. Documento assinado pelo médico: receita nova, pedido de exame novo, atestado, relatório, declaração. (2ª via de algo já emitido: abrir_fluxo segunda_via.)',
    '3. Exceção às regras: encaixe fora da agenda, desconto, retorno fora do prazo, atender adulto, mudar valor.',
    '4. Dinheiro e conflito: estorno, cobrança contestada, reclamação.',
    'Se pedirem para falar com uma pessoa: se o assunto for um desses quatro, chame a equipe; se não, resolva você e só chame a equipe se insistirem.',
    '',
    'Urgência: se a criança parece mal agora, oriente procurar o pronto-socorro mais próximo ou ligar 192, e use chamar_equipe com motivo urgencia.',
    'Se perguntarem, você é o assistente virtual do consultório, e a equipe acompanha as conversas.',
    emEtapa
      ? `\nA família está no passo "${s.etapa}" do sistema e o sistema não entendeu a última resposta dela. A última mensagem do consultório foi:\n«${semDadosPessoais(s.ultimaDoConsultorio ?? '').slice(0, 900)}»\nSe der para traduzir o que ela quis dizer numa opção, use responder_etapa. Se ela perguntou outra coisa, responda e lembre o passo em aberto.`
      : '',
    '',
    `<clinica>\n${s.conhecimento}\n</clinica>`,
  ].join('\n')
}

function contexto(s: Situacao): string {
  const quando = s.agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const conversa = s.historico
    .slice(-12)
    .map((m) => `${m.de === 'familia' ? 'Família' : 'Consultório'}: ${semDadosPessoais(m.texto).slice(0, 600)}`)
    .join('\n')
  return [
    '<contexto>',
    `Agora: ${quando} (${dentroDoExpediente(s.agora) ? 'dentro' : 'fora'} do horário de atendimento da equipe).`,
    `Crianças cadastradas neste telefone: ${s.criancas.length ? s.criancas.join(', ') : 'nenhuma (contato novo)'}.`,
    `Consultas marcadas: ${s.consultas.length ? s.consultas.join('; ') : 'nenhuma'}.`,
    '</contexto>',
    '<conversa>',
    conversa || '(primeira mensagem)',
    '</conversa>',
    `<mensagem_nova>${semDadosPessoais(s.texto).slice(0, 1500)}</mensagem_nova>`,
  ].join('\n')
}

/** O robo nao entendeu? Entao o Claude tenta. A escalada da 3a vez nao conta: ela ja chamou a equipe. */
export function roboNaoEntendeu(r: Resultado | null): boolean {
  return Boolean(r && /^Não entendi/.test(r.resposta))
}

/** O que fica com o robo mesmo com a IA ligada (ver o topo do arquivo). */
export function ficaComORobo(s: Situacao): string | null {
  if (s.equipeConversando) return 'equipe_conversando'
  if (s.anexo) return 'anexo'
  if (pediuUrgencia(s.texto)) return 'urgencia'
  if (assuntoClinico(s.texto)) return 'assunto_clinico'
  if (respostaAutomaticaDaFamilia(s.texto)) return 'resposta_automatica'
  return null
}

const ATE = 4

/**
 * Uma conversa com o Claude, ate ele dar a resposta final ou usar uma
 * ferramenta que encerra a vez (abrir_fluxo, responder_etapa, chamar_equipe).
 */
async function conversarComClaude(
  s: Situacao,
  ferramentas: Ferramentas,
  chamar: ChamarClaude,
  modelo: string,
  emEtapa: boolean,
  prazoMs: number,
): Promise<{ resultado: Resultado; acao: string }> {
  const fim = Date.now() + prazoMs
  const mensagens: Record<string, unknown>[] = [{ role: 'user', content: contexto(s) }]
  for (let volta = 0; volta < ATE; volta++) {
    const resta = fim - Date.now()
    if (resta < 1500) throw new Error('prazo esgotado')
    const resposta = await chamar(
      { model: modelo, max_tokens: 700, system: instrucoes(s, emEtapa), tools: ferramentasDoClaude(emEtapa), messages: mensagens },
      resta,
    )
    const blocos = Array.isArray(resposta?.content) ? resposta.content : []
    const texto = blocos
      .filter((b): b is Extract<Bloco, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
      .slice(0, 1500)
    const usos = blocos.filter((b): b is Extract<Bloco, { type: 'tool_use' }> => b.type === 'tool_use')
    if (usos.length === 0) {
      if (!texto) throw new Error('resposta vazia')
      return { resultado: { resposta: texto }, acao: 'conversou' }
    }

    // Ferramentas que encerram a vez: a primeira que aparecer decide.
    const final = usos.find((u) => u.name !== 'ver_horarios')
    if (final) {
      const juntar = (r: Resultado | null): Resultado => {
        if (!r) return { resposta: texto || 'Certo!' }
        return { ...r, resposta: texto ? `${texto}\n\n${r.resposta}` : r.resposta }
      }
      if (final.name === 'abrir_fluxo') {
        const fluxo = FLUXOS[String(final.input?.fluxo ?? '')]
        if (!fluxo) throw new Error(`fluxo desconhecido: ${final.input?.fluxo}`)
        return { resultado: juntar(await ferramentas.robo(fluxo.texto, fluxo.etapa)), acao: `fluxo:${final.input.fluxo}` }
      }
      if (final.name === 'responder_etapa') {
        const r = await ferramentas.robo(String(final.input?.texto ?? '').slice(0, 200), 'mesma')
        // Traduziu e o robo ainda nao entendeu: o Claude nao insiste, explica.
        if (roboNaoEntendeu(r)) return { resultado: juntar(r), acao: 'etapa_sem_sucesso' }
        // A traducao vale pelo resultado do robo; o texto do Claude so atrapalharia.
        return { resultado: r ?? { resposta: texto || 'Certo!' }, acao: 'etapa' }
      }
      if (final.name === 'chamar_equipe') {
        const motivo = String(final.input?.motivo ?? 'pessoa')
        const aviso = String(final.input?.texto ?? '').trim() || texto || 'Já avisei a nossa equipe: alguém responde por aqui.'
        return { resultado: await ferramentas.equipe(MOTIVOS[motivo] ?? 'atendente', aviso.slice(0, 800)), acao: `equipe:${motivo}` }
      }
      throw new Error(`ferramenta desconhecida: ${final.name}`)
    }

    // So consultas de horario: responde e da outra volta.
    const resultados = []
    for (const uso of usos) {
      const conteudo = await ferramentas.horarios(String(uso.input?.unidade ?? '')).catch((erro) => `Falhou: ${erro}`)
      resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: conteudo })
    }
    mensagens.push({ role: 'assistant', content: blocos }, { role: 'user', content: resultados })
  }
  throw new Error('voltas demais')
}

/** No modo sombra nada acontece de verdade: o robo e a equipe sao de mentira. */
function ferramentasDeMentira(reais: Ferramentas): Ferramentas & { feito: string[] } {
  const feito: string[] = []
  return {
    feito,
    robo: async (texto, etapa) => {
      feito.push(`o sistema seguiria com "${texto}" (${etapa})`)
      return { resposta: `[o sistema seguiria com: ${texto}]` }
    },
    horarios: reais.horarios,
    equipe: async (motivo, texto) => {
      feito.push(`passaria para a equipe (${motivo})`)
      return { resposta: texto, atencao: motivo }
    },
  }
}

export async function atenderComAssistente(opcoes: {
  modo: ModoDoAssistente
  situacao: Situacao
  ferramentas: Ferramentas
  /** Nulo sem chave da API. */
  chamar: ChamarClaude | null
  modelo?: string
  /** O robo como hoje, com a mensagem real. */
  roboDireto: () => Promise<Resultado | null>
  prazoMs?: number
}): Promise<Desfecho> {
  const { modo, situacao, ferramentas, chamar, roboDireto } = opcoes
  const modelo = opcoes.modelo || MODELO_PADRAO
  const prazo = opcoes.prazoMs ?? 12_000
  if (modo === 'desligado') return { resultado: await roboDireto(), origem: 'robo', eventos: [] }

  if (!chamar) {
    console.warn('Atendente com IA ligado sem ANTHROPIC_API_KEY: seguindo com o robo')
    return { resultado: await roboDireto(), origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: 'sem chave' }] }
  }

  const doRobo = ficaComORobo(situacao)
  const emEtapa = Boolean(situacao.etapa && situacao.etapa !== 'menu' && situacao.etapa !== 'atendente')

  if (modo === 'sombra') {
    const resultado = await roboDireto()
    if (doRobo) return { resultado, origem: 'robo', eventos: [] }
    // Em etapa, so quando o robo nao entendeu - e quando o Claude entraria de verdade.
    if (emEtapa && !roboNaoEntendeu(resultado)) return { resultado, origem: 'robo', eventos: [] }
    try {
      const mentira = ferramentasDeMentira(ferramentas)
      const { resultado: dele } = await conversarComClaude(situacao, mentira, chamar, modelo, emEtapa, prazo)
      const acoes = mentira.feito.length ? `\n\n[${mentira.feito.join('; ')}]` : ''
      return {
        resultado,
        origem: 'robo',
        eventos: [{ evento: 'ia_sombra' }],
        nota: `🤖 Claude (modo sombra) responderia:\n\n${dele?.resposta ?? ""}${acoes}`.slice(0, 3900),
      }
    } catch (erro) {
      console.warn('Atendente com IA (sombra) falhou', erro)
      return { resultado, origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: 'sombra' }] }
    }
  }

  // Ligado.
  if (doRobo) return { resultado: await roboDireto(), origem: 'robo', eventos: [{ evento: 'ia_passou_ao_robo', detalhe: doRobo }] }

  if (emEtapa) {
    const doRoboNaEtapa = await roboDireto()
    if (!roboNaoEntendeu(doRoboNaEtapa)) return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [] }
    try {
      const { resultado, acao } = await conversarComClaude(situacao, ferramentas, chamar, modelo, true, prazo)
      return { resultado, origem: 'ia', eventos: [{ evento: 'ia_respondeu', detalhe: acao }] }
    } catch (erro) {
      console.warn('Atendente com IA falhou na etapa; vale o "nao entendi" do robo', erro)
      return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }] }
    }
  }

  try {
    const { resultado, acao } = await conversarComClaude(situacao, ferramentas, chamar, modelo, false, prazo)
    return { resultado, origem: 'ia', eventos: [{ evento: 'ia_respondeu', detalhe: acao }] }
  } catch (erro) {
    console.warn('Atendente com IA falhou; o robo responde', erro)
    return { resultado: await roboDireto(), origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }] }
  }
}

// O mesmo atalho de respostas.ts: o cliente do Supabase sem os tipos gerados.
type Admin = { from: (tabela: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * O que o Claude precisa saber desta conversa, lido do banco. Cada leitura em
 * try/catch: sem historico ele responde so a mensagem; sem os textos da
 * clinica, chama a equipe para tudo o que nao souber (as instrucoes mandam).
 */
export async function montarSituacao(
  admin: Admin,
  p: {
    clinicId: string
    conversationId: string
    texto: string
    anexo: boolean
    etapa: string | null
    criancas: string[]
    consultas: ConsultaMarcada[]
    quemAtende: string
    agora: Date
    equipeConversando: boolean
  },
): Promise<Situacao> {
  let historico: Situacao['historico'] = []
  try {
    const { data, error } = await admin
      .from('whatsapp_messages')
      .select('direction,body,created_at')
      .eq('conversation_id', p.conversationId)
      .order('created_at', { ascending: false })
      .limit(16)
    if (error) throw error
    historico = ((data ?? []) as { direction: string; body: string | null }[])
      .reverse()
      .filter((m) => (m.body ?? '').trim())
      .map((m) => ({ de: m.direction === 'inbound' ? ('familia' as const) : ('consultorio' as const), texto: String(m.body) }))
  } catch (erro) {
    console.warn('Atendente com IA sem o historico da conversa', erro)
  }
  // A mensagem nova ja foi gravada antes do robo: sai do historico para nao repetir.
  const ultima = historico.at(-1)
  if (ultima && ultima.de === 'familia' && ultima.texto.trim() === p.texto.trim()) historico.pop()
  const ultimaDoConsultorio = [...historico].reverse().find((m) => m.de === 'consultorio')?.texto ?? null

  let conhecimento = ''
  try {
    conhecimento = await conhecimentoDaClinica(admin as never, p.clinicId)
  } catch (erro) {
    console.warn('Atendente com IA sem os textos da clinica', erro)
  }

  const consultas = p.consultas.map((c) => {
    const quando = new Date(c.inicio).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    const de = (c.paciente ?? '').trim().split(/\s+/)[0]
    return `${quando} · ${c.unidade}${de ? ` · ${de}` : ''}`
  })

  return {
    texto: p.texto,
    anexo: p.anexo,
    etapa: p.etapa,
    ultimaDoConsultorio,
    historico,
    criancas: p.criancas,
    consultas,
    conhecimento,
    quemAtende: p.quemAtende,
    agora: p.agora,
    equipeConversando: p.equipeConversando,
  }
}
