// Simulação de conversas inteiras, com os textos REAIS da clínica.
//
// Diferente de atendimento.test.mjs, aqui nada é verificado automaticamente: o
// objetivo é imprimir a conversa como ela chega no celular da família, do "oi"
// até o comprovante, para alguém LER e julgar se faz sentido. Teste que passa
// não garante que o texto está bom.
//
// Como rodar:  npm run simular
//
// Os textos abaixo são cópia do que estava no banco de produção em 07/10/2026
// (unidades, respostas prontas, telemedicina). Se a clínica editar na tela, o
// que vale é o banco - atualize aqui quando a diferença atrapalhar a leitura.
//
// As datas andam com o calendário (próximas quartas e sextas). Com datas fixas
// em setembro, a partir de outubro toda consulta da simulação "já tinha
// passado", e o comprovante do fim do cadastro sumia - a simulação mostrava
// uma conversa que nenhuma família recebe.

import { tratarConversa } from './atendimento.build.mjs'
import { montarMensagens } from './conteudo.build.mjs'

// ---------------------------------------------------------------
// Os textos reais
// ---------------------------------------------------------------

const FECHO =
  '⚡ *Agendar por aqui é mais rápido*: digite *2* e escolha unidade, dia e horário na hora.\n\n' +
  '🙋 Quer falar com alguém da equipe? Digite *9*.\n\n' +
  '⏰ Segunda a sexta, 8h às 18h. Fora desse horário, respondemos no próximo dia útil.'

const SANTOS =
  '💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' +
  '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
  '📍 Livance · Santos — Av. Anna Costa, 228, 20º andar, Gonzaga. Estacionamento no próprio prédio, com entrada ao lado da portaria.\n\n' +
  '🖥️ Ao chegar, faça o check-in no totem digitando o nome do paciente. O Dr. Marcello recebe o aviso e vem chamar vocês na sala de espera assim que terminar a consulta anterior.\n\n' +
  '🎥 Veja como funciona a chegada: https://www.instagram.com/reels/DYmuhB1xqJf/\n\n' +
  '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.'

const SAO_PAULO =
  '💙 *Consulta em São Paulo: R$ 600,00.* Inclui retorno em até 30 dias.\n\n' +
  '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
  '📍 Livance · Ibirapuera — R. Agostinho Rodrigues Filho, 550, Vila Clementino. Estacionamento particular no local.\n\n' +
  '📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.'

const TELE_TEXTO =
  '💙 *Telemedicina: R$ 450,00.* Inclui um retorno presencial em até 30 dias, em Santos ou São Paulo.\n\n' +
  '💳 Pagamento por pix. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' +
  '💻 A consulta é por vídeo, no horário marcado. Você recebe o link aqui pelo WhatsApp.\n\n' +
  '📋 Tenha em mãos a carteirinha de vacinação da criança e os exames anteriores, se houver.'

const UNIDADES = [
  { id: 'u-santos', name: 'Livance · Santos', address: 'Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP', info_text: SANTOS },
  { id: 'u-sp', name: 'Livance Ibirapuera - São Paulo', address: 'Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040', info_text: SAO_PAULO },
]

const RESPOSTAS_PRONTAS = [
  {
    id: 'r1',
    subject: 'Valor e pagamento',
    keywords: ['credito', 'parcela', 'nota', 'pix', 'valor', 'pagamento', 'preco', 'preços', 'pagar', 'quanto', 'reembolso', 'recibo', 'cartao', 'custa', 'totem', 'link', 'debito', 'custo', 'preço', 'particular', 'valores'],
    answer:
      '💙 *Valores da consulta:*\n\n• Santos: R$ 450,00\n• São Paulo: R$ 600,00\n• Telemedicina: R$ 450,00\n\n' +
      'Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).\n\n' +
      '💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
    ask_unit: true,
  },
  {
    id: 'r5',
    subject: 'Idade atendida',
    keywords: ['bebe', 'bebê', 'bebes', 'bebês', 'recem', 'recém', 'nascido', 'nascidos', 'neném', 'nenem', 'idade', 'idades', 'meses', 'mes', 'mês', 'crianca', 'criança', 'criancas', 'crianças', 'adolescente', 'adolescentes', 'adulto', 'adultos', 'anos'],
    answer:
      '👶 *Idade atendida*\n\nO Dr. Marcello atende desde *recém-nascidos até 19 anos*.\n\n' +
      'Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.',
    ask_unit: false,
  },
  {
    id: 'r2',
    subject: 'Convênios',
    keywords: ['convenio', 'convênio', 'convenios', 'convênios', 'plano', 'planos', 'saude', 'saúde', 'aceita', 'aceitam', 'cobertura', 'coberto', 'credenciado', 'credenciada', 'carteirinha', 'reembolso', 'particular', 'unimed', 'bradesco', 'amil', 'sulamerica', 'sulamérica', 'porto', 'notredame', 'notre', 'hapvida', 'trasmontano', 'bluemed', 'blue', 'omint', 'careplus', 'golden', 'prevent', 'seguros'],
    answer:
      '💳 *Convênios*\n\nNão atendemos convênio: a consulta é particular, em todas as unidades e na telemedicina.\n\n' +
      'Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano. O valor devolvido depende do seu contrato.',
    ask_unit: false,
  },
  {
    id: 'r3',
    subject: 'Endereço e estacionamento',
    keywords: ['local', 'endereco', 'carro', 'localizacao', 'onde', 'mapa', 'localização', 'referência', 'estacionamento', 'endereço', 'gonzaga', 'fica', 'livance', 'chegar', 'referencia', 'estacionar', 'rua', 'bairro'],
    answer:
      'Atendemos em duas unidades, as duas com estacionamento particular no local:\n\n' +
      '📍 *Livance · Ibirapuera* — R. Agostinho Rodrigues Filho, 550, Vila Clementino, São Paulo.\n\n' +
      '📍 *Livance · Santos* — Av. Anna Costa, 228, 20º andar, Gonzaga, Santos.\n🎥 Como funciona a chegada: https://www.instagram.com/reels/DYmuhB1xqJf/',
    ask_unit: false,
  },
  {
    id: 'r4',
    subject: 'O que levar e como é a consulta',
    keywords: ['levar', 'documento', 'documentos', 'exame', 'exames', 'carteirinha', 'vacina', 'vacinacao', 'vacinação', 'primeira', 'duracao', 'duração', 'demora', 'tempo', 'retorno', 'preparo', 'jejum'],
    answer:
      'Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.\n\n' +
      '⏱️ A consulta dura de 40 minutos a 1 hora.\n\n' +
      '✅ Não precisa de jejum nem de preparo: é só a consulta.\n\n' +
      'O retorno está incluído e pode ser feito em até 30 dias.',
    ask_unit: false,
  },
]

const TEXTOS = {
  saudacao: 'Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.',
  saudacaoConhecida: 'Olá, {nome}! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.',
  informacoes: FECHO,
}

// Agenda de verdade: Santos às quartas de manhã, São Paulo às sextas à tarde.
const slots = (dias, horas) =>
  dias.flatMap((d) => horas.map((h) => ({ slot_start: `${d}T${h}:00Z`, slot_end: `${d}T${h}:40Z` })))

// Proxima quarta (3) ou sexta (5) a partir de amanha, mais `semanas`.
const proxima = (diaDaSemana, semanas = 0) => {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== diaDaSemana) d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCDate(d.getUTCDate() + 7 * semanas)
  return d.toISOString().slice(0, 10)
}
const QUARTA = proxima(3)

const SLOTS = {
  'u-santos': slots([QUARTA, proxima(3, 1)], ['11:00', '11:40', '12:20', '13:00']),
  'u-sp': slots([proxima(5), proxima(5, 1)], ['17:00', '17:40', '18:20']),
}

// ---------------------------------------------------------------
// Banco falso
// ---------------------------------------------------------------

function fazerAdmin({ pacientes = [], teleAtiva = true }) {
  const conversa = {
    booking_state: null,
    booking_options: null,
    booking_unit_id: null,
    booking_modality: null,
    booking_patient_id: null,
    booking_replaces_id: null,
    booking_intake_id: null,
    menu_sent_at: null,
  }
  const marcadas = []
  const canceladas = []
  const cadastrados = []

  const chain = (resultado) => ({
    select: () => chain(resultado),
    eq: (_c, valor) => chain(resultado._porId ? { ...resultado, single: resultado._porId(valor) } : resultado),
    is: () => chain(resultado),
    order: () => chain(resultado),
    limit: () => chain(resultado),
    maybeSingle: async () => ({ data: resultado.single ?? null, error: null }),
    then: (r) => r({ data: resultado.list ?? [], error: null }),
  })

  const admin = {
    from(tabela) {
      if (tabela === 'whatsapp_conversations') {
        return {
          update: (campos) => {
            Object.assign(conversa, campos)
            return { eq: async () => ({}) }
          },
        }
      }
      if (tabela === 'clinic_units') {
        return {
          select: () =>
            chain({
              list: UNIDADES,
              single: UNIDADES[0],
              _porId: (id) => UNIDADES.find((u) => u.id === id) ?? null,
            }),
        }
      }
      if (tabela === 'clinics') return { select: () => chain({ single: { timezone: 'America/Sao_Paulo' } }) }
      if (tabela === 'clinic_settings') {
        return {
          select: () =>
            chain({ single: { telemedicine_enabled: teleAtiva, telemedicine_info_text: TELE_TEXTO } }),
        }
      }
      if (tabela === 'bot_answers') return { select: () => chain({ list: RESPOSTAS_PRONTAS }) }
      if (tabela === 'patients') {
        return {
          select: () => chain({ list: pacientes, single: null, _porId: () => null }),
          insert: (linha) => ({
            select: () => ({
              maybeSingle: async () => {
                cadastrados.push(linha)
                return { data: { id: `paciente-${cadastrados.length}` }, error: null }
              },
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (tabela === 'appointments') {
        return {
          // Devolve a ULTIMA consulta marcada nesta conversa: e ela que o
          // comprovante final relê. Com um valor fixo aqui, a simulação
          // mostraria um horário que ninguém escolheu.
          select: () =>
            chain({
              single: (() => {
                const ultima = marcadas.at(-1)
                const unidade = UNIDADES.find((u) => u.id === ultima?.unit_id) ?? UNIDADES[0]
                return {
                  reschedule_count: 0,
                  starts_at: ultima?.starts_at ?? `${QUARTA}T11:00:00Z`,
                  modality: ultima?.modality ?? 'presencial',
                  clinic_units: { name: unidade.name, address: unidade.address },
                }
              })(),
            }),
          insert: (linha) => ({
            select: () => ({
              maybeSingle: async () => {
                marcadas.push(linha)
                return { data: { id: `consulta-${marcadas.length}` }, error: null }
              },
            }),
          }),
          update: (campos) => ({
            eq: (_c, valor) => ({
              eq: async () => {
                if (campos.status === 'cancelled') canceladas.push(valor)
                return { error: null }
              },
              then: (r) => r({ error: null }),
            }),
          }),
        }
      }
      throw new Error('tabela nao prevista: ' + tabela)
    },
    async rpc(nome, args) {
      if (nome === 'liberar_reservas_vencidas') return { data: 0, error: null }
      if (nome === 'available_slots') return { data: SLOTS[args.p_unit_id] ?? [], error: null }
      throw new Error('rpc nao prevista: ' + nome)
    },
  }
  return { admin, conversa, marcadas, canceladas, cadastrados }
}

// ---------------------------------------------------------------
// Impressão
// ---------------------------------------------------------------

const LARGURA = 78
const linha = (c = '─') => c.repeat(LARGURA)

function bloco(texto, prefixo) {
  return texto
    .split('\n')
    .map((l) => prefixo + l)
    .join('\n')
}

async function conversar(titulo, mensagens, opcoes = {}) {
  const { admin, conversa, marcadas, canceladas, cadastrados } = fazerAdmin(opcoes)
  console.log('\n' + linha('━'))
  console.log('  ' + titulo.toUpperCase())
  console.log(linha('━'))

  let consultas = opcoes.consultas ?? []

  for (const texto of mensagens) {
    consultas = consultas.filter((c) => !canceladas.includes(c.id))
    console.log('\n' + bloco(texto, '  ▶ PACIENTE: ').replace('  ▶ PACIENTE: ', '  ▶ PACIENTE: '))

    const r = await tratarConversa({
      admin,
      clinicId: 'c1',
      conversationId: 'conv1',
      estadoAtual: conversa.booking_state,
      opcoesAtuais: conversa.booking_options,
      unidadeEmAndamento: conversa.booking_unit_id,
      modalidadeEmAndamento: conversa.booking_modality ?? null,
      pacienteEmAndamento: conversa.booking_patient_id ?? null,
      consultas,
      consultaASubstituir: conversa.booking_replaces_id ?? null,
      consultaEmCadastro: conversa.booking_intake_id ?? null,
      respostasNaEspera: conversa.auto_replies_while_waiting ?? 0,
      // "[ANEXO]" faz as vezes da foto que a Meta entrega sem corpo nenhum -
      // e sem corpo e literal: foto sem legenda chega com o texto vazio.
      anexo: texto === '[ANEXO]',
      jaViuOMenu: Boolean(conversa.menu_sent_at),
      podeIniciarMenu: true,
      texto: texto === '[ANEXO]' ? '' : texto,
      telefone: '5513999990000',
      pacientes: opcoes.pacientes ?? [],
      nomeDoPerfil: opcoes.nomeDoPerfil ?? 'Marina',
      textos: TEXTOS,
      agora: opcoes.agora,
    })

    if (!r) {
      console.log('    (o robô fica em silêncio)')
      continue
    }
    // O que CHEGA no celular (01/10/2026): passa pelo envio de verdade, que
    // divide texto longo e poe os botoes do fecho. Antes a simulacao mostrava
    // a lista pedida pelo robo, e ninguem via que ela se perdia no envio.
    const enviadas = montarMensagens(r.resposta, r.botoes || r.lista ? { botoes: r.botoes, lista: r.lista } : undefined)
    enviadas.forEach((m, i) => {
      if (enviadas.length > 1) console.log(`    ── mensagem ${i + 1} de ${enviadas.length} ──`)
      const corpo = m.type === 'text' ? m.text.body : m.interactive.body.text
      console.log(bloco(corpo, '    '))
      if (m.type !== 'interactive') return
      if (m.interactive.type === 'button') {
        console.log('    [botões] ' + m.interactive.action.buttons.map((b) => b.reply.title).join(' | '))
      } else {
        // Titulo e descricao: a descricao e o que explica para onde a linha
        // leva, e esconde-la aqui ja deixou passar um "Voce viu: Santos" numa
        // linha que servia justamente para ver as OUTRAS unidades.
        console.log(
          `    [lista "${m.interactive.action.button}"] ` +
            m.interactive.action.sections[0].rows.map((l) => (l.description ? `${l.title} (${l.description})` : l.title)).join(' | '),
        )
      }
    })
    if (r.atencao) console.log(`    ⚑ conversa marcada para a equipe: ${r.atencao}`)
  }

  if (marcadas.length) {
    console.log('\n  ── o que foi gravado ──')
    for (const m of marcadas) {
      console.log(`    consulta: ${m.starts_at} · unidade ${m.unit_id} · ${m.modality} · ${m.contact_name}`)
    }
  }
  if (cadastrados.length) {
    for (const c of cadastrados) console.log(`    cadastro criado: ${c.name}`)
  }
  if (canceladas.length) console.log(`    canceladas: ${canceladas.join(', ')}`)
}

// ---------------------------------------------------------------
// As jornadas
// ---------------------------------------------------------------

const ANA = {
  id: 'p1',
  name: 'Ana Paula Souza',
  nascimento: '2019-03-12',
  responsavel: 'Marina Souza',
  cpf: '39053344705',
  email: 'marina@exemplo.com',
}

await conversar('1. Mãe nova pergunta o valor e marca em Santos', [
  'Oi, boa tarde',
  '1',
  '1',
  '2',
  '1',
  '1',
  '2',
  'Helena Souza Lima',
  '14/03/2021',
  'Marina Souza Lima',
  'pular',
  'marina@exemplo.com',
])

await conversar('2. Pergunta escrita, sem passar pelo menu', ['quanto custa a consulta?', '2'])

await conversar('3. Convênio e endereço: resposta direta, sem perguntar onde', [
  'vocês atendem unimed?',
  'onde fica o consultório?',
])

await conversar('4. Telemedicina: informações e urgência', ['Boa noite', '1', '3', 'urgência'])

await conversar('5. Telemedicina: marcando de verdade', ['Oi', '2', '3', '1', '1'], { pacientes: [ANA] })

await conversar('6. Urgência como primeira mensagem', [
  'socorro, é urgente, meu filho está muito mal',
])

await conversar('7. Pergunta clínica não é respondida pelo robô', [
  'meu filho está com dor de barriga há 3 dias, posso dar dipirona?',
])

await conversar('8. Paciente conhecido vê e cancela a consulta', ['Olá', '4', 'cancelar', 'sim'], {
  pacientes: [ANA],
  consultas: [
    {
      id: 'c-1',
      inicio: `${QUARTA}T11:00:00Z`,
      unidade: 'Livance · Santos',
      endereco: 'Av. Anna Costa, 228, 20º andar, Gonzaga',
      paciente: 'Ana Paula Souza',
      confirmada: true,
    },
  ],
})

await conversar('9. Telemedicina desligada: o robô não a oferece', ['Oi', '2'], { teleAtiva: false })

await conversar('10. Urgência no meio da fila da equipe', ['Oi', '3', 'é urgente, ele está muito mal'])

// A quarta pergunta cai no silêncio de propósito: se três textos prontos não
// resolveram, o quarto também não resolve, e quem precisa responder é gente.
await conversar('11. Esperando a equipe: três respostas prontas, depois silêncio', [
  'Oi',
  '3',
  'vocês atendem unimed?',
  'onde fica o consultório?',
  'o que preciso levar?',
  'e quanto tempo demora a consulta?',
])

// Mudar de assunto no meio de uma escolha: o robô responde e repete a pergunta.
await conversar('12. Pergunta no meio da escolha da unidade', [
  'Oi',
  '1',
  'Convenio',
  '1',
])

// Foto de exame: o robô não lê, então entrega para a equipe em vez de mandar
// menu para quem acabou de enviar o ultrassom do filho.
await conversar('13. Mandou uma foto do exame', ['Oi', '[ANEXO]', '[ANEXO]'])

// Como a pessoa pede para marcar quando ninguém explicou o formato.
for (const frase of [
  'quero marcar retorno para Tomás Oliveira Prado',
  'queria marcar uma consulta',
  'gostaria de agendar para o meu filho',
  'quero remarcar',
  'marcar',
]) {
  await conversar(`14. "${frase}"`, [frase], { pacientes: [ANA] })
}

// 2ª via de receita e pedido de exame: o caminho que nasceu do laboratório
// devolvendo o pedido por causa do CID.
await conversar('15. 2ª via de receita, com a farmácia exigindo correção', [
  'Oi',
  '5',
  '1',
  'Domperidona 1mg/ml',
  'a farmácia disse que a validade venceu',
], { pacientes: [ANA] })

await conversar('16. Pedido de exame, sem exigência nenhuma', [
  'Oi',
  '5',
  '2',
  'Ultrassom de abdome total',
  'não',
], { pacientes: [ANA] })

await conversar('17. Controlado: sai do automático antes de prometer prazo', [
  'Oi',
  '5',
  '1',
  'Rivotril',
], { pacientes: [ANA] })

await conversar('18. Farmácia escrevendo de um número desconhecido', [
  'Oi',
  '5',
  '2',
  'paciente Gabriel Souza, o CID não confere com o exame pedido',
])

await conversar('19. Número desconhecido que diz ser o responsável', ['Oi', '5', '1'])

await conversar('20. Foto do documento recusado no lugar da explicação', [
  'Oi',
  '5',
  '1',
  'Omeprazol',
  '[ANEXO]',
], { pacientes: [ANA] })

// Casos reais de 06 e 07/10/2026, para ler depois dos ajustes.
await conversar('21a. Opção 1 do jeito esperado: escolhe a unidade e recebe valor e endereço', [
  'Bom dia',
  '1',
  '1',
])

await conversar('21b. Real 07/10 (Lucas): escreve uma pergunta em vez de escolher a unidade', [
  'Bom dia',
  '1',
  'Dr. Marcello costuma solicitar exames para investigar dor abdominal crônica?',
])

await conversar('22. Real 06/10 (Julio): o telefone da ficha é de outra pessoa', ['Nao sou o Julio'])

await conversar('23. Real 03/10 (Ben): retorno para daqui a 3 meses', [
  'Oi',
  'Dr. pediu para agendar retorno em 3 meses. Gostaria de deixar agendado.',
])

// Revisao de 07/10/2026: jejum, remarcar por extenso e urgencia fora do horario.
await conversar('26. "Precisa de jejum?" e "quanto tempo demora a consulta?"', [
  'Oi',
  'precisa de jejum para a consulta?',
  'e quanto tempo demora a consulta?',
])

await conversar('24. "Quero remarcar" de quem já tem consulta marcada', ['quero remarcar'], {
  pacientes: [ANA],
  consultas: [
    {
      id: 'c-1',
      inicio: `${QUARTA}T11:00:00Z`,
      unidade: 'Livance · Santos',
      endereco: 'Av. Anna Costa, 228, 20º andar, Gonzaga',
      paciente: 'Ana Paula Souza',
      confirmada: true,
    },
  ],
})

await conversar('25. Urgência numa sexta às 23h', ['socorro, é urgente, meu filho está muito mal'], {
  agora: new Date(`${proxima(5)}T23:00:00-03:00`),
})

console.log('\n' + linha('━'))
console.log('  fim da simulação')
console.log(linha('━') + '\n')
