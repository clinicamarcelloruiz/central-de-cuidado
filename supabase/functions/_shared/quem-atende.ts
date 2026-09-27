/**
 * Quem atende, nas frases fixas do robo (27/09/2026).
 *
 * O robo foi escrito para uma clinica so, e dez frases levavam "Dr. Marcello"
 * no proprio codigo - "quem responde e o Dr. Marcello", "Vou passar para o Dr.
 * Marcello". A clinica de teste, usada para desenvolver e para demonstrar o
 * sistema a outros medicos, respondia com o nome dele.
 *
 * O padrao continua sendo o Dr. Marcello, de proposito: a clinica real nao
 * pode mudar uma letra por causa disto, e os testes do robo (clinica "c1")
 * provam exatamente isso. So a clinica listada abaixo ganha outra pessoa.
 * Quando entrar uma segunda clinica de verdade, este mapa vira coluna no banco.
 */
export type QuemAtende = {
  /** No meio da frase: "quem responde e {o}", "Vou passar para {o}". */
  o: string
  /** No comeco da frase: "{O} vai revisar". */
  O: string
  /** Saudacao usada so quando a clinica nao cadastrou a dela. */
  saudacaoPadrao: string
}

const DR_MARCELLO: QuemAtende = {
  o: 'o Dr. Marcello',
  O: 'O Dr. Marcello',
  saudacaoPadrao: 'Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.',
}

const OUTRAS: Record<string, QuemAtende> = {
  // Consultorio Central de Cuidado - a clinica de teste e de demonstracao,
  // com uma medica ficticia (ver supabase/sql/demo_identidade_central.sql).
  'f392fe85-ef6e-4729-bd2c-54dbfc9901b9': {
    o: 'a Dra. Ana',
    O: 'A Dra. Ana',
    saudacaoPadrao: 'Olá! 👋 Aqui é o Consultório Central de Cuidado, da Dra. Ana Ribeiro.',
  },
}

export function quemAtende(clinicId: string | null | undefined): QuemAtende {
  return (clinicId && OUTRAS[clinicId]) || DR_MARCELLO
}
