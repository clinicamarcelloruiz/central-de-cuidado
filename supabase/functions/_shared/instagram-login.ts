/**
 * Login oficial do Instagram na Central (16/10/2026).
 *
 * Ate aqui a conta entrava colando um token gerado no painel da Meta. Para o
 * robo responder familias de verdade (e para a Meta mandar os avisos de
 * comentario), o app precisa passar pela analise da Meta, e a analise pede que
 * o botao de login apareca no proprio sistema e no video. Este arquivo nao
 * importa nada: a tela, a funcao instagram-equipe e os testes usam o mesmo
 * endereco e as mesmas permissoes.
 */

/** "Central de Cuidado-IG" no painel da Meta. Nao e segredo: vai no endereco do login. */
export const INSTAGRAM_APP_ID = '1972753233395602'

/** As tres permissoes que o robo usa: perfil, direct e comentarios. */
export const ESCOPOS_DO_INSTAGRAM = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
] as const

/**
 * A volta do login cai numa pagina propria, fora da Central: o endereco da
 * Central ja usa "state" e "code" para a volta da assinatura digital (VIDaaS),
 * e um "state" do Instagram abriria Pacientes e tentaria concluir assinatura.
 * A pagina repassa com nomes que ninguem mais usa (instagram_code...).
 */
export const PAGINA_DE_VOLTA = 'instagram-retorno.html'

export function enderecoDoLogin(redirectUri: string, state: string, appId: string = INSTAGRAM_APP_ID): string {
  const p = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPOS_DO_INSTAGRAM.join(','),
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`
}

/** O Instagram cola "#_" no fim do codigo devolvido. */
export function codigoDaVolta(code: string | null | undefined): string {
  return String(code ?? '').trim().replace(/#_?$/, '')
}

/** So troca codigo que voltou para a pagina de retorno da Central, em https (http so no localhost). */
export function voltaPermitida(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    return (u.protocol === 'https:' || (local && u.protocol === 'http:')) && u.pathname.endsWith(`/${PAGINA_DE_VOLTA}`) && !u.search && !u.hash
  } catch {
    return false
  }
}

/** Permissoes que a pessoa desmarcou na tela do Instagram (a resposta traz as concedidas). */
export function permissoesQueFaltam(concedidas: unknown): string[] {
  const lista = Array.isArray(concedidas) ? concedidas.map(String) : String(concedidas ?? '').split(',')
  const tem = new Set(lista.map((p) => p.trim()).filter(Boolean))
  if (!tem.size) return []
  return ESCOPOS_DO_INSTAGRAM.filter((e) => !tem.has(e))
}
