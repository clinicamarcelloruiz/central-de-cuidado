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
  confere('instrucao: sem prazo da equipe', textoDoSistema(c.chamadas[0]).includes('nunca "responde hoje"'))
}

console.log(`assistente: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
