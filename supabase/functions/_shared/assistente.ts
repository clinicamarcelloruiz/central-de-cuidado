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
import { comOfertaDeHorario, conhecimentoDaClinica, parecePergunta, pediuUrgencia, respostaAutomaticaDaFamilia, sinalDeAlarme } from './atendimento.ts'
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
            description: 'Opcional: uma frase curta para a família, falando com ela, caso o sistema não entenda a resposta traduzida. O texto solto não chega a ela.',
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
          paciente: {
            type: 'string',
            description: 'Só no agendar: o primeiro nome da criança, quando a família disse para quem é e ela está entre as cadastradas.',
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
    '- Quando fizer sentido, termine oferecendo o próximo passo: marcar, ver horários, mandar o endereço.',
    '- Despedida ou adiamento ("vou pensar", "depois vejo", "obrigada", "boa noite" no fim da conversa): responda só com uma despedida curta e calorosa. Não repita oferta nem lembrete que já está na conversa: quando a família voltar, o sistema retoma de onde parou.',
    '',
    'Como escrever:',
    '- Responda já na primeira frase. Nunca repita nem resuma a pergunta ("Você perguntou se..."). Cumprimente só no começo da conversa, não a cada mensagem.',
    '- Todo texto que você escreve, inclusive junto de uma ferramenta, vai para a família. Fale com ela ("você"), nunca sobre ela ("a família aceitou", "a mãe quer"), e não explique o que vai fazer ("então abro o agendamento"). Junto de abrir_fluxo, o que ela lê vai em para_familia, no máximo uma frase curta, ou nada: a tela do sistema já explica.',
    `- Português do Brasil, acolhedor e natural, como no ${s.canal ?? 'WhatsApp'}. De 1 a 4 frases.${s.canal === 'Instagram' ? '' : ' Pode usar *negrito*.'} Sem listas longas.`,
    '- Nunca escreva menu numerado nem peça "responda com um número": o sistema tem o menu com botões (abrir_fluxo com menu).',
    '- Se a pessoa só cumprimentou ("oi", "olá", "bom dia") sem perguntar nada, use abrir_fluxo com menu e não escreva nada junto: o menu já cumprimenta.',
    `- Diga "gastroenterologista pediátrico"; nunca "especialista".`,
    '- Pronto-socorro e 192 só quando a criança parece mal agora, ou quando a família contou um sintoma e o consultório está fechado.',
    // Painel com IA (17/10/2026): "a equipe responde hoje ate as 18h" em seis
    // conversas, "deixo um horario separado", "reembolso ao seu plano" para quem
    // nao falou de plano, "sim, o ultrassom o plano cobre".
    '- Horário da equipe só quando você estiver passando a conversa para ela, e sem prometer prazo: "a equipe atende de segunda a sexta, das 8h às 18h, e responde por aqui", nunca "responde hoje" ou "em instantes". Diga que avisou alguém só se você chamou a equipe nesta resposta; se já tinha chamado antes, diga que a equipe já está com a mensagem.',
    '- Nada de reserva provisória: o sistema não "separa" nem "segura" horário. Quem marca e quer desistir depois cancela por aqui.',
    '- Não suponha o que a família não disse: plano de saúde ("se vocês tiverem plano, damos recibo para reembolso"), idade, quem é a criança. Exame pelo plano é "conforme a cobertura do seu plano", nunca um sim para um exame específico.',
    '- Oferta de marcar uma vez só: se a sua última mensagem já ofereceu e a família seguiu com outra dúvida, responda só a dúvida.',
    '- Paciente adolescente: fale "seu filho", "sua filha" ou o nome, não "a criança".',
    '- Agenda: diga os dias e horários como estão em <clinica> ou em ver_horarios, sem "alguns" ou "às vezes" que não estejam escritos.',
    '',
    'Ferramentas:',
    '- abrir_fluxo: marcar, remarcar, cancelar, ver a consulta, 2ª via. O sistema conduz com botões e faz o cadastro; em para_familia, você pode responder em uma frase o que ela perguntou. Não peça CPF, e-mail nem dados da criança.',
    // 17/10/2026, teste do Edu: depois de "Atende sim, aos sabados em Sao Paulo...
    // Quer que eu siga com o agendamento?", o "sim" recomecava em "Em qual
    // unidade?" - a mae escolhia tudo de novo, e e ai que se desiste.
    '- Quando a família aceitar marcar ("sim", "pode ser", "quero", "esse horário"), abra o agendamento na hora com abrir_fluxo agendar, sem perguntar de novo o que ela já disse. Se a conversa já definiu a unidade, passe unidade; se definiu também o dia, passe dia, sempre com a unidade (se só uma unidade atende naquele dia, como o sábado, a unidade é ela); se ela já escolheu o horário exato ("pode ser às 15:10", "quero o das 9:20"), passe horario, e o sistema guarda esse horário na hora. Para quem é: com mais de uma criança cadastrada e o nome dito, passe paciente.',
    '- Com abrir_fluxo, o que a família lê junto vai em para_familia (o texto solto não chega a ela). Quando você passar o horário direto para uma família sem consulta anterior, diga ali o valor e como se paga naquela unidade (de <clinica>): ela não passa pela tela das datas, que é onde o valor aparece.',
    '- Remarcar ou cancelar a consulta que já existe: abrir_fluxo remarcar ou cancelar. Cancelar pede só a confirmação. Remarcar abre direto nas datas da mesma unidade: passe o dia que a família quer (e a unidade, se ela quer trocar), e o sistema abre nos horários dele. minha_consulta é para quem quer só ver.',
    '- ver_horarios: para dizer quando tem vaga numa unidade, e para responder em que dias e horários o médico atende ("atende sábado?", "tem à noite?"): consulte a agenda das unidades em vez de chamar a equipe. Para "o mais rápido possível" e na urgência, use unidade "todas", numa consulta só. Não prometa horário: quem reserva é o fluxo de agendamento.',
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
    '',
    // Os sinais com palavra certa o robo ja pega antes (sinalDeAlarme); estes
    // cobrem o que chega descrito de outro jeito. Chamar a equipe com urgencia
    // dispara o alerta no WhatsApp pessoal do medico, a qualquer hora. Dois
    // niveis (17/10/2026): o Dr. Marcello e clinico, nao cirurgiao - a urgencia
    // do consultorio e quase sempre "ele precisa ver logo", nao pronto-socorro.
    `Urgência tem dois níveis, e nos dois use chamar_equipe com motivo urgencia (isso avisa ${s.quemAtende} no WhatsApp dele, a qualquer hora):`,
    '- Risco de vida (vômito com sangue ou verde, muito sangue, engoliu pilha, bateria, ímã, moeda ou produto de limpeza, falta de ar ou lábios roxos, convulsão, não acorda ou desmaiou): em para_familia, a primeira frase manda procurar o pronto-socorro mais próximo ou ligar 192 agora.',
    `- Urgente sem risco de vida (piorou, não para de vomitar, não faz xixi há muitas horas, muito molinha, dor forte, febre em bebê com menos de 3 meses, ou a família diz que é urgente): acolha, diga que ${s.quemAtende} foi avisado e vai avaliar, e ofereça o horário mais próximo (${s.canal === 'Instagram' ? 'pelo link do WhatsApp' : 'veja com ver_horarios "todas" antes, inclusive hoje'}). O pronto-socorro só aparece no fim, como "se for uma emergência com risco de vida". Se a família já tem consulta marcada para hoje ou amanhã, não ofereça outra: confirme a que ela tem.`,
    '- Se na mesma mensagem ela pergunta de remédio, diga que remédio e dose quem orienta é o médico, sem citar o nome do remédio.',
    '- Na urgência, veja os horários antes (ver_horarios "todas") e só depois chame a equipe, já com o horário mais próximo, dia e unidade, em para_familia. Não prometa "vou ver o horário" sem trazer o horário. Se você já avisou o médico nesta conversa, diga que ele já foi avisado, não que avisou "de novo".',
    '- "Urgente" sobre papel (relatório, atestado, receita, escola cobrando) não é urgência de saúde: é documento (chamar_equipe documento), dizendo que a equipe já sabe que ela precisa logo, sem garantir prazo.',
    'Se perguntarem, você é o assistente virtual do consultório, e a equipe acompanha as conversas.',
    '',
    `<clinica>\n${s.conhecimento}\n</clinica>`,
  ].join('\n')
}

/** O passo do sistema em que a familia esta: muda a cada mensagem, fica fora do cache. */
function instrucoesDaEtapa(s: Situacao): string {
  return `A família está no passo "${s.etapa}" do sistema e o sistema não entendeu a última resposta dela. A última mensagem do consultório foi:\n«${semDadosPessoais(s.ultimaDoConsultorio ?? '').slice(0, 900)}»\nSe der para traduzir o que ela quis dizer numa opção, use responder_etapa. Se ela trocou de unidade, mande o nome da nova unidade em responder_etapa (com o dia e o horário, se ela disse), nunca VOLTAR. Se ela perguntou outra coisa, responda e lembre o passo em aberto, a não ser que ele já tenha sido lembrado na última mensagem do consultório; se a dúvida for da equipe, chame a equipe: o passo continua aberto e ela segue depois. Se ela se despediu ou disse que vai pensar, só se despeça.`
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

/** O que fica com o robo mesmo com a IA ligada (ver o topo do arquivo). */
export function ficaComORobo(s: Situacao): string | null {
  if (s.equipeConversando) return 'equipe_conversando'
  if (s.anexo) return 'anexo'
  if (pediuUrgencia(s.texto) || sinalDeAlarme(s.texto)) return 'urgencia'
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
/**
 * O horario que a IA passou so vale se foi a familia que escolheu (rodada 3 do
 * painel, IA03-v1): a mae tocou "Marcar uma consulta" e a IA ja mandou as 15:00,
 * que ficaram guardadas sem ninguem escolher. Vale quando a mensagem da familia
 * diz a hora ("pode ser as 15h", "15:10"), ou quando ela disse sim a uma
 * mensagem nossa que oferecia aquele horario e nenhum outro. Fora disso, o
 * sistema para na lista de horarios do dia e ela toca.
 */
function horasDitas(texto: string): { hora: number; minuto: number | null }[] {
  const t = texto.toLowerCase()
  const achadas: { hora: number; minuto: number | null }[] = []
  for (const m of t.matchAll(/(\d{1,2})\s*(?::|h)\s*(\d{2})\b/g)) achadas.push({ hora: Number(m[1]), minuto: Number(m[2]) })
  for (const m of t.matchAll(/(\d{1,2})\s*(?:h|hs|horas)\b(?!\s*\d)/g)) achadas.push({ hora: Number(m[1]), minuto: null })
  for (const m of t.matchAll(/(\d{1,2})\s+e\s+(\d{2}|meia)\b/g)) achadas.push({ hora: Number(m[1]), minuto: m[2] === 'meia' ? 30 : Number(m[2]) })
  return achadas
}

function horarioEscolhido(s: Situacao, horario: unknown): string {
  const pedido = String(horario ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!pedido) return ''
  const hora = Number(pedido[1])
  const minuto = Number(pedido[2] ?? 0)
  const disse = (texto: string) => horasDitas(texto).some((h) => h.hora === hora && (h.minuto ?? 0) === minuto)
  if (disse(s.texto)) return String(horario)
  const oferecidos = horasDitas(s.ultimaDoConsultorio ?? '')
  const sim = /^\s*(sim|pode|pode ser|quero|isso|ok|fechado|combinado|beleza|blz|perfeito)\b/i.test(s.texto)
  if (sim && oferecidos.length === 1 && disse(s.ultimaDoConsultorio ?? '')) return String(horario)
  return ''
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
const NARRACAO = [
  /\b(?:a|essa|esta)\s+fam[ií]lia\s+(?:disse|aceitou|quer|escolheu|pediu|pergunt\w*|n[aã]o|j[aá]|est[aá]|confirmou|respondeu|mandou|escreveu|tem)\b/i,
  /\b(?:a|o)\s+(?:m[aã]e|pai|respons[aá]vel)\s+(?:disse|aceitou|quer|escolheu|pediu|pergunt\w*|n[aã]o|j[aá]|est[aá]|confirmou|respondeu|mandou|escreveu)\b/i,
  /\b(?:abrir_fluxo|responder_etapa|ver_horarios|chamar_equipe|fluxo)\b/i,
  /\ba conversa j[aá] (?:definiu|combinou|tem)\b/i,
  /\bent[aã]o (?:abro|vou abrir|chamo|vou chamar|passo)\b/i,
  /\b(?:abro|abrirei) o agendamento\b/i,
  /\bvou abrir o agendamento direto\b/i,
]

export function semNarracao(texto: string): string {
  const linhas = texto.split('\n').map((linha) =>
    linha
      .split(FIM_DE_FRASE)
      .filter((frase) => !NARRACAO.some((r) => r.test(frase)))
      .join(' '),
  )
  const limpo = linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (limpo !== texto.trim()) console.warn('Atendente com IA narrou o plano no texto da familia; cortado', texto.slice(0, 200))
  return limpo
}

const AVISO_PADRAO = 'Vou confirmar isso com a equipe e te respondemos por aqui.'
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
        // 700 cortava a resposta quando o Sonnet pensava antes (17/10/2026).
        max_tokens: 1500,
        // Sem pensar antes de responder (17/10/2026, painel com IA): o Sonnet
        // devolvia so um bloco de pensamento vazio, sem texto nem ferramenta, e a
        // mae de uma crianca vomitando ficou sem resposta duas vezes. A API recusa
        // 'disabled' neste modelo e manda usar 'between_tools': nada antes da
        // resposta, so notas curtas entre uma ferramenta e outra.
        thinking: { type: 'between_tools' },
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
    const urgente =
      usos.some((u) => u.name === 'chamar_equipe' && u.input?.motivo === 'urgencia') ||
      familiaFalouDeUrgencia(s.texto) ||
      (sintoma && !dentroDoExpediente(s.agora)) ||
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
    const avisoDaEquipe = pedidoAEquipe?.para_familia ?? pedidoAEquipe?.texto
    // A trava confere o que vai SAIR para a familia (rodada 3 do painel): o
    // rascunho "preciso ver os horarios antes de chamar a equipe" disparava a
    // trava numa febre de bebe de 7 semanas ("de chamar" casava com "de cha", o
    // cha de beber, na lista acima) e a urgencia virava "atendente". Rascunho de quem so
    // consulta horario nao sai; com abrir_fluxo, sai so o para_familia.
    const daVez = usos.find((u) => u.name !== 'ver_horarios')
    const vaiSair = !usos.length
      ? texto
      : daVez?.name === 'abrir_fluxo'
        ? String(daVez.input?.para_familia ?? '')
        : daVez?.name === 'chamar_equipe'
          ? `${String(avisoDaEquipe ?? '')}\n${texto}`
          : daVez?.name === 'responder_etapa'
            ? texto
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
      return { resultado: { resposta: texto }, acao: 'conversou' }
    }

    // Ferramentas que encerram a vez: a primeira que aparecer decide.
    const final = usos.find((u) => u.name !== 'ver_horarios')
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
      const juntar = (r: Resultado | null, antes = texto): Resultado => {
        if (!r) return { resposta: antes || 'Certo!' }
        return { ...r, resposta: antes ? `${antes}\n\n${r.resposta}` : r.resposta }
      }
      if (final.name === 'abrir_fluxo') {
        const fluxo = FLUXOS[String(final.input?.fluxo ?? '')]
        if (!fluxo) throw new Error(`fluxo desconhecido: ${final.input?.fluxo}`)
        // Para a familia vai so o para_familia (rodada 2 do painel, 17/10/2026):
        // o texto solto junto da ferramenta e o rascunho da IA, e em quatro de
        // quatro agendamentos com horario saiu "A familia escolheu o horario,
        // entao abro o agendamento direto...". Nem todo rascunho tem cara de
        // rascunho ("Como ela nao vai ver a lista, digo o valor"), entao o
        // texto solto nao vai, filtrado ou nao.
        const paraFamilia = semNarracao(limparTexto(String(final.input?.para_familia ?? ''), urgente))
        let doRobo = await ferramentas.robo(fluxo.texto, fluxo.etapa)
        if (final.input.fluxo === 'agendar') doRobo = await seguirComOPedido(ferramentas, doRobo, { ...final.input, horario: horarioEscolhido(s, final.input?.horario) })
        // Remarcar ou cancelar a consulta que ja existe: o pedido vai junto, e a
        // familia so confirma. Com mais de uma consulta, a lista fica para ela
        // escolher qual - o robo nao adivinha.
        if (fluxo.depois && s.consultas.length === 1 && ferramentas.etapa && (await ferramentas.etapa()) === 'minha_consulta') {
          const r = await ferramentas.robo(fluxo.depois, 'atual')
          if (r && !roboNaoEntendeu(r)) doRobo = r
          // Remarcar nao cancela nada antes de a nova estar marcada, entao o SIM
          // e so um passo a mais (rodada 2 do painel: "da pra passar a consulta
          // da Helena pra sexta?" ainda respondia SIM, unidade e dia). O pedido
          // segue ate as datas, ou os horarios do dia. Cancelar continua
          // esperando o SIM da familia.
          if (final.input.fluxo === 'remarcar' && (await ferramentas.etapa()) === 'confirmar_cancelamento') {
            const datas = await ferramentas.robo('sim', 'atual')
            if (datas && !roboNaoEntendeu(datas)) doRobo = await seguirComOPedido(ferramentas, datas, { ...final.input, horario: horarioEscolhido(s, final.input?.horario) })
          }
        }
        // O menu ja cumprimenta: o "Ola! Sou o assistente..." do Claude antes
        // dele saia como dois cumprimentos seguidos.
        if (final.input.fluxo === 'menu') return { resultado: doRobo ?? { resposta: texto || 'Certo!' }, acao: 'fluxo:menu' }
        return { resultado: juntar(doRobo, paraFamilia), acao: `fluxo:${final.input.fluxo}` }
      }
      if (final.name === 'responder_etapa') {
        let r = await ferramentas.robo(String(final.input?.texto ?? '').slice(0, 200), 'mesma')
        // Traduziu e o robo ainda nao entendeu: o Claude nao insiste, explica.
        // O que a familia le aqui e o para_familia, como no abrir_fluxo (rodada 3
        // do painel: "Nao da para adivinhar qual dos seis, entao preciso
        // perguntar" saiu em cima do "Nao entendi" do robo).
        if (roboNaoEntendeu(r)) {
          return { resultado: juntar(r, semNarracao(limparTexto(String(final.input?.para_familia ?? ''), urgente))), acao: 'etapa_sem_sucesso' }
        }
        // "Prefiro Sao Paulo, tem segunda?": a unidade troca aqui, e o dia e o
        // horario ditos junto seguem como no agendar.
        r = await seguirComOPedido(ferramentas, r, { dia: final.input?.dia, horario: final.input?.horario })
        // A traducao vale pelo resultado do robo; o texto do Claude so atrapalharia.
        return { resultado: r ?? { resposta: texto || 'Certo!' }, acao: 'etapa' }
      }
      if (final.name === 'chamar_equipe') {
        const motivo = String(final.input?.motivo ?? 'pessoa')
        // `texto` era o nome do campo ate 16/10/2026; continua valendo.
        const escrito = String(final.input?.para_familia ?? final.input?.texto ?? '')
        let resumo = String(final.input?.resumo_para_equipe ?? '').trim()
        let aviso = semNarracao(semRepetir(limparTexto(escrito, urgente), ultimaNossa)) || texto || AVISO_PADRAO
        if (falaComAEquipe(aviso)) {
          console.warn('Atendente com IA escreveu para a equipe no texto da familia; vai como nota interna', aviso.slice(0, 200))
          resumo = [resumo, aviso].filter(Boolean).join('\n\n')
          aviso = AVISO_PADRAO
        }
        // Urgencia sem pronto-socorro no texto (17/10/2026): a instrucao pede,
        // mas e a frase que nao pode faltar. Vai no fim, condicionada ao risco
        // de vida: na urgencia comum quem resolve e a consulta (pedido do Edu).
        if (motivo === 'urgencia' && !PRONTO_SOCORRO.test(aviso)) aviso = `${aviso}\n\n${AVISO_DE_URGENCIA}`
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
        if (manterEtapa && !/continu|pergunta acima|👆|\?\s*$/i.test(aviso)) {
          aviso = `${aviso}\n\nPara continuar de onde paramos, é só responder a pergunta acima 👆`
        }
        // Sem resumo, a nota leva o que a familia leu (painel com IA: a IA disse
        // "passei para a equipe que voce precisa hoje" e nenhuma nota foi gravada).
        if (!resumo) resumo = `(sem resumo) ${String(s.texto).slice(0, 300)}`
        return {
          resultado: await ferramentas.equipe(MOTIVOS[motivo] ?? 'atendente', aviso.slice(0, 900), { manterEtapa }),
          acao: `equipe:${motivo}${manterEtapa ? ' (passo mantido)' : ''}`,
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
  pedido: { paciente?: unknown; unidade?: unknown; dia?: unknown; horario?: unknown },
): Promise<Resultado | null> {
  if (!ferramentas.etapa) return aberto
  const respostas: Record<string, string> = {
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
    const aviso =
      `🚨 Entendo a preocupação. Já avisei ${s.quemAtende}, que vai avaliar o que você contou e responder por aqui. ` +
      'Remédio e dose, só com a orientação médica.\n\n' +
      AVISO_DE_URGENCIA
    const r = await ferramentas.equipe('urgencia', aviso, { manterEtapa: emEtapa && fichaAberta(s) })
    return { resultado: s.canal === 'Instagram' ? r : comOfertaDeHorario(r ?? { resposta: aviso, atencao: 'urgencia' }), acao: 'equipe:urgencia (trava de conduta)', nota }
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
      return { resultado: doRoboAgora, origem: 'robo', eventos: [{ evento: 'ia_passou_ao_robo', detalhe: doRobo }] }
    }
  }

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
    const eventos = [{ evento: 'ia_falhou', detalhe: String(erro).slice(0, 120) }]
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
