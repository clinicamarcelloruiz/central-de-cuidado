// Alerta de urgencia no WhatsApp pessoal do medico (17/10/2026).
// Regra em supabase/functions/_shared/alerta-de-urgencia.ts. Sem Meta e sem
// banco: um fetch de mentira e um admin que guarda o que foi gravado.
import { assuntoDoPedido, deveAlertar, deveEncaminhar, descreverEnvio, enviarAlertaDeUrgencia, MODELO_DO_ALERTA, numerosDoAlerta, parametrosDoAlerta, parametrosDoPedido } from './alerta-de-urgencia.build.mjs'
import { textoDoModelo } from './modelos.build.mjs'
import { bancoFalso } from './fixtures/banco-falso.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

// O token do WhatsApp vem do ambiente do Deno; aqui, de mentira.
globalThis.Deno = { env: { get: (nome) => (nome === 'WHATSAPP_ACCESS_TOKEN' ? 'token-de-teste' : undefined) } }

// 1. Numeros: 55 + DDD + celular, sem repetir, sem lixo.
{
  const n = numerosDoAlerta('(13) 99703-9614\n13997039614, 5513997039614\n123\n(11) 98888-7777')
  confere('numeros: normaliza e nao repete', JSON.stringify(n) === JSON.stringify(['5513997039614', '5511988887777']), JSON.stringify(n))
  confere('numeros: lista do banco', numerosDoAlerta(['5513997039614']).length === 1)
  confere('numeros: nada', numerosDoAlerta(null).length === 0 && numerosDoAlerta('').length === 0)
  // Celular antigo sem o 9: a Meta so entrega com ele.
  confere('numeros: poe o nono digito', numerosDoAlerta('13 9703-9614')[0] === '5513997039614', JSON.stringify(numerosDoAlerta('13 9703-9614')))
}

// 2. So quando a conversa ENTRA em urgencia.
confere('alerta: conversa nova em urgencia', deveAlertar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'urgencia' }))
confere('alerta: da fila do atendente para urgencia', deveAlertar({ atencaoAntes: true, motivoAntes: 'atendente', motivoAgora: 'urgencia' }))
confere('alerta: mae escrevendo de novo na mesma urgencia nao repete', !deveAlertar({ atencaoAntes: true, motivoAntes: 'urgencia', motivoAgora: 'urgencia' }))
confere('alerta: outro motivo nao alerta', !deveAlertar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'atendente' }))
// Rodada 6 do painel: "ela piorou, ta gritando de dor" as 3h, na mesma urgencia.
confere('alerta: piora na mesma urgencia avisa de novo', deveAlertar({ atencaoAntes: true, motivoAntes: 'urgencia', motivoAgora: 'urgencia', piora: true }))
confere('alerta: piora sem urgencia nao alerta', !deveAlertar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'atendente', piora: true }))
confere('alerta: urgencia resolvida e nova urgencia alerta', deveAlertar({ atencaoAntes: false, motivoAntes: 'urgencia', motivoAgora: 'urgencia' }))

// 3. Parametros que a Meta aceita: sem quebra de linha, sem CPF, com limite.
{
  const p = parametrosDoAlerta({
    quem: 'Helena',
    canal: 'WhatsApp',
    texto: 'Ela está vomitando sangue\n\nmeu CPF 529.982.247-25, liga no (13) 99706-6339    por favor ' + 'x'.repeat(400),
    agora: new Date('2026-10-18T02:14:00Z'),
  })
  confere('parametros: quatro', p.length === 4)
  confere('parametros: hora de Brasilia', p[2] === '23:14', p[2])
  confere('parametros: sem quebra de linha nem espacos seguidos', p.every((x) => !/[\n\t]| {4,}/.test(x)))
  confere('parametros: sem CPF nem telefone', !p[3].includes('529.982.247-25') && !p[3].includes('99706-6339') && p[3].includes('[cpf]'), p[3])
  confere('parametros: trecho cortado', p[3].length <= 300 && p[3].endsWith('…'))
  confere('parametros: vazio vira traco', parametrosDoAlerta({ quem: '', canal: 'Instagram', texto: '', agora: new Date() })[0] === '-')
  const corpo = textoDoModelo(MODELO_DO_ALERTA, p) ?? ''
  // O texto enviado a Meta em 17/10/2026; mudou la, muda aqui.
  confere('modelo: texto registrado', corpo.includes('Helena escreveu pelo WhatsApp às 23:14') && corpo.includes('O robô já orientou a família.'), corpo)
  confere('modelo: cabe no limite da Meta', corpo.length <= 1024, String(corpo.length))
}

// 4. O que fica registrado.
{
  const certo = descreverEnvio([{ numero: '5513997039614', ok: true }, { numero: '5511988887777', ok: true }])
  confere('registro: enviado', !certo.falhou && certo.detalhe === 'enviado 2/2' && certo.nota.includes('final 9614') && certo.nota.includes('final 7777'), certo.nota)
  const semModelo = descreverEnvio([{ numero: '5513997039614', ok: false, erro: '(#132001) Template name does not exist in the translation' }, { numero: '5511988887777', ok: true }])
  confere('registro: falha grita', semModelo.falhou && semModelo.nota.startsWith('⚠️') && semModelo.nota.includes('Avise o Dr. Marcello por telefone'), semModelo.nota)
  confere('registro: modelo nao aprovado explicado', semModelo.nota.includes('ainda não foi aprovado na Meta'), semModelo.nota)
  confere('registro: diz para quem chegou', semModelo.nota.includes('Chegou a final 7777'), semModelo.nota)
  confere('registro: detalhe cabe na coluna', semModelo.detalhe.length <= 120)
}

// 5. Envio de ponta a ponta, com Meta e banco de mentira.
function adminFalso({ numeros = ['5513997039614', '5511988887777'], semColuna = false } = {}) {
  const gravado = []
  return {
    gravado,
    from(tabela) {
      const q = {
        _campos: '',
        select(c) { q._campos = c; return q },
        eq() { return q },
        async maybeSingle() {
          if (q._campos.includes('alerta_urgencia_telefones')) {
            return semColuna ? { data: null, error: { message: 'column clinic_settings.alerta_urgencia_telefones does not exist' } } : { data: { alerta_urgencia_telefones: numeros }, error: null }
          }
          return { data: { whatsapp_phone_number_id: '123', whatsapp_template_language: 'pt_BR' }, error: null }
        },
        async insert(linha) { gravado.push([tabela, linha]); return { error: null } },
      }
      return q
    },
  }
}
const pedido = { clinicId: 'c1', canal: 'WhatsApp', quem: 'Helena', texto: 'ela engoliu uma pilha', agora: new Date('2026-10-18T02:14:00Z'), conversaWhatsApp: 'conv-1' }
{
  const enviados = []
  const metaAceita = async (url, init) => {
    enviados.push([url, JSON.parse(init.body)])
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid' }] }) }
  }
  const admin = adminFalso()
  const r = await enviarAlertaDeUrgencia(admin, pedido, metaAceita)
  confere('envio: um por numero', enviados.length === 2 && r.every((e) => e.ok))
  const corpo = enviados[0][1]
  confere('envio: modelo certo', corpo.type === 'template' && corpo.template.name === 'alerta_urgencia' && corpo.to === '5513997039614', JSON.stringify(corpo))
  confere('envio: pelo numero do robo', enviados[0][0].endsWith('/123/messages'), enviados[0][0])
  confere('envio: nota na conversa', admin.gravado.some(([t, l]) => t === 'conversation_notes' && l.conversation_id === 'conv-1' && l.texto.startsWith('🚨')))
  confere('envio: evento nos numeros', admin.gravado.some(([t, l]) => t === 'whatsapp_bot_events' && l.evento === 'alerta_urgencia' && l.detalhe === 'enviado 2/2'))
}
{
  const metaRecusa = async () => ({ ok: false, status: 404, json: async () => ({ error: { code: 132001, message: 'Template name does not exist in the translation' } }) })
  const admin = adminFalso()
  const r = await enviarAlertaDeUrgencia(admin, pedido, metaRecusa)
  confere('recusa: nao lanca e registra', r.length === 2 && r.every((e) => !e.ok))
  const nota = admin.gravado.find(([t]) => t === 'conversation_notes')?.[1]?.texto ?? ''
  confere('recusa: a nota manda ligar', nota.includes('NÃO chegou') && nota.includes('por telefone'), nota)
}
{
  const metaCaiu = async () => { throw new Error('rede fora') }
  const admin = adminFalso({ numeros: ['5513997039614'] })
  const r = await enviarAlertaDeUrgencia(admin, pedido, metaCaiu)
  confere('rede fora: nao lanca e registra', r.length === 1 && !r[0].ok && admin.gravado.some(([t]) => t === 'conversation_notes'))
}
{
  let chamou = false
  const r = await enviarAlertaDeUrgencia(adminFalso({ numeros: [] }), pedido, async () => { chamou = true })
  confere('sem numero: nao chama a Meta', r.length === 0 && !chamou)
  const r2 = await enviarAlertaDeUrgencia(adminFalso({ semColuna: true }), pedido, async () => { chamou = true })
  confere('banco sem a coluna: nao chama a Meta nem derruba', r2.length === 0 && !chamou)
}
{
  const admin = adminFalso({ numeros: ['5513997039614'] })
  await enviarAlertaDeUrgencia(admin, { ...pedido, canal: 'Instagram', conversaWhatsApp: undefined, conversaInstagram: 'ig-1' }, async () => ({ ok: true, status: 200, json: async () => ({}) }))
  confere('instagram: nota no direct', admin.gravado.some(([t, l]) => t === 'instagram_mensagens' && l.direcao === 'nota' && l.conversa_id === 'ig-1'))
  confere('instagram: sem evento do whatsapp', !admin.gravado.some(([t]) => t === 'whatsapp_bot_events'))
}

// 6. Com a tabela dos alertas (17/10/2026): registrado e com os botoes de
// resposta, que levam o id do alerta. Ver resposta-ao-alerta.ts.
const ajustesComNumeros = () => bancoFalso({
  clinic_settings: [{ clinic_id: 'c1', whatsapp_phone_number_id: '123', whatsapp_template_language: 'pt_BR', alerta_urgencia_telefones: ['5513997039614', '5511988887777'] }],
  alertas_de_urgencia: [],
})
{
  const banco = ajustesComNumeros()
  const enviados = []
  const meta = async (url, init) => {
    enviados.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: `wamid.${enviados.length}` }] }) }
  }
  await enviarAlertaDeUrgencia(banco, pedido, meta)
  const registrado = banco.db.alertas_de_urgencia[0]
  confere('v2: alerta registrado', registrado?.quem === 'Helena' && registrado.conversa_whatsapp === 'conv-1' && registrado.teste === false)
  confere('v2: modelo com botoes', enviados[0]?.template?.name === 'alerta_urgencia_v2', enviados[0]?.template?.name)
  const botoes = (enviados[0]?.template?.components ?? []).filter((c) => c.type === 'button')
  confere('v2: tres botoes com o id do alerta', botoes.length === 3 && botoes[0].parameters[0].payload === `URG:${registrado.id}:urgente` && botoes[2].parameters[0].payload === `URG:${registrado.id}:responde`, JSON.stringify(botoes))
  confere('v2: ids das mensagens guardados', JSON.stringify(registrado.mensagens) === JSON.stringify(['wamid.1', 'wamid.2']), JSON.stringify(registrado.mensagens))
}
{
  // Modelo com botoes ainda em analise: cai no sem botoes, e o resto ja vai direto.
  const banco = ajustesComNumeros()
  const nomes = []
  const meta = async (url, init) => {
    const nome = JSON.parse(init.body).template.name
    nomes.push(nome)
    if (nome === 'alerta_urgencia_v2') return { ok: false, status: 404, json: async () => ({ error: { code: 132001, message: 'Template name does not exist in the translation' } }) }
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.x' }] }) }
  }
  const r = await enviarAlertaDeUrgencia(banco, pedido, meta)
  confere('v2 em analise: cai no modelo sem botoes', JSON.stringify(nomes) === JSON.stringify(['alerta_urgencia_v2', 'alerta_urgencia', 'alerta_urgencia']) && r.every((e) => e.ok), JSON.stringify(nomes))
}
{
  const banco = ajustesComNumeros()
  await enviarAlertaDeUrgencia(banco, { ...pedido, conversaWhatsApp: undefined, numeros: ['5513997039614'] }, async () => ({ ok: true, status: 200, json: async () => ({}) }))
  confere('teste da tela: alerta marcado como teste', banco.db.alertas_de_urgencia[0]?.teste === true)
}

// 7. O pedido que nao e urgencia, nos mesmos celulares (18/10/2026): sem
// secretaria, quem responde e o medico ou o Edu.
confere('pedido: conversa entra na fila do atendente', deveEncaminhar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'atendente' }) === 'novo')
confere('pedido: 2a via de receita', deveEncaminhar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'documento' }) === 'novo')
confere('pedido: troca de pedido na fila e novo', deveEncaminhar({ atencaoAntes: true, motivoAntes: 'atendente', motivoAgora: 'documento' }) === 'novo')
confere('pedido: mae escrevendo de novo na fila e seguimento', deveEncaminhar({ atencaoAntes: true, motivoAntes: 'atendente', motivoAgora: 'atendente' }) === 'seguimento')
confere('pedido: urgencia tem o alerta proprio', deveEncaminhar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'urgencia' }) === null)
confere('pedido: informativo nao vai', deveEncaminhar({ atencaoAntes: false, motivoAntes: null, motivoAgora: 'cancelou_sozinho' }) === null && deveEncaminhar({ atencaoAntes: false, motivoAntes: null, motivoAgora: null }) === null)
confere('pedido: assunto da IA primeiro', assuntoDoPedido('atendente', 'medico', 'o Dr. Marcello') === 'pergunta para o Dr. Marcello', assuntoDoPedido('atendente', 'medico', 'o Dr. Marcello'))
confere('pedido: assunto do robo', assuntoDoPedido('farmacia', null) === 'farmácia pediu correção de receita')
confere('pedido: assunto desconhecido', assuntoDoPedido('outro', 'outro') === 'pedido para a equipe')
{
  const p = parametrosDoPedido({ quem: 'Helena', canal: 'WhatsApp', texto: 'pode dar\ndipirona?', agora: new Date('2026-10-18T14:05:00Z'), assunto: 'pergunta para o Dr. Marcello' })
  confere('pedido: cinco parametros, assunto antes do trecho', p.length === 5 && p[3] === 'pergunta para o Dr. Marcello' && p[4] === 'pode dar dipirona?' && p[2] === '11:05', JSON.stringify(p))
  confere('pedido: texto do modelo para o registro', (textoDoModelo('pedido_equipe', p) ?? '').includes('Assunto: pergunta para o Dr. Marcello') && (textoDoModelo('pedido_equipe', p) ?? '').endsWith('[Eu respondo]'))
  const certo = descreverEnvio([{ numero: '5513997039614', ok: true }], 'pedido')
  confere('pedido: nota propria', certo.nota.startsWith('📲') && !certo.nota.includes('urgência'), certo.nota)
  const semModelo = descreverEnvio([{ numero: '5513997039614', ok: false, erro: '(#132001) Template name does not exist in the translation' }], 'pedido')
  confere('pedido: falha grita sem mandar ligar', semModelo.falhou && semModelo.nota.includes('pedido_equipe ainda não foi aprovado') && semModelo.nota.includes('Responda a família por aqui') && !semModelo.nota.includes('telefone'), semModelo.nota)
}
const pedidoDaFamilia = { ...pedido, tipo: 'pedido', assunto: 'pergunta para o Dr. Marcello', texto: 'pode dar dipirona?' }
{
  const banco = ajustesComNumeros()
  const enviados = []
  const meta = async (url, init) => {
    enviados.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: `wamid.${enviados.length}` }] }) }
  }
  const r = await enviarAlertaDeUrgencia(banco, pedidoDaFamilia, meta)
  const registrado = banco.db.alertas_de_urgencia[0]
  confere('pedido: sai para os dois', r.length === 2 && r.every((e) => e.ok))
  confere('pedido: modelo pedido_equipe', enviados[0]?.template?.name === 'pedido_equipe' && enviados[0].template.components[0].parameters.length === 5, JSON.stringify(enviados[0]))
  const botoes = (enviados[0]?.template?.components ?? []).filter((c) => c.type === 'button')
  confere('pedido: botao Eu respondo com o id', botoes.length === 1 && botoes[0].parameters[0].payload === `URG:${registrado?.id}:responde`, JSON.stringify(botoes))
  confere('pedido: nota e evento proprios', banco.db.conversation_notes?.[0]?.texto.startsWith('📲') && banco.db.whatsapp_bot_events?.[0]?.evento === 'pedido_equipe', JSON.stringify(banco.db.whatsapp_bot_events))
}
{
  // Modelo ainda em analise: vai como texto com o mesmo botao.
  const banco = ajustesComNumeros()
  const enviados = []
  const meta = async (url, init) => {
    const corpo = JSON.parse(init.body)
    enviados.push(corpo)
    if (corpo.type === 'template') return { ok: false, status: 404, json: async () => ({ error: { code: 132001, message: 'Template name does not exist in the translation' } }) }
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.t' }] }) }
  }
  const r = await enviarAlertaDeUrgencia(banco, pedidoDaFamilia, meta)
  const id = banco.db.alertas_de_urgencia[0]?.id
  confere('pedido sem modelo: cai no texto e o resto vai direto', JSON.stringify(enviados.map((e) => e.type)) === JSON.stringify(['template', 'interactive', 'interactive']) && r.every((e) => e.ok), JSON.stringify(enviados.map((e) => e.type)))
  const texto = enviados[1]?.interactive?.body?.text ?? ''
  confere('pedido sem modelo: o texto do modelo, sem a linha do botao', texto.includes('Assunto: pergunta para o Dr. Marcello') && !texto.includes('[Eu respondo]'), texto)
  confere('pedido sem modelo: botao Eu respondo', enviados[1]?.interactive?.action?.buttons?.[0]?.reply?.id === `URG:${id}:responde`, JSON.stringify(enviados[1]?.interactive?.action))
}
{
  // Seguimento: so sai se o pedido anterior ja teve resposta.
  const agora = pedido.agora
  const comPendente = (veredito) => {
    const banco = ajustesComNumeros()
    banco.db.alertas_de_urgencia.push({ id: 'a-1', clinic_id: 'c1', conversa_whatsapp: 'conv-1', veredito, criado_em: new Date(agora.getTime() - 3600e3).toISOString(), mensagens: [] })
    return banco
  }
  let chamadas = 0
  const meta = async () => { chamadas++; return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'w' }] }) } }
  const r1 = await enviarAlertaDeUrgencia(comPendente(null), { ...pedidoDaFamilia, seguimento: true }, meta)
  confere('seguimento: pedido sem resposta segura', r1.length === 0 && chamadas === 0, String(chamadas))
  const r2 = await enviarAlertaDeUrgencia(comPendente('responde'), { ...pedidoDaFamilia, seguimento: true }, meta)
  confere('seguimento: depois da resposta, a mensagem seguinte vai', r2.length === 2, String(r2.length))
  chamadas = 0
  const r3 = await enviarAlertaDeUrgencia(comPendente(null), pedidoDaFamilia, meta)
  confere('seguimento: pedido novo vai mesmo com outro aberto', r3.length === 2 && chamadas === 2)
  const velho = ajustesComNumeros()
  velho.db.alertas_de_urgencia.push({ id: 'a-2', clinic_id: 'c1', conversa_whatsapp: 'conv-1', veredito: null, criado_em: new Date(agora.getTime() - 7 * 3600e3).toISOString(), mensagens: [] })
  const r4 = await enviarAlertaDeUrgencia(velho, { ...pedidoDaFamilia, seguimento: true }, meta)
  confere('seguimento: pedido de mais de 6 h nao segura', r4.length === 2)
  const r5 = await enviarAlertaDeUrgencia(bancoFalso({ clinic_settings: ajustesComNumeros().db.clinic_settings }, { semTabela: ['alertas_de_urgencia'] }), { ...pedidoDaFamilia, seguimento: true }, meta)
  confere('seguimento: sem a tabela nao manda (seria uma por mensagem)', r5.length === 0)
}

console.log(`alerta de urgencia: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
