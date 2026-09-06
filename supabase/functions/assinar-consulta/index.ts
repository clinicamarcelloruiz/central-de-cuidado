import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'
import { montarPdfDoAtendimento } from '../_shared/pdf-do-prontuario.ts'

/**
 * Assinatura digital do atendimento com o certificado ICP-Brasil do medico.
 *
 * Duas etapas, porque tem um humano no meio:
 *
 *   iniciar  - o sistema pede a permissao a BRy e devolve o endereco do VIDaaS.
 *              O medico sai daqui, aprova com a digital no celular, e o
 *              navegador volta com o numero do pedido.
 *   concluir - o sistema monta o PDF a partir do banco, manda assinar com a
 *              permissao guardada, e arquiva o documento assinado.
 *
 * Por que o PDF nasce aqui e nao no navegador: a assinatura precisa provar que
 * o medico assinou AQUELE atendimento, e nao um PDF qualquer que o navegador
 * montou. Gerando no servidor a partir das mesmas linhas do banco, o documento
 * assinado e o registro sao a mesma coisa por construcao.
 *
 * O que esta funcao NAO faz: nao marca nada como assinado sem que a BRy tenha
 * devolvido o arquivo. Um prontuario que diz "assinado" sem estar e pior do que
 * um que diz "pendente", porque ninguem vai conferir.
 */

type Pedido =
  | { acao: 'iniciar'; consultationId: string; voltarPara?: string }
  | { acao: 'concluir'; pedido: string }

const AMBIENTES = {
  producao: {
    cloud: 'https://cloud.bry.com.br',
    integra: 'https://integra.bry.com.br/api/service',
  },
  homologacao: {
    cloud: 'https://cloud-hom.bry.com.br',
    integra: 'https://integra.hom.bry.com.br/api/service',
  },
}

function ambiente() {
  const producao = Deno.env.get('BRY_AMBIENTE')?.trim().toLowerCase() === 'producao'
  return producao ? AMBIENTES.producao : AMBIENTES.homologacao
}

async function tokenDaBry(cloud: string) {
  const clientId = Deno.env.get('BRY_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET')?.trim()
  if (!clientId || !clientSecret) throw new Error('Chaves da BRy não configuradas.')

  const resposta = await fetch(`${cloud}/token-service/jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!resposta.ok) throw new Error(`A BRy recusou as credenciais (${resposta.status}).`)
  const dados = await resposta.json()
  if (!dados?.access_token) throw new Error('A BRy respondeu sem token de acesso.')
  return dados.access_token as string
}

/**
 * A recusa do assinador significa "ainda nao autorizou" ou "deu errado"?
 *
 * Nao ha codigo unico documentado para o primeiro caso, entao a leitura e por
 * aproximacao: 401 e 403 sao a credencial sem permissao, e o texto costuma
 * falar em autorizacao, credencial ou sessao. Tudo o mais e falha real.
 * Errar para o lado da espera custa alguns segundos a mais; errar para o lado
 * da falha marca como falho um pedido que ainda ia dar certo.
 */
function pareceAguardandoAutorizacao(status: number, texto: string) {
  if (status === 401 || status === 403) return true
  return /autoriz|credencial|credential|unauthori|pendente|pending|sess[aã]o|session|aguard|n[aã]o (foi )?aprovad/i
    .test(texto)
}

async function digitalDoArquivo(bytes: Uint8Array) {
  const resumo = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

  const env = ambiente()
  const admin = adminClient()
  const escopo = userClient(autorizacao)

  try {
    const corpo = (await req.json()) as Pedido

    // -----------------------------------------------------------------------
    // ETAPA 1 - pedir a permissao
    // -----------------------------------------------------------------------
    if (corpo.acao === 'iniciar') {
      if (!corpo.consultationId) return json({ error: 'Consulta não informada.' }, 400)

      // A RLS e a autorizacao: se a consulta nao aparece para este usuario, ele
      // nao pode manda-la assinar. Nao ha checagem de papel aqui alem dessa -
      // e a mesma regra que ja governa quem enxerga o prontuario.
      const { data: consulta, error: erroConsulta } = await escopo
        .from('consultations')
        .select('id,clinic_id,patient_id,signed_at')
        .eq('id', corpo.consultationId)
        .maybeSingle()

      if (erroConsulta) {
        console.error('Falha ao ler a consulta', erroConsulta)
        return json({ error: 'Falha ao verificar o atendimento.' }, 500)
      }
      if (!consulta) return json({ error: 'Atendimento não encontrado.', code: 'NOT_VISIBLE' }, 403)
      if (consulta.signed_at) {
        return json({
          error: 'Este atendimento já está assinado.',
          code: 'JA_ASSINADO',
        }, 409)
      }

      const cpf = Deno.env.get('BRY_CPF_MEDICO')?.trim()
      if (!cpf) return json({ error: 'CPF do certificado não configurado.', code: 'SEM_CPF' }, 503)

      const token = await tokenDaBry(env.cloud)

      // O id do pedido e gerado antes da chamada porque a BRy devolve o "state"
      // sem alteracao: e por ele que a volta do VIDaaS sabe qual atendimento
      // estava sendo assinado.
      const pedidoId = crypto.randomUUID()
      const destino = corpo.voltarPara ||
        Deno.env.get('BRY_REDIRECT_URI')?.trim() ||
        'https://clinicamarcelloruiz.github.io/central-de-cuidado/'

      const resposta = await fetch(`${env.integra}/psc/link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pscName: 'Vidaas',
          redirectUri: destino,
          state: pedidoId,
          // Uma assinatura por autorizacao, por escolha do medico. Trocar para
          // 'signature_session' (com lifetime maior) faz ele aprovar uma vez
          // por periodo em vez de uma vez por atendimento.
          scope: 'single_signature',
          numberOfDocuments: 1,
          lifetime: 900,
          cpf,
        }),
      })

      const texto = await resposta.text()
      if (!resposta.ok) {
        console.error('psc/link recusado', resposta.status, texto)
        return json({
          error: 'A certificadora recusou o pedido de autorização.',
          code: 'PSC_RECUSOU',
          details: texto.slice(0, 300),
        }, 502)
      }

      const dados = JSON.parse(texto) as { token?: string; url?: string }
      if (!dados.url || !dados.token) {
        return json({ error: 'A certificadora respondeu incompleta.', code: 'PSC_INCOMPLETO' }, 502)
      }

      const { data: usuario } = await escopo.auth.getUser()

      const expiraEm = new Date(Date.now() + 900 * 1000).toISOString()
      const { error: erroPedido } = await admin.from('signature_requests').insert({
        id: pedidoId,
        clinic_id: consulta.clinic_id,
        consultation_id: consulta.id,
        patient_id: consulta.patient_id,
        requested_by: usuario?.user?.id ?? null,
        psc_credential: dados.token,
        expires_at: expiraEm,
      })

      if (erroPedido) {
        console.error('Falha ao guardar o pedido', erroPedido)
        return json({ error: 'Falha ao registrar o pedido de assinatura.' }, 500)
      }

      return json({ ok: true, pedido: pedidoId, autorizarEm: dados.url, expiraEm })
    }

    // -----------------------------------------------------------------------
    // ETAPA 2 - assinar, ja com a permissao dada
    // -----------------------------------------------------------------------
    if (corpo.acao === 'concluir') {
      if (!corpo.pedido) return json({ error: 'Pedido não informado.' }, 400)

      const { data: pedido } = await admin
        .from('signature_requests')
        .select('id,clinic_id,consultation_id,patient_id,psc_credential,expires_at,used_at')
        .eq('id', corpo.pedido)
        .maybeSingle()

      if (!pedido) return json({ error: 'Pedido de assinatura não encontrado.' }, 404)
      if (pedido.used_at) return json({ error: 'Este pedido já foi usado.', code: 'JA_USADO' }, 409)
      if (new Date(pedido.expires_at).getTime() < Date.now()) {
        return json({
          error: 'A autorização expirou. Peça a assinatura de novo.',
          code: 'EXPIROU',
        }, 409)
      }

      // O pedido veio do banco com service_role, que ignora RLS. A checagem de
      // acesso precisa ser refeita com os olhos do usuario, senao qualquer
      // sessao valida poderia concluir o pedido de outra clinica.
      const { data: consulta } = await escopo
        .from('consultations')
        .select(
          'id,clinic_id,patient_id,consultation_date,encounter_type,unit,weight_kg,height_cm,chief_complaint,clinical_history,personal_history,family_history,allergies,current_medications,physical_exam,assessment,cid,plan,prescription,return_plan,signed_at',
        )
        .eq('id', pedido.consultation_id)
        .maybeSingle()

      if (!consulta) return json({ error: 'Atendimento não encontrado.', code: 'NOT_VISIBLE' }, 403)
      if (consulta.signed_at) {
        return json({ error: 'Este atendimento já está assinado.', code: 'JA_ASSINADO' }, 409)
      }

      const { data: paciente } = await escopo
        .from('patients')
        .select('name,birth_date,sex,guardian_name,insurance')
        .eq('id', pedido.patient_id)
        .maybeSingle()

      if (!paciente) return json({ error: 'Paciente não encontrado.' }, 404)

      const { data: clinica } = await admin
        .from('clinics')
        .select('name')
        .eq('id', pedido.clinic_id)
        .maybeSingle()

      const { data: ajustes } = await admin
        .from('clinic_settings')
        .select('signer_name,signer_crm')
        .eq('clinic_id', pedido.clinic_id)
        .maybeSingle()

      // O selo da corrente entra no rodape para ligar o papel ao registro: quem
      // tiver o PDF na mao consegue perguntar ao sistema se aquele atendimento
      // continua igual ao que foi assinado.
      const { data: integridade } = await admin.rpc('conferir_integridade_prontuario', {
        p_clinic_id: pedido.clinic_id,
      })

      const pdf = await montarPdfDoAtendimento({
        clinica: clinica?.name ?? 'Clínica',
        medico: ajustes?.signer_name ?? 'Médico responsável',
        crm: ajustes?.signer_crm ?? '',
        paciente,
        consulta,
        selo: Array.isArray(integridade) ? integridade[0]?.selo ?? null : null,
        geradoEm: new Date(),
      })

      const token = await tokenDaBry(env.cloud)

      // O endereco do assinador e o perfil ficam configuraveis porque sao a
      // parte da integracao que ainda nao foi confirmada com a BRy. Errar aqui
      // e uma troca de segredo, e nao uma reimplantacao as pressas.
      const enderecoAssinador = Deno.env.get('BRY_ASSINATURA_URL')?.trim() ||
        `${env.integra}/fw/v1/pdf/kms/lote/assinaturas`
      const urlDoPsc = Deno.env.get('BRY_PSC_URL')?.trim() || 'https://psc.bry.com.br'
      // ADRB: assinatura ICP-Brasil basica. O perfil ADRT acrescenta carimbo do
      // tempo de autoridade credenciada - e o que prova a DATA perante
      // terceiros, nao so a autoria. Fica para depois de sabermos o preco dele.
      const perfil = Deno.env.get('BRY_PERFIL')?.trim() || 'ADRB'

      const formulario = new FormData()
      formulario.append(
        'documento[0]',
        new Blob([pdf], { type: 'application/pdf' }),
        `atendimento-${consulta.consultation_date}.pdf`,
      )
      formulario.append(
        'dados_assinatura',
        JSON.stringify({
          kms_data: { url: urlDoPsc, token: pedido.psc_credential },
          perfil,
          algoritmoHash: 'SHA256',
          tipoRetorno: 'BASE64',
          razao: 'Registro de atendimento médico',
          // Depois de assinado o documento nao aceita mais alteracao: e um
          // registro de prontuario, nao um formulario.
          tipoRestricao: 'DESABILITAR_QUALQUER_ALTERACAO',
        }),
      )

      const assinatura = await fetch(enderecoAssinador, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, kms_type: 'PSC' },
        body: formulario,
      })

      const respostaTexto = await assinatura.text()

      if (!assinatura.ok) {
        // Ainda sem autorizacao no celular nao e falha: e espera. A tela
        // pergunta de novo em alguns segundos. So vira falha de verdade quando
        // o pedido expira ou quando a recusa e por outro motivo.
        //
        // Isto existe porque a volta do VIDaaS por redirecionamento nunca
        // chegou ao sistema: em 06/09/2026 o medico autorizou nove vezes no
        // celular e nove pedidos ficaram sem uso, sem falha, sem nada. Com a
        // tela perguntando, a assinatura nao depende de ninguem "voltar".
        if (pareceAguardandoAutorizacao(assinatura.status, respostaTexto)) {
          return json({
            ok: false,
            code: 'AGUARDANDO',
            error: 'Aguardando a autorização no celular.',
            status: assinatura.status,
            details: respostaTexto.slice(0, 300),
          }, 202)
        }

        console.error('Assinador recusou', assinatura.status, respostaTexto)
        await admin
          .from('signature_requests')
          .update({ failed_at: new Date().toISOString(), failure_reason: respostaTexto.slice(0, 500) })
          .eq('id', pedido.id)

        return json({
          error: 'A assinatura não foi concluída.',
          code: 'ASSINADOR_RECUSOU',
          status: assinatura.status,
          details: respostaTexto.slice(0, 500),
        }, 502)
      }

      const retorno = JSON.parse(respostaTexto)
      const base64 = Array.isArray(retorno) ? retorno[0] : retorno?.documentos?.[0]?.base64
      if (typeof base64 !== 'string') {
        return json({
          error: 'A certificadora não devolveu o documento assinado.',
          code: 'SEM_DOCUMENTO',
          details: respostaTexto.slice(0, 300),
        }, 502)
      }

      const assinado = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const digital = await digitalDoArquivo(assinado)
      const caminho = `${pedido.clinic_id}/${pedido.consultation_id}.pdf`

      const { error: erroArquivo } = await admin.storage
        .from('prontuarios-assinados')
        .upload(caminho, assinado, { contentType: 'application/pdf', upsert: true })

      if (erroArquivo) {
        console.error('Falha ao arquivar', erroArquivo)
        return json({
          error: 'O documento foi assinado mas não pôde ser arquivado.',
          code: 'FALHA_ARQUIVO',
        }, 500)
      }

      const agora = new Date().toISOString()

      // So agora a consulta vira "assinada" - com o arquivo ja guardado. Se a
      // ordem fosse a inversa, uma falha no meio deixaria um prontuario que
      // afirma estar assinado e um acervo sem o documento.
      const { error: erroMarcar } = await admin
        .from('consultations')
        .update({
          signed_at: agora,
          signed_by_name: ajustes?.signer_name ?? null,
          signature_provider: 'BRy/VIDaaS',
          signature_reference: pedido.id,
          signed_pdf_path: caminho,
          signed_pdf_hash: digital,
        })
        .eq('id', pedido.consultation_id)

      if (erroMarcar) {
        console.error('Falha ao marcar como assinada', erroMarcar)
        return json({
          error: 'O documento foi assinado e arquivado, mas o prontuário não registrou.',
          code: 'FALHA_REGISTRO',
        }, 500)
      }

      await admin
        .from('signature_requests')
        .update({ used_at: agora })
        .eq('id', pedido.id)

      return json({ ok: true, assinadoEm: agora, arquivo: caminho, digital })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (causa) {
    console.error('assinar-consulta falhou', causa)
    return json({ error: String(causa instanceof Error ? causa.message : causa) }, 500)
  }
})
