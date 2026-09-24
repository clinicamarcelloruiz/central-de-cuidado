// Frase do horario de atendimento (24/09/2026). Antes era fixa e, as 23h de
// sabado, prometia "proximo dia util" sem dizer quando.

import { avisoDeHorario, dentroDoExpediente, quandoAEquipeVolta } from './expediente.build.mjs'

let passou = 0
const falhas = []
function igual(titulo, veio, esperado) {
  if (veio === esperado) passou++
  else falhas.push(`${titulo}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(veio)}`)
}

// Horarios em Brasilia (-03:00). 24/09/2026 e uma quinta-feira.
igual('quinta 10h dentro', dentroDoExpediente(new Date('2026-09-24T10:00:00-03:00')), true)
igual('quinta 18h fora', dentroDoExpediente(new Date('2026-09-24T18:00:00-03:00')), false)
igual('quinta 7h59 fora', dentroDoExpediente(new Date('2026-09-24T07:59:00-03:00')), false)
igual('sabado 10h fora', dentroDoExpediente(new Date('2026-09-26T10:00:00-03:00')), false)

igual('madrugada de quinta volta hoje', quandoAEquipeVolta(new Date('2026-09-24T02:00:00-03:00')), 'hoje, a partir das 8h')
igual('quinta a noite volta amanha', quandoAEquipeVolta(new Date('2026-09-24T21:00:00-03:00')), 'amanhã, a partir das 8h')
igual('sexta a noite volta segunda', quandoAEquipeVolta(new Date('2026-09-25T21:00:00-03:00')), 'na segunda-feira, a partir das 8h')
igual('sabado volta segunda', quandoAEquipeVolta(new Date('2026-09-26T10:00:00-03:00')), 'na segunda-feira, a partir das 8h')
igual('domingo a noite volta amanha', quandoAEquipeVolta(new Date('2026-09-27T22:00:00-03:00')), 'amanhã, a partir das 8h')

// Nao depende do fuso da maquina: 23h de sexta em Brasilia e 02h de sabado em UTC.
igual('fuso: sexta 23h de Brasilia', quandoAEquipeVolta(new Date('2026-09-26T02:00:00Z')), 'na segunda-feira, a partir das 8h')

igual('frase no horario', avisoDeHorario(new Date('2026-09-24T10:00:00-03:00')), 'Atendemos de segunda a sexta, das 8h às 18h.')
igual(
  'frase fora do horario',
  avisoDeHorario(new Date('2026-09-26T10:00:00-03:00')),
  'Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde na segunda-feira, a partir das 8h.',
)

console.log(`Expediente: ${passou} verificações passaram.`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
