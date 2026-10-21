import { dentroDoExpediente } from './expediente.ts'

/**
 * Bom dia para quem chamou a equipe fora do horario (21/10/2026).
 *
 * A Fatima tocou "Falar com a equipe" a 00:15, ouviu que a equipe responde a
 * partir das 8h e nao escreveu mais nada. O Edu: "se dessa a IA podia agir,
 * ela consegue automaticamente enviar msg para o cliente as 8h da manha dando
 * bom dia e perguntar em que pode ajudar?". Pode, enquanto a janela de 24h da
 * Meta estiver aberta: quem escreveu de madrugada ainda recebe texto livre as
 * 8h. Sexta a noite e fim de semana passam das 24h ate segunda e ficam de
 * fora - fora da janela so sai modelo aprovado.
 *
 * A regra mora aqui, coberta por testes; a funcao agendada (bom-dia-da-equipe)
 * so le o banco, pergunta e envia.
 */

export const BOM_DIA_DA_EQUIPE =
  'Bom dia! 💙 A equipe já está por aqui. Você chamou a gente fora do horário: em que podemos te ajudar?'

/**
 * O fim das nossas respostas ao pedido de falar com a equipe: a do robo
 * (chamarEquipe) e a da IA quando o pedido vem sem assunto (ESPERA_DO_ASSUNTO).
 * Os testes conferem que os textos de verdade contem estes trechos.
 */
export const TRECHOS_DO_PEDIDO = [
  'Estou direcionando você para alguém da nossa equipe',
  'Me conta aqui o que você precisa',
]

/** Margem antes das 24h da Meta: a mensagem ainda precisa chegar. */
const JANELA_MS = 23 * 3600 * 1000

export type MensagemDaFila = {
  direction: 'inbound' | 'outbound' | string
  body: string | null
  automatic: boolean | null
  created_at: string
}

/**
 * Manda o bom dia agora? `mensagens` em ordem de envio (a mais antiga
 * primeiro). Sim quando: estamos no expediente; a ultima mensagem da conversa
 * e a nossa resposta automatica ao pedido de falar com a equipe (ninguem
 * escreveu depois, nem a familia nem a equipe); o pedido da familia foi feito
 * fora do expediente; e a janela de 24h ainda esta aberta. O bom dia ja
 * enviado vira a ultima mensagem, entao nunca sai duas vezes.
 */
export function precisaDoBomDia(mensagens: readonly MensagemDaFila[], agora: Date): boolean {
  if (!dentroDoExpediente(agora)) return false
  const ultima = mensagens.at(-1)
  if (!ultima || ultima.direction !== 'outbound' || ultima.automatic === false) return false
  if (!TRECHOS_DO_PEDIDO.some((trecho) => String(ultima.body ?? '').includes(trecho))) return false
  const daFamilia = [...mensagens].reverse().find((m) => m.direction === 'inbound')
  if (!daFamilia) return false
  const quando = new Date(daFamilia.created_at)
  if (Number.isNaN(quando.getTime()) || dentroDoExpediente(quando)) return false
  return agora.getTime() - quando.getTime() < JANELA_MS
}
