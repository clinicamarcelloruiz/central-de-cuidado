export type Sexo = 'F' | 'M' | 'O'

export type FollowupKey = 'd30' | 'm90'

export type FollowupStatus = 'pendente' | 'enviado' | 'concluido'

export interface FollowupState {
  status: FollowupStatus
  enviadoEm?: string
}

export interface Patient {
  id: string
  nome: string
  responsavel: string
  nascimento: string // YYYY-MM-DD
  sexo: Sexo
  telefone: string
  cidade: string
  bairro: string
  convenio: string
  cid: string
  unidade: string
  dataConsulta: string // YYYY-MM-DD
  observacoes: string
  criadoEm: string
  followups: Record<FollowupKey, FollowupState>
}

export interface Db {
  patients: Patient[]
  templates: Record<FollowupKey, string>
}

export const UNIDADES = [
  'Livance Vila Mariana',
  'Livance Santo André',
  'Liferty Santos',
  'Outra',
] as const

export const FOLLOWUP_LABEL: Record<FollowupKey, string> = {
  d30: '30 dias',
  m90: '3 meses',
}
