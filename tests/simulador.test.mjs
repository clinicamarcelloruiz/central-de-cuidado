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

console.warn = warnOriginal
console.log(`simulador.test: ${ok} casos ok`)
