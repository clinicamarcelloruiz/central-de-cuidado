/**
 * Horario de atendimento da equipe, e a frase que o robo diz sobre ele.
 *
 * Ate 24/09/2026 "Atendemos de segunda a sexta, das 8h as 18h. Fora desse
 * horario, respondemos no proximo dia util" estava copiado em seis lugares, e
 * saia igual as 10h de uma terca e as 23h de um sabado. De noite a familia
 * ficava sem saber se a resposta vinha em minutos ou na segunda-feira.
 *
 * Agora o horario mora aqui, uma vez so, e fora dele a frase diz QUANDO a
 * equipe volta: "hoje, a partir das 8h", "amanha", "na segunda-feira".
 *
 * Feriado ainda nao entra na conta (a tabela de feriados existe, mas a frase
 * teria de consultar o banco); num feriado a frase promete o proprio dia util
 * seguinte ao calendario comum.
 */

export const EXPEDIENTE = {
  /** 0 = domingo ... 6 = sabado. */
  dias: [1, 2, 3, 4, 5],
  inicio: 8,
  fim: 18,
  fuso: 'America/Sao_Paulo',
  texto: 'segunda a sexta, das 8h às 18h',
}

const NOME_DO_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const DIA_DA_SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Dia da semana e hora no fuso da clinica, sem depender do fuso da maquina. */
function relogioDaClinica(agora: Date) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: EXPEDIENTE.fuso,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora)
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return {
    dia: DIA_DA_SEMANA[pega('weekday')] ?? 1,
    hora: Number(pega('hour')) + Number(pega('minute')) / 60,
  }
}

export function dentroDoExpediente(agora: Date = new Date()): boolean {
  const { dia, hora } = relogioDaClinica(agora)
  return EXPEDIENTE.dias.includes(dia) && hora >= EXPEDIENTE.inicio && hora < EXPEDIENTE.fim
}

/** "hoje, a partir das 8h" / "amanhã, a partir das 8h" / "na segunda-feira, a partir das 8h". */
export function quandoAEquipeVolta(agora: Date = new Date()): string {
  const { dia, hora } = relogioDaClinica(agora)
  const aPartir = `a partir das ${EXPEDIENTE.inicio}h`
  if (EXPEDIENTE.dias.includes(dia) && hora < EXPEDIENTE.inicio) return `hoje, ${aPartir}`
  for (let passo = 1; passo <= 7; passo++) {
    const proximo = (dia + passo) % 7
    if (!EXPEDIENTE.dias.includes(proximo)) continue
    return passo === 1 ? `amanhã, ${aPartir}` : `na ${NOME_DO_DIA[proximo]}, ${aPartir}`
  }
  return aPartir
}

/**
 * A frase que acompanha "ja avisei a equipe". No horario, so informa o
 * expediente; fora dele, diz quando a resposta vem.
 */
export function avisoDeHorario(agora: Date = new Date()): string {
  if (dentroDoExpediente(agora)) return `Atendemos de ${EXPEDIENTE.texto}.`
  return (
    `Agora estamos fora do horário de atendimento (${EXPEDIENTE.texto}). ` +
    `Alguém da equipe responde ${quandoAEquipeVolta(agora)}.`
  )
}
