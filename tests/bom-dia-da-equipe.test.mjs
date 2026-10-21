// Bom dia das 8h para quem chamou a equipe fora do horario (21/10/2026).
// Real: a Fatima tocou "Falar com a equipe" a 00:15 e nao escreveu mais nada.
import { readFileSync } from 'node:fs'
import { BOM_DIA_DA_EQUIPE, TRECHOS_DO_PEDIDO, precisaDoBomDia } from './bom-dia-da-equipe.build.mjs'
import { ESPERA_DO_ASSUNTO } from './assistente.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

const ROBO = 'Estou direcionando você para alguém da nossa equipe.\n\nPode já escrever sua dúvida por aqui.'
const de = (direction, body, created_at, automatic = direction === 'outbound') => ({ direction, body, created_at, automatic })
// Quarta, 21/10/2026: 00:15 em Sao Paulo = 03:15 UTC; 8h = 11:00 UTC.
const madrugada = [
  de('inbound', 'Olá! Encontrei o Dr. Marcello no Google e gostaria de agendar uma consulta.', '2026-10-21T02:57:00Z'),
  de('outbound', 'Vamos agendar! Em qual unidade?', '2026-10-21T02:57:10Z'),
  de('inbound', 'Falar com a equipe', '2026-10-21T03:15:00Z'),
  de('outbound', ROBO, '2026-10-21T03:15:05Z'),
]
const oitoDaManha = new Date('2026-10-21T11:00:00Z')

// Os trechos tem de estar nos textos de verdade: se alguem reescrever a
// resposta, o bom dia para de sair sem erro nenhum.
const atendimento = readFileSync(new URL('../supabase/functions/_shared/atendimento.ts', import.meta.url), 'utf8')
confere('trecho do robo existe em chamarEquipe', atendimento.includes(TRECHOS_DO_PEDIDO[0]))
confere('trecho da IA existe na espera do assunto', ESPERA_DO_ASSUNTO.includes(TRECHOS_DO_PEDIDO[1]))

confere('Real 21/10 (Fatima): pediu a equipe a 00:15 e sumiu, bom dia as 8h', precisaDoBomDia(madrugada, oitoDaManha))
confere('pedido sem assunto da IA tambem', precisaDoBomDia([...madrugada.slice(0, 3), de('outbound', ESPERA_DO_ASSUNTO, '2026-10-21T03:15:05Z')], oitoDaManha))
confere('familia escreveu depois: nao', !precisaDoBomDia([...madrugada, de('inbound', 'quero saber o valor', '2026-10-21T03:20:00Z')], oitoDaManha))
// A familia colando de volta o nosso texto (ou a equipe copiando a frase do
// robo a mao) nao e a resposta automatica ao pedido.
confere('familia colou o nosso texto: nao', !precisaDoBomDia([...madrugada, de('inbound', ROBO, '2026-10-21T03:30:00Z')], oitoDaManha))
confere('equipe escreveu a mesma frase a mao: nao', !precisaDoBomDia([...madrugada, de('outbound', ROBO, '2026-10-21T10:30:00Z', false)], oitoDaManha))
confere('equipe ja respondeu: nao', !precisaDoBomDia([...madrugada, de('outbound', 'Bom dia, como posso ajudar?', '2026-10-21T10:50:00Z', false)], oitoDaManha))
confere('bom dia ja enviado: nao repete', !precisaDoBomDia([...madrugada, de('outbound', BOM_DIA_DA_EQUIPE, '2026-10-21T11:00:05Z')], new Date('2026-10-21T11:15:00Z')))
confere('pedido no horario comercial: nao', !precisaDoBomDia([
  de('inbound', 'Falar com a equipe', '2026-10-20T14:00:00Z'),
  de('outbound', ROBO, '2026-10-20T14:00:05Z'),
], oitoDaManha))
confere('ultima nossa nao e o pedido: nao', !precisaDoBomDia([...madrugada.slice(0, 3), de('outbound', 'Consulta marcada!', '2026-10-21T03:16:00Z')], oitoDaManha))
confere('fora do expediente agora (sabado 8h): nao', !precisaDoBomDia([
  de('inbound', 'Falar com a equipe', '2026-10-24T03:00:00Z'),
  de('outbound', ROBO, '2026-10-24T03:00:05Z'),
], new Date('2026-10-24T11:00:00Z')))
// Sexta 20h ate segunda 8h passa das 24h da Meta: texto livre seria recusado.
confere('janela de 24h fechada (sexta a noite): nao', !precisaDoBomDia([
  de('inbound', 'Falar com a equipe', '2026-10-23T23:00:00Z'),
  de('outbound', ROBO, '2026-10-23T23:00:05Z'),
], new Date('2026-10-26T11:00:00Z')))
confere('feriado (Finados, segunda): nao', !precisaDoBomDia([
  de('inbound', 'Falar com a equipe', '2026-11-02T03:00:00Z'),
  de('outbound', ROBO, '2026-11-02T03:00:05Z'),
], new Date('2026-11-02T11:00:00Z')))
confere('o texto pergunta em que pode ajudar', /^Bom dia!/.test(BOM_DIA_DA_EQUIPE) && BOM_DIA_DA_EQUIPE.includes('em que podemos te ajudar?'))

console.log(`bom dia da equipe: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
