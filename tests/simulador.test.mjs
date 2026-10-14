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
import { horariosLivres, copiarAgenda } from './simulador.build/agenda.mjs'

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

async function rodar(roteiro, chaveIdentidade) {
  const s = new Simulacao(IDENTIDADES[chaveIdentidade], FAMILIAS[roteiro.familia])
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

console.warn = warnOriginal
console.log(`simulador.test: ${ok} casos ok`)
