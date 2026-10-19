// Atendente com IA (15/10/2026): as regras em volta do Claude, com um Claude
// de mentira. O que se testa aqui nao e o que o modelo diz - e o que o sistema
// faz com o que ele diz: quando ele nem e chamado, o que acontece quando falha,
// que o modo sombra nao mexe em nada, que CPF nao sai para fora.
import {
  atenderComAssistente,
  falaComAEquipe,
  orientouConduta,
  semRepetir,
  ficaComORobo,
  lerModo,
  limparTexto,
  menuEscritoAMao,
  semDadosPessoais,
  semNarracao,
  montarSituacao,
  perguntaLateral,
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
// As instrucoes vao em blocos desde 17/10/2026 (cache): o texto e a soma deles.
const textoDoSistema = (chamada) => (Array.isArray(chamada?.system) ? chamada.system.map((b) => b.text).join('\n') : String(chamada?.system ?? ''))
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
  confere('conhecimento da clinica vai nas instrucoes', textoDoSistema(c.chamadas[0]).includes('Av. Ana Costa'))
}

// 4. O que fica com o robo mesmo ligado.
for (const [nome, extra] of [
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
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', para_familia: 'Claro, vamos marcar!' }, 'A família quer marcar, então abro o agendamento.')])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar pra semana que vem' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('abrir_fluxo: robo chamado com o pedido de marcar', f.feito.some(([q, t, e]) => q === 'robo' && t === 'quero marcar uma consulta' && e === 'nenhuma'))
  // O texto solto (rascunho da IA) nao vai; o para_familia vai (rodada 2 do painel).
  confere('abrir_fluxo: para_familia + mensagem do robo com botoes, sem o rascunho', d.resultado.resposta === 'Claro, vamos marcar!\n\nROBO(quero marcar uma consulta)' && d.resultado.botoes?.length === 1)
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
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ele está pálido e gelado agora' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
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
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', para_familia: 'Vamos marcar!' })])
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

// 13. Segundo teste real (15/10/2026, "ta zoado ainda"): para "ola" o Claude
// escreveu um menu numerado sem botoes e mandou ligar 192; para "o doutor pode
// fazer exame?" repetiu a pergunta e terminou no pronto-socorro.
{
  const menuDoClaude =
    'Olá! 👋 Sou o assistente virtual do consultório. Responda com um número:\n1 Dúvidas\n2 Marcar consulta\n3 Falar com a equipe\n4 Minha consulta\n5 2ª via\nSe a criança estiver mal agora, procure o pronto-socorro mais próximo ou ligue 192.'
  const c = claudeFalso([texto(menuDoClaude)])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'olá' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('menu escrito a mao: vale o menu do sistema, com botoes', d.resultado.resposta === 'ROBO(menu)' && d.resultado.botoes?.length === 1, d.resultado.resposta)
  confere('menu escrito a mao: detectado', menuEscritoAMao(menuDoClaude) && !menuEscritoAMao('Atendemos em Santos e em São Paulo.'))
}
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu' }, 'Olá! Sou o assistente virtual do consultório.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'bom dia' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('abrir_fluxo menu: sem cumprimento dobrado', d.resultado.resposta === 'ROBO(menu)', d.resultado.resposta)
}
{
  const c = claudeFalso([
    texto(
      'Oi! Você perguntou se o Dr. Marcello pode pedir exame para seu filho. Pode sim! Na consulta o Dr. Marcello avalia e solicita os exames. Se a criança estiver mal agora, procure o pronto-socorro mais próximo ou ligue 192.',
    ),
  ])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'o doutor pode fazer exame para meu filho ?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('sem repetir a pergunta', d.resultado.resposta.startsWith('Pode sim!'), d.resultado.resposta)
  confere('sem pronto-socorro em duvida comum', !/pronto-socorro|192/.test(d.resultado.resposta), d.resultado.resposta)
  confere('frase com "Dr." fica inteira', d.resultado.resposta.includes('Na consulta o Dr. Marcello avalia e solicita os exames.'), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'medico', texto: 'A equipe responde por aqui. Se a criança estiver mal agora, ligue 192.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero tirar uma dúvida com o doutor' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('equipe por conduta medica: sem 192', d.resultado.resposta === 'A equipe responde por aqui.', d.resultado.resposta)
}
// 17/10/2026: "**São Paulo (Livance Ibirapuera)**" chegou com asterisco sobrando.
confere('negrito de site vira negrito do WhatsApp', limparTexto('Atende sim, em **São Paulo (Livance Ibirapuera)**. Quer marcar?', false) === 'Atende sim, em *São Paulo (Livance Ibirapuera)*. Quer marcar?', limparTexto('Atende sim, em **São Paulo (Livance Ibirapuera)**. Quer marcar?', false))
confere('negrito do WhatsApp fica', limparTexto('Pode usar *negrito* assim.', false) === 'Pode usar *negrito* assim.')
confere('urgencia: pronto-socorro fica', limparTexto('Procure o pronto-socorro agora. Já avisei a equipe.', true) === 'Procure o pronto-socorro agora. Já avisei a equipe.')
{
  const c = claudeFalso([texto('Que bom que vieram! Se ele piorar de novo, volte ao pronto-socorro. Quer que eu veja um horário?')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'o pronto-socorro mandou procurar um gastro, quando tem vaga?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('familia falou do pronto-socorro: a frase fica', d.resultado.resposta.includes('pronto-socorro'), d.resultado.resposta)
}
{
  const c = claudeFalso([texto('ok')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  const sistema = textoDoSistema(c.chamadas[0])
  confere('instrucao: nao repetir a pergunta', sistema.includes('Nunca repita nem resuma a pergunta'))
  confere('instrucao: sem menu numerado', sistema.includes('Nunca escreva menu numerado'))
  confere('instrucao: sintoma nao e pedido de conduta', sistema.includes('Falar de sintoma não é pedir conduta'))
  confere('instrucao: interpretar e juntar', sistema.includes('Interprete') && sistema.includes('Junte as informações'))
  confere('instrucao: ignorar "digite 9" das respostas oficiais', sistema.includes('ignore instruções como "digite 9"'))
  // 16/10/2026: "aceita cartao? parcela?" virou "vou confirmar com a equipe" com o pagamento escrito ali.
  // 16/10/2026: "nao precisa falar que nao parcelamos, somente se perguntar".
  confere('instrucao: so o que foi perguntado', sistema.includes('Regra ou restrição que a família não perguntou'))
  confere('instrucao: responder com a informacao mais proxima', sistema.includes('"aceita cartão?" se responde com como é o pagamento'))
}

// 14. Sintoma vai para o Claude (16/10/2026): "minha filha tem refluxo, ele
// trata?" recebia do robo "nao posso orientar" e um menu. O Claude responde o
// que e do servico; conduta continua da equipe, com trava no codigo.
{
  const c = claudeFalso([texto('Trata sim! Refluxo é uma das condições que o Dr. Marcello mais acompanha. Quer que eu veja um horário?')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'minha filha tem refluxo e vomita muito, ele trata?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('sintoma com pergunta de servico: responde o Claude', d.origem === 'ia' && rd.chamado.vezes === 0 && d.resultado.resposta.startsWith('Trata sim'))
  confere('sintoma: aviso no contexto', JSON.stringify(c.chamadas[0]?.messages ?? []).includes('fala de sintoma ou remédio'))
}
{
  const c = claudeFalso([texto('Pode dar dipirona 10 gotas de 6 em 6 horas e observar.')])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ele está com febre, posso dar remédio?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('trava de conduta: vai para a equipe', f.feito.some(([q]) => q === 'equipe') && d.resultado.atencao === 'atendente')
  confere('trava de conduta: nada de remedio na resposta', !/dipirona|gotas/i.test(d.resultado.resposta) && d.resultado.resposta.includes('quem orienta é o Dr. Marcello'), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'medico', texto: 'Dê paracetamol enquanto a equipe não responde.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ele está com febre alta, o que faço?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('trava de conduta tambem no texto da equipe', !/paracetamol/i.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // 22h30 em Sao Paulo: sintoma com o consultorio fechado mantem o pronto-socorro.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'medico', texto: 'A equipe responde amanhã cedo. Se ele piorar, procure o pronto-socorro.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ele está com dor de barriga, o que faço?', agora: new Date('2026-10-15T01:30:00Z') }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('sintoma de noite: pronto-socorro fica', d.resultado.resposta.includes('pronto-socorro'), d.resultado.resposta)
}
confere('conduta: detecta dose e remedio', orientouConduta('10 gotas') && orientouConduta('pode dar') && orientouConduta('de 8 em 8 horas') && orientouConduta('use simeticona'))
confere('conduta: nao pega frase de servico', !orientouConduta('Você pode usar o convênio para os exames. Quer que eu veja um horário?') && !orientouConduta('A consulta dura de 40 minutos a 1 hora.'))

// 15. Despedida no meio do agendamento (16/10/2026, teste do Edu as 00:52):
// "vou pensar" ja tinha recebido o lembrete das unidades, e o "boa noite"
// seguinte recebeu o mesmo lembrete de novo.
{
  const lembrete = 'Tudo bem, pode pensar com calma! Quando decidir, é só me dizer se prefere *Santos*, *São Paulo* ou *telemedicina* que eu sigo com o agendamento.'
  const c = claudeFalso([texto('Boa noite! Quando decidir, é só me dizer se prefere *Santos*, *São Paulo* ou *telemedicina* que eu sigo com o agendamento.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({
      etapa: 'aguardando_unidade', texto: 'boa noite', ultimaDoConsultorio: lembrete,
      historico: [{ de: 'familia', texto: 'vou pensar' }, { de: 'consultorio', texto: lembrete }],
    }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar,
    roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número da unidade.' }).fn,
  })
  confere('despedida: sem repetir o lembrete', d.resultado.resposta === 'Boa noite!', d.resultado.resposta)
  confere('instrucao: despedida curta', textoDoSistema(c.chamadas[0]).includes('Se ela se despediu ou disse que vai pensar, só se despeça.'))
}
// O lembrete que traduz a lista do robo em palavras NAO e repeticao (foi o
// "parcela amigao?" do mesmo teste, e estava certo).
confere(
  'lembrete com outras palavras fica',
  semRepetir('Não parcelamos. Para seguir, qual unidade você prefere: Santos, São Paulo ou telemedicina?', '📍 Vamos agendar! Em qual unidade você prefere ser atendido?\n\n1 Livance · Santos\n2 Livance Ibirapuera - São Paulo\n3 Telemedicina (por vídeo)\n\nResponda com o número.')
    .includes('qual unidade você prefere'),
)
confere('so frase repetida: devolve o texto inteiro', semRepetir('Quando decidir, é só me dizer a unidade que eu sigo.', 'Quando decidir, é só me dizer a unidade que eu sigo.') === 'Quando decidir, é só me dizer a unidade que eu sigo.')

// 16. Recado para a equipe saindo para a familia (16/10/2026, mae do Leon,
// 08:50): "A familia do Leon (...) pergunta se e possivel pagar presencialmente
// no dia da consulta. Nao temos essa informacao aqui. Por favor, confirmem e
// respondam por aqui." saiu do consultorio para ela.
{
  const recado = 'A família do Leon (consulta sexta, 16/10, às 10:00, em Santos) pergunta se é possível pagar presencialmente no dia da consulta. Não temos essa informação aqui. Por favor, confirmem e respondam por aqui.'
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'sem_informacao', texto: recado })])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'posso pagar no dia da consulta?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('recado da equipe nao vai para a familia', !d.resultado.resposta.includes('A família do Leon') && d.resultado.resposta === 'Vou confirmar isso com a equipe e te respondemos por aqui.', d.resultado.resposta)
  confere('recado vira nota interna', (d.nota ?? '').includes('A família do Leon') && (d.nota ?? '').startsWith('🤖'), d.nota)
  confere('recado: a equipe e chamada', f.feito.some(([q]) => q === 'equipe'))
}
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'excecao', para_familia: 'Vou ver com a equipe e te respondo por aqui.', resumo_para_equipe: 'Mãe pede desconto para dois irmãos.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'tem desconto pra irmãos?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('dois campos: familia le o para_familia', d.resultado.resposta === 'Vou ver com a equipe e te respondo por aqui.', d.resultado.resposta)
  confere('dois campos: resumo vira nota', d.nota === '🤖 Resumo da IA para a equipe: Mãe pede desconto para dois irmãos.', d.nota)
  const ferramenta = c.chamadas[0].tools.find((t) => t.name === 'chamar_equipe')
  confere('ferramenta pede os dois campos', ferramenta.input_schema.required.includes('para_familia') && ferramenta.input_schema.required.includes('resumo_para_equipe'))
}
confere('fala com a equipe: detecta', falaComAEquipe('A família do Leon pergunta se pode pagar.') && falaComAEquipe('Por favor, confirmem.') && falaComAEquipe('A mãe pergunta se tem vaga.'))
confere('fala com a familia: nao detecta', !falaComAEquipe('Vou confirmar com a equipe e te respondemos por aqui.') && !falaComAEquipe('Atendemos toda a família, de recém-nascidos até 19 anos.'))

// 17. Sonnet, cache, sinais de alarme e o jeito de levar para a consulta
// (17/10/2026, pedido do Edu junto com o alerta no WhatsApp do medico).
{
  const c = claudeFalso([texto('ok')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('modelo padrao: Sonnet', c.chamadas[0].model === 'claude-sonnet-5-5', c.chamadas[0].model)
  const [fixo] = c.chamadas[0].system
  confere('cache: texto fixo marcado', fixo?.cache_control?.type === 'ephemeral' && fixo.text.includes('<clinica>'))
  const sistema = textoDoSistema(c.chamadas[0])
  confere('instrucao: acolher sem pressionar', sistema.includes('Nunca assuste, nunca prometa resultado e nunca pressione'))
  confere('instrucao: oferecer horarios concretos', sistema.includes('próximos dois ou três horários'))
  confere('instrucao: sinais de alarme na urgencia', sistema.includes('engoliu pilha') && sistema.includes('febre em bebê com menos de 3 meses'))
}
{
  // O prefixo em cache tem de ser igual com e sem etapa: um caractere diferente
  // perde o cache inteiro. O passo em aberto vai num bloco a parte.
  const sem = claudeFalso([texto('ok')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: sem.chamar, roboDireto: roboDireto().fn })
  const com = claudeFalso([texto('ok')])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ etapa: 'aguardando_unidade', texto: 'tanto faz', ultimaDoConsultorio: 'Em qual unidade?' }),
    ferramentas: ferramentasFalsas(), chamar: com.chamar, roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número.' }).fn,
  })
  confere('cache: mesmo prefixo com e sem etapa', sem.chamadas[0].system[0].text === com.chamadas[0].system[0].text)
  confere('cache: etapa em bloco sem cache', com.chamadas[0].system.length === 2 && !com.chamadas[0].system[1].cache_control && com.chamadas[0].system[1].text.includes('aguardando_unidade'))
}
for (const frase of ['ele engoliu uma pilha', 'ela está vomitando sangue', 'meu filho está muito molinho e não faz xixi desde ontem']) {
  const c = claudeFalso([texto('nao devia')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: frase }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere(`sinal de alarme fica com o robo: ${frase}`, d.origem === 'robo' && c.chamadas.length === 0 && ficaComORobo(situacao({ texto: frase })) === 'urgencia')
}
confere('coco molinho nao e alarme', ficaComORobo(situacao({ texto: 'o cocô dela está molinho, é normal?' })) === null)
{
  // A IA chamou urgencia e esqueceu o pronto-socorro: a frase entra assim mesmo.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Já avisei a equipe, que responde por aqui.', resumo_para_equipe: 'Criança pálida e gelada.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ele está pálido e gelado agora' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('urgencia da IA sem pronto-socorro: a frase entra', /pronto-socorro/.test(d.resultado.resposta) && /192/.test(d.resultado.resposta) && d.resultado.atencao === 'urgencia', d.resultado.resposta)
  confere('urgencia da IA: o texto dela continua', d.resultado.resposta.includes('Já avisei a equipe'), d.resultado.resposta)
  // Rodape, nao manchete: na urgencia comum quem resolve e a consulta.
  confere('urgencia da IA: pronto-socorro no fim, com risco de vida', d.resultado.resposta.startsWith('Já avisei') && d.resultado.resposta.endsWith('risco de vida, procure o pronto-socorro mais próximo ou ligue 192.'), d.resultado.resposta)
}

// 19. Pergunta repetida (17/10/2026, teste do Edu as 18:40): a segunda resposta
// perdeu "Atende sim, aos sabados em Sao Paulo" para o corte de repeticao.
{
  const anterior = 'Atende sim, aos sábados em *São Paulo (Livance Ibirapuera)*. Os próximos são 24/10, às 14:30, 15:10 e 15:50. Quer que eu siga com o agendamento num desses horários?'
  const c = claudeFalso([texto('Atende sim, aos sábados em *São Paulo (Livance Ibirapuera)*. Os próximos são 24/10, às 14:30, 15:10 e 15:50. Quer que eu abra o agendamento para sábado, 24/10?')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'oi, o dr atende ao sabado ?', historico: [{ de: 'familia', texto: 'Vocês atendem aos sábados?' }, { de: 'consultorio', texto: anterior }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('pergunta repetida: a resposta direta fica', d.resultado.resposta.startsWith('Atende sim, aos sábados em *São Paulo'), d.resultado.resposta)
}

// 18. Agendamento ja na unidade e no dia combinados (17/10/2026, teste do Edu:
// o "sim" depois de "Atende sim, aos sabados em Sao Paulo" recomecava em "Em
// qual unidade?"). Robo de mentira com etapa, como o de verdade.
function roboComEtapas({ inicio = 'aguardando_unidade', entendeUnidade = true, semEtapa = false } = {}) {
  const chamadas = []
  let etapa = null
  const f = {
    chamadas,
    robo: async (t, modo) => {
      chamadas.push([t, modo])
      if (t === 'quero marcar uma consulta') {
        etapa = inicio
        return inicio === 'ja_tem_consulta'
          ? { resposta: 'Você já tem uma consulta marcada. O que você prefere?' }
          : { resposta: '📍 Em qual unidade?', lista: { rotulo: 'Unidades', linhas: [] } }
      }
      if (etapa === 'aguardando_unidade' && modo === 'atual') {
        if (!entendeUnidade) return { resposta: 'Não entendi qual unidade.' }
        etapa = 'aguardando_dia'
        return { resposta: `📅 Datas disponíveis em ${t}`, lista: { rotulo: 'Datas', linhas: [] } }
      }
      if (etapa === 'aguardando_dia' && modo === 'atual') {
        etapa = 'aguardando_horario'
        return { resposta: `⏰ Horários de ${t}`, lista: { rotulo: 'Horários', linhas: [] } }
      }
      return { resposta: `ROBO(${t})` }
    },
    horarios: async () => '',
    equipe: async (motivo, t) => ({ resposta: t, atencao: motivo }),
  }
  if (!semEtapa) f.etapa = async () => etapa
  return f
}
const aceitou = () => situacao({ texto: 'sim, pode ser', historico: [{ de: 'consultorio', texto: 'Atende sim, aos sábados em São Paulo. Quer que eu siga com o agendamento?' }] })
{
  const f = roboComEtapas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', dia: 'sábado', para_familia: 'Ótimo!' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('agendar com unidade e dia: abre nos horarios do dia', d.resultado.resposta === 'Ótimo!\n\n⏰ Horários de sábado', d.resultado.resposta)
  confere('agendar com unidade e dia: unidade e dia vao ao robo como digitados', JSON.stringify(f.chamadas) === JSON.stringify([['quero marcar uma consulta', 'nenhuma'], ['São Paulo', 'atual'], ['sábado', 'atual']]), JSON.stringify(f.chamadas))
}
{
  const f = roboComEtapas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('agendar so com unidade: abre nas datas dela', d.resultado.resposta === '📅 Datas disponíveis em São Paulo', d.resultado.resposta)
}
{
  const f = roboComEtapas({ entendeUnidade: false })
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Marte', dia: 'sábado' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('unidade que o robo nao entende: fica a pergunta da unidade', d.resultado.resposta === '📍 Em qual unidade?' && f.chamadas.length === 2, d.resultado.resposta)
}
{
  const f = roboComEtapas({ inicio: 'ja_tem_consulta' })
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', dia: 'sábado' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('ja tem consulta: o robo pergunta antes, sem atalho', d.resultado.resposta.startsWith('Você já tem uma consulta') && f.chamadas.length === 1, JSON.stringify(f.chamadas))
}
{
  const f = roboComEtapas({ semEtapa: true })
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo' })])
  await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('sem etapa (Instagram): so abre o fluxo', f.chamadas.length === 1)
}
{
  const c = claudeFalso([texto('ok')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  const fluxo = c.chamadas[0].tools.find((t) => t.name === 'abrir_fluxo')
  confere('abrir_fluxo aceita unidade e dia', Boolean(fluxo?.input_schema?.properties?.unidade && fluxo.input_schema.properties.dia))
  confere('instrucao: aceitou, abre na hora', textoDoSistema(c.chamadas[0]).includes('sem perguntar de novo o que ela já disse'))
}

// 11. Mascara.
confere('mascara telefone', semDadosPessoais('me liga no (13) 99706-6339') === 'me liga no [telefone]')

// 19. Painel com IA (17/10/2026).
// Resposta so com pensamento: o Sonnet devolveu um bloco de pensamento vazio e
// a mae ficou sem resposta. Agora o pedido nao pensa antes, e o vazio tenta
// de novo antes de cair no robo.
{
  const pensou = { content: [{ type: 'thinking', thinking: '', signature: 'x' }] }
  const c = claudeFalso([pensou, texto('Atende sim, aos sábados em São Paulo.')])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('resposta vazia: tenta de novo e responde', d.origem === 'ia' && d.resultado.resposta.startsWith('Atende sim') && c.chamadas.length === 2, JSON.stringify(d))
  confere('pedido sem pensar antes', c.chamadas[0]?.thinking?.type === 'between_tools', JSON.stringify(c.chamadas[0]?.thinking))
  confere('pedido com folga de tokens', c.chamadas[0]?.max_tokens >= 1500, String(c.chamadas[0]?.max_tokens))
}
{
  const pensou = { content: [{ type: 'thinking', thinking: '', signature: 'x' }] }
  const c = claudeFalso([pensou, pensou])
  const rd = roboDireto()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: rd.fn })
  confere('vazia duas vezes: o robo responde e grita', d.origem === 'robo' && rd.chamado.vezes === 1 && d.eventos.some((e) => e.evento === 'ia_falhou'))
}
{
  // Na fila da equipe o robo fica calado; se a IA falha ali, a familia nao
  // pode ficar sem nada.
  const c = claudeFalso([new Error('prazo esgotado')])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'mas eu ja marquei as 15h hj, ta confirmado ne?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto(null).fn })
  confere('IA falhou e robo calado: a familia ouve que a equipe viu', d.resultado?.resposta?.includes('passei para a equipe') && d.eventos.some((e) => e.evento === 'ia_falhou_sem_robo'), JSON.stringify(d))
}

// A recusa nao e conduta; a conduta dentro da recusa continua sendo.
confere('recusa citando o remedio nao e conduta', !orientouConduta('Entendo a preocupação. Sobre o paracetamol, quem orienta é o Dr. Marcello: já avisei ele.'))
confere('"nao posso indicar a dose" nao e conduta', !orientouConduta('Não posso indicar a dose do Buscopan por aqui.'))
confere('"costuma ajudar" com recusa continua conduta', orientouConduta('Dipirona costuma ajudar, mas quem orienta é o médico.'))
confere('"pode dar" com recusa continua conduta', orientouConduta('Pode dar paracetamol, mas quem orienta a dose é o Dr. Marcello.'))
{
  // Febre num bebe de 7 semanas: a IA chamou a urgencia e recusou o remedio.
  // A trava nao pode tirar a urgencia (o alerta ao medico depende dela).
  const c = claudeFalso([usa('chamar_equipe', {
    motivo: 'urgencia',
    para_familia: 'Entendo a preocupação: febre com 7 semanas precisa ser vista logo. Já avisei o Dr. Marcello. Sobre o paracetamol, quem orienta é ele.',
    resumo_para_equipe: 'Bebê de 7 semanas com 38,5; mãe pergunta de paracetamol.',
  })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'posso dar paracetamol pro meu nenem? ele tem 7 semana e ta com 38,5 desde cedo' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('recusa na urgencia: continua urgencia', d.resultado.atencao === 'urgencia' && d.eventos.some((e) => e.detalhe === 'equipe:urgencia'), JSON.stringify(d.eventos))
  confere('recusa na urgencia: texto da IA vai', d.resultado.resposta.includes('febre com 7 semanas'), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Pode dar paracetamol 5 gotas. Já avisei o Dr. Marcello.', resumo_para_equipe: 'Febre alta.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ele está com febre de 40, posso dar remédio?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('trava na urgencia: continua urgencia', d.resultado.atencao === 'urgencia', JSON.stringify(d.resultado))
  confere('trava na urgencia: sem remedio e com o horario mais proximo', !/paracetamol|gotas/i.test(d.resultado.resposta) && d.resultado.botoes?.some((b) => b.id === 'MARCAR_AGORA'), d.resultado.resposta)
  confere('trava: a nota conta o que a IA escreveu', d.nota?.includes('O que a IA tinha escrito') && d.nota.includes('Febre alta'), d.nota)
}
{
  const c = claudeFalso([texto('Dê 10 gotas de Buscopan.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'mas quantas gotas de buscopan eu dou?', ultimaDoConsultorio: 'Sobre o que fazer agora, quem orienta é o Dr. Marcello: já passei para a equipe, que responde por aqui.' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('trava repetida: nao manda a mesma frase', d.resultado.resposta.startsWith('Como falei') && !/gotas de|buscopan/i.test(d.resultado.resposta), d.resultado.resposta)
}

// Duvida no meio do cadastro: a equipe fica sabendo e o passo continua.
function ferramentasQueGuardam() {
  const pedidos = []
  return {
    pedidos,
    robo: async (t) => ({ resposta: `ROBO(${t})` }),
    horarios: async () => '',
    equipe: async (motivo, t, o) => {
      pedidos.push({ motivo, o })
      return { resposta: t, atencao: motivo }
    },
  }
}
{
  const f = ferramentasQueGuardam()
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'medico', para_familia: 'Sobre a dieta, quem orienta é o Dr. Marcello: já passei para a equipe.', resumo_para_equipe: 'Mãe pergunta se corta o leite.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'pera, e enquanto isso eu corto leite da minha dieta?', etapa: 'dados_nome', ultimaDoConsultorio: '👶 Qual é o *nome completo do paciente*?' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta. 👶 Qual é o *nome completo do paciente*?' }).fn,
  })
  confere('duvida no cadastro: passo mantido', f.pedidos[0]?.o?.manterEtapa === true, JSON.stringify(f.pedidos))
  confere('duvida no cadastro: lembra o passo', d.resultado.resposta.includes('Para continuar de onde paramos'), d.resultado.resposta)
}
{
  const f = ferramentasQueGuardam()
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Já avisei o Dr. Marcello.', resumo_para_equipe: 'Piorou.' })])
  await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'ele piorou muito agora', etapa: 'aguardando_horario' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  // No agendamento, a urgencia sai do fluxo; so a ficha do paciente fica aberta.
  confere('urgencia na lista de horarios: sai do passo', f.pedidos[0]?.o?.manterEtapa === false, JSON.stringify(f.pedidos))
}

// Crianca e horario ja ditos seguem direto; remarcar e cancelar so confirmam.
function roboDoAgendamento() {
  const chamadas = []
  let etapa = null
  const seguinte = { aguardando_paciente: 'aguardando_unidade', aguardando_unidade: 'aguardando_dia', aguardando_dia: 'aguardando_horario', aguardando_horario: 'dados_nome', minha_consulta: 'confirmar_cancelamento', confirmar_cancelamento: 'aguardando_dia' }
  return {
    chamadas,
    robo: async (t, modo) => {
      chamadas.push([t, modo])
      if (t === 'quero marcar uma consulta') { etapa = 'aguardando_paciente'; return { resposta: 'Para quem é a consulta?' } }
      if (t === '4') { etapa = 'minha_consulta'; return { resposta: 'Sua consulta: qua, 21/10. Digite CANCELAR ou REMARCAR.' } }
      // Com as datas na tela, o nome de outra unidade troca de unidade (como o robo).
      if (etapa === 'aguardando_dia' && modo === 'atual' && /paulo|santos/i.test(t)) return { resposta: `Datas em ${t}` }
      if (modo === 'atual' && seguinte[etapa]) { etapa = seguinte[etapa]; return { resposta: `${etapa}(${t})` } }
      if (modo === 'mesma') { etapa = 'aguardando_dia'; return { resposta: `Datas em ${t}` } }
      return { resposta: `ROBO(${t})` }
    },
    horarios: async () => '',
    equipe: async (motivo, t) => ({ resposta: t, atencao: motivo }),
    etapa: async () => etapa,
  }
}
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo', unidade: 'Santos', dia: 'sexta', horario: '09:20' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'pode ser sexta as 9:20 em santos pro theo', criancas: ['Helena', 'Theo'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('agendar com crianca, unidade, dia e horario: guarda direto', d.resultado.resposta === 'dados_nome(09:20)', d.resultado.resposta)
  confere('agendar: cada parte no seu passo', JSON.stringify(f.chamadas.slice(1)) === JSON.stringify([['Theo', 'atual'], ['Santos', 'atual'], ['sexta', 'atual'], ['09:20', 'atual']]), JSON.stringify(f.chamadas))
}
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'cancelar' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'pode cancelar a consulta da helena, ela melhorou', consultas: ['qua, 21/10 08:00 · Livance · Santos'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('cancelar: vai direto a confirmacao', d.resultado.resposta === 'confirmar_cancelamento(cancelar)', d.resultado.resposta)
}
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'cancelar' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'pode cancelar a consulta', consultas: ['qua, 21/10 08:00 · Santos', 'sex, 23/10 09:00 · Santos'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('cancelar com duas consultas: ela escolhe qual', d.resultado.resposta.startsWith('Sua consulta'), d.resultado.resposta)
}
{
  // Rodada 2: "da pra passar a consulta da helena pra sexta?" ainda pedia SIM,
  // unidade e dia. Remarcar nao cancela nada antes da nova, entao o SIM vai junto.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'remarcar', dia: 'sexta' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'da pra passar a consulta da helena pra sexta?', consultas: ['qua, 21/10 08:00 · Livance · Santos'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('remarcar com dia: direto nos horarios do dia', d.resultado.resposta === 'aguardando_horario(sexta)', d.resultado.resposta)
  confere('remarcar: o SIM vai junto', JSON.stringify(f.chamadas.map((x) => x[0])) === JSON.stringify(['4', 'remarcar', 'sim', 'sexta']), JSON.stringify(f.chamadas))
}
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'remarcar', unidade: 'São Paulo', dia: 'segunda' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero passar a consulta pra segunda em sp', consultas: ['qua, 21/10 08:00 · Livance · Santos'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('remarcar para outra unidade: a unidade vai antes do dia', JSON.stringify(f.chamadas.map((x) => x[0]).slice(3)) === JSON.stringify(['São Paulo', 'segunda']) && d.resultado.resposta === 'aguardando_horario(segunda)', JSON.stringify(f.chamadas) + d.resultado.resposta)
}
{
  // Traducao que o robo nao entendeu: sai o para_familia, nunca o rascunho.
  const c = claudeFalso([usa('responder_etapa', { texto: 'nao serve', para_familia: 'Qual desses horários fica melhor para vocês?' }, 'Não dá para adivinhar qual dos seis, então preciso perguntar.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'sim', etapa: 'aguardando_horario' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número do horário.' }).fn,
  })
  confere('etapa sem sucesso: sai o para_familia, sem o rascunho', d.resultado.resposta.startsWith('Qual desses horários') && !d.resultado.resposta.includes('adivinhar'), d.resultado.resposta)
}

{
  // Rodada 3, IA03-v1: o toque em "Marcar uma consulta" nao e escolher horario.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo', unidade: 'São Paulo', dia: 'hoje', horario: '15:00' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'Marcar uma consulta', criancas: ['Helena', 'Theo'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('horario que a familia nao escolheu: para na lista do dia', d.resultado.resposta === 'aguardando_horario(hoje)', d.resultado.resposta)
}
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo', unidade: 'São Paulo', dia: 'sábado', horario: '15:10' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'sim', criancas: ['Helena', 'Theo'], ultimaDoConsultorio: 'No sábado, 24/10, tem 15:10 em São Paulo. Quer que eu marque?' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('sim ao unico horario oferecido: guarda direto', d.resultado.resposta === 'dados_nome(15:10)', d.resultado.resposta)
}
{
  // Rodada 3, IA04: "posso dar dipirona?" numa conversa que ja e de urgencia.
  const c = claudeFalso([texto('Pode dar dipirona 10 gotas enquanto isso.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'posso dar pelo menos a dipirona?', historico: [{ de: 'familia', texto: 'a Helena está com dor forte e a barriga está durinha' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('trava numa conversa de urgencia: continua urgencia', d.resultado.atencao === 'urgencia' && !/dipirona|gotas/i.test(d.resultado.resposta), JSON.stringify(d.resultado))
}

{
  // Rodada 4, IA05-v1: a urgencia que a IA reconheceu (sem sinal da lista) vale
  // pela etiqueta da conversa na pergunta seguinte.
  const c = claudeFalso([texto('Pode dar dipirona 5 gotas.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'mas enquanto isso posso dar dipirona?', urgenciaAberta: true }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('etiqueta de urgencia aberta: a trava mantem a urgencia', d.resultado.atencao === 'urgencia', JSON.stringify(d.resultado))
}

// Rodada 7, IA09 a IA12.
confere('assunto de pergunta sem "?" junto do nome', perguntaLateral('pedro henrique lima. tem estacionamento la'))
confere('nome sozinho nao e pergunta', !perguntaLateral('Pedro Henrique Alves Costa'))
{
  // "tem sabado em sp?" e a IA mandou so o menu. Rodada 11 (IA09-v2, IA20-v2):
  // o menu sem resposta volta para a IA, que responde a pergunta.
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu' }), texto('Tem sim: aos sábados ele atende em São Paulo, à tarde.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'tem sabado em sp? meu filho 8a vive c intestino preso' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('menu com pergunta: a resposta vem da IA', d.resultado.resposta === 'Tem sim: aos sábados ele atende em São Paulo, à tarde.', d.resultado.resposta)
  confere('menu com pergunta: a IA ouviu o erro', JSON.stringify(c.chamadas[1] ?? '').includes('Menu não aberto'), '')
}
{
  // Sem pergunta, o menu abre como antes.
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'oi bom dia' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('menu sem pergunta abre', d.resultado.resposta.endsWith('ROBO(menu)'), d.resultado.resposta)
}
{
  // O mesmo recado no passo e na equipe sai uma vez so.
  const f = ferramentasQueGuardam()
  const c = claudeFalso([{
    content: [
      { type: 'tool_use', id: 't-p', name: 'responder_etapa', input: { texto: 'Davi Rocha Alves', para_familia: 'Sobre o pix, a equipe te manda a chave por aqui.' } },
      { type: 'tool_use', id: 't-e', name: 'chamar_equipe', input: { motivo: 'financeiro', para_familia: 'A chave do pix a equipe te manda por aqui.', resumo_para_equipe: 'Pede a chave do pix.' } },
    ],
  }])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'davi rocha alves e o pix eu mando como', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('recado repetido no passo e na equipe sai uma vez', (d.resultado.resposta.match(/pix/g) ?? []).length === 1, d.resultado.resposta)
}

// Rodada 7: "preciso mudar" e pedido, e "a tela" nao e palavra da conversa.
confere('"preciso mudar a consulta" nao e pergunta', !perguntaLateral('preciso mudar a consulta da helena pra quarta'))
confere('"a tela ja mostra" nao sai', semNarracao('A tela já mostra a remarcação para 14:00. Até lá!') === 'Até lá!', semNarracao('A tela já mostra a remarcação para 14:00. Até lá!'))

// Rodada 6, ultima leva: piora, ficha so com o que a familia escreveu, pergunta
// sem "?" no agendamento, pergunta junto do agendamento aberto.
confere('agendamento: tres palavras a mais sao pergunta, mesmo sem "?"', perguntaLateral('santos e presisa de pedido da pediatra pra consulta', true) && !perguntaLateral('santos e presisa de pedido da pediatra pra consulta'))
confere('agendamento: resposta curta do passo nao e pergunta', !perguntaLateral('pode ser sexta de manha', true))
confere('chamada em formato de parametro nao sai', semNarracao('Já avisei. <parameter name="motivo">urgencia</parameter>') === 'Já avisei.', semNarracao('Já avisei. <parameter name="motivo">urgencia</parameter>'))
confere('"vou abrir" sem abrir nada nao sai', semNarracao('Entendi. Agora vou abrir a troca do horário.') === 'Entendi.')
{
  // "depois das 17h" e limite: a IA nao guarda as 17:00.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo', unidade: 'São Paulo', dia: 'segunda', horario: '17:00' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'Segunda, dia 26. Precisa ser depois das 17h, que é quando ela sai da escola.', criancas: ['Helena', 'Theo'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"depois das 17h" nao guarda as 17:00', d.resultado.resposta === 'aguardando_horario(segunda)', d.resultado.resposta)
}
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('responder_etapa', { texto: 'São Paulo', para_familia: 'Sobre o horário, a equipe confirma por aqui.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Não, às 17h ela ainda está na escola. Pode ser às 18:20?', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: texto que a familia nao escreveu nao vira nome', d.eventos.some((e) => e.detalhe === 'etapa_recusada') && !f.feito.some(([q]) => q === 'robo'), JSON.stringify({ e: d.eventos, f: f.feito }))
}
{
  // Agendamento aberto sem para_familia, com pergunta na mensagem: a resposta vai na frente.
  const f = roboComEtapas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Santos' }), texto('O pedido do exame você leva no dia da consulta.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: aceitou().texto ? { ...aceitou(), texto: 'santos é melhor, quarta a tarde. e o exame eu levo no dia ou tenho que mandar antes' } : aceitou(),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('agendamento com pergunta e sem para_familia: a resposta vai na frente', d.resultado.resposta.startsWith('O pedido do exame você leva no dia da consulta.'), d.resultado.resposta)
}
{
  // Piora numa urgencia ja aberta: o resultado pede alerta de novo.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Se piorou, procure agora o pronto-socorro mais próximo ou ligue 192.', resumo_para_equipe: 'Piorou de madrugada.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'ela piorou mt, ta gritando de dor', historico: [{ de: 'familia', texto: 'a barriga da Helena está durinha e ela não para de chorar' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('piora na urgencia aberta: o medico e avisado de novo', d.resultado.piora === true, JSON.stringify(d.resultado))
}

// Rodada 6 do painel: a pergunta junto do passo, com a tela do robo e a
// ferramenta da equipe, sem JSON, sem conduta de dieta e sem "?" obrigatorio.
confere('pergunta sem "?": "e o pix eu mando pra onde"', perguntaLateral('joao pedro rocha alves. e o pix eu mando pra onde'))
confere('so a resposta do passo nao e pergunta: "hoje a tarde seria otimo"', !perguntaLateral('Hoje à tarde seria ótimo. Tem às 16h?'))
confere('JSON de ferramenta nao sai', semNarracao('Já passei para a equipe. {"motivo": "medico", "para_familia": "x"}') === 'Já passei para a equipe.', semNarracao('Já passei para a equipe. {"motivo": "medico", "para_familia": "x"}'))
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'financeiro', para_familia: 'A chave do pix a equipe manda por aqui.', resumo_para_equipe: 'Mãe pede a chave do pix.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'joao pedro rocha alves. e o pix eu mando pra onde', etapa: 'dados_nome' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: '🎂 Qual é a *data de nascimento*?' }).fn,
  })
  confere('pergunta da equipe junto do passo: para_familia, etiqueta e nota', d.resultado.resposta === 'A chave do pix a equipe manda por aqui.\n\n🎂 Qual é a *data de nascimento*?' && d.resultado.atencao === 'atendente' && d.nota?.includes('chave do pix'), JSON.stringify(d))
  confere('pergunta junto do passo: a IA ve a tela do robo e so a ferramenta da equipe', textoDoSistema(c.chamadas[0]).includes('Qual é a *data de nascimento*') && c.chamadas[0].tools.length === 1 && c.chamadas[0].tools[0].name === 'chamar_equipe', JSON.stringify(c.chamadas[0].tools?.map((t) => t.name)))
}
{
  const c = claudeFalso([texto('Até lá, melhor não mudar nada por conta própria na sua alimentação.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Gael Teixeira Moura. Ah, até a consulta eu devo tirar o leite da minha alimentação?', etapa: 'dados_nome' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: '🎂 Qual é a *data de nascimento*?' }).fn,
  })
  confere('conduta de dieta na pergunta junto do passo: frase de quem orienta', d.resultado.resposta.startsWith('Sobre isso, quem orienta é o Dr. Marcello') && d.resultado.atencao === 'atendente', d.resultado.resposta)
}

// Rodada 5 do painel, segunda leva (17/10/2026).
confere('"liguem 192" e para a familia, nao recado para a equipe', !falaComAEquipe('Levem a Helena ao pronto-socorro mais próximo agora ou liguem 192.'))
confere(
  'rascunho em primeira pessoa nao sai',
  semNarracao('Dor forte com barriga dura é sintoma de alerta, então devo orientar pronto-socorro caso piore. Não preciso chamar a equipe de novo: ele já foi avisado nesta conversa.') === '',
)
confere(
  '"O Dr. Marcello" e uma frase so',
  !semRepetir('Imagina! O Dr. Marcello vai adorar saber disso pela Helena. Estamos torcendo.', 'O Dr. Marcello vai adorar saber disso pela Helena hoje.').includes('O Dr. Estamos'),
  semRepetir('Imagina! O Dr. Marcello vai adorar saber disso pela Helena. Estamos torcendo.', 'O Dr. Marcello vai adorar saber disso pela Helena hoje.'),
)
{
  // Urgencia com o texto trocado por ser "recado para a equipe": o recado nao enfraquece.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Levem a Helena ao pronto-socorro agora. Por favor, confirmem o alerta ao Dr. Marcello.', resumo_para_equipe: 'Vômito escuro.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'o pai dela acha q foi o toddy, nao precisa ir ne?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('recado trocado na urgencia: pronto-socorro firme', d.resultado.resposta.startsWith('🚨 Procure agora o pronto-socorro'), d.resultado.resposta)
}
{
  // Urgencia: o aviso condicional nao se repete se a ultima mensagem ja tinha.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'O Dr. Marcello já foi avisado e vai avaliar.', resumo_para_equipe: 'Febre.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'e agora, ele ta muito quente', ultimaDoConsultorio: 'Já avisei o Dr. Marcello. Se for uma emergência com risco de vida, procure o pronto-socorro mais próximo ou ligue 192.' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('pronto-socorro condicional uma vez so', !d.resultado.resposta.includes('pronto-socorro'), d.resultado.resposta)
}
{
  // "as 16 pode ser" vale 16:00.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo', unidade: 'Santos', dia: 'quarta', horario: '16:00' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'as 16 pode ser', criancas: ['Helena', 'Theo'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"as 16" vale 16:00', d.resultado.resposta === 'dados_nome(16:00)', d.resultado.resposta)
}
{
  // Pergunta junto do passo que o robo entendeu: a IA responde so a pergunta, na frente.
  const c = claudeFalso([texto('Em São Paulo a consulta é R$ 600,00; em Santos, R$ 450,00.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: '14/09/2018. Ah, e o valor em São Paulo é o mesmo de Santos?', etapa: 'dados_nascimento' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: '👤 Qual é o *nome do responsável*?' }).fn,
  })
  confere('pergunta junto do passo: respondida antes do passo', d.origem === 'ia' && d.resultado.resposta === 'Em São Paulo a consulta é R$ 600,00; em Santos, R$ 450,00.\n\n👤 Qual é o *nome do responsável*?', d.resultado.resposta)
  // So a ferramenta da equipe (rodada 6: sem nenhuma, a IA escreveu a chamada como texto).
  confere('pergunta junto do passo: so a ferramenta da equipe', c.chamadas[0]?.tools?.length === 1 && c.chamadas[0].tools[0].name === 'chamar_equipe', JSON.stringify(c.chamadas[0]?.tools?.map((t) => t.name) ?? null))
}
{
  // Passo e equipe na mesma vez: os dois acontecem.
  const f = ferramentasQueGuardam()
  const c = claudeFalso([{
    content: [
      { type: 'tool_use', id: 't-passo', name: 'responder_etapa', input: { texto: 'Bernardo Nogueira Costa' } },
      { type: 'tool_use', id: 't-eq', name: 'chamar_equipe', input: { motivo: 'medico', para_familia: 'Sobre o leite, quem orienta é o Dr. Marcello: já passei para a equipe.', resumo_para_equipe: 'Mãe pergunta se para o leite.' } },
    ],
  }])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'bernardo nogueira costa. ah e devo parar de toma leite ate la?', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('passo e equipe juntos: o passo segue', d.resultado.resposta.endsWith('ROBO(Bernardo Nogueira Costa)'), d.resultado.resposta)
  confere('passo e equipe juntos: a equipe fica sabendo, com o passo mantido', d.resultado.resposta.startsWith('Sobre o leite') && d.resultado.atencao === 'atendente' && f.pedidos[0]?.o?.manterEtapa === true && d.nota?.includes('para o leite'), JSON.stringify({ r: d.resultado, p: f.pedidos, n: d.nota }))
}
{
  // Campo com erro de digitacao.
  const f = roboComEtapas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_famila: 'Em São Paulo a consulta é R$ 600,00.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"para_famila" tambem chega', d.resultado.resposta.startsWith('Em São Paulo a consulta é R$ 600,00.'), d.resultado.resposta)
}
{
  // Rodada 5, IA24-v2: a pergunta que veio junto do passo sai respondida antes da tela seguinte.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('responder_etapa', { texto: 'Santos', para_familia: 'Atende sim, de recém-nascidos até 19 anos.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'santos. mas ele atende 17 msm ne?', etapa: 'aguardando_unidade' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi qual unidade.' }).fn,
  })
  confere('passo com pergunta: a resposta vai antes da tela', d.resultado.resposta === 'Atende sim, de recém-nascidos até 19 anos.\n\nDatas em Santos', d.resultado.resposta)
}
{
  // Rodada 5, IA09-v2: "quero o das 3 e 10" e 15:10.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo', unidade: 'São Paulo', dia: 'sábado', horario: '15:10' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'sim quero o das 3 e 10', criancas: ['Helena', 'Theo'] }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"3 e 10" vale 15:10', d.resultado.resposta === 'dados_nome(15:10)', d.resultado.resposta)
}
{
  // Rodada 5, IA11-v1: marcar e uma duvida da equipe na mesma mensagem.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'telemedicina', para_familia: 'Sobre o retorno por vídeo, já passei para a equipe.', duvida_para_equipe: 'Pergunta se o retorno pode ser por vídeo.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero sim, a noite. o retorno pode ser por video?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('marcar com duvida da equipe: o agendamento segue', d.resultado.resposta.endsWith('Para quem é a consulta?'), d.resultado.resposta)
  confere('marcar com duvida da equipe: a equipe fica sabendo', d.resultado.atencao === 'atendente' && d.nota?.includes('retorno pode ser por vídeo'), JSON.stringify({ atencao: d.resultado.atencao, nota: d.nota }))
}

// Rodada 5 do painel: com chamar_equipe, so o para_familia chega a familia, entao
// ele tem de levar tambem o que a IA ja sabe (o valor, no IA18).
{
  const c = claudeFalso([texto('ok')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  const equipe = c.chamadas[0].tools.find((t) => t.name === 'chamar_equipe')
  confere('chamar_equipe: para_familia leva a resposta inteira', equipe.input_schema.properties.para_familia.description.includes('o que ficar fora daqui ela não vê'))
}
confere('marca interna das instrucoes nao sai', semNarracao('Não tenho essa informação em <clinica>. A consulta é R$ 450,00.') === 'A consulta é R$ 450,00.', semNarracao('Não tenho essa informação em <clinica>. A consulta é R$ 450,00.'))

// Rodada 3 do painel (17/10/2026): a trava confere o que sai, e "chamar" nao e cha.
confere('"antes de chamar a equipe" nao e conduta', !orientouConduta('Preciso ver os horários antes de chamar a equipe.'))
confere('"de chá" continua conduta', orientouConduta('Dê chá de camomila para ele.'))
{
  // Rascunho com remedio + so ver_horarios: nada disso sai, entao nao trava.
  const c = claudeFalso([
    usa('ver_horarios', { unidade: 'todas' }, 'A mãe pergunta se pode dar paracetamol; febre em bebê pequeno é urgente.'),
    usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Entendo o seu medo. Já avisei o Dr. Marcello. O mais próximo é quarta, 21/10, às 08:00 em Santos.', resumo_para_equipe: 'Febre, 7 semanas.' }),
  ])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'meu nenem de 7 semanas ta com febre de 38,5, posso dar paracetamol?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('rascunho de quem consulta horario nao dispara a trava', d.eventos.some((e) => e.detalhe === 'equipe:urgencia') && d.resultado.resposta.includes('08:00'), JSON.stringify(d.eventos))
}
{
  // Urgencia no meio da ficha: o passo fica aberto.
  const f = ferramentasQueGuardam()
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Já avisei o Dr. Marcello. Para completar o cadastro, qual o nome completo dele?', resumo_para_equipe: 'Vomitou de novo.' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ele vomitou dnv agora. o q eu faço ate la?', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('urgencia no meio da ficha: a ficha fica aberta', f.pedidos[0]?.o?.manterEtapa === true, JSON.stringify(f.pedidos))
}

// Rodada 2 do painel, IA03 a IA05 (17/10/2026).
{
  // A conversa ja e de urgencia: o pronto-socorro fica, mesmo que a mensagem
  // nova so pergunte o horario.
  const c = claudeFalso([texto('Não espere até quarta. Leve-o agora a um pronto-socorro.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'mas tem horario ou nao? qual o primeiro q tem?', historico: [{ de: 'familia', texto: 'meu nenem de 7 semanas ta com febre de 38,5 e nao para de vomitar' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('conversa de urgencia: o pronto-socorro fica', d.resultado.resposta.includes('pronto-socorro'), d.resultado.resposta)
}
{
  // O robo calou o sinal de alarme repetido (o aviso acabou de sair): a IA responde.
  const c = claudeFalso([texto('A consulta de hoje às 15:00 continua marcada, e o Dr. Marcello já foi avisado.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'e ate as 15h? ele nao para de vomitar' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto(null).fn,
  })
  confere('sinal repetido com o robo calado: a IA responde', d.origem === 'ia' && d.resultado.resposta.includes('15:00'), JSON.stringify(d))
}
{
  // Horarios pedidos junto com a equipe: a agenda volta para a IA, e a equipe
  // e chamada na volta seguinte, ja com o horario.
  const junto = {
    content: [
      { type: 'text', text: 'Vou ver agora o horário mais próximo.' },
      { type: 'tool_use', id: 't-horas', name: 'ver_horarios', input: { unidade: 'todas' } },
      { type: 'tool_use', id: 't-equipe', name: 'chamar_equipe', input: { motivo: 'urgencia', para_familia: 'Já avisei o Dr. Marcello.', resumo_para_equipe: 'Febre.' } },
    ],
  }
  const c = claudeFalso([junto, usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Já avisei o Dr. Marcello. O horário mais próximo é quarta, 21/10, às 08:00 em Santos.', resumo_para_equipe: 'Febre.' })])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'meu nenem esta com febre, qual o horario mais cedo?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  const segunda = JSON.stringify(c.chamadas[1]?.messages ?? [])
  confere('horarios junto com a equipe: a agenda volta para a IA', c.chamadas.length === 2 && segunda.includes('quarta, 21/10: 08:00') && segunda.includes('Ainda não feito'), segunda.slice(-400))
  confere('horarios junto com a equipe: a familia recebe o horario', d.resultado.resposta.includes('08:00') && d.resultado.atencao === 'urgencia', d.resultado.resposta)
}
{
  // Consulta sem cadastro: o nome e de quem marcou, nao da crianca.
  const falha = { from: () => { throw new Error('sem banco no teste') } }
  const s = await montarSituacao(falha, {
    clinicId: 'c1', conversationId: 'v1', texto: 'ta confirmado as 15h hj ne?', anexo: false, etapa: 'atendente', criancas: [],
    consultas: [{ id: 'a1', inicio: '2026-10-19T18:00:00Z', unidade: 'Livance Ibirapuera', endereco: '', paciente: 'Marina', confirmada: true, semCadastro: true }],
    quemAtende: 'o Dr. Marcello', agora: new Date('2026-10-19T13:00:00Z'), equipeConversando: false,
  })
  confere('consulta sem cadastro: sem o nome do contato', s.consultas[0]?.includes('cadastro da criança ainda incompleto') && !s.consultas[0].includes('Marina'), JSON.stringify(s.consultas))
}

// O rascunho da IA nao chega a familia (rodada 2: em quatro de quatro
// agendamentos com horario, "A familia escolheu o horario, entao abro...").
for (const rascunho of [
  'A família escolheu o horário, então abro o agendamento direto com unidade, dia e horário.',
  'A mãe quer "separar" o horário das 9:20 por garantia, e o sistema não separa nem segura horário.',
  'A família aceitou marcar, e a conversa já definiu unidade (São Paulo) e dia (sábado, 24/10).',
  'Abro o agendamento no sábado, deixando a escolha da unidade e do horário para o fluxo.',
]) confere(`rascunho cortado: "${rascunho.slice(0, 40)}"`, semNarracao(rascunho) === '', semNarracao(rascunho))
confere('texto para a familia fica', semNarracao('Atende sim! Aos sábados ele atende em São Paulo. Quer que eu veja um horário?') === 'Atende sim! Aos sábados ele atende em São Paulo. Quer que eu veja um horário?')
{
  const f = roboComEtapas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', dia: 'sábado' }, 'Como ela não vai ver a lista de unidades, digo o valor e a forma de pagamento.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: aceitou(), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('abrir_fluxo: texto solto nao vai, mesmo sem cara de rascunho', d.resultado.resposta === '⏰ Horários de sábado', d.resultado.resposta)
}
{
  const f = ferramentasQueGuardam()
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'medico', para_familia: 'Quem orienta a dieta é o Dr. Marcello: já passei para a equipe. Enquanto isso, qual o nome completo do bebê?', resumo_para_equipe: 'Dieta.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'e eu corto o leite da minha dieta?', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('passo ja lembrado pela IA: sem o lembrete repetido', !d.resultado.resposta.includes('Para continuar de onde paramos'), d.resultado.resposta)
}
{
  // "Pensando bem melhor Sao Paulo, tem segunda?" com a lista de Santos aberta.
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('responder_etapa', { texto: 'São Paulo', dia: 'segunda' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pensando bem melhor sao paulo, tem segunda?', etapa: 'aguardando_horario' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número do horário.' }).fn,
  })
  confere('troca de unidade com dia: segue ate os horarios do dia', d.resultado.resposta === 'aguardando_horario(segunda)', d.resultado.resposta)
}
{
  const c = claudeFalso([texto('Pode ser várias coisas, e é isso que o Dr. Marcello avalia na consulta. Se ele piorar, procure o pronto-socorro.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'não é urgência, só queria saber se sangue no cocô do bebê é normal' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"nao e urgencia": pronto-socorro sai da duvida comum', !d.resultado.resposta.includes('pronto-socorro'), d.resultado.resposta)
}
{
  const c = claudeFalso([texto('ok')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  const ferramentas = Object.fromEntries(c.chamadas[0].tools.map((t) => [t.name, t]))
  confere('abrir_fluxo aceita crianca e horario, remarcar e cancelar', Boolean(ferramentas.abrir_fluxo.input_schema.properties.paciente && ferramentas.abrir_fluxo.input_schema.properties.horario && ferramentas.abrir_fluxo.input_schema.properties.fluxo.enum.includes('cancelar')))
  confere('ver_horarios aceita todas', ferramentas.ver_horarios.description.includes('"todas"'))
  confere('instrucao: sem prazo da equipe', textoDoSistema(c.chamadas[0]).includes('Nada de "responde hoje"'))
}

// ---------------------------------------------------------------
// Rodada 7 do painel com IA (17/10/2026)
// ---------------------------------------------------------------

// Critica: a foto com legenda de alarme ia para o texto do anexo.
confere('anexo com legenda de alarme e urgencia', ficaComORobo(situacao({ anexo: true, texto: 'olha o vomito dela, saiu com sangue' })) === 'urgencia')
confere('anexo sem legenda continua anexo', ficaComORobo(situacao({ anexo: true, texto: '' })) === 'anexo')
// IA22: "urgente" de um relatorio pedido antes alertou o medico.
confere(
  '"urgente" de um papel fica com a IA',
  ficaComORobo(situacao({ texto: 'mas é urgente mesmo, a excursão é sexta', historico: [{ de: 'familia', texto: 'preciso de um relatório para a escola dela' }] })) === null,
)
confere(
  '"urgente" depois de um sintoma continua urgencia, mesmo com escola',
  ficaComORobo(situacao({ texto: 'é urgente', historico: [{ de: 'familia', texto: 'ela vomitou na escola hoje' }] })) === 'urgencia',
)
confere('"urgente" sem papel continua urgencia', ficaComORobo(situacao({ texto: 'é urgente' })) === 'urgencia')

// IA05-v1: mandar NAO dar tambem e conduta.
for (const frase of [
  'Remédio e dose quem orienta é o Dr. Marcello, então não dê nada antes de falar com ele.',
  'Não dê o remédio até ele responder.',
  'Não faça nada antes de sair.',
  'Quem orienta é o Dr. Marcello, então não dê o remédio por enquanto.',
])
  confere(`conduta: "${frase}"`, orientouConduta(frase))
confere('conduta: recusa sozinha continua passando', !orientouConduta('Sobre remédio, quem orienta é o Dr. Marcello.'))

// Raciocinio que vazou na rodada 7.
confere('narracao: "a familia decidiu"', semNarracao('A família decidiu ir ao pronto-socorro agora. Que bom que vão levar!') === 'Que bom que vão levar!', semNarracao('A família decidiu ir ao pronto-socorro agora. Que bom que vão levar!'))
confere('narracao: "pela regra"', semNarracao('Pela regra, não digo se é normal. Entendo a preocupação.') === 'Entendo a preocupação.')
confere('narracao: "nao e preciso chamar"', semNarracao('Não é preciso chamar a equipe de novo. Boa sorte!') === 'Boa sorte!')
confere('eco: "Sim, o estacionamento e pago?"', semNarracao('Sim, o estacionamento é pago? O valor eu não tenho.') === 'O valor eu não tenho.', semNarracao('Sim, o estacionamento é pago? O valor eu não tenho.'))
confere('eco: oferta com "sim" fica', semNarracao('Sim, quer que eu veja um horário?') === 'Sim, quer que eu veja um horário?')

// IA22: pergunta sem "?" na ficha.
confere('ficha: "pode ir sozinha ou tem q ir" e pergunta', perguntaLateral('beatriz alves pinto. ela pode ir sozinha ou tem q ir com responsavel'))
confere('ficha: so o nome nao e pergunta', !perguntaLateral('beatriz alves pinto'))

// IA20-v2: "vale confirmar com a equipe" sem a ferramenta.
{
  const f = ferramentasFalsas()
  const c = claudeFalso([texto('Domingo não tem atendimento. Em feriado vale confirmar com a equipe.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'e domingo? e feriado' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('texto que promete a equipe chama a equipe', f.feito.some(([q]) => q === 'equipe') && Boolean(d.nota), JSON.stringify({ f: f.feito, nota: d.nota }))
}
{
  const f = ferramentasFalsas()
  const c = claudeFalso([texto('Atendemos aos sábados em São Paulo. Vou anotar que você prefere de manhã.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'atende sabado? prefiro de manha' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('promessa que ninguem cumpre sai', d.resultado.resposta === 'Atendemos aos sábados em São Paulo.', d.resultado.resposta)
  confere('promessa sem equipe nao chama a equipe', !f.feito.some(([q]) => q === 'equipe'))
}

// IA17-v2: a ficha recusada nao promete o que nao foi feito, e a equipe sabe.
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('responder_etapa', { texto: 'São Paulo', para_familia: 'Entendi! Tem vaga na segunda, 26/10 às 19h.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'hj n consigo. pode ser segunda q vem 19h?', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha recusada: sem a promessa da IA', !d.resultado.resposta.includes('26/10'), d.resultado.resposta)
  confere('ficha recusada: a equipe fica sabendo', f.feito.some(([q]) => q === 'equipe') && String(d.nota ?? '').includes('segunda q vem'), JSON.stringify({ f: f.feito, nota: d.nota }))
}

// IA19: depois de "vou pensar", sem o lembrete do passo.
for (const [nome, historico, temLembrete] of [
  ['depois de "vou pensar", sem lembrete', [{ de: 'familia', texto: 'vou pensar' }], false],
  ['sem "vou pensar", com lembrete', [{ de: 'familia', texto: 'quanto custa?' }], true],
]) {
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'sem_informacao', para_familia: 'Sem pressa! Sobre desmarcar, a equipe confirma por aqui.', resumo_para_equipe: 'Pergunta se perde o valor ao desmarcar.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'se eu marcar e depois nao conseguir ir, perco o dinheiro', etapa: 'aguardando_unidade', historico }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número da unidade.' }).fn,
  })
  confere(nome, d.resultado.resposta.includes('pergunta acima') === temLembrete, d.resultado.resposta)
}

// abrir_fluxo e chamar_equipe juntos: a chamada nao some; com urgencia, a
// urgencia ganha.
{
  const f = ferramentasFalsas()
  const c = claudeFalso([{
    content: [
      { type: 'tool_use', id: 'a', name: 'abrir_fluxo', input: { fluxo: 'agendar', unidade: 'Santos' } },
      { type: 'tool_use', id: 'b', name: 'chamar_equipe', input: { motivo: 'sem_informacao', para_familia: 'Sobre o estacionamento, a equipe confirma por aqui.', resumo_para_equipe: 'Pergunta se tem estacionamento.' } },
    ],
  }])
  // Sem pergunta na mensagem: a resposta lateral nao entra, e so a chamada junto
  // leva a duvida para a equipe.
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar em santos' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('fluxo + equipe: a equipe vai na nota', String(d.nota ?? '').includes('estacionamento') && Boolean(d.resultado.atencao), JSON.stringify({ nota: d.nota, r: d.resultado }))
  confere('fluxo + equipe: o agendamento abre', d.resultado.resposta.includes('ROBO('), d.resultado.resposta)
}
{
  const f = ferramentasFalsas()
  const c = claudeFalso([{
    content: [
      { type: 'tool_use', id: 'a', name: 'abrir_fluxo', input: { fluxo: 'agendar' } },
      { type: 'tool_use', id: 'b', name: 'chamar_equipe', input: { motivo: 'urgencia', para_familia: 'Já avisei o Dr. Marcello.', resumo_para_equipe: 'Dor forte.' } },
    ],
  }])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar pra ela, ta estranha' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('fluxo + urgencia: a urgencia ganha', f.feito.some(([q, m]) => q === 'equipe' && m === 'urgencia'), JSON.stringify(f.feito))
}

// Risco de vida: sem oferta de marcar, e o pronto-socorro firme.
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Já avisei o Dr. Marcello. Quer que eu veja um horário para amanhã?', resumo_para_equipe: 'Engoliu pilha.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'e agora? ele ta chorando muito', historico: [{ de: 'familia', texto: 'acho que ele engoliu uma pilha' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('risco de vida: sem oferta de marcar', !d.resultado.resposta.includes('Quer que eu veja'), d.resultado.resposta)
  confere('risco de vida: pronto-socorro firme', /^🚨.*agora.*pronto-socorro mais próximo ou ligue 192/s.test(d.resultado.resposta), d.resultado.resposta)
}

// ---------------------------------------------------------------
// Rodada 8 do painel com IA (18/10/2026)
// ---------------------------------------------------------------

// O \b nao via o "a" acentuado: "a mae esta" e "a familia ja" passavam.
for (const [entrada, saida] of [
  ['A mãe está dizendo que vai agora, então não preciso reavisar o médico. Boa sorte!', 'Boa sorte!'],
  ['A família já escolheu o horário. Ótimo!', 'Ótimo!'],
  ['Antes de qualquer texto, preciso corrigir isso. A segunda que vem é 26/10.', 'A segunda que vem é 26/10.'],
  ['Ela perguntou de quem é o CPF. O CPF é o da criança.', 'O CPF é o da criança.'],
  ['Como o sistema já seguiu com o horário errado, o caminho é reabrir. Seu horário está guardado.', 'Seu horário está guardado.'],
  ['Pode cancelar. Não há nada a acrescentar.', 'Pode cancelar.'],
  ['A consulta em São Paulo é R$ 450,00? Não: é R$ 600,00.', 'É R$ 600,00.'],
])
  confere(`narracao rodada 8: "${entrada.slice(0, 40)}"`, semNarracao(entrada) === saida, semNarracao(entrada))
confere('recusa: "so o Dr. Marcello pode orientar"', !orientouConduta('Sobre a dose, só o Dr. Marcello pode orientar.'))
confere('lateral: "pode cancelar sim" nao e pergunta', !perguntaLateral('Oi, voltei! Conversamos aqui e pode cancelar sim, por favor.'))
confere('lateral: "8h. e ate la do ou n" e pergunta', perguntaLateral('8h. e ate la do ou n'))
confere('lateral: correcao do nome e pergunta', perguntaLateral('12 3 2022. e arruma o nome dele q escrevi trocado'))

// "Nao tenho essa informacao" e "Posso passar para a equipe" sem a ferramenta.
for (const frase of ['Sobre chegar antes, não tenho essa informação.', 'Feriado depende. Posso passar essa dúvida para a equipe confirmar.']) {
  const f = ferramentasFalsas()
  const c = claudeFalso([texto(frase)])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'e sabado vai ate q horas. precisa chegar antes' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere(`"${frase.slice(0, 30)}" chama a equipe`, f.feito.some(([q]) => q === 'equipe') && /equipe/.test(d.resultado.resposta), JSON.stringify({ f: f.feito, r: d.resultado.resposta }))
}
// "Depois da ficha eu troco": ninguem troca.
{
  const c = claudeFalso([texto('Claro! Depois da ficha eu troco o horário para 8h40. Atendemos em Santos.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'atende em santos?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('promessa "depois da ficha eu troco" sai', !/troco/.test(d.resultado.resposta), d.resultado.resposta)
}

// "Pode cancelar sim" nao chama a resposta extra da IA (IA14-v1: "Nao ha nada a
// acrescentar" saiu em cima da confirmacao).
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu' }), texto('Não há nada a acrescentar.')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'Oi, voltei! Conversamos aqui e pode cancelar sim, por favor.' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('fluxo sem pergunta: sem resposta extra da IA', c.chamadas.length === 1, String(c.chamadas.length))
}

// PULAR so com a familia dizendo que nao tem (IA15-v2, IA21-v1).
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('responder_etapa', { texto: 'PULAR' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ele precisa ir em jejum', etapa: 'dados_email' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('PULAR que a familia nao disse e recusado', d.eventos.some((e) => e.detalhe === 'etapa_recusada') && !f.feito.some(([q]) => q === 'robo'), JSON.stringify({ e: d.eventos, f: f.feito }))
}
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('responder_etapa', { texto: 'PULAR' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'n tenho email nao moça', etapa: 'dados_email' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('PULAR que a familia disse vale', f.feito.some(([q, t]) => q === 'robo' && t === 'PULAR'), JSON.stringify(f.feito))
}

// abrir_fluxo com "acao" (IA11-v1), e fluxo desconhecido volta para a IA.
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('abrir_fluxo', { acao: 'agendar' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('abrir_fluxo com "acao" abre o fluxo', d.resultado.resposta.includes('ROBO('), d.resultado.resposta)
}
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'trocar' }), usa('abrir_fluxo', { fluxo: 'agendar' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('fluxo desconhecido volta para a IA corrigir', c.chamadas.length === 2 && d.resultado.resposta.includes('ROBO('), JSON.stringify({ n: c.chamadas.length, r: d.resultado.resposta }))
}

// Fluxo e equipe juntos: os dois textos chegam (IA24-v1).
{
  const c = claudeFalso([{
    content: [
      { type: 'tool_use', id: 'a', name: 'abrir_fluxo', input: { fluxo: 'agendar', para_familia: 'Claro, vamos marcar.' } },
      { type: 'tool_use', id: 'b', name: 'chamar_equipe', input: { motivo: 'sem_informacao', para_familia: 'Sobre o nome, a equipe corrige por aqui.', resumo_para_equipe: 'Nome errado.' } },
    ],
  }])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quero marcar' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('fluxo + equipe: os dois textos chegam', d.resultado.resposta.includes('Claro, vamos marcar.') && d.resultado.resposta.includes('a equipe corrige'), d.resultado.resposta)
}

// Alerta repetido (IA01 a IA04): com a urgencia aberta, so a piora reavisa.
const DA_PILHA = [{ de: 'familia', texto: 'acho que ele engoliu uma pilha' }, { de: 'consultorio', texto: 'Procure agora o pronto-socorro mais próximo ou ligue 192. Já avisei o Dr. Marcello.' }]
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'O Dr. Marcello já foi avisado. Leve agora ao pronto-socorro.', resumo_para_equipe: 'Insiste em consulta.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'mas ele ta bem, ta brincando. nao da p o dr ver ele hj?', historico: DA_PILHA, urgenciaAberta: true }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('sem piora, a urgencia aberta nao reavisa', !d.resultado.piora, JSON.stringify(d.resultado))
}
// Piora (IA05-v2, critica): o pronto-socorro firme na primeira frase, sem o
// "se piorar" nem a consulta das 14:30.
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'O Dr. Marcello vai avaliar. A consulta do Enzo continua marcada para hoje às 14:30. Se ele piorar, volte ao pronto-socorro.', resumo_para_equipe: 'Febre voltou.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'voltamo do ps e a febre voltou, ele ta chorando', historico: [{ de: 'familia', texto: 'é urgente, ele ta com 39 de febre' }], urgenciaAberta: true }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('piora: reavisa', d.resultado.piora === true, JSON.stringify(d.resultado))
  confere('piora: pronto-socorro firme primeiro', d.resultado.resposta.startsWith('🚨 Se piorou'), d.resultado.resposta)
  confere('piora: sem "se piorar" e sem a consulta', !/se ele piorar|continua marcada/i.test(d.resultado.resposta), d.resultado.resposta)
}
// Risco de vida: o horario mais proximo tambem sai (IA02-v1).
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Leve agora ao pronto-socorro. O horário mais próximo é hoje às 14:30.', resumo_para_equipe: 'Pilha.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'o dr viu as mensagens?', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('risco de vida: sem o horario mais proximo', !/14:30|mais próximo é/.test(d.resultado.resposta), d.resultado.resposta)
}
// A trava mantem o "pronto-socorro agora" que a IA ja tinha dado (IA05-v2).
{
  const c = claudeFalso([texto('Só o Dr. Marcello pode orientar dose. Não espere: leve ele agora ao pronto-socorro. Pode dar 2,5 ml.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ele ta com febre, e meia dose pd?', historico: [{ de: 'familia', texto: 'é urgente, ele ta com 39 de febre' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('trava: mantem o pronto-socorro agora', d.resultado.resposta.includes('Procure agora o pronto-socorro'), d.resultado.resposta)
}
// Piora contada junto do passo da ficha (IA03-v1).
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Se a febre está subindo, leve agora ao pronto-socorro.', resumo_para_equipe: 'Febre subindo.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Eu, Patrícia Martins. Ah, e a febre dele está subindo agora, 38,9. O que eu faço?', etapa: 'dados_responsavel', historico: [{ de: 'familia', texto: 'é urgente, ele ta com febre alta' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: '🪪 Qual é o CPF do paciente?' }).fn,
  })
  confere('piora junto do passo reavisa', d.resultado.piora === true && d.resultado.atencao === 'urgencia', JSON.stringify(d.resultado))
}
// Valor perguntado volta junto da chamada da equipe (IA19-v1).
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'sem_informacao', para_familia: 'Sobre parcelar, vou confirmar com a equipe e te respondemos por aqui.', resumo_para_equipe: 'Parcelamento.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'queria saber o valor da consulta e se da pra parcelar' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('valor perguntado: o R$ vai junto', d.resultado.resposta.includes('R$ 450,00'), d.resultado.resposta)
}

// Rodada 9 (IA21-v1): o horario mandado pela IA no meio da ficha vira troca.
{
  const feito = []
  const f = {
    ...ferramentasFalsas(),
    robo: async (t, etapa) => {
      feito.push([t, etapa])
      return t.startsWith('trocar para')
        ? { resposta: '🔄 Horário trocado: agora é *quarta, 21/10 às 16:00*.\n\nPara terminar o cadastro, 5 perguntas rápidas.\n\n👶 Qual é o nome completo do paciente?' }
        : { resposta: `ROBO(${t})` }
    },
  }
  const c = claudeFalso([usa('responder_etapa', { texto: 'beatriz souza campos', horario: '16:00', para_familia: 'Tem sim, já peço a troca para esse horário.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ta bom entao o nome dela e beatriz souza campos mas me fala se trocou pras 4 ou nao', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: horario da IA vira troca', feito.some(([t]) => t === 'trocar para 16:00'), JSON.stringify(feito))
  confere('ficha: troca e passo juntos', d.resultado.resposta.includes('Horário trocado') && d.resultado.resposta.includes('ROBO(beatriz souza campos)'), d.resultado.resposta)
  confere('ficha: sem "ja peco a troca"', !/peço a troca/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  const c = claudeFalso([texto('Tem sim, já peço a troca para esse horário. Atendemos em Santos.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'atende em santos?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('promessa "ja peco a troca" sai', d.resultado.resposta === 'Atendemos em Santos.', d.resultado.resposta)
}

// Rodada 9: risco de vida tambem na resposta sem ferramenta e no agendamento
// (IA01-v1 e IA02, criticas).
{
  const c = claudeFalso([texto('Entendo! O próximo é quarta, às 14:00. Quer que eu marque?')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ele ta bem agora, posso esperar a consulta?', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('risco de vida sem ferramenta: pronto-socorro agora', /^🚨.*agora.*pronto-socorro mais próximo ou ligue 192/s.test(d.resultado.resposta), d.resultado.resposta)
  confere('risco de vida sem ferramenta: sem oferta', !/14:00|Quer que eu marque/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', para_familia: 'Claro, vamos marcar.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ela ta ok agr, n quero leva no ps. marca amanha c o dr?', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  // Rodada 10 (IA02, alta): com a familia ainda em casa, a agenda nao abre.
  confere('risco de vida no agendamento: pronto-socorro e sem agenda', /^🚨.*agora.*pronto-socorro mais próximo ou ligue 192/s.test(d.resultado.resposta) && !d.resultado.resposta.includes('ROBO(') && d.resultado.resposta.includes('A consulta não substitui'), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', para_familia: 'Que bom! Vamos marcar o retorno.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'voltamos do ps, ela ta bem. quero marcar o retorno', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('de volta do pronto-socorro: sem repetir o pronto-socorro', !d.resultado.resposta.includes('Pelo que você contou'), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Leve agora ao pronto-socorro. Depois, se quiser, tem quarta às 14:00.', resumo_para_equipe: 'Pilha.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'e agora?', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('risco de vida: "as 14:00" com crase sai', !d.resultado.resposta.includes('14:00'), d.resultado.resposta)
}
for (const [entrada, saida] of [
  ['Vou responder diretamente, sem chamar ferramenta. Pode sim!', 'Pode sim!'],
  ['A família parece estar concordando. Boa noite!', 'Boa noite!'],
  ['Isso não é conduta médica. Pode cancelar sim.', 'Pode cancelar sim.'],
  // "Corrigindo:" (IA09-v2), e o espaco antes fica ("15:50.E" colado, IA09-v1).
  ['São 15:50. A consulta em SP é R$ 450,00 a R$ 600,00? Corrigindo: custa R$ 600,00.', 'São 15:50. Custa R$ 600,00.'],
])
  confere(`narracao rodada 9: "${entrada.slice(0, 30)}"`, semNarracao(entrada) === saida, semNarracao(entrada))
// A crianca sem cadastro (IA14): o agendamento abre para "outra crianca".
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Theo' })])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'marca o theo, irmao dela' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('irmao sem cadastro: abre para outra crianca', f.feito.some(([q, t]) => q === 'robo' && /outra criança/.test(t)), JSON.stringify(f.feito))
}
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena' })])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'marca a helena' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('crianca cadastrada: agendamento de sempre', f.feito.some(([q, t]) => q === 'robo' && t === 'quero marcar uma consulta'), JSON.stringify(f.feito))
}
// Pergunta junto da troca (IA10-v2) e falsos positivos da equipe (IA08, IA17).
{
  const c = claudeFalso([texto('O pagamento é pelo link da Livance, que aceita cartão.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera da pra trocar pra 10 e 40? e aceita cartao?', etapa: 'dados_nome' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar,
    roboDireto: roboDireto({ resposta: '🔄 Horário trocado: agora é *sexta, 23/10 às 10:40*.\n\n👶 Qual é o nome completo do paciente?' }).fn,
  })
  confere('troca + pergunta: a pergunta e respondida', d.resultado.resposta.includes('aceita cartão') && d.resultado.resposta.includes('Horário trocado'), d.resultado.resposta)
}
{
  const c = claudeFalso([texto('não devia ser chamado')])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera da pra trocar pra 10 e 40?', etapa: 'dados_nome' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar,
    roboDireto: roboDireto({ resposta: '🔄 Horário trocado: agora é *sexta, 23/10 às 10:40*.\n\n👶 Qual é o nome completo do paciente?' }).fn,
  })
  confere('troca sem outra pergunta: a IA nao e chamada', c.chamadas.length === 0, String(c.chamadas.length))
}
// PULAR recusado com resposta da IA (IA15-v2): a resposta vai, o passo fica.
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('responder_etapa', { texto: 'PULAR', para_familia: 'Para a consulta não precisa de jejum.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'precisa ir de jejum', etapa: 'dados_email' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('PULAR recusado: a resposta da IA vai', d.resultado.resposta.includes('não precisa de jejum') && d.resultado.resposta.includes('pergunta acima'), d.resultado.resposta)
  confere('PULAR recusado: sem equipe e sem robo', !f.feito.some(([q]) => q === 'equipe' || q === 'robo'), JSON.stringify(f.feito))
}
for (const frase of ['Isso depende do seu contrato, então não consigo dizer um valor: a Unimed informa.', 'Qualquer coisa, a equipe responde por aqui.', 'Não sei dizer se é normal: quem avalia é o Dr. Marcello na consulta.'])
{
  const f = ferramentasFalsas()
  const c = claudeFalso([texto(frase)])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'a unimed devolve quanto?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere(`"${frase.slice(0, 30)}" nao chama a equipe`, !f.feito.some(([q]) => q === 'equipe'), JSON.stringify(f.feito))
}

// ---------------------------------------------------------------
// Rodada 10 do painel com IA (18/10/2026)
// ---------------------------------------------------------------

// Regressao da rodada 9 (IA21, IA24): o horario nao volta ao robo como resposta.
{
  const feito = []
  const f = {
    ...ferramentasFalsas(),
    robo: async (t, etapa) => {
      feito.push([t, etapa])
      return t.startsWith('trocar para') ? { resposta: '🔄 Horário trocado: agora é *sexta, 23/10 às 09:20*.\n\n👶 Qual é o nome completo do paciente?' } : { resposta: `ROBO(${t})` }
    },
  }
  const c = claudeFalso([usa('responder_etapa', { texto: '09:20', horario: '09:20', dia: 'sexta' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Antes da data: da pra passar para as nove e vinte?', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('troca pela IA: o horario nao volta ao robo', !feito.some(([t]) => t === '09:20') && d.resultado.resposta.includes('Horário trocado'), JSON.stringify(feito))
}
// Paragrafo de rascunho sai inteiro; endereco com "R."; promessa do documento.
confere('rascunho em paragrafo sai inteiro', semNarracao('Pelo contexto, a consulta é às 18:20. Preciso responder a pergunta e retomar o passo em aberto. Ela pediu o último horário.\nFicou às 18:20!') === 'Ficou às 18:20!', semNarracao('Pelo contexto, a consulta é às 18:20. Preciso responder a pergunta e retomar o passo em aberto. Ela pediu o último horário.\nFicou às 18:20!'))
{
  const r = semRepetir('O consultório do Dr. Marcello em São Paulo fica na R. Agostinho Rodrigues Filho, 550. Tem estacionamento.', 'O consultório do Dr. Marcello em São Paulo fica na R. Outra Rua, 10.')
  confere('"R." nao parte a frase', r.startsWith('O consultório do Dr. Marcello em São Paulo fica na R. Agostinho'), r)
}
// Paragrafo com duas frases de rascunho: a terceira, que a lista nao conhece, sai junto.
{
  const rascunho = 'Pelo contexto, a consulta é às 18:20. A situação da conversa mudou bastante. Preciso responder a pergunta.\nFicou às 18:20!'
  confere('paragrafo de rascunho leva a frase desconhecida', semNarracao(rascunho) === 'Ficou às 18:20!', semNarracao(rascunho))
}
{
  const c = claudeFalso([texto('Assim que a declaração ficar pronta, o combinado é a equipe te mandar por aqui. Atendemos sábado.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'atende sabado?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('promessa do documento sai', d.resultado.resposta === 'Atendemos sábado.', d.resultado.resposta)
}
// Critica (IA02-v1): a familia vai esperar; sai o que aceita esperar.
{
  const c = claudeFalso([texto('Entendo. Se ela vomitar de novo durante a noite, não espere. Descansem bem.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Obrigada! Então amanhã às 14:30 a gente vê com ele. Ela já tá dormindo, vou deixar ela descansar.', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('risco de vida, vai esperar: "nao espere a consulta" na frente', d.resultado.resposta.startsWith('🚨 Não espere a consulta'), d.resultado.resposta)
  confere('risco de vida, vai esperar: sem "se vomitar" e sem "descansem"', !/Se ela vomitar|Descansem/.test(d.resultado.resposta), d.resultado.resposta)
}
// Foto no risco de vida, a familia em casa (IA01-v2, IA02-v1).
{
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ anexo: true, texto: 'tirei foto do vomito pro dr ver amanha', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: claudeFalso([texto('nao devia')]).chamar,
    roboDireto: roboDireto({ resposta: '📎 Recebi o que você enviou.\n\nSe piorar, não espere a nossa resposta nem a consulta: procure o pronto-socorro mais próximo ou ligue 192.' }).fn,
  })
  confere('foto no risco de vida: pronto-socorro firme', d.resultado.resposta.startsWith('🚨') && !d.resultado.resposta.includes('Se piorar') && d.resultado.atencao === 'urgencia', JSON.stringify(d.resultado))
}
// "Vou levar agora" e ir ao pronto-socorro: a consulta pode ser marcada.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', para_familia: 'Combinado.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ta bom, vou levar agora. deixa marcado amanha?', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('indo ao pronto-socorro: marca', d.resultado.resposta.includes('ROBO('), d.resultado.resposta)
}
// "Avisei de novo" sem piora sai (IA02-v2).
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Avisei o Dr. Marcello de novo. Leve agora ao pronto-socorro.', resumo_para_equipe: 'Pilha.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'e agora?', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('sem piora: sem "avisei de novo"', !/de novo/.test(d.resultado.resposta), d.resultado.resposta)
}
// Irmao dito na conversa, sem o nome no campo (IA14).
{
  const f = ferramentasFalsas()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar' })])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'o irmão dela, o Lucas, dá pra marcar sexta?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('irmao dito: abre para outra crianca', f.feito.some(([q, t]) => q === 'robo' && /outra criança/.test(t)), JSON.stringify(f.feito))
}
// "Tambem" com consulta ja marcada: marcar mais uma (IA12-v1).
{
  const f = roboComEtapas({ inicio: 'ja_tem_consulta' })
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', dia: 'sábado' })])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'pode marcar a helena tambem, sabado em sp' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"tambem" com consulta marcada: marcar mais uma', f.chamadas.some(([t]) => t === '2'), JSON.stringify(f.chamadas))
}
// "19 e 20" e uma hora so (IA11-v2).
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena', unidade: 'Santos', dia: 'hoje' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'qro hj a noite msm, 19 e 20' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"19 e 20": segue com 19:20', d.resultado.resposta.includes('(19:20)'), d.resultado.resposta)
}
// Critica (IA05-v2): na piora, sai a consulta confirmada e o condicional; e o
// "agora" tem de estar na mesma frase do pronto-socorro.
for (const [nome, paraFamilia, proibido] of [
  ['piora: sem "esta confirmada" e sem o condicional', 'A consulta do Miguel de hoje às 15:10 está confirmada. Se ele ficar ainda mais molinho, procure o pronto-socorro agora. Avisei o Dr. Marcello agora.', /confirmada|Se ele ficar/],
  ['piora: "agora" fora da frase do pronto-socorro nao vale', 'Avisei o Dr. Marcello agora. O pronto-socorro mais próximo é o da Ana Costa.', null],
]) {
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: paraFamilia, resumo_para_equipe: 'Febre voltou.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'cheguei do ps e a febre voltou', historico: [{ de: 'familia', texto: 'é urgente, ele ta com 39 de febre' }], urgenciaAberta: true }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere(nome, d.resultado.resposta.startsWith('🚨 Se piorou') && !(proibido && proibido.test(d.resultado.resposta)), d.resultado.resposta)
}
// Rascunho com "na tela", "piora contada", "familia concordou".
confere('narracao rodada 10', semNarracao('A família concordou em ir. Leve agora ao pronto-socorro.') === 'Leve agora ao pronto-socorro.' && semNarracao('É só escolher o horário na tela a seguir. Combinado!') === 'Combinado!', semNarracao('É só escolher o horário na tela a seguir. Combinado!'))

// Rodada 11 do painel com IA.
// IA15-v2 (alta): "tipo 7 da noite" e a IA mandou 18:00 no meio da ficha. Vai a
// hora da familia, e o robo oferece os vizinhos.
{
  const feito = []
  const f = { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: '', horario: '18:00', para_familia: 'Às 19h não tem; o mais perto é 18:00.' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera, tem como ser mais tarde? tipo 7 da noite', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: hora da IA que a familia nao disse nao troca', !feito.some(([t]) => /18:00/.test(t)), JSON.stringify(feito))
  confere('ficha: vai a hora da familia', feito.some(([t]) => t === 'trocar para 19h'), JSON.stringify(feito))
}
{
  // Com minutos: "sete e vinte da noite" vai como 19:20, nao 07:20.
  const feito = []
  const f = { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: '', horario: '19:00' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'da p ser sete e vinte da noite?', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: "sete e vinte da noite" vai como 19:20', feito.some(([t]) => t === 'trocar para 19:20'), JSON.stringify(feito))
}
// IA11-v1: "sete e vinte da noite" e 19:20.
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena', unidade: 'Santos', dia: 'segunda', horario: '19:20' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'pode ser na segunda que vem, às sete e vinte da noite?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"sete e vinte da noite" vale 19:20', d.resultado.resposta.includes('(19:20)'), d.resultado.resposta)
}
// IA12-v2: "tb" e marcar mais uma.
{
  const f = roboComEtapas({ inicio: 'ja_tem_consulta' })
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Santos', dia: 'hoje' })])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'marca a helena tb hj, 17 e 20' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"tb" com consulta marcada: marcar mais uma', f.chamadas.some(([t]) => t === '2'), JSON.stringify(f.chamadas))
}
// IA02-v2 (alta): a volta do pronto-socorro contada pelo que fizeram la.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Que bom que já foram avaliados.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'voltamo, deram soro e pediram p ver c o gastro. tem horario semana q vem em sp?', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('volta do ps pelo soro: a agenda abre', !/não substitui|🚨/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA01-v1 (alta): a regra calou, mas nos ja mandamos ao pronto-socorro agora.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Santos', dia: 'sexta', para_familia: 'Combinado.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({
      texto: 'deixa marcado pra sexta de manha em santos, se ele ficar estranho eu corro pro hospital',
      historico: [{ de: 'familia', texto: 'ele ta esquisito desde que mexeu no controle' }, { de: 'consultorio', texto: '🚨 Leve agora ao pronto-socorro mais próximo ou ligue 192.' }],
      urgenciaAberta: true,
    }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('pronto-socorro agora ja dito: agenda fechada', /não substitui/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA01-v2: "a gente deixa marcado" e promessa; IA22-v2: "Combinado!" a um envio.
{
  const c = claudeFalso([texto('Podem ir agora ao pronto-socorro. O horário a gente deixa marcado para quarta.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ta bom, meu marido ta tirando o carro, vamo agr', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"a gente deixa marcado" sai', d.resultado.resposta === 'Podem ir agora ao pronto-socorro.', d.resultado.resposta)
}
{
  const c = claudeFalso([texto('Combinado! Pode mandar a foto do pedido por aqui mesmo.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'manda aqui quando tiver pronto' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"Combinado!" na frente sai', d.resultado.resposta === 'Pode mandar a foto do pedido por aqui mesmo.', d.resultado.resposta)
}
// IA01-v2: "vamo agr" e ida ao pronto-socorro, e a agenda abre.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Santos', dia: 'quarta', para_familia: 'Vão com calma.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'ta bom, vamo agr. marca p ele quarta a tarde em santos p dps', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('"vamo agr": a agenda abre', !/não substitui/.test(d.resultado.resposta), d.resultado.resposta)
}
// Rascunhos da rodada 11.
confere('narracao: paragrafo da IA08-v1 sai inteiro',
  semNarracao('A família pede um parecer. Devo acolher, explicar que a avaliação é do Dr. Marcello. Chamar a equipe seria redundante.\n\nEntendo a preocupação. Quem avalia é o Dr. Marcello, na consulta de hoje.') === 'Entendo a preocupação. Quem avalia é o Dr. Marcello, na consulta de hoje.',
  semNarracao('A família pede um parecer. Devo acolher, explicar que a avaliação é do Dr. Marcello. Chamar a equipe seria redundante.\n\nEntendo a preocupação. Quem avalia é o Dr. Marcello, na consulta de hoje.'))
confere('narracao: "O usuario... Preciso consultar a agenda" sai',
  semNarracao('O usuário perguntou se há horário no sábado. Preciso consultar a agenda.\n\nTem sim, aos sábados em São Paulo.') === 'Tem sim, aos sábados em São Paulo.',
  semNarracao('O usuário perguntou se há horário no sábado. Preciso consultar a agenda.\n\nTem sim, aos sábados em São Paulo.'))
confere('narracao: IA03-v1 sai',
  semNarracao('Não há risco de vida descrito, mas é uma criança abatida; vou confirmar a consulta que ela tem, sem oferecer outra. A consulta das 15h está confirmada.') === 'A consulta das 15h está confirmada.',
  semNarracao('Não há risco de vida descrito, mas é uma criança abatida; vou confirmar a consulta que ela tem, sem oferecer outra. A consulta das 15h está confirmada.'))
confere('narracao: conta de valores sai',
  semNarracao('Em São Paulo fica R$ 450,00 + R$ 150,00 = R$ 600,00. A consulta em São Paulo é R$ 600,00.') === 'A consulta em São Paulo é R$ 600,00.',
  semNarracao('Em São Paulo fica R$ 450,00 + R$ 150,00 = R$ 600,00. A consulta em São Paulo é R$ 600,00.'))
confere('narracao: "aqui mesmo nesta conversa" fica',
  semNarracao('Pode mandar aqui mesmo nesta conversa. A equipe confere.') === 'Pode mandar aqui mesmo nesta conversa. A equipe confere.',
  semNarracao('Pode mandar aqui mesmo nesta conversa. A equipe confere.'))
confere('narracao: paragrafo que comeca pela familia sai com a frase que a lista nao conhece',
  semNarracao('A família está preocupada com o cocô. Ela quer uma resposta hoje.\n\nEntendo. Quem avalia é o Dr. Marcello.') === 'Entendo. Quem avalia é o Dr. Marcello.',
  semNarracao('A família está preocupada com o cocô. Ela quer uma resposta hoje.\n\nEntendo. Quem avalia é o Dr. Marcello.'))
confere('narracao: "Preciso consultar a agenda" e "Devo acolher" saem',
  semNarracao('Preciso consultar a agenda. Aos sábados ele atende em São Paulo.') === 'Aos sábados ele atende em São Paulo.' &&
    semNarracao('Devo acolher e explicar. Quem avalia é o Dr. Marcello.') === 'Quem avalia é o Dr. Marcello.',
  semNarracao('Devo acolher e explicar. Quem avalia é o Dr. Marcello.'))
confere('narracao: so um paragrafo de terceiros nao some inteiro', semNarracao('A mãe quer saber o valor. O valor é R$ 450,00.') === 'O valor é R$ 450,00.', semNarracao('A mãe quer saber o valor. O valor é R$ 450,00.'))
// IA16-v2: "com ph" e correcao, que vai para a IA.
confere('"sophia com ph" e pergunta junto do passo', perguntaLateral('3 2 2024 ah eh sophia com ph'))
// IA09-v2: o texto solto junto de ver_horarios, na pergunta junto do passo, nao sai.
{
  const c = claudeFalso([usa('ver_horarios', { unidade: 'todas' }, 'O usuário perguntou se aceita cartão. Vou ver.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: '12/05/2021. e aceita cartao?', etapa: 'dados_nascimento' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Anotado! Qual é o nome do responsável?' }).fn,
  })
  confere('lateral: rascunho junto de ver_horarios nao sai', d.resultado.resposta === 'Anotado! Qual é o nome do responsável?', d.resultado.resposta)
}
// IA14-v1: "cancelou sozinho" nao vence a equipe chamada na mesma resposta.
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'sem_informacao', para_familia: 'O pedido do Pedro passei para a equipe.', resumo_para_equipe: 'Irmão Pedro, 2 anos.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pode sim. e da pra deixar esse horario pro irmao dela?', etapa: 'confirmar_cancelamento' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Consulta cancelada.', atencao: 'cancelou_sozinho' }).fn,
  })
  confere('etiqueta: a equipe vence o "cancelou sozinho"', d.resultado.atencao === 'atendente', JSON.stringify(d.resultado))
}

// Rodada 12 do painel com IA.
// IA19-v2: "oi qnto ta" e o menu com os valores da IA: os valores vao.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu', para_familia: 'Olá! A consulta em Santos é R$ 450,00 e em São Paulo, R$ 600,00.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'oi qnto ta' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('menu com valor: o valor vai, sem o "Ola"', d.resultado.resposta === 'A consulta em Santos é R$ 450,00 e em São Paulo, R$ 600,00.\n\nROBO(menu)', d.resultado.resposta)
}
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu', para_familia: 'Olá! Seja bem-vindo.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'oi bom dia' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('menu sem pergunta nem valor: so o menu', d.resultado.resposta === 'ROBO(menu)', d.resultado.resposta)
}
confere('"qnto" e pergunta', perguntaLateral('oi qnto ta'))
// IA20-v2: a autocorrecao com virgula, quando a pergunta tem valor.
confere('narracao: "R$ 450,00? Nao, ..." sai',
  semNarracao('A consulta lá é R$ 450,00? Não, em São Paulo é *R$ 600,00*.') === 'Em São Paulo é *R$ 600,00*.',
  semNarracao('A consulta lá é R$ 450,00? Não, em São Paulo é *R$ 600,00*.'))
confere('narracao: "Atende sabado? Nao, ..." sem valor fica',
  semNarracao('Atende sábado? Não, só em São Paulo.') === 'Atende sábado? Não, só em São Paulo.', semNarracao('Atende sábado? Não, só em São Paulo.'))
// IA18-v1 e IA19-v2: a tabela so vai na pergunta de preco, e so se ainda nao foi dita.
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'sem_informacao', para_familia: 'Sobre faltar, a equipe confirma e responde por aqui.', resumo_para_equipe: 'Falta.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'se eu marcar e n puder ir perco o valor?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"perco o valor?" nao traz a tabela', !/R\$/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'sem_informacao', para_familia: 'Sobre parcelar, a equipe confirma.', resumo_para_equipe: 'Parcelamento.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'qual o valor da consulta? da pra parcelar?', historico: [{ de: 'consultorio', texto: 'A consulta em Santos é R$ 450,00.' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('valor ja dito: nao repete a tabela', !/R\$/.test(d.resultado.resposta), d.resultado.resposta)
}

// IA03-v1 (alta, regressao da rodada 11): o aviso comum com "192" nao liga a
// trava de risco de vida, e a agenda abre.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', dia: 'hoje', para_familia: 'Vamos ver o mais cedo de hoje.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({
      texto: 'Sim, por favor. Hoje mesmo, no horário mais cedo que tiver aqui em São Paulo.',
      historico: [
        { de: 'familia', texto: 'é urgente, ele ta com dor de barriga desde cedo' },
        { de: 'consultorio', texto: '🚨 Entendo a preocupação. Já avisei o Dr. Marcello, que vai avaliar o que você contou e responder por aqui assim que possível.\n\nSe for uma emergência com risco de vida, procure o pronto-socorro mais próximo ou ligue 192.' },
      ],
      urgenciaAberta: true,
    }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('aviso comum com 192 nao fecha a agenda', !/não substitui|Pelo que você contou/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // A frase da propria trava nao religa a trava.
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Certo.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({
      texto: 'pode marcar sim, pra amanha',
      historico: [{ de: 'familia', texto: 'ele ta com dor' }, { de: 'consultorio', texto: '🚨 Pelo que você contou, a criança precisa ser avaliada agora: procure o pronto-socorro mais próximo ou ligue 192, sem esperar a consulta.' }],
      urgenciaAberta: true,
    }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('a frase da trava nao religa a trava', !/não substitui/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA02-v1 (alta): a volta contada em duas frases, e "acabou de voltar".
for (const texto of [
  'Voltamos agora. Deram soro, fizeram exame de sangue e liberaram a gente. Tem segunda à tarde em São Paulo?',
  'Mas a gente acabou de voltar do pronto-socorro. Pode ser segunda às 16:20?',
]) {
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Que bom que foram avaliados.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto, historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere(`volta do ps: "${texto.slice(0, 30)}" abre a agenda`, !/não substitui|🚨/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA13-v2 (alta): na lista de horarios, a IA mandou "18:00" para "n tem as 7
// msm?". Vai a hora da familia.
{
  const feito = []
  const f = { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: '18:00', para_familia: 'Às 19h não tem; vou deixar o das 18:00 selecionado.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'n tem as 7 msm?', etapa: 'aguardando_horario' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi qual horário.' }).fn,
  })
  confere('lista: a hora da IA que a familia nao disse nao vai', !feito.some(([t]) => t === '18:00'), JSON.stringify(feito))
  // "7h": o robo le as 7 e as 19 e fica com a mais perto da lista.
  confere('lista: vai a hora da familia', feito.some(([t]) => t === '7h') && d.resultado.resposta === 'ROBO(7h)', JSON.stringify(feito) + d.resultado.resposta)
}
// IA13-v2: sem hora da IA, a hora cheia da familia segue no pedido.
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena', unidade: 'Santos', dia: 'quarta' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'quarta q vem, umas 7 da noite tem?' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"umas 7 da noite": segue com 19h', d.resultado.resposta.includes('(19h)'), d.resultado.resposta)
}
// O valor da IA vai junto do menu mesmo sem pergunta reconhecida.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'menu', para_familia: 'Bom dia! A consulta em Santos é R$ 450,00.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'bom dia tudo bem' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('menu: o valor vai mesmo sem pergunta', d.resultado.resposta === 'A consulta em Santos é R$ 450,00.\n\nROBO(menu)', d.resultado.resposta)
}
// IA14-v2: recado para o medico sem "?" junto do passo vai para a IA.
confere('"avisa o dr" e pergunta junto do passo', perguntaLateral('isso cancela. e avisa o dr q ela parou c a dor dps q tirou o leite'))
// Rascunhos e promessas da rodada 12.
confere('narracao: conta com "mais" e "ou seja" sai',
  semNarracao('A consulta em São Paulo é R$ 450,00 mais R$ 150,00, ou seja, R$ 600,00. O horário de sábado é às 14:30.') === 'O horário de sábado é às 14:30.',
  semNarracao('A consulta em São Paulo é R$ 450,00 mais R$ 150,00, ou seja, R$ 600,00. O horário de sábado é às 14:30.'))
confere('narracao: "> Correcao:" sai',
  semNarracao('Tem sábado sim.\n\n> Correção: o valor da consulta em São Paulo é R$ 600,00 (não há soma de valores).') === 'Tem sábado sim.',
  semNarracao('Tem sábado sim.\n\n> Correção: o valor da consulta em São Paulo é R$ 600,00 (não há soma de valores).'))
confere('narracao: "Responda diretamente." sai', semNarracao('Responda diretamente. Não dá para esperar até amanhã.') === 'Não dá para esperar até amanhã.', semNarracao('Responda diretamente. Não dá para esperar até amanhã.'))
for (const [nome, frase] of [
  ['"vou deixar o agendamento aberto"', 'Vou deixar o agendamento aberto para quarta à tarde em Santos.'],
  ['"ja recebi os dados de cima"', 'Os dados que você mandou lá em cima eu também já recebi.'],
]) {
  const c = claudeFalso([texto(`${frase} Qual é o horário que prefere?`)])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'deixa marcado p quarta a tarde em santos' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere(`promessa ${nome} sai`, d.resultado.resposta === 'Qual é o horário que prefere?', d.resultado.resposta)
}
// IA15-v2: sem troca na ficha, a resposta do robo (os vizinhos) vai.
{
  const f = { ...ferramentasFalsas(), robo: async (t) => (t.startsWith('trocar para') ? { resposta: 'Às 19h não tem horário livre nesse dia. Os mais perto são 18:20 e 19:40: qual prefere?' } : { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: '', horario: '19:00' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera, da p ser mais tarde? tipo sete da noite', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha sem troca: os vizinhos vao', d.resultado.resposta.startsWith('Às 19h não tem horário livre'), d.resultado.resposta)
}
// IA15-v2 e IA24-v1: o nome no passo da data nao vai.
{
  const feito = []
  const f = { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: 'José Miguel Ramos' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'e as 7 n tem msm?', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: nome no passo da data nao vai ao robo', !feito.some(([t]) => /Miguel/.test(t)), JSON.stringify(feito))
}
// IA24-v2: o dia sem hora no meio da ficha nao vai como resposta da data.
{
  const feito = []
  const f = { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: 'sexta', dia: 'sexta', para_familia: 'Na sexta tem às 8:00 e 8:40.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'na vdd hj n da, tem sexta cedo?', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: o dia sem hora nao vai ao robo', !feito.some(([t]) => t === 'sexta'), JSON.stringify(feito))
  confere('ficha: o dia sem hora leva a resposta da IA', d.resultado.resposta.startsWith('Na sexta tem às 8:00 e 8:40.'), d.resultado.resposta)
}
// IA05 v1 e v2 (altas): "vou levar ele no pronto socorro agora... deixa marcado"
// e "ja to saindo c ele": indo ao pronto-socorro, a agenda abre.
for (const texto of [
  'vou levar ele no pronto socorro agora com meu marido. Mas deixa marcado às 15h',
  'ja to saindo c ele, so deixa marcado amanha pfv',
]) {
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Vão com calma.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto, historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere(`indo ao ps: "${texto.slice(0, 25)}" abre a agenda`, !/não substitui/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA08-v1 (alta): "Eu mesmo marco para voce agora" sem marcar chama a equipe.
{
  const c = claudeFalso([texto('Eu mesmo marco para você agora.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'Posso falar com uma pessoa da equipe pra marcar?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"eu mesmo marco" sem marcar chama a equipe', d.resultado.atencao === 'atendente' && !/marco para você/.test(d.resultado.resposta), JSON.stringify(d.resultado))
}
// IA05-v1: "Da sim para marcar" sai no risco de vida.
{
  const c = claudeFalso([texto('Dá sim para marcar o horário das 15:00. Leve agora ao pronto-socorro.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'nao da pra levar ele na consulta das 15h?', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('risco de vida: "Da sim para marcar" sai', !/Dá sim para marcar/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA05-v1: a trava de conduta nao le o "agora" da frase condicional.
{
  const c = claudeFalso([texto('Sobre as 5 gotas de paracetamol, quem orienta é o Dr. Marcello. Se ele ficar muito molinho, procure o pronto-socorro mais próximo agora.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'por favor so me fala se 5 gotas ta certo', historico: [{ de: 'familia', texto: 'é urgente, ele ta com febre de 38,5' }], urgenciaAberta: true }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('conduta: o "agora" condicional nao vira pronto-socorro firme', !/^🚨 Procure agora o pronto-socorro/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA07-v2: o historico da IA tem 24 mensagens (a ficha gastava dez das 16).
{
  const limites = []
  const cadeia = {
    select: () => cadeia, eq: () => cadeia, order: () => cadeia, in: () => cadeia, gte: () => cadeia,
    limit: (n) => (limites.push(n), Promise.resolve({ data: [], error: null })),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  const banco = { from: (tabela) => (tabela === 'whatsapp_messages' ? cadeia : { select: () => { throw new Error('sem banco no teste') } }) }
  await montarSituacao(banco, {
    clinicId: 'c1', conversationId: 'v1', texto: 'oi', anexo: false, etapa: null, criancas: [], consultas: [],
    quemAtende: 'o Dr. Marcello', agora: new Date('2026-10-19T13:00:00Z'), equipeConversando: false,
  })
  confere('historico da IA com 24 mensagens', limites[0] === 24, JSON.stringify(limites))
}
// Rodada 13 (IA12): com o Theo e a Helena marcados, "o do theo passa pra 8h?"
// escolhe a consulta do Theo e segue ate o horario, sem a lista no meio.
{
  const chamadas = []
  let etapa = null
  const f = {
    ...ferramentasFalsas(),
    etapa: async () => etapa,
    robo: async (t, modo) => {
      chamadas.push(t)
      if (t === '4') { etapa = 'minha_consulta'; return { resposta: 'Você tem 2 consultas marcadas: 1 Helena, 2 Theo.' } }
      if (etapa === 'minha_consulta' && t === '2') return { resposta: 'Sua consulta: Theo, sex 23/10 09:20. Digite CANCELAR ou REMARCAR.' }
      if (etapa === 'minha_consulta' && t === 'remarcar') { etapa = 'confirmar_cancelamento'; return { resposta: 'Responda SIM.' } }
      if (etapa === 'confirmar_cancelamento' && t === 'sim') { etapa = 'aguardando_dia'; return { resposta: 'Datas.' } }
      if (etapa === 'aguardando_dia' && modo === 'atual') { etapa = 'aguardando_horario'; return { resposta: `Horários de ${t}.` } }
      if (etapa === 'aguardando_horario' && modo === 'atual') return { resposta: `Remarcada para ${t}.` }
      return { resposta: `ROBO(${t})` }
    },
  }
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'remarcar', paciente: 'Theo', dia: 'sexta', horario: '08:00' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'pensando bem o do theo passa pra 8h da msm sexta?', criancas: ['Helena', 'Theo'], consultas: ['sex, 23/10 08:40 · Santos · Helena', 'sex, 23/10 09:20 · Santos · Theo'] }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('remarcar com dois irmaos: escolhe a do Theo', JSON.stringify(chamadas) === JSON.stringify(['4', '2', 'remarcar', 'sim', 'sexta', '08:00']), JSON.stringify(chamadas))
  confere('remarcar com dois irmaos: chega ao horario', d.resultado.resposta.endsWith('Remarcada para 08:00.'), d.resultado.resposta)
}
// Rodada 13 do painel com IA.
const roboQueAnota = () => {
  const feito = []
  return { feito, f: { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) } }
}
// IA21-v2 (alta): a hora recusada nao conta, e a hora da familia vai.
{
  const { feito, f } = roboQueAnota()
  const c = claudeFalso([usa('responder_etapa', { texto: '', horario: '11:20', para_familia: 'Às 11:30 não tem, o mais próximo é 11:20, e já troquei para ele.' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera muda pra 11 e meia, 10h n da', etapa: 'dados_responsavel' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: a hora recusada nao conta', feito.some(([t]) => t === 'trocar para 11:30'), JSON.stringify(feito))
}
// IA21-v2: "ja troquei" sai quando nada foi trocado.
{
  const c = claudeFalso([usa('responder_etapa', { texto: '', para_familia: 'Às 11:30 não tem. Já troquei para as 11:20.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'n da as 10, outro horario?', etapa: 'dados_responsavel' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: "ja troquei" sem troca sai', !/troquei/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA21-v1: a hora de sair do trabalho nao e a escolhida.
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena', unidade: 'São Paulo', dia: 'hoje' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'tem hoje mais pro fim do dia? eu saio do trabalho as cinco e meia' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('a hora da saida do trabalho nao vai como horario', !/17:30|05:30|5 e 30/.test(JSON.stringify(f.chamadas)), JSON.stringify(f.chamadas) + d.resultado.resposta)
}
// IA24-v2: o dia sem hora vence a trava do texto da familia.
{
  const c = claudeFalso([usa('responder_etapa', { texto: 'São Paulo', dia: 'sábado, 24/10', para_familia: 'No sábado, 24/10, tem 14:30, 15:10 e 15:50 em São Paulo.' })])
  const f = ferramentasFalsas()
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'na vdd segunda n da, tem sabado a tarde?', etapa: 'dados_nascimento' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: o dia com horarios chega, sem equipe', d.resultado.resposta.startsWith('No sábado, 24/10') && !f.feito.some(([q]) => q === 'equipe'), d.resultado.resposta)
}
// IA16-v2: pergunta que nao e de agenda, com o texto da IA recusado: vai a resposta.
{
  const c = claudeFalso([usa('responder_etapa', { texto: 'Sofia Ramos', para_familia: 'Em São Paulo tem estacionamento conveniado no prédio.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera, tem lugar p estacionar la em sp?', etapa: 'dados_nascimento' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha recusada com pergunta: vai a resposta', d.resultado.resposta.startsWith('Em São Paulo tem estacionamento'), d.resultado.resposta)
}
// IA21-v1: os dois mais perto vao junto da lista.
{
  let etapa = null
  const f = {
    ...ferramentasFalsas(),
    etapa: async () => etapa,
    robo: async (t, modo) => {
      if (t === 'quero marcar uma consulta') { etapa = 'aguardando_unidade'; return { resposta: 'Em qual unidade?' } }
      if (etapa === 'aguardando_unidade') { etapa = 'aguardando_dia'; return { resposta: 'Datas.' } }
      if (etapa === 'aguardando_dia') { etapa = 'aguardando_horario'; return { resposta: 'Horários de hoje: 17:00, 17:40.' } }
      if (etapa === 'aguardando_horario') return { resposta: 'Às 17:30 não tem horário livre nesse dia. Os mais perto são 17:00 e 17:40.' }
      return { resposta: `ROBO(${t})` }
    },
  }
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Santos', dia: 'hoje', horario: '17:30' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'hoje as 17:30 em santos' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('os mais perto vao junto da lista', d.resultado.resposta.includes('Horários de hoje') && d.resultado.resposta.includes('Os mais perto são'), d.resultado.resposta)
}
// IA17-v1: a data que veio junto do nome segue com ele.
{
  const { feito, f } = roboQueAnota()
  const c = claudeFalso([usa('responder_etapa', { texto: 'Laura Martins Prado' })])
  await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Pode ser às 15:20, sim. O nome dela é Laura Martins Prado, nasceu em 14/02/2019.', etapa: 'dados_nome' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha: a data vai junto do nome', feito.some(([t]) => t === 'Laura Martins Prado, nasceu 14/02/2019'), JSON.stringify(feito))
}
// IA02-v1: o preco perguntado vai junto da agenda.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', dia: 'segunda', para_familia: 'Aqui estão os horários de segunda.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'Tem segunda à tarde em São Paulo? E quanto custa?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('agendar com preco perguntado: o valor vai', d.resultado.resposta.includes('R$ 450,00'), d.resultado.resposta)
}
confere('narracao: "R$ 450,00? Nao." com ponto sai', semNarracao('A consulta é R$ 450,00? Não. Em São Paulo é R$ 600,00.') === 'Em São Paulo é R$ 600,00.', semNarracao('A consulta é R$ 450,00? Não. Em São Paulo é R$ 600,00.'))
confere('narracao: "Pelas regras..." sai', semNarracao('Pelas regras, pergunta hipotética não é piora. Se vier mais sangue, é pronto-socorro.') === 'Se vier mais sangue, é pronto-socorro.', semNarracao('Pelas regras, pergunta hipotética não é piora. Se vier mais sangue, é pronto-socorro.'))
confere('"conta pro dr" e pergunta junto do passo', perguntaLateral('sim pode. e conta pro dr q dps q tiramo o leite ela n teve mais dor'))
// IA08-v2: "o Dr. Marcello sabe que..." sem nada ter ido ao medico chama a equipe.
{
  const c = claudeFalso([texto('O Dr. Marcello sabe que a Laura está bem.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'e o aviso q mandaram p medico? ela ta bem, n precisa preocupa ele' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"o Dr. sabe" chama a equipe', d.resultado.atencao === 'atendente' && !/sabe que/.test(d.resultado.resposta), JSON.stringify(d.resultado))
}
// IA02-v2 (alta): "acabamo d volta do ps" abre a agenda; "a febre voltou, nao quero ir pro ps" nao.
for (const [texto, abre] of [
  ['acabamo d volta do ps, ela ta bem, liberaram. marca seg a tarde em sp p ela', true],
  ['estamos indo agora. marca seg a tarde em sp p ela', true],
  ['a febre voltou, nao quero ir pro ps. marca seg a tarde em sp', false],
]) {
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Certo.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto, historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere(`ps: "${texto.slice(0, 25)}" ${abre ? 'abre' : 'nao abre'} a agenda`, /não substitui/.test(d.resultado.resposta) !== abre, d.resultado.resposta)
}
// IA02-v2 (critica numa conversa julgada): com a IA fora, risco de vida nao recebe o botao de marcar.
{
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'n quero leva no ps agr de madrugada, marca seg sp p ela', historico: DA_PILHA }),
    ferramentas: ferramentasFalsas(), chamar: async () => { throw new Error('prazo esgotado') },
    roboDireto: roboDireto({ resposta: '📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*.' }).fn,
  })
  confere('IA fora no risco de vida: pronto-socorro, sem botao de marcar', /pronto-socorro mais próximo/.test(d.resultado.resposta) && !/Marcar uma consulta/.test(d.resultado.resposta) && d.resultado.atencao === 'urgencia', JSON.stringify(d.resultado))
}
// IA07-v1: "e se vier mais sangue, faco o que?" mantem o pronto-socorro condicional.
{
  const c = claudeFalso([texto('Se vier mais sangue, procure o pronto-socorro mais próximo. A consulta de quarta continua marcada.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'E se vier mais sangue até a hora da consulta, faço o quê?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('pergunta "e se... faco o que": o pronto-socorro fica', /pronto-socorro/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA06-v2: "se doer mt eu dou oq? o buscopan" e sintoma (sexta 23h): o pronto-socorro fica.
{
  const c = claudeFalso([texto('Sobre remédio, quem orienta é o Dr. Marcello. Se a dor ficar forte, procure o pronto-socorro mais próximo.')])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'e ate segunda se doer mt eu dou oq? o buscopan msm?', agora: new Date('2026-10-17T02:00:00Z') }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('"se doer... buscopan" fora do horario: o pronto-socorro fica', /pronto-socorro/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA21: a frase que sobra do "Combinado, ..." comeca com maiuscula.
{
  const c = claudeFalso([texto('Combinado, a consulta da Laura fica na quarta às 15:20.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ok obrigada' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('depois do "Combinado," vem maiuscula', d.resultado.resposta === 'A consulta da Laura fica na quarta às 15:20.', d.resultado.resposta)
}
// IA16-v1 (rodada 13): "Santos, como eu falei. Sexta de manha." segue com o dia.
for (const [frase, esperado] of [['Santos, como eu falei. Sexta de manhã.', 'sexta'], ['santos. hoje n da', null]]) {
  const f = roboComEtapas({ inicio: 'aguardando_unidade' })
  await f.robo('quero marcar uma consulta', 'nenhuma')
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: frase, etapa: 'aguardando_unidade' }),
    ferramentas: f, chamar: claudeFalso([texto('?')]).chamar,
    roboDireto: async () => f.robo('Santos', 'atual'),
  })
  const comODia = f.chamadas.some(([t, m]) => t === esperado && m === 'atual')
  confere(`unidade e dia na mesma frase: "${frase.slice(0, 20)}"`, esperado ? comODia && d.resultado.resposta.includes('⏰ Horários de sexta') : !f.chamadas.some(([t]) => t === 'hoje'), JSON.stringify(f.chamadas) + d.resultado.resposta)
}
// Rodada 14.
// IA11-v2 (alta): a hora da IA recusada nao apaga a hora da familia.
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena', unidade: 'Santos', dia: 'segunda', horario: '19:20' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'seg q vem umas 7 da noite' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('hora da IA recusada: vai a hora da familia', d.resultado.resposta.includes('(19h)'), d.resultado.resposta)
}
{
  const c = claudeFalso([texto('O mais perto das 19h é 19:20, e já deixei ele selecionado para você. Qualquer dúvida, estou aqui.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'seg q vem umas 7 da noite tem?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"ja deixei ele selecionado" sai', !/selecionado/.test(d.resultado.resposta), d.resultado.resposta)
}
// IA12 v1 e v2: o nome da crianca no texto escolhe a consulta, sem o campo paciente.
{
  const chamadas = []
  let etapa = null
  const f = {
    ...ferramentasFalsas(),
    etapa: async () => etapa,
    robo: async (t, modo) => {
      chamadas.push(t)
      if (t === '4') { etapa = 'minha_consulta'; return { resposta: 'Você tem 2 consultas.' } }
      if (etapa === 'minha_consulta' && t === '2') return { resposta: 'Sua consulta: Theo.' }
      if (etapa === 'minha_consulta' && t === 'remarcar') { etapa = 'confirmar_cancelamento'; return { resposta: 'Responda SIM.' } }
      if (etapa === 'confirmar_cancelamento' && t === 'sim') { etapa = 'aguardando_dia'; return { resposta: 'Datas.' } }
      return { resposta: `ROBO(${t})` }
    },
  }
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'remarcar' })])
  await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'vixe o do theo passa pras 10? ele tem natacao cedo', criancas: ['Helena', 'Theo'], consultas: ['sex, 23/10 08:40 · Santos · Helena', 'sex, 23/10 09:20 · Santos · Theo'] }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('remarcar: a crianca do texto escolhe a consulta', chamadas.slice(0, 3).join(',') === '4,2,remarcar', JSON.stringify(chamadas))
}
// IA18-v1: "pode ser" a hora da pergunta, com outras horas na mensagem.
{
  const f = roboDoAgendamento()
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', paciente: 'Helena', unidade: 'Santos', dia: 'sexta', horario: '09:20' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'pode ser', ultimaDoConsultorio: 'Na sexta em Santos tem 08:00, 08:40, 09:20 e 10:00. O mais perto das 9h é o das 09:20. Quer que eu marque esse?' }),
    ferramentas: f, chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('"pode ser" a hora da pergunta', d.resultado.resposta.includes('(09:20)'), d.resultado.resposta)
}
// IA15-v2: "n tem mais tarde? eu saio do servico as 18" leva a resposta da IA.
{
  const c = claudeFalso([usa('responder_etapa', { texto: 'Bernardo Costa', para_familia: 'Nesse dia o último horário é 18:00.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'pera, n tem mais tarde? eu saio do serviço as 18', etapa: 'dados_nascimento' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('"n tem mais tarde?" leva a resposta da IA', d.resultado.resposta.startsWith('Nesse dia o último horário é 18:00.'), d.resultado.resposta)
}
// IA16-v2 (alta): a mesma frase da equipe nao se repete em ciclo.
{
  const c = claudeFalso([usa('responder_etapa', { texto: 'São Paulo', para_familia: 'Em São Paulo tem segunda.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'q pedido? eu qro trocar p sp, segunda a noite. tem ou n?', etapa: 'dados_nome', ultimaDoConsultorio: 'Passei o seu pedido para a nossa equipe, que confirma por aqui.\n\nPara continuar o cadastro, é só responder a pergunta acima 👆' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn,
  })
  confere('ficha recusada duas vezes: sem a mesma frase', !/^Passei o seu pedido/.test(d.resultado.resposta) && /escreva o dia e a hora/.test(d.resultado.resposta), d.resultado.resposta)
}
// Rodada 14, IA01 a IA04.
{
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Que bom que ela está bem.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ja tamo d volta, liberaram ela do ps, era gastrite. tem seg a tarde em sp?', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"ja tamo d volta" abre a agenda', !/não substitui/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // IA02-v2 (alta): o pronto-socorro agora da IA tira a oferta de horario dela.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Leve a Helena agora ao pronto-socorro mais próximo. O horário mais próximo com ele é sábado (24/10) às 14:30.', resumo_para_equipe: 'Borra.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ela vomitou de novo, ta abatida. da p espera ate seg?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('pronto-socorro agora da IA: sem oferta de horario', !/14:30/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // IA02-v1: indo ao pronto-socorro, a pergunta da consulta e respondida.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Isso, leve agora. A consulta de segunda continua de pé.', resumo_para_equipe: 'Indo ao PS.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'vou levar ela de volta agora. A consulta de segunda continua de pé?', historico: DA_PILHA }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('indo ao ps: a consulta de segunda e respondida', /continua de pé/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // IA03-v1: o preco da mensagem anterior, sem R$ dito depois.
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'São Paulo', para_familia: 'Vamos ver os horários.' })])
  const d = await atenderComAssistente({
    modo: 'ligado', situacao: situacao({ texto: 'Marcar uma consulta', historico: [{ de: 'familia', texto: 'é urgente? E quanto é a consulta?' }, { de: 'consultorio', texto: 'Entendo. Quer marcar?' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('preco da mensagem anterior vai junto', d.resultado.resposta.includes('R$ 450,00'), d.resultado.resposta)
}
confere('narracao: "R$ 450,00... desculpe, o valor correto e" sai',
  semNarracao('A consulta é R$ 450,00… desculpe, o valor correto é R$ 600,00.') === 'A consulta é R$ 600,00.',
  semNarracao('A consulta é R$ 450,00… desculpe, o valor correto é R$ 600,00.'))
confere('narracao: "Vou confirmar a consulta, dizer que a equipe..." sai',
  semNarracao('Vou confirmar a consulta, dizer que a equipe já está com a mensagem e manter o pronto-socorro apenas como orientação se piorar. A consulta das 15h está confirmada.') === 'A consulta das 15h está confirmada.',
  semNarracao('Vou confirmar a consulta, dizer que a equipe já está com a mensagem e manter o pronto-socorro apenas como orientação se piorar. A consulta das 15h está confirmada.'))
// Rodada 14, IA05 a IA08.
{
  // IA08-v1 e IA07-v2 (altas): a pergunta hipotetica nao vira alerta ao medico.
  const c = claudeFalso([usa('chamar_equipe', { motivo: 'urgencia', para_familia: 'Se ela ficar molinha de noite, procure o pronto-socorro mais próximo.', resumo_para_equipe: 'Pergunta.' })])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'Se acontecer depois das 18h, eu levo no pronto-socorro ou espero a consulta?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('hipotetica: sem urgencia', d.resultado.atencao !== 'urgencia', JSON.stringify(d.resultado))
  confere('hipotetica: o pronto-socorro condicional fica', /pronto-socorro/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // IA08-v2 (alta): sexta 23h, "se ela ficar molinha... faco oq?" mantem o pronto-socorro.
  const c = claudeFalso([texto('Quem orienta é o Dr. Marcello. Se ela ficar molinha ou não quiser mamar, procure o pronto-socorro.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'e se de madrugada ela ficar molinha ou n quiser mamar, faço oq?', agora: new Date('2026-10-17T02:00:00Z') }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('molinha a noite: o pronto-socorro fica', /pronto-socorro/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // IA05-v2 (alta): "agora e madrugada, o mais seguro e leva-lo ao pronto-socorro" nao fecha a agenda.
  const c = claudeFalso([usa('abrir_fluxo', { fluxo: 'agendar', unidade: 'Telemedicina', para_familia: 'Certo.' })])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({
      texto: 'ta bom. qro marca o video d segunda 18h p ele', urgenciaAberta: true,
      historico: [{ de: 'familia', texto: 'ele ta com febre' }, { de: 'consultorio', texto: 'Como agora é madrugada, o mais seguro é levá-lo ao pronto-socorro se a febre não baixar.' }],
    }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('"agora e madrugada" nao e ordem de ir', !/não substitui/.test(d.resultado.resposta), d.resultado.resposta)
}
{
  const c = claudeFalso([texto('Passei para a equipe e para o Dr. Marcello que a febre baixou.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'avisa ele q passou?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"e para o Dr." sai', !/para o Dr\./.test(d.resultado.resposta), d.resultado.resposta)
}
{
  // IA07-v2: o "[cpf]" da IA volta ao CPF que a familia escreveu.
  const feito = []
  const f = { ...ferramentasFalsas(), robo: async (t, etapa) => (feito.push([t, etapa]), { resposta: `ROBO(${t})` }) }
  const c = claudeFalso([usa('responder_etapa', { texto: '[cpf]' })])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'ela n tem ainda. coloca o meu? 529.982.247-25', etapa: 'dados_cpf' }), ferramentas: f, chamar: c.chamar, roboDireto: roboDireto({ resposta: 'Não entendi isso como resposta.' }).fn })
  confere('"[cpf]" volta ao CPF da familia', feito.some(([t]) => t === '529.982.247-25'), JSON.stringify(feito))
}
{
  // IA07-v2: "oq eu faco" de dia, com sintoma, mantem o pronto-socorro condicional.
  const c = claudeFalso([texto('Se vier mais sangue, procure o pronto-socorro mais próximo. A consulta de quarta continua marcada.')])
  const d = await atenderComAssistente({ modo: 'ligado', situacao: situacao({ texto: 'obg. e se tiver mais sangue ate quarta, oq eu faço?' }), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('"oq eu faco": o pronto-socorro fica', /pronto-socorro/.test(d.resultado.resposta), d.resultado.resposta)
}
confere('narracao: "A Camila esta dizendo que..." sai', semNarracao('A Camila está dizendo que a bebê está ótima. Que bom saber que ela está bem!') === 'Que bom saber que ela está bem!', semNarracao('A Camila está dizendo que a bebê está ótima. Que bom saber que ela está bem!'))
// IA22-v2 (alta): "Combinado!" sozinho depois dos cortes.
{
  const c = claudeFalso([texto('Combinado! A equipe já está com a sua mensagem e com a data de segunda, e responde por aqui.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'fechado entao, qnd o dr assinar manda aki q eu imprimo', historico: [{ de: 'consultorio', texto: 'A equipe já está com a sua mensagem e com a data de segunda, e responde por aqui.' }] }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn,
  })
  confere('"Combinado!" sozinho chama a equipe de verdade', d.resultado.resposta === 'Passei para a nossa equipe, que confirma isso e responde por aqui.' && d.resultado.atencao === 'atendente', JSON.stringify(d.resultado))
}
confere('narracao: "voce recebe nesta conversa" fica', semNarracao('Quando o relatório sair, você recebe nesta conversa.') === 'Quando o relatório sair, você recebe nesta conversa.', semNarracao('Quando o relatório sair, você recebe nesta conversa.'))

// Conversa real de 18/10/2026: "Ele atende convenios?" na escolha da unidade.
// A IA reescreveu a pergunta da unidade com os valores e sem os horarios livres.
// Agora ela responde so a duvida, e embaixo vai a tela do robo, igual.
{
  const telaDaUnidade = '📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?\n\n*1* Livance · Santos (70 horários livres)\n*2* Livance Ibirapuera - São Paulo (53 horários livres)\n\nResponda com o número.'
  const lista = { rotulo: 'Escolher a unidade', linhas: [{ id: '1', titulo: 'Santos' }, { id: '2', titulo: 'São Paulo' }] }
  const doRobo = { resposta: `Não atendemos convênio: a consulta é particular.\n\n${telaDaUnidade}`, tela: telaDaUnidade, lista }
  const c = claudeFalso([texto('A consulta é particular, e emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'Ele atende convênios?', etapa: 'aguardando_unidade', ultimaDoConsultorio: telaDaUnidade }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto(doRobo).fn, roboNaoEntendeuAgora: () => true,
  })
  confere('convenio no passo: a duvida e a tela do robo', d.origem === 'ia' && d.resultado.resposta === `A consulta é particular, e emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n${telaDaUnidade}`, d.resultado.resposta)
  confere('convenio no passo: a lista tocavel do robo vai junto', d.resultado.lista === lista && !('tela' in d.resultado), JSON.stringify(d.resultado))
  confere('convenio no passo: so a ferramenta da equipe', c.chamadas.length === 1 && c.chamadas[0].tools?.length === 1 && c.chamadas[0].tools[0].name === 'chamar_equipe', JSON.stringify(c.chamadas[0]?.tools?.map((t) => t.name) ?? null))
  confere('convenio no passo: a IA sabe que a tela vai de novo e que valor so se perguntarem', textoDoSistema(c.chamadas[0]).includes('em vez de responder, fez uma pergunta') && textoDoSistema(c.chamadas[0]).includes('Valor da consulta só se ela perguntou'), textoDoSistema(c.chamadas[0]).slice(-600))
}
{
  // Sem a tela separada, vale o "Responda..." do fim da resposta do robo.
  const c = claudeFalso([texto('Tem sim, o prédio tem estacionamento.')])
  const d = await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'tem estacionamento?', etapa: 'aguardando_dia' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar,
    roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número do dia da lista acima.', botoes: [{ id: 'VOLTAR', titulo: 'Outra unidade' }] }).fn,
  })
  confere('pergunta no passo sem tela separada: a instrucao do robo vai embaixo', d.resultado.resposta === 'Tem sim, o prédio tem estacionamento.\n\nResponda com o número do dia da lista acima.' && d.resultado.botoes?.length === 1, d.resultado.resposta)
}
{
  // Pedido de mudanca nao e duvida: segue a IA de conversa, com as ferramentas.
  const c = claudeFalso([texto('Claro!')])
  await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'da pra trocar pra São Paulo?', etapa: 'aguardando_dia' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar,
    roboDireto: roboDireto({ resposta: 'Não entendi. Responda com o número do dia da lista acima.' }).fn,
  })
  confere('pedido de troca no passo: IA de conversa com as ferramentas', (c.chamadas[0]?.tools?.length ?? 0) > 1, JSON.stringify(c.chamadas[0]?.tools?.map((t) => t.name) ?? null))
}
{
  // Sintoma no passo tambem fica com a IA de conversa.
  const c = claudeFalso([texto('Entendo.')])
  await atenderComAssistente({
    modo: 'ligado',
    situacao: situacao({ texto: 'ele ta com febre, posso dar dipirona?', etapa: 'aguardando_unidade' }),
    ferramentas: ferramentasFalsas(), chamar: c.chamar,
    roboDireto: roboDireto({ resposta: 'Essa é uma avaliação para a consulta.\n\nResponda com o número da unidade.' }).fn, roboNaoEntendeuAgora: () => true,
  })
  confere('sintoma no passo: IA de conversa', (c.chamadas[0]?.tools?.length ?? 0) > 1, JSON.stringify(c.chamadas[0]?.tools?.map((t) => t.name) ?? null))
}
{
  const c = claudeFalso([texto('oi')])
  await atenderComAssistente({ modo: 'ligado', situacao: situacao(), ferramentas: ferramentasFalsas(), chamar: c.chamar, roboDireto: roboDireto().fn })
  confere('regra geral: valor so quando perguntam', textoDoSistema(c.chamadas[0]).includes('Valor da consulta só quando a família perguntar'))
  // Real 19/10/2026: "infelizmente nao consigo, pensei que atendesse plano".
  const sistema = textoDoSistema(c.chamadas[0])
  confere('desistencia pelo convenio: reembolso, plano, Instagram e porta aberta', sistema.includes('Desistência por causa do convênio ou do plano') && sistema.includes('perguntar quanto eles reembolsam') && sistema.includes('o Instagram do consultório, se estiver em <clinica>') && sistema.includes('não pergunte se quer marcar'))
  confere('desistencia pelo convenio: a despedida curta abre a excecao', sistema.includes('A exceção é quem desiste por causa do convênio'))
  confere('desistencia pelo convenio: exemplo sem prometer quanto reembolsa', sistema.includes('pensei que atendesse plano de saúde') && sistema.includes('perguntar quanto eles reembolsam dessa consulta') && !/reembolsa(m)? (o valor )?(total|tudo)/.test(sistema))
}

console.log(`assistente: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
