// Quando a mensagem da familia vira notificacao no celular da equipe.
// Regra em supabase/functions/_shared/aviso-da-equipe.ts.
import assert from 'node:assert/strict'
import { montarAviso, motivoFinal } from './aviso-da-equipe.build.mjs'

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

const base = {
  conversationId: 'c1',
  atencaoAntes: false,
  motivoAntes: null,
  motivoAgora: null,
  texto: 'Quero falar com alguém',
  pacientes: [{ name: 'Joana Lima' }],
  nomeDoPerfil: 'Mãe da Joana',
  telefone: '5513991165576',
}

caso('conversa que o robo resolveu sozinho nao avisa ninguem', () => {
  assert.equal(montarAviso(base), null)
})

caso('pediu para falar com a equipe: avisa com o nome do paciente', () => {
  const a = montarAviso({ ...base, motivoAgora: 'atendente' })
  assert.equal(a.titulo, 'Joana Lima quer falar com a equipe')
  assert.equal(a.corpo, 'Quero falar com alguém')
  assert.equal(a.etiqueta, 'conversa-c1')
  assert.equal(a.urgente, false)
})

caso('urgencia avisa marcada como urgente', () => {
  const a = montarAviso({ ...base, motivoAgora: 'urgencia', texto: 'Meu filho está vomitando sangue' })
  assert.match(a.titulo, /^🚨 Urgência: Joana Lima$/)
  assert.equal(a.urgente, true)
})

caso('2a via e farmacia avisam', () => {
  assert.match(montarAviso({ ...base, motivoAgora: 'documento' }).titulo, /2ª via/)
  assert.match(montarAviso({ ...base, motivoAgora: 'farmacia' }).titulo, /Farmácia/)
})

caso('motivos fora da escolha da clinica nao avisam', () => {
  for (const m of ['anexo', 'ajuda', 'falha', 'cancelou_sozinho']) {
    assert.equal(montarAviso({ ...base, motivoAgora: m }), null, m)
  }
})

caso('ja na fila e escreveu de novo: avisa como mensagem, titulo so com o nome', () => {
  const a = montarAviso({ ...base, atencaoAntes: true, motivoAntes: 'atendente', motivoAgora: 'atendente', texto: 'Alguém?' })
  assert.equal(a.titulo, 'Joana Lima')
  assert.equal(a.corpo, 'Alguém?')
})

caso('na fila por urgencia e escreveu de novo: a sirene continua no titulo', () => {
  const a = montarAviso({ ...base, atencaoAntes: true, motivoAntes: 'urgencia', motivoAgora: 'urgencia' })
  assert.equal(a.titulo, '🚨 Joana Lima')
  assert.equal(a.urgente, true)
})

caso('mudou de motivo (atendente -> urgencia) conta como pedido novo', () => {
  const a = montarAviso({ ...base, atencaoAntes: true, motivoAntes: 'atendente', motivoAgora: 'urgencia' })
  assert.match(a.titulo, /Urgência/)
})

caso('irmaos no mesmo telefone: usa o nome do perfil, nao um dos filhos', () => {
  const a = montarAviso({ ...base, motivoAgora: 'atendente', pacientes: [{ name: 'Ana' }, { name: 'Bia' }] })
  assert.equal(a.titulo, 'Mãe da Joana quer falar com a equipe')
})

caso('sem cadastro e sem nome de perfil: telefone formatado', () => {
  const a = montarAviso({ ...base, motivoAgora: 'atendente', pacientes: [], nomeDoPerfil: '' })
  assert.equal(a.titulo, '(13) 99116-5576 quer falar com a equipe')
})

caso('anexo sem legenda vira texto legivel, e texto longo e cortado', () => {
  assert.equal(montarAviso({ ...base, motivoAgora: 'atendente', texto: '[audio]' }).corpo, '🎤 Áudio')
  const longo = montarAviso({ ...base, motivoAgora: 'atendente', texto: 'a'.repeat(500) }).corpo
  assert.equal(longo.length, 138)
  assert.ok(longo.endsWith('…'))
})

caso('tentou falar (mensagem que o WhatsApp nao mostra) avisa a equipe', () => {
  const aviso = montarAviso({ ...base, motivoAgora: 'nao_suportada', texto: 'Tentou falar (talvez uma ligação pelo WhatsApp)' })
  assert.ok(aviso, 'nao_suportada deveria avisar')
  assert.match(aviso.titulo, /tentou falar com a clínica/)
})

// Real 23/10/2026 (13) 98812-5129: "Obrigado pela atencao" depois do "um
// abraco" da IA virou "Quer falar com a equipe" e pedido no celular do Edu.
caso('fechamento calado nao vira pedido de gente', () => {
  assert.equal(motivoFinal({ houveResposta: false, calouNoFechamento: true, atencaoAntes: false, motivoAntes: null }), null)
})
caso('fechamento calado mantem a bandeira que ja estava', () => {
  assert.equal(motivoFinal({ houveResposta: false, calouNoFechamento: true, atencaoAntes: true, motivoAntes: 'documento' }), 'documento')
})
caso('silencio de verdade continua indo para a equipe', () => {
  assert.equal(motivoFinal({ houveResposta: false, atencaoAntes: false, motivoAntes: null }), 'atendente')
  assert.equal(motivoFinal({ houveResposta: false, atencaoAntes: true, motivoAntes: 'ajuda' }), 'ajuda')
})
caso('resposta com pedido: o motivo do resultado', () => {
  assert.equal(motivoFinal({ houveResposta: true, atencaoDoResultado: 'urgencia', atencaoAntes: true, motivoAntes: 'atendente' }), 'urgencia')
})
caso('resposta sem pedido: a bandeira so sobe', () => {
  assert.equal(motivoFinal({ houveResposta: true, atencaoAntes: true, motivoAntes: 'atendente' }), 'atendente')
  assert.equal(motivoFinal({ houveResposta: true, atencaoAntes: false, motivoAntes: 'atendente' }), null)
})

console.log(`aviso-da-equipe: ${ok} verificacoes ok`)
