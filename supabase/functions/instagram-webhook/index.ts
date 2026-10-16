/**
 * Webhook do Instagram da clinica (16/10/2026): direct e comentarios.
 *
 * Funcao separada do meta-webhook de proposito: o WhatsApp esta em producao com
 * familias de verdade, e nada do Instagram pode derruba-lo. As decisoes ficam em
 * _shared/instagram.ts (testadas); aqui so o banco e a Meta.
 *
 * Para cada mensagem no direct: grava, decide (robo de regras ou atendente com
 * IA, conforme clinic_settings.assistente_ia), responde e, quando a conversa
 * precisa de gente, marca na tela e avisa no celular da equipe. Para cada
 * comentario que pede contato: resposta privada no direct + "te mandei no
 * direct" em publico. Pergunta que nao e de servico fica para a equipe.
 */
import { adminClient, safeEqual, sha256HmacHex } from '../_shared/whatsapp.ts'
import { RegistroDeEventos } from '../_shared/eventos-do-webhook.ts'
import {
  comentarioEPergunta,
  comentarioPedeContato,
  conhecimentoParaOInstagram,
  respostaDoFluxo,
  respostaPrivadaAoComentario,
  respostaPublicaAoComentario,
  responderDirect,
  tokenPrecisaRenovar,
  type ContextoDoDirect,
  type MotivoInstagram,
  type RespostaDoDirect,
} from '../_shared/instagram.ts'
import {
  enviarDirect,
  perfilDe,
  renovarToken,
  responderComentarioEmPublico,
  responderComentarioNoDirect,
  type ContaInstagram,
} from '../_shared/instagram-api.ts'
import { carregarRespostas } from '../_shared/respostas.ts'
import { conhecimentoDaClinica, horariosEmTexto, lugaresParaOInstagram, type Resultado } from '../_shared/atendimento.ts'
import { atenderComAssistente, claudePelaApi, lerModo, type ModoDoAssistente, type Situacao } from '../_shared/assistente.ts'
import { quemAtende } from '../_shared/quem-atende.ts'
import { EXPEDIENTE } from '../_shared/expediente.ts'
import { avisarEquipe } from '../_shared/push-da-equipe.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

type Conta = ContaInstagram & {
  clinic_id: string
  username: string | null
  whatsapp: string
  token_expira_em: string | null
  robo_direct: boolean
  robo_comentarios: boolean
}
type Admin = ReturnType<typeof adminClient>

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

function emSegundoPlano(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(p)
  else void p
}

async function assinaturaValida(req: Request, rawBody: string): Promise<boolean> {
  const recebida = req.headers.get('x-hub-signature-256') ?? ''
  if (!recebida.startsWith('sha256=')) return false
  // O Instagram com login proprio assina com o segredo do app do Instagram; o
  // WhatsApp, com o do app da Meta. Aceita qualquer um dos dois configurados.
  const segredos = [Deno.env.get('INSTAGRAM_APP_SECRET'), Deno.env.get('META_APP_SECRET')]
    .map((s) => s?.trim())
    .filter(Boolean) as string[]
  for (const segredo of segredos) {
    if (safeEqual(`sha256=${await sha256HmacHex(segredo, rawBody)}`, recebida)) return true
  }
  return false
}

async function registrarErroDaConta(admin: Admin, conta: Conta, erro: string) {
  console.warn('Instagram recusou', conta.ig_user_id, erro)
  await admin
    .from('instagram_contas')
    .update({ ultimo_erro: erro.slice(0, 500), ultimo_erro_em: new Date().toISOString() })
    .eq('clinic_id', conta.clinic_id)
}

/** Renova o token em segundo plano quando faltam menos de 15 dias; falha vai para a tela. */
async function renovarSePreciso(admin: Admin, conta: Conta) {
  if (!tokenPrecisaRenovar(conta.token_expira_em)) return
  const r = await renovarToken(conta.access_token)
  if (!r.ok) {
    await registrarErroDaConta(admin, conta, `Não consegui renovar o acesso ao Instagram: ${r.erro}`)
    return
  }
  const { error } = await admin
    .from('instagram_contas')
    .update({ access_token: r.token, token_expira_em: r.expiraEm, token_renovado_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('clinic_id', conta.clinic_id)
  if (error) await registrarErroDaConta(admin, conta, `Renovei o acesso, mas não consegui gravar: ${error.message}`)
}

async function montarContexto(admin: Admin, conta: Conta): Promise<Omit<ContextoDoDirect, 'primeiraVez'>> {
  const quem = quemAtende(conta.clinic_id)
  const [respostas, lugares] = await Promise.all([
    carregarRespostas(admin, conta.clinic_id),
    lugaresParaOInstagram(admin, conta.clinic_id).catch((erro) => {
      console.warn('Instagram sem as unidades da clinica', erro)
      return { unidades: [], tele: null }
    }),
  ])
  return {
    saudacao: quem.saudacaoPadrao,
    medico: quem.o,
    whatsapp: conta.whatsapp,
    respostas,
    unidades: lugares.unidades,
    tele: lugares.tele,
    horarioDaEquipe: `de ${EXPEDIENTE.texto}`,
  }
}

async function avisar(admin: Admin, conta: Conta, motivo: MotivoInstagram, quem: string, texto: string) {
  const titulo = motivo === 'urgencia' ? '🚨 Urgência no Instagram' : 'Instagram: mensagem para a equipe'
  emSegundoPlano(
    avisarEquipe(admin, conta.clinic_id, {
      titulo,
      corpo: `${quem ? `@${quem}: ` : ''}${texto}`.slice(0, 180),
      etiqueta: `instagram-${quem || 'contato'}`,
      conversa: '',
      urgente: motivo === 'urgencia',
    }),
  )
}

async function enviarResposta(admin: Admin, conta: Conta, conversaId: string, igsid: string, r: RespostaDoDirect) {
  // Grava ANTES de enviar: o eco da Meta pode chegar antes da resposta da API,
  // e um eco sem dono virava "mensagem da equipe" - e o robo ficava 2 h calado.
  const { data: linha, error } = await admin
    .from('instagram_mensagens')
    .insert({ clinic_id: conta.clinic_id, conversa_id: conversaId, direcao: 'saida', texto: r.texto, automatica: true, status: 'enviando' })
    .select('id')
    .single()
  if (error) console.error('Instagram: nao consegui gravar a resposta antes de enviar', error)
  const envio = await enviarDirect(conta, igsid, r.texto, r.opcoes ?? [])
  const agora = new Date().toISOString()
  if (linha?.id) {
    const { error: erroDoEnvio } = await admin
      .from('instagram_mensagens')
      .update({ mid: envio.ok ? envio.mid : null, status: envio.ok ? 'enviada' : 'falhou', erro: envio.ok ? null : envio.erro })
      .eq('id', linha.id)
    // O eco pode ter gravado o mid primeiro (unique): a mensagem ja esta registrada.
    if (erroDoEnvio && erroDoEnvio.code !== '23505') console.error('Instagram: resposta enviada mas status nao gravado', erroDoEnvio)
  }
  if (!envio.ok) {
    await registrarErroDaConta(admin, conta, envio.erro)
    // A familia ficou sem resposta: a conversa vai para a equipe, com motivo.
    await admin.from('instagram_conversas').update({ precisa_equipe: true, motivo: 'falha', ultima_mensagem_em: agora }).eq('id', conversaId)
  } else {
    await admin.from('instagram_conversas').update({ ultima_mensagem_em: agora }).eq('id', conversaId)
  }
  return envio.ok
}

/** Historico do direct no formato da atendente com IA. */
async function historico(admin: Admin, conversaId: string): Promise<Situacao['historico']> {
  const { data } = await admin
    .from('instagram_mensagens')
    .select('direcao,texto,created_at')
    .eq('conversa_id', conversaId)
    .in('direcao', ['entrada', 'saida'])
    .order('created_at', { ascending: false })
    .limit(16)
  return ((data ?? []) as { direcao: string; texto: string | null }[])
    .reverse()
    .filter((m) => (m.texto ?? '').trim())
    .map((m) => ({ de: m.direcao === 'entrada' ? ('familia' as const) : ('consultorio' as const), texto: String(m.texto) }))
}

async function decidir(
  admin: Admin,
  conta: Conta,
  conversaId: string,
  texto: string,
  payload: string | null,
  anexo: boolean,
  ctx: ContextoDoDirect,
  modo: ModoDoAssistente,
): Promise<{ resposta: RespostaDoDirect | null; nota?: string }> {
  const direto = responderDirect(texto, payload, ctx)
  // Botao tocado e anexo ficam sempre com o robo: a resposta ja e a certa.
  if (modo === 'desligado' || payload || anexo) return { resposta: direto }

  const chave = Deno.env.get('ANTHROPIC_API_KEY')?.trim() || null
  const hist = await historico(admin, conversaId)
  const ultima = hist.at(-1)
  if (ultima && ultima.de === 'familia' && ultima.texto.trim() === texto.trim()) hist.pop()
  let conhecimento = ''
  try {
    conhecimento = conhecimentoParaOInstagram(await conhecimentoDaClinica(admin as never, conta.clinic_id))
  } catch (erro) {
    console.warn('Instagram: IA sem os textos da clinica', erro)
  }
  const situacao: Situacao = {
    texto,
    anexo,
    etapa: null,
    ultimaDoConsultorio: [...hist].reverse().find((m) => m.de === 'consultorio')?.texto ?? null,
    historico: hist,
    criancas: [],
    consultas: [],
    conhecimento,
    quemAtende: ctx.medico,
    agora: new Date(),
    equipeConversando: false,
    canal: 'Instagram',
  }
  const comoResultado = (r: RespostaDoDirect): Resultado => ({ resposta: r.texto, ...(r.atencao ? { atencao: r.atencao === 'medico' ? 'atendente' : r.atencao } : {}) })
  const desfecho = await atenderComAssistente({
    modo,
    situacao,
    chamar: chave ? claudePelaApi(chave) : null,
    roboDireto: async () => comoResultado(direto),
    ferramentas: {
      robo: async (t) => comoResultado(respostaDoFluxo(t, ctx)),
      horarios: (unidade) => horariosEmTexto(admin as never, conta.clinic_id, unidade),
      equipe: async (motivo, t) => ({ resposta: t, atencao: motivo }),
    },
  })
  if (desfecho.origem === 'robo' || !desfecho.resultado) return { resposta: direto, nota: desfecho.nota }
  // A IA respondeu. Se o texto dela e o de um fluxo (link, menu), os botoes do fluxo vao junto.
  const fluxo = respostaDoFluxo(texto, ctx)
  const mesmoTexto = desfecho.resultado.resposta === fluxo.texto
  const atencao = desfecho.resultado.atencao
  return {
    resposta: {
      texto: desfecho.resultado.resposta,
      opcoes: mesmoTexto ? fluxo.opcoes : undefined,
      atencao: atencao === 'urgencia' ? 'urgencia' : atencao ? 'atendente' : undefined,
      acao: 'ia',
    },
    nota: desfecho.nota,
  }
}

async function tratarMensagem(admin: Admin, conta: Conta, ev: Record<string, any>, registro: RegistroDeEventos) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const msg = ev.message
  if (!msg?.mid) return
  const agora = new Date().toISOString()

  // Eco: o que saiu da conta. O que o robo mandou ja esta gravado (mesmo mid);
  // o que alguem da equipe escreveu pelo app do Instagram entra no historico.
  if (msg.is_echo) {
    const igsid = String(ev.recipient?.id ?? '')
    if (!igsid) return
    const { data: conversa } = await admin.from('instagram_conversas').select('id').eq('clinic_id', conta.clinic_id).eq('igsid', igsid).maybeSingle()
    if (!conversa) return
    // O que o robo ou a tela mandou ja tem linha, gravada antes do envio: o eco
    // so confirma. Mesmo texto nos ultimos 5 minutos = a mesma mensagem.
    const cincoMinutos = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: nossa } = await admin
      .from('instagram_mensagens')
      .select('id,mid')
      .eq('conversa_id', conversa.id)
      .eq('direcao', 'saida')
      .eq('texto', String(msg.text ?? ''))
      .gte('created_at', cincoMinutos)
      .limit(1)
    if (nossa?.length) return
    await admin.from('instagram_mensagens').upsert(
      { clinic_id: conta.clinic_id, conversa_id: conversa.id, direcao: 'saida', texto: String(msg.text ?? '[anexo]'), mid: msg.mid, automatica: false, status: 'enviada' },
      { onConflict: 'mid', ignoreDuplicates: true },
    )
    return
  }

  const igsid = String(ev.sender?.id ?? '')
  if (!igsid || igsid === conta.ig_user_id) return
  if ((await registro.registrar(`ig:message:${msg.mid}`, 'instagram_message', ev)) === 'repetido') return

  const texto = String(msg.text ?? '').trim()
  const anexoUrl = String(msg.attachments?.[0]?.payload?.url ?? '') || null
  const payload = msg.quick_reply?.payload ? String(msg.quick_reply.payload) : null

  const { data: existente } = await admin
    .from('instagram_conversas')
    .select('id,username,nao_lidas,precisa_equipe')
    .eq('clinic_id', conta.clinic_id)
    .eq('igsid', igsid)
    .maybeSingle()
  let conversa = existente as { id: string; username: string | null; nao_lidas: number; precisa_equipe: boolean } | null
  const primeiraVez = !conversa
  if (!conversa) {
    const { data, error } = await admin
      .from('instagram_conversas')
      .insert({ clinic_id: conta.clinic_id, igsid, username: await perfilDe(conta, igsid), ultima_mensagem_em: agora, ultima_da_pessoa_em: agora })
      .select('id,username,nao_lidas,precisa_equipe')
      .single()
    if (error) throw error
    conversa = data
  }
  const conversaId = conversa!.id

  const { error: erroDaEntrada } = await admin.from('instagram_mensagens').insert({
    clinic_id: conta.clinic_id,
    conversa_id: conversaId,
    direcao: 'entrada',
    texto: texto || (anexoUrl ? '[anexo]' : '[mensagem]'),
    mid: msg.mid,
    anexo_url: anexoUrl,
    status: 'recebida',
  })
  if (erroDaEntrada && erroDaEntrada.code !== '23505') throw erroDaEntrada
  await admin
    .from('instagram_conversas')
    .update({ status: 'aberta', ultima_mensagem_em: agora, ultima_da_pessoa_em: agora, nao_lidas: (conversa!.nao_lidas ?? 0) + 1 })
    .eq('id', conversaId)

  // Robo desligado na tela: a conversa vai inteira para a equipe.
  if (!conta.robo_direct) {
    await admin.from('instagram_conversas').update({ precisa_equipe: true, motivo: 'atendente' }).eq('id', conversaId)
    if (!conversa!.precisa_equipe) await avisar(admin, conta, 'atendente', conversa!.username ?? '', texto || 'Mensagem no direct')
    registro.concluir()
    return
  }

  // Alguem da equipe respondeu pelo app ha menos de 2 h: quem conversa e ela.
  const duasHoras = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  const { data: daEquipe } = await admin
    .from('instagram_mensagens')
    .select('id')
    .eq('conversa_id', conversaId)
    .eq('direcao', 'saida')
    .eq('automatica', false)
    .gte('created_at', duasHoras)
    .limit(1)
  if (daEquipe?.length) {
    registro.concluir()
    return
  }

  let modo: ModoDoAssistente = 'desligado'
  try {
    const { data, error } = await admin.from('clinic_settings').select('assistente_ia').eq('clinic_id', conta.clinic_id).maybeSingle()
    if (error) throw error
    modo = lerModo((data as { assistente_ia?: string } | null)?.assistente_ia)
  } catch (erro) {
    console.warn('Instagram: sem clinic_settings.assistente_ia; robo de regras', erro)
  }

  const base = await montarContexto(admin, conta)
  const ctx: ContextoDoDirect = { ...base, primeiraVez }
  const { resposta, nota } = await decidir(admin, conta, conversaId, texto, payload, Boolean(anexoUrl), ctx, modo)
  if (nota) {
    await admin.from('instagram_mensagens').insert({ clinic_id: conta.clinic_id, conversa_id: conversaId, direcao: 'nota', texto: nota, automatica: true })
  }
  if (resposta) {
    await enviarResposta(admin, conta, conversaId, igsid, resposta)
    if (resposta.atencao) {
      await admin.from('instagram_conversas').update({ precisa_equipe: true, motivo: resposta.atencao }).eq('id', conversaId)
      if (!conversa!.precisa_equipe) await avisar(admin, conta, resposta.atencao, conversa!.username ?? '', texto || 'Mensagem no direct')
    }
  }
  registro.concluir()
}

async function tratarComentario(admin: Admin, conta: Conta, valor: Record<string, any>, registro: RegistroDeEventos, ctx: () => Promise<Omit<ContextoDoDirect, 'primeiraVez'>>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const commentId = String(valor?.id ?? '')
  const autorId = String(valor?.from?.id ?? '')
  if (!commentId || !autorId || autorId === conta.ig_user_id) return
  if ((await registro.registrar(`ig:comment:${commentId}`, 'instagram_comment', valor)) === 'repetido') return

  const texto = String(valor?.text ?? '').trim()
  const username = String(valor?.from?.username ?? '')
  const pedeContato = comentarioPedeContato(texto)
  const pergunta = !pedeContato && comentarioEPergunta(texto)
  const { error } = await admin.from('instagram_comentarios').insert({
    clinic_id: conta.clinic_id,
    comment_id: commentId,
    media_id: valor?.media?.id ? String(valor.media.id) : null,
    autor_id: autorId,
    autor_username: username || null,
    texto,
    precisa_equipe: pergunta || (pedeContato && !conta.robo_comentarios),
  })
  if (error && error.code !== '23505') throw error

  if (pedeContato && conta.robo_comentarios) {
    const c = await ctx()
    const privado = await responderComentarioNoDirect(conta, commentId, respostaPrivadaAoComentario(username, c))
    const publica = respostaPublicaAoComentario(commentId)
    const publico = privado.ok ? await responderComentarioEmPublico(conta, commentId, publica) : null
    const agora = new Date().toISOString()
    const erros = [!privado.ok ? `direct: ${privado.erro}` : '', publico && !publico.ok ? `público: ${publico.erro}` : ''].filter(Boolean).join(' · ')
    await admin
      .from('instagram_comentarios')
      .update({
        respondido_no_direct_em: privado.ok ? agora : null,
        resposta_publica: publico?.ok ? publica : null,
        respondido_em_publico_em: publico?.ok ? agora : null,
        erro: erros || null,
        // Nao saiu: fica para a equipe responder pela tela.
        precisa_equipe: !privado.ok,
      })
      .eq('comment_id', commentId)
    if (erros) await registrarErroDaConta(admin, conta, `Comentário de @${username}: ${erros}`)
    if (!privado.ok) await avisar(admin, conta, 'atendente', username, `Comentário: ${texto}`)
  } else if (pergunta) {
    await avisar(admin, conta, 'atendente', username, `Pergunta num comentário: ${texto}`)
  }
  registro.concluir()
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const esperado = (Deno.env.get('INSTAGRAM_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN'))?.trim()
    const challenge = url.searchParams.get('hub.challenge')
    if (esperado && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === esperado && challenge) {
      return text(challenge)
    }
    return text('Webhook verification failed', 403)
  }
  if (req.method !== 'POST') return text('Method not allowed', 405)

  const rawBody = await req.text()
  if (!(await assinaturaValida(req, rawBody))) return text('Invalid signature', 401)

  let registro: RegistroDeEventos | null = null
  try {
    const payload = JSON.parse(rawBody)
    if (payload.object !== 'instagram') return text('EVENT_RECEIVED')
    const admin = adminClient()
    registro = new RegistroDeEventos({
      inserir: (linha) => admin.from('whatsapp_webhook_events').insert(linha),
      apagar: (chave) => admin.from('whatsapp_webhook_events').delete().eq('event_key', chave),
    })

    for (const entry of payload.entry ?? []) {
      registro.concluir()
      const igUserId = String(entry.id ?? '')
      if (!igUserId) continue
      const { data: conta, error } = await admin
        .from('instagram_contas')
        .select('clinic_id,ig_user_id,username,access_token,whatsapp,token_expira_em,robo_direct,robo_comentarios')
        .eq('ig_user_id', igUserId)
        .maybeSingle()
      if (error) throw error
      if (!conta) {
        console.warn('Instagram: aviso de uma conta que nao esta conectada', igUserId)
        continue
      }
      emSegundoPlano(renovarSePreciso(admin, conta as Conta).catch((erro) => console.warn('Instagram: renovacao do token falhou', erro)))

      let contexto: Promise<Omit<ContextoDoDirect, 'primeiraVez'>> | null = null
      const ctx = () => (contexto ??= montarContexto(admin, conta as Conta))

      for (const ev of entry.messaging ?? []) {
        registro.concluir()
        await tratarMensagem(admin, conta as Conta, ev, registro)
      }
      for (const change of entry.changes ?? []) {
        registro.concluir()
        if (change.field !== 'comments') continue
        await tratarComentario(admin, conta as Conta, change.value ?? {}, registro, ctx)
      }
    }
    return text('EVENT_RECEIVED')
  } catch (erro) {
    console.error('instagram-webhook falhou', erro)
    // O 500 pede para a Meta reenviar; a chave do evento que falhou e liberada
    // para o reenvio processar de novo (ver eventos-do-webhook.ts).
    await registro?.desfazerEmCurso()
    return text('Processing failed', 500)
  }
})
