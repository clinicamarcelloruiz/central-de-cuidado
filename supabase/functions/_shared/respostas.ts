/**
 * Respostas prontas: casar a pergunta escrita com o assunto certo.
 *
 * A clínica cadastra assuntos ("Valor e pagamento") com as palavras que os
 * identificam ("valor", "quanto", "pix"). Quando chega uma mensagem que não é
 * resposta a nada que o robô perguntou, procuramos aqui antes de devolver o
 * menu. Se alguma linha bate, o robô responde o texto escrito pela clínica,
 * palavra por palavra. Se nenhuma bate, tudo segue como antes.
 *
 * Duas decisões que valem explicação:
 *
 * 1. Nada de adivinhação. A busca é por palavra, não por semelhança nem por
 *    modelo de linguagem. Um assunto só ganha se as palavras dele aparecerem
 *    escritas. É a diferença entre "não sei responder" - que é honesto, e cai
 *    no menu - e uma resposta errada dita com segurança, que numa clínica
 *    custa caro.
 *
 * 2. Assunto clínico nunca é respondido. Sintoma, remédio, dose, febre: mesmo
 *    que alguém cadastre um assunto assim sem querer, a trava abaixo desliga a
 *    busca inteira e a conversa segue para o menu e para a equipe. Isso é
 *    consulta médica, e consulta médica não se responde por robô.
 */

export type RespostaPronta = {
  id: string
  assunto: string
  palavras: string[]
  resposta: string
}

/** Tira acento e caixa: "Convênio" e "convenio" viram a mesma coisa. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** As palavras da mensagem, sem pontuação. */
function palavrasDe(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 0)
}

/**
 * O que o robô não responde nem que esteja cadastrado.
 *
 * Lista curta e grosseira de propósito: ela não precisa acertar o que a pessoa
 * quis dizer, só precisa reconhecer que o assunto é de médico. Errar para o
 * lado de calar a boca aqui não custa nada - a mensagem cai no menu e a família
 * fala com a equipe, que é o certo para uma dúvida clínica.
 */
const CLINICO = [
  'dor', 'dores', 'doi', 'doendo', 'febre', 'febril', 'temperatura',
  'remedio', 'remedios', 'medicamento', 'medicamentos', 'dose', 'doses',
  'dipirona', 'paracetamol', 'ibuprofeno', 'antibiotico', 'xarope', 'gotas',
  'vomito', 'vomitos', 'vomitando', 'vomitou', 'diarreia', 'sangue',
  'sangrando', 'fezes', 'coco', 'prisao', 'refluxo', 'golfando', 'golfa',
  'alergia', 'alergica', 'alergico', 'emagreceu', 'engasgo', 'engasgou',
  'internado', 'internar', 'urgencia', 'emergencia', 'grave', 'piorou',
  'sintoma', 'sintomas', 'tratamento', 'exame', 'resultado', 'receita',
  'posso dar', 'pode tomar', 'e normal',
]

/** A mensagem fala de sintoma, remédio ou queixa? */
export function assuntoClinico(texto: string): boolean {
  const limpo = normalizar(texto)
  const palavras = new Set(palavrasDe(texto))
  return CLINICO.some((termo) =>
    termo.includes(' ') ? limpo.includes(termo) : palavras.has(termo),
  )
}

/**
 * Quantas palavras do assunto aparecem na mensagem.
 *
 * Palavra com cinco letras ou mais também vale por começo ("convenio" acha
 * "convenios", "conveniada"). Abaixo disso a comparação é exata: "fica" não
 * pode casar com "ficar", "ficha", "ficou".
 */
function pontos(palavras: string[], daMensagem: Set<string>): number {
  let total = 0
  for (const bruta of palavras) {
    const chave = normalizar(bruta).trim()
    if (!chave) continue
    if (daMensagem.has(chave)) {
      total += 1
      continue
    }
    if (chave.length >= 5) {
      for (const palavra of daMensagem) {
        if (palavra.startsWith(chave) || chave.startsWith(palavra) && palavra.length >= 5) {
          total += 1
          break
        }
      }
    }
  }
  return total
}

/**
 * O assunto que melhor explica a mensagem, ou nada.
 *
 * As respostas chegam na ordem de exibição, então empate de pontuação fica com
 * a que a clínica colocou primeiro - que é o que ela considera mais provável.
 */
export function acharResposta(
  texto: string,
  respostas: RespostaPronta[],
): RespostaPronta | null {
  if (!texto.trim() || respostas.length === 0) return null
  if (assuntoClinico(texto)) return null

  const daMensagem = new Set(palavrasDe(texto))
  if (daMensagem.size === 0) return null

  let melhor: RespostaPronta | null = null
  let melhorPonto = 0
  for (const resposta of respostas) {
    const ponto = pontos(resposta.palavras, daMensagem)
    if (ponto > melhorPonto) {
      melhor = resposta
      melhorPonto = ponto
    }
  }
  return melhor
}

type Admin = {
  from: (table: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** As respostas ligadas desta clínica, na ordem que a equipe definiu. */
export async function carregarRespostas(
  admin: Admin,
  clinicId: string,
): Promise<RespostaPronta[]> {
  const { data, error } = await admin
    .from('bot_answers')
    .select('id, subject, keywords, answer')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .order('position', { ascending: true })

  if (error || !data) return []
  return (data as { id: string; subject: string; keywords: string[] | null; answer: string }[])
    .map((linha) => ({
      id: linha.id,
      assunto: linha.subject,
      palavras: linha.keywords ?? [],
      resposta: linha.answer,
    }))
    .filter((r) => r.palavras.length > 0 && r.resposta.trim().length > 0)
}
