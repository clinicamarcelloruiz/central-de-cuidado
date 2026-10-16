// Atendente com IA (15/10/2026): as regras em volta do Claude, com um Claude
// de mentira. O que se testa aqui nao e o que o modelo diz - e o que o sistema
// faz com o que ele diz: quando ele nem e chamado, o que acontece quando falha,
// que o modo sombra nao mexe em nada, que CPF nao sai para fora.
import {
  atenderComAssistente,
  ficaComORobo,
  lerModo,
  semDadosPessoais,
} from './assistente.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

const situacao = (extra = {}) => ({
  texto: 'Vocês atendem aos sábados?',
  anexo: false,
  etapa: null,
  ultimaDoConsultorio: null,
  historico: [{ de: 'familia', texto: 'Oi, meu CPF é 529.982.247-25 e o e-mail mae@exemplo.com' }],
  criancas: ['Helena'],
  consultas: [],
  conhecimento: '## Livance · Santos\nEndereço: Av. Ana Costa, 228\nValor da consulta: R$ 450,00',
  quemAtende: 'o Dr. Marcello',
  agora: new Date('2026-10-14T13:00:00Z'),
  equipeConversando: false,
  ...extra,
})

/** Claude de mentira: devolve as respostas na ordem e guarda o que recebeu. */
function claudeFalso(respostas) {
  const chamadas = []
  const chamar = async (corpo) => {
    chamadas.push(corpo)
    const r = respostas[Math.min(chamadas.length - 1, respostas.length - 1)]
    if (r instanceof Error) throw r
    return r
  }
  return { chamar, chamadas }
}
const texto = (t) => ({ content: [{ type: 'text', text: t }] })
const usa = (name, input, antes = '') => ({
  content: [...(antes ? [{ type: 'text', text: antes }] : []), { type: 'tool_use', id: `t-${name}`, name, input }],
})

function ferramentasFalsas() {
  const feito = []
  return {
    feito,
    robo: async (t, etapa) => {
      feito.push(['robo', t, etapa])
      if (t === 'nao serve') return { resposta: 'Não entendi. Responda com o número.' }
      return { resposta: `ROBO(${t})`, botoes: [{ id: '1', titulo: 'Um' }] }
    },
    horarios: async (u) => {
      feito.push(['horarios', u])
      return 'Livance · Santos:\nquarta, 21/10: 08:00, 08:40'
    },
    equipe: async (motivo, t) => {
      feito.push(['equipe', motivo])
      return { resposta: t, atencao: motivo }
    },
  }
}
const roboDireto = (r = { resposta: 'ROBO DIRETO' }) => {
  const chamado = { vezes: 0 }
  return { chamado, fn: async () => { chamado.vezes++; return r } }
}

// 1. Desligado: nem chama o Claude.
{
  const c = claudeFalso([texto('oi')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'desligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('desligado: robo responde', d.resultado.resposta === 'ROBO DIRETO' && d.origem === 'robo')
  confere('desligado: Claude nao e chamado', c.chamadas.length === 0)
}
confere('modo desconhecido vale desligado', lerModo('qualquer') === 'desligado' && lerModo(null) === 'desligado' && lerModo('ligado') === 'ligado')

// 2. Ligado sem chave: robo, e grita.
{
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: null, roboDireto: rd.fn })
  confere('sem chave: robo responde', d.resultado.resposta === 'ROBO DIRETO')
  confere('sem chave: evento ia_falhou', d.eventos.some((e) => e.evento === 'ia_falhou'))
}

// 3. Pergunta comum: o Claude responde.
{
  const c = claudeFalso([texto('Atendemos de segunda a sexta. 💙')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('ligado: resposta e do Claude', d.origem === 'ia' && d.resultado.resposta.startsWith('Atendemos'))
  confere('ligado: robo nao roda', rd.chamado.vezes === 0)
  const enviado = JSON.stringify(c.chamadas[0])
  confere('CPF e e-mail nao saem para fora', !enviado.includes('529.982.247-25') && !enviado.includes('mae@exemplo.com') && enviado.includes('[cpf]'))
  confere('conhecimento da clinica vai nas instrucoes', String(c.chamadas[0].system).includes('Av. Ana Costa'))
}

// 4. O que fica com o robo mesmo ligado.
for (const [nome, extra] of [
  ['assunto clinico', { texto: 'meu filho esta com febre e vomitando, o que dou?' }],
  ['urgencia', { texto: 'é urgente' }],
  ['anexo', { anexo: true, texto: '' }],
  ['equipe conversando', { equipeConversando: true }],
  ['resposta automatica de empresa', { texto: 'HDias Climatização e Elétrica agradece seu contato, aguarde so um instante por gentileza.' }],
]) {
  const c = claudeFalso([texto('nao devia')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(extra), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere(`${nome}: fica com o robo`, d.origem === 'robo' && rd.chamado.vezes === 1 && c.chamadas.length === 0, JSON.stringify(ficaComORobo(situacao(extra))))
}

// 5. Abrir fluxo: o robo conduz, o texto do Claude vai antes.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar' }, 'Claro, vamos marcar!')])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar pra semana que vem' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('abrir_fluxo: robo chamado com o pedido de marcar', f.feito.some(([q, t, e]) => q === 'robo' && t === 'quero marcar uma consulta' && e === 'nenhuma'))
  confere('abrir_fluxo: texto do Claude + mensagem do robo com botoes', d.resultado.resposta === 'Claro, vamos marcar!\n\nROBO(quero marcar uma consulta)' && d.resultado.botoes?.length === 1)
}

// 6. Ver horarios e depois responder.
{
  const c = claudeFalso([usa('ver_horarios', { unidade: 'Santos' }), texto('Em Santos temos quarta, 21/10, às 08:00.')])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'pra quando tem em santos?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('ver_horarios: consultou a agenda', f.feito.some(([q, u]) => q === 'horarios' && u === 'Santos'))
  confere('ver_horarios: resultado volta para o Claude', JSON.stringify(c.chamadas[1]?.messages ?? []).includes('08:40'))
  confere('ver_horarios: resposta final do Claude', d.resultado.resposta.startsWith('Em Santos'))
}

// 7. Chamar a equipe.
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', texto: 'Procure o pronto-socorro ou ligue 192. Já avisei a equipe.' })])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ele desmaiou agora' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('chamar_equipe urgencia: motivo urgencia', d.resultado.atencao === 'urgencia' && f.feito.some(([q, m]) => q === 'equipe' && m === 'urgencia'))
  const c2 = claudeFalso([usa('chamar_equipe', { motivo: 'excecao', texto: 'Vou ver com a equipe.' })])
  const d2 = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'tem desconto pra irmãos?' }), ferramentas: ferramentasFalsas(), chamar: c2.chamar, roboDireto: roboDireto().fn })
  confere('chamar_equipe excecao: motivo atendente', d2.resultado.atencao === 'atendente')
}

// 8. Falha: o robo responde, e fica registrado.
{
  const c = claudeFalso([new Error('Anthropic fora do ar')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('falha: robo responde', d.resultado.resposta === 'ROBO DIRETO' && d.origem === 'robo' && rd.chamado.vezes === 1)
  confere('falha: evento ia_falhou', d.eventos.some((e) => e.evento === 'ia_falhou'))
}
{
  const c = claudeFalso([usa('ver_horarios', { unidade: 'Santos' })])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('voltas demais: robo responde', d.origem === 'robo' && c.chamadas.length === 4)
}
{
  const c = claudeFalso([texto('tarde demais')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn, prazoMs: 1000 })
  confere('sem tempo: robo responde sem chamar o Claude', d.origem === 'robo' && c.chamadas.length === 0)
}

// 9. Etapa do robo: o Claude so entra quando o robo nao entendeu.
{
  const c = claudeFalso([texto('nao devia')])
  const rd = roboDireto({ resposta: '⏰ Horários de quarta' })
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ etapa: 'aguardando_dia', texto: '1' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('etapa entendida: fica com o robo', d.resultado.resposta === '⏰ Horários de quarta' && c.chamadas.length === 0)
}
{
  const c = claudeFalso([usa('responder_etapa', { texto: '14:00' })])
  const f = ferramentasFalsas()
  const rd = roboDireto({ resposta: 'Não entendi. Responda com o número do horário.' })
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ etapa: 'aguardando_horario', texto: 'pode ser as duas da tarde' }), ferramentas: f, chamar: c.chamar, roboDireto: rd.fn })
  confere('etapa nao entendida: Claude traduz para o robo', f.feito.some(([q, t, e]) => q === 'robo' && t === '14:00' && e === 'mesma'))
  confere('etapa nao entendida: vale a resposta do robo', d.resultado.resposta === 'ROBO(14:00)' && d.origem === 'ia')
  confere('etapa: ferramenta de etapa oferecida', JSON.stringify(c.chamadas[0].tools).includes('responder_etapa') && !JSON.stringify(c.chamadas[0].tools).includes('abrir_fluxo'))
}

// 10. Sombra: o robo responde, o Claude so escreve a nota, e nada acontece.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar' }, 'Vamos marcar!')])
  const f = ferramentasFalsas()
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'sombra', situacao: situacao({ texto: 'quero marcar' }), ferramentas: f, chamar: c.chamar, roboDireto: rd.fn })
  confere('sombra: a familia recebe o robo', d.resultado.resposta === 'ROBO DIRETO' && d.origem === 'robo')
  confere('sombra: nota com o que o Claude diria', /Claude \(modo sombra\)/.test(d.nota ?? '') && (d.nota ?? '').includes('Vamos marcar!'))
  confere('sombra: robo de verdade nao foi acionado pelo Claude', !f.feito.some(([q]) => q === 'robo' || q === 'equipe'))
}

// 12. Primeiro teste real (15/10/2026): "o doutor pode fazer exame para meu
// filho?" ia para o robo, que respondia "nao posso orientar sobre exames".
{
  const c = claudeFalso([texto('O Dr. Marcello avalia na consulta e pede os exames necessários.')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'o doutor pode fazer exame para meu filho ?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('pergunta sobre exame vai para o Claude', d.origem === 'ia' && rd.chamado.vezes === 0)
}
{
  // Na etapa, o robo devolveu a frase clinica (nao comeca por "Nao entendi"),
  // mas registrou nao_entendi: o Claude assume.
  const c = claudeFalso([texto('O Dr. Marcello pede os exames na consulta. Em qual unidade prefere?')])
  const rd = roboDireto({ resposta: 'Essa é uma avaliação para a consulta... Responda com o número da unidade da lista acima.' })
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ etapa: 'aguardando_unidade', texto: 'o doutor pode fazer exame para meu filho ?' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn, roboNaoEntendeuAgora: () => true,
  })
  confere('etapa: frase clinica do robo com nao_entendi registrado vai para o Claude', d.origem === 'ia' && c.chamadas.length === 1)
}

// 11. Mascara.
confere('mascara telefone', semDadosPessoais('me liga no (13) 99706-6339') === 'me liga no [telefone]')

console.log(`assistente: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
