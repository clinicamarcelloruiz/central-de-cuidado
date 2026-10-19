// De qual anuncio a conversa veio (supabase/functions/_shared/origem-do-anuncio.ts).
// Pedido de 19/10/2026: a campanha do Instagram leva direto ao robo e nada
// dizia quem tinha chegado por ela.
import assert from 'node:assert/strict'
import { origemDoAnuncio } from './origem-do-anuncio.build.mjs'

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

const PRONTA = 'Olá! Vi o anúncio e quero agendar uma consulta com o Dr. Marcello.'

caso('referral com link do Instagram: instagram, com titulo e link', () => {
  const r = origemDoAnuncio(
    { source_url: 'https://www.instagram.com/p/DAbc123/', source_type: 'ad', source_id: '120250812631280082', headline: 'Gastropediatra em Santos' },
    'oi',
  )
  assert.deepEqual(r, { origem: 'instagram', titulo: 'Gastropediatra em Santos', url: 'https://www.instagram.com/p/DAbc123/' })
})

caso('referral com link do Facebook: facebook', () => {
  assert.equal(origemDoAnuncio({ source_url: 'https://www.facebook.com/61595172316681/posts/1', source_type: 'post' }, 'oi')?.origem, 'facebook')
})

caso('referral com link curto fb.me: meta, sem chutar a plataforma', () => {
  assert.equal(origemDoAnuncio({ source_url: 'https://fb.me/abc', source_type: 'ad' }, PRONTA)?.origem, 'meta')
})

caso('referral so com ctwa_clid, sem link: meta', () => {
  assert.deepEqual(origemDoAnuncio({ ctwa_clid: 'ARAx' }, 'oi'), { origem: 'meta', titulo: null, url: null })
})

caso('referral manda mais que o texto: texto do Google com referral do Instagram', () => {
  assert.equal(origemDoAnuncio({ source_url: 'https://instagram.com/p/1' }, 'Encontrei o Dr. Marcello no Google')?.origem, 'instagram')
})

caso('sem referral, mensagem pronta do anuncio: instagram', () => {
  assert.equal(origemDoAnuncio(undefined, PRONTA)?.origem, 'instagram')
})

caso('mensagem pronta sem acento e em maiusculas: instagram', () => {
  assert.equal(origemDoAnuncio(null, 'VI O ANUNCIO E QUERO AGENDAR uma consulta')?.origem, 'instagram')
})

caso('texto do site para quem veio do Google: google', () => {
  assert.equal(origemDoAnuncio(undefined, 'Olá! Encontrei o Dr. Marcello no Google e gostaria de agendar uma consulta.')?.origem, 'google')
  assert.equal(origemDoAnuncio(undefined, 'encontrei o dr marcelo no google')?.origem, 'google')
})

caso('texto comum do site nao e anuncio', () => {
  assert.equal(origemDoAnuncio(undefined, 'Olá! Vim pelo site do Dr. Marcello e gostaria de agendar uma consulta.'), null)
})

caso('mensagem comum: sem origem', () => {
  assert.equal(origemDoAnuncio(undefined, 'Bom dia, quero marcar consulta'), null)
  assert.equal(origemDoAnuncio({}, 'oi'), null)
})

caso('titulo longo e cortado', () => {
  assert.equal(origemDoAnuncio({ source_url: 'https://instagram.com/p/1', headline: 'x'.repeat(400) }, '')?.titulo?.length, 160)
})

console.log(`origem do anuncio: ${ok} verificacoes ok`)
