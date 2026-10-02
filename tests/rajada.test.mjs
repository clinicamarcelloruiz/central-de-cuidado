// Mensagens em rajada (supabase/functions/_shared/rajada.ts). Caso real de
// 30/09/2026: duas mensagens com 2 segundos de diferenca, processadas juntas.
import assert from 'node:assert/strict'
import { precisaEsperar, JANELA_DA_RAJADA_MS } from './rajada.build.mjs'

let ok = 0
function caso(nome, fn) {
  try {
    fn()
    ok++
  } catch (erro) {
    console.error('FALHOU:', nome)
    throw erro
  }
}

const agora = Date.parse('2026-09-30T13:59:19Z')
// O mesmo criterio do robo, simplificado: menciona nota fiscal ou recibo.
const ehNota = (corpo) => /nota fiscal|\bnf\b|recibo/i.test(corpo)
const NOTA = 'Olá bom dia Tudo bem? Meu filho passou em consulta com o dr Marcelo dia 25/09 e preciso da nota fiscal'
const ha = (ms) => new Date(agora - ms).toISOString()

caso('pedido de nota 2s antes, ainda sem resposta: espera (caso de 30/09)', () => {
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(2000), corpo: NOTA }, agora, ehNota), true)
})

caso('conversa nova (nada antes): nao espera', () => {
  assert.equal(precisaEsperar(null, agora, ehNota), false)
})

caso('a ultima e nossa: a conversa esta em dia, nao espera', () => {
  assert.equal(precisaEsperar({ direction: 'outbound', criadaEm: ha(1000), corpo: NOTA }, agora, ehNota), false)
})

caso('mensagem da familia de horas atras sem resposta nao e rajada', () => {
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(3 * 3600 * 1000), corpo: NOTA }, agora, ehNota), false)
})

caso('no limite da janela deixa de esperar', () => {
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(JANELA_DA_RAJADA_MS - 1), corpo: NOTA }, agora, ehNota), true)
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(JANELA_DA_RAJADA_MS), corpo: NOTA }, agora, ehNota), false)
})

caso('relogio torto (mensagem "do futuro") nao trava ninguem', () => {
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(-5000), corpo: NOTA }, agora, ehNota), false)
})

caso('rajada que nao e de nota fiscal nao espera (decisao de 01/10)', () => {
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(2000), corpo: 'Oi' }, agora, ehNota), false)
  assert.equal(precisaEsperar({ direction: 'inbound', criadaEm: ha(2000), corpo: 'quero marcar' }, agora, ehNota), false)
})

console.log(`rajada: ${ok} verificacoes ok`)
