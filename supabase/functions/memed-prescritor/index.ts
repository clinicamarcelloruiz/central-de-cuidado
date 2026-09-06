import { adminClient, corsHeaders, json, userClient } from '../_shared/whatsapp.ts'

/**
 * Devolve o token do medico na Memed para a tela abrir a prescricao.
 *
 * Por que passa pelo servidor: o par de chaves da Memed (api-key e secret-key)
 * identifica o SISTEMA, nao o medico. Se ele saisse daqui para o navegador,
 * qualquer um com o console aberto poderia emitir receita em nome da clinica.
 * A Memed inclusive revoga as chaves de producao de quem faz isso.
 *
 * O medico ja tem conta na Memed, com historico e configuracoes proprias. Entao
 * a ordem e sempre: procurar primeiro, cadastrar so se nao existir. Criar uma
 * conta nova em cima de uma existente jogaria fora anos de protocolos dele.
 *
 * O token nao e fixo - a documentacao pede para buscar o mais recente a cada
 * uso, e e por isso que esta funcao existe em vez de um valor guardado.
 */

type Ambiente = { api: string }

function ambiente(): Ambiente {
  const producao = Deno.env.get('MEMED_AMBIENTE')?.trim().toLowerCase() === 'producao'
  return {
    api: producao
      ? 'https://api.memed.com.br/v1'
      : 'https://integrations.api.memed.com.br/v1',
  }
}

/** Chaves da Memed. As de homologacao sao publicas e fixas na documentacao. */
function chaves() {
  const apiKey = Deno.env.get('MEMED_API_KEY')?.trim()
  const secretKey = Deno.env.get('MEMED_SECRET_KEY')?.trim()
  if (!apiKey || !secretKey) throw new Error('Chaves da Memed não configuradas.')
  return `api-key=${encodeURIComponent(apiKey)}&secret-key=${encodeURIComponent(secretKey)}`
}

const CABECALHOS = {
  Accept: 'application/vnd.api+json',
  'Content-Type': 'application/json',
}

function soDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

/** "Marcello Ruiz da Silva" -> ["Marcello", "Ruiz da Silva"] */
function partirNome(completo: string) {
  const partes = completo.trim().split(/\s+/)
  if (partes.length === 1) return { nome: partes[0], sobrenome: partes[0] }
  return { nome: partes[0], sobrenome: partes.slice(1).join(' ') }
}

/** date do Postgres (YYYY-MM-DD) -> dd/mm/YYYY, que e o formato da Memed. */
function dataBR(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

  try {
    const escopo = userClient(autorizacao)

    // A RLS decide de qual clinica sao os ajustes que este usuario enxerga.
    // Sem membership ativo nao vem linha nenhuma, e a funcao para aqui.
    const { data: ajustes } = await escopo
      .from('clinic_settings')
      .select('clinic_id,signer_name,signer_crm,prescriber_email,prescriber_birth_date')
      .maybeSingle()

    if (!ajustes) return json({ error: 'Clínica não encontrada.', code: 'SEM_CLINICA' }, 403)

    const env = ambiente()
    const credenciais = chaves()

    const cpf = soDigitos(
      Deno.env.get('MEMED_CPF_PRESCRITOR')?.trim() ||
        Deno.env.get('BRY_CPF_MEDICO')?.trim() ||
        '',
    )
    if (!cpf) return json({ error: 'CPF do prescritor não configurado.', code: 'SEM_CPF' }, 503)

    // 1) Procurar. O CPF e um dos identificadores aceitos pela rota de usuarios.
    const procura = await fetch(
      `${env.api}/sinapse-prescricao/usuarios/${cpf}?${credenciais}`,
      { headers: CABECALHOS },
    )

    if (procura.ok) {
      const corpo = await procura.json()
      const token = corpo?.data?.attributes?.token
      const status = corpo?.data?.attributes?.status ?? null

      if (!token) {
        return json({
          error: 'A Memed respondeu sem o token do prescritor.',
          code: 'SEM_TOKEN',
        }, 502)
      }

      // Prescritor "Inativo" nao emite receita. Melhor dizer isso agora do que
      // deixar a tela abrir e falhar na hora de imprimir.
      if (typeof status === 'string' && /inativ/i.test(status)) {
        return json({
          error: 'O cadastro do médico está inativo na Memed. Fale com o suporte deles.',
          code: 'PRESCRITOR_INATIVO',
        }, 409)
      }

      return json({ token, novo: false })
    }

    // Qualquer coisa que nao seja "nao encontrei" e problema de verdade, e
    // cadastrar por cima seria criar conta duplicada em cima de um erro.
    if (procura.status !== 404) {
      const detalhe = await procura.text()
      console.error('Memed recusou a consulta', procura.status, detalhe)
      return json({
        error: 'A Memed recusou a consulta do prescritor.',
        code: 'MEMED_RECUSOU',
        status: procura.status,
        details: detalhe.slice(0, 300),
      }, 502)
    }

    // 2) Nao existe: cadastrar. So chega aqui numa clinica nova ou no ambiente
    // de teste - o medico de hoje ja tem conta.
    if (!ajustes.signer_name || !ajustes.signer_crm) {
      return json({
        error: 'Cadastre o nome e o CRM do médico antes de prescrever.',
        code: 'CADASTRO_INCOMPLETO',
      }, 409)
    }
    if (!ajustes.prescriber_email || !ajustes.prescriber_birth_date) {
      return json({
        error: 'A Memed exige e-mail e data de nascimento do médico para o primeiro acesso.',
        code: 'CADASTRO_INCOMPLETO',
      }, 409)
    }

    const { nome, sobrenome } = partirNome(ajustes.signer_name)

    const cadastro = await fetch(`${env.api}/sinapse-prescricao/usuarios?${credenciais}`, {
      method: 'POST',
      headers: CABECALHOS,
      body: JSON.stringify({
        data: {
          type: 'usuarios',
          attributes: {
            // O id da clinica como external_id: e unico, ja existe, e liga o
            // cadastro da Memed ao nosso sem inventar outro identificador.
            external_id: ajustes.clinic_id,
            nome,
            sobrenome,
            cpf,
            board: {
              board_code: 'CRM',
              board_number: soDigitos(ajustes.signer_crm),
              board_state: 'SP',
            },
            email: ajustes.prescriber_email,
            data_nascimento: dataBR(ajustes.prescriber_birth_date),
          },
        },
      }),
    })

    const corpoCadastro = await cadastro.text()
    if (!cadastro.ok) {
      console.error('Memed recusou o cadastro', cadastro.status, corpoCadastro)
      return json({
        error: 'A Memed recusou o cadastro do médico.',
        code: 'CADASTRO_RECUSADO',
        details: corpoCadastro.slice(0, 400),
      }, 502)
    }

    const criado = JSON.parse(corpoCadastro)
    const token = criado?.data?.attributes?.token
    if (!token) {
      return json({ error: 'A Memed cadastrou mas não devolveu o token.', code: 'SEM_TOKEN' }, 502)
    }

    // Registra que este medico passou a existir na Memed. Nao e essencial para
    // funcionar, mas evita ficar adivinhando depois se o cadastro foi feito
    // por aqui ou direto no site deles.
    await adminClient()
      .from('clinic_settings')
      .update({ memed_prescritor_criado_em: new Date().toISOString() })
      .eq('clinic_id', ajustes.clinic_id)

    return json({ token, novo: true })
  } catch (causa) {
    console.error('memed-prescritor falhou', causa)
    return json({ error: causa instanceof Error ? causa.message : 'Falha inesperada.' }, 500)
  }
})
