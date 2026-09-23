/**
 * Monta o texto do campo "Prescricao" com as receitas Memed do atendimento.
 *
 * Funcao pura, separada da tela para poder ser testada sem navegador.
 *
 * Existe por causa de 23/09/2026: o Dr. Marcello emitiu duas receitas na mesma
 * consulta, Peg-Lax as 16:26 e Radiografia de abdome as 16:27, e o prontuario
 * assinado saiu so com a radiografia. Dois defeitos juntos:
 *
 *  1. So a receita MAIS RECENTE era copiada (um find() numa lista em ordem
 *     decrescente). As outras ficavam arquivadas, mas fora do texto.
 *  2. O texto de partida era o do momento em que a Memed abriu. A segunda
 *     emissao partia dele, sem o Peg-Lax que a primeira tinha acabado de
 *     escrever, e gravava por cima.
 *
 * Aqui entram TODAS as receitas do atendimento, da mais antiga para a mais
 * nova, e so as linhas que ainda nao estao no texto. Quem chama e responsavel
 * por passar o texto ATUAL - o do banco ou o do formulario aberto -, nunca uma
 * copia guardada de antes.
 */

export interface ItemDeReceita {
  nome: string
  posologia: string
}

export interface ReceitaParaTexto {
  emitidaEm: string
  itens: ItemDeReceita[]
}

function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dataBR(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso
}

/** Devolve o texto novo, ou null quando nada falta. */
export function acrescentarReceitas(atual: string, receitas: ReceitaParaTexto[]): string | null {
  // O campo guarda HTML quando foi escrito no editor e texto puro quando veio
  // de fora; a comparacao e o acrescimo respeitam o formato que ja esta.
  const emHtml = /[<>]|&[a-z]+;|&#\d+;/i.test(atual)
  let texto = atual
  let mudou = false

  const ordenadas = [...receitas].sort((a, b) => a.emitidaEm.localeCompare(b.emitidaEm))
  for (const receita of ordenadas) {
    const lido = emHtml
      ? texto.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      : texto
    const linhas = receita.itens
      .filter((item) => item.nome.trim())
      .map((item) => (item.posologia ? `${item.nome}: ${item.posologia}` : item.nome))
      .filter((linha) => !lido.includes(linha))
    if (linhas.length === 0) continue

    const titulo = `Receita Memed de ${dataBR(receita.emitidaEm)}`
    texto = emHtml
      ? `${texto}<p><strong>${escapar(titulo)}</strong><br>${linhas.map(escapar).join('<br>')}</p>`
      : [texto.trim(), `${titulo}\n${linhas.join('\n')}`].filter(Boolean).join('\n\n')
    mudou = true
  }

  return mudou ? texto : null
}
