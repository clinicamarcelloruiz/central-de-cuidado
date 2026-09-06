import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'

/**
 * Troca a foto de perfil do WhatsApp Business pela API.
 *
 * O Gerenciador da Meta nem sempre deixa trocar a imagem - foi o que aconteceu
 * aqui. Pela API funciona, mas em tres etapas, porque a Meta nao aceita a
 * imagem direto no perfil:
 *
 *   1. abrir uma sessao de upload, dizendo tamanho e tipo do arquivo;
 *   2. enviar os bytes nessa sessao, que devolve um "handle";
 *   3. gravar o handle no perfil.
 *
 * A imagem vem de uma URL publica em vez de subir pelo navegador: assim o
 * arquivo fica versionado junto do site, e trocar a foto amanha e trocar o
 * arquivo la e chamar isto de novo.
 */

type Pedido = { imagemUrl?: string }

const PADRAO = 'https://drmarcelloruiz.com.br/assets/perfil-whatsapp.png'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

  try {
    const escopo = userClient(autorizacao)
    const { data: ajustes } = await escopo
      .from('clinic_settings')
      .select('clinic_id,whatsapp_phone_number_id')
      .maybeSingle()

    if (!ajustes?.whatsapp_phone_number_id) {
      return json({ error: 'WhatsApp não configurado para esta clínica.' }, 409)
    }

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
    const appId = Deno.env.get('META_APP_ID')?.trim()
    if (!token) return json({ error: 'Token do WhatsApp não configurado.' }, 503)
    if (!appId) return json({ error: 'META_APP_ID não configurado.' }, 503)

    const versao = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'
    const corpo = (await req.json().catch(() => ({}))) as Pedido
    const imagemUrl = corpo.imagemUrl?.trim() || PADRAO

    // 1) Buscar a imagem.
    const imagem = await fetch(imagemUrl)
    if (!imagem.ok) {
      return json({ error: `Não consegui baixar a imagem em ${imagemUrl}.`, code: 'SEM_IMAGEM' }, 502)
    }
    const bytes = new Uint8Array(await imagem.arrayBuffer())
    const tipo = imagem.headers.get('content-type') || 'image/png'

    if (!/^image\/(png|jpe?g)$/i.test(tipo)) {
      return json({
        error: `A Meta só aceita PNG ou JPEG na foto de perfil. Este arquivo é ${tipo}.`,
        code: 'FORMATO',
      }, 400)
    }

    // 2) Abrir a sessao de upload. E aqui que o id do aplicativo entra - a
    // sessao pertence ao app, e nao ao numero de telefone.
    const sessao = await fetch(
      `https://graph.facebook.com/${versao}/${appId}/uploads` +
        `?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(tipo)}` +
        `&access_token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    )
    const sessaoCorpo = await sessao.json()
    if (!sessao.ok || !sessaoCorpo?.id) {
      console.error('Falha ao abrir a sessão de upload', sessaoCorpo)
      return json({
        error: 'A Meta recusou a abertura do envio.',
        code: 'SESSAO',
        details: JSON.stringify(sessaoCorpo).slice(0, 400),
      }, 502)
    }

    // 3) Enviar os bytes. O cabecalho de autorizacao aqui e "OAuth", e nao
    // "Bearer" - a Meta usa formatos diferentes entre as duas APIs, e trocar
    // um pelo outro devolve um 401 sem explicacao.
    const envio = await fetch(`https://graph.facebook.com/${versao}/${sessaoCorpo.id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${token}`, file_offset: '0' },
      body: bytes,
    })
    const envioCorpo = await envio.json()
    if (!envio.ok || !envioCorpo?.h) {
      console.error('Falha ao enviar a imagem', envioCorpo)
      return json({
        error: 'A Meta recusou a imagem.',
        code: 'UPLOAD',
        details: JSON.stringify(envioCorpo).slice(0, 400),
      }, 502)
    }

    // 4) Gravar no perfil.
    const perfil = await fetch(
      `https://graph.facebook.com/${versao}/${ajustes.whatsapp_phone_number_id}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          profile_picture_handle: envioCorpo.h,
        }),
      },
    )
    const perfilCorpo = await perfil.json()
    if (!perfil.ok) {
      console.error('Falha ao gravar no perfil', perfilCorpo)
      return json({
        error: 'A imagem subiu mas o perfil não aceitou.',
        code: 'PERFIL',
        details: JSON.stringify(perfilCorpo).slice(0, 400),
      }, 502)
    }

    await adminClient()
      .from('clinic_settings')
      .update({ updated_at: new Date().toISOString() })
      .eq('clinic_id', ajustes.clinic_id)

    return json({ ok: true, imagem: imagemUrl, bytes: bytes.byteLength })
  } catch (causa) {
    console.error('whatsapp-perfil falhou', causa)
    return json({ error: causa instanceof Error ? causa.message : 'Falha inesperada.' }, 500)
  }
})
