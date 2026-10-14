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
 *
 * A agenda (unidades e horarios) e so o ponto de partida: a aba "Agenda" do
 * simulador edita uma copia dela, e "Restaurar" volta para esta.
 */
import type { Linha } from './banco-falso'
import { horariosLivres, tabelasDaAgenda, type AgendaDaClinica } from './agenda'

export type ChaveIdentidade = 'demo' | 'marcello'

export type Identidade = {
  chave: ChaveIdentidade
  rotulo: string
  clinicId: string
  /** Como a clinica aparece no topo da conversa, no celular da familia. */
  nomeNoWhatsApp: string
  medico: string
  respostas: Linha[]
  telemedicina: string
  textos: { saudacao: string; saudacaoConhecida: string; informacoes: string }
  agendaPadrao: AgendaDaClinica
}

/** Um periodo semanal da agenda padrao, hora de Brasilia (0 = domingo). */
const periodo = (id: string, weekday: number, inicio: string, fim: string) => ({ id, weekday, inicio, fim })

const PREFERENCIAS = { duracao: 40, janela: 21, antecedencia: 2 }

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
  agendaPadrao: {
    versao: 1,
    unidades: [
      {
        id: 'unidade-moema',
        nome: 'Moema',
        endereco: 'Rua das Acácias, 1000, 10º andar, Moema',
        convenio: '',
        telemedicina: false,
        periodos: [periodo('moema-ter', 2, '08:00', '12:00'), periodo('moema-qui', 4, '08:00', '12:00')],
        informacoes:
          '💙 *Consulta em Moema: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' +
          '💳 Pagamento na recepção, na chegada: pix, débito ou crédito à vista. Não atendemos convênio, mas emitimos recibo para você pedir reembolso ao seu plano.\n\n' +
          '📍 Moema: Rua das Acácias, 1000, 10º andar. Estacionamento conveniado no prédio.\n\n' +
          '🖥️ Ao chegar, faça o check-in na recepção com o nome do paciente. A Dra. Ana recebe o aviso e chama vocês na sala de espera.\n\n' +
          '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
      },
      {
        id: 'unidade-pinheiros',
        nome: 'Pinheiros',
        endereco: 'Rua das Flores, 250, Pinheiros',
        convenio: '',
        telemedicina: false,
        periodos: [periodo('pinheiros-qua', 3, '14:00', '18:00')],
        informacoes:
          '💙 *Consulta em Pinheiros: R$ 550,00.* Inclui retorno em até 30 dias.\n\n' +
          '💳 Pagamento em pix ou cartão. Não atendemos convênio, mas emitimos recibo para você pedir reembolso ao seu plano.\n\n' +
          '📍 Pinheiros: Rua das Flores, 250. Estacionamento particular no local.\n\n' +
          '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
      },
    ],
    datasExtras: [],
    bloqueios: [],
    preferencias: PREFERENCIAS,
    telemedicinaAtiva: true,
  },
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
}

const MARCELLO: Identidade = {
  chave: 'marcello',
  rotulo: 'Dr. Marcello Ruiz (clínica real)',
  clinicId: MARCELLO_ID,
  nomeNoWhatsApp: 'Dr. Marcello Ruiz',
  medico: 'Dr. Marcello Ruiz',
  // Santos as quartas de manha, Sao Paulo as sextas a tarde, como na agenda real.
  agendaPadrao: {
    versao: 1,
    unidades: [
      {
        id: 'unidade-santos',
        nome: 'Livance · Santos',
        endereco: 'Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP',
        convenio: '',
        telemedicina: false,
        periodos: [periodo('santos-qua', 3, '08:00', '12:00')],
        informacoes:
          '💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' +
          '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
          '📍 Livance · Santos: Av. Anna Costa, 228, 20º andar, Gonzaga. Estacionamento no próprio prédio, com entrada ao lado da portaria.\n\n' +
          '🖥️ Ao chegar, faça o check-in no totem digitando o nome do paciente. O Dr. Marcello recebe o aviso e vem chamar vocês na sala de espera assim que terminar a consulta anterior.\n\n' +
          '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
      },
      {
        id: 'unidade-sao-paulo',
        nome: 'Livance Ibirapuera - São Paulo',
        endereco: 'Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040',
        convenio: '',
        telemedicina: false,
        periodos: [periodo('sao-paulo-sex', 5, '14:00', '17:20')],
        informacoes:
          '💙 *Consulta em São Paulo: R$ 600,00.* Inclui retorno em até 30 dias.\n\n' +
          '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
          '📍 Livance · Ibirapuera: R. Agostinho Rodrigues Filho, 550, Vila Clementino. Estacionamento particular no local.\n\n' +
          '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.',
      },
    ],
    datasExtras: [],
    bloqueios: [],
    preferencias: PREFERENCIAS,
    telemedicinaAtiva: true,
  },
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
}

export const IDENTIDADES: Record<ChaveIdentidade, Identidade> = { demo: DEMO, marcello: MARCELLO }

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

/** As linhas iniciais do banco falso para esta clinica, esta agenda e esta familia. */
export function bancoInicial(
  identidade: Identidade,
  agenda: AgendaDaClinica,
  familia: Familia,
  agora: Date,
): Record<string, Linha[]> {
  const clinic_id = identidade.clinicId
  const tabelas = tabelasDaAgenda(agenda, clinic_id)
  const clinic_settings = [{ clinic_id, telemedicine_info_text: identidade.telemedicina, ...tabelas.configuracoes }]
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
    // O primeiro horario livre a partir de dois dias, na primeira unidade que
    // tiver: perto o bastante para "minha consulta" fazer sentido, longe o
    // bastante para nao ser "hoje".
    const depois = new Date(agora.getTime() + 2 * 24 * 3600 * 1000)
    const leitura = { ...tabelas, clinic_settings, appointments: [] }
    for (const unidade of tabelas.clinic_units.filter((u) => !u.telemedicina)) {
      const [slot] = horariosLivres(leitura, unidade.id, depois)
      if (!slot) continue
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
      break
    }
  }

  return {
    clinics: [{ id: clinic_id, name: identidade.nomeNoWhatsApp, timezone: 'America/Sao_Paulo' }],
    clinic_settings,
    clinic_units: tabelas.clinic_units,
    availability_rules: tabelas.availability_rules,
    schedule_exceptions: tabelas.schedule_exceptions,
    bot_answers: identidade.respostas,
    patients,
    appointments,
    whatsapp_conversations: [],
  }
}
