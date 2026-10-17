// Robo do Instagram (16/10/2026): direct e comentarios. Ver supabase/functions/_shared/instagram.ts.
// Nomes, numeros e textos inventados (o repositorio e publico).
import {
  FRASE_DO_LINK,
  codigoDaVolta,
  comentarioAindaRespondivel,
  comentarioEPergunta,
  comentarioPedeContato,
  comentariosParaImportar,
  enderecoDoLogin,
  permissoesQueFaltam,
  voltaPermitida,
  conhecimentoParaOInstagram,
  dentroDaJanela,
  linkDoWhatsApp,
  respostaDoFluxo,
  respostaPrivadaAoComentario,
  respostaPublicaAoComentario,
  responderDirect,
  semFormatacaoDoWhatsApp,
  semInstrucoesDoRobo,
  separarComentariosDaBusca,
  tokenPrecisaRenovar,
} from './instagram.build.mjs'

let ok = 0
let falhas = 0
function confere(nome, cond, detalhe) {
  if (cond) ok++
  else {
    falhas++
    console.error('FALHOU:', nome, detalhe ?? '')
  }
}

const VALOR =
  '💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' +
  '⚡ *Agendar por aqui é mais rápido*: digite *2* e escolha unidade, dia e horário na hora.\n\n' +
  '🙋 Quer falar com alguém da equipe? Digite *9*.'
const CTX = {
  saudacao: 'Olá! 👋 Aqui é o consultório do Dr. Teste, Gastroenterologista Pediátrico.',
  medico: 'o Dr. Teste',
  whatsapp: '5513999990000',
  respostas: [
    { id: 'r1', assunto: 'Valor e pagamento', palavras: ['valor', 'quanto', 'custa', 'preco', 'pagamento'], resposta: VALOR, perguntarUnidade: false },
    { id: 'r2', assunto: 'Convênios', palavras: ['convenio', 'unimed', 'plano'], resposta: 'A consulta é particular, com recibo para reembolso.', perguntarUnidade: false },
  ],
  unidades: [
    { nome: 'Unidade Centro', endereco: 'Rua Exemplo, 10 - Santos', texto: 'Consulta: R$ 450,00.' },
    { nome: 'Unidade Norte', endereco: 'Av. Inventada, 200 - São Paulo', texto: 'Consulta: R$ 600,00.' },
  ],
  tele: 'Consulta por vídeo. Pagamento por pix.',
  primeiraVez: false,
  horarioDaEquipe: 'de segunda a sexta, das 8h às 18h',
}
const LINK = linkDoWhatsApp(CTX.whatsapp)

// ---------------------------------------------------------------- link
confere('link com a frase pronta', LINK === `https://wa.me/5513999990000?text=${encodeURIComponent(FRASE_DO_LINK)}`, LINK)
confere('frase do link e a testada no simulador', FRASE_DO_LINK === 'Olá! Vim pelo Instagram e quero agendar uma consulta.')

// ---------------------------------------------------------------- urgencia antes de tudo
{
  const r = responderDirect('socorro, é urgente, meu filho está muito mal', null, CTX)
  confere('urgencia vai para a equipe', r.atencao === 'urgencia', JSON.stringify(r))
  confere('urgencia manda pronto-socorro e 192', /pronto-socorro/.test(r.texto) && /192/.test(r.texto), r.texto)
  const r2 = responderDirect('socorro, é urgente', 'agendar', CTX)
  confere('urgencia ganha do botao', r2.atencao === 'urgencia', JSON.stringify(r2))
  // Sinal de alarme sem a palavra (17/10/2026): no direct tambem.
  const r3 = responderDirect('meu filho engoliu uma bateria', null, CTX)
  confere('sinal de alarme no direct vira urgencia', r3.atencao === 'urgencia' && /192/.test(r3.texto), JSON.stringify(r3))
  confere('coco molinho no direct nao e urgencia', responderDirect('o cocô dele está molinho', null, CTX).atencao !== 'urgencia')
  confere('risco de vida no direct: pronto-socorro primeiro', /^🚨[^\n]*pronto-socorro/.test(r3.texto), r3.texto)
  const r4 = responderDirect('ele não para de vomitar', null, CTX)
  confere('urgente no direct: medico avisado e link para marcar', r4.atencao === 'urgencia' && r4.texto.includes('Já avisei o médico') && r4.texto.includes('wa.me/'), r4.texto)
  confere('urgente no direct: pronto-socorro so no fim', !/pronto-socorro/.test(r4.texto.split('\n')[0]) && /risco de vida/.test(r4.texto), r4.texto)
}

// ---------------------------------------------------------------- agendar = link do WhatsApp
{
  const r = responderDirect('Agendar consulta', 'agendar', CTX)
  confere('botao agendar manda o link', r.texto.includes(LINK) && r.acao === 'agendar', r.texto)
  const r2 = responderDirect('quero marcar uma consulta pro meu filho', null, CTX)
  confere('pedido escrito de agendamento manda o link', r2.texto.includes(LINK), r2.texto)
  const r3 = responderDirect('Agendar consulta', null, CTX)
  confere('texto igual ao botao conta como botao', r3.acao === 'agendar', JSON.stringify(r3))
  confere('agendar nao chama a equipe', !r.atencao)
}

// ---------------------------------------------------------------- respostas prontas sem "digite"
{
  const r = responderDirect('quanto custa a consulta?', null, CTX)
  confere('valor responde a resposta pronta', /R\$ 450,00/.test(r.texto), r.texto)
  confere('sem as instrucoes do robo do WhatsApp', !/digite/i.test(r.texto), r.texto)
  confere('oferece agendar depois do valor', (r.opcoes ?? []).includes('agendar'), JSON.stringify(r.opcoes))
  const b = responderDirect('Valores e convênio', 'valores', CTX)
  confere('botao valores responde o valor sem "digite"', /R\$ 450,00/.test(b.texto) && !/digite/i.test(b.texto), b.texto)
  const c = responderDirect('vocês aceitam unimed?', null, CTX)
  confere('convenio responde a resposta pronta', /particular/.test(c.texto), c.texto)
  confere('semInstrucoesDoRobo tira so as linhas de comando', semInstrucoesDoRobo(VALOR) === '💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.', semInstrucoesDoRobo(VALOR))
}

// ---------------------------------------------------------------- onde e telemedicina
{
  const r = responderDirect('Onde atendemos', 'onde', CTX)
  confere('onde lista as unidades com endereco', /Unidade Centro/.test(r.texto) && /Rua Exemplo, 10/.test(r.texto) && /Av. Inventada/.test(r.texto), r.texto)
  confere('onde cita a telemedicina quando ha', /Telemedicina/.test(r.texto), r.texto)
  const t = responderDirect('Telemedicina', 'tele', CTX)
  confere('telemedicina responde o texto da clinica', /pix/.test(t.texto), t.texto)
  const semTele = responderDirect('Telemedicina', 'tele', { ...CTX, tele: null })
  confere('sem telemedicina diz que e presencial', /presenciais/.test(semTele.texto), semTele.texto)
}

// ---------------------------------------------------------------- assunto clinico: nunca orienta
{
  const r = responderDirect('meu filho tem febre, posso dar dipirona?', null, CTX)
  confere('sintoma vai para a equipe', r.atencao === 'medico', JSON.stringify(r))
  confere('nao cita remedio na resposta', !/dipirona/i.test(r.texto), r.texto)
}

// ---------------------------------------------------------------- remarcar e 2a via: WhatsApp
{
  const r = responderDirect('preciso remarcar a consulta de quinta', null, CTX)
  confere('remarcar manda para o WhatsApp', r.acao === 'whatsapp' && /wa\.me\/5513999990000/.test(r.texto), JSON.stringify(r))
  const s = responderDirect('preciso da segunda via da receita', null, CTX)
  confere('2a via manda para o WhatsApp', s.acao === 'whatsapp', JSON.stringify(s))
}

// ---------------------------------------------------------------- primeira mensagem, cumprimento, nao entendeu
{
  const r = responderDirect('oi', null, { ...CTX, primeiraVez: true })
  confere('oi na primeira vez: saudacao e menu', r.texto.startsWith(CTX.saudacao) && (r.opcoes ?? []).length === 5, JSON.stringify(r))
  const v = responderDirect('quanto custa?', null, { ...CTX, primeiraVez: true })
  confere('primeira mensagem com pergunta: cumprimenta e responde', v.texto.startsWith(CTX.saudacao) && /R\$ 450/.test(v.texto), v.texto)
  const n = responderDirect('blablabla xyz qwerty', null, CTX)
  confere('nao entendeu: equipe, sem repetir o menu', n.atencao === 'atendente' && (n.opcoes ?? []).length === 0, JSON.stringify(n))
  const o = responderDirect('obrigada!', null, CTX)
  confere('agradecimento so se despede', o.acao === 'despedida' && !o.atencao, JSON.stringify(o))
  const e = responderDirect('Falar com a equipe', 'equipe', CTX)
  confere('botao equipe chama a equipe com o horario', e.atencao === 'atendente' && /8h às 18h/.test(e.texto), e.texto)
}

// ---------------------------------------------------------------- fluxos que a IA abre
{
  confere('fluxo menu: menu completo', respostaDoFluxo('menu', CTX).acao === 'menu')
  confere('fluxo 4 (minha consulta): WhatsApp, nao equipe', respostaDoFluxo('4', CTX).acao === 'whatsapp', JSON.stringify(respostaDoFluxo('4', CTX)))
  confere('fluxo 5 (2a via): WhatsApp', respostaDoFluxo('5', CTX).acao === 'whatsapp')
  confere('fluxo agendar: link', respostaDoFluxo('quero marcar uma consulta', CTX).texto.includes(LINK))
  confere('fluxo nunca repete a saudacao', !respostaDoFluxo('quero marcar uma consulta', { ...CTX, primeiraVez: true }).texto.startsWith(CTX.saudacao))
}

// ---------------------------------------------------------------- comentarios
{
  for (const t of ['Quero agendar!', 'qual o valor da consulta?', 'atende Unimed?', 'Dr, preciso retornar a consulta, Theo com senhor', 'tem telemedicina?', 'me passa o whats']) {
    confere(`pede contato: "${t}"`, comentarioPedeContato(t))
  }
  for (const t of ['Excelente post 👏', 'Beijos ! Saudades sempre …', 'Muito bom. Acho que super valorizam exames.', 'Fantástico dr❤️', '👏👏👏', 'Dr e o que você acha do Glúten para quem tem Hashimoto?????']) {
    confere(`nao pede contato: "${t}"`, !comentarioPedeContato(t))
  }
  confere('pergunta medica em comentario vai para a equipe', comentarioEPergunta('Dr e o que você acha do Glúten para quem tem Hashimoto?????'))
  confere('elogio nao e pergunta', !comentarioEPergunta('Excelente post 👏'))
  const p = respostaPrivadaAoComentario('maria.teste', CTX)
  confere('resposta privada cita a pessoa e manda o link', p.includes('@maria.teste') && p.includes(LINK), p)
  const a = respostaPublicaAoComentario('17890001112223334')
  confere('resposta publica e sempre a mesma para o mesmo comentario', a === respostaPublicaAoComentario('17890001112223334'))
  const varias = new Set(['1', '22', '333', '4444', '55555', '666666', '7777777'].map(respostaPublicaAoComentario))
  confere('respostas publicas variam entre comentarios', varias.size > 1, [...varias].join(' | '))
}

// ---------------------------------------------------------------- direct sem negrito
// Primeiro teste de verdade (16/10/2026): a tela de Respostas mostrava "*R$ 450,00*".
{
  const v = semFormatacaoDoWhatsApp(responderDirect('quanto custa a consulta?', null, CTX).texto)
  confere('valor sai sem asterisco', !v.includes('*') && /R\$ 450,00/.test(v), v)
  const ia = semFormatacaoDoWhatsApp('A consulta custa *R$ 450,00* em Santos e *R$ 600,00* em São Paulo.')
  confere('negrito da IA vira texto puro', ia === 'A consulta custa R$ 450,00 em Santos e R$ 600,00 em São Paulo.', ia)
  const urg = semFormatacaoDoWhatsApp(responderDirect('socorro, é urgente', null, CTX).texto)
  confere('texto do proprio robo tambem sai limpo', !urg.includes('*') && /pronto-socorro/.test(urg), urg)
  confere('italico sai', semFormatacaoDoWhatsApp('Pode vir _em jejum_.') === 'Pode vir em jejum.')
  const p = semFormatacaoDoWhatsApp(respostaPrivadaAoComentario('maria_teste_2', CTX))
  confere('sublinhado de usuario e link fica', p.includes('@maria_teste_2') && p.includes(LINK), p)
  confere('asterisco solto fica', semFormatacaoDoWhatsApp('5 * 3 = 15') === '5 * 3 = 15')
}

// ---------------------------------------------------------------- prazos da Meta
{
  const agora = new Date('2026-10-16T12:00:00Z')
  confere('janela aberta 23 h depois', dentroDaJanela('2026-10-15T13:00:00Z', agora))
  confere('janela fechada 25 h depois', !dentroDaJanela('2026-10-15T11:00:00Z', agora))
  confere('sem mensagem da pessoa, sem janela', !dentroDaJanela(null, agora))
  confere('comentario de 6 dias ainda responde no direct', comentarioAindaRespondivel('2026-10-10T13:00:00Z', agora))
  confere('comentario de 8 dias nao responde mais', !comentarioAindaRespondivel('2026-10-08T11:00:00Z', agora))
  confere('token com 30 dias nao renova', !tokenPrecisaRenovar('2026-11-15T12:00:00Z', agora))
  confere('token com 10 dias renova', tokenPrecisaRenovar('2026-10-26T12:00:00Z', agora))
  confere('token sem validade renova', tokenPrecisaRenovar(null, agora))
}

// ---------------------------------------------------------------- login oficial
{
  const volta = 'https://clinica.exemplo.com.br/central/instagram-retorno.html'
  const u = new URL(enderecoDoLogin(volta, 'abc-123'))
  confere('login vai para o Instagram', u.origin === 'https://www.instagram.com' && u.pathname === '/oauth/authorize', u.href)
  confere('login pede codigo e volta para a pagina de retorno', u.searchParams.get('response_type') === 'code' && u.searchParams.get('redirect_uri') === volta, u.href)
  confere('login leva o state', u.searchParams.get('state') === 'abc-123')
  confere('login pede para escolher a conta', u.searchParams.get('force_reauth') === 'true')
  confere(
    'login pede as tres permissoes',
    u.searchParams.get('scope') === 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments',
    u.searchParams.get('scope'),
  )
  confere('codigo perde o "#_" do fim', codigoDaVolta('AQBx9#_') === 'AQBx9' && codigoDaVolta('AQBx9') === 'AQBx9')
  confere('volta da propria pagina e aceita', voltaPermitida(volta))
  confere('volta no localhost e aceita', voltaPermitida('http://localhost:3000/instagram-retorno.html'))
  confere('volta em http fora do localhost e recusada', !voltaPermitida('http://clinica.exemplo.com.br/central/instagram-retorno.html'))
  confere('volta para outra pagina e recusada', !voltaPermitida('https://clinica.exemplo.com.br/central/'))
  confere('volta com parametro e recusada', !voltaPermitida(`${volta}?x=1`))
  confere('permissao desmarcada aparece', permissoesQueFaltam('instagram_business_basic,instagram_business_manage_messages').join() === 'instagram_business_manage_comments')
  confere('todas concedidas: nada falta', permissoesQueFaltam(['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments']).length === 0)
  confere('resposta sem a lista: nao inventa falta', permissoesQueFaltam(null).length === 0)
}

// ---------------------------------------------------------------- buscar comentarios
{
  const agora = new Date('2026-10-16T22:30:00Z')
  const conta = { igUserId: '900', username: 'clinica.teste' }
  const lista = [
    { id: 'c1', text: 'quero agendar', timestamp: '2026-10-16T22:20:31+0000', from: { id: '111', username: 'mae.teste' } },
    { id: 'c2', text: 'Excelente post 👏', timestamp: '2026-10-15T10:00:00+0000', from: { id: '112', username: 'pai.teste' } },
    { id: 'c3', text: 'Que bom que ajudou!', timestamp: '2026-10-16T22:25:00+0000', from: { id: '900', username: 'clinica.teste' } },
    { id: 'c4', text: 'Obrigada!', timestamp: '2026-10-16T22:26:00+0000', username: 'Clinica.Teste' },
    { id: 'c5', text: 'quero agendar', timestamp: '2026-10-01T10:00:00+0000', from: { id: '113', username: 'antiga.teste' } },
    { id: 'c6', text: 'Dr, pode dar leite de soja?', timestamp: '2026-10-16T08:00:00+0000', from: { id: '114', username: 'avo.teste' } },
    { text: 'sem id', timestamp: '2026-10-16T22:00:00+0000' },
  ]
  const r = comentariosParaImportar('m1', lista, conta, agora)
  const ids = r.map((l) => l.comment_id).join(',')
  confere('busca traz so os de 7 dias, sem os da propria conta', ids === 'c1,c2,c6', ids)
  const c1 = r.find((l) => l.comment_id === 'c1')
  confere('data com fuso "+0000" vira ISO', c1?.created_at === '2026-10-16T22:20:31.000Z', c1?.created_at)
  confere('autor e post gravados', c1?.autor_username === 'mae.teste' && c1?.autor_id === '111' && c1?.media_id === 'm1', JSON.stringify(c1))
  confere('pedido de contato vai para a equipe', c1?.precisa_equipe === true)
  confere('elogio nao vai para a equipe', r.find((l) => l.comment_id === 'c2')?.precisa_equipe === false)
  confere('pergunta vai para a equipe', r.find((l) => l.comment_id === 'c6')?.precisa_equipe === true)

  // Busca automatica: so o comentario novo recebe resposta sozinho.
  const s = separarComentariosDaBusca(r, new Set(), agora)
  confere('comentario de 10 min: robo responde', s.responder.map((l) => l.comment_id).join() === 'c1', s.responder.map((l) => l.comment_id).join())
  confere('comentario de horas atras: so vai para a lista', s.soGravar.map((l) => l.comment_id).join() === 'c2,c6', s.soGravar.map((l) => l.comment_id).join())
  const g = separarComentariosDaBusca(r, new Set(['c1']), agora)
  confere('comentario ja gravado nao volta', !g.responder.length && !g.soGravar.some((l) => l.comment_id === 'c1'))
  const limite = separarComentariosDaBusca(r, new Set(), new Date('2026-10-16T22:50:31Z'))
  confere('30 minutos certos ainda responde', limite.responder.map((l) => l.comment_id).join() === 'c1')
  const passou = separarComentariosDaBusca(r, new Set(), new Date('2026-10-16T22:50:32Z'))
  confere('30 minutos e 1 segundo nao responde', !passou.responder.length && passou.soGravar.some((l) => l.comment_id === 'c1'))
}

// ---------------------------------------------------------------- conhecimento da IA
{
  const k = conhecimentoParaOInstagram('- A família marca, remarca, cancela e vê a consulta por aqui mesmo, pelo WhatsApp, na hora.\n- Na véspera da consulta, a família recebe um lembrete por aqui.')
  confere('IA no Instagram nao diz que marca por aqui', !/por aqui mesmo/.test(k) && /WhatsApp da clínica/.test(k), k)
  confere('lembrete e pelo WhatsApp', /lembrete pelo WhatsApp/.test(k), k)
}

console.log(`Instagram: ${ok} verificações passaram.`)
if (falhas) {
  console.error(`FALHAS: ${falhas}`)
  process.exit(1)
}
