/**
 * Mensagens em rajada: a segunda espera a resposta da primeira (01/10/2026).
 *
 * O caso, 30/09/2026: uma mae mandou "preciso da nota fiscal" e, dois
 * segundos depois, "Seria possivel enviar?". A Meta entrega cada mensagem num
 * webhook separado, e os dois rodaram AO MESMO TEMPO. O primeiro registrou o
 * pedido de nota e pediu nome e data; o segundo leu a conversa antes disso,
 * achou que era a primeira mensagem e mandou o menu inteiro por cima - o que
 * apagou a etapa da nota. Ela mandou o nome e a data, como pedido, e ouviu
 * "Nao consegui entender por aqui"; depois recebeu "Estou direcionando voce"
 * duas vezes.
 *
 * A regra: se a ultima mensagem da conversa e da familia, chegou ha pouco,
 * ainda nao teve resposta E e um pedido de nota fiscal, quem chegou agora
 * espera essa resposta sair (ate um limite) e so entao le a conversa.
 *
 * So nota fiscal, por decisao do Edu (01/10/2026): e o caso que aconteceu, e
 * o atraso fica restrito a ele. Outras rajadas ("Oi" + "quanto custa?")
 * continuam sendo lidas em paralelo - se um dia derem problema, basta tirar a
 * condicao `motivo` daqui.
 *
 * Regra pura, sem banco, para o teste cobrir (tests/rajada.test.mjs).
 */

export type UltimaMensagem = {
  direction: 'inbound' | 'outbound'
  /** Quando foi gravada (created_at). */
  criadaEm: string
  /** O que a familia escreveu. */
  corpo?: string | null
}

/** Mensagem da familia mais velha que isto nao conta como rajada. */
export const JANELA_DA_RAJADA_MS = 10_000
/** Quanto a segunda mensagem aceita esperar pela resposta da primeira. */
export const ESPERA_MAXIMA_MS = 6_000

export function precisaEsperar(
  ultima: UltimaMensagem | null,
  agora: number,
  /** Que mensagem anterior justifica esperar (hoje: pedido de nota fiscal). */
  motivo: (corpo: string) => boolean,
): boolean {
  if (!ultima) return false
  // Ja respondemos (robo ou equipe): a conversa esta em dia.
  if (ultima.direction !== 'inbound') return false
  const idade = agora - new Date(ultima.criadaEm).getTime()
  // Futuro (relogio torto) ou antiga: nao e rajada. Uma mensagem de horas
  // atras sem resposta e conversa parada, e esperar por ela seria atrasar a
  // familia a toa.
  if (idade < 0 || idade >= JANELA_DA_RAJADA_MS) return false
  return motivo(String(ultima.corpo ?? ''))
}
