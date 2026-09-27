// Quem atende nas frases fixas do robo (27/09/2026).
import { quemAtende } from './quem-atende.build.mjs'

let ok = 0
let falhas = 0
function confere(nome, cond, detalhe) {
  if (cond) ok++
  else {
    falhas++
    console.error('FALHOU:', nome, detalhe ?? '')
  }
}

const REAL = '1ffde840-a905-4300-b4fd-51571fcefdc0'
const TESTE = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9'

// A clinica real nao pode mudar uma letra.
confere('clinica real: o Dr. Marcello', quemAtende(REAL).o === 'o Dr. Marcello' && quemAtende(REAL).O === 'O Dr. Marcello')
confere('clinica real: saudacao de sempre', quemAtende(REAL).saudacaoPadrao === 'Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.')
confere('clinica dos testes do robo (c1) continua com o Dr. Marcello', quemAtende('c1').o === 'o Dr. Marcello')
confere('sem clinica, o de sempre', quemAtende(null).o === 'o Dr. Marcello')

// A clinica de teste nao cita o Dr. Marcello em lugar nenhum.
const t = quemAtende(TESTE)
confere('clinica de teste: a Dra. Ana', t.o === 'a Dra. Ana' && t.O === 'A Dra. Ana')
confere('clinica de teste: nenhuma frase com Marcello', !/Marcello/.test(JSON.stringify(t)), JSON.stringify(t))

console.log(`Quem atende: ${ok} verificações passaram.`)
if (falhas) {
  console.error(`FALHAS: ${falhas}`)
  process.exit(1)
}
