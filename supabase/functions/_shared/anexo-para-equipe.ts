/**
 * A foto, o audio ou o documento da familia vao junto para os celulares
 * (23/10/2026).
 *
 * Pedido do Edu, depois que a mae da Maria Flor mandou o raio-x e o celular so
 * recebeu "Mandou uma foto (veja na Central)": "quando a familia mandar foto,
 * audio ou documento, encaminha junto com o pedido para os celulares, do jeito
 * que a Meta deixar".
 *
 * O jeito que a Meta deixa: arquivo e mensagem livre, e mensagem livre so
 * chega a quem escreveu para o numero da clinica nas ultimas 24 horas. O aviso
 * (modelo aprovado) chega sempre; o arquivo vai logo atras e, fora da janela,
 * a Meta recusa - a nota da conversa diz para quem nao foi, e o arquivo segue
 * na Central. Nao ha modelo com audio na Meta, por isso nao vale criar um
 * modelo so para foto: o comportamento ficaria diferente por tipo de arquivo.
 *
 * O arquivo sai do nosso acervo (whatsapp-anexos) por um link assinado, que o
 * webhook gera: o id da Meta serve para baixar, nao para reenviar.
 */

export type AnexoParaEquipe = {
  /** O tipo da mensagem da familia: image, audio, voice, document, video. */
  tipo: string
  /** Link assinado do arquivo no acervo, valido por tempo suficiente para a Meta buscar. */
  link: string
  /** Nome para o documento no celular. */
  nome?: string
}

const QUE_VAO = ['image', 'audio', 'voice', 'document', 'video'] as const

/** Este tipo de mensagem vai como arquivo? Figurinha, localizacao e contato nao. */
export function anexoQueVai(tipo: string | null | undefined): boolean {
  return (QUE_VAO as readonly string[]).includes(String(tipo ?? ''))
}

/**
 * O corpo da mensagem de arquivo para a API da Meta (sem o "to"). Nulo quando
 * o tipo nao vai. Audio nao aceita legenda na Meta: quem mandou ja esta no
 * aviso que vai antes.
 */
export function mensagemDoAnexo(a: AnexoParaEquipe, quem: string): Record<string, unknown> | null {
  if (!anexoQueVai(a.tipo) || !a.link) return null
  const legenda = `📎 Enviado por ${quem.trim() || 'a família'} pela Central de Cuidado`
  if (a.tipo === 'image') return { type: 'image', image: { link: a.link, caption: legenda } }
  if (a.tipo === 'video') return { type: 'video', video: { link: a.link, caption: legenda } }
  if (a.tipo === 'document') {
    return { type: 'document', document: { link: a.link, caption: legenda, filename: a.nome?.trim() || 'documento' } }
  }
  return { type: 'audio', audio: { link: a.link } }
}

const NOME_DO_TIPO: Record<string, string> = {
  image: 'A foto',
  video: 'O vídeo',
  document: 'O documento',
  audio: 'O áudio',
  voice: 'O áudio',
}

/**
 * A linha da nota da conversa sobre o arquivo: so quando NAO foi para algum
 * celular (23/10/2026, sem nota de sucesso - ver descreverEnvio). Falha grita:
 * a equipe precisa saber que o arquivo so esta na Central.
 */
export function notaDoAnexo(tipo: string, envios: { numero: string; ok: boolean; erro?: string }[]): string {
  if (!envios.length) return ''
  const nome = NOME_DO_TIPO[tipo] ?? 'O arquivo'
  const final = (n: string) => `final ${n.slice(-4)}`
  const naoForam = envios.filter((e) => !e.ok).map((e) => final(e.numero))
  if (!naoForam.length) return ''
  return `⚠️ ${nome} não foi para ${naoForam.join(' e ')}: a Meta só deixa mandar arquivo para quem escreveu ao número da clínica nas últimas 24 horas. Está aqui na Central.`
}
