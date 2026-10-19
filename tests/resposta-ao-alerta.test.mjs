// A resposta do medico ao alerta de urgencia, pelo WhatsApp dele (17/10/2026).
// Regra em supabase/functions/_shared/resposta-ao-alerta.ts. Banco e Meta de
// mentira: o que se testa e o que chega a familia, ao medico e ao registro.
import { escolherAlerta, familiaPeloNome, lerRespostaDaEquipe, papelDoNumero, repassarRespostaDaFamilia, textoParaAFamilia, tratarRespostaDaEquipe } from './resposta-ao-alerta.build.mjs'
import { bancoFalso } from './fixtures/banco-falso.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

const MEDICO = '5513997039614'
const EQUIPE = '5513991165576'
const FAMILIA = '5513988887777'
const FAMILIA2 = '5511977776666'
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
      whatsapp_conversations: [
        { id: 'conv-1', wa_id: FAMILIA, patient_id: 'p1', profile_name: 'Maria Silva', needs_attention: true, attention_reason: 'urgencia' },
        { id: 'conv-2', wa_id: FAMILIA2, patient_id: 'p2', profile_name: 'Joana Lima', needs_attention: true, attention_reason: 'atendente' },
      ],
      whatsapp_messages: [
        { conversation_id: 'conv-1', direction: 'inbound', message_type: 'text', created_at: ultimaDaFamilia },
        { conversation_id: 'conv-2', direction: 'inbound', message_type: 'text', created_at: haMinutos(10) },
      ],
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
// 6b. Varias familias ao mesmo tempo (18/10/2026, primeiro dia de uso: Paula e
// Heitor abertos, e cada mensagem do Edu voltava "Ha 2 alertas recentes").
const dois = () => [alerta(), alerta({ id: A2, quem: 'João Pedro Lima de Souza', conversa_whatsapp: 'conv-2', mensagens: ['wamid.ALERTA2'], criado_em: haMinutos(5) })]
const A3 = '33333333-3333-4333-8333-333333333333'
{
  // Sem conversa ativa: a familia e escolhida num toque, que ja e o "Enviar".
  const c = cenario({ alertas: dois() })
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('pode dar soro'))
  const pergunta = c.enviados.at(-1)
  const botoes = pergunta?.conteudo.interactive?.action?.buttons ?? []
  confere('dois avisos: pergunta para qual familia, com botoes', c.textoDe(pergunta).startsWith('Para qual família vai esta mensagem?') && botoes.length === 3 && c.para(FAMILIA).length === 0 && c.para(FAMILIA2).length === 0, c.textoDe(pergunta))
  // O aviso mais novo primeiro; nome longo vira primeiro e ultimo nome (botao tem 20 letras).
  confere('dois avisos: botoes com os nomes e Cancelar', botoes[0]?.reply?.title === 'João Souza' && botoes[1]?.reply?.title === 'Helena' && botoes[2]?.reply?.title === 'Cancelar', JSON.stringify(botoes.map((b) => b.reply.title)))
  confere('dois avisos: o texto guardado nos dois', c.banco.db.alertas_de_urgencia.every((a) => a.rascunho === 'pode dar soro' && a.rascunho_de === MEDICO))
  await tratarRespostaDaEquipe(c.amb, MEDICO, toqueInterativo(botoes.find((b) => b.reply.title === 'João Souza').reply.id))
  confere('dois avisos: o toque manda para a familia escolhida', c.para(FAMILIA2).at(-1) === '💬 Mensagem do Dr. Marcello: pode dar soro' && c.para(FAMILIA).length === 0, JSON.stringify(c.para(FAMILIA2)))
  confere('dois avisos: o texto sai do outro aviso', c.banco.db.alertas_de_urgencia.every((a) => a.rascunho === null), JSON.stringify(c.banco.db.alertas_de_urgencia.map((a) => a.rascunho)))
  // A seguinte vai para a mesma familia, sem perguntar de novo.
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('e me avisa se ele vomitar de novo'))
  confere('conversa ativa: a seguinte segue para a mesma familia', c.textoDe(c.enviados.at(-1)).includes('Vou mandar para João Pedro Lima de Souza'), c.textoDe(c.enviados.at(-1)))
}
{
  // "Eu respondo" num aviso tambem abre a conversa com ele (o caso do Heitor).
  const c = cenario({ alertas: dois() })
  await tratarRespostaDaEquipe(c.amb, EQUIPE, toque(`URG:${A2}:responde`))
  await tratarRespostaDaEquipe(c.amb, EQUIPE, texto('Tudo bem. Como podemos ajudar?'))
  confere('eu respondo: o texto seguinte vai para a mesma familia', c.textoDe(c.enviados.at(-1)).includes('Vou mandar para João Pedro Lima de Souza, como mensagem da equipe'), c.textoDe(c.enviados.at(-1)))
  // Conversa de um numero nao vale para o outro.
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('pode dar soro'))
  confere('conversa ativa e por numero', c.textoDe(c.enviados.at(-1)).startsWith('Para qual família'), c.textoDe(c.enviados.at(-1)))
}
{
  // Aviso novo depois da ultima resposta: pergunta de novo.
  const c = cenario({ alertas: dois() })
  await tratarRespostaDaEquipe(c.amb, MEDICO, toque(`URG:${A1}:responde`))
  c.banco.db.alertas_de_urgencia.push(alerta({ id: A3, quem: 'Paula', conversa_whatsapp: 'conv-2', mensagens: ['wamid.ALERTA3'], criado_em: new Date(AGORA.getTime() + 60000).toISOString() }))
  c.amb.agora = new Date(AGORA.getTime() + 2 * 60000)
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('como ele esta?'))
  const ultima = c.enviados.at(-1)
  confere('aviso novo: pergunta de novo, em lista com tres familias', c.textoDe(ultima).startsWith('Para qual família') && ultima.conteudo.interactive?.type === 'list' && ultima.conteudo.interactive.action.sections[0].rows.length === 4, JSON.stringify(ultima.conteudo).slice(0, 300))
  // A lista volta em list_reply.
  const linha = ultima.conteudo.interactive.action.sections[0].rows.find((r) => r.title === 'Helena')
  await tratarRespostaDaEquipe(c.amb, MEDICO, { type: 'interactive', interactive: { list_reply: { id: linha.id, title: 'Helena' } } })
  confere('lista: o toque na linha manda', c.para(FAMILIA).at(-1) === '💬 Mensagem do Dr. Marcello: como ele esta?', JSON.stringify(c.para(FAMILIA)))
}
{
  const c = cenario({ alertas: dois() })
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('liga pra ela'))
  const cancelar = c.enviados.at(-1).conteudo.interactive.action.buttons[2].reply.id
  await tratarRespostaDaEquipe(c.amb, MEDICO, toqueInterativo(cancelar))
  confere('escolha cancelada: nada sai e o texto some dos dois', c.para(FAMILIA).length === 0 && c.para(FAMILIA2).length === 0 && c.banco.db.alertas_de_urgencia.every((a) => a.rascunho === null))
}
{
  const c = cenario({ alertas: dois() })
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('ok'))
  confere('"ok" com dois avisos: nao pergunta a familia', c.para(MEDICO).at(-1)?.includes('segure a mensagem do aviso certo'), c.para(MEDICO).at(-1))
}
{
  // So o nome da familia escolhe a conversa (18/10/2026: o Dr. Marcello escreveu
  // "Heitor", tocou no nome, e o Heitor recebeu "Mensagem do Dr. Marcello: Heitor").
  const c = cenario({ alertas: dois() })
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('João'))
  confere('so o nome: escolhe a familia e nada sai', c.para(MEDICO).at(-1) === 'Certo: as próximas mensagens vão para João Pedro Lima de Souza. Escreva o que quer mandar.' && c.para(FAMILIA).length === 0 && c.para(FAMILIA2).length === 0, c.para(MEDICO).at(-1))
  confere('so o nome: nenhum texto guardado', c.banco.db.alertas_de_urgencia.every((a) => a.rascunho === null))
  await tratarRespostaDaEquipe(c.amb, MEDICO, texto('Boa tarde, como podemos ajudar?'))
  confere('so o nome: a mensagem seguinte ja vai para ela', c.textoDe(c.enviados.at(-1)).includes('Vou mandar para João Pedro Lima de Souza'), c.textoDe(c.enviados.at(-1)))
}
confere('nome: com "do" e sobrenome', familiaPeloNome('do joao souza', dois())?.id === A2)
confere('nome: sem acento e maiusculas', familiaPeloNome('HELENA', dois())?.id === A1)
confere('nome: frase nao e nome', familiaPeloNome('Pode dar soro', dois()) === null && familiaPeloNome('Helena pode dar soro aos poucos', dois()) === null)
confere('nome: nome que nao e de ninguem', familiaPeloNome('Paula', dois()) === null)
confere('nome: nome de duas familias nao escolhe', familiaPeloNome('Lima', [...dois(), alerta({ id: A3, quem: 'Paula Lima' })]) === null)
confere('escolherAlerta: ultima resposta decide', escolherAlerta(dois(), null, AGORA, { id: A1, em: haMinutos(1) })?.alerta?.id === A1)
confere('escolherAlerta: aviso mais novo que a resposta pergunta', escolherAlerta(dois(), null, AGORA, { id: A1, em: haMinutos(10) })?.ambiguos?.length === 2)

// 6c. A familia respondendo volta aos celulares (18/10/2026).
{
  const c = cenario({ alertas: [alerta({ respondido_em: haMinutos(3), respondido_por: MEDICO })] })
  const repassou = await repassarRespostaDaFamilia(c.amb, { conversaWhatsApp: 'conv-1', quem: 'Helena', texto: 'Ele vomitou de novo agora' })
  confere('repasse: vai aos dois numeros', repassou && c.para(MEDICO).length === 1 && c.para(EQUIPE).length === 1, JSON.stringify(c.enviados.map((e) => e.para)))
  confere('repasse: o texto da familia', c.para(MEDICO)[0]?.includes('Helena respondeu') && c.para(MEDICO)[0].includes('"Ele vomitou de novo agora"'), c.para(MEDICO)[0])
  confere('repasse: o id entra no aviso, para a resposta em cima voltar', c.banco.db.alertas_de_urgencia[0].mensagens.length === 3, JSON.stringify(c.banco.db.alertas_de_urgencia[0].mensagens))
  await tratarRespostaDaEquipe(c.amb, EQUIPE, texto('Pode dar o soro aos poucos', c.banco.db.alertas_de_urgencia[0].mensagens[2]))
  confere('repasse: responder em cima volta para a mesma familia', c.textoDe(c.enviados.at(-1)).includes('Vou mandar para Helena'), c.textoDe(c.enviados.at(-1)))
}
{
  // 19/10/2026: o Edu respondeu; a familia respondendo nao vai ao medico.
  const c = cenario({ alertas: [alerta({ respondido_em: haMinutos(3), respondido_por: EQUIPE })] })
  const repassou = await repassarRespostaDaFamilia(c.amb, { conversaWhatsApp: 'conv-1', quem: 'Helena', texto: 'Quanto fica a consulta?' })
  confere('repasse: quem da equipe assumiu segue sozinho', repassou && c.para(EQUIPE).length === 1 && c.para(MEDICO).length === 0, JSON.stringify(c.enviados.map((e) => e.para)))
}
{
  // Numero fora da janela de 24 h: o texto livre falha e vai o modelo.
  const c = cenario({ alertas: [alerta({ respondido_em: haMinutos(3), respondido_por: MEDICO })] })
  const enviados = []
  c.amb.enviarWhatsApp = async (para, conteudo) => {
    enviados.push({ para, conteudo })
    if (para === EQUIPE && conteudo.type !== 'template') return { ok: false, erro: 'Re-engagement message' }
    return { ok: true, id: `w${enviados.length}` }
  }
  await repassarRespostaDaFamilia(c.amb, { conversaWhatsApp: 'conv-1', quem: 'Helena', texto: '[image]' })
  const modelo = enviados.find((e) => e.para === EQUIPE && e.conteudo.type === 'template')
  confere('repasse fora da janela: modelo pedido_equipe com o botao do aviso', modelo?.conteudo.template.name === 'pedido_equipe' && modelo.conteudo.template.components[1].parameters[0].payload === `URG:${A1}:responde`, JSON.stringify(modelo?.conteudo))
  confere('repasse: foto vira aviso para ver na Central', JSON.stringify(enviados[0].conteudo).includes('Mandou uma foto'), JSON.stringify(enviados[0].conteudo))
}
{
  const c = cenario({ alertas: [alerta()] })
  confere('sem resposta pelo WhatsApp: nao repassa', (await repassarRespostaDaFamilia(c.amb, { conversaWhatsApp: 'conv-1', quem: 'Helena', texto: 'oi' })) === false && c.enviados.length === 0)
  const velho = cenario({ alertas: [alerta({ respondido_em: haMinutos(7 * 60), respondido_por: MEDICO })] })
  confere('resposta de mais de 6 h: nao repassa', (await repassarRespostaDaFamilia(velho.amb, { conversaWhatsApp: 'conv-1', quem: 'Helena', texto: 'oi' })) === false)
  const outra = cenario({ alertas: [alerta({ respondido_em: haMinutos(3), respondido_por: MEDICO })] })
  confere('outra conversa: nao repassa', (await repassarRespostaDaFamilia(outra.amb, { conversaWhatsApp: 'conv-2', quem: 'Joana', texto: 'oi' })) === false)
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
