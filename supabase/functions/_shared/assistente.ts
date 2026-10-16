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
 * urgencia e resposta automatica de empresa. Os dois primeiros tem resposta
 * escrita e conferida; o ultimo, solto com uma IA, vira duas maquinas
 * conversando. Sintoma ficava com o robo ate 16/10/2026, mas "minha filha tem
 * refluxo, ele trata?" recebia "nao posso orientar" e um menu; agora o Claude
 * responde a parte do servico e passa a conduta para a equipe (ver
 * orientouConduta, a trava para o caso de ele escorregar).
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
  /**
   * Nota interna da conversa, que so a equipe ve. No modo sombra, o que o
   * Claude teria respondido; ligado, o resumo que ele deixa ao chamar a equipe.
   */
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
        'São duas mensagens: uma para a família (ela lê agora) e um resumo para a equipe (só a equipe vê).',
      input_schema: {
        type: 'object',
        properties: {
          motivo: { type: 'string', enum: ['medico', 'documento', 'excecao', 'financeiro', 'pessoa', 'urgencia', 'sem_informacao'] },
          para_familia: {
            type: 'string',
            description:
              'O que a família lê agora, falando COM ela ("você"). Ex.: "Vou confirmar isso com a equipe e te respondemos por aqui." ' +
              'Nunca fale da família em terceira pessoa nem peça nada à equipe aqui.',
          },
          resumo_para_equipe: {
            type: 'string',
            description: 'Nota interna, que a família NÃO vê: o que ela quer e o que a equipe precisa responder, em uma ou duas frases.',
          },
        },
        required: ['motivo', 'para_familia', 'resumo_para_equipe'],
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
  const medico = s.quemAtende.replace(/^(o|a) /, '')
  return [
    `Você é o atendente virtual do consultório de ${medico}, gastroenterologista pediátrico, no WhatsApp. Fala com mães, pais e responsáveis.`,
    '',
    'Seu trabalho é entender o que a família quer e dar a resposta certa, como a secretária mais experiente do consultório daria.',
    '- Interprete. Erro de digitação, abreviação ("vcs", "qnto", "sp"), áudio transcrito, pergunta indireta: descubra a intenção. Se vierem várias perguntas, responda todas.',
    '- Junte as informações de <clinica>. A resposta certa muitas vezes combina partes diferentes: o valor da unidade, o que está incluído e como se paga; o que o médico trata e como marcar.',
    '- Use a <conversa>: o que já foi dito (unidade, criança, assunto) não se pergunta de novo.',
    '- Pergunta com mais de um sentido: responda o mais provável. Só pergunte de volta se não der mesmo para saber.',
    '- Tudo o que você afirma tem de estar em <clinica> ou no <contexto>. Sem a informação exata, mas com uma próxima que já ajuda, responda com ela: "aceita cartão?" se responde com como é o pagamento, dizendo só o que está escrito. Se nada em <clinica> ajudar, não invente (valor, horário, endereço, convênio, prazo, regra): diga que vai confirmar com a equipe e use chamar_equipe com motivo sem_informacao.',
    '- As respostas oficiais foram escritas para o robô antigo: use o conteúdo, mas ignore instruções como "digite 9" ou "digite 2". No lugar delas, ofereça você mesmo o próximo passo ("Quer que eu veja um horário?").',
    '- Responda o que foi perguntado, e não tudo o que sabe sobre o assunto. Regra ou restrição que a família não perguntou (parcelamento, por exemplo) fica de fora.',
    '- Quando fizer sentido, termine oferecendo o próximo passo: marcar, ver horários, mandar o endereço.',
    '- Despedida ou adiamento ("vou pensar", "depois vejo", "obrigada", "boa noite" no fim da conversa): responda só com uma despedida curta e calorosa. Não repita oferta nem lembrete que já está na conversa: quando a família voltar, o sistema retoma de onde parou.',
    '',
    'Como escrever:',
    '- Responda já na primeira frase. Nunca repita nem resuma a pergunta ("Você perguntou se..."). Cumprimente só no começo da conversa, não a cada mensagem.',
    '- Português do Brasil, acolhedor e natural, como no WhatsApp. De 1 a 4 frases. Pode usar *negrito*. Sem listas longas.',
    '- Nunca escreva menu numerado nem peça "responda com um número": o sistema tem o menu com botões (abrir_fluxo com menu).',
    '- Se a pessoa só cumprimentou ("oi", "olá", "bom dia") sem perguntar nada, use abrir_fluxo com menu e não escreva nada junto: o menu já cumprimenta.',
    `- Diga "gastroenterologista pediátrico"; nunca "especialista".`,
    '- Pronto-socorro e 192 só quando a criança parece mal agora, ou quando a família contou um sintoma e o consultório está fechado.',
    '- Horário da equipe só quando você estiver passando a conversa para ela.',
    '',
    'Ferramentas:',
    '- abrir_fluxo: marcar, remarcar, cancelar, ver a consulta, 2ª via. O sistema conduz com botões e faz o cadastro; antes, você pode responder em uma frase o que ela perguntou. Não peça CPF, e-mail nem dados da criança.',
    '- ver_horarios: para dizer quando tem vaga numa unidade, e para responder em que dias e horários o médico atende ("atende sábado?", "tem à noite?"): consulte a agenda das unidades em vez de chamar a equipe. Não prometa horário: quem reserva é o fluxo de agendamento.',
    '- chamar_equipe: só nas quatro situações abaixo, ou quando faltar a informação.',
    '',
    'É da equipe (use chamar_equipe: em para_familia, fale com a família, em uma frase, que a equipe responde por aqui; em resumo_para_equipe, escreva para a equipe o que precisa ser respondido):',
    '1. Conduta médica sobre esta criança: o que fazer com um sintoma, remédio, dose, o que significa um resultado de exame, se é grave, se ela precisa de tal exame ou tratamento.',
    '2. Documento assinado pelo médico: receita nova, pedido de exame novo sem consulta, atestado, relatório, declaração. (2ª via de algo já emitido: abrir_fluxo segunda_via.)',
    '3. Exceção às regras: encaixe fora da agenda, desconto, retorno fora do prazo, mudar valor.',
    '4. Dinheiro e conflito: estorno, cobrança contestada, reclamação.',
    'Se pedirem para falar com uma pessoa: se for uma dessas quatro, chame a equipe; se não, resolva você, e chame só se insistirem.',
    '',
    'Falar de sintoma não é pedir conduta. "Minha filha tem refluxo, ele trata?" pergunta sobre o serviço: responda (se a condição está em <clinica>) e ofereça marcar. Pergunta sobre o serviço é sua: se o médico pede exames, se atende tal idade ou tal problema, como é a consulta, consulta online, valor, convênio, reembolso, endereço, estacionamento. Nunca diga o que fazer com o sintoma nem cite remédio.',
    '"É refluxo?", "é normal?" de quem está procurando atendimento: diga que é exatamente o que o médico avalia na consulta e ofereça marcar, sem chamar a equipe. Chame a equipe quando pedirem o que fazer agora, quando for sobre resultado de exame ou tratamento que a criança já faz, ou quando parecer urgente.',
    '',
    'Exemplos do jeito de responder (os fatos valem sempre os de <clinica>):',
    `Família: "o doutor pode fazer exame para meu filho?"`,
    `Você: "Pode sim! Na consulta ${s.quemAtende} avalia e, se for preciso, já pede os exames, e eles podem ser feitos pelo convênio. Quer que eu veja um horário?"`,
    `Família: "vcs aceitam unimed?"`,
    `Você (se <clinica> diz que a consulta é particular): "A consulta é particular, mas emitimos recibo com CRM e CNPJ para você pedir reembolso à Unimed. E os exames que ${s.quemAtende} pedir podem ser feitos pelo plano."`,
    `Família: "minha filha tem 17 anos e vive com dor de barriga, ele atende?"`,
    `Você (se <clinica> diz que atende até 19 anos): "Atende sim! ${s.quemAtende.replace(/^./, (l) => l.toUpperCase())} acompanha até os 19 anos, e dor de barriga que volta é uma das coisas mais investigadas no consultório. Quer que eu veja um horário?"`,
    `Família: "meu filho ta com febre desde ontem, posso dar dipirona?"`,
    `Você: chamar_equipe com motivo medico, para_familia: "Sobre remédio, quem orienta é ${s.quemAtende}: já passei para a equipe, que responde por aqui. Se ele piorar, procure o pronto-socorro.", resumo_para_equipe: "Febre desde ontem; a mãe pergunta se pode dar dipirona."`,
    '',
    'Urgência: se a criança parece mal agora, oriente procurar o pronto-socorro mais próximo ou ligar 192, e use chamar_equipe com motivo urgencia.',
    'Se perguntarem, você é o assistente virtual do consultório, e a equipe acompanha as conversas.',
    emEtapa
      ? `\nA família está no passo "${s.etapa}" do sistema e o sistema não entendeu a última resposta dela. A última mensagem do consultório foi:\n«${semDadosPessoais(s.ultimaDoConsultorio ?? '').slice(0, 900)}»\nSe der para traduzir o que ela quis dizer numa opção, use responder_etapa. Se ela perguntou outra coisa, responda e lembre o passo em aberto, a não ser que ele já tenha sido lembrado na última mensagem do consultório. Se ela se despediu ou disse que vai pensar, só se despeça.`
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
    ...(relatoDeSintoma(s.texto)
      ? ['Atenção: a mensagem nova fala de sintoma ou remédio. Responda o que for do serviço; o que fazer com a criança é da equipe (chamar_equipe, medico).']
      : []),
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

/**
 * Relato de sintoma, e nao pergunta sobre exame ou receita (15/10/2026).
 *
 * No primeiro teste com a IA ligada, "o doutor pode fazer exame para meu
 * filho?" foi parar no robo: "exame" esta na lista clinica, e a familia ouviu
 * "nao posso orientar sobre exames" e, de noite, o aviso do pronto-socorro. Para
 * a IA, exame, receita, resultado e tratamento sao assunto de conversa - e ela
 * chama a equipe quando for conduta medica. Relato de sintoma (febre, dor,
 * vomito, remedio, dose) liga o aviso no contexto e a trava orientouConduta.
 */
export function relatoDeSintoma(texto: string): boolean {
  return assuntoClinico(texto.replace(/\b(exames?|resultados?|receitas?|tratamentos?)\b/gi, ' '))
}

/** O que fica com o robo mesmo com a IA ligada (ver o topo do arquivo). */
export function ficaComORobo(s: Situacao): string | null {
  if (s.equipeConversando) return 'equipe_conversando'
  if (s.anexo) return 'anexo'
  if (pediuUrgencia(s.texto)) return 'urgencia'
  if (respostaAutomaticaDaFamilia(s.texto)) return 'resposta_automatica'
  return null
}

const ATE = 4

/**
 * Primeiro teste real com familia (15/10/2026): para um "ola" o Claude escreveu
 * o proprio menu numerado, sem os botoes do sistema; para "o doutor pode fazer
 * exame?" comecou repetindo a pergunta ("Voce perguntou se...") e terminou
 * mandando procurar o pronto-socorro. A instrucao pede para nao fazer; estas
 * travas garantem, porque o modelo nem sempre obedece.
 */
export function menuEscritoAMao(t: string): boolean {
  const itens = t.split('\n').filter((l) => /^\s*[*_]*\s*(\d{1,2}\s*[).:\-–]|\d️?⃣)/.test(l)).length
  return itens >= 3 || /respond[ae]\s+com\s+(o\s+|um\s+)?n[uú]mero/i.test(t)
}

// "Dr." nao termina frase: sem isso o eco cortava em "Voce perguntou se o Dr."
// e deixava "Marcello pode pedir exame..." sozinho.
const ABREVIADO = String.raw`\b(?:Dr|Dra|Sr|Sra|Prof|Profa)\.`
const ECO = new RegExp(
  String.raw`^((?:oi|ol[aá]|bom dia|boa tarde|boa noite)[!,.]*\s*)?(?:voc[eê]\s+(?:me\s+)?pergunt(?:ou|a)|sua\s+pergunta\s+(?:[eé]|foi))(?:${ABREVIADO}|[^.!?\n])*[.!?]?\s*`,
  'i',
)
const FIM_DE_FRASE = /(?<!\b(?:Dr|Dra|Sr|Sra|Prof|Profa))(?<=[.!?])\s+/
const PRONTO_SOCORRO = /pronto[\s-]?socorro|\b192\b|\bsamu\b|\bupa\b/i
const FAMILIA_FALOU_DE_URGENCIA = /pronto[\s-]?socorro|\b192\b|\bsamu\b|\bupa\b|emerg[eê]ncia|urg[eê]n/i

/**
 * Tira as frases que o consultorio acabou de dizer (16/10/2026).
 *
 * Teste do Edu: "vou pensar" recebeu "Tudo bem, pode pensar com calma! Quando
 * decidir, e so me dizer se prefere Santos, Sao Paulo ou telemedicina...", e o
 * "boa noite" seguinte recebeu "Boa noite!" e o MESMO lembrete, um minuto
 * depois. A instrucao pede para so se despedir; aqui garante que frase ja dita
 * na ultima mensagem do consultorio nao sai de novo. Se sobrar nada, vale o
 * texto inteiro: repetir e melhor que ficar sem resposta.
 */
function palavrasDaFrase(frase: string): Set<string> {
  return new Set(
    frase
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 2),
  )
}

export function semRepetir(texto: string, anterior: string | null | undefined): string {
  if (!anterior?.trim()) return texto
  const ditas = anterior
    .split(/\n+/)
    .flatMap((linha) => linha.split(FIM_DE_FRASE))
    .map(palavrasDaFrase)
    .filter((p) => p.size >= 5)
  const repetida = (frase: string) => {
    const nova = palavrasDaFrase(frase)
    if (nova.size < 5) return false
    return ditas.some((velha) => {
      let comuns = 0
      for (const p of nova) if (velha.has(p)) comuns++
      return comuns / Math.max(nova.size, velha.size) >= 0.7
    })
  }
  const limpo = texto
    .split('\n')
    .map((linha) => linha.split(FIM_DE_FRASE).filter((frase) => !repetida(frase)).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return limpo || texto
}

/**
 * O texto "para a familia" foi escrito para a equipe? (16/10/2026)
 *
 * No primeiro dia ligado, a mae do Leon perguntou se podia pagar no dia e
 * recebeu, do proprio consultorio: "A familia do Leon (consulta sexta...)
 * pergunta se e possivel pagar presencialmente... Por favor, confirmem e
 * respondam por aqui." Era o recado para a equipe, e saiu para ela. Com dois
 * campos o modelo erra menos; esta trava pega o que ainda escapar: o texto vira
 * nota interna e a familia recebe a frase padrao.
 */
// "Toda a familia" e "atendemos a familia inteira" falam COM a mae: o que
// denuncia o recado e a familia como sujeito de um pedido, ou "familia do Leon".
const PARA_A_EQUIPE = [
  /\b(?:a|essa|esta)\s+fam[ií]lia\s+(?:pergunt|quer|pede|pediu|gostaria|precisa|solicit|est[aá]\s+pergunt)/i,
  /[Ff]am[ií]lia\s+d[aeo]\s+[A-ZÀ-Ý]/,
  /\b(?:confirmem|respondam|verifiquem|retornem|avisem|liguem|chequem)\b/i,
  /\bpor favor,?\s+(?:confirm|respond|verifi)/i,
  /\b(?:o|a)\s+(?:respons[aá]vel|m[aã]e|pai|paciente)\s+(?:pergunt|quer|pediu|pede|gostaria|precisa)/i,
]

export function falaComAEquipe(texto: string): boolean {
  return PARA_A_EQUIPE.some((r) => r.test(texto))
}

const AVISO_PADRAO = 'Vou confirmar isso com a equipe e te respondemos por aqui.'

/**
 * O Claude deu conduta numa mensagem com sintoma? (16/10/2026)
 *
 * A instrucao proibe, mas e a unica coisa que nao pode escapar: remedio, dose
 * e "faca isso" sao do medico. Lista grosseira de proposito - errar para o
 * lado de chamar a equipe custa uma espera; deixar passar custa uma crianca
 * medicada pelo WhatsApp.
 */
const CONDUTA = new RegExp(
  [
    String.raw`\b\d+([.,]\d+)?\s*(mg|ml|mcg|gotas?|comprimidos?|sach[eê]s?)\b`,
    String.raw`\bde\s+\d+\s+em\s+\d+\s*(h|horas)\b`,
    String.raw`\b(dose|posologia|dosagem)\b`,
    String.raw`\b(pode|podem|deve|devem)\s+(dar|tomar|oferecer|aplicar|suspender)\b`,
    String.raw`\b(d[eê]|ofere[cç]a|suspenda|aplique|use|tente)\s+(a\s+ele|a\s+ela|pra\s+ele|pra\s+ela|um|uma|o|a)?\s*(rem[eé]dio|xarope|soro|antit[eé]rmico|dipirona|paracetamol|ibuprofeno|omeprazol|simeticona|lactulose|probi[oó]tico|ch[aá])`,
    String.raw`\b(dipirona|paracetamol|ibuprofeno|omeprazol|domperidona|bromoprida|ondansetrona|simeticona|lactulose|macrogol|probi[oó]tico|buscopan|tylenol|novalgina|plasil|vonau)\b`,
  ].join('|'),
  'i',
)

export function orientouConduta(t: string): boolean {
  return CONDUTA.test(t)
}

export function limparTexto(t: string, manterProntoSocorro: boolean): string {
  let r = t.replace(ECO, '')
  // Pronto-socorro so quando o Claude tratou como urgencia ou a familia
  // tocou no assunto. Em duvida comum, a frase assusta a mae e nao ajuda.
  if (!manterProntoSocorro) {
    r = r
      .split('\n')
      .map((linha) => linha.split(FIM_DE_FRASE).filter((frase) => !PRONTO_SOCORRO.test(frase)).join(' '))
      .join('\n')
  }
  return r.replace(/\n{3,}/g, '\n\n').trim()
}

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
): Promise<{ resultado: Resultado; acao: string; nota?: string }> {
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
    const usos = blocos.filter((b): b is Extract<Bloco, { type: 'tool_use' }> => b.type === 'tool_use')
    const sintoma = relatoDeSintoma(s.texto)
    // Sintoma com o consultorio fechado: o pronto-socorro fica, como no robo
    // (fraseClinica). Em duvida comum, sai (ver limparTexto).
    const urgente =
      usos.some((u) => u.name === 'chamar_equipe' && u.input?.motivo === 'urgencia') ||
      FAMILIA_FALOU_DE_URGENCIA.test(s.texto) ||
      (sintoma && !dentroDoExpediente(s.agora))
    const bruto = blocos
      .filter((b): b is Extract<Bloco, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
      .slice(0, 1500)
    // Menu escrito a mao sai sem os botoes: vale o menu de verdade do sistema.
    if (!emEtapa && menuEscritoAMao(bruto) && !usos.some((u) => u.name === 'chamar_equipe')) {
      const menu = await ferramentas.robo(FLUXOS.menu.texto, FLUXOS.menu.etapa)
      if (menu) return { resultado: menu, acao: 'fluxo:menu' }
    }
    const ultimaNossa = [...s.historico].reverse().find((m) => m.de === 'consultorio')?.texto
    const texto = semRepetir(limparTexto(bruto, urgente), ultimaNossa)
    const pedidoAEquipe = usos.find((u) => u.name === 'chamar_equipe')?.input
    const avisoDaEquipe = pedidoAEquipe?.para_familia ?? pedidoAEquipe?.texto
    if (sintoma && (orientouConduta(bruto) || orientouConduta(String(avisoDaEquipe ?? '')))) {
      const fechado = !dentroDoExpediente(s.agora)
      const aviso =
        `Sobre o que fazer agora, quem orienta é ${s.quemAtende}: já passei para a equipe, que responde por aqui.` +
        (fechado ? ' Se a criança estiver mal, procure o pronto-socorro mais próximo ou ligue 192.' : '')
      return {
        resultado: await ferramentas.equipe('atendente', aviso),
        acao: 'equipe:medico (trava de conduta)',
        nota: '🤖 A IA ia orientar remédio ou dose numa mensagem com sintoma; a trava segurou e passou para a equipe.',
      }
    }
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
        const doRobo = await ferramentas.robo(fluxo.texto, fluxo.etapa)
        // O menu ja cumprimenta: o "Ola! Sou o assistente..." do Claude antes
        // dele saia como dois cumprimentos seguidos.
        if (final.input.fluxo === 'menu') return { resultado: doRobo ?? { resposta: texto || 'Certo!' }, acao: 'fluxo:menu' }
        return { resultado: juntar(doRobo), acao: `fluxo:${final.input.fluxo}` }
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
        // `texto` era o nome do campo ate 16/10/2026; continua valendo.
        const escrito = String(final.input?.para_familia ?? final.input?.texto ?? '')
        let resumo = String(final.input?.resumo_para_equipe ?? '').trim()
        let aviso = semRepetir(limparTexto(escrito, urgente), ultimaNossa) || texto || AVISO_PADRAO
        if (falaComAEquipe(aviso)) {
          console.warn('Atendente com IA escreveu para a equipe no texto da familia; vai como nota interna', aviso.slice(0, 200))
          resumo = [resumo, aviso].filter(Boolean).join('\n\n')
          aviso = AVISO_PADRAO
        }
        return {
          resultado: await ferramentas.equipe(MOTIVOS[motivo] ?? 'atendente', aviso.slice(0, 800)),
          acao: `equipe:${motivo}`,
          nota: resumo ? `🤖 Resumo da IA para a equipe: ${resumo}`.slice(0, 1500) : undefined,
        }
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
  /**
   * O robo registrou "nao entendi" nesta mensagem? A resposta dele nem sempre
   * comeca assim: o naoEntendi tambem devolve a frase clinica ou uma resposta
   * pronta, sempre com "responda com o numero" no fim. Ver roboRegistrou.
   */
  roboNaoEntendeuAgora?: () => boolean
  prazoMs?: number
}): Promise<Desfecho> {
  const naoEntendeu = (r: Resultado | null) => roboNaoEntendeu(r) || Boolean(opcoes.roboNaoEntendeuAgora?.())
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
    if (emEtapa && !naoEntendeu(resultado)) return { resultado, origem: 'robo', eventos: [] }
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
    if (!naoEntendeu(doRoboNaEtapa)) return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [] }
    try {
      const { resultado, acao, nota } = await conversarComClaude(situacao, ferramentas, chamar, modelo, true, prazo)
      return { resultado, origem: 'ia', eventos: [{ evento: 'ia_respondeu', detalhe: acao }], nota }
    } catch (erro) {
      console.warn('Atendente com IA falhou na etapa; vale o "nao entendi" do robo', erro)
      return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }] }
    }
  }

  try {
    const { resultado, acao, nota } = await conversarComClaude(situacao, ferramentas, chamar, modelo, false, prazo)
    return { resultado, origem: 'ia', eventos: [{ evento: 'ia_respondeu', detalhe: acao }], nota }
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
