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
 * conversando. Urgencia e a palavra ou um sinal de alarme (sinalDeAlarme, em
 * atendimento.ts, desde 17/10/2026); a que vem descrita de outro jeito o
 * Claude reconhece e chama a equipe com motivo urgencia. Sintoma ficava com o robo ate 16/10/2026, mas "minha filha tem
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
import { comOfertaDeHorario, conhecimentoDaClinica, contaPiora, horaEmNumeros, parecePergunta, pediuUrgencia, negouConsulta, respostaAutomaticaDaFamilia, semHoraDeLimite, sinalDeAlarme, soAgradecimento } from './atendimento.ts'
import { assuntoClinico } from './respostas.ts'
import { dentroDoExpediente } from './expediente.ts'

export type ModoDoAssistente = 'desligado' | 'sombra' | 'ligado'
// Sonnet desde 17/10/2026, pedido do Edu: o Haiku foi o teste. Conversa com mae
// preocupada pede nuance (acolher, levar para a consulta sem empurrar, notar
// urgencia descrita sem a palavra) e o Sonnet segue melhor as regras longas.
// Custa umas 3 vezes mais por mensagem; o cache do texto fixo (ver
// sistemaDoClaude) devolve boa parte. Se passar do prazo, o robo responde.
export const MODELO_PADRAO = 'claude-sonnet-5-5'

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
  /**
   * A conversa ja esta marcada como urgencia para a equipe (17/10/2026,
   * rodada 4 do painel): a febre do bebe de 7 semanas foi reconhecida pela IA,
   * e nao pela lista de sinais, e a pergunta seguinte ("posso dar dipirona?")
   * perdia o tom de urgencia. A etiqueta e o sinal mais firme que existe.
   */
  urgenciaAberta?: boolean
  /**
   * Onde a conversa acontece (16/10/2026). Sem o campo, WhatsApp, como sempre.
   * No Instagram nao ha agenda nem cadastro: os fluxos viram o link do WhatsApp.
   */
  canal?: 'WhatsApp' | 'Instagram'
}

export type Ferramentas = {
  /**
   * O robo, como se a familia tivesse escrito `texto`. 'atual' rele a etapa
   * no banco: e o passo seguinte de um fluxo que a IA acabou de abrir.
   */
  robo: (texto: string, etapa: 'mesma' | 'menu' | 'nenhuma' | 'atual') => Promise<Resultado | null>
  horarios: (unidade: string) => Promise<string>
  /**
   * manterEtapa (17/10/2026, painel com IA): a duvida no meio do cadastro ou da
   * lista de horarios vai para a equipe sem apagar o passo em aberto. Antes, a
   * pergunta "corto o leite?" no meio da ficha mandava a conversa para a fila e
   * o cadastro nunca terminava; o toque no horario seguinte caia no vazio.
   */
  equipe: (motivo: MotivoAtencao, texto: string, opcoes?: { manterEtapa?: boolean }) => Promise<Resultado>
  /** A etapa do robo agora. Sem ela (Instagram), o agendamento nao e adiantado. */
  etapa?: () => Promise<string | null>
}

type Bloco =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  // Com thinking between_tools, o Sonnet escreve entre uma ferramenta e outra
  // um bloco de pensamento, que volta como veio na volta seguinte.
  | { type: 'thinking'; thinking: string; signature?: string }

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

const FLUXOS: Record<string, { texto: string; etapa: 'menu' | 'nenhuma'; depois?: string }> = {
  agendar: { texto: 'quero marcar uma consulta', etapa: 'nenhuma' },
  minha_consulta: { texto: '4', etapa: 'menu' },
  // "Pode cancelar a consulta da Helena" (painel com IA, 17/10/2026) abria a
  // tela com Remarcar, Cancelar e Voltar: a mae repetia o que ja tinha pedido
  // e ainda confirmava. Agora o pedido vai junto e sobra a confirmacao, que
  // fica: cancelar e destrutivo e remarcar cancela a antiga no fim.
  remarcar: { texto: '4', etapa: 'menu', depois: 'remarcar' },
  cancelar: { texto: '4', etapa: 'menu', depois: 'cancelar' },
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
      description:
        'Consulta os dias e horários livres (só leitura, não reserva). Use antes de dizer quando tem vaga. ' +
        'Com unidade "todas", traz os próximos de cada unidade numa consulta só e diz qual é o mais próximo: use para "o mais rápido possível" e na urgência.',
      input_schema: {
        type: 'object',
        properties: { unidade: { type: 'string', description: 'Nome da unidade, como aparece em <clinica>, ou "todas".' } },
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
              'Tudo o que a família lê agora, falando COM ela ("você"): primeiro a resposta ao que você já sabe (valor, endereço, horários, como se paga), depois que a equipe responde o resto por aqui. ' +
              'É o único texto que chega a ela: o que ficar fora daqui ela não vê. Ex.: "A consulta em Santos é R$ 450,00 e o pagamento é pelo link da Livance. Sobre parcelar, vou confirmar com a equipe e te respondemos por aqui." ' +
              'Nunca fale da família em terceira pessoa nem peça nada à equipe aqui.',
          },
          resumo_para_equipe: {
            type: 'string',
            description: 'Nota interna, que a família NÃO vê: o que ela quer e o que a equipe precisa responder, em uma ou duas frases. Só o que está na conversa: pedido já atendido (troca já feita, horário já marcado) não entra, e não afirme falha do sistema que você não viu.',
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
        'equivalente, com o texto exato de uma opção (o número da lista, o dia como aparece, o horário como 14:00, PULAR...). ' +
        'Para trocar de unidade no meio do agendamento, mande o nome da unidade (ex.: São Paulo), nunca VOLTAR.',
      input_schema: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          dia: { type: 'string', description: 'Opcional: o dia que a família já disse junto ("segunda", "30/10"). O sistema segue direto para os horários dele.' },
          horario: { type: 'string', description: 'Opcional: o horário exato que a família já escolheu, como 15:10.' },
          para_familia: {
            type: 'string',
            description:
              'Opcional: uma frase curta para a família, falando com ela, que vai antes da tela seguinte. Use para responder uma pergunta que ela fez junto com a resposta do passo ("santos, mas ele atende 17 anos?"). O texto solto não chega a ela.',
          },
        },
        required: ['texto'],
      },
    })
  } else {
    lista.push({
      name: 'abrir_fluxo',
      description:
        'Abre um fluxo do sistema, que conduz a família com botões: agendar (marcar consulta ou retorno), ' +
        'remarcar e cancelar (a consulta que já existe: o sistema só pede a confirmação), ' +
        'minha_consulta (ver a consulta), segunda_via (receita ou pedido de exame já emitidos), menu.',
      input_schema: {
        type: 'object',
        properties: {
          fluxo: { type: 'string', enum: Object.keys(FLUXOS) },
          para_familia: {
            type: 'string',
            description:
              'Opcional: uma frase curta que a família lê antes da tela do sistema, falando com ela ("você"): a resposta a uma pergunta que ela fez, ou o valor e como se paga quando você passa o horário direto. ' +
              'É o único texto que acompanha o fluxo; nunca escreva o que você vai fazer nem fale da família em terceira pessoa.',
          },
          duvida_para_equipe: {
            type: 'string',
            description:
              'Opcional: a família quer marcar e, na mesma conversa, fez uma pergunta que é da equipe. Escreva aqui, para a equipe, o que ela precisa responder: ' +
              'o agendamento segue e a equipe responde a dúvida por aqui. Diga em para_familia que a dúvida foi passada.',
          },
          paciente: {
            type: 'string',
            // Rodada 10 (IA14): com "so as cadastradas", a IA nunca mandava o irmao
            // sem cadastro, e a consulta saia no nome da irma.
            description: 'Só no agendar: o primeiro nome da criança para quem é a consulta, sempre que a família disse, cadastrada ou não (irmão, outro filho).',
          },
          unidade: {
            type: 'string',
            description: 'No agendar e no remarcar: a unidade que a família já escolheu na conversa (como em <clinica>, ou "telemedicina"). O sistema abre direto nas datas dela.',
          },
          dia: {
            type: 'string',
            description: 'No agendar e no remarcar: o dia que a família já escolheu, como "sábado", "amanhã" ou "24/10". No agendar, passe sempre a unidade junto: sem ela o sistema pergunta a unidade e o dia se perde (se só uma unidade atende naquele dia, é ela). O sistema abre direto nos horários dele.',
          },
          horario: {
            type: 'string',
            description:
              'No agendar e no remarcar, junto com o dia: o horário exato que a família escolheu nesta conversa, como 15:10. ' +
              'O sistema guarda esse horário na hora, então só passe quando ela disse qual quer.',
          },
        },
        required: ['fluxo'],
      },
    })
  }
  return lista
}

function instrucoes(s: Situacao): string {
  const medico = s.quemAtende.replace(/^(o|a) /, '')
  return [
    `Você é o atendente virtual do consultório de ${medico}, gastroenterologista pediátrico, no ${s.canal ?? 'WhatsApp'}. Fala com mães, pais e responsáveis.`,
    ...(s.canal === 'Instagram'
      ? [
          'Você está no direct do Instagram. Aqui não há agenda nem cadastro: marcar, remarcar, cancelar, ver a consulta e 2ª via são pelo WhatsApp da clínica, e abrir_fluxo manda o link certo. Não peça telefone, CPF nem dados da criança.',
          'No Instagram, o próximo passo para marcar é o link do WhatsApp: ofereça "Quer o link para marcar pelo WhatsApp?", nunca "Quer que eu veja um horário?". Sem *negrito*: o direct vai em texto puro.',
        ]
      : []),
    '',
    'Seu trabalho é entender o que a família quer e dar a resposta certa, como a secretária mais experiente do consultório daria.',
    '- Interprete. Erro de digitação, abreviação ("vcs", "qnto", "sp"), áudio transcrito, pergunta indireta: descubra a intenção. Se vierem várias perguntas, responda todas.',
    '- Junte as informações de <clinica>. A resposta certa muitas vezes combina partes diferentes: o valor da unidade, o que está incluído e como se paga; o que o médico trata e como marcar.',
    '- Use a <conversa>: o que já foi dito (unidade, criança, assunto) não se pergunta de novo.',
    // Teste no Instagram (16/10/2026): "quanto custa a consulta?" pela segunda
    // vez recebeu so "Quer o link para marcar pelo WhatsApp?", sem o valor.
    '- Pergunta que a família repete, mesmo já respondida, se responde de novo, mais curto: ela pode não ter visto ou quer confirmar. Nunca responda uma pergunta só com uma oferta.',
    '- Pergunta com mais de um sentido: responda o mais provável. Só pergunte de volta se não der mesmo para saber.',
    '- Tudo o que você afirma tem de estar em <clinica> ou no <contexto>. Sem a informação exata, mas com uma próxima que já ajuda, responda com ela: "aceita cartão?" se responde com como é o pagamento, dizendo só o que está escrito. Se nada em <clinica> ajudar, não invente (valor, horário, endereço, convênio, prazo, regra): diga que vai confirmar com a equipe e use chamar_equipe com motivo sem_informacao.',
    '- As respostas oficiais foram escritas para o robô antigo: use o conteúdo, mas ignore instruções como "digite 9" ou "digite 2". No lugar delas, ofereça você mesmo o próximo passo ("Quer que eu veja um horário?").',
    '- Responda o que foi perguntado, e não tudo o que sabe sobre o assunto. Regra ou restrição que a família não perguntou (parcelamento, por exemplo) fica de fora.',
    // Conversa real de 18/10/2026: "Ele atende convenios?" recebeu, junto da
    // resposta, "Santos (R$ 450,00), Sao Paulo (R$ 600,00)". O Edu: valor so
    // quando perguntam.
    '- Valor da consulta só quando a família perguntar de valor, preço ou quanto custa. "Atende convênio?" se responde com o que <clinica> diz de convênio e reembolso, sem o valor.',
    '- Quando fizer sentido, termine oferecendo o próximo passo: marcar, ver horários, mandar o endereço.',
    '- Despedida ou adiamento ("vou pensar", "depois vejo", "obrigada", "boa noite" no fim da conversa): responda só com uma despedida curta e calorosa. Não repita oferta nem lembrete que já está na conversa: quando a família voltar, o sistema retoma de onde parou. A exceção é quem desiste por causa do convênio (abaixo).',
    // Real 19/10/2026: "infelizmente nao consigo, pensei que atendesse plano de
    // saude, mesmo assim agradeco a atencao" - mae que veio do anuncio do
    // Instagram. Ela nao disse "nao quero": disse "achei que era pelo plano".
    // O Edu aprovou a resposta que mostra o reembolso e deixa a porta aberta.
    '- Desistência por causa do convênio ou do plano ("pensei que atendesse plano", "só consigo pelo convênio", "não tenho como pagar particular"): a despedida leva, uma vez só e sem insistir, o que <clinica> diz de recibo para reembolso; a sugestão de ela ligar no plano e perguntar quanto eles reembolsam dessa consulta (o valor depende do plano: não prometa quanto); o Instagram do consultório, se estiver em <clinica>, para acompanhar as orientações; e que é só chamar por aqui se fizer sentido depois. Agradeça; não pergunte se quer marcar nem ofereça horário.',
    '',
    'Como escrever:',
    '- Responda já na primeira frase. Nunca repita nem resuma a pergunta ("Você perguntou se..."). Cumprimente só no começo da conversa, não a cada mensagem.',
    '- Todo texto que você escreve, inclusive junto de uma ferramenta, vai para a família. Fale com ela ("você"), nunca sobre ela ("a família aceitou", "a mãe quer"), e não explique o que vai fazer ("então abro o agendamento"). Junto de abrir_fluxo, o que ela lê vai em para_familia, no máximo uma frase curta. Se a mensagem dela traz uma pergunta ("ele atende 17 anos?"), a resposta em para_familia é obrigatória; sem pergunta, pode ficar vazio, porque a tela do sistema já explica.',
    `- Português do Brasil, acolhedor e natural, como no ${s.canal ?? 'WhatsApp'}. De 1 a 4 frases.${s.canal === 'Instagram' ? '' : ' Pode usar *negrito*.'} Sem listas longas.`,
    '- Nunca escreva menu numerado nem peça "responda com um número": o sistema tem o menu com botões (abrir_fluxo com menu).',
    '- Se a pessoa só cumprimentou ("oi", "olá", "bom dia") sem perguntar nada, use abrir_fluxo com menu e não escreva nada junto: o menu já cumprimenta.',
    `- Diga "gastroenterologista pediátrico"; nunca "especialista".`,
    '- Pronto-socorro e 192 só quando a criança parece mal agora, ou quando a família contou um sintoma e o consultório está fechado.',
    // Rodada 7 (IA05-v1): "vou levar ele agora. mas deixa marcado o das 15h"
    // ouviu "nao consigo deixar reservado", uma regra que nao existe.
    '- Ir ao pronto-socorro não impede marcar: se a família pedir para deixar uma consulta marcada, abra o agendamento normalmente.',
    // Painel com IA (17/10/2026): "a equipe responde hoje ate as 18h" em seis
    // conversas, "deixo um horario separado", "reembolso ao seu plano" para quem
    // nao falou de plano, "sim, o ultrassom o plano cobre".
    // Rodada 5 (IA22): a IA escreveu "responde por aqui, sem prometer prazo",
    // copiando a regra, e repetiu o horario da equipe em 4 de 5 respostas.
    '- Horário da equipe: uma vez na conversa, quando você passar a conversa para ela: "a equipe atende de segunda a sexta, das 8h às 18h, e responde por aqui". Nada de "responde hoje" ou "em instantes", e não escreva para a família as regras que você segue. Diga que avisou alguém só se você chamou a equipe nesta resposta; se já tinha chamado antes, diga que a equipe já está com a mensagem.',
    '- Nada de reserva provisória: o sistema não "separa" nem "segura" horário. Quem marca e quer desistir depois cancela por aqui.',
    '- Não prometa o que nenhuma ferramenta faz: anotar, lembrar, avisar quando abrir vaga, mandar algo depois. Se a equipe precisa confirmar alguma coisa, use chamar_equipe; escrever "vale confirmar com a equipe" sem a ferramenta deixa a família sem resposta.',
    '- Não comece com "Sim", "Isso" ou "Não" quando você não tem a informação: diga o que sabe e que a equipe confirma o resto.',
    // Rodada 9 (IA11-v1): "Isso, o pagamento por pix e feito antes da consulta" -
    // <clinica> so dizia "pix".
    '- Pagamento: diga só o que está em <clinica> (forma, link). Quando pagar, para qual chave e se dá para pagar no dia, se não estiver escrito, é da equipe (chamar_equipe).',
    '- Não suponha o que a família não disse: plano de saúde ("se vocês tiverem plano, damos recibo para reembolso"), idade, quem é a criança. Exame pelo plano é "conforme a cobertura do seu plano", nunca um sim para um exame específico.',
    '- Oferta de marcar uma vez só: se a sua última mensagem já ofereceu e a família seguiu com outra dúvida, responda só a dúvida.',
    '- Paciente adolescente: fale "seu filho", "sua filha" ou o nome, não "a criança".',
    // Real 20/10/2026: o Edgar respondeu o lembrete com "Confirma", o sistema nao
    // reconheceu e a IA escreveu "Presenca confirmada!" - a agenda seguiu "sem
    // resposta". Confirmar presenca e do lembrete, nao da IA.
    '- Você não confirma presença em consulta: nunca escreva "presença confirmada", "consulta confirmada" nem "confirmei". Se a família disser que vai à consulta, agradeça e peça para tocar em *Confirmar presença* no lembrete que ela recebeu (ou responder CONFIRMAR), que é o que registra na agenda.',
    // Real 19/10/2026: avo de Osasco, neta de 5 anos, veio do Google. A IA
    // escolheu Sao Paulo sozinha e abriu as datas; a telemedicina so apareceu
    // de passagem na segunda resposta. O Edu: quem mora longe e cliente que se
    // perde - a telemedicina tem de ser oferecida de verdade.
    '- Família que mora longe das unidades (diz a cidade ou o bairro e fica a mais de uns 40 minutos da unidade mais próxima: outra cidade da região, interior, outro estado): se <clinica> tem telemedicina, antes de abrir as datas de uma unidade ofereça as duas opções e deixe a família escolher: a presencial na unidade mais próxima (diga qual) e a telemedicina, com o que <clinica> diz dela (por vídeo, sem deslocamento, valor e retorno presencial). Não escolha por ela nem abra as datas sozinha. Quem mora perto de uma unidade segue com ela, sem empurrar a telemedicina.',
    '- Agenda: diga os dias e horários como estão em <clinica> ou em ver_horarios, sem "alguns" ou "às vezes" que não estejam escritos. A família fala a hora como fala no dia a dia: "19 e 20" e "sete e vinte da noite" são 19:20, "4 e 40" à tarde é 16:40, "7 da noite" é 19:00. Hora que não existe: diga os dois horários mais perto, sem escolher um por ela e sem dizer que deixou algum selecionado. Pergunta sobre um dia da semana ("atende sábado?") se responde olhando todas as unidades (ver_horarios "todas"), mesmo quando a família diz onde mora: nunca diga só "em Santos não tem" sem dizer onde tem.',
    '',
    'Ferramentas:',
    '- abrir_fluxo: marcar, remarcar, cancelar, ver a consulta, 2ª via. O sistema conduz com botões e faz o cadastro; em para_familia, você pode responder em uma frase o que ela perguntou. Não peça CPF, e-mail nem dados da criança.',
    // 17/10/2026, teste do Edu: depois de "Atende sim, aos sabados em Sao Paulo...
    // Quer que eu siga com o agendamento?", o "sim" recomecava em "Em qual
    // unidade?" - a mae escolhia tudo de novo, e e ai que se desiste.
    // Rodada 7 (IA19-v1): "quanto e a consulta e tem como parcelar, o dinheiro
    // ta curto" recebeu a lista de unidades, sem a mae pedir para marcar.
    '- Perguntar valor, parcelamento ou se o médico atende não é pedir para marcar: responda e ofereça. Abra o agendamento quando ela pedir ou aceitar.',
    '- Quando a família aceitar marcar ("sim", "pode ser", "quero", "esse horário"), abra o agendamento na hora com abrir_fluxo agendar, sem perguntar de novo o que ela já disse. Se a conversa já definiu a unidade, passe unidade; se definiu também o dia, passe dia, sempre com a unidade (se só uma unidade atende naquele dia, como o sábado, a unidade é ela); se ela já escolheu o horário exato ("pode ser às 15:10", "quero o das 9:20"), passe horario, e o sistema guarda esse horário na hora. Para quem é: sempre que a família disser o nome, passe paciente, inclusive de uma criança sem cadastro (irmão, outro filho): o sistema abre para "Outra criança". Com mais de uma criança e sem saber para qual, pergunte para qual criança antes de abrir o agendamento, guardando a unidade, o dia e o horário que ela já disse: ao abrir, passe tudo junto.',
    '- Com abrir_fluxo, o que a família lê junto vai em para_familia (o texto solto não chega a ela). Quando você passar o horário direto para uma família sem consulta anterior, diga ali o valor e como se paga naquela unidade (de <clinica>): ela não passa pela tela das datas, que é onde o valor aparece.',
    '- Quando a família quer marcar e ainda faz uma pergunta que é da equipe ("o retorno pode ser online?", "parcela?"), o agendamento vem primeiro: abrir_fluxo agendar (com unidade e dia, se ela já disse), com a dúvida em duvida_para_equipe. Nunca troque o agendamento pela chamada da equipe.',
    // Rodada 6 (IA24): "troque o horario para as 18:20" virou chamada da equipe
    // com "agora vou abrir a troca do horario", sem abrir nada.
    '- Trocar o dia ou o horário de uma consulta já marcada é abrir_fluxo remarcar, com dia e horario. Nunca chame a equipe para isso, e nunca escreva que vai abrir algo sem usar a ferramenta.',
    '- Remarcar ou cancelar a consulta que já existe: abrir_fluxo remarcar ou cancelar. Cancelar pede só a confirmação. Remarcar abre direto nas datas da mesma unidade: passe o dia que a família quer (e a unidade, se ela quer trocar), e o sistema abre nos horários dele. minha_consulta é para quem quer só ver.',
    // Rodada 9 (IA20-v1): "no feriado de Finados tem consulta?" ouviu duas vezes
    // que nao havia horario em 02/11, e Sao Paulo tinha 7.
    '- Feriado: o consultório não informou como funciona. Use chamar_equipe (sem_informacao); não conclua pela lista de ver_horarios "todas", que mostra só uma parte da agenda.',
    '- ver_horarios: para dizer quando tem vaga numa unidade, e para responder em que dias e horários o médico atende ("atende sábado?", "tem à noite?"): consulte a agenda das unidades em vez de chamar a equipe. Para "o mais rápido possível" e na urgência, use unidade "todas", numa consulta só. Não prometa horário: quem reserva é o fluxo de agendamento.',
    // Rodada 7 (IA23-v1 e o cumprimento perdido): a resposta da noite e o "boa
    // tarde" ficavam no texto da primeira volta, que nao vai.
    '- O texto escrito junto de ver_horarios não chega à família. A resposta que vem depois dos horários é a que ela lê: inclua ali o cumprimento (se for o começo da conversa) e a resposta a todas as perguntas da mensagem, inclusive em para_familia se chamar a equipe.',
    '- chamar_equipe: só nas quatro situações abaixo, ou quando faltar a informação.',
    '',
    // Rodada 5 do painel (IA18): "quanto custa e parcela?" - o valor ficou no
    // texto solto, que nao vai, e a mae teve de perguntar de novo.
    'É da equipe (use chamar_equipe: em para_familia vai tudo o que a família lê, a resposta ao que você já sabe e, em uma frase, que a equipe responde o resto por aqui; em resumo_para_equipe, escreva para a equipe o que precisa ser respondido):',
    '1. Conduta médica sobre esta criança: o que fazer com um sintoma, remédio, dose, o que significa um resultado de exame, se é grave, se ela precisa de tal exame ou tratamento.',
    '2. Documento assinado pelo médico: receita nova, pedido de exame novo sem consulta, atestado, relatório, declaração. (2ª via de algo já emitido: abrir_fluxo segunda_via.)',
    '3. Exceção às regras: encaixe fora da agenda, desconto, retorno fora do prazo (salvo o retorno que espera o exame, abaixo), mudar valor.',
    '4. Dinheiro e conflito: estorno, cobrança contestada, reclamação.',
    'Se pedirem para falar com uma pessoa: se for uma dessas quatro, chame a equipe; se não, resolva você, e chame só se insistirem.',
    // Pedido do Dr. Marcello (20/10/2026): uma consulta era dia 23 e o exame
    // so ficava pronto dia 27. Retorno que passa dos 30 dias esperando o
    // resultado ele aceita; a equipe so entra quando o atraso parece demora da
    // familia ou o caso e complexo.
    '- Retorno depois dos 30 dias porque o exame pedido na consulta só fica pronto depois (a consulta foi dia 23 e o resultado sai dia 27, por exemplo): o médico aceita como retorno. Não é exceção e não chame a equipe: diga que pode marcar o retorno para quando o resultado estiver pronto e abra o agendamento. Chame a equipe (excecao), para o médico avaliar, só se o resultado sai muito depois do prazo (semanas ou meses, como se o exame tivesse demorado a ser feito), se o exame é complexo e o prazo não está claro, ou se tiver dúvida.',
    '',
    'Falar de sintoma não é pedir conduta. "Minha filha tem refluxo, ele trata?" pergunta sobre o serviço: responda (se a condição está em <clinica>) e ofereça marcar. Pergunta sobre o serviço é sua: se o médico pede exames, se atende tal idade ou tal problema, como é a consulta, consulta online, valor, convênio, reembolso, endereço, estacionamento. Nunca diga o que fazer com o sintoma nem cite remédio. O que NÃO fazer também é conduta ("não dê nada", "não dê o remédio", "espere"): nunca escreva.',
    '"É refluxo?", "é normal?" de quem está procurando atendimento: diga que é exatamente o que o médico avalia na consulta e ofereça marcar, sem chamar a equipe. Chame a equipe quando pedirem o que fazer agora, quando for sobre resultado de exame ou tratamento que a criança já faz, ou quando parecer urgente.',
    '',
    // Pedido do Edu (17/10/2026): interpretar e levar para a consulta quem
    // conta uma preocupacao, sem empurrar. CFM 2.336/2023 proibe
    // sensacionalismo e promessa de resultado; e mae pressionada vai embora.
    'Quando a família conta uma preocupação com a saúde da criança e não é urgência, o seu papel é ajudá-la a chegar à consulta:',
    '- Acolha em poucas palavras ("Entendo a preocupação"), sem dizer o que é nem se é grave.',
    '- Diga em uma frase por que vale a avaliação: é exatamente o que o médico investiga na consulta.',
    `- Ofereça marcar de forma concreta: ${s.canal === 'Instagram' ? 'o link para marcar pelo WhatsApp' : 'veja com ver_horarios e ofereça os próximos dois ou três horários, ou abra o agendamento'}.`,
    '- Se ela hesitar com uma dúvida ("será que precisa?", "é caro", "não tenho convênio"), responda a dúvida com o que está em <clinica> (como é a consulta, reembolso, telemedicina) e deixe a porta aberta. Uma vez só: se ela disser que não, que vai pensar ou se despedir, respeite e só se despeça.',
    '- Nunca assuste, nunca prometa resultado e nunca pressione ("últimas vagas", "não deixe para depois").',
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
    `Família: "moro em Osasco"`,
    `Você (se <clinica> tem telemedicina, com os fatos de <clinica>): "De Osasco, a unidade mais perto é a de São Paulo, na Vila Clementino. Outra opção que facilita para quem mora mais longe é a telemedicina: a consulta com ${s.quemAtende} é por vídeo, sem precisar se deslocar, e inclui um retorno presencial se for preciso examinar. Prefere presencial em São Paulo ou por vídeo?"`,
    `Família: "infelizmente não consigo, pensei que atendesse plano de saúde. Mesmo assim agradeço a atenção"`,
    `Você (se <clinica> fala de recibo para reembolso e tem o Instagram): "Imagina, obrigada por nos responder! 💙 Só para você saber: mesmo sem atender pelo convênio, emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano. Vale ligar no plano e perguntar quanto eles reembolsam dessa consulta. Se fizer sentido depois, é só chamar aqui que a gente vê um horário. E se quiser, acompanhe ${s.quemAtende} no Instagram (@perfil), com orientações para os pais. Um abraço!"`,
    '',
    // Os sinais com palavra certa o robo ja pega antes (sinalDeAlarme); estes
    // cobrem o que chega descrito de outro jeito. Chamar a equipe com urgencia
    // dispara o alerta no WhatsApp pessoal do medico, a qualquer hora. Dois
    // niveis (17/10/2026): o Dr. Marcello e clinico, nao cirurgiao - a urgencia
    // do consultorio e quase sempre "ele precisa ver logo", nao pronto-socorro.
    `Urgência tem dois níveis, e nos dois use chamar_equipe com motivo urgencia (isso avisa ${s.quemAtende} no WhatsApp dele, a qualquer hora):`,
    '- Risco de vida (vômito com sangue ou verde, muito sangue, engoliu pilha, bateria, ímã, moeda ou produto de limpeza, falta de ar ou lábios roxos, convulsão, não acorda ou desmaiou): em para_familia, a primeira frase manda procurar o pronto-socorro mais próximo ou ligar 192 agora.',
    // "Piorou" saiu desta lista (rodada 10, IA05-v2): ela mandava confirmar a
    // consulta, e venceu a regra da piora logo abaixo (pronto-socorro agora).
    `- Urgente sem risco de vida (não para de vomitar, não faz xixi há muitas horas, muito molinha, dor forte, febre em bebê com menos de 3 meses, ou a família diz que é urgente): acolha, diga que ${s.quemAtende} foi avisado e vai avaliar, e ofereça o horário mais próximo (${s.canal === 'Instagram' ? 'pelo link do WhatsApp' : 'veja com ver_horarios "todas" antes, inclusive hoje'}). O pronto-socorro só aparece no fim, como "se for uma emergência com risco de vida", e uma vez na conversa: não repita a cada mensagem. Se a família já tem consulta marcada para hoje ou amanhã, não ofereça outra: confirme a que ela tem.`,
    '- Se na mesma mensagem ela pergunta de remédio, diga que remédio e dose quem orienta é o médico, sem citar o nome do remédio.',
    // Rodada 6 (IA04): "se piorar de madrugada, escreva por aqui" e, as 3h, a
    // piora recebeu "ja avisei" sem alerta novo.
    // Rodada 8: com "isso reavisa o medico" a IA chamava a urgencia a cada
    // mensagem, e o medico recebeu 4 a 6 alertas na mesma noite sem nada novo.
    '- Se a família conta que piorou, ou um sinal novo, numa urgência que você já passou ao médico, chame a equipe com urgência de novo e diga para não esperar: pronto-socorro agora ou 192. Só a piora contada reavisa o médico: sem piora, diga que ele já foi avisado, sem dizer que avisou de novo. Fora do horário da equipe, nunca diga "se piorar, escreva por aqui": diga que, se piorar, é pronto-socorro. Pergunta hipotética ("e se vier mais sangue, faço o quê?") não é piora: responda que, se acontecer, é pronto-socorro, sem chamar a equipe como urgência.',
    '- Na urgência, veja os horários antes (ver_horarios "todas") e só depois chame a equipe, já com o horário mais próximo, dia e unidade, em para_familia. Não prometa "vou ver o horário" sem trazer o horário. Se você já avisou o médico nesta conversa, diga que ele já foi avisado, não que avisou "de novo".',
    '- "Urgente" sobre papel (relatório, atestado, receita, escola cobrando) não é urgência de saúde: é documento (chamar_equipe documento), dizendo que a equipe já sabe que ela precisa logo, sem garantir prazo.',
    'Se perguntarem, você é o assistente virtual do consultório, e a equipe acompanha as conversas.',
    // Rodada 8 (IA15-v2): a IA disse que "[e-mail]" parecia "um espaco
    // reservado" e pediu de novo um e-mail que a mae tinha mandado.
    '- Na conversa, [cpf], [e-mail] e [telefone] são dados que a família mandou de verdade, escondidos de você por privacidade: trate como recebidos, nunca como erro de envio.',
    '',
    `<clinica>\n${s.conhecimento}\n</clinica>`,
  ].join('\n')
}

/** O passo do sistema em que a familia esta: muda a cada mensagem, fica fora do cache. */
function instrucoesDaEtapa(s: Situacao): string {
  return `A família está no passo "${s.etapa}" do sistema e o sistema não entendeu a última resposta dela. A última mensagem do consultório foi:\n«${semDadosPessoais(s.ultimaDoConsultorio ?? '').slice(0, 900)}»\nSe der para traduzir o que ela quis dizer numa opção, use responder_etapa. No agendamento (unidade, dia, horário), se ela trocou de unidade, mande o nome da nova unidade em responder_etapa (com o dia e o horário, se ela disse), nunca VOLTAR. Na ficha do paciente (nome, nascimento, responsável, CPF, e-mail), responder_etapa leva só o que ela escreveu para aquela pergunta, e PULAR só se ela disse que não tem ou não sabe. Pedido de outro horário no meio da ficha: use responder_etapa com horario (e dia, se ela disse), e o sistema troca na hora; em texto, leve só o que ela escreveu para a pergunta do passo, ou deixe vazio. Se ela não disse a hora, pergunte para qual horário. Nunca escreva que vai pedir ou fazer a troca, nunca prometa trocar "depois da ficha" e nunca mande o pedido no lugar do nome. Se ela respondeu o passo e também perguntou algo ("santos, mas ele atende 17 anos?"), use responder_etapa com o passo e responda a pergunta em para_familia. Se ela perguntou outra coisa, responda e lembre o passo em aberto, a não ser que ele já tenha sido lembrado na última mensagem do consultório; se a dúvida for da equipe, chame a equipe: o passo continua aberto e ela segue depois. Se ela se despediu ou disse que vai pensar, só se despeça.`
}

/**
 * As instrucoes em blocos, com o texto fixo marcado para cache (17/10/2026).
 *
 * Instrucoes e <clinica> passam de alguns milhares de tokens e vao iguais em
 * toda mensagem da clinica: com o cache a Anthropic cobra cerca de um decimo
 * na releitura, dentro de 5 minutos. A familia escreve em rajadas e a volta
 * do ver_horarios rele tudo, entao o cache paga a troca do Haiku pelo Sonnet.
 * O que muda a cada mensagem (o passo em aberto) vai depois, num bloco sem
 * cache: qualquer caractere diferente no prefixo perderia o cache inteiro.
 */
export function sistemaDoClaude(s: Situacao, emEtapa: boolean): Record<string, unknown>[] {
  const blocos: Record<string, unknown>[] = [{ type: 'text', text: instrucoes(s), cache_control: { type: 'ephemeral' } }]
  if (emEtapa) blocos.push({ type: 'text', text: instrucoesDaEtapa(s) })
  return blocos
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
      ? ['Atenção: a mensagem nova fala de sintoma ou remédio. O que fazer com a criança é da equipe (chamar_equipe, medico); se ela conta o sintoma procurando atendimento, acolha e ofereça a consulta; se parecer urgente, motivo urgencia.']
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

/**
 * "Urgente" sem sintoma numa conversa sobre papel (relatorio, atestado,
 * receita, escola). O pedido pode ter vindo na mensagem anterior: "mas e
 * urgente mesmo, a excursao e sexta" nao fala do relatorio, e mandou alerta ao
 * WhatsApp do medico (rodada 7 do painel).
 */
const PAPEL = /\b(relat[oó]rio|atestado|receita|laudo|declara[cç][aã]o|documento|papel|escola|creche|excurs[aã]o|formul[aá]rio)\b/i
const SINTOMA = /\b(febre|dor|doendo|vomit\w*|sangue|diarreia|passando mal|piorou|desmai\w*|convuls\w*|falta de ar|molinh\w*)\b/i
function urgenciaDePapel(s: Situacao): boolean {
  const recentes = [...s.historico.filter((m) => m.de === 'familia').slice(-4).map((m) => m.texto), s.texto]
  // Sintoma em qualquer mensagem recente desfaz o papel: "ela vomitou na
  // escola" e depois "e urgente" e saude, mesmo com "escola" no meio.
  if (recentes.some((t) => SINTOMA.test(t) || sinalDeAlarme(t))) return false
  return recentes.some((t) => PAPEL.test(t))
}

/** O que fica com o robo mesmo com a IA ligada (ver o topo do arquivo). */
export function ficaComORobo(s: Situacao): string | null {
  if (s.equipeConversando) return 'equipe_conversando'
  // A urgencia vem antes do anexo (rodada 7 do painel, critica): a foto com a
  // legenda "olha o vomito dela, saiu com sangue" recebia o texto padrao do
  // anexo, sem pronto-socorro e sem alerta.
  if (sinalDeAlarme(s.texto)) return 'urgencia'
  // "Urgente" de um papel pedido antes (relatorio para a escola) nao e
  // urgencia de saude: fica com a IA (rodada 7, IA22: alerta falso ao medico).
  if (pediuUrgencia(s.texto) && !urgenciaDePapel(s)) return 'urgencia'
  if (s.anexo) return 'anexo'
  if (respostaAutomaticaDaFamilia(s.texto)) return 'resposta_automatica'
  // "Eu nao passei em consulta" (23/10/2026, Kadu): a IA leu como pedido de
  // marcar e ofereceu horario e preco. O robo pede desculpas e chama a equipe.
  if (negouConsulta(s.texto)) return 'negou_consulta'
  return null
}

/**
 * A familia so fechou a conversa: emoji, risada, "perfeito", "ok, obrigada"
 * (23/10/2026). Com a Vania o atendente com IA respondeu o 🥰 e depois o
 * "Perfeito", cada um com uma frase nova de "quando quiser, e so chamar" - a
 * conversa ja tinha terminado e o Edu achou o robo chato. So vale quando a
 * nossa ultima mensagem NAO perguntou nada: depois de "quer que eu veja os
 * horarios?", "perfeito" e um sim, e a IA precisa seguir.
 */
export function soFechamento(texto: string): boolean {
  const t = texto.trim()
  if (!t) return false
  // So emoji, coracao, pontuacao: nenhuma letra nem numero.
  if (!/[\p{L}\p{N}]/u.test(t)) return true
  const sem = semAcento(t).toLowerCase().replace(/[^a-z]/g, '')
  if (/^(k{3,}|(ha){2,}h?|(rs){1,}|(he){2,})$/.test(sem)) return true
  return soAgradecimento(t)
}

export function fechouSemPergunta(s: Situacao): boolean {
  if (!s.ultimaDoConsultorio || s.ultimaDoConsultorio.includes('?')) return false
  return soFechamento(s.texto)
}

const ATE = 4

/**
 * "Falar com a equipe" sem dizer o assunto (20/10/2026).
 *
 * O toque no menu ia direto para a fila da equipe e para os celulares do
 * alerta, e muitas vezes era para perguntar o valor ou o endereco. O Edu: "tem
 * que esperar ver qual vai ser a manifestacao primeiro e ver se voce nao vai
 * conseguir resolver; se nao conseguir, voce envia". Agora o pedido sem assunto
 * ouve esta pergunta, e a mensagem seguinte vai para a IA, que resolve ou chama
 * a equipe com o assunto ja dito. Pedir de novo, logo depois desta pergunta, e
 * insistir: ai vai direto para a equipe.
 */
export const ESPERA_DO_ASSUNTO =
  'Claro! Me conta aqui o que você precisa. Se eu conseguir resolver, já te respondo na hora; ' +
  'se for algo que precisa da equipe, eu passo para ela, que responde por aqui.'
const TRECHO_DA_ESPERA = 'Se eu conseguir resolver, já te respondo na hora'

const SO_PEDIU_A_EQUIPE =
  /^(?:atendente|secretaria|equipe|ajuda|(?:quero |queria |preciso |gostaria de )?falar com (?:a |o |uma |um |alguem da |alguem |algum )?(?:equipe|atendente|secretaria|alguem|pessoa|humano)(?: da equipe| da clinica| do consultorio)?)[.!]*$/

export const EQUIPE_DEPOIS_DA_ESPERA = 'Combinado! Já passei sua conversa para a equipe, que responde por aqui.'

/**
 * 'esperar': pediu a equipe sem assunto, e ouve ESPERA_DO_ASSUNTO.
 * 'equipe': pediu de novo logo depois dessa pergunta - insistiu, vai a equipe.
 * null: nao e pedido de equipe sem assunto (ou a equipe ja esta na conversa).
 */
export function esperarOAssunto(p: {
  texto: string
  /** Texto do item tocado, quando a familia tocou numa lista ou botao. */
  titulo?: string | null
  etapa: string | null
  ultimaDoConsultorio: string | null
  equipeConversando: boolean
}): 'esperar' | 'equipe' | null {
  if (p.equipeConversando || p.etapa === 'atendente') return null
  const ultima = semAcento(p.ultimaDoConsultorio ?? '')
  if (!soPediuAEquipe(p.texto, p.titulo, ultima)) return null
  return ultima.includes(semAcento(TRECHO_DA_ESPERA)) ? 'equipe' : 'esperar'
}

function soPediuAEquipe(texto: string, tituloDoToque: string | null | undefined, ultima: string): boolean {
  const t = semAcento(texto).trim()
  const titulo = semAcento(tituloDoToque ?? '').trim()
  if (SO_PEDIU_A_EQUIPE.test(t) || SO_PEDIU_A_EQUIPE.test(titulo)) return true
  // O 9 chama a equipe em qualquer etapa (ver pediuAtendente). Outro numero so
  // quando a nossa ultima mensagem o oferecia para isso ("*3* Falar com alguem
  // da equipe", no menu).
  if (t === '9') return true
  const numero = /^(\d)$/.exec(t)?.[1]
  return Boolean(numero && new RegExp(String.raw`\*${numero}\*[^\n]*falar com`).test(ultima))
}

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
// O ponto entra no lookbehind (rodada 5 do painel): sem ele "O Dr. Marcello"
// era partido em duas frases, e o corte de repeticao deixou "Imagina! O Dr."
// sozinho para a familia.
// "R." e "Av." tambem nao (rodada 10, IA23-v2: o endereco partiu em "R." e o
// comeco da frase sumiu: "Agostinho Rodrigues Filho, 550...").
const FIM_DE_FRASE = /(?<!\b(?:Dr|Dra|Sr|Sra|Prof|Profa|R|Av|Al|Ed)\.)(?<=[.!?])\s+/
// "Hospital" conta (rodada 5): "leve agora ao hospital" ganhava, colado, o
// condicional "Se for uma emergencia com risco de vida...", mais fraco.
const PRONTO_SOCORRO = /pronto[\s-]?socorro|\b192\b|\bsamu\b|\bupa\b|\bhospital\b/i
/**
 * O horario que a IA passou so vale se foi a familia que escolheu (rodada 3 do
 * painel, IA03-v1): a mae tocou "Marcar uma consulta" e a IA ja mandou as 15:00,
 * que ficaram guardadas sem ninguem escolher. Vale quando a mensagem da familia
 * diz a hora ("pode ser as 15h", "15:10"), ou quando ela disse sim a uma
 * mensagem nossa que oferecia aquele horario e nenhum outro. Fora disso, o
 * sistema para na lista de horarios do dia e ela toca.
 */
function horasDitas(texto: string): { hora: number; minuto: number | null }[] {
  // "depois das 17h" e limite, nao escolha (rodada 6; ver semHoraDeLimite).
  // A hora por extenso tambem (rodada 11, IA21-v1: "as quatro e quarenta").
  // A hora recusada ("10h n da", "em vez das 10") e a de outro assunto ("saio do
  // trabalho as cinco e meia", "sai da escola as 3") tambem nao contam (rodada
  // 13, IA21 v1 e v2, alta: "pera muda pra 11 e meia, 10h n da" ficou com duas
  // horas, nada foi trocado, e a mae ouviu "ja troquei").
  const HORA = String.raw`\d{1,2}(?:\s*(?::|h)\s*\d{2}|\s*h\b|\s+e\s+(?:\d{2}|meia))?(?:\s*(?:hs|horas))?`
  const t = semHoraDeLimite(horaEmNumeros(semAcento(texto)))
    .replace(new RegExp(String.raw`\b${HORA}\s*,?\s*(?:n|nao)\s+(?:da|posso|consigo|rola|vai dar|serve)\b`, 'g'), ' ')
    .replace(new RegExp(String.raw`\b(?:em vez|ao inves|no lugar)\s+d[aeo]s?\s+(?:as\s+)?${HORA}`, 'g'), ' ')
    .replace(new RegExp(String.raw`\b(?:saio|sai|saimos|largo|chego|chega|aula|escola|trabalho|termina|acaba)\b[^.!?,\n]{0,25}?\b(?:as\s+)?${HORA}`, 'g'), ' ')
  const achadas: { hora: number; minuto: number | null }[] = []
  for (const m of t.matchAll(/(\d{1,2})\s*(?::|h)\s*(\d{2})\b/g)) achadas.push({ hora: Number(m[1]), minuto: Number(m[2]) })
  for (const m of t.matchAll(/(\d{1,2})\s*(?:h|hs|horas)\b(?!\s*\d)/g)) achadas.push({ hora: Number(m[1]), minuto: null })
  // "7 da noite" e "sete e vinte da noite" (rodada 11, IA11-v1 e IA15-v2): a IA
  // leu 19:00 e 18:00, e a hora da familia nao contava para conferir.
  const tarde = (hora: number, periodo?: string) => ((periodo === 'tarde' || periodo === 'noite') && hora < 12 ? hora + 12 : hora)
  for (const m of t.matchAll(/(\d{1,2})\s+e\s+(\d{2}|meia)\b(?:\s+da\s+(manha|tarde|noite))?/g)) achadas.push({ hora: tarde(Number(m[1]), m[3]), minuto: m[2] === 'meia' ? 30 : Number(m[2]) })
  for (const m of t.matchAll(/(?<!\be\s+)\b(\d{1,2})\s*(?:h|hs|horas)?\s+da\s+(manha|tarde|noite)\b/g)) achadas.push({ hora: tarde(Number(m[1]), m[2]), minuto: null })
  // "as 16 pode ser" (rodada 5, IA15-v2): a hora sem "h" nem ":", depois de "as".
  // "pras 4" tambem (rodada 11: "me fala se trocou pras 4 ou nao").
  for (const m of t.matchAll(/\b(?:as|às|pras|pra as|para as)\s+(\d{1,2})\b(?!\s*(?:[:h/]|e\s+\d|e\s+meia|anos?\b|mes|meses|dias?\b|semanas?\b|vezes))/g)) achadas.push({ hora: Number(m[1]), minuto: null })
  return achadas
}

/**
 * A unica hora que a familia disse, no formato que o robo le ("19h", "19:20"), ou
 * ''. "7h da noite" aparece como 7 e como 19: fica o 19.
 */
function horaUnicaDaFamilia(texto: string): string {
  const ditas = horasDitas(texto)
  const unicas = ditas.filter(
    (h, i) =>
      !ditas.some((o) => o.hora === h.hora + 12 && o.minuto === h.minuto) &&
      ditas.findIndex((o) => o.hora === h.hora && o.minuto === h.minuto) === i,
  )
  if (unicas.length !== 1) return ''
  const [h] = unicas
  return h.minuto === null ? `${h.hora}h` : `${String(h.hora).padStart(2, '0')}:${String(h.minuto).padStart(2, '0')}`
}

function horarioEscolhido(s: Situacao, horario: unknown): string {
  // A IA abriu sem horario, mas a familia disse uma hora so, com minutos (rodada
  // 10, IA11-v2: "qro hj a noite msm, 19 e 20" foi lido como "19h ou 20h", e a
  // mae repetiu). Vale a hora dela. A hora cheia tambem (rodada 12, IA13-v2:
  // "umas 7 da noite tem?" abriu a lista sem uma palavra sobre as 19h): o robo
  // marca se existe, ou oferece os dois mais perto.
  if (!String(horario ?? '').trim()) return horaUnicaDaFamilia(s.texto)
  const pedido = String(horario ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!pedido) return ''
  const hora = Number(pedido[1])
  const minuto = Number(pedido[2] ?? 0)
  // "3 e 10" e 15:10 (rodada 5 do painel, IA09-v2): a familia fala no relogio
  // de 12 horas, e a hora da tarde valia so escrita como 15.
  const disse = (texto: string) =>
    horasDitas(texto).some((h) => (h.hora === hora || (h.hora < 12 && h.hora + 12 === hora)) && (h.minuto ?? 0) === minuto)
  if (disse(s.texto)) return String(horario)
  const oferecidos = horasDitas(s.ultimaDoConsultorio ?? '')
  const sim = /^\s*(sim|pode|pode ser|quero|isso|ok|fechado|combinado|beleza|blz|perfeito)\b/i.test(s.texto)
  if (sim && oferecidos.length === 1 && disse(s.ultimaDoConsultorio ?? '')) return String(horario)
  // Com varias horas na mensagem, vale a da pergunta (rodada 14, IA18-v1: "...O
  // mais perto e o das 09:20. Quer que eu marque esse?" e o "pode ser" mostrou a
  // lista inteira de novo).
  const frases = (s.ultimaDoConsultorio ?? '').split(/\n+/).flatMap((l) => l.split(FIM_DE_FRASE))
  const ultimaPergunta = frases.map((f) => /\?\s*$/.test(f)).lastIndexOf(true)
  const perto = ultimaPergunta >= 0 ? frases.slice(Math.max(0, ultimaPergunta - 1), ultimaPergunta + 1).join(' ') : ''
  const daPergunta = perto ? horasDitas(perto).filter((h) => h.minuto !== null) : []
  if (sim && daPergunta.length === 1 && daPergunta[0].minuto === minuto && (daPergunta[0].hora === hora || daPergunta[0].hora + 12 === hora)) return String(horario)
  return ''
}

/**
 * O texto para a familia que veio numa ferramenta. Aceita o nome com erro de
 * digitacao ("para_famila", rodada 5 do painel): a IA errou o campo uma vez e o
 * texto sumiu sem aviso, com o valor da consulta dentro.
 */
function campoParaFamilia(input: Record<string, unknown> | undefined): string {
  if (!input) return ''
  const certo = input.para_familia
  if (typeof certo === 'string') return certo
  const parecido = Object.entries(input).find(([chave, valor]) => /^para_fam/i.test(chave) && typeof valor === 'string')
  if (parecido) console.warn('Atendente com IA mandou o texto da familia num campo com outro nome', parecido[0])
  return parecido ? String(parecido[1]) : ''
}

/** A familia esta respondendo a ficha do paciente (dados_nome, dados_cpf...). */
function fichaAberta(s: Situacao): boolean {
  return /^dados_/.test(s.etapa ?? '')
}

/** A familia ja contou um sinal de alarme, ou pediu urgencia, nesta conversa. */
function conversaDeUrgencia(s: Situacao): boolean {
  if (s.urgenciaAberta) return true
  return s.historico.some((m) => m.de === 'familia' && (Boolean(sinalDeAlarme(m.texto)) || familiaFalouDeUrgencia(m.texto)))
}

/**
 * A familia disse que vai pensar (rodada 7 do painel, IA19): o lembrete "e so
 * responder a pergunta acima" depois disso soa como cobranca. Quando ela
 * voltar, o passo continua la.
 */
// "vo pensa" (rodada 11 e 13, IA19-v2: a oferta de horario voltou logo depois).
const ADIAMENTO = /\b(vou pensar|vo pensa|vou pensa|vo pensar|vou ver direitinho|depois (eu )?(vejo|marco|decido|falo|retorno)|mais tarde eu|vou conversar com|vou falar com (meu|minha|o pai|a mae))\b/
function adiou(s: Situacao): boolean {
  const recentes = [...s.historico.filter((m) => m.de === 'familia').slice(-3).map((m) => m.texto), s.texto]
  return recentes.some((t) => ADIAMENTO.test(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))
}

/** O valor de cada unidade, como esta em <clinica> ("## Unidade" e "Valor da consulta: R$ ..."). */
function valoresDaClinica(conhecimento: string): string {
  const itens: string[] = []
  for (const bloco of conhecimento.split(/\n(?=## )/)) {
    const nome = bloco.match(/^## (.+)/)?.[1]?.trim()
    const valor = bloco.match(/Valor da consulta:\s*(R\$\s*[\d.,]+)/)?.[1]
    if (nome && valor) itens.push(`${nome}: ${valor}`)
  }
  return itens.length ? `💰 Valor da consulta: ${itens.join('; ')}.` : ''
}

/** Sinal de risco de vida agora ou nas ultimas mensagens da familia. */
const ORDEM_DE_IR_AGORA = /\b(?:leve|levem|levar|lev[aá]-l[oa]|procure|procurem|procurar|v[aá]|vão|ir|ligue)\b[^.!?\n]{0,40}\bagora\b|\bagora\b[^.!?\n]{0,15}\b(?:leve|levem|procure|procurem|v[aá]|vão|ligue)\b|\bagora\s*:/i
function riscoDeVida(s: Situacao): boolean {
  const recentes = [...s.historico.filter((m) => m.de === 'familia').slice(-6).map((m) => m.texto), s.texto]
  if (recentes.some((t) => sinalDeAlarme(t)?.risco === 'vida')) return true
  // O pronto-socorro agora ja dito por nos, numa urgencia aberta, tambem conta
  // (rodada 11, IA01-v1, alta: a regra nao reconheceu a bateria, a IA mandou ao
  // pronto-socorro, e a lista de sexta abriu embaixo com o bebe em casa).
  // So a frase com o pronto-socorro E o "agora", sem "se" na frente, e fora das
  // frases prontas (rodada 12, IA03-v1, alta, regressao desta trava: o aviso
  // comum "Se for uma emergencia com risco de vida, procure o pronto-socorro...
  // ou ligue 192" ligava a trava, e a mae de uma urgencia comum ouviu quatro
  // vezes "pronto-socorro agora", com a agenda recusada). A frase da propria
  // trava tambem nao religa: o risco de vida da regra ja vem da familia, acima.
  const frasePronta = /Pelo que você contou, a criança precisa ser avaliada agora|Não espere a consulta|Se piorou, não espere/
  return Boolean(s.urgenciaAberta) &&
    s.historico
      .filter((m) => m.de === 'consultorio')
      .slice(-4)
      // O "agora" tem de ser a ordem de ir (rodada 14, IA05-v2, alta: "agora e
      // madrugada, o mais seguro e leva-lo ao pronto-socorro" fechou a agenda de
      // uma febre que ja tinha baixado).
      .some((m) => !frasePronta.test(m.texto) && m.texto.split(FIM_DE_FRASE).some((f) => PRONTO_SOCORRO.test(f) && ORDEM_DE_IR_AGORA.test(f) && !/^\s*(?:🚨\s*)?\*?se\b/i.test(f)))
}

// Oferta de marcar, que nao cabe numa conversa de risco de vida (rodada 7).
// Rodada 8 (IA02-v1): "o horario mais proximo e hoje, sabado, as 14:30" as 2h,
// com vomito escuro de volta - a mae perguntou se podia esperar ate as 14:30.
// Sem \b antes do "as" com crase (rodada 9, IA01-v1: "as 14:00" passava, e a
// mae marcou quarta com o bebe que engoliu a bateria em casa).
const OFERTA_DE_MARCAR = /\b(quer que eu (veja|procure|marque|abra)|posso (ver|procurar|marcar|abrir)|quer marcar|vamos marcar|ver um hor[aá]rio|marcar uma consulta|hor[aá]rio mais pr[oó]ximo|pr[oó]ximo hor[aá]rio|continua marcada|o pr[oó]ximo [eé]|eu marco|d[aá] (?:sim )?para marcar|d[aá] sim|vou mostrar os hor[aá]rios)\b|(?:^|\s)[àa]s\s+\d{1,2}[:h]\d{2}\b|R\$\s*\d/i
/** A familia ja foi, esta ou esta indo ao pronto-socorro (nas ultimas mensagens). */
function jaNoProntoSocorro(s: Situacao): boolean {
  const recentes = [...s.historico.filter((m) => m.de === 'familia').slice(-3).map((m) => m.texto), s.texto]
  return recentes.some((t) =>
    // "levar", "leva" e "to saindo" (rodada 12, IA05 v1 e v2: "vou levar ele no
    // pronto socorro agora com meu marido. Mas deixa marcado as 15h" e "ja to
    // saindo c ele" ouviram "Nao espere a consulta" e a agenda recusada).
    // "n quero leva no ps" e o contrario (a negacao antes do verbo nao conta).
    /(?<!\b(?:nao|n)\s+(?:quero|vou|vo|consigo|posso|da pra|vamos)\s+)\b(voltamos|voltamo|voltei|voltar|voltando|ja fomos|fomos|fui|ja fui|estamos|estou|to|tamo|tamos|saindo|indo|levei|levamos|levando|levar|leva)\b[^.!?\n]{0,25}\b(ps|pronto[\s-]?socorro|hospital|upa)\b/i.test(semAcento(t)) ||
    // Qualquer "volt..." seguido de "do ps" (rodada 13, IA02-v2, alta: "acabamo d
    // volta do ps, ela ta bem, liberaram" ouviu "Nao espere a consulta" e a agenda
    // recusada). Com o "do": "a febre voltou, nao quero ir pro ps" nao e volta.
    /\bvolt\w*(?:\s+\S+){0,2}?\s+(?:d[oa]s?|de)\s+(?:ps|pronto[\s-]?socorro|hospital|upa)\b/i.test(semAcento(t)) ||
    /\b(ja )?(to|estou|tamo|estamos) saindo\b/i.test(semAcento(t)) ||
    // "ja tamo d volta, liberaram ela do ps" (rodada 14, IA02-v2).
    /\b(?:ja\s+)?(?:tamo|tamos|estamos|to|estou)\s+(?:de|d)\s+volta\b/i.test(semAcento(t)) ||
    // "Ta bom, vou levar agora", "vamos agora" (rodada 10). "vamo agr" (rodada 11,
    // IA01-v2: a mae saindo ouviu que o horario "fica marcado", e nada marcou).
    // "vo leva ela agr" e "estamos indo agora" (rodada 13, IA01).
    /\b(vou|vamos|vamo|vo|to|estou|estamos|tamo|tamos)\s+(levar|leva|levando|indo)\b[^.!?\n]{0,15}\b(agora|agr)\b|\b(vamos|vamo) (agora|agr)\b|\bja (vou|estou indo|to indo)\b/i.test(semAcento(t)) ||
    // A volta contada pelo que fizeram la (rodada 11, IA02-v2, alta: "voltamo,
    // deram soro e pediram p ver c o gastro" ouviu tres vezes "procure o
    // pronto-socorro agora", e a agenda ficou fechada).
    // Na mensagem inteira (rodada 12, IA02-v1: "Voltamos agora. Deram soro..." -
    // o ponto quebrava a frase, e a mae ouviu duas vezes "pronto-socorro agora").
    /\b(voltamos|voltamo|voltei|ja voltamos|acabamos de voltar|acabou de voltar|chegamos|cheguei)\b[^\n]{0,120}\b(deram|deu|fizeram|tomou|liberaram|liberou|mandaram (?:p|pra|para) casa|alta|soro|medicaram|pediram)\b/i.test(semAcento(t)),
  )
}

/** O pronto-socorro firme da IA no risco de vida, quando o texto dela nao tem. */
const PRONTO_SOCORRO_AGORA = '🚨 Pelo que você contou, a criança precisa ser avaliada agora: procure o pronto-socorro mais próximo ou ligue 192, sem esperar a consulta.'
/**
 * Risco de vida: sai do texto da IA tudo o que aceita esperar (rodada 10, IA02-
 * v1, critica: "Entao amanha as 14:30 a gente ve com ele. Ela ja ta dormindo"
 * recebeu o pronto-socorro na frente e, embaixo, "Se ela vomitar de novo durante
 * a noite, nao espere... Descansem bem". A mae ficou em casa). Condicional,
 * "qualquer coisa", despedida de boa noite e a consulta como plano.
 */
const ACEITA_ESPERAR =
  /^\s*(?:🚨\s*)?se\b|\bse\s+(?:ela|ele|a crian[cç]a|o beb[eê]|piorar|vomitar|tiver|ficar)\b|\bqualquer coisa\b|\bdescans\w*|\bdurm\w*|\bboa noite\b|\bat[eé] amanh[aã]\b|\bamanh[aã]\b[^.!?\n]{0,40}\b(?:consulta|v[eê]|ver|avalia)\w*|\bconsulta\b[^.!?\n]{0,40}\b(?:confirmad|marcad|mantid|continua)\w*/i
function semEsperar(t: string): string {
  return t
    .split('\n')
    .map((linha) => linha.split(FIM_DE_FRASE).filter((f) => !ACEITA_ESPERAR.test(f)).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
/** A familia diz que vai esperar ("amanha a gente ve", "vou deixar ela dormir"). */
function vaiEsperar(s: Situacao): boolean {
  return /\bamanh[aã]\b|\bdescans\w*|\bdorm\w*|\besperar\b|\bespero\b|\bconsulta\b|\bmarca\b/i.test(s.texto)
}
function comProntoSocorroAgora(t: string, s?: Situacao): string {
  const limpo = semEsperar(t)
  const abertura = s && vaiEsperar(s)
    ? '🚨 Não espere a consulta: pelo que você contou, a criança precisa ser avaliada agora. Procure o pronto-socorro mais próximo ou ligue 192.'
    : PRONTO_SOCORRO_AGORA
  const firme = limpo.split(/\n|(?<=[.!?])\s+/).some((f) => PRONTO_SOCORRO.test(f) && /\bagora\b/i.test(f))
  return firme ? limpo : [abertura, limpo].filter(Boolean).join('\n\n')
}
function semOfertaDeMarcar(t: string): string {
  return t
    .split('\n')
    .map((linha) => linha.split(FIM_DE_FRASE).filter((frase) => !OFERTA_DE_MARCAR.test(frase)).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// "Nao e urgencia, so queria saber..." nao e falar de urgencia (painel com IA,
// 17/10/2026): a palavra solta deixava o pronto-socorro no fim de uma duvida
// comum. A negacao e a mesma do robo (pediuUrgencia).
function familiaFalouDeUrgencia(texto: string): boolean {
  if (PRONTO_SOCORRO.test(texto) || pediuUrgencia(texto)) return true
  return /emerg[eê]ncia/i.test(texto) && !/\b(n[aã]o|nem|sem)\b[^.!?\n]{0,15}emerg/i.test(texto)
}

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

/** Dois recados que dizem quase a mesma coisa (mais da metade das palavras em comum). */
function quaseIgual(a: string, b: string): boolean {
  const pa = palavrasDaFrase(a)
  const pb = palavrasDaFrase(b)
  if (pa.size === 0 || pb.size === 0) return false
  let comuns = 0
  for (const p of pa) if (pb.has(p)) comuns++
  return comuns / Math.min(pa.size, pb.size) >= 0.6
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
  // Sem "liguem" e "avisem" (rodada 5 do painel, falha critica): "levem a Helena
  // ao pronto-socorro agora ou liguem 192" e para a familia, e virou nota interna.
  /\b(?:confirmem|respondam|verifiquem|retornem|chequem)\b/i,
  /\bpor favor,?\s+(?:confirm|respond|verifi)/i,
  /\b(?:o|a)\s+(?:respons[aá]vel|m[aã]e|pai|paciente)\s+(?:pergunt|quer|pediu|pede|gostaria|precisa)/i,
]

export function falaComAEquipe(texto: string): boolean {
  return PARA_A_EQUIPE.some((r) => r.test(texto))
}

/**
 * O plano da IA nao vai para a familia (17/10/2026, rodada 2 do painel).
 *
 * Sem pensar antes de responder (thinking between_tools), o Sonnet passou a
 * escrever o raciocinio no texto que acompanha a ferramenta, e ele saia colado
 * em cima da lista de horarios: "A familia aceitou marcar, e a conversa ja
 * definiu unidade (Sao Paulo) e dia (sabado, 24/10)... entao abro o agendamento
 * com unidade e dia." Em cinco de seis agendamentos. A instrucao pede para nao
 * narrar; aqui sai a frase que fala DA familia ou do que a IA vai fazer.
 */
// Sem \b no fim: no JavaScript o "a" acentuado de "esta" e "ja" nao e letra
// para o \b, e "a mae esta dizendo que vai agora" passava inteira (rodada 8 do
// painel, IA02 e IA07). O fim e "nao vem letra depois".
const FIM = String.raw`(?![\wà-ú])`
const COMECA_PELA_FAMILIA = /^\s*(?:(?:a|essa|esta)\s+(?:fam[ií]lia|m[aã]e|av[oó]|respons[aá]vel)\s+(?!d[aeo]s?\b|d[aeo]\s)\S+|o\s+usu[aá]rio\b)/i
const NARRACAO = [
  // Real 19/10/2026 ("aconchego na praia"): a instrucao "se nao houver o que
  // acrescentar, nao escreva nada" virou a frase "Nao ha o que acrescentar,
  // entao nao escrevo nada.", que chegou a mae em cima da tela do robo.
  /\bn[aã]o\s+(?:h[aá]|tenho|existe)\s+(?:nada\s+)?(?:o\s+)?(?:que|a)\s+acrescentar\b|\bnada\s+a\s+acrescentar\b|\bn[aã]o\s+(?:vou\s+)?escrev(?:o|er|erei)\s+nada\b/i,
  new RegExp(String.raw`\b(?:a|essa|esta)\s+fam[ií]lia\s+(?:disse|aceitou|quer|escolheu|pediu|pede|pergunt\w*|n[aã]o|j[aá]|est[aá]|confirmou|respondeu|mandou|escreveu|tem|decidiu|procura\w*|vai)${FIM}`, 'i'),
  new RegExp(String.raw`\b(?:a|o)\s+(?:m[aã]e|pai|av[oó]|respons[aá]vel)\s+(?:disse|aceitou|quer|escolheu|pediu|pede|pergunt\w*|n[aã]o|j[aá]|est[aá]|confirmou|respondeu|mandou|escreveu|tem|decidiu|procura\w*|vai)${FIM}`, 'i'),
  new RegExp(String.raw`\b(?:ela|ele)\s+(?:perguntou|escreveu|respondeu|quer saber|est[aá] dizendo|disse que)${FIM}`, 'i'),
  // Frase que comeca falando da familia, com qualquer verbo (rodada 10, IA06-v2:
  // "A familia insiste em saber se 10 gotas esta bom..."). A IA fala com
  // "voce"; "A mae..." no comeco da frase e sempre rascunho.
  COMECA_PELA_FAMILIA,
  // Rodada 8: "Antes de qualquer texto, preciso corrigir isso", "o caminho e
  // reabrir", "Nao ha nada a acrescentar", "Tenho que responder diretamente,
  // sem ferramenta", "A equipe nao precisa ser chamada", "nao preciso reavisar
  // o medico", "Uma resposta curta e acolhedora", "Corrijo o valor".
  /\bantes de qualquer texto\b|\bpreciso corrigir\b|\bo caminho [eé]\b|\bnada a acrescentar\b|\bsem ferramenta\b|\bprecisa ser chamad[ao]\b|\btenho que responder\b|\bresposta (?:[eé] )?curta\b|\breavis\w*|\bcorrijo\b/i,
  // Rodada 10 (IA02, IA04): "Sem piora nova contada, nao reavisa o medico",
  // "A familia concordou em ir", "so reforco curto", "Posso orientar que...",
  // "e so escolher o horario na tela a seguir".
  /\bpiora (?:nova )?contada\b|\bfam[ií]lia concordou\b|\brefor[cç]o curto\b|\bposso orientar que\b|\bna tela\b/i,
  // Rodada 9: "Nao vou chamar a equipe, pois e alguem procurando atendimento e
  // nao ha sinal de urgencia" (IA08-v2) e "dizer se precisa seria conduta
  // medica, entao nao vou opinar... deixar a porta aberta, sem pressionar"
  // (IA19-v2).
  /\bn[aã]o vou (?:chamar|acionar|avisar|opinar|oferecer|insistir|pressionar)\b|\bporta aberta\b|\bsem pressionar\b|\bseria conduta\b|\bn[aã]o h[aá] sinal de urg[eê]ncia\b|\bprocurando atendimento\b/i,
  // Rodada 9, caminho da pergunta junto do passo (IA13, IA15, IA16): "A pergunta
  // da Marina e se...", "Quem mostra os horarios e o sistema", "Vou confirmar a
  // agenda do dia 28 antes de responder", "Preciso apenas esclarecer", "Nao devo
  // enviar nada ao sistema", "sem usar ferramenta", "Atencao: ...".
  /\ba pergunta d[aeo]\s+\S+\s+[eé]\b|\b(?:ao|do|no|pelo|o)\s+sistema\b|\bantes de responder\b|\bpreciso apenas\b|\bn[aã]o devo\b|\b(?:usar|chamar) (?:a )?ferramenta\b|^\s*aten[cç][aã]o\s*:/i,
  // Rodada 9 (IA01, IA02, IA04): "Vou responder diretamente", "A familia parece
  // estar concordando", "Vale reforcar", "Nao e caso de chamar a equipe", "Isso
  // nao e conduta medica".
  /\bvou responder\b|\bvale refor[cç]ar\b|\bn[aã]o [eé] (?:o )?caso de\b|\bn[aã]o [eé] conduta\b|\b(?:a\s+)?fam[ií]lia\s+parece\b|\b(?:a\s+)?m[aã]e\s+parece\b/i,
  // Rodada 10 (IA21, IA24): "Pelo contexto, a consulta marcada e...", "Preciso
  // responder a pergunta e retomar o passo em aberto", "Nao ha uma opcao de
  // etapa a enviar", "Respondo em texto e lembro o passo", "Ela esta confusa",
  // "Pela ultima mensagem do consultorio", "Ela pediu o ultimo horario".
  /\bpelo contexto\b|\bretomar o passo\b|\bpasso em aberto\b|\betapa a enviar\b|\brespondo em texto\b|\b(?:ela|ele)\s+est[aá]\s+confus[ao]\b|\bpela [uú]ltima mensagem\b|\b(?:ela|ele)\s+pediu\b|\bpreciso responder\b|\blembro o passo\b/i,
  /\b(?:abrir_fluxo|responder_etapa|ver_horarios|chamar_equipe|fluxo)\b/i,
  /\ba conversa j[aá] (?:definiu|combinou|tem)\b/i,
  /\bent[aã]o (?:abro|vou abrir|chamo|vou chamar|passo)\b/i,
  /\b(?:abro|abrirei) o agendamento\b/i,
  /\bvou abrir o agendamento direto\b/i,
  // Raciocinio em primeira pessoa numa resposta sem ferramenta (rodada 5, IA04):
  // "...entao devo orientar pronto-socorro caso piore. Nao preciso chamar a
  // equipe de novo: ele ja foi avisado nesta conversa."
  /\bdevo\s+(?:orientar|chamar|abrir|usar|oferecer|responder|mandar|passar|consultar|dizer|seguir|registrar|tratar|manter|repetir|perguntar|acionar)\b/i,
  // Rodada 11: "Devo acolher, explicar...", "seria redundante", "a resposta pode
  // ser dada por mim", "Nao e urgencia (bebe bem...)" (IA08-v1); "O usuario
  // perguntou se ha horario no sabado. Preciso consultar a agenda" (IA09-v2,
  // IA20-v2); "Nao ha risco de vida descrito... vou confirmar a consulta que ela
  // tem, sem oferecer outra" (IA03-v1).
  /\bdevo\s+[a-zà-ú]+(?:ar|er|ir)\b|\bseria redundante\b|\bpor mim\b|\bn[aã]o [eé] urg[eê]ncia\s*\(|\bo usu[aá]rio\b|\bpreciso (?:consultar|checar|verificar|olhar)\b|\bpreciso (?:confirmar|ver) a agenda\b|\bvou (?:consultar|checar|verificar|olhar) a agenda\b|\brisco de vida descrito\b|\bsem oferecer\b/i,
  // Conta de valores que a IA monta (rodada 11, IA02-v1: "R$ 450,00 + R$ 150,00 =
  // R$ 600,00", sem parcela de R$ 150 em lugar nenhum). Fica so o valor da unidade.
  // Rodada 12 (IA09-v1): com palavras tambem, "R$ 450,00 mais R$ 150,00, ou seja,
  // R$ 600,00", e a autocorrecao em paragrafo ("> Correcao: o valor e...").
  /R\$\s*[\d.,]+\s*(?:[+=]|\bmais\b|\bsomando\b|\bacrescid\w* de\b)\s*R\$|R\$\s*[\d.,]+[^.!?\n]{0,30}\bou seja\b[^.!?\n]{0,10}R\$/i,
  /^\s*>?\s*\**\s*corre[cç][aã]o\s*\**\s*:|\bn[aã]o h[aá] soma\b/i,
  // Rodada 13 (IA07-v2): "Pelas regras, pergunta hipotetica nao e piora e nao
  // chama a equipe como urgencia. A resposta e direta, sem a ferramenta."
  /\bpelas? regras?\b|\bsem (?:a )?ferramenta\b|\bpergunta hipot[eé]tica\b|\bn[aã]o chama (?:a )?equipe\b|\ba resposta [eé] direta\b/i,
  // Com o nome da mae no lugar de "a familia" (rodada 14, IA07-v2: "A Camila esta
  // dizendo que... so preciso esclarecer com calma").
  /^\s*(?:A|O)\s+[A-ZÀ-Ú][a-zà-ú]+\s+(?:est[aá] dizendo|disse que|quer saber|perguntou|pediu|escreveu|parece)\b/,
  // Rodada 14 (IA03-v2): "Vou confirmar a consulta, dizer que a equipe ja esta
  // com a mensagem e manter o pronto-socorro apenas como orientacao se piorar."
  /\bvou confirmar a consulta\b|\bmanter o pronto[\s-]?socorro\b|\bapenas como orienta[cç][aã]o\b|\bdizer que a equipe\b/i,
  // "Responda diretamente." (rodada 12, IA01-v1): sobra de rascunho.
  /^\s*respond[ao]\s+diretamente\b|\bresponder diretamente\b/i,
  /\bn[aã]o (?:preciso|[eé] preciso|h[aá] (?:por)?que)\s+(?:chamar|abrir|usar|consultar|oferecer|passar|orientar|repetir|avisar|acionar)\b/i,
  // "Aqui mesmo nesta conversa" fala com a familia (rodada 11, IA22-v2: o corte
  // levou justamente a frase que explicava que quem responde e a equipe).
  // Com "voce" tambem fica (rodada 12, IA22-v2: "voce recebe nesta conversa").
  /^(?![^\n]*\bvoc[eê](?![a-zà-ú]))[^\n]*(?<!\baqui mesmo |\baqui |\bpor aqui )\bnesta conversa\b/i,
  // Mais raciocinio que vazou na rodada 7: "Pela regra, urgencia vai para a
  // equipe", "respondo so a duvida", "posso adaptar o texto", "o sistema ja
  // mandou a lista".
  /\bpela regra\b/i,
  // "Te respondo por aqui" e conversa; "entao respondo so a duvida" e plano.
  /\b(?:ent[aã]o|s[oó]|apenas|aqui)\s+respondo\b|\brespondo\s+(?:s[oó]|apenas|que|com|a d[uú]vida)\b/i,
  /\bposso adaptar\b/i,
  new RegExp(String.raw`\bo sistema\s+(?:j[aá]${FIM}|vai\b|mostr\w*|mand\w*|le[uo]\b|entend\w*|interpret\w*|registr\w*|segu\w*|abr\w*)`, 'i'),
  // As marcas internas das instrucoes nunca vao para a familia ("nao tenho essa
  // informacao em <clinica>", rodada 5 do painel).
  /<\/?(?:clinica|contexto|conversa|mensagem_nova)>/i,
  // Chamada de ferramenta escrita como texto (rodada 6: o JSON cru chegou a mae,
  // e tambem no formato <parameter name="motivo">).
  /[{"]\s*"?(?:motivo|para_familia|resumo_para_equipe|fluxo)"?\s*:/,
  /<\/?(?:parameter|invoke|function_calls|antml)\b/i,
  // Promessa de abrir o que nao foi aberto ("agora vou abrir a troca do horario").
  /\b(?:agora )?vou abrir\b/i,
  // "A tela ja mostra a remarcacao para 14:00" (rodada 7): "a tela" e palavra
  // das instrucoes, nao da conversa com a familia.
  /\ba tela\b/i,
  // "Sim, o estacionamento e pago? ... o valor eu nao tenho" (rodada 7, IA23-v2):
  // um "sim" colado na pergunta da familia, sem informacao. Pergunta de oferta
  // ("Sim, quer que eu veja um horario?") fica.
  /^\s*(?:sim|n[aã]o)[,!]\s+(?![^?]*\b(?:quer|posso|prefere|gostaria|pode ser|que tal|voc[eê]|te)\b)[^.!?\n]{3,80}\?\s*$/i,
]

export function semNarracao(texto: string): string {
  // Pergunta e resposta da propria IA (rodada 8, IA23-v1): "A consulta em Sao
  // Paulo e R$ 450,00 a menos que o valor de Santos? Nao: e R$ 600,00". Sai a
  // pergunta, fica a resposta.
  // So com dois-pontos: "Atende sabado? Sim, aos sabados..." e eco comum, e o
  // "sim" ali ajuda. "Corrigindo:" tambem (rodada 9, IA09-v2: "A consulta em Sao
  // Paulo e R$ 450,00 a R$ 600,00? Corrigindo: custa R$ 600,00"). O espaco antes
  // fica: a rodada 9 leu "15:50.E" colado.
  // Com virgula tambem, quando a pergunta traz valor (rodada 12,
  // IA20-v2: "A consulta la e R$ 450,00? Nao, em Sao Paulo e R$ 600,00" chegou a
  // avo). "Atende sabado? Sim, aos sabados" continua.
  // "e R$ 450,00... desculpe, o valor correto e R$ 600,00" (rodada 14, IA03-v1):
  // sai o valor errado e a desculpa, fica o certo.
  const semAutoPergunta = texto
    .replace(/R\$\s*[\d.,]+\s*(?:…|\.{2,3}|,)\s*(?:desculp\w*|perd[aã]o|corrigindo)[,!.]?\s*(?:o valor (?:correto|certo) [eé]\s*)?(?=R\$)/gi, '')
    .replace(
      /(^|[.!?]\s+|\n)[^.!?\n]*\?\s+(?:N[aã]o|Sim|Corrigindo)\s*:\s*(\S)/g,
      (_, antes: string, letra: string) => antes + letra.toUpperCase(),
    )
    .replace(
      // "? Nao." e "? Na verdade," tambem (rodada 13, IA17: sondas que passavam).
      /(^|[.!?]\s+|\n)[^.!?\n]*R\$[^.!?\n]*\?\s+(?:N[aã]o|Na verdade)\s*[,.]\s*(\S)/g,
      (_, antes: string, letra: string) => antes + letra.toUpperCase(),
    )
  // Paragrafo com duas frases de rascunho ou mais sai inteiro (rodada 10, IA21 e
  // IA24): o raciocinio vem em bloco, e as frases dele que a lista nao conhece
  // ("Pela ultima mensagem do consultorio...", "Ela pediu o ultimo horario")
  // chegavam soltas a familia.
  // Frase que comeca falando da familia na terceira pessoa ("A familia...", "O
  // usuario...") marca o paragrafo inteiro como rascunho quando ha outro
  // paragrafo para a familia (rodada 11, IA08-v1: das cinco frases do raciocinio,
  // so a primeira saia).
  const paragrafos = semAutoPergunta.split('\n')
  const deTerceiros = (linha: string) => linha.split(FIM_DE_FRASE).some((frase) => COMECA_PELA_FAMILIA.test(frase))
  const temOutro = paragrafos.filter((linha) => linha.trim() && !deTerceiros(linha)).length > 0
  const linhas = paragrafos.map((linha) => {
    if (temOutro && deTerceiros(linha)) return ''
    const frases = linha.split(FIM_DE_FRASE)
    const rascunho = frases.filter((frase) => NARRACAO.some((r) => r.test(frase)))
    if (rascunho.length >= 2) return ''
    return frases.filter((frase) => !rascunho.includes(frase)).join(' ')
  })
  const limpo = linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (limpo !== texto.trim()) console.warn('Atendente com IA narrou o plano no texto da familia; cortado', texto.slice(0, 200))
  return limpo
}

const AVISO_PADRAO = 'Vou confirmar isso com a equipe e te respondemos por aqui.'

// A IA diz que a equipe confirma ou responde, num texto sem ferramenta.
// Rodada 8: "Posso passar essa duvida para a equipe confirmar" (IA20-v2) e
// "nao sei dizer quanto custa", "nao tenho essa informacao" (IA23), sem chamar
// ninguem: a pergunta ficava sem resposta e sem nota.
// Rodada 9: "nao consigo dizer se e normal" (recusa de diagnostico), "nao
// consigo dizer um valor, a Unimed informa" e "qualquer coisa, a equipe
// responde" chamavam a equipe a toa. Ficaram o "nao sei" e o "nao tenho a
// informacao"; frase que aponta outro dono da resposta (plano, medico,
// consulta) nao conta (ver prometeuAEquipe).
const PROMETEU_A_EQUIPE =
  /\b(?:vou|vamos|irei|vale|melhor|pode|posso)\s+(?:\w+\s+){0,2}(?:confirmar|verificar|checar|conferir|perguntar|consultar|passar|avisar|encaminhar|repassar)\b[^.!?\n]{0,40}\b(?:equipe|secret[aá]ria|recep[cç][aã]o)\b|\ba equipe (?:confirma|verifica|retorna)\b|\bn[aã]o (?:sei (?:te )?(?:dizer|informar|responder)|tenho (?:essa|esta|a|como (?:saber|confirmar)) informa[cç][aã]o|tenho essa resposta|consigo (?:te )?confirmar)\b/i
// "Dr." fora do \b: o \b depois do ponto nunca casava (rodada 10, IA06-v2).
const OUTRO_DONO = /\b(?:unimed|plano|conv[eê]nio|contrato|operadora|m[eé]dico|consulta|doutor|normal|grave)\b|\bDra?\./i
function prometeuAEquipe(texto: string): boolean {
  return texto
    .split('\n')
    .flatMap((linha) => linha.split(FIM_DE_FRASE))
    .some((frase) => PROMETEU_A_EQUIPE.test(frase) && !(OUTRO_DONO.test(frase) && !/\bequipe\b/i.test(frase)))
}

/**
 * O que nenhuma ferramenta faz (rodada 7 do painel): "vou anotar que ela
 * prefere a tarde", "te aviso se abrir vaga", "deixo reservado". Ninguem anota
 * e ninguem avisa; a frase sai do texto que vai para a familia.
 */
// Rodada 8: "depois da ficha eu troco o horario", "assim que voce me passar o
// nome, eu troco", "da para trocar depois que terminar o cadastro" - nada fazia
// a troca (o sistema troca na hora; ver trocarHorarioDaFicha no robo).
const PROMESSA =
  /\b(?:vou|irei|vamos)\s+(?:te\s+|lhe\s+)?(?:anotar|registrar|reservar|segurar|guardar|lembrar|avisar(?!\s+a\s+equipe)|mandar|enviar)\b|\b(?:anotei|registrei|reservei|guardei|segurei)\b|\bte\s+(?:aviso|lembro|mando|envio)\b|\bdeixo\s+(?:reservad|separad|anotad|guardad)\w*|\beu\s+(?:troco|mudo|altero|remarco|ajusto)\b|\bdepois\s+(?:da ficha|do cadastro|que (?:terminar|terminarmos|acabar))\b|\b(?:j[aá]\s+)?pe[cç]o\s+(?:a\s+)?(?:troca|mudan[cç]a|altera[cç][aã]o)\b|\bvou\s+(?:pedir|solicitar)\s+(?:a\s+)?(?:troca|mudan[cç]a|altera[cç][aã]o)\b|\bvou\s+(?:trocar|mudar|remarcar|alterar)\b|\bj[aá]\s+deixo\b|\bem seguida\b[^.!?\n]{0,30}\b(?:marc|deix|troc)\w*|\beu\s+(?:mesm[oa]\s+)?marco\b|\bmarco para voc[eê]|\bo combinado [eé]\b|\bassim que\b[^.!?\n]{0,30}\bficar pront|\bte mandar por aqui\b|\bem seguida\b[^.!?\n]{0,40}\b(?:faz|fazer|cadastr)\w*|\bvou\s+(?:procurar|ver\s+as\s+datas|buscar)\b|\b(?:a gente|eu|n[oó]s)\s+deix\w*\s+(?:marcad|reservad|agendad)\w*|\bvou deixar\b[^.!?\n]{0,30}\b(?:agendamento|marcad|reservad|aberto|anotad|encaminhad|selecionad|separad|escolhid)\w*|\b(?:o|a)\s+Dra?\.\s+\S+\s+(?:j[aá]\s+)?sabe\b|\bdeixei\b[^.!?\n]{0,30}\bselecionad\w*|\bvou passar\s+(?:o|a)\s+\S+\s+para\s+(?:as|às)\b|\b(?:j[aá]\s+)?recebi\b[^.!?\n]{0,40}\b(?:dados|em cima|que voc[eê] mandou)|\b(?:dados|que voc[eê] mandou)\b[^.!?\n]{0,40}\bj[aá] recebi\b/i
// Rodada 12: "Vou deixar o agendamento aberto para quarta" sem abrir nada
// (IA01-v1), e "Os dados que voce mandou la em cima eu tambem ja recebi" em cima
// da pergunta da data (IA15-v1: "se ja recebeu, por que esta perguntando?").
// Rodada 13 (IA08-v2): "o Dr. Marcello sabe que a Laura esta bem" - nada tinha
// ido ao medico; a frase sai e a equipe e chamada com o recado.
// "que o horario a gente deixa marcado" (rodada 11, IA01-v2): nada foi marcado,
// e a mae perguntou "marcou ou n?".
function semPromessa(t: string): string {
  // "Combinado!" a "manda aqui quando tiver pronto" (rodada 11, IA22-v2) aceita
  // um envio que so a equipe confirma. Sai o "combinado", fica o resto.
  // A frase que sobra comeca com maiuscula (rodada 13, IA21: "a equipe ja
  // esta..." chegava minusculo depois do corte de "Combinado, ").
  // "Passei para a equipe e para o Dr. Marcello": so a equipe recebe (rodada 14,
  // IA05-v2); o "e para o Dr." sai.
  return t
    .replace(/\s+e\s+(?:para|pro)\s+o\s+Dra?\.\s+[A-ZÀ-Ú][\wà-ú]+/g, '')
    .replace(/^\s*(?:combinado|fechado|pode deixar|beleza|certinho)\s*[!.,]\s*(?=\S)/i, '')
    .replace(/^\s*\p{Ll}/u, (letra) => letra.toUpperCase())
    .split('\n')
    .map((linha) => linha.split(FIM_DE_FRASE).filter((frase) => !PROMESSA.test(frase)).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
/**
 * A familia perguntou o preco, e nos ainda nao dissemos (rodada 12, IA18-v1 e
 * IA19-v2: "perco o valor?" e "esse valor eu pago no dia?" recebiam a tabela
 * inteira pela terceira vez).
 */
function valorPedidoENaoDito(s: Situacao): boolean {
  const PRECO = /\b(quanto (?:custa|e|é|fica|sai|ta|tá)|quanto [eé] a consulta|qnto|qto|qual (?:e |é )?o valor|valor da consulta|pre[cç]o)\b/i
  // A pergunta da mensagem anterior tambem, se nada com R$ saiu depois (rodada
  // 14, IA03-v1: "E quanto e a consulta?" na 1a mensagem, e o toque seguinte no
  // botao fez o valor sumir ate a 10a).
  const ultimas = s.historico.slice(-4)
  const ultimaDaFamilia = [...ultimas].reverse().find((m) => m.de === 'familia')?.texto ?? ''
  const precoPerguntado = PRECO.test(s.texto) || PRECO.test(ultimaDaFamilia)
  const jaDissemos = ultimas.some((m) => m.de === 'consultorio' && /R\$/.test(m.texto))
  return precoPerguntado && !jaDissemos
}

/** Sem as frases de troca feita, num caminho em que nada foi trocado. */
const TROCA_FEITA = /\b(?:j[aá]\s+)?(?:troquei|mudei|remarquei|alterei)\b|\bj[aá]\s+(?:est[aá]\s+)?(?:trocad|remarcad|mudad|alterad)\w*/i
function semTrocaFeita(t: string): string {
  return t
    .split('\n')
    .map((linha) => linha.split(FIM_DE_FRASE).filter((frase) => !TROCA_FEITA.test(frase)).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
const AVISO_DE_URGENCIA = 'Se for uma emergência com risco de vida, procure o pronto-socorro mais próximo ou ligue 192.'

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
    String.raw`\b(d[eê]|ofere[cç]a|suspenda|aplique|use|tente)\s+(a\s+ele|a\s+ela|pra\s+ele|pra\s+ela|um|uma|o|a)?\s*(rem[eé]dio|xarope|soro|antit[eé]rmico|dipirona|paracetamol|ibuprofeno|omeprazol|simeticona|lactulose|probi[oó]tico|ch[aá])(?![a-zà-ú])`,
    String.raw`\b(dipirona|paracetamol|ibuprofeno|omeprazol|domperidona|bromoprida|ondansetrona|simeticona|lactulose|macrogol|probi[oó]tico|buscopan|tylenol|novalgina|plasil|vonau)\b`,
    // Mandar NAO dar tambem e conduta (rodada 7 do painel, IA05): "Remedio e
    // dose quem orienta e o Dr. Marcello, entao nao de nada antes de falar com
    // ele", numa febre, e "nao faca nada antes de sair" sobre o banho morno.
    // So o medico pode mandar suspender ou esperar.
    String.raw`\bn[aã]o\s+(d[eê]|deem|ofere[cç]a|fa[cç]a)\s+nada\b`,
    String.raw`\bn[aã]o\s+(d[eê]|deem|ofere[cç]a)\s+(o\s+|a\s+|os\s+|as\s+)?(rem[eé]dios?|medica[cç][aã]o|medicamentos?)\b`,
    String.raw`\bnada\s+(pela|por)\s+boca\b`,
  ].join('|'),
  'i',
)

/**
 * A frase que RECUSA a conduta nao e conduta (17/10/2026, painel com IA).
 *
 * A trava via so o nome do remedio: "sobre o paracetamol, quem orienta e o Dr.
 * Marcello" foi trocado pela frase padrao numa febre de bebe de 7 semanas, a
 * conversa saiu da urgencia e o alerta ao medico nao foi. Frase com recusa sai
 * da conferencia, a nao ser que tenha conduta firme (numero com unidade,
 * intervalo, "pode dar") ou elogie o remedio ("costuma ajudar").
 */
const RECUSA = new RegExp(
  [
    String.raw`\bquem\s+(orienta|indica|decide|avalia|define|prescreve|receita)\b`,
    String.raw`\bn[aã]o\s+(posso|consigo|podemos|conseguimos|d[aá]\s+(pra|para))\s+(te\s+|lhe\s+)?(orientar|indicar|recomendar|passar|dizer|informar|falar|prescrever|confirmar|liberar|sugerir)\b`,
    String.raw`\bn[aã]o\s+(oriento|indico|recomendo|prescrevo)\b`,
    // "So o Dr. Marcello pode orientar" (rodada 8, IA05-v2): a recusa nao era
    // reconhecida, e a trava trocou o "pronto-socorro agora" pela frase padrao.
    // O ponto de "Dr." nao fecha a frase.
    String.raw`\bs[oó]\s(?:[^.!?\n]|\bDra?\.){0,40}\b(pode|podem|vai|v[aã]o|consegue)\s+(te\s+)?(orientar|indicar|avaliar|prescrever|liberar|dizer)\b`,
  ].join('|'),
  'i',
)
const CONDUTA_FIRME = new RegExp(
  [
    String.raw`\b\d+([.,]\d+)?\s*(mg|ml|mcg|gotas?|comprimidos?|sach[eê]s?)\b`,
    String.raw`\bde\s+\d+\s+em\s+\d+\s*(h|horas)\b`,
    // "nao posso dizer se pode dar" e recusa; "pode dar" sozinho, nao.
    String.raw`(?<!\bse\s)(?<!n[aã]o\s)\b(pode|podem|deve|devem)\s+(dar|tomar|oferecer|aplicar|suspender)\b`,
    String.raw`\b(ajuda|ajudam|alivia|aliviam|resolve|melhora|funciona|costuma|indicad[oa]|recomendad[oa]|seguro|segura)\b`,
    // "Quem orienta e o Dr. Marcello, entao nao de nada ate ele responder" ainda
    // e ordem: a recusa no comeco nao apaga a conduta no fim.
    String.raw`\bn[aã]o\s+(d[eê]|deem|ofere[cç]a|fa[cç]a)\s+nada\b`,
    String.raw`\bn[aã]o\s+(d[eê]|deem|ofere[cç]a)\s+(o\s+|a\s+|os\s+|as\s+)?(rem[eé]dios?|medica[cç][aã]o|medicamentos?)\b`,
  ].join('|'),
  'i',
)

export function orientouConduta(t: string): boolean {
  const semRecusas = t
    .split('\n')
    .flatMap((linha) => linha.split(FIM_DE_FRASE))
    .filter((frase) => !(RECUSA.test(frase) && !CONDUTA_FIRME.test(frase)))
    .join(' ')
  return CONDUTA.test(semRecusas)
}

export function limparTexto(t: string, manterProntoSocorro: boolean): string {
  // Negrito de site (17/10/2026, teste do Edu): "**São Paulo (Livance
  // Ibirapuera)**" chegou no WhatsApp com um asterisco sobrando de cada lado.
  // O WhatsApp so entende um. No Instagram, semFormatacaoDoWhatsApp tira todos.
  let r = t.replace(/\*\*([^*\n]+)\*\*/g, '*$1*').replace(/__([^_\n]+)__/g, '_$1_').replace(ECO, '')
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
 * A IA pensa antes de responder quando precisa (23/10/2026). O Edu: "faca a IA
 * pensar tambem quando tiver duvida, olhar o contexto, antes dela enviar de
 * fato". 'adaptive': o proprio modelo decide se pensa e quanto - "obrigada"
 * sai direto; duvida de conduta, pedido ambiguo e conversa longa ganham
 * raciocinio. Medido em 23/10/2026 com 4 conversas do painel (23 chamadas):
 * pensou em 11, tempo medio 3,3 s (era 3,2), pior caso 7,3 s (era 6,4) - bem
 * dentro do prazo de 15 s; ~40 tokens de saida a mais por chamada. Se o prazo
 * apertar, baixar o esforco para 'low' antes de desligar o pensamento.
 *
 * De 17/10 a 23/10/2026 a IA respondia sem pensar ('between_tools'; a API
 * recusa 'disabled' neste modelo). O motivo: com o pensamento ligado e teto de
 * 700 tokens, o pensamento comia o teto e a resposta saia vazia - a mae de uma
 * crianca vomitando ficou sem resposta duas vezes no painel. O pensamento
 * conta no max_tokens: dai o teto alto, que so custa o que for usado. E a
 * resposta vazia continua tentando de novo antes de cair no robo.
 */
export const PENSAMENTO = { thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } } as const
export const TETO_DE_TOKENS = 8000

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
  let vazias = 0
  for (let volta = 0; volta < ATE; volta++) {
    const resta = fim - Date.now()
    if (resta < 1500) throw new Error('prazo esgotado')
    const resposta = await chamar(
      {
        model: modelo,
        max_tokens: TETO_DE_TOKENS,
        ...PENSAMENTO,
        system: sistemaDoClaude(s, emEtapa),
        tools: ferramentasDoClaude(emEtapa),
        messages: mensagens,
      },
      resta,
    )
    const blocos = Array.isArray(resposta?.content) ? resposta.content : []
    const usos = blocos.filter((b): b is Extract<Bloco, { type: 'tool_use' }> => b.type === 'tool_use')
    const sintoma = relatoDeSintoma(s.texto)
    // Sintoma com o consultorio fechado: o pronto-socorro fica, como no robo
    // (fraseClinica). Em duvida comum, sai (ver limparTexto).
    // A conversa ja e de urgencia (rodada 2 do painel, IA05-v1): "nao espere ate
    // quarta. Leve-o agora a um pronto-socorro" perdeu a segunda frase porque a
    // mensagem nova ("qual o primeiro horario?") nao falava de urgencia.
    // A pergunta "e se... faco o que?" tambem (rodada 13, IA07-v1: "E se vier mais
    // sangue ate a hora da consulta, faco o que?" perdeu a resposta "se vier, e
    // pronto-socorro", com o consultorio aberto). Sem alerta: so o texto fica.
    // "oq eu faco" e "eu levo no ps ou espero?" tambem (rodada 14, IA07-v2 e IA08).
    const perguntaDoSe = /\bse\b[^?]{0,80}\b(fa[cç]o o (?:que|q)|fa[cç]o oq|o (?:que|q) eu fa[cç]o|oq eu fa[cç]o|eu dou oq|eu dou o (?:que|q)|levo (?:no|pro|ao|na) (?:ps|pronto|hospital|upa)|levo ou espero)\b/i.test(semAcento(s.texto))
    const urgente =
      usos.some((u) => u.name === 'chamar_equipe' && u.input?.motivo === 'urgencia') ||
      familiaFalouDeUrgencia(s.texto) ||
      (sintoma && !dentroDoExpediente(s.agora)) ||
      (sintoma && perguntaDoSe) ||
      conversaDeUrgencia(s)
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
    // Pergunta repetida se responde de novo (17/10/2026, teste do Edu): "o dr
    // atende ao sabado?" pela segunda vez perdeu justamente "Atende sim, aos
    // sabados em Sao Paulo" - a frase era igual a da resposta anterior, e o
    // corte de repeticao (feito para "vou pensar" e "boa noite") a tirou. Sobrou
    // "Os proximos sao 24/10..." sem dizer onde. Com pergunta, nada e cortado.
    const ultimaNossa = parecePergunta(s.texto)
      ? null
      : [...s.historico].reverse().find((m) => m.de === 'consultorio')?.texto
    const texto = semNarracao(semRepetir(limparTexto(bruto, urgente), ultimaNossa))
    const pedidoAEquipe = usos.find((u) => u.name === 'chamar_equipe')?.input
    const avisoDaEquipe = pedidoAEquipe ? campoParaFamilia(pedidoAEquipe) || String(pedidoAEquipe.texto ?? '') : ''
    // A trava confere o que vai SAIR para a familia (rodada 3 do painel): o
    // rascunho "preciso ver os horarios antes de chamar a equipe" disparava a
    // trava numa febre de bebe de 7 semanas ("de chamar" casava com "de cha", o
    // cha de beber, na lista acima) e a urgencia virava "atendente". Rascunho de quem so
    // consulta horario nao sai; com abrir_fluxo, sai so o para_familia.
    // Ferramentas que encerram a vez: a primeira que aparecer decide. Com o passo
    // e a equipe juntos (fora da urgencia), o passo vai primeiro e a equipe junto
    // (rodada 5, IA07-v2: ver o ramo do responder_etapa).
    // A urgencia ganha de qualquer outra ferramenta da mesma resposta. Na
    // rodada 7, abrir_fluxo e chamar_equipe juntos perdiam a chamada; com
    // urgencia, perderiam o alerta ao medico.
    const final =
      usos.find((u) => u.name === 'chamar_equipe' && u.input?.motivo === 'urgencia') ??
      usos.find((u) => u.name === 'responder_etapa' && usos.some((o) => o.name === 'chamar_equipe' && o.input?.motivo !== 'urgencia')) ??
      usos.find((u) => u.name !== 'ver_horarios')
    const vaiSair = !usos.length
      ? texto
      : final?.name === 'abrir_fluxo'
        ? campoParaFamilia(final.input)
        : final?.name === 'chamar_equipe'
          ? // O texto solto so sai sem para_familia (rodada 5, IA06: o rascunho "a
            // pergunta e sobre remedio e dose" disparava a trava duas vezes seguidas).
            String(avisoDaEquipe ?? '').trim() || texto
          : final?.name === 'responder_etapa'
            ? `${campoParaFamilia(final.input)}\n${String(avisoDaEquipe ?? '')}`
            : ''
    if (sintoma && orientouConduta(vaiSair)) {
      return await travarConduta(s, ferramentas, bruto, usos, String(pedidoAEquipe?.resumo_para_equipe ?? ''), emEtapa)
    }
    if (usos.length === 0) {
      if (!texto) {
        // Resposta sem texto e sem ferramenta: mais uma tentativa, igual, antes
        // de desistir. Desistir cai no robo (ver atenderComAssistente).
        if (++vazias < 2) continue
        throw new Error('resposta vazia')
      }
      // "Em feriado vale confirmar com a equipe" sem chamar a equipe (rodada 7,
      // IA20-v2): a conversa ficou sem etiqueta e sem nota, e a avo perguntou
      // "e como eu falo c a equipe". O que a IA prometeu, o sistema faz.
      if (prometeuAEquipe(texto)) {
        const continuar = emEtapa && !adiou(s) && !/continu|pergunta acima|👆|\?\s*$/i.test(texto)
          ? '\n\nPara continuar de onde paramos, é só responder a pergunta acima 👆'
          : ''
        // "Nao sei dizer" sozinho nao diz o que acontece agora: a familia fica
        // sabendo que a pergunta foi para a equipe.
        const recado = /\bequipe\b/i.test(texto) ? texto : `${texto}\n\nPassei sua pergunta para a nossa equipe, que responde por aqui.`
        const daEquipe = await ferramentas.equipe('atendente', `${recado}${continuar}`.slice(0, 900), { manterEtapa: emEtapa })
        return {
          resultado: daEquipe ?? { resposta: recado, atencao: 'atendente' },
          acao: 'equipe:prometida no texto',
          nota: `🤖 A IA disse à família que a equipe confirma, sem chamar a equipe. Mensagem da família: «${String(s.texto).slice(0, 400)}»`.slice(0, 1500),
        }
      }
      // So uma interjeicao, ou nada, depois dos cortes (rodada 12, IA22-v2, alta:
      // a mae que pediu "qnd o dr assinar manda aki" recebeu so "Combinado!" e
      // ficou esperando o relatorio; IA08-v1: "Eu mesmo marco para voce agora",
      // sem nada marcado). A equipe e chamada de verdade, e a familia sabe disso.
      const semCorte = semPromessa(texto)
      const soInterjeicao = /^\s*(?:combinado|fechado|perfeito|certo|certinho|[oó]timo|beleza|pode deixar|entendi|claro)\s*[!.]*\s*$/i
      if ((!semCorte || soInterjeicao.test(semCorte)) && (soInterjeicao.test(texto) || PROMESSA.test(texto))) {
        const recado = 'Passei para a nossa equipe, que confirma isso e responde por aqui.'
        const daEquipe = await ferramentas.equipe('atendente', recado, { manterEtapa: emEtapa })
        return {
          resultado: daEquipe ?? { resposta: recado, atencao: 'atendente' },
          acao: 'equipe:promessa cortada',
          nota: `🤖 A IA prometeu algo que só a equipe faz («${texto.slice(0, 300)}»). Mensagem da família: «${String(s.texto).slice(0, 400)}»`.slice(0, 1500),
        }
      }
      const resposta = semCorte || texto
      // Risco de vida na conversa: o pronto-socorro agora vai na frente, e sem
      // oferta de horario (rodada 9, IA02-v2, critica: "ai amanha ele ve ela. vo
      // deixa ela dormi" foi aceito, e as 2h ela vomitou escuro de novo).
      if (riscoDeVida(s) && !jaNoProntoSocorro(s)) {
        return { resultado: { resposta: comProntoSocorroAgora(semOfertaDeMarcar(resposta), s) }, acao: 'conversou (risco de vida)' }
      }
      return { resultado: { resposta }, acao: 'conversou' }
    }

    // Horarios pedidos junto com a equipe (rodada 2 do painel, IA05-v1): a
    // agenda era descartada e a mae, que ouviu "vou ver o horario mais
    // proximo", pediu tres vezes. Com tempo sobrando, a agenda volta para a IA
    // e a chamada da equipe fica para a volta seguinte, ja com o horario.
    if (final?.name === 'chamar_equipe' && usos.some((u) => u.name === 'ver_horarios') && fim - Date.now() > 7000 && volta < ATE - 1) {
      const resultados = []
      for (const uso of usos) {
        resultados.push(
          uso.name === 'ver_horarios'
            ? { type: 'tool_result', tool_use_id: uso.id, content: await ferramentas.horarios(String(uso.input?.unidade ?? '')).catch((erro) => `Falhou: ${erro}`) }
            : { type: 'tool_result', tool_use_id: uso.id, is_error: true, content: 'Ainda não feito: com os horários acima, chame chamar_equipe de novo, com o horário mais próximo em para_familia.' },
        )
      }
      mensagens.push({ role: 'assistant', content: blocos }, { role: 'user', content: resultados })
      continue
    }
    if (final) {
      const juntar = (r: Resultado | null, antes = texto): NonNullable<Resultado> => {
        if (!r) return { resposta: antes || 'Certo!' }
        return { ...r, resposta: antes ? `${antes}\n\n${r.resposta}` : r.resposta }
      }
      if (final.name === 'abrir_fluxo') {
        // "acao" no lugar de "fluxo" (rodada 8, IA11-v1): o erro virava "Nao
        // entendi isso como resposta" para a mae. O nome errado do campo vale, e
        // o fluxo desconhecido volta para a IA corrigir a chamada.
        const nomeDoFluxo = String(final.input?.fluxo ?? final.input?.acao ?? '')
        const fluxo = FLUXOS[nomeDoFluxo]
        if (!fluxo) {
          if (volta < ATE - 1 && fim - Date.now() > 5000) {
            const resultados = usos.map((u) => ({
              type: 'tool_result',
              tool_use_id: u.id,
              is_error: u.id === final.id,
              content: u.id === final.id ? `Fluxo desconhecido. Use o campo fluxo com um destes: ${Object.keys(FLUXOS).join(', ')}.` : 'Não feito.',
            }))
            mensagens.push({ role: 'assistant', content: blocos }, { role: 'user', content: resultados })
            continue
          }
          throw new Error(`fluxo desconhecido: ${nomeDoFluxo}`)
        }
        final.input.fluxo = nomeDoFluxo
        // Menu sem resposta para a pergunta da familia (rodada 11, IA09-v2 e
        // IA20-v2: "oi sabado vcs tem horario?" recebeu o menu e, em cima dele, o
        // rascunho "Preciso consultar a agenda"). A IA ja tinha visto a agenda:
        // volta para ela responder.
        if (nomeDoFluxo === 'menu' && !campoParaFamilia(final.input).trim() && perguntaLateral(s.texto) && volta < ATE - 1 && fim - Date.now() > 5000) {
          const resultados = []
          for (const u of usos) {
            resultados.push(
              u.name === 'ver_horarios'
                ? { type: 'tool_result', tool_use_id: u.id, content: await ferramentas.horarios(String(u.input?.unidade ?? '')).catch((erro) => `Falhou: ${erro}`) }
                : {
                    type: 'tool_result',
                    tool_use_id: u.id,
                    is_error: u.id === final.id,
                    content: u.id === final.id
                      ? 'Menu não aberto: a família fez uma pergunta. Responda a pergunta em texto, sem ferramenta, ou abra o fluxo certo com a resposta em para_familia.'
                      : 'Não feito.',
                  },
            )
          }
          mensagens.push({ role: 'assistant', content: blocos }, { role: 'user', content: resultados })
          continue
        }
        // Para a familia vai so o para_familia (rodada 2 do painel, 17/10/2026):
        // o texto solto junto da ferramenta e o rascunho da IA, e em quatro de
        // quatro agendamentos com horario saiu "A familia escolheu o horario,
        // entao abro o agendamento direto...". Nem todo rascunho tem cara de
        // rascunho ("Como ela nao vai ver a lista, digo o valor"), entao o
        // texto solto nao vai, filtrado ou nao.
        let paraFamilia = semNarracao(limparTexto(campoParaFamilia(final.input), urgente))
        // Crianca pedida que nao e de ninguem cadastrado (rodada 9, IA14: "marca o
        // Theo", com so a Helena no telefone, marcou a Helena duas vezes): o robo
        // pergunta para quem, com "Outra crianca", e o nome segue no pedido.
        const pedida = semAcento(String(final.input?.paciente ?? '')).trim().split(/\s+/)[0] ?? ''
        // Sem o nome no campo, o irmao dito na conversa tambem conta (rodada 10,
        // IA14: a IA abria sem paciente, e o robo marcava a Helena).
        const recentes = [...s.historico.filter((m) => m.de === 'familia').slice(-3).map((m) => m.texto), s.texto].map(semAcento)
        const irmaoDito = recentes.some((t) => /\b(irmao|irma|outr[oa] filh[oa]|outra crianca|nao tem cadastro|sem cadastro|primeira consulta dele|primeira consulta dela)\b/.test(t))
        const criancaNova =
          nomeDoFluxo === 'agendar' && s.criancas.length > 0 &&
          ((pedida.length >= 2 && !s.criancas.some((c) => semAcento(c).trim().split(/\s+/)[0] === pedida)) || (!pedida && irmaoDito))
        // Risco de vida e a familia ainda em casa: a consulta nao abre, porque vira
        // motivo para esperar (rodada 10, IA02-v1, alta: "entao marca amanha a tarde,
        // se ela vomitar de novo eu levo" abriu a agenda, e a mae ficou em casa com
        // vomito em borra de cafe). Indo ou de volta do pronto-socorro, marca.
        if (nomeDoFluxo === 'agendar' && riscoDeVida(s) && !jaNoProntoSocorro(s)) {
          const resposta =
            comProntoSocorroAgora(semOfertaDeMarcar(paraFamilia), s) +
            '\n\nA consulta não substitui essa avaliação. Depois do pronto-socorro, é só voltar aqui que a gente marca.'
          return { resultado: { resposta, atencao: 'urgencia' }, acao: 'agendar recusado (risco de vida)' }
        }
        let doRobo = await ferramentas.robo(criancaNova ? `${fluxo.texto} para outra criança` : fluxo.texto, fluxo.etapa)
        if (final.input.fluxo === 'agendar') {
          // "tb" e "tbm" (rodada 11, IA12-v2: "marca a helena tb hj, 17 e 20" parou
          // em "Remarcar essa", sobre a consulta do Theo, e foram 6 mensagens).
          const maisUma = /\b(tamb[eé]m|mais uma|outra consulta|al[eé]m d)|\btbm?\b/i.test(s.texto)
          doRobo = await seguirComOPedido(ferramentas, doRobo, { ...final.input, horario: horarioEscolhido(s, final.input?.horario) || horaUnicaDaFamilia(s.texto), maisUma })
        }
        // Remarcar ou cancelar a consulta que ja existe: o pedido vai junto, e a
        // familia so confirma. Com mais de uma consulta, a lista fica para ela
        // escolher qual - o robo nao adivinha. A nao ser que a crianca tenha sido
        // dita e so uma consulta seja dela (rodadas 12 e 13, IA12: "o do theo
        // passa pra 8h?" com o Theo e a Helena marcados passou pela lista sem
        // nomes, CANCELAR/REMARCAR, SIM e as datas, com dia e hora ditos tres
        // vezes). A ordem de s.consultas e a mesma da lista do robo.
        let umaSo = s.consultas.length === 1
        // Sem o campo, a crianca escrita pela familia (rodada 14, IA12 v1 e v2: "O do
        // Theo passa pra 8h?" e a IA abriu o remarcar sem paciente).
        const escrita = s.criancas.filter((c) => c.trim() && new RegExp(`\\b${semAcento(c).trim().split(/\s+/)[0]}\\b`).test(semAcento(s.texto)))
        const criancaDoFluxo = semAcento(String(final.input?.paciente ?? '') || (escrita.length === 1 ? escrita[0] : '')).trim().split(/\s+/)[0]
        const daCrianca = criancaDoFluxo.length >= 2 ? s.consultas.map((c, i) => ({ c, i })).filter(({ c }) => semAcento(c).endsWith(` · ${criancaDoFluxo}`)) : []
        if (fluxo.depois && !umaSo && daCrianca.length === 1 && ferramentas.etapa && (await ferramentas.etapa()) === 'minha_consulta') {
          const escolhida = await ferramentas.robo(String(daCrianca[0].i + 1), 'atual')
          if (escolhida && !roboNaoEntendeu(escolhida)) {
            doRobo = escolhida
            umaSo = true
          }
        }
        if (fluxo.depois && umaSo && ferramentas.etapa && (await ferramentas.etapa()) === 'minha_consulta') {
          const r = await ferramentas.robo(fluxo.depois, 'atual')
          if (r && !roboNaoEntendeu(r)) doRobo = r
          // Remarcar nao cancela nada antes de a nova estar marcada, entao o SIM
          // e so um passo a mais (rodada 2 do painel: "da pra passar a consulta
          // da Helena pra sexta?" ainda respondia SIM, unidade e dia). O pedido
          // segue ate as datas, ou os horarios do dia. Cancelar continua
          // esperando o SIM da familia.
          if (final.input.fluxo === 'remarcar' && (await ferramentas.etapa()) === 'confirmar_cancelamento') {
            const datas = await ferramentas.robo('sim', 'atual')
            if (datas && !roboNaoEntendeu(datas)) doRobo = await seguirComOPedido(ferramentas, datas, { ...final.input, horario: horarioEscolhido(s, final.input?.horario) || horaUnicaDaFamilia(s.texto) })
          }
        }
        // A pergunta que veio junto e ficou sem resposta (rodada 6, IA21-v1: "e o
        // exame eu levo no dia ou tenho que mandar antes" - a IA abriu os
        // horarios com para_familia vazio). Com tempo, a resposta vai na frente.
        // Vale tambem para o menu (rodada 7, IA09-v2: "tem sabado em sp?" recebeu
        // so o menu de boas-vindas, sem o sabado).
        let equipeDoFluxo: { motivo: string; resumo: string } | undefined
        // Sem o "amplo" (rodada 8, IA14-v1): "Oi, voltei! Conversamos aqui e pode cancelar sim" nao
        // e pergunta, e a IA escreveu "Nao ha nada a acrescentar" em cima da confirmacao.
        if (!paraFamilia && doRobo && perguntaLateral(s.texto) && fim - Date.now() > 3000) {
          const lateral = await responderPerguntaLateral(s, doRobo.resposta, chamar, modelo, Math.min(fim - Date.now(), 8000)).catch((erro) => {
            console.warn('Atendente com IA falhou na pergunta junto do agendamento', erro)
            return null
          })
          if (lateral?.texto) {
            paraFamilia = lateral.texto
            equipeDoFluxo = lateral.equipe
          }
        }
        // Agendamento aberto numa conversa de risco de vida (rodada 9, IA01-v1 e
        // IA02, criticas): a consulta pode ser marcada, mas o pronto-socorro agora
        // vai na frente, sem a oferta de horario da IA.
        if (riscoDeVida(s) && !jaNoProntoSocorro(s)) paraFamilia = comProntoSocorroAgora(semOfertaDeMarcar(paraFamilia), s)
        // Sem promessa tambem aqui (rodada 10, IA14: "confirme o cancelamento e, em
        // seguida, a gente marca o Lucas" - ninguem marcou).
        paraFamilia = semPromessa(paraFamilia)
        // O preco perguntado vai junto da agenda (rodada 13, IA02-v1: "Tem segunda
        // a tarde em Sao Paulo? E quanto custa?" abriu os horarios sem o valor, e
        // a mae marcou sem saber). A lista de horarios nao mostra preco.
        if (final.input.fluxo === 'agendar' && valorPedidoENaoDito(s) && !/R\$/.test(paraFamilia)) {
          const valores = valoresDaClinica(s.conhecimento)
          if (valores) paraFamilia = [paraFamilia, valores].filter(Boolean).join('\n\n')
        }
        // O menu ja cumprimenta: o "Ola! Sou o assistente..." do Claude antes
        // dele saia como dois cumprimentos seguidos. So a resposta a uma pergunta
        // vai na frente dele.
        // O texto com valor vai mesmo quando a pergunta nao foi reconhecida
        // (rodada 12, IA19-v2: "oi qnto ta" recebeu so o menu, sem os valores que
        // a IA escreveu). O cumprimento sai: o menu ja cumprimenta.
        if (final.input.fluxo === 'menu') {
          const informa = /R\$\s*\d/.test(paraFamilia)
          const semOla = paraFamilia.replace(/^\s*(?:ol[aá]|oi|bom dia|boa tarde|boa noite)(?![a-zà-ú])[^.!?\n]*[.!?]+\s*(?=\S)/i, '')
          return { resultado: doRobo ? juntar(doRobo, perguntaLateral(s.texto) || informa ? semOla : '') : { resposta: texto || 'Certo!' }, acao: 'fluxo:menu' }
        }
        // Quer marcar e ainda tem uma duvida da equipe (rodada 5 do painel,
        // IA11-v1): a IA so chamava a equipe, os horarios da noite nao saiam e a
        // mae pediu de novo. O agendamento segue, e a conversa acende para a
        // equipe com a duvida na nota.
        // chamar_equipe na mesma resposta (rodada 7 do painel): a chamada sumia,
        // porque so a primeira ferramenta valia. Vira a duvida do fluxo, e o que
        // a IA escreveu para a familia nela vai junto, se o fluxo nao trouxe nada.
        const equipeJunto = usos.find((u) => u.name === 'chamar_equipe')?.input
        // Com texto nos dois, os dois vao (rodada 8, IA24-v1: "a equipe corrige o
        // nome" nao chegou ao pai, so o texto do fluxo).
        if (equipeJunto) {
          const daEquipe = semNarracao(limparTexto(campoParaFamilia(equipeJunto), urgente))
          if (!paraFamilia) paraFamilia = daEquipe
          else if (daEquipe && !quaseIgual(paraFamilia, daEquipe)) paraFamilia = `${paraFamilia} ${daEquipe}`
        }
        const duvida =
          String(final.input?.duvida_para_equipe ?? '').trim() ||
          equipeDoFluxo?.resumo ||
          String(equipeJunto?.resumo_para_equipe ?? '').trim() ||
          (equipeJunto ? `(sem resumo) ${String(s.texto).slice(0, 300)}` : '')
        const resultado = juntar(doRobo, paraFamilia)
        if (duvida) {
          return {
            resultado: { ...resultado, atencao: resultado?.atencao ?? 'atendente' },
            acao: `fluxo:${final.input.fluxo} + equipe`,
            nota: `🤖 Dúvida para a equipe (a família seguiu no agendamento): ${duvida}`.slice(0, 1500),
          }
        }
        return { resultado, acao: `fluxo:${final.input.fluxo}` }
      }
      if (final.name === 'responder_etapa') {
        // Na ficha, so palavras que a familia escreveu (rodada 6 do painel): a IA
        // mandou "Sao Paulo" no passo do nome e a paciente foi gravada assim.
        // O "[cpf]" e o "[e-mail]" que a IA ve no lugar dos dados voltam ao que a
        // familia escreveu (rodada 14, IA07-v2: o robo leu "[cpf]" e respondeu
        // "Esse CPF nao confere").
        let traduzido = String(final.input?.texto ?? '')
          .replace(/\[cpf\]/gi, () => s.texto.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}\s?[-.\s]?\s?\d{2}/)?.[0] ?? '[cpf]')
          .replace(/\[e-?mail\]/gi, () => s.texto.match(/[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/i)?.[0] ?? '[e-mail]')
          .slice(0, 200)
        // A data que veio junto do nome segue com ele (rodada 13, IA17-v1: "O nome
        // dela e Laura Martins Prado, nasceu em 14/02/2019" - a IA mandou so o
        // nome, e a mae ouviu a pergunta da data: "Ja mandei acima").
        const dataJunto = s.etapa === 'dados_nome' ? s.texto.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)?.[0] : undefined
        if (dataJunto && traduzido.trim() && !traduzido.includes(dataJunto)) traduzido = `${traduzido}, nasceu ${dataJunto}`
        // Horario mandado no meio da ficha e pedido de troca (rodada 9, IA21-v1):
        // a IA escreveu "ja peco a troca para as 16:00" e mandou o horario junto,
        // que so valia nos passos do agendamento - a troca nao saiu. O robo troca
        // (ver trocarHorarioDaFicha) e, se o texto do passo veio da familia, a
        // ficha segue com ele.
        const horarioDaIA = /^dados_/.test(s.etapa ?? '') ? String(final.input?.horario ?? '').trim() : ''
        // So a hora que a familia disse (rodada 11, IA15-v2, alta): "tipo 7 da
        // noite" virou 18:00 na IA, e a consulta foi trocada sem a mae escolher.
        // Hora que nao bate vai como a familia disse, e o robo oferece os dois
        // horarios mais perto.
        const horarioNaFicha = !horarioDaIA ? '' : horarioEscolhido(s, horarioDaIA) || horaUnicaDaFamilia(s.texto)
        if (horarioNaFicha) {
          const dia = String(final.input?.dia ?? '').trim()
          const trocado = await ferramentas.robo(`trocar para ${horarioNaFicha}${dia ? ` ${dia}` : ''}`.slice(0, 60), 'mesma')
          if (trocado && /Horário trocado/.test(trocado.resposta)) {
            // So segue com o texto do passo quando ele tem letras e nao e o proprio
            // horario (rodada 10, IA21 e IA24: o "18:20" voltava ao robo como
            // resposta, virava outro pedido de troca e saia "Nao achei esse
            // horario livre" - ou uma segunda consulta).
            const ehResposta = /\p{L}{2}/u.test(traduzido) && !horaSo(traduzido)
            if (ehResposta && !/^\s*pular\s*$/i.test(traduzido) && veioDaFamilia(traduzido, s.texto)) {
              const seguinte = await ferramentas.robo(traduzido, 'mesma')
              if (seguinte && !roboNaoEntendeu(seguinte)) {
                return { resultado: { ...seguinte, resposta: `${trocado.resposta.split('\n\n')[0]}\n\n${seguinte.resposta}` }, acao: 'troca na ficha + etapa' }
              }
            }
            return { resultado: trocado, acao: 'troca na ficha' }
          }
          // Sem troca, mas com resposta do robo (os dois mais perto, ou a equipe):
          // ela vai (rodada 12, IA15-v2: "tipo sete da noite" ouviu so "Para
          // continuar o cadastro", e a resposta dos vizinhos se perdia).
          if (trocado && !roboNaoEntendeu(trocado)) return { resultado: trocado, acao: 'troca na ficha sem horario livre' }
        }
        // PULAR so quando a familia disse que nao tem ou nao sabe (rodada 8: a IA
        // pulou o nome, que e obrigatorio, num pedido de troca de horario, e o
        // e-mail num "ele precisa ir em jejum").
        const pulouSemDizer = /^dados_/.test(s.etapa ?? '') && /^\s*pular\s*$/i.test(traduzido) && !FAMILIA_PULOU.test(semAcento(s.texto))
        // So o PULAR recusado, com resposta para a familia (rodada 9, IA15-v2:
        // "precisa ir de jejum" tinha resposta boa da IA, que foi trocada por
        // "Passei o seu pedido para a equipe"): a resposta vai, o passo fica.
        const respostaDoPulo = pulouSemDizer ? semPromessa(semNarracao(limparTexto(campoParaFamilia(final.input), urgente))) : ''
        if (respostaDoPulo) {
          return {
            resultado: { resposta: `${respostaDoPulo}\n\nPara continuar o cadastro, é só responder a pergunta acima 👆` },
            acao: 'etapa_sem_pular',
          }
        }
        // A data tambem (rodada 12, IA15-v2 e IA24-v1: a IA mandou o nome da
        // mensagem anterior, "Jose Miguel Ramos", no passo da data, e a familia
        // ouviu "Nao consegui ler a data" sem ter mandado data).
        // O texto da IA que fica na ficha: sem promessa e sem troca que nao houve
        // (rodada 13, IA21-v2, alta: "Ja troquei para ele" chegou a mae, e a
        // consulta continuou na hora que ela tinha recusado).
        const respostaDaIA = semTrocaFeita(semPromessa(semNarracao(limparTexto(campoParaFamilia(final.input), urgente))))
        // O dia sem hora no meio da ficha nao vai como resposta do passo (rodada 12,
        // IA24-v2: "na vdd hj n da, tem sexta cedo?" - a IA mandou "sexta" como
        // resposta da data, e o pai ouviu os horarios de sexta, "Nao entendi" e a
        // pergunta de novo). Antes da trava abaixo (rodada 13, IA24-v2: a IA mandou
        // "Sao Paulo" com o dia "sabado", a trava recusou e jogou fora os horarios
        // certos, duas vezes, com a etiqueta da equipe aberta a toa).
        // No nome e no responsavel, so o texto que e um dia: o campo dia junto de um
        // nome nao apaga o nome.
        const diaNoTexto = /^\s*(segunda|terca|quarta|quinta|sexta|sabado|domingo|hoje|amanha)\b/.test(semAcento(traduzido))
        const soODia = diaNoTexto || (Boolean(String(final.input?.dia ?? '').trim()) && !/^dados_(nome|responsavel)$/.test(s.etapa ?? ''))
        // Texto vazio na ficha nao vai ao robo (rodada 10, IA15-v2: a IA explicou
        // que 18:40 nao existe, e embaixo veio "Nao consegui ler a data"). Vai a
        // resposta dela, e o passo continua.
        if (/^dados_/.test(s.etapa ?? '') && !pulouSemDizer && (!traduzido.trim() || (soODia && !/\d{4}/.test(traduzido)))) {
          return {
            resultado: { resposta: [respostaDaIA, 'Para continuar o cadastro, é só responder a pergunta acima 👆'].filter(Boolean).join('\n\n') },
            acao: 'etapa_vazia',
          }
        }
        if (pulouSemDizer || (/^dados_(nome|responsavel|nascimento)$/.test(s.etapa ?? '') && !veioDaFamilia(traduzido, s.texto))) {
          console.warn('Atendente com IA mandou para a ficha um texto que a familia nao escreveu; recusado', traduzido)
          // Com pergunta e resposta da IA, vai a resposta, e o passo fica (rodada
          // 13, IA16-v2: "pera, tem lugar p estacionar la em sp?" perdeu a resposta
          // certa para "Passei o seu pedido para a equipe", e a mae perguntou de novo).
          // Pedido de agenda continua com a equipe (rodada 7, IA17-v2: "Tem vaga na
          // segunda as 19h" saiu da IA, e a troca nunca foi feita).
          // "mais tarde" sem dia nem hora e pergunta (rodada 14, IA15-v2: "n tem mais
          // tarde? eu saio do servico as 18" perdeu a resposta "o ultimo e 18:00").
          const pedidoDeAgenda = /\b\d{1,2}\s*(?:h|:|e\s+(?:\d{2}|meia))|\b(segunda|terca|quarta|quinta|sexta|sabado|domingo|hoje|hj|amanha|troca\w*|muda\w*|remarca\w*|outro dia|outro horario)\b/.test(semAcento(s.texto.replace(/\b(?:saio|sai|chego|servico|trabalho|escola)\b[^.!?,]{0,20}/gi, ' ')))
          if (!pulouSemDizer && respostaDaIA && perguntaLateral(s.texto) && !pedidoDeAgenda) {
            return {
              resultado: { resposta: `${respostaDaIA}\n\nPara continuar o cadastro, é só responder a pergunta acima 👆` },
              acao: 'etapa_recusada_com_resposta',
            }
          }
          // O texto da IA nao vai (rodada 7, IA17-v2): ela escreveu "Tem vaga na
          // segunda, 26/10 as 19h", a troca nunca foi feita e a consulta ficou
          // no dia errado, sem nota. O pedido vai para a equipe, que resolve.
          // A mesma frase duas vezes seguidas vira ciclo (rodada 14, IA16-v2: "q
          // pedido? eu qro trocar p sp, segunda a noite" ouviu de novo, palavra por
          // palavra, "Passei o seu pedido"). Na segunda vez, o caminho que troca na hora.
          const repetida = /Passei o seu pedido para a nossa equipe/.test(s.ultimaDoConsultorio ?? '')
          const recado = repetida
            ? 'A equipe já está com o seu pedido e confirma por aqui. Se preferir trocar agora, escreva o dia e a hora (por exemplo, "segunda às 19h") que eu troco.\n\nPara continuar o cadastro, é só responder a pergunta acima 👆'
            : 'Passei o seu pedido para a nossa equipe, que confirma por aqui.\n\nPara continuar o cadastro, é só responder a pergunta acima 👆'
          const daEquipe = await ferramentas.equipe('atendente', recado, { manterEtapa: true })
          return {
            resultado: daEquipe ?? { resposta: recado, atencao: 'atendente' },
            acao: 'etapa_recusada',
            nota: `🤖 No meio do cadastro a família escreveu algo que não é resposta do passo: «${String(s.texto).slice(0, 400)}». A IA tentou preencher a ficha com «${traduzido}»; foi recusado. Confira se ela pediu outra data ou outra coisa.`.slice(0, 1500),
          }
        }
        // Na lista de horarios, so a hora que a familia disse (rodada 12, IA13-v2,
        // alta: "n tem as 7 msm?" e a IA mandou "18:00"; o robo remarcou e
        // cancelou a consulta antiga sem a mae escolher). A hora dela vai como ela
        // disse, e o robo marca ou oferece os dois mais perto.
        if (s.etapa === 'aguardando_horario' && horaSo(traduzido) && !horarioEscolhido(s, traduzido)) {
          const daFamilia = horaUnicaDaFamilia(s.texto)
          const doRobo = daFamilia ? await ferramentas.robo(daFamilia, 'mesma') : null
          const daIA = semPromessa(semNarracao(limparTexto(campoParaFamilia(final.input), urgente)))
          return {
            resultado: doRobo && !roboNaoEntendeu(doRobo)
              ? doRobo
              : { resposta: [daIA, 'É só escolher um horário da lista acima 👆'].filter(Boolean).join('\n\n') },
            acao: 'horario_da_ia_recusado',
          }
        }
        let r = await ferramentas.robo(traduzido, 'mesma')
        // Traduziu e o robo ainda nao entendeu: o Claude nao insiste, explica.
        // O que a familia le aqui e o para_familia, como no abrir_fluxo (rodada 3
        // do painel: "Nao da para adivinhar qual dos seis, entao preciso
        // perguntar" saiu em cima do "Nao entendi" do robo).
        if (roboNaoEntendeu(r)) {
          // Sem promessa (rodada 8, IA21-v2: "Anotei o nome da Sofia" com o robo
          // recusando, e nada gravado).
          return { resultado: juntar(r, semPromessa(semNarracao(limparTexto(campoParaFamilia(final.input), urgente)))), acao: 'etapa_sem_sucesso' }
        }
        // "Prefiro Sao Paulo, tem segunda?": a unidade troca aqui, e o dia e o
        // horario ditos junto seguem como no agendar.
        r = await seguirComOPedido(ferramentas, r, { dia: final.input?.dia, horario: final.input?.horario })
        // A traducao vale pelo resultado do robo; o texto do Claude so atrapalharia.
        // A pergunta que veio junto do passo ("santos. mas ele atende 17?") vai
        // respondida antes da tela seguinte, no para_familia (rodada 5 do painel).
        // Sem promessa tambem aqui (rodada 9: "ja peco a troca" saiu em cima do
        // passo seguinte, e a troca nao tinha sido feita).
        const resposta = semPromessa(semNarracao(limparTexto(campoParaFamilia(final.input), urgente)))
        // O passo e a equipe na mesma vez (rodada 5, IA07-v2): "bernardo nogueira
        // costa. ah e devo parar de toma leite?" - a IA traduziu o nome e chamou
        // a equipe, e a chamada era jogada fora sem aviso; a mae perguntou de novo
        // duas mensagens depois. Agora o passo segue, e a duvida vai para a equipe
        // com o passo mantido, o recado da IA antes da proxima pergunta.
        const junto = usos.find((u) => u.name === 'chamar_equipe' && u.input?.motivo !== 'urgencia')
        if (junto && r) {
          const recado = semNarracao(limparTexto((campoParaFamilia(junto.input) || String(junto.input?.texto ?? '')), urgente))
          const motivoJunto = String(junto.input?.motivo ?? 'pessoa')
          const aviso = recado && !falaComAEquipe(recado) ? recado : AVISO_PADRAO
          const daEquipe = await ferramentas.equipe(MOTIVOS[motivoJunto] ?? 'atendente', aviso, { manterEtapa: true })
          const resumo = String(junto.input?.resumo_para_equipe ?? '').trim() || `(sem resumo) ${String(s.texto).slice(0, 300)}`
          return {
            // O mesmo recado nos dois campos sai uma vez so (rodada 7, IA11-v2: a
            // resposta do pix saiu duas vezes na mesma mensagem).
            resultado: { ...juntar(r, [resposta, resposta && quaseIgual(aviso, resposta) ? '' : aviso].filter(Boolean).join('\n\n')), atencao: daEquipe?.atencao ?? 'atendente' },
            acao: `etapa + equipe:${motivoJunto}`,
            nota: `🤖 Resumo da IA para a equipe: ${resumo}`.slice(0, 1500),
          }
        }
        return { resultado: r ? juntar(r, resposta) : { resposta: resposta || texto || 'Certo!' }, acao: 'etapa' }
      }
      if (final.name === 'chamar_equipe') {
        // Pergunta hipotetica, sem sinal de alarme e sem urgencia aberta, nao e
        // urgencia (rodada 14, IA08-v1 e IA07-v2, altas: "Se acontecer depois das
        // 18h, eu levo no pronto-socorro ou espero?" mandou alerta ao medico por uma
        // bebe que estava otima). A equipe fica sabendo como pergunta medica, e o
        // pronto-socorro condicional da IA fica no texto.
        const hipotetica =
          /\b(?:e\s+)?se\s+(?:\S+\s+){0,4}?(?:acontecer|tiver|vier|ficar|piorar|aparecer|subir|voltar|der|quiser)\b/i.test(semAcento(s.texto)) &&
          !sinalDeAlarme(s.texto.replace(/\b(?:e\s+)?se\s+[^.!?]*[.!?]?/gi, ' ')) &&
          !conversaDeUrgencia(s)
        const motivo = String(final.input?.motivo ?? 'pessoa') === 'urgencia' && hipotetica ? 'medico' : String(final.input?.motivo ?? 'pessoa')
        // `texto` era o nome do campo ate 16/10/2026; continua valendo.
        const escrito = (campoParaFamilia(final.input) || String(final.input?.texto ?? ''))
        let resumo = String(final.input?.resumo_para_equipe ?? '').trim()
        let aviso = semNarracao(semRepetir(limparTexto(escrito, urgente), ultimaNossa)) || texto || AVISO_PADRAO
        if (falaComAEquipe(aviso)) {
          console.warn('Atendente com IA escreveu para a equipe no texto da familia; vai como nota interna', aviso.slice(0, 200))
          resumo = [resumo, aviso].filter(Boolean).join('\n\n')
          // Na urgencia, a troca nunca pode enfraquecer o recado (rodada 5,
          // critica): se a IA mandava ao pronto-socorro, a familia ouve isso, firme.
          aviso =
            motivo !== 'urgencia'
              ? AVISO_PADRAO
              : PRONTO_SOCORRO.test(aviso)
                ? `🚨 Procure agora o pronto-socorro mais próximo ou ligue 192, sem esperar resposta por aqui. Já avisei ${s.quemAtende}.`
                : `🚨 Entendo a preocupação. Já avisei ${s.quemAtende}, que vai avaliar o que você contou e responder por aqui.`
        }
        // Urgencia sem pronto-socorro no texto (17/10/2026): a instrucao pede,
        // mas e a frase que nao pode faltar. Vai no fim, condicionada ao risco
        // de vida: na urgencia comum quem resolve e a consulta (pedido do Edu).
        // Uma vez por conversa (rodada 5, IA05: o aviso saiu em 3 e 4 respostas
        // seguidas da mesma urgencia): se a ultima mensagem nossa ja tinha o
        // pronto-socorro, nao repete.
        // Valor perguntado e nao dito (rodada 8, IA19-v1): "queria saber o valor
        // da consulta e se da pra parcelar" ouviu so "sobre parcelar, vou
        // confirmar com a equipe", e a mae teve de perguntar "e o valor?".
        // So pergunta de preco, e so quando nos ainda nao dissemos (rodada 12,
        // IA18-v1 e IA19-v2: "e esse valor eu pago no dia ou antes?" e "perco o
        // valor?" receberam a tabela inteira pela terceira vez).
        if (motivo !== 'urgencia' && valorPedidoENaoDito(s) && !/R\$/.test(aviso)) {
          const valores = valoresDaClinica(s.conhecimento)
          if (valores) aviso = `${valores}\n\n${aviso}`
        }
        // Piora numa urgencia que ja estava aberta: o medico e avisado de novo
        // (rodada 6 do painel; ver Resultado.piora e deveAlertar).
        // Rodada 8: com a urgencia aberta, qualquer chamada reavisava, e o medico
        // recebeu de 4 a 6 alertas numa noite, quase todos sem nada novo. So a
        // piora contada ou um sinal de alarme que ainda nao tinha aparecido
        // reavisam.
        const sinalAgora = sinalDeAlarme(s.texto)
        const sinalNovo = Boolean(sinalAgora) && !s.historico.some((m) => m.de === 'familia' && sinalDeAlarme(m.texto)?.nome === sinalAgora?.nome)
        const piora = motivo === 'urgencia' && conversaDeUrgencia(s) && (contaPiora(s.texto) || sinalNovo)
        // E a familia ouve isso na primeira frase (rodada 8, IA05-v2, critica:
        // "voltamo do ps... agr ele ta mt molinho e a febre voltou" ouviu a
        // consulta das 14:30 e "se piorar, volte ao pronto-socorro").
        if (piora) {
          // Toda frase condicional ("Se ele ficar ainda mais molinho...") e toda
          // que confirma a consulta sai (rodada 10, IA05-v2, critica: "A consulta
          // de hoje as 15:10 esta confirmada. Se ele ficar ainda mais molinho,
          // procure o pronto-socorro agora" passou inteira).
          aviso = aviso
            .split('\n')
            .map((linha) => linha.split(FIM_DE_FRASE).filter((f) => !/^\s*se\b|\bse\s+(?:\S+\s+)?piorar\b|\bse for uma emerg[eê]ncia\b|continua marcada|est[aá] confirmada|est[aá] marcada|consulta d[aeo]\b[^.!?\n]{0,40}\b(?:confirmad|marcad|mantid)|hor[aá]rio mais pr[oó]ximo/i.test(f)).join(' '))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
          // O "agora" tem de estar numa frase firme com o pronto-socorro, e nao no
          // "Avisei o Dr. Marcello agora".
          const firme = aviso
            .split(/\n|(?<=[.!?])\s+/)
            .some((f) => PRONTO_SOCORRO.test(f) && /\bagora\b/i.test(f) && !/^\s*se\b|\bse\s+(?:ele|ela|a crian[cç]a|o beb[eê]|piorar|ficar)\b/i.test(f))
          if (!firme) {
            aviso = [`🚨 Se piorou, não espere a nossa resposta nem a consulta: procure agora o pronto-socorro mais próximo ou ligue 192. Já avisei ${s.quemAtende} de novo.`, aviso].filter(Boolean).join('\n\n')
          }
        }
        // Risco de vida: sem oferta de consulta e sem a frase condicional
        // (rodada 7 do painel). O pronto-socorro vai firme, mesmo repetido.
        // Indo ou de volta do pronto-socorro, a pergunta da consulta e respondida
        // (rodada 14, IA02-v1: "vou levar ela de volta agora. A consulta de segunda
        // continua de pe?" perdeu o "sim" para a trava).
        const vida = motivo === 'urgencia' && riscoDeVida(s) && !jaNoProntoSocorro(s)
        // O pronto-socorro agora da propria IA, nesta resposta, tira a oferta de
        // horario dela (rodada 14, IA02-v2, alta: "borra escura tipo cafe" e, no mesmo
        // texto, "o horario mais proximo e sabado as 14:30"; a mae marcou o sabado).
        const firmeAgora = aviso.split(FIM_DE_FRASE).some((f) => !/^\s*(?:🚨\s*)?\*?se\b/i.test(f) && PRONTO_SOCORRO.test(f) && /\bagora\b/i.test(f))
        if (vida) {
          // A mesma trava das outras respostas (rodada 10, IA01-v1: "nao espere ate
          // quarta... so um exame no pronto-socorro mostra" saiu sem "agora" e sem 192).
          aviso = comProntoSocorroAgora(semOfertaDeMarcar(aviso), s)
        } else if (motivo === 'urgencia' && firmeAgora && !jaNoProntoSocorro(s)) {
          aviso = semOfertaDeMarcar(aviso)
        } else if (!piora && motivo === 'urgencia' && !PRONTO_SOCORRO.test(aviso) && !PRONTO_SOCORRO.test(s.ultimaDoConsultorio ?? '')) {
          aviso = `${aviso}\n\n${AVISO_DE_URGENCIA}`
        }
        // Duvida no meio do cadastro ou da lista de horarios: a equipe fica
        // sabendo e o passo continua aberto (ver Ferramentas.equipe). Urgencia
        // sai do fluxo, como sempre.
        // A ficha do paciente fica aberta mesmo na urgencia (rodada 3 do painel,
        // IA03-v2): a consulta ja esta guardada, e a urgencia que tirava a
        // conversa da ficha deixava a consulta das 15h sem crianca - a IA
        // ainda disse "Lucas anotado" sem nada gravado.
        const manterEtapa = emEtapa && (motivo !== 'urgencia' || fichaAberta(s))
        // So quando a IA ja nao lembrou o passo (rodada 2: o lembrete saia duas
        // vezes, o da IA e este).
        if (manterEtapa && !adiou(s) && !/continu|pergunta acima|👆|\?\s*$/i.test(aviso)) {
          aviso = `${aviso}\n\nPara continuar de onde paramos, é só responder a pergunta acima 👆`
        }
        // Sem resumo, a nota leva o que a familia leu (painel com IA: a IA disse
        // "passei para a equipe que voce precisa hoje" e nenhuma nota foi gravada).
        if (!resumo) resumo = `(sem resumo) ${String(s.texto).slice(0, 300)}`
        // "Avisei o Dr. Marcello de novo" sem alerta novo (rodada 10, IA02-v2): sem
        // piora, a frase sai - o alerta so sai de novo com piora.
        if (!piora) {
          aviso = aviso
            .split('\n')
            .map((linha) => linha.split(FIM_DE_FRASE).filter((f) => !/\bavis\w*\b(?:[^.!?\n]|\bDra?\.){0,50}\b(?:de novo|novamente|outra vez)\b/i.test(f)).join(' '))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim() || AVISO_PADRAO
        }
        const daEquipe = await ferramentas.equipe(MOTIVOS[motivo] ?? 'atendente', aviso.slice(0, 900), { manterEtapa })
        return {
          resultado: piora && daEquipe ? { ...daEquipe, piora: true } : daEquipe,
          acao: `equipe:${motivo}${manterEtapa ? ' (passo mantido)' : ''}${piora ? ' (piora)' : ''}`,
          nota: `🤖 Resumo da IA para a equipe: ${resumo}`.slice(0, 1500),
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

/**
 * O agendamento ja na unidade e no dia combinados (17/10/2026).
 *
 * No teste do Edu a IA disse "Atende sim, aos sabados em Sao Paulo... Quer que
 * eu siga com o agendamento?", e o "sim" abria "Em qual unidade?": a mae tinha
 * de escolher de novo o que acabara de combinar. Aqui o fluxo e aberto como
 * sempre e, a cada passo, o robo recebe a unidade e depois o dia como se a
 * familia os tivesse digitado - com as regras dele (convenio, telemedicina,
 * "nesta unidade nao tem sabado"). So avanca enquanto o robo estiver num passo
 * que o pedido responde: ja tem consulta ou pergunta de convenio param o atalho
 * ali, e o robo pergunta como sempre.
 *
 * Painel com IA (17/10/2026): a crianca e o horario tambem. "Quero marcar pro
 * Theo" perguntava "Para quem e a consulta?" com a Helena em primeiro; "pode
 * ser dia 28 as 16:40" abria a lista do dia 28 e pedia o numero do horario.
 * O horario so vem quando a familia escolheu um: ai ele fica guardado na hora,
 * e o cadastro e o questionario do paciente novo seguem do jeito de sempre.
 */
async function seguirComOPedido(
  ferramentas: Ferramentas,
  aberto: Resultado | null,
  pedido: { paciente?: unknown; unidade?: unknown; dia?: unknown; horario?: unknown; maisUma?: boolean },
): Promise<Resultado | null> {
  if (!ferramentas.etapa) return aberto
  const respostas: Record<string, string> = {
    // Ja tem consulta e o pedido e de outra (rodada 10, IA12-v1: "pode marcar a
    // Helena hoje tambem, as 17:20?" parou em "Remarcar ou marcar mais uma" e a
    // mae repetiu unidade, dia e hora). Com o pedido dito, e "marcar mais uma".
    // So com "tambem"/"mais uma" dito: sem isso, quem ja tem consulta quase
    // sempre quer trocar a data, e o robo pergunta.
    ja_tem_consulta: pedido.maisUma ? '2' : '',
    aguardando_paciente: String(pedido.paciente ?? '').trim(),
    aguardando_unidade: String(pedido.unidade ?? '').trim(),
    aguardando_dia: String(pedido.dia ?? '').trim(),
    aguardando_horario: String(pedido.horario ?? '').trim(),
  }
  let atual = aberto
  for (let passo = 0; passo < 5; passo++) {
    const etapa = await ferramentas.etapa()
    // Remarcar abre direto nas datas da unidade atual: se a familia pediu outra,
    // a unidade vai antes do dia (o robo troca de unidade pelo nome).
    const chave = etapa === 'aguardando_dia' && respostas.aguardando_unidade ? 'aguardando_unidade' : etapa
    const texto = chave ? respostas[chave] : ''
    if (!texto) break
    // Cada parte do pedido vale uma vez: o robo que voltou ao mesmo passo nao
    // entendeu, e repetir seria um laco.
    respostas[chave as string] = ''
    const r = await ferramentas.robo(texto.slice(0, 60), 'atual')
    // O robo nao entendeu: vale a pergunta anterior, que ainda esta de pe.
    if (!r || roboNaoEntendeu(r)) break
    // Os dois mais perto vao junto da lista, e nao no lugar dela (rodada 13,
    // IA21-v1: "Responda com o numero da lista acima", sem lista nenhuma na tela).
    if (chave === 'aguardando_horario' && atual && /Os mais perto são/.test(r.resposta)) {
      atual = { ...atual, resposta: `${atual.resposta}\n\n${r.resposta}` }
      break
    }
    atual = r
  }
  return atual
}

/**
 * A trava de conduta (16/10/2026), sem apagar a urgencia (17/10/2026).
 *
 * Painel com IA: na febre de um bebe de 7 semanas a IA chamou a equipe com
 * urgencia, a trava trocou o texto pela frase padrao e mandou a conversa como
 * "atendente" - o alerta ao medico so saiu na mensagem seguinte, porque a mae
 * insistiu. Agora a urgencia continua urgencia (alerta, horario mais proximo,
 * pronto-socorro no rodape). A frase padrao nao se repete igual na mensagem
 * seguinte, e a nota da equipe conta o que a IA tinha escrito, em vez de dizer
 * que ela "ia orientar remedio" quando estava recusando.
 */
async function travarConduta(
  s: Situacao,
  ferramentas: Ferramentas,
  bruto: string,
  usos: Extract<Bloco, { type: 'tool_use' }>[],
  resumo: string,
  emEtapa: boolean,
): Promise<{ resultado: Resultado; acao: string; nota: string }> {
  const urgencia =
    usos.some((u) => u.name === 'chamar_equipe' && u.input?.motivo === 'urgencia') ||
    familiaFalouDeUrgencia(s.texto) ||
    Boolean(sinalDeAlarme(s.texto)) ||
    // "Posso dar dipirona?" depois da dor forte (rodada 3, IA04): a conversa ja
    // e de urgencia, mesmo que a pergunta de agora nao seja.
    conversaDeUrgencia(s)
  const jaDisse = /quem orienta [eé]/i.test(s.ultimaDoConsultorio ?? '')
  const fechado = !dentroDoExpediente(s.agora)
  const nota =
    '🤖 A resposta da IA citava remédio ou dose numa mensagem com sintoma; por segurança saiu a frase padrão.' +
    (resumo.trim() ? `\nResumo da IA: ${resumo.trim()}` : '') +
    `\nO que a IA tinha escrito: «${bruto.slice(0, 600)}»`
  if (urgencia) {
    // Risco de vida (rodada 7 do painel): pronto-socorro firme e sem botao de
    // marcar, como na resposta pronta do robo. A frase condicional ("se for uma
    // emergencia...") e o "Marcar uma consulta" diziam o contrario do que a
    // conversa pedia.
    // O pronto-socorro "agora" que a IA ja tinha escrito tambem fica (rodada 8,
    // IA05-v2: "nao espere: leve ele agora a um pronto-socorro" virou a frase
    // condicional da urgencia comum, as 23h).
    // So a frase firme, sem "Se" na frente (rodada 12, IA05-v1: "Se ele ficar
    // muito molinho... procure o pronto-socorro mais proximo agora" virou "Procure
    // agora o pronto-socorro", sem fato novo).
    const vida = riscoDeVida(s) || bruto.split(FIM_DE_FRASE).some((f) => !/^\s*(?:🚨\s*)?\*?se\b/i.test(f) && /\bagora\b[^.!?\n]{0,60}pronto[\s-]?socorro|pronto[\s-]?socorro[^.!?\n]{0,30}\bagora\b/i.test(f))
    const aviso = vida
      ? `🚨 Procure agora o pronto-socorro mais próximo ou ligue 192, sem esperar resposta por aqui. Já avisei ${s.quemAtende}. Remédio e dose, só com a orientação médica.`
      : `🚨 Entendo a preocupação. Já avisei ${s.quemAtende}, que vai avaliar o que você contou e responder por aqui. ` +
        'Remédio e dose, só com a orientação médica.\n\n' +
        AVISO_DE_URGENCIA
    const r = await ferramentas.equipe('urgencia', aviso, { manterEtapa: emEtapa && fichaAberta(s) })
    const resultado = s.canal === 'Instagram' ? r : vida ? (r ?? { resposta: aviso, atencao: 'urgencia' }) : comOfertaDeHorario(r ?? { resposta: aviso, atencao: 'urgencia' })
    return { resultado, acao: 'equipe:urgencia (trava de conduta)', nota }
  }
  const aviso = jaDisse
    ? `Como falei, remédio e dose quem orienta é ${s.quemAtende}, e a equipe já está com a sua mensagem.`
    : `Sobre o que fazer agora, quem orienta é ${s.quemAtende}: já passei para a equipe, que responde por aqui.`
  const continuar = emEtapa ? '\n\nPara continuar de onde paramos, é só responder a pergunta acima 👆' : ''
  return {
    resultado: await ferramentas.equipe(
      'atendente',
      aviso + (fechado ? ' Se a criança estiver mal, procure o pronto-socorro mais próximo ou ligue 192.' : '') + continuar,
      { manterEtapa: emEtapa },
    ),
    acao: 'equipe:medico (trava de conduta)',
    nota,
  }
}

/**
 * Pergunta de verdade junto da resposta de um passo (rodada 5 do painel): "?" ou
 * palavra de pergunta ("e o pix eu mando pra onde", rodada 6, veio sem "?"), e
 * uma palavra que nao e enchimento, nome de unidade, dia ou periodo.
 */
const ENCHIMENTO_DO_PASSO = new Set([
  'pode', 'ser', 'as', 'sim', 'ok', 'quero', 'esse', 'essa', 'este', 'esta', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'pra',
  'mesmo', 'msm', 'entao', 'horario', 'dia', 'hoje', 'amanha', 'tem', 'isso', 'por', 'favor', 'obrigado', 'obrigada', 'ne', 'ta',
  'certo', 'santos', 'sao', 'paulo', 'sp', 'ibirapuera', 'livance', 'telemedicina', 'video', 'online', 'segunda', 'terca', 'quarta',
  'quinta', 'sexta', 'sabado', 'domingo', 'pensando', 'bem', 'melhor', 'prefiro', 'vdd', 'verdade', 'ah', 'oi', 'um', 'uma', 'ou',
  'tudo', 'pronto', 'tarde', 'manha', 'noite', 'otimo', 'otima', 'seria', 'bom', 'boa', 'perfeito', 'ai', 'la', 'aqui', 'hora',
  'horas', 'cedo', 'mais',
])
// Sem "preciso" e "precisa" (rodada 7): "preciso mudar a consulta" e pedido,
// nao pergunta, e a IA repetia a tela logo acima dela.
// "Ela pode ir sozinha ou tem q ir com responsavel" (rodada 7, IA22): sem "?",
// a pergunta sumia na ficha duas vezes.
// Rodada 8: "8h. e ate la do ou n" (IA06), correcao de nome ("e arruma o nome
// dele q escrevi trocado", IA03) e "ela msm assina os papel" (IA24). Rodada 9:
// "e o nome e com s, luisa" e "faltou o Henrique no nome" (IA16).
// "qnto", "qto" (rodada 12, IA19-v2: "oi qnto ta" nao era pergunta). Recado para
// o medico tambem (IA14-v2: "isso cancela. e avisa o dr q ela parou c a dor"
// cancelou, e o recado so chegou a equipe quando a mae escreveu de novo).
// Rodada 13: "conta pro dr" (IA14-v2) e "qnts", "vlr", "valores", "precos" (IA17).
const PALAVRA_DE_PERGUNTA = /\b(onde|como|quando|quanto|quanta|qnto|qnta|qnt|qnts|qto|qta|vlr|valores|precos|qual|quais|avisa|avise|fala pro|fala pra|diz pro|diz pra|conta pro|conta pra|recado|pede pro|pede pra|posso|devo|paro|tiro|corto|por que|porque|ou nao|ou n|pode ir|tem q(ue)? ir|ou tem q(ue)?|precisa (ir|levar|trazer)|errad[oa]|errei|trocado|arruma|corrig\w*|assina|sozinh[oa]|com (s|z|ss|ph|th|y|k|w|h|i|acento|cedilha)|faltou|esqueci|com (2|dois|duas) \w+|se escreve|escreve com)\b/
// Assunto que, no meio da ficha, e pergunta mesmo sem "?" (rodada 7, IA09-v2:
// "pedro henrique lima. tem estacionamento la" perdeu o estacionamento).
const ASSUNTO_DE_PERGUNTA =
  /\b(estacionamento|endereco|valor|preco|pix|pagamento|pagar|convenio|plano|reembolso|atestado|relatorio|receita|exames?|retorno|desconto|parcela|parcelar|cartao|unimed|amil|bradesco|sulamerica|demora|documentos?)\b/

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * `amplo`: nos passos do agendamento (unidade, dia, horario), a resposta e curta
 * - "santos", "sexta 8h" -, e tres palavras a mais ja sao outro assunto, mesmo
 * sem "?" (rodada 6: "santos e presisa de pedido da pediatra pra consulta"). Na
 * ficha nao: o nome da crianca tem tres palavras e nao e pergunta.
 */
export function perguntaLateral(texto: string, amplo = false): boolean {
  const t = semAcento(texto)
  const palavras = t
    .replace(/\S+@\S+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1 && !ENCHIMENTO_DO_PASSO.has(p))
  if (texto.includes('?') || PALAVRA_DE_PERGUNTA.test(t) || ASSUNTO_DE_PERGUNTA.test(t)) return palavras.length >= 1
  return amplo && palavras.length >= 3
}

const PASSO_DO_AGENDAMENTO = /^aguardando_(unidade|dia|horario|convenio)$/

/** A mensagem sem as frases do pedido de troca de horario (que o robo ja fez). */
function semPedidoDeTroca(texto: string): string {
  return texto
    .split(/(?<=[?.!])\s+/)
    .filter((frase) => !/\b(troca\w*|muda\w*|remarca\w*)\b|\b\d{1,2}\s*(?:[:h]\s*\d{0,2}|\s+e\s+(?:\d{2}|meia))/i.test(semAcento(frase)))
    .join(' ')
    .trim()
}

/** O texto e so um horario ("18:20", "9h20", "as 19h"). */
function horaSo(t: string): boolean {
  return /^\s*(?:[àa]s\s+)?\d{1,2}\s*(?:[:h]\s*\d{0,2})?\s*(?:h|hs|horas)?\s*$/i.test(t)
}

/** A familia disse que nao tem, nao sabe ou quer pular (para o PULAR da IA). */
const FAMILIA_PULOU = /\b(pular|pula|pulo|nao sei|n sei|nao tenho|n tenho|nao tem|n tem|nao lembro|n lembro|sem cpf|sem email|sem e-mail|nao possui|nao uso|depois|mando depois)\b/

/** Toda palavra do texto traduzido aparece no que a familia escreveu (ou e PULAR). */
function veioDaFamilia(traduzido: string, daFamilia: string): boolean {
  const escrito = semAcento(daFamilia)
  const palavras = semAcento(traduzido).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((p) => p.length >= 3)
  if (palavras.length === 0) return true
  if (palavras.length === 1 && palavras[0] === 'pular') return true
  return palavras.every((p) => escrito.includes(p))
}

const SO_A_PERGUNTA =
  'A família respondeu o passo do sistema, e o sistema já seguiu: a tela dele vai logo depois do seu texto (ela está no fim destas instruções). ' +
  'A mensagem dela também trazia uma pergunta. Responda só essa pergunta, em uma ou duas frases, falando com ela, com o que está em <clinica> ou na tela do sistema. ' +
  'Se a tela do sistema já responde (o horário guardado, os dias da lista), diga isso em poucas palavras, sem contradizer a tela; se não houver o que acrescentar, não escreva nada. ' +
  'Não repita o passo, não peça dados, não ofereça marcar. ' +
  'Nunca diga o que fazer com a criança, a dieta, a amamentação ou o remédio, nem "não mude nada": isso é do médico. ' +
  'Pergunta da equipe (conduta, documento, exceção, dinheiro, pix): use chamar_equipe, com a resposta para a família em para_familia. ' +
  // Rodada 8 (IA24-v1): "Mas voce nao chegou a pegar o nome dela: e Julia
  // Ribeiro Mendes" foi ignorado, sem nota.
  'Correção de um dado já respondido (o nome escrito errado, outra data): use chamar_equipe com a correção no resumo, e diga que a equipe corrige. ' +
  'Nunca prometa fazer algo depois (trocar o horário depois da ficha, avisar, anotar): ou a tela já mostra, ou a equipe resolve.'

// A pergunta solta no meio do passo (18/10/2026, conversa real: "Ele atende
// convenios?" na escolha da unidade). O sistema nao seguiu: vai mandar a mesma
// tela de novo. A IA so responde a duvida; a tela, com os numeros e os horarios
// livres, e a do robo.
const SO_A_DUVIDA =
  'A família está num passo do agendamento e, em vez de responder, fez uma pergunta. O sistema vai mandar a tela do passo de novo logo depois do seu texto (ela está no fim destas instruções). ' +
  'Responda só essa pergunta, em uma ou duas frases, falando com ela, com o que está em <clinica>. ' +
  'Não repita a tela nem a pergunta do passo, não liste as unidades, não peça para escolher, não ofereça marcar. ' +
  'Valor da consulta só se ela perguntou de valor ou preço. ' +
  'Nunca diga o que fazer com a criança, a dieta, a amamentação ou o remédio: isso é do médico. ' +
  'Pergunta da equipe (conduta, documento, exceção, dinheiro, pix): use chamar_equipe, com a resposta para a família em para_familia. ' +
  'Nunca prometa fazer algo depois (avisar, anotar, reservar): ou a tela já mostra, ou a equipe resolve.'

// Pedido para mudar o rumo do agendamento nao e duvida: a IA de conversa
// resolve com as ferramentas (trocar de unidade, de filho, voltar).
const PEDIDO_NO_PASSO = /\b(troca\w*|muda\w*|remarca\w*|outr[ao]s?|volta\w*|cancel\w*|desist\w*)\b/

/**
 * A tela do passo que o robo mandaria de novo: a que ele separou (Resultado.tela)
 * ou, sem ela, a instrucao "Responda com o numero..." do fim da resposta dele,
 * sem a resposta pronta da frente.
 */
function telaDoPasso(r: Resultado | null): string | null {
  if (!r) return null
  if (r.tela) return r.tela
  // "Nao entendi. Responda..." ou "<resposta pronta>\n\nResponda...".
  const achado = /(?:^|\n\n|\.\s)(Responda\b[\s\S]*)$/.exec(r.resposta)
  return achado ? achado[1].trim() : null
}

// Conduta sobre dieta e amamentacao (rodada 6 do painel): "ate la, melhor nao
// mudar nada por conta propria" para a mae que amamenta um bebe com sangue nas
// fezes. A trava de remedio (CONDUTA) nao pegava.
const CONDUTA_DE_DIETA =
  /\bn[aã]o\s+(d[eê]|ofere[cç]a|fa[cç]a)\s+nada\b|\bn[aã]o\s+mude\b|\bn[aã]o\s+mudar\s+nada\b|\b(mantenha|continue|pare|suspenda|tire|retire|corte|evite|volte)\b[^.!?\n]{0,30}\b(leite|dieta|alimenta[cç][aã]o|derivados|lactose|mamadas?|amamenta\w*|f[oó]rmula|peito)\b/i

type Lateral = { texto: string; equipe?: { motivo: string; resumo: string } }

async function responderPerguntaLateral(s: Situacao, tela: string, chamar: ChamarClaude, modelo: string, prazoMs: number, instrucao = SO_A_PERGUNTA): Promise<Lateral> {
  const resposta = await chamar(
    {
      model: modelo,
      max_tokens: 600,
      thinking: { type: 'between_tools' },
      system: [
        ...sistemaDoClaude(s, false),
        { type: 'text', text: `${instrucao}\n\nA tela do sistema, que vai logo depois do seu texto:\n«${semDadosPessoais(tela).slice(0, 900)}»` },
      ],
      // So a ferramenta da equipe (rodada 6): sem nenhuma, a IA escreveu a
      // chamada como texto e o JSON cru chegou a mae.
      tools: ferramentasDoClaude(false).filter((f) => f.name === 'chamar_equipe'),
      messages: [{ role: 'user', content: contexto(s) }],
    },
    prazoMs,
  )
  const blocos = Array.isArray(resposta?.content) ? resposta.content : []
  const uso = blocos.find((b): b is Extract<Bloco, { type: 'tool_use' }> => b.type === 'tool_use' && b.name === 'chamar_equipe')
  const solto = blocos
    .filter((b): b is Extract<Bloco, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  // Texto solto junto de uma ferramenta que nao foi oferecida e o rascunho dela
  // (rodada 11, IA09-v2: a IA chamou ver_horarios e a mae leu "O usuario
  // perguntou se ha horario no sabado. Preciso consultar a agenda.").
  const outraFerramenta = blocos.some((b) => b.type === 'tool_use' && b.name !== 'chamar_equipe')
  const bruto = uso ? campoParaFamilia(uso.input) : outraFerramenta ? '' : solto
  let texto = semPromessa(semNarracao(limparTexto(bruto, familiaFalouDeUrgencia(s.texto) || conversaDeUrgencia(s)))).slice(0, 700)
  let equipe = uso
    ? { motivo: String(uso.input?.motivo ?? 'medico'), resumo: String(uso.input?.resumo_para_equipe ?? '').trim() || s.texto.slice(0, 300) }
    : undefined
  // Conduta nao sai nem aqui: vai a frase de quem orienta, e a equipe fica sabendo.
  if (orientouConduta(texto) || CONDUTA_DE_DIETA.test(texto)) {
    texto = `Sobre isso, quem orienta é ${s.quemAtende}: já passei para a equipe, que responde por aqui.`
    equipe = { motivo: 'medico', resumo: equipe?.resumo || s.texto.slice(0, 300) }
  }
  return { texto, equipe }
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
  /** Texto do item tocado, quando a mensagem foi um toque (ver esperarOAssunto). */
  tituloDoToque?: string | null
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
  // 15 s desde 17/10/2026: o Sonnet com duas voltas de ver_horarios passava dos
  // 12, e a urgencia caia no robo. "todas" num ver_horarios so tirou voltas.
  const prazo = opcoes.prazoMs ?? 15_000
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
  if (doRobo) {
    const doRoboAgora = await roboDireto()
    // Sinal de alarme logo depois do aviso de urgencia: o robo cala para nao
    // repetir o texto pronto (mandadoHaPouco). Mas a mae perguntou alguma coisa
    // (rodada 2 do painel: "e ate as 15h? ele nao para de vomitar" ficou sem
    // resposta), e quem responde e a IA, que le a conversa toda.
    if (doRoboAgora || doRobo !== 'urgencia') {
      // Foto numa conversa de risco de vida, com a familia ainda em casa (rodada
      // 10, IA01-v2 e IA02-v1: "tirei foto do vomito pro Dr. Marcello ver amanha"
      // ouviu que a equipe responde na segunda, e "se piorar, pronto-socorro").
      // O pronto-socorro vai firme, sem o "se piorar".
      const fotoNoRisco = doRobo === 'anexo' && doRoboAgora && riscoDeVida(situacao) && !jaNoProntoSocorro(situacao)
      const resultado = fotoNoRisco && doRoboAgora
        ? { ...doRoboAgora, resposta: comProntoSocorroAgora(doRoboAgora.resposta.replace(/\n*Se piorar, não espere[^\n]*/g, ''), situacao), atencao: 'urgencia' as const }
        : doRoboAgora
      return { resultado, origem: 'robo', eventos: [{ evento: 'ia_passou_ao_robo', detalhe: doRobo }] }
    }
  }

  // Conversa encerrada e a familia so mandou um emoji ou "perfeito": silencio,
  // sem chamar o Claude (ver soFechamento). Em etapa do agendamento quem
  // decide e o robo, mais abaixo.
  if (!emEtapa && fechouSemPergunta(situacao)) {
    return { resultado: null, origem: 'robo', eventos: [{ evento: 'ia_calou_no_fechamento' }] }
  }

  // Pediu a equipe sem dizer para que: primeiro o assunto (ver esperarOAssunto).
  // A etapa fica como esta: a resposta seguinte segue dela.
  const pedidoDeEquipe = esperarOAssunto({
    texto: situacao.texto,
    titulo: opcoes.tituloDoToque,
    etapa: situacao.etapa,
    ultimaDoConsultorio: situacao.ultimaDoConsultorio,
    equipeConversando: situacao.equipeConversando,
  })
  if (pedidoDeEquipe === 'esperar') {
    return { resultado: { resposta: ESPERA_DO_ASSUNTO }, origem: 'robo', eventos: [{ evento: 'equipe_espera_assunto' }] }
  }
  if (pedidoDeEquipe === 'equipe') {
    return {
      resultado: await ferramentas.equipe('atendente', EQUIPE_DEPOIS_DA_ESPERA),
      origem: 'robo',
      eventos: [{ evento: 'equipe_insistiu' }],
    }
  }

  if (emEtapa) {
    let doRoboNaEtapa = await roboDireto()
    // A unidade e o dia na mesma frase (rodada 13, IA16-v1: "Santos, como eu
    // falei. Sexta de manha." abriu a lista de datas, e a mae escolheu de novo):
    // com as datas na tela, o dia dito segue.
    if (situacao.etapa === 'aguardando_unidade' && doRoboNaEtapa && !naoEntendeu(doRoboNaEtapa) && ferramentas.etapa && (await ferramentas.etapa()) === 'aguardando_dia') {
      const t = semAcento(situacao.texto)
      const achado = t.match(/\b(?:segunda|terca|quarta|quinta|sexta|sabado|domingo|hoje|amanha)\b(?:\s+(?:que|q)\s+vem)?|\b\d{1,2}\/\d{1,2}\b/)
      // "hoje n da" e recusa: o dia recusado nao segue.
      const recusado = achado && /^\s*(?:\S+\s+)?(?:n|nao)\b/.test(t.slice((achado.index ?? 0) + achado[0].length))
      const dia = achado && !recusado ? achado[0] : ''
      if (dia) {
        const comODia = await ferramentas.robo(dia, 'atual')
        if (comODia && !roboNaoEntendeu(comODia)) doRoboNaEtapa = comODia
      }
    }
    if (!naoEntendeu(doRoboNaEtapa)) {
      // O robo entendeu o passo, mas a mensagem trazia tambem uma pergunta
      // (rodada 5 do painel, IA16): "14/09/2018. Ah, e o valor em Sao Paulo e o
      // mesmo?" gravou a data, seguiu para a proxima pergunta e engoliu o valor
      // tres vezes. A IA responde so a pergunta, antes da tela do robo.
      // A troca de horario feita pelo robo ja responde o pedido (rodada 8): a IA
      // por cima so repetiria, ou prometeria de novo.
      // Mas a pergunta que veio junto da troca continua (rodada 9, IA10-v2: "da pra
      // trocar pra 10 e 40? e aceita cartao?" trocou e o cartao sumiu).
      const trocouNaFicha = /Horário trocado/.test(doRoboNaEtapa?.resposta ?? '')
      const temPergunta = trocouNaFicha
        ? perguntaLateral(semPedidoDeTroca(situacao.texto))
        : perguntaLateral(situacao.texto, PASSO_DO_AGENDAMENTO.test(situacao.etapa ?? ''))
      if (doRoboNaEtapa && temPergunta) {
        try {
          // A IA ve a tela que o robo vai mandar (rodada 6: sem ela, "vou
          // confirmar se tem sabado" saiu em cima da lista de sabado, e "nao
          // consigo confirmar as 16h" em cima de "16:00 esta guardado").
          const extra = await responderPerguntaLateral(situacao, doRoboNaEtapa.resposta, chamar, modelo, Math.min(prazo, 10_000))
          if (extra.texto) {
            // A equipe so fica sabendo quando a IA a chamou, ou quando a trava
            // trocou a resposta (a etiqueta pela palavra "equipe" deixava
            // pendencia falsa na fila).
            // Piora contada junto do passo reavisa o medico (rodada 8, IA03-v1:
            // "a febre dele esta subindo agora, 38,9" no meio da ficha ouviu
            // "avisei o Dr. Marcello de novo", e alerta nenhum saiu).
            const pioraJunto = extra.equipe?.motivo === 'urgencia' && conversaDeUrgencia(situacao) && contaPiora(situacao.texto)
            // A etiqueta so informativa do robo nao vence a chamada da equipe da
            // mesma resposta (rodada 11, IA14-v1: "Sim, cancelar" com o pedido do
            // irmao ficou "cancelou sozinho", e a mae ouviu "passei para a equipe").
            const doRobo = doRoboNaEtapa.atencao && !['cancelou_sozinho', 'anexo'].includes(doRoboNaEtapa.atencao) ? doRoboNaEtapa.atencao : undefined
            return {
              resultado: {
                ...doRoboNaEtapa,
                resposta: `${extra.texto}\n\n${doRoboNaEtapa.resposta}`,
                ...(extra.equipe ? { atencao: extra.equipe.motivo === 'urgencia' ? 'urgencia' : doRobo ?? (MOTIVOS[extra.equipe.motivo] ?? 'atendente') } : {}),
                ...(pioraJunto ? { piora: true } : {}),
              },
              origem: 'ia',
              eventos: [{ evento: 'ia_respondeu', detalhe: extra.equipe ? 'pergunta junto do passo + equipe' : 'pergunta junto do passo' }],
              nota: extra.equipe ? `🤖 Resumo da IA para a equipe: ${extra.equipe.resumo}`.slice(0, 1500) : undefined,
            }
          }
        } catch (erro) {
          console.warn('Atendente com IA falhou na pergunta junto do passo; vale o robo', erro)
          return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }] }
        }
      }
      return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [] }
    }
    // Pergunta solta no passo do agendamento (18/10/2026, conversa real): "Ele
    // atende convenios?" na escolha da unidade fez a IA reescrever a pergunta
    // da unidade com os valores de cada uma e sem os horarios livres. A familia
    // nao perguntou valor, e ficou sem saber se respondia com numero. Agora a
    // IA responde so a duvida, e a tela que vai embaixo e a do robo, igual.
    // Sintoma e pedido de mudanca (outra unidade, voltar) continuam com a IA
    // de conversa, que tem as ferramentas para isso.
    const tela = telaDoPasso(doRoboNaEtapa)
    if (
      tela && doRoboNaEtapa && PASSO_DO_AGENDAMENTO.test(situacao.etapa ?? '') && perguntaLateral(situacao.texto) &&
      !relatoDeSintoma(situacao.texto) && !PEDIDO_NO_PASSO.test(semAcento(situacao.texto))
    ) {
      try {
        const extra = await responderPerguntaLateral(situacao, tela, chamar, modelo, Math.min(prazo, 10_000), SO_A_DUVIDA)
        if (extra.texto) {
          const semTela = { ...doRoboNaEtapa }
          delete semTela.tela
          return {
            resultado: {
              ...semTela,
              resposta: `${extra.texto}\n\n${tela}`,
              ...(extra.equipe ? { atencao: extra.equipe.motivo === 'urgencia' ? 'urgencia' : (MOTIVOS[extra.equipe.motivo] ?? 'atendente') } : {}),
            },
            origem: 'ia',
            eventos: [{ evento: 'ia_respondeu', detalhe: extra.equipe ? 'pergunta no passo + equipe' : 'pergunta no passo' }],
            nota: extra.equipe ? `🤖 Resumo da IA para a equipe: ${extra.equipe.resumo}`.slice(0, 1500) : undefined,
          }
        }
      } catch (erro) {
        // A resposta pronta do robo, com a tela dele, ainda serve.
        console.warn('Atendente com IA falhou na pergunta do passo; vale o robo', erro)
        return { resultado: doRoboNaEtapa, origem: 'robo', eventos: [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }] }
      }
    }
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
    const eventos = [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }]
    // Risco de vida com a familia em casa e a IA fora: o pronto-socorro agora, e
    // nunca o botao de marcar (rodada 13, IA02-v2 e IA01-v1: com a IA estourando
    // o prazo, "n quero leva no ps agr, marca seg" recebeu so "toque em Marcar uma
    // consulta", e a bateria engolida, "Recebi sua mensagem e ja passei").
    if (riscoDeVida(situacao) && !jaNoProntoSocorro(situacao)) {
      const daEquipe = await ferramentas.equipe('urgencia', `${PRONTO_SOCORRO_AGORA}\n\nA consulta não substitui essa avaliação. Depois do pronto-socorro, é só voltar aqui que a gente marca.`)
      return { resultado: daEquipe ?? { resposta: PRONTO_SOCORRO_AGORA, atencao: 'urgencia' }, origem: 'robo', eventos: [...eventos, { evento: 'ia_falhou_risco_de_vida' }] }
    }
    const doRobo = await roboDireto()
    if (doRobo) return { resultado: doRobo, origem: 'robo', eventos }
    // Na fila da equipe o robo fica calado de proposito - mas quem respondia ali
    // era a IA, e ela falhou (17/10/2026, painel com IA: "ta confirmado ne?" de
    // uma mae com o filho vomitando ficou sem resposta duas vezes). Silencio
    // nunca: a familia sabe que a equipe viu, e a conversa sobe na fila.
    return {
      resultado: await ferramentas.equipe('atendente', 'Recebi sua mensagem e já passei para a equipe, que responde por aqui.'),
      origem: 'robo',
      eventos: [...eventos, { evento: 'ia_falhou_sem_robo' }],
    }
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
    urgenciaAberta?: boolean
  },
): Promise<Situacao> {
  let historico: Situacao['historico'] = []
  try {
    const { data, error } = await admin
      .from('whatsapp_messages')
      .select('direction,body,created_at')
      .eq('conversation_id', p.conversationId)
      .order('created_at', { ascending: false })
      // 24, e nao 16 (rodada 12, IA07-v2: a ficha gastou dez mensagens, e a IA
      // ja nao via a primeira, onde estava a duvida sobre o sangue).
      .limit(24)
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
    // Sem cadastro, o nome e de quem marcou: dizer isso, e nao um nome que a
    // IA leria como o da crianca.
    if (c.semCadastro) return `${quando} · ${c.unidade} · cadastro da criança ainda incompleto`
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
    urgenciaAberta: p.urgenciaAberta ?? false,
  }
}
