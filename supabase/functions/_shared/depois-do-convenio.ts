import { EXPEDIENTE } from './expediente.ts'

/**
 * "Sobre o Dr. Marcello" para quem perguntou convenio ou preco e sumiu
 * (23/10/2026).
 *
 * A Claudete perguntou do convenio, ouviu que a consulta e particular e nao
 * escreveu mais nada. O Edu: "quando o cliente se cala por conta de nao atender
 * o convenio esperado ou pelo preco", mandar um texto sobre a formacao e a
 * experiencia do medico - e sozinho, 30 minutos depois. O texto e a resposta
 * pronta marcada para isso na tela (bot_answers.after_price_silence); a regra
 * de QUANDO mandar mora aqui, coberta por testes, e a funcao agendada
 * (depois-do-convenio) so le o banco, pergunta e envia.
 *
 * Regras aprovadas pelo Edu em 23/10/2026:
 * - a familia perguntou de convenio ou preco, e a ultima mensagem e a NOSSA
 *   resposta automatica (nem a familia nem a equipe escreveram depois);
 * - 30 minutos de silencio desde a nossa resposta;
 * - so das 8h as 22h; o que vencer de madrugada sai as 8h, se a janela de 24h
 *   da Meta ainda estiver aberta;
 * - uma vez por familia (quem ja recebeu, nao recebe de novo - a funcao
 *   confere no historico inteiro);
 * - conversa concluida, com a equipe, ou de quem pediu para sair: nao (a funcao
 *   filtra antes de perguntar aqui).
 */

/** Silencio minimo depois da nossa resposta. */
export const SILENCIO_MS = 30 * 60 * 1000

/** Margem antes das 24h da Meta: a mensagem ainda precisa chegar. */
const JANELA_MS = 23 * 3600 * 1000

/** Das 8h as 22h no relogio do consultorio. */
const HORA_INICIO = EXPEDIENTE.inicio
const HORA_FIM = 22

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * A mensagem da familia pergunta de convenio ou de preco? Larga de proposito:
 * o resto da regra (a nossa resposta foi a ultima, 30 min de silencio) e que
 * segura o envio. "plano" sozinho fica de fora ("plano de tratamento").
 */
export function perguntouConvenioOuPreco(texto: string | null | undefined): boolean {
  const t = ` ${semAcento(String(texto ?? '')).replace(/[^a-z0-9\s]/g, ' ')} `
  return (
    /\b(convenio|convenios|plano de saude|planos de saude|pelo plano|meu plano|aceita plano|unimed|amil|bradesco saude|sulamerica|sul america|hapvida|notredame|notre dame|porto seguro saude|cassi|geap|reembolso|particular)\b/.test(t) ||
    /\b(valor|valores|preco|precos|quanto custa|quanto e a consulta|quanto fica|quanto sai|quanto cobra|quanto ta|qual o valor|custa quanto|custo da consulta)\b/.test(t)
  )
}

export type MensagemDaConversa = {
  direction: 'inbound' | 'outbound' | string
  body: string | null
  automatic: boolean | null
  created_at: string
}

function horaNoConsultorio(agora: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: EXPEDIENTE.fuso, hour: '2-digit', hourCycle: 'h23' }).format(agora),
  )
}

/**
 * Manda agora? `mensagens` em ordem de envio (a mais antiga primeiro), as
 * ultimas da conversa. `jaRecebeu` vem do historico inteiro (a funcao procura
 * o comeco do texto).
 */
export function precisaDoSobre(
  mensagens: readonly MensagemDaConversa[],
  agora: Date,
  jaRecebeu: boolean,
): boolean {
  if (jaRecebeu) return false
  const hora = horaNoConsultorio(agora)
  if (hora < HORA_INICIO || hora >= HORA_FIM) return false

  const ultima = mensagens.at(-1)
  // A ultima e nossa. Se for da equipe, a regra de baixo (ninguem da equipe
  // depois da pergunta) recusa.
  if (!ultima || ultima.direction !== 'outbound') return false

  const indiceDaFamilia = mensagens.map((m) => m.direction).lastIndexOf('inbound')
  if (indiceDaFamilia < 0) return false
  const daFamilia = mensagens[indiceDaFamilia]
  if (!perguntouConvenioOuPreco(daFamilia.body)) return false

  // Depois da pergunta, so o robo ou a IA. Alguem da equipe escreveu: a
  // conversa e dela, e o texto automatico atropelaria.
  if (mensagens.slice(indiceDaFamilia + 1).some((m) => m.direction === 'outbound' && m.automatic !== true)) return false

  const perguntaEm = new Date(daFamilia.created_at).getTime()
  const respostaEm = new Date(ultima.created_at).getTime()
  if (Number.isNaN(perguntaEm) || Number.isNaN(respostaEm)) return false
  if (agora.getTime() - respostaEm < SILENCIO_MS) return false
  return agora.getTime() - perguntaEm < JANELA_MS
}

/** O comeco do texto, para achar no historico quem ja recebeu. */
export function marcaDoTexto(texto: string): string {
  return texto.trim().slice(0, 60)
}
