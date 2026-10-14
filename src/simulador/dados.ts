/**
 * Quem atende e quem escreve, no simulador.
 *
 * Duas identidades de clinica:
 *  - "demo": o Consultorio Central de Cuidado, da Dra. Ana Ribeiro (ficticia).
 *    E a identidade que o sistema ja usa para mostrar a outros medicos desde
 *    27/09/2026 (ver supabase/sql/demo_identidade_central.sql), e por isso e a
 *    que abre por padrao: numa reuniao com cliente, nada do Dr. Marcello.
 *  - "marcello": a clinica real, com os textos copiados de tests/simulacao.mjs
 *    (banco de producao em 07/10/2026).
 *
 * Os ids das clinicas sao os de verdade de proposito: o robo escolhe o nome do
 * medico nas frases fixas por eles (ver _shared/quem-atende.ts). Com outro id,
 * a demonstracao diria "o Dr. Marcello" no meio das frases da Dra. Ana.
 *
 * Os textos aqui nao sao lidos do banco. Se a clinica editar uma resposta na
 * tela, o simulador continua com a copia: a demonstracao precisa funcionar
 * igual na reuniao, sem depender de rede nem do que mudou ontem.
 */
import type { Linha } from './banco-falso'

export type ChaveIdentidade = 'demo' | 'marcello'

export type Identidade = {
  chave: ChaveIdentidade
  rotulo: string
  clinicId: string
  /** Como a clinica aparece no topo da conversa, no celular da familia. */
  nomeNoWhatsApp: string
  medico: string
  unidades: Linha[]
  respostas: Linha[]
  telemedicina: string
  textos: { saudacao: string; saudacaoConhecida: string; informacoes: string }
  /** Dias da semana (0 = domingo) e horarios de cada unidade, hora de Brasilia. */
  agenda: Record<string, { dias: number[]; horas: string[] }>
}

const FECHO =
  '⚡ *Agendar por aqui é mais rápido*: digite *2* e escolha unidade, dia e horário na hora.\n\n' +
  '🙋 Quer falar com alguém da equipe? Digite *9*.\n\n' +
  '⏰ Segunda a sexta, 8h às 18h. Fora desse horário, respondemos no próximo dia útil.'

const CONVENIOS = (quem: string) => ({
  subject: 'Convênios',
  keywords: ['convenio', 'convênio', 'convenios', 'convênios', 'plano', 'planos', 'saude', 'saúde', 'aceita', 'aceitam', 'cobertura', 'coberto', 'credenciado', 'credenciada', 'carteirinha', 'reembolso', 'particular', 'unimed', 'bradesco', 'amil', 'sulamerica', 'sulamérica', 'porto', 'notredame', 'notre', 'hapvida', 'trasmontano', 'bluemed', 'blue', 'omint', 'careplus', 'golden', 'prevent', 'seguros'],
  answer:
    `💳 *Convênios*\n\nNão atendemos convênio: a consulta ${quem} é particular, em todas as unidades e na telemedicina.\n\n` +
    'Emitimos recibo para você pedir reembolso ao seu plano. O valor devolvido depende do seu contrato.',
  ask_unit: false,
})

const IDADE = (quem: string) => ({
  subject: 'Idade atendida',
  keywords: ['bebe', 'bebê', 'bebes', 'bebês', 'recem', 'recém', 'nascido', 'nascidos', 'neném', 'nenem', 'idade', 'idades', 'meses', 'mes', 'mês', 'crianca', 'criança', 'criancas', 'crianças', 'adolescente', 'adolescentes', 'adulto', 'adultos', 'anos'],
  answer:
    `👶 *Idade atendida*\n\n${quem} atende desde *recém-nascidos até 19 anos*.\n\n` +
    'Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.',
  ask_unit: false,
})

const O_QUE_LEVAR = {
  subject: 'O que levar e como é a consulta',
  keywords: ['levar', 'documento', 'documentos', 'exame', 'exames', 'carteirinha', 'vacina', 'vacinacao', 'vacinação', 'primeira', 'duracao', 'duração', 'demora', 'tempo', 'retorno', 'preparo', 'jejum'],
  answer:
    'Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.\n\n' +
    '⏱️ A consulta dura de 40 minutos a 1 hora.\n\n' +
    '✅ Não precisa de jejum nem de preparo: é só a consulta.\n\n' +
    'O retorno está incluído e pode ser feito em até 30 dias.',
  ask_unit: false,
}

const PALAVRAS_DO_VALOR = ['credito', 'parcela', 'nota', 'pix', 'valor', 'pagamento', 'preco', 'preços', 'pagar', 'quanto', 'reembolso', 'recibo', 'cartao', 'custa', 'totem', 'link', 'debito', 'custo', 'preço', 'particular', 'valores']
const PALAVRAS_DO_ENDERECO = ['local', 'endereco', 'carro', 'localizacao', 'onde', 'mapa', 'localização', 'referência', 'estacionamento', 'endereço', 'fica', 'chegar', 'referencia', 'estacionar', 'rua', 'bairro']

/** Linhas de bot_answers, na ordem em que a clinica cadastrou. */
function respostas(clinicId: string, lista: Omit<Linha, 'id'>[]): Linha[] {
  return lista.map((r, i) => ({ id: `resposta-${i + 1}`, clinic_id: clinicId, is_active: true, position: i, ...r }))
}

const DEMO_ID = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9'
const MARCELLO_ID = '1ffde840-a905-4300-b4fd-51571fcefdc0'

const DEMO: Identidade = {
  chave: 'demo',
  rotulo: 'Central de Cuidado (demonstração)',
  clinicId: DEMO_ID,
  nomeNoWhatsApp: 'Consultório Central de Cuidado',
  medico: 'Dra. Ana Ribeiro',
  unidades: [
    {
      id: 'unidade-moema',
      clinic_id: DEMO_ID,
      archived_at: null,
      name: 'Moema',
      address: 'Rua das Acácias, 1000, 10º andar, Moema',
      info_text:
        '💙 *Consulta em Moema: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' +
        '💳 Pagamento na recepção, na chegada: pix, débito ou crédito à vista. Não atendemos convênio, mas emitimos recibo para você pedir reembolso ao seu plano.\n\n' +
        '📍 Moema: Rua das Acácias, 1000, 10º andar. Estacionamento conveniado no prédio.\n\n' +
        '🖥️ Ao chegar, faça o check-in na recepção com o nome do paciente. A Dra. Ana recebe o aviso e chama vocês na sala de espera.\n\n' +
        '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
    },
    {
      id: 'unidade-pinheiros',
      clinic_id: DEMO_ID,
      archived_at: null,
      name: 'Pinheiros',
      address: 'Rua das Flores, 250, Pinheiros',
      info_text:
        '💙 *Consulta em Pinheiros: R$ 550,00.* Inclui retorno em até 30 dias.\n\n' +
        '💳 Pagamento em pix ou cartão. Não atendemos convênio, mas emitimos recibo para você pedir reembolso ao seu plano.\n\n' +
        '📍 Pinheiros: Rua das Flores, 250. Estacionamento particular no local.\n\n' +
        '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
    },
  ],
  respostas: respostas(DEMO_ID, [
    {
      subject: 'Valor e pagamento',
      keywords: PALAVRAS_DO_VALOR,
      answer:
        '💙 *Valores da consulta:*\n\n• Moema: R$ 450,00\n• Pinheiros: R$ 550,00\n• Telemedicina: R$ 450,00\n\n' +
        'Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).\n\n' +
        '💳 Pagamento por pix ou cartão. Emitimos recibo para você pedir reembolso ao seu plano.',
      ask_unit: true,
    },
    IDADE('A Dra. Ana'),
    CONVENIOS('da Dra. Ana'),
    {
      subject: 'Endereço e estacionamento',
      keywords: [...PALAVRAS_DO_ENDERECO, 'moema', 'pinheiros'],
      answer:
        'Atendemos em duas unidades, as duas com estacionamento:\n\n' +
        '📍 *Moema*: Rua das Acácias, 1000, 10º andar.\n\n' +
        '📍 *Pinheiros*: Rua das Flores, 250.',
      ask_unit: false,
    },
    O_QUE_LEVAR,
  ]),
  telemedicina:
    '💙 *Telemedicina: R$ 450,00.* Inclui um retorno presencial em até 30 dias, em Moema ou em Pinheiros.\n\n' +
    '💳 Pagamento por pix, antes da consulta. O link da chamada chega por aqui no dia.',
  textos: {
    saudacao: 'Olá! 👋 Aqui é o Consultório Central de Cuidado, da Dra. Ana Ribeiro, pediatra.',
    saudacaoConhecida: 'Olá, {nome}! 👋 Aqui é o Consultório Central de Cuidado.',
    informacoes: FECHO,
  },
  agenda: {
    'unidade-moema': { dias: [2, 4], horas: ['08:00', '08:40', '09:20', '10:00', '10:40', '11:20'] },
    'unidade-pinheiros': { dias: [3], horas: ['14:00', '14:40', '15:20', '16:00', '16:40', '17:20'] },
  },
}

const MARCELLO: Identidade = {
  chave: 'marcello',
  rotulo: 'Dr. Marcello Ruiz (clínica real)',
  clinicId: MARCELLO_ID,
  nomeNoWhatsApp: 'Dr. Marcello Ruiz',
  medico: 'Dr. Marcello Ruiz',
  unidades: [
    {
      id: 'unidade-santos',
      clinic_id: MARCELLO_ID,
      archived_at: null,
      name: 'Livance · Santos',
      address: 'Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP',
      info_text:
        '💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' +
        '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
        '📍 Livance · Santos: Av. Anna Costa, 228, 20º andar, Gonzaga. Estacionamento no próprio prédio, com entrada ao lado da portaria.\n\n' +
        '🖥️ Ao chegar, faça o check-in no totem digitando o nome do paciente. O Dr. Marcello recebe o aviso e vem chamar vocês na sala de espera assim que terminar a consulta anterior.\n\n' +
        '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
    },
    {
      id: 'unidade-sao-paulo',
      clinic_id: MARCELLO_ID,
      archived_at: null,
      name: 'Livance Ibirapuera - São Paulo',
      address: 'Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040',
      info_text:
        '💙 *Consulta em São Paulo: R$ 600,00.* Inclui retorno em até 30 dias.\n\n' +
        '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
        '📍 Livance · Ibirapuera: R. Agostinho Rodrigues Filho, 550, Vila Clementino. Estacionamento particular no local.\n\n' +
        '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
    },
  ],
  respostas: respostas(MARCELLO_ID, [
    {
      subject: 'Valor e pagamento',
      keywords: PALAVRAS_DO_VALOR,
      answer:
        '💙 *Valores da consulta:*\n\n• Santos: R$ 450,00\n• São Paulo: R$ 600,00\n• Telemedicina: R$ 450,00\n\n' +
        'Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).\n\n' +
        '💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
      ask_unit: true,
    },
    IDADE('O Dr. Marcello'),
    CONVENIOS('do Dr. Marcello'),
    {
      subject: 'Endereço e estacionamento',
      keywords: [...PALAVRAS_DO_ENDERECO, 'gonzaga', 'livance'],
      answer:
        'Atendemos em duas unidades, as duas com estacionamento particular no local:\n\n' +
        '📍 *Livance · Ibirapuera*: R. Agostinho Rodrigues Filho, 550, Vila Clementino, São Paulo.\n\n' +
        '📍 *Livance · Santos*: Av. Anna Costa, 228, 20º andar, Gonzaga, Santos.',
      ask_unit: false,
    },
    O_QUE_LEVAR,
  ]),
  telemedicina:
    '💙 *Telemedicina: R$ 450,00.* Inclui um retorno presencial em até 30 dias, em Santos ou São Paulo.\n\n' +
    '💳 Pagamento por pix. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
    '💻 A consulta é por vídeo, no horário marcado. Você recebe o link aqui pelo WhatsApp.',
  textos: {
    saudacao: 'Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.',
    saudacaoConhecida: 'Olá, {nome}! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.',
    informacoes: FECHO,
  },
  // Santos as quartas de manha, Sao Paulo as sextas a tarde, como na agenda real.
  agenda: {
    'unidade-santos': { dias: [3], horas: ['08:00', '08:40', '09:20', '10:00', '10:40', '11:20'] },
    'unidade-sao-paulo': { dias: [5], horas: ['14:00', '14:40', '15:20', '16:00', '16:40'] },
  },
}

export const IDENTIDADES: Record<ChaveIdentidade, Identidade> = { demo: DEMO, marcello: MARCELLO }

/** Dias de agenda aberta oferecidos pelo robo (schedule_horizon_days). */
export const HORIZONTE_DIAS = 21

/** Brasil sem horario de verao desde 2019: Brasilia e sempre UTC-3. */
function emBrasilia(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`)
}

function diaDeBrasilia(d: Date): string {
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * Horarios livres de uma unidade, no formato de available_slots: os da agenda
 * da identidade, de hoje ate o horizonte, sem os ja ocupados no banco falso.
 * Comeca duas horas a frente, para a demonstracao nunca oferecer um horario
 * que ja comecou.
 */
export function horariosLivres(
  identidade: Identidade,
  unidadeId: string,
  ocupados: Set<string>,
  agora: Date,
): { slot_start: string; slot_end: string }[] {
  const regra = identidade.agenda[unidadeId]
  if (!regra) return []
  const lista: { slot_start: string; slot_end: string }[] = []
  const minimo = agora.getTime() + 2 * 3600 * 1000
  const hoje = emBrasilia(diaDeBrasilia(agora), '12:00')
  for (let i = 0; i <= HORIZONTE_DIAS; i++) {
    const dia = diaDeBrasilia(new Date(hoje.getTime() + i * 24 * 3600 * 1000))
    if (!regra.dias.includes(new Date(`${dia}T12:00:00Z`).getUTCDay())) continue
    for (const hora of regra.horas) {
      const inicio = emBrasilia(dia, hora)
      if (inicio.getTime() < minimo) continue
      const slot_start = inicio.toISOString()
      if (ocupados.has(`${unidadeId}|${slot_start}`)) continue
      lista.push({ slot_start, slot_end: new Date(inicio.getTime() + 40 * 60 * 1000).toISOString() })
    }
  }
  return lista
}

// ---------------------------------------------------------------
// Quem escreve
// ---------------------------------------------------------------

export type ChaveFamilia = 'nova' | 'cadastrada' | 'irmaos' | 'com_consulta'

export type Familia = {
  chave: ChaveFamilia
  rotulo: string
  descricao: string
  nomeDoPerfil: string
  telefone: string
  /** Quem ja esta cadastrado com este telefone. */
  pacientes: string[]
  /** Uma consulta futura ja marcada para o primeiro paciente. */
  comConsulta: boolean
}

export const TELEFONE_DA_FAMILIA = '5511987654321'

const PACIENTES: Record<string, Linha> = {
  helena: {
    id: 'paciente-helena',
    name: 'Helena Souza Lima',
    birth_date: '2021-03-14',
    guardian_name: 'Marina Souza Lima',
    cpf: '39053344705',
    email: 'marina@exemplo.com',
  },
  theo: {
    id: 'paciente-theo',
    name: 'Theo Souza Lima',
    birth_date: '2018-07-02',
    guardian_name: 'Marina Souza Lima',
    cpf: '39053344705',
    email: 'marina@exemplo.com',
  },
}

export const FAMILIAS: Record<ChaveFamilia, Familia> = {
  nova: {
    chave: 'nova',
    rotulo: 'Família nova',
    descricao: 'Primeiro contato: ninguém cadastrado com este número.',
    nomeDoPerfil: 'Marina',
    telefone: TELEFONE_DA_FAMILIA,
    pacientes: [],
    comConsulta: false,
  },
  cadastrada: {
    chave: 'cadastrada',
    rotulo: 'Paciente cadastrada',
    descricao: 'Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.',
    nomeDoPerfil: 'Marina',
    telefone: TELEFONE_DA_FAMILIA,
    pacientes: ['helena'],
    comConsulta: false,
  },
  irmaos: {
    chave: 'irmaos',
    rotulo: 'Mãe com dois filhos',
    descricao: 'Helena e Theo no mesmo celular: o robô pergunta para quem é a consulta.',
    nomeDoPerfil: 'Marina',
    telefone: TELEFONE_DA_FAMILIA,
    pacientes: ['helena', 'theo'],
    comConsulta: false,
  },
  com_consulta: {
    chave: 'com_consulta',
    rotulo: 'Com consulta marcada',
    descricao: 'Helena tem consulta nos próximos dias: dá para ver, remarcar ou cancelar.',
    nomeDoPerfil: 'Marina',
    telefone: TELEFONE_DA_FAMILIA,
    pacientes: ['helena'],
    comConsulta: true,
  },
}

/** As linhas iniciais do banco falso para esta clinica e esta familia. */
export function bancoInicial(identidade: Identidade, familia: Familia, agora: Date): Record<string, Linha[]> {
  const clinic_id = identidade.clinicId
  const patients: Linha[] = familia.pacientes.map((chave) => ({
    ...PACIENTES[chave],
    clinic_id,
    phone: familia.telefone,
    phone_digits: familia.telefone,
    archived_at: null,
    whatsapp_opt_out_at: null,
  }))

  const appointments: Linha[] = []
  if (familia.comConsulta && patients[0]) {
    // O primeiro horario livre a partir de dois dias: perto o bastante para
    // "minha consulta" fazer sentido, longe o bastante para nao ser "hoje".
    const unidade = identidade.unidades[0]
    const depois = new Date(agora.getTime() + 2 * 24 * 3600 * 1000)
    const [slot] = horariosLivres(identidade, String(unidade.id), new Set(), depois)
    if (slot) {
      appointments.push({
        id: 'consulta-marcada',
        clinic_id,
        unit_id: unidade.id,
        patient_id: patients[0].id,
        starts_at: slot.slot_start,
        ends_at: slot.slot_end,
        status: 'scheduled',
        modality: 'presencial',
        source: 'agenda',
        contact_name: patients[0].name,
        contact_phone: familia.telefone,
        confirmed_by_clinic: true,
        reschedule_count: 0,
      })
    }
  }

  return {
    clinics: [{ id: clinic_id, name: identidade.nomeNoWhatsApp, timezone: 'America/Sao_Paulo' }],
    clinic_settings: [
      {
        clinic_id,
        telemedicine_enabled: true,
        telemedicine_info_text: identidade.telemedicina,
        schedule_horizon_days: HORIZONTE_DIAS,
      },
    ],
    clinic_units: identidade.unidades,
    bot_answers: identidade.respostas,
    availability_rules: [],
    patients,
    appointments,
    whatsapp_conversations: [],
  }
}
