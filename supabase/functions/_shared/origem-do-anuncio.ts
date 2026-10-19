/**
 * De onde a familia veio: anuncio do Instagram, do Facebook ou do Google
 * (19/10/2026).
 *
 * A campanha do Instagram entrou no ar em 18/10 mandando direto para o
 * WhatsApp do robo, e o Edu perguntou "tem como eu saber quando isso
 * acontece?". Nao tinha: a conversa chegava igual a qualquer outra.
 *
 * Dois sinais, nesta ordem:
 *
 *   1. `referral` - o bloco que a Meta poe na PRIMEIRA mensagem de quem tocou
 *      no botao de WhatsApp de um anuncio ou post. E o sinal certo; o
 *      source_url diz se foi Instagram ou Facebook. Quando a Meta manda um link
 *      curto (fb.me) que nao diz qual dos dois, fica 'meta' - melhor admitir
 *      que nao sabe do que chutar.
 *   2. A mensagem pronta, para quando o referral nao vem (a pessoa apagou o
 *      texto e escreveu outro ainda leva o referral; o contrario, o texto sem
 *      referral, acontece quando ela copia a frase ou o WhatsApp Web perde o
 *      bloco). "Vi o anuncio e quero agendar" so existe no anuncio do
 *      Instagram (a campanha de 18/10 roda so no Instagram); "Encontrei o
 *      Dr. Marcello no Google" e o texto que o site poe no botao de WhatsApp
 *      de quem chegou por anuncio do Google (gclid).
 */

export type OrigemDoAnuncio = 'instagram' | 'facebook' | 'meta' | 'google'

/** O bloco `referral` da mensagem recebida, como a Meta manda. */
export type Indicacao = {
  source_url?: string
  source_type?: string
  source_id?: string
  headline?: string
  body?: string
  ctwa_clid?: string
}

export type OrigemEncontrada = {
  origem: OrigemDoAnuncio
  /** Titulo do anuncio, quando a Meta manda - ajuda a saber qual peca trouxe. */
  titulo: string | null
  /** O link cru, para conferir depois se a classificacao bateu. */
  url: string | null
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function plataformaDoLink(url: string): OrigemDoAnuncio {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    host = url.toLowerCase()
  }
  if (/(^|\.)instagram\.com$|(^|\.)instagr\.am$/.test(host)) return 'instagram'
  if (/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(host)) return 'facebook'
  return 'meta'
}

export function origemDoAnuncio(indicacao: Indicacao | null | undefined, texto: string): OrigemEncontrada | null {
  if (indicacao && typeof indicacao === 'object' && (indicacao.source_url || indicacao.source_id || indicacao.ctwa_clid)) {
    const url = String(indicacao.source_url ?? '').trim()
    const titulo = String(indicacao.headline ?? '').trim().slice(0, 160) || null
    return { origem: url ? plataformaDoLink(url) : 'meta', titulo, url: url ? url.slice(0, 500) : null }
  }
  const limpo = semAcento(texto ?? '')
  if (limpo.includes('vi o anuncio e quero agendar')) return { origem: 'instagram', titulo: null, url: null }
  if (/encontrei o dr\.? marcell?o no google/.test(limpo)) return { origem: 'google', titulo: null, url: null }
  return null
}
