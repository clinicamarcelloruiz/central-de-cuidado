// A resposta do medico ao alerta de urgencia, pelo WhatsApp dele (17/10/2026).
// Regra em supabase/functions/_shared/resposta-ao-alerta.ts. Banco e Meta de
// mentira: o que se testa e o que chega a familia, ao medico e ao registro.
import { escolherAlerta, lerRespostaDaEquipe, papelDoNumero, textoParaAFamilia, tratarRespostaDaEquipe } from './resposta-ao-alerta.build.mjs'
import { bancoFalso } from './fixtures/banco-falso.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

const MEDICO = '5513997039614'
const EQUIPE = '5513991165576'
const FAMILIA = '5513988887777'
const AGORA = new Date('2026-10-18T02:30:00Z')
const haMinutos = (m) => new Date(AGORA.getTime() - m * 60000).toISOString()
const A1 = '11111111-1111-4111-8111-111111111111'
const A2 = '22222222-2222-4222-8222-222222222222'

function alerta(extra = {}) {
  return {
    id: A1, clinic_id: 'c1', canal: 'WhatsApp', conversa_whatsapp: 'conv-1', conversa_instagram: null, teste: false,
    quem: 'Helena', mensagens: ['wamid.ALERTA1'], veredito: null, veredito_por: null, veredito_em: null,
    rascunho: null, rascunho_de: null, rascunho_em: null, criado_em: haMinutos(30), ...extra,
  }
}

function cenario({ alertas = [alerta()], ultimaDaFamilia = haMinutos(35), semTabela = [], instagram = null } = {}) {
  const banco = bancoFalso(
    {
      alertas_de_urgencia: alertas,
      whatsapp_conversations: [{ id: 'conv-1', wa_id: FAMILIA, patient_id: 'p1', profile_name: 'Maria Silva', needs_attention: true, attention_reason: 'urgencia' }],
      whatsapp_messages: [{ conversation_id: 'conv-1', direction: 'inbound', message_type: 'text', created_at: ultimaDaFamilia }],
      clinic_settings: [{ clinic_id: 'c1', whatsapp_reply_template_name: 'resposta_da_clinica', whatsapp_template_language: 'pt_BR' }],
      instagram_conversas: [{ id: 'ig-1', igsid: '987', ultima_da_pessoa_em: instagram?.ultima ?? haMinutos(20), motivo: 'urgencia' }],
      instagram_contas: [{ clinic_id: 'c1', ig_user_id: 'ig-user', access_token: 'tok', whatsapp: '5513996811279' }],
      conversation_notes: [],
      whatsapp_bot_events: [],
      instagram_mensagens: [],
    },
    { semTabela },
  )
  const enviados = []
  const directs = []
  const amb = {
    admin: banco,
    clinicId: 'c1',
    agora: AGORA,
    numeros: [MEDICO, EQUIPE],
    enviarWhatsApp: async (para, conteudo) => { enviados.push({ para, conteudo }); return { ok: true, id: `wamid.${enviados.length}` } },
    enviarDirect: async (conta, igsid, texto) => { directs.push({ igsid, texto }); return { ok: true, mid: 'mid.1' } },
  }
  const textoDe = (e) => e.conteudo.text?.body ?? e.conteudo.interactive?.body?.text ?? JSON.stringify(e.conteudo.template ?? '')
  const para = (numero) => enviados.filter((e) => e.para === numero).map(textoDe)
  return { banco, enviados, directs, amb, para, textoDe }
}
const toque = (payload) => ({ type: 'button', button: { payload, text: 'x' } })
const toqueInterativo = (id) => ({ type: 'interactive', interactive: { button_reply: { id, title: 'x' } } })
const texto = (body, citado = null) => ({ type: 'text', text: { body }, ...(citado ? { context: { id: citado } } : {}) })

// 1. Pecas puras.
confere('le o toque no alerta', JSON.stringify(lerRespostaDaEquipe(toque(`URG:${A1}:urgente`))) === JSON.stringify({ tipo: 'veredito', alertaId: A1, veredito: 'urgente' }))
confere('le a confirmacao', lerRespostaDaEquipe(toqueInterativo(`URGTXT:${A1}:enviar`))?.tipo === 'confirmacao')
confere('botao de outro fluxo nao e daqui', lerRespostaDaEquipe(toque('CONFIRMAR')) === null)
confere('"ok" e visto, nao orientacao', lerRespostaDaEquipe(texto('Ok!'))?.tipo === 'visto' && lerRespostaDaEquipe(texto('👍'))?.tipo === 'visto')
confere('orientacao e texto', lerRespostaDaEquipe(texto('Pode dar soro e me avisa'))?.tipo === 'texto')
confere('audio e midia', lerRespostaDaEquipe({ type: 'audio' })?.tipo === 'midia')
confere('papel: primeiro numero e o medico', papelDoNumero('13997039614', [MEDICO, EQUIPE]) === 'medico' && papelDoNumero(EQUIPE, [MEDICO, EQUIPE]) === 'equipe' && papelDoNumero(FAMILIA, [MEDICO, EQUIPE]) === null)
confere('equipe nao classifica urgencia', textoParaAFamilia('urgente', 'equipe', { o: 'o Dr. Marcello', O: 'O Dr. Marcello' }) === null)
confere('mensagem do medico leva o nome dele', textoParaAFamilia('texto', 'medico', { o: 'o Dr. Marcello', O: 'O Dr. Marcello' }, { texto: 'Oi' }) === '💬 Mensagem do Dr. Marcello: Oi')
{
  const dois = [alerta(), alerta({ id: A2, quem: 'João', mensagens: ['wamid.ALERTA2'], criado_em: haMinutos(10) })]
  confere('citado: o alerta exato', escolherAlerta(dois, 'wamid.ALERTA2', AGORA)?.alerta?.id === A2)
  confere('sem citar e com dois: pergunta', escolherAlerta(dois, null, AGORA)?.ambiguos?.length === 2)
  confere('nenhum alerta recente: nada', escolherAlerta([alerta({ criado_em: haMinutos(8 * 60) })], null, AGORA) === null)
}

// 2. Medico toca "E urgente": a familia recebe, ele recebe o OK, fica registrado.
{
  const c = cenario()
  const tratou = await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:urgente`))
  confere('urgente: tratou', tratou)
  confere('urgente: familia orientada ao pronto-socorro', c.para(FAMILIA).some((t) => t.includes('O Dr. Marcello viu a sua mensagem e orienta: procure agora o pronto-socorro')), JSON.stringify(c.para(FAMILIA)))
  confere('urgente: medico recebe o OK', c.para(MEDICO).some((t) => t.includes('✅ Enviado para Helena')))
  confere('urgente: veredito gravado', c.banco.db.alertas_de_urgencia[0].veredito === 'urgente' && c.banco.db.alertas_de_urgencia[0].veredito_por === MEDICO)
  confere('urgente: nota na Central', c.banco.db.conversation_notes.some((n) => n.texto.includes('O Dr. Marcello respondeu ao alerta: é urgente')))
  confere('urgente: mensagem no historico', c.banco.db.whatsapp_messages.some((m) => m.direction === 'outbound' && m.status === 'accepted' && m.body.includes('orienta')))
  // Segundo toque nao manda nada de novo.
  const antes = c.para(FAMILIA).length
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:aguardar`))
  confere('segundo toque: ja respondido', c.para(MEDICO).at(-1)?.includes('já foi respondido (é urgente)') && c.para(FAMILIA).length === antes, c.para(MEDICO).at(-1))
}

// 3. Pode aguardar: botao de marcar e sai da lista de urgencia.
{
  const c = cenario()
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:aguardar`))
  const msg = c.enviados.find((e) => e.para === FAMILIA)
  confere('aguardar: botao de marcar', msg?.conteudo.interactive?.action?.buttons?.[0]?.reply?.id === 'MARCAR_AGORA', JSON.stringify(msg?.conteudo))
  confere('aguardar: sai da lista de urgencia', c.banco.db.whatsapp_conversations[0].attention_reason === 'atendente')
}

// 4. Equipe: nao classifica, mas pode dizer que responde; depois o medico ainda classifica.
{
  const c = cenario()
  await tratarRespostaDaEquipe(c.amb, EQUIPE, toque(`URG:${A1}:aguardar`))
  confere('equipe tocando aguardar: recusado', c.para(EQUIPE).at(-1)?.startsWith('Só o Dr. Marcello classifica') && c.para(FAMILIA).length === 0)
  await tratarRespostaDaEquipe(c.amb, EQUIPE, toque(`URG:${A1}:responde`))
  confere('equipe: eu respondo vai como equipe', c.para(FAMILIA).at(-1) === 'Nossa equipe viu a sua mensagem e vai falar com você por aqui.', c.para(FAMILIA).at(-1))
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:urgente`))
  confere('medico ainda classifica depois do "eu respondo"', c.para(FAMILIA).at(-1)?.includes('orienta: procure agora'), c.para(FAMILIA).at(-1))
}

// 5. Texto do medico: confirma antes, e so entao chega a familia.
{
  const c = cenario()
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('Pode dar soro de reidratação e me manda notícias em 2 horas', 'wamid.ALERTA1'))
  confere('texto: nada para a familia antes do Enviar', c.para(FAMILIA).length === 0)
  const pergunta = c.enviados.at(-1)
  confere('texto: pergunta com Enviar e Cancelar', pergunta.para === MEDICO && pergunta.conteudo.interactive?.action?.buttons?.length === 2 && c.textoDe(pergunta).includes('Vou mandar para Helena, como mensagem do Dr. Marcello'), c.textoDe(pergunta))
  // So quem escreveu confirma.
  await tratarRespostaDaEquipe(c.amb, EQUIPE, toqueInterativo(`URGTXT:${A1}:enviar`))
  confere('texto: outro numero nao confirma', c.para(EQUIPE).at(-1)?.includes('escrita por outra pessoa') && c.para(FAMILIA).length === 0)
  await tratarRespostaDaEquipe(c.amb, MEDICO, toqueInterativo(`URGTXT:${A1}:enviar`))
  confere('texto: chega a familia com o nome dele', c.para(FAMILIA).at(-1) === '💬 Mensagem do Dr. Marcello: Pode dar soro de reidratação e me manda notícias em 2 horas', c.para(FAMILIA).at(-1))
  confere('texto: rascunho apagado e veredito', c.banco.db.alertas_de_urgencia[0].rascunho === null && c.banco.db.alertas_de_urgencia[0].veredito === 'texto')
  confere('texto: mensagem de gente, robo quieto', c.banco.db.whatsapp_messages.some((m) => m.direction === 'outbound' && m.automatic === false))
}
{
  const c = cenario()
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('liga pra ela agora', 'wamid.ALERTA1'))
  await tratarRespostaDaEquipe(c.amb, MEDICO, toqueInterativo(`URGTXT:${A1}:cancelar`))
  confere('cancelar: nada vai para a familia', c.para(FAMILIA).length === 0 && c.para(MEDICO).at(-1)?.startsWith('Cancelado'))
}

// 6. "ok", audio, varios alertas, nenhum alerta, fora da lista.
{
  const c = cenario()
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('ok'))
  confere('ok: anotado e nada para a familia', c.para(MEDICO).at(-1) === '👍 Anotado.' && c.para(FAMILIA).length === 0)
  await tratarRespostaDaEquipe(c.amb, MEDICO, { type: 'audio', audio: { id: 'a' } })
  confere('audio: pede texto', c.para(MEDICO).at(-1)?.includes('só consigo repassar texto'))
}
{
  const c = cenario({ alertas: [alerta(), alerta({ id: A2, quem: 'João', mensagens: ['wamid.ALERTA2'], criado_em: haMinutos(5) })] })
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('pode dar soro'))
  confere('dois alertas sem citar: pergunta qual', c.para(MEDICO).at(-1)?.includes('segure a mensagem do alerta certo') && c.para(FAMILIA).length === 0)
}
{
  const c = cenario({ alertas: [alerta({ criado_em: haMinutos(10 * 60) })] })
  confere('sem alerta recente: segue o robo de sempre', (await tratarRespostaDaEquipe(c.amb, MEDICO, texto('oi, tudo bem?'))) === false)
  confere('fora da lista: segue o robo', (await tratarRespostaDaEquipe(cenario().amb, FAMILIA, texto('oi'))) === false)
  confere('sem a tabela: segue o robo', (await tratarRespostaDaEquipe(cenario({ semTabela: ['alertas_de_urgencia'] }).amb, MEDICO, toque(`URG:${A1}:urgente`))) === false)
}

// 7. Janela de 24 h fechada: vai pelo modelo aprovado.
{
  const c = cenario({ alertas: [alerta({ criado_em: haMinutos(30 * 60) })], ultimaDaFamilia: haMinutos(30 * 60) })
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:responde`))
  const msg = c.enviados.find((e) => e.para === FAMILIA)
  confere('janela fechada: modelo resposta_da_clinica', msg?.conteudo.template?.name === 'resposta_da_clinica', JSON.stringify(msg?.conteudo))
  confere('janela fechada: parametros sem quebra de linha', msg?.conteudo.template?.components?.[0]?.parameters?.every((p) => !/\n/.test(p.text)) && msg.conteudo.template.components[0].parameters[0].text === 'Maria')
}

// 8. Instagram: vai pelo direct; janela fechada avisa o medico.
{
  const c = cenario({ alertas: [alerta({ canal: 'Instagram', conversa_whatsapp: null, conversa_instagram: 'ig-1' })] })
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:aguardar`))
  confere('instagram: direct com o link do WhatsApp, sem asterisco', c.directs[0]?.texto.includes('wa.me/5513996811279') && !c.directs[0].texto.includes('*'), c.directs[0]?.texto)
  confere('instagram: nota no direct', c.banco.db.instagram_mensagens.some((m) => m.direcao === 'nota' && m.texto.includes('pode aguardar')))
}
{
  const c = cenario({ alertas: [alerta({ canal: 'Instagram', conversa_whatsapp: null, conversa_instagram: 'ig-1' })], instagram: { ultima: haMinutos(26 * 60) } })
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:urgente`))
  confere('instagram fechado: nada sai e o medico fica sabendo', c.directs.length === 0 && c.para(MEDICO).at(-1)?.includes('janela de 24 horas do Instagram fechou'), c.para(MEDICO).at(-1))
  confere('instagram fechado: nota diz que nao chegou', c.banco.db.instagram_mensagens.some((m) => m.direcao === 'nota' && m.texto.includes('NÃO chegou')))
}

// 9. Alerta de teste da tela.
{
  const c = cenario({ alertas: [alerta({ teste: true, conversa_whatsapp: null, quem: 'Teste da Central' })] })
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:urgente`))
  confere('teste: responde que funcionou e nada sai', c.para(MEDICO).at(-1)?.includes('Era um alerta de teste') && c.para(FAMILIA).length === 0)
}

console.log(`resposta ao alerta: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
