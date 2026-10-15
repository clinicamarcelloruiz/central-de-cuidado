// Simulador do atendimento (src/simulador): os roteiros de reuniao, rodados
// contra o robo de producao, nas duas identidades.
//
// O simulador nao tem copia do robo - usa o mesmo atendimento.ts do webhook.
// Isso e o que o torna fiel, e tambem o que o deixa fragil: quando o robo muda
// um caminho (uma opcao nova, uma pergunta a mais), um roteiro pode passar a
// tocar numa opcao que nao existe mais. Sem este teste, isso apareceria pela
// primeira vez na frente de um cliente.
import assert from 'node:assert/strict'
import { Simulacao } from './simulador.build/sessao.mjs'
import { IDENTIDADES, FAMILIAS } from './simulador.build/dados.mjs'
import { ROTEIROS } from './simulador.build/roteiros.mjs'
import { horariosLivres, copiarAgenda, tabelasDaAgenda } from './simulador.build/agenda.mjs'
import { identidadeDoSistema } from './simulador.build/da-clinica.mjs'

let ok = 0
async function caso(nome, fn) {
  try {
    await fn()
    ok++
  } catch (erro) {
    console.error('FALHOU:', nome)
    throw erro
  }
}

// O banco falso avisa por console.warn quando o robo chama algo que ele nao
// imita. Aqui o aviso vira falha: e o sinal de que o robo mudou e o simulador
// ficou para tras.
const avisos = []
const warnOriginal = console.warn
console.warn = (...args) => {
  if (String(args[0]).startsWith('[simulador]')) avisos.push(args.join(' '))
  else warnOriginal(...args)
}

const FALHA = /tive um problema|não consegui|nao consegui|falha/i
// O que nao pode aparecer em cada identidade. A de demonstracao e a que vai
// para a frente de outros medicos: nada do Dr. Marcello nem da Livance.
const PROIBIDO = {
  demo: /marcello|livance|santos|gastroenterolog/i,
  marcello: /dra\.? ana|moema|pinheiros|central de cuidado/i,
}

// Relogio fixo, 45 s por mensagem (15/10/2026). Com o relogio de verdade, o
// roteiro "marcar" falhava conforme a hora do dia: as 8h43 de uma quinta so
// sobrava um horario hoje, e o toque no segundo horario nao existia. Teste que
// passa ou falha pela hora em que alguem roda o PUBLICAR nao testa nada.
const QUARTA_10H = Date.parse('2026-10-14T13:00:00Z')

async function rodar(roteiro, chaveIdentidade) {
  let agora = QUARTA_10H
  const s = new Simulacao(IDENTIDADES[chaveIdentidade], FAMILIAS[roteiro.familia], { relogio: () => new Date(agora) })
  const textos = []
  let ultimaComToques = null
  for (const [i, passo] of roteiro.passos.entries()) {
    if ('equipe' in passo) {
      s.responderComoEquipe(passo.equipe)
      continue
    }
    let entrada
    if ('toque' in passo) {
      const opcao = ultimaComToques?.toques?.opcoes.find((o) => o.id === passo.toque)
      assert.ok(
        opcao,
        `passo ${i + 1}: a opcao "${passo.toque}" nao existe na ultima mensagem com botoes ` +
          `(tem: ${ultimaComToques?.toques?.opcoes.map((o) => o.id).join(', ') ?? 'nenhuma'})`,
      )
      entrada = { texto: opcao.titulo, idDoToque: opcao.id }
    } else if ('anexo' in passo) {
      entrada = { texto: '', anexo: true }
    } else {
      entrada = { texto: passo.texto }
    }
    const r = await s.enviarDaFamilia(entrada)
    agora += 45000
    for (const m of r.respostas) textos.push(m.texto)
    ultimaComToques = [...r.respostas].reverse().find((m) => m.toques) ?? (r.respostas.length ? null : ultimaComToques)
  }
  return { s, textos }
}

for (const chave of Object.keys(IDENTIDADES)) {
  for (const roteiro of ROTEIROS) {
    await caso(`${chave} / ${roteiro.chave}`, async () => {
      avisos.length = 0
      const { s, textos } = await rodar(roteiro, chave)
      assert.deepEqual(avisos, [], 'o robo chamou algo que o simulador nao imita')

      for (const texto of textos) {
        assert.doesNotMatch(texto, FALHA, `resposta de falha no meio do roteiro: ${texto.slice(0, 120)}`)
        assert.doesNotMatch(texto, PROIBIDO[chave], `texto da outra clinica na identidade ${chave}: ${texto.slice(0, 160)}`)
      }

      const consultas = s.consultas()
      const e = roteiro.espera
      assert.equal(consultas.filter((c) => c.status === 'scheduled').length, e.marcadas, 'consultas marcadas no fim')
      assert.equal(consultas.filter((c) => c.status === 'cancelled').length, e.canceladas ?? 0, 'consultas canceladas no fim')
      if (e.pacientes !== undefined) assert.equal(s.pacientes().length, e.pacientes, 'pacientes do telefone no fim')
      assert.equal(s.motivo, e.motivo, 'bandeira de atencao no fim')
      if (e.resolvida) assert.equal(s.situacao, 'resolvida', 'conversa resolvida pelo robo')
    })
  }
}

await caso('consulta marcada pelo roteiro sai da lista de horarios livres', async () => {
  const roteiro = ROTEIROS.find((r) => r.chave === 'marcar')
  const { s } = await rodar(roteiro, 'demo')
  const [marcada] = s.consultas()
  const livres = await s.banco.rpc('available_slots', { p_unit_id: marcada.unit_id })
  assert.ok(!livres.data.some((h) => h.slot_start === marcada.starts_at), 'o horario marcado continuou livre')
})

await caso('a equipe concluindo devolve a conversa ao robo', async () => {
  const s = new Simulacao(IDENTIDADES.demo, FAMILIAS.cadastrada)
  await s.enviarDaFamilia({ texto: 'Oi' })
  s.responderComoEquipe('Oi, aqui é a Júlia.')
  const calado = await s.enviarDaFamilia({ texto: 'oi de novo' })
  assert.equal(calado.respostas.length, 0, 'com a equipe na conversa o robo devia ficar quieto')
  s.concluir()
  const deVolta = await s.enviarDaFamilia({ texto: 'Oi' })
  assert.ok(deVolta.respostas.length > 0, 'depois de concluir o robo devia voltar a responder')
})

// ---------------------------------------------------------------
// A agenda: horariosLivres e o available_slots do banco reescrito
// ---------------------------------------------------------------

// Segunda, 12/10/2026, 10:00 em Brasilia. Terca e 13/10, quarta 14/10.
const SEGUNDA_10H = new Date('2026-10-12T13:00:00Z')
// "13 08:00": dia do mes e hora de Brasilia.
const horas = (lista) =>
  lista.map((h) => {
    const local = new Date(new Date(h.slot_start).getTime() - 3 * 3600 * 1000).toISOString()
    return `${local.slice(8, 10)} ${local.slice(11, 16)}`
  })

function tabelas({ regras = [], excecoes = [], consultas = [], cfg = {}, unidades } = {}) {
  return {
    clinic_units: unidades ?? [{ id: 'u1', clinic_id: 'c', archived_at: null }],
    availability_rules: regras,
    schedule_exceptions: excecoes,
    clinic_settings: [{ clinic_id: 'c', schedule_slot_minutes: 40, schedule_horizon_days: 7, schedule_min_notice_hours: 2, ...cfg }],
    appointments: consultas,
  }
}
const TERCA_MANHA = { unit_id: 'u1', weekday: 2, starts_at: '08:00', ends_at: '10:00' }

// Janela de 7 dias a partir de segunda 12/10 vai ate 19/10: so a terca 13 entra.
await caso('agenda: periodo semanal vira horarios do tamanho da consulta', () => {
  assert.deepEqual(horas(horariosLivres(tabelas({ regras: [TERCA_MANHA] }), 'u1', SEGUNDA_10H)), ['13 08:00', '13 08:40', '13 09:20'])
  const quinze = horas(horariosLivres(tabelas({ regras: [TERCA_MANHA], cfg: { schedule_horizon_days: 8 } }), 'u1', SEGUNDA_10H))
  assert.deepEqual(quinze.slice(3), ['20 08:00', '20 08:40', '20 09:20'], 'janela de 8 dias devia alcancar a terca seguinte')
})

// available_slots_periodo (14/10/2026): o botao "Mandar horarios" pede um dia
// alem da agenda aberta, e o simulador tem de enxerga-lo como o banco.
await caso('agenda: periodo alcanca dia alem da janela e respeita as pontas', () => {
  const t = tabelas({ regras: [TERCA_MANHA], cfg: { schedule_horizon_days: 8 } })
  assert.ok(!horas(horariosLivres(t, 'u1', SEGUNDA_10H)).some((h) => h.startsWith('10 ')), 'a terca a 4 semanas nao esta na janela de 8 dias')
  const dia = horariosLivres(t, 'u1', SEGUNDA_10H, { de: '2026-11-10', ate: '2026-11-10' })
  assert.deepEqual(horas(dia), ['10 08:00', '10 08:40', '10 09:20'])
  assert.deepEqual(horariosLivres(t, 'u1', SEGUNDA_10H, { de: '2026-10-01', ate: '2026-10-11' }), [], 'periodo no passado')
  const longe = horariosLivres(t, 'u1', SEGUNDA_10H, { de: '2027-03-01', ate: '2027-12-31' })
  assert.ok(longe.length > 0 && longe.every((h) => h.slot_start < '2027-04-11'), 'nada alem de 180 dias')
})

await caso('agenda: duracao de 30 minutos muda os horarios', () => {
  const lista = horariosLivres(tabelas({ regras: [TERCA_MANHA], cfg: { schedule_slot_minutes: 30 } }), 'u1', SEGUNDA_10H)
  assert.deepEqual(horas(lista).slice(0, 4), ['13 08:00', '13 08:30', '13 09:00', '13 09:30'])
})

await caso('agenda: dia bloqueado some, da unidade ou de todas', () => {
  for (const unit_id of ['u1', null]) {
    const excecoes = [{ clinic_id: 'c', unit_id, exception_date: '2026-10-13', is_closed: true }]
    const lista = horas(horariosLivres(tabelas({ regras: [TERCA_MANHA], excecoes, cfg: { schedule_horizon_days: 8 } }), 'u1', SEGUNDA_10H))
    assert.ok(!lista.some((h) => h.startsWith('13')), `13/10 continuou aberto (unit_id ${unit_id})`)
    assert.ok(lista.some((h) => h.startsWith('20')), 'o bloqueio fechou outro dia')
  }
})

await caso('agenda: bloqueio de outra unidade nao fecha esta', () => {
  const excecoes = [{ clinic_id: 'c', unit_id: 'u2', exception_date: '2026-10-13', is_closed: true }]
  assert.ok(horas(horariosLivres(tabelas({ regras: [TERCA_MANHA], excecoes }), 'u1', SEGUNDA_10H)).includes('13 08:00'))
})

await caso('agenda: data extra abre um dia fora da semana', () => {
  const excecoes = [{ clinic_id: 'c', unit_id: 'u1', exception_date: '2026-10-17', is_closed: false, starts_at: '09:00', ends_at: '10:20' }]
  assert.deepEqual(horas(horariosLivres(tabelas({ excecoes }), 'u1', SEGUNDA_10H)), ['17 09:00', '17 09:40'])
})

await caso('agenda: antecedencia minima corta o comeco do dia', () => {
  const tercaAs7 = new Date('2026-10-13T10:00:00Z')
  const lista = horas(horariosLivres(tabelas({ regras: [TERCA_MANHA] }), 'u1', tercaAs7))
  assert.ok(!lista.includes('13 08:00') && !lista.includes('13 08:40'), 'ofereceu horario antes da antecedencia')
  assert.ok(lista.includes('13 09:20'))
})

await caso('agenda: janela de dias limita ate onde o robo oferece', () => {
  const lista = horas(horariosLivres(tabelas({ regras: [TERCA_MANHA], cfg: { schedule_horizon_days: 3 } }), 'u1', SEGUNDA_10H))
  assert.ok(lista.length > 0 && lista.every((h) => h.startsWith('13')), 'passou da janela')
})

await caso('agenda: consulta marcada ocupa o horario; cancelada e reserva vencida nao', () => {
  const consulta = (extra) => ({ clinic_id: 'c', unit_id: 'u1', starts_at: '2026-10-13T11:00:00Z', ends_at: '2026-10-13T11:40:00Z', status: 'scheduled', ...extra })
  const livre = (consultas) => horas(horariosLivres(tabelas({ regras: [TERCA_MANHA], consultas }), 'u1', SEGUNDA_10H)).includes('13 08:00')
  assert.equal(livre([consulta()]), false, 'horario marcado continuou livre')
  assert.equal(livre([consulta({ status: 'cancelled' })]), true, 'cancelada continuou ocupando')
  assert.equal(livre([consulta({ hold_expires_at: '2026-10-12T12:00:00Z' })]), true, 'reserva vencida continuou ocupando')
})

await caso('agenda: video ocupa o medico nas unidades fisicas, e o contrario', () => {
  const unidades = [
    { id: 'u1', clinic_id: 'c', archived_at: null },
    { id: 'tele', clinic_id: 'c', archived_at: null, telemedicina: true },
  ]
  const regras = [TERCA_MANHA, { ...TERCA_MANHA, unit_id: 'tele' }]
  const as8 = (unit_id) => [{ clinic_id: 'c', unit_id, starts_at: '2026-10-13T11:00:00Z', ends_at: '2026-10-13T11:40:00Z', status: 'scheduled' }]
  assert.ok(!horas(horariosLivres(tabelas({ unidades, regras, consultas: as8('tele') }), 'u1', SEGUNDA_10H)).includes('13 08:00'))
  assert.ok(!horas(horariosLivres(tabelas({ unidades, regras, consultas: as8('u1') }), 'tele', SEGUNDA_10H)).includes('13 08:00'))
})

await caso('agenda: a padrao da demonstracao oferece as manhas de terca e quinta em Moema', () => {
  const s = new Simulacao(IDENTIDADES.demo, FAMILIAS.nova, { relogio: () => SEGUNDA_10H })
  assert.deepEqual(horas(s.horariosLivres('unidade-moema')).slice(0, 7), [
    '13 08:00', '13 08:40', '13 09:20', '13 10:00', '13 10:40', '13 11:20', '15 08:00',
  ])
})

/** Passo de conversa por titulo da opcao, para testes que nao sabem o numero de antemao. */
async function tocarPorTitulo(s, respostas, titulo) {
  const opcao = [...respostas].reverse().find((m) => m.toques)?.toques.opcoes.find((o) => o.titulo.startsWith(titulo))
  assert.ok(opcao, `a opcao "${titulo}" nao apareceu`)
  return s.enviarDaFamilia({ texto: opcao.titulo, idDoToque: opcao.id })
}

await caso('agenda: unidade criada na configuracao aparece no robo e recebe a consulta', async () => {
  const agenda = copiarAgenda(IDENTIDADES.demo.agendaPadrao)
  agenda.unidades.push({
    id: 'unidade-nova', nome: 'Vila Mariana', endereco: 'Rua Domingos de Morais, 100', informacoes: '', convenio: '', telemedicina: false,
    periodos: [{ id: 'p', weekday: 6, inicio: '09:00', fim: '11:00' }],
  })
  const s = new Simulacao(IDENTIDADES.demo, FAMILIAS.cadastrada, { agenda })
  await s.enviarDaFamilia({ texto: 'Oi' })
  let r = await s.enviarDaFamilia({ texto: 'Marcar uma consulta', idDoToque: '2' })
  r = await tocarPorTitulo(s, r.respostas, 'Vila Mariana')
  assert.match(r.respostas.at(-1).texto, /sábado/i, 'os dias da unidade nova deviam ser sabados')
  r = await s.enviarDaFamilia({ texto: '1' })
  r = await s.enviarDaFamilia({ texto: '1' })
  const [marcada] = s.consultas()
  assert.equal(marcada?.unit_id, 'unidade-nova', 'a consulta devia cair na unidade nova')
  assert.equal(marcada?.status, 'scheduled')
})

await caso('agenda: mudanca com a conversa aberta vale na proxima mensagem', async () => {
  const s = new Simulacao(IDENTIDADES.demo, FAMILIAS.cadastrada)
  await s.enviarDaFamilia({ texto: 'Oi' })
  const agenda = copiarAgenda(IDENTIDADES.demo.agendaPadrao)
  agenda.unidades.push({ id: 'unidade-nova', nome: 'Jardins', endereco: 'Rua Augusta, 1', informacoes: '', convenio: '', telemedicina: false, periodos: [{ id: 'p', weekday: 1, inicio: '14:00', fim: '16:00' }] })
  agenda.telemedicinaAtiva = false
  s.aplicarAgenda(agenda)
  const r = await s.enviarDaFamilia({ texto: 'Marcar uma consulta', idDoToque: '2' })
  const opcoes = r.respostas.at(-1).toques.opcoes.map((o) => o.titulo)
  assert.ok(opcoes.includes('Jardins'), `Jardins nao apareceu: ${opcoes.join(', ')}`)
  assert.ok(!opcoes.some((o) => /telemedicina/i.test(o)), 'telemedicina desligada continuou oferecida')
})

// ---------------------------------------------------------------
// A conta de teste do sistema virando a identidade demo (14/10/2026)
// ---------------------------------------------------------------

// Linhas como o Supabase devolve: horario com segundos, unidade arquivada,
// resposta desligada, a agenda da telemedicina sem horarios proprios.
const LINHAS_DA_CONTA_DE_TESTE = {
  clinica: { id: 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9', name: 'Consultório Central de Cuidado' },
  unidades: [
    { id: 'moema', name: 'Moema', address: 'Rua Nova, 500, Moema', info_text: '📍 Endereço novo de Moema: Rua Nova, 500.', archived_at: null, telemedicina: false, accepts_insurance: null },
    { id: 'antiga', name: 'Unidade antiga', address: 'Rua Antiga, 10', info_text: '', archived_at: '2026-09-27T12:00:00Z', telemedicina: false },
    { id: 'tele', name: 'Telemedicina', address: '', info_text: '', archived_at: null, telemedicina: true },
  ],
  regras: [
    { id: 'r1', unit_id: 'moema', weekday: 2, starts_at: '08:00:00', ends_at: '10:00:00' },
    { id: 'r2', unit_id: 'antiga', weekday: 3, starts_at: '08:00:00', ends_at: '12:00:00' },
  ],
  excecoes: [{ id: 'e1', unit_id: null, exception_date: '2099-01-01', is_closed: true, starts_at: null, ends_at: null, reason: 'Feriado' }],
  configuracoes: {
    schedule_slot_minutes: 30,
    schedule_horizon_days: 21,
    schedule_min_notice_hours: 2,
    whatsapp_autoreply_text: 'Oi! Aqui é a recepção de teste do Consultório Central de Cuidado.',
    whatsapp_autoreply_known_text: '',
    whatsapp_menu_info_text: 'Texto geral da conta de teste.',
    telemedicine_enabled: false,
    telemedicine_info_text: '',
  },
  respostas: [
    { id: 'a1', subject: 'Valor', keywords: ['valor', 'quanto', 'custa'], answer: 'Valor da conta de teste: R$ 123,00.', ask_unit: false, is_active: true, position: 0 },
    { id: 'a2', subject: 'Estacionamento', keywords: ['estacionamento', 'estacionar'], answer: 'RESPOSTA DESLIGADA', ask_unit: false, is_active: false, position: 1 },
  ],
}

await caso('conta de teste: linhas do sistema viram a identidade demo', () => {
  const id = identidadeDoSistema(IDENTIDADES.demo, LINHAS_DA_CONTA_DE_TESTE)
  assert.equal(id.clinicId, IDENTIDADES.demo.clinicId, 'o id da clinica e o que faz o robo dizer "a Dra. Ana"')
  assert.deepEqual(id.agendaPadrao.unidades.map((u) => u.nome), ['Moema', 'Telemedicina'], 'unidade arquivada nao pode entrar')
  assert.deepEqual(id.agendaPadrao.unidades[0].periodos, [{ id: 'r1', weekday: 2, inicio: '08:00', fim: '10:00' }])
  assert.equal(id.agendaPadrao.unidades[1].telemedicina, true)
  assert.equal(id.agendaPadrao.preferencias.duracao, 30)
  assert.equal(id.agendaPadrao.telemedicinaAtiva, false)
  assert.equal(id.agendaPadrao.bloqueios[0].unidadeId, null)
})

await caso('conta de teste: o robo responde com o que esta no sistema', async () => {
  const id = identidadeDoSistema(IDENTIDADES.demo, LINHAS_DA_CONTA_DE_TESTE)
  const s = new Simulacao(id, FAMILIAS.nova)
  let r = await s.enviarDaFamilia({ texto: 'Oi' })
  assert.match(r.respostas[0].texto, /recepção de teste/, 'a saudacao devia ser a da conta de teste')
  r = await s.enviarDaFamilia({ texto: 'Dúvidas sobre a consulta', idDoToque: '1' })
  const textos = r.respostas.map((m) => m.texto).join('\n')
  // Uma unidade so (telemedicina desligada): o robo ja manda o texto dela.
  assert.match(textos, /Rua Nova, 500/, `o endereco novo nao chegou ao robo: ${textos.slice(0, 200)}`)
  assert.match(textos, /Texto geral da conta de teste/)
  r = await s.enviarDaFamilia({ texto: '2' })
  const tudo = r.respostas.map((m) => m.texto).join('\n')
  assert.doesNotMatch(tudo, /Unidade antiga/, 'unidade arquivada apareceu para a familia')
  const horarios = s.horariosLivres('moema').slice(0, 2).map((h) => (Date.parse(h.slot_end) - Date.parse(h.slot_start)) / 60000)
  assert.deepEqual(horarios, [30, 30], 'a duracao da conta de teste e 30 minutos')
})

await caso('conta de teste: resposta pronta desligada no sistema nao responde', async () => {
  const s = new Simulacao(identidadeDoSistema(IDENTIDADES.demo, LINHAS_DA_CONTA_DE_TESTE), FAMILIAS.nova)
  await s.enviarDaFamilia({ texto: 'Oi' })
  const valor = await s.enviarDaFamilia({ texto: 'quanto custa a consulta?' })
  assert.match(valor.respostas.map((m) => m.texto).join('\n'), /R\$ 123,00/)
  const estacionar = await s.enviarDaFamilia({ texto: 'onde posso estacionar?' })
  assert.doesNotMatch(estacionar.respostas.map((m) => m.texto).join('\n'), /RESPOSTA DESLIGADA/)
})

await caso('conta de teste: sem configuracoes valem os padroes do banco e a saudacao do robo', async () => {
  const id = identidadeDoSistema(IDENTIDADES.demo, { ...LINHAS_DA_CONTA_DE_TESTE, configuracoes: null })
  assert.deepEqual(id.agendaPadrao.preferencias, { duracao: 40, janela: 15, antecedencia: 2 })
  const s = new Simulacao(id, FAMILIAS.nova)
  const r = await s.enviarDaFamilia({ texto: 'Oi' })
  assert.match(r.respostas[0].texto, /Dra\. Ana Ribeiro/, 'sem saudacao cadastrada vale a padrao da clinica de teste')
})

await caso('conta de teste: texto vazio da unidade continua vazio, como no banco', () => {
  const id = identidadeDoSistema(IDENTIDADES.demo, LINHAS_DA_CONTA_DE_TESTE)
  const t = tabelasDaAgenda(id.agendaPadrao, id.clinicId)
  assert.equal(t.clinic_units.find((u) => u.id === 'tele').info_text, '')
})

await caso('conta de teste: mudanca relida com a conversa aberta vale na proxima mensagem', async () => {
  const s = new Simulacao(identidadeDoSistema(IDENTIDADES.demo, LINHAS_DA_CONTA_DE_TESTE), FAMILIAS.nova)
  await s.enviarDaFamilia({ texto: 'Oi' })
  const linhas = structuredClone(LINHAS_DA_CONTA_DE_TESTE)
  linhas.unidades[0].info_text = '📍 Mudou de novo: Avenida Ibirapuera, 2000.'
  const nova = identidadeDoSistema(IDENTIDADES.demo, linhas)
  s.atualizarClinica(nova)
  s.aplicarAgenda(nova.agendaPadrao)
  const r = await s.enviarDaFamilia({ texto: 'Dúvidas sobre a consulta', idDoToque: '1' })
  assert.match(r.respostas.map((m) => m.texto).join('\n'), /Avenida Ibirapuera, 2000/)
})

// Segunda rodada do painel de familias (14/10/2026).
// Os passos andam pelo id do toque, como a familia tocando no celular.
async function conversar(s, passos, inicio = QUARTA_10H) {
  let ultima = null
  let saida = []
  for (const passo of passos) {
    let entrada = { texto: passo }
    if (passo.startsWith('#')) {
      const id = passo.slice(1)
      const opcao = ultima?.toques?.opcoes.find((o) => o.id === id)
      assert.ok(opcao, `o toque ${id} nao existe (tem: ${ultima?.toques?.opcoes.map((o) => o.id).join(', ') ?? 'nenhum'})`)
      entrada = { texto: opcao.titulo, idDoToque: id }
    }
    const r = await s.enviarDaFamilia(entrada)
    saida = r.respostas
    ultima = [...r.respostas].reverse().find((m) => m.toques) ?? ultima
  }
  return saida.map((m) => m.texto).join('\n')
}

await caso('painel: consulta da "Outra criança" vira cadastro do irmao, nao da Helena', async () => {
  let agora = QUARTA_10H
  const s = new Simulacao(IDENTIDADES.marcello, FAMILIAS.com_consulta, { relogio: () => new Date((agora += 45000)) })
  const helena = s.pacientes()[0]
  const fim = await conversar(s, [
    'quero marcar outra consulta', '#2', '#2', '#1', '#1', '#1',
    'Pedro Souza Lima', '12/05/2010', 'Marina Souza Lima', '#PULAR', 'marina@exemplo.com',
  ])
  assert.match(fim, /Pedro Souza Lima/, 'o comprovante devia trazer o Pedro')
  const pedro = s.pacientes().find((p) => /pedro/i.test(String(p.name)))
  assert.ok(pedro, 'o Pedro devia ganhar cadastro proprio')
  const nova = s.consultas().find((c) => c.patient_id !== helena.id)
  assert.ok(nova && nova.patient_id === pedro.id, 'a consulta nova foi ligada ao cadastro da Helena')
  assert.equal(s.consultas().filter((c) => c.patient_id === helena.id).length, 1, 'a Helena devia continuar com a consulta dela, so')
})

await caso('painel: "ta bom, obrigada" depois de cancelar nao apaga o aviso para a equipe', async () => {
  let agora = Date.parse('2026-10-14T20:00:00Z')
  const s = new Simulacao(IDENTIDADES.marcello, FAMILIAS.com_consulta, { relogio: () => new Date((agora += 45000)) })
  await conversar(s, ['boa tarde, pode cancelar a consulta da Helena, ela ja melhorou', '#CANCELAR', 'sim pode cancelar'])
  assert.equal(s.motivo, 'cancelou_sozinho', 'o cancelamento devia acender a conversa')
  // Ela abre a agenda pelo "digite 2" e desiste com um obrigado: o robo
  // encerra o agendamento (concluida), e era isso que apagava a bandeira.
  await conversar(s, ['2'])
  const r = await conversar(s, ['ta bom, obrigada!'])
  assert.match(r, /não marquei nada/, 'o robo devia encerrar o agendamento')
  assert.equal(s.situacao, 'aguardando_equipe', 'o obrigado apagou o aviso do cancelamento')
  assert.equal(s.motivo, 'cancelou_sozinho')
})

console.warn = warnOriginal
console.log(`simulador.test: ${ok} casos ok`)
