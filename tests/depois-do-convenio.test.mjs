// "Sobre o Dr. Marcello" 30 min depois de quem perguntou convenio ou preco e
// sumiu (23/10/2026). Dados inventados: o repositorio e publico.
import { perguntouConvenioOuPreco, precisaDoSobre, marcaDoTexto, SILENCIO_MS } from './depois-do-convenio.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

// Horas no relogio de Sao Paulo (UTC-3).
const sp = (dia, hora, minuto = 0) => new Date(Date.UTC(2026, 9, dia, hora + 3, minuto))
const msg = (direction, body, quando, automatic = direction === 'outbound') => ({
  direction, body, automatic, created_at: quando.toISOString(),
})

// --- A pergunta ---
for (const t of ['Atende convênio?', 'vcs aceitam unimed', 'Qual o valor da consulta?', 'quanto custa', 'é particular?', 'tem reembolso pelo plano de saúde?', 'Quanto é a consulta com o Dr?', 'PREÇO']) {
  confere(`pergunta reconhecida: "${t}"`, perguntouConvenioOuPreco(t))
}
for (const t of ['quero marcar', 'sexta, 30/10', 'meu filho tem refluxo', 'qual o plano de tratamento?', null]) {
  confere(`nao e pergunta de preco: "${t}"`, !perguntouConvenioOuPreco(t))
}

// --- Quando mandar ---
// Real 23/10 (Claudete): perguntou do convenio, o robo respondeu e perguntou a
// unidade, e ela nao escreveu mais.
const claudete = [
  msg('inbound', 'Oi, atende convênio?', sp(23, 9, 57)),
  msg('outbound', 'Não atendemos convênio... Em qual unidade você prefere ser atendido?', sp(23, 9, 58)),
]
confere('claudete: 30 min depois da resposta, manda', precisaDoSobre(claudete, sp(23, 10, 29), false))
confere('claudete: 29 min depois, ainda espera', !precisaDoSobre(claudete, sp(23, 10, 27), false))
confere('ja recebeu antes: nao repete', !precisaDoSobre(claudete, sp(23, 11, 0), true))

const respondeuDepois = [...claudete, msg('inbound', 'Santos', sp(23, 10, 5))]
confere('a familia respondeu depois: nao manda', !precisaDoSobre(respondeuDepois, sp(23, 11, 0), false))

const equipeEntrou = [...claudete, msg('outbound', 'Oi Claudete, posso ajudar?', sp(23, 10, 2), false)]
confere('a equipe escreveu depois: nao manda', !precisaDoSobre(equipeEntrou, sp(23, 11, 0), false))

// A equipe escreveu no meio e o robo respondeu depois: a conversa e da equipe.
const equipeNoMeio = [
  ...claudete,
  msg('outbound', 'Oi Claudete, posso ajudar?', sp(23, 10, 2), false),
  msg('outbound', 'Digite 0 para voltar ao início.', sp(23, 10, 3)),
]
confere('a equipe escreveu no meio, robo por ultimo: nao manda', !precisaDoSobre(equipeNoMeio, sp(23, 11, 0), false))
const semMarca = [...claudete.slice(0, 1), { ...claudete[1], automatic: null }]
confere('resposta sem marca de automatica: nao manda', !precisaDoSobre(semMarca, sp(23, 11, 0), false))

const outraPergunta = [
  msg('inbound', 'quero marcar', sp(23, 9, 0)),
  msg('outbound', 'Em qual unidade?', sp(23, 9, 1)),
]
confere('silencio depois de outra pergunta: nao manda', !precisaDoSobre(outraPergunta, sp(23, 11, 0), false))

// IA respondendo em mais de uma mensagem: vale a ultima nossa.
const duasRespostas = [
  msg('inbound', 'qual o valor?', sp(23, 14, 0)),
  msg('outbound', 'A consulta em Santos é...', sp(23, 14, 1)),
  msg('outbound', 'Quer ver os horários?', sp(23, 14, 20)),
]
confere('conta 30 min da ULTIMA resposta nossa', !precisaDoSobre(duasRespostas, sp(23, 14, 45), false) && precisaDoSobre(duasRespostas, sp(23, 14, 51), false))

// Madrugada: perguntou 21h50, vence 22h21, sai as 8h do dia seguinte.
const noite = [
  msg('inbound', 'aceita amil?', sp(23, 21, 50)),
  msg('outbound', 'Não atendemos convênio...', sp(23, 21, 51)),
]
confere('22h em diante: segura', !precisaDoSobre(noite, sp(23, 22, 30), false))
confere('7h59: ainda segura', !precisaDoSobre(noite, sp(24, 7, 59), false))
confere('8h do dia seguinte: manda', precisaDoSobre(noite, sp(24, 8, 0), false))

// Janela da Meta: 23h depois da pergunta, nao manda mais.
const velha = [
  msg('inbound', 'quanto custa', sp(23, 8, 30)),
  msg('outbound', 'A consulta é particular...', sp(23, 8, 31)),
]
confere('janela de 24h fechando: nao manda', !precisaDoSobre(velha, sp(24, 8, 0), false))
confere('ainda dentro da janela: manda', precisaDoSobre(velha, sp(23, 21, 0), false))

confere('conversa vazia nao quebra', !precisaDoSobre([], sp(23, 12, 0), false))
confere('so a familia escreveu: nao manda', !precisaDoSobre([msg('inbound', 'valor?', sp(23, 9, 0))], sp(23, 12, 0), false))
confere('silencio de 30 min', SILENCIO_MS === 30 * 60 * 1000)
confere('marca do texto: 60 primeiros caracteres', marcaDoTexto('  ' + 'x'.repeat(100)).length === 60)

console.log(`depois do convenio: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
