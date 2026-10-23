// Foto, audio e documento da familia vao junto para os celulares (23/10/2026).
// Ver supabase/functions/_shared/anexo-para-equipe.ts.
import { anexoQueVai, mensagemDoAnexo, notaDoAnexo } from './anexo-para-equipe.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

const link = 'https://acervo/assinado?token=x'
for (const t of ['image', 'audio', 'voice', 'document', 'video']) confere(`vai: ${t}`, anexoQueVai(t))
for (const t of ['sticker', 'location', 'contacts', 'text', '', null]) confere(`nao vai: ${t}`, !anexoQueVai(t))

const foto = mensagemDoAnexo({ tipo: 'image', link }, 'Maria Flor')
confere('foto: imagem com link e legenda de quem mandou', foto?.type === 'image' && foto.image.link === link && foto.image.caption.includes('Maria Flor'), JSON.stringify(foto))
const audio = mensagemDoAnexo({ tipo: 'voice', link }, 'Maria Flor')
confere('audio de voz: vai como audio, sem legenda (a Meta recusa)', audio?.type === 'audio' && audio.audio.link === link && !('caption' in audio.audio), JSON.stringify(audio))
const doc = mensagemDoAnexo({ tipo: 'document', link, nome: 'exame.pdf' }, 'Maria Flor')
confere('documento: com o nome do arquivo', doc?.type === 'document' && doc.document.filename === 'exame.pdf', JSON.stringify(doc))
confere('documento sem nome: nome padrao', mensagemDoAnexo({ tipo: 'document', link }, 'X')?.document.filename === 'documento')
confere('figurinha: nao vira mensagem', mensagemDoAnexo({ tipo: 'sticker', link }, 'X') === null)
confere('sem link: nao vira mensagem', mensagemDoAnexo({ tipo: 'image', link: '' }, 'X') === null)

confere('nota: sem tentativa, vazia', notaDoAnexo('image', []) === '')
// 23/10/2026: deu certo, sem nota ("nao precisa das notas").
const foi = notaDoAnexo('image', [{ numero: '5513997039614', ok: true }, { numero: '5511988887777', ok: true }])
confere('nota: foi para todos, vazia', foi === '', foi)
const naoFoi = notaDoAnexo('voice', [{ numero: '5513997039614', ok: true }, { numero: '5511988887777', ok: false, erro: 'Re-engagement message' }])
confere('nota: falha grita e diz que esta na Central', naoFoi.includes('⚠️ O áudio não foi para final 7777') && naoFoi.includes('24 horas') && naoFoi.includes('Central'), naoFoi)
confere('nota: na falha, so fala de quem nao recebeu', !naoFoi.includes('9614'), naoFoi)

console.log(`anexo para a equipe: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
