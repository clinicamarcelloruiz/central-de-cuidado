import { supabase } from '@/lib/supabase'
import type {
  Consultation,
  ConsultationDraft,
  Db,
  FollowupKey,
  FollowupState,
  FollowupStatus,
  Patient,
} from '@/types/patient'
import type { PatientDraft } from '@/lib/store'
import type { Database } from '@/types/database'

type PatientInsert = Database['public']['Tables']['patients']['Insert']
type PatientUpdate = Database['public']['Tables']['patients']['Update']
type ConsultationInsert = Database['public']['Tables']['consultations']['Insert']
type ConsultationUpdate = Database['public']['Tables']['consultations']['Update']
type AccessRequestRow = Database['public']['Tables']['access_requests']['Row']

export type ClinicRole = Database['public']['Enums']['clinic_role']

export interface CurrentMembership {
  clinicId: string
  role: ClinicRole
}

export interface AccessRequest {
  id: string
  name: string
  email: string
  requestedAt: string
}

export const PENDING_ACCESS_MESSAGE =
  'Seu cadastro está aguardando aprovação do administrador da clínica.'

type PatientRow = {
  id: string
  clinic_id: string
  name: string
  guardian_name: string | null
  birth_date: string | null
  sex: 'F' | 'M' | 'O'
  phone: string
  city: string | null
  neighborhood: string | null
  insurance: string | null
  cid: string | null
  unit: string | null
  consultation_date: string
  notes: string | null
  created_at: string
}

type FollowupRow = {
  id: string
  patient_id: string
  followup_key: FollowupKey
  status: 'pending' | 'opened' | 'completed' | 'pendente' | 'enviado' | 'concluido'
  opened_at: string | null
}

type SettingsRow = {
  template_d30: string
  template_m90: string
}

type ConsultationRow = {
  id: string
  clinic_id: string
  patient_id: string
  consultation_date: string
  encounter_type: 'initial' | 'return' | 'telemedicine' | 'other'
  unit: string
  weight_kg: number | null
  height_cm: number | null
  chief_complaint: string
  clinical_history: string
  personal_history: string
  family_history: string
  allergies: string
  current_medications: string
  physical_exam: string
  assessment: string
  cid: string
  plan: string
  prescription: string
  return_plan: string
  notes: string
  created_at: string
}

const FOLLOWUP_KEYS: FollowupKey[] = ['d30', 'm90']

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Não foi possível acessar o banco de dados.'
}

function fail(error: unknown): never {
  throw new Error(message(error))
}

function toUiStatus(status: FollowupRow['status']): FollowupStatus {
  if (status === 'opened' || status === 'enviado') return 'enviado'
  if (status === 'completed' || status === 'concluido') return 'concluido'
  return 'pendente'
}

function toDbStatus(status: FollowupStatus) {
  if (status === 'enviado') return 'opened'
  if (status === 'concluido') return 'completed'
  return 'pending'
}

function emptyFollowups(): Record<FollowupKey, FollowupState> {
  return {
    d30: { status: 'pendente' },
    m90: { status: 'pendente' },
  }
}

function mapPatient(row: PatientRow, followupRows: FollowupRow[]): Patient {
  const followups = emptyFollowups()
  for (const item of followupRows) {
    followups[item.followup_key] = {
      id: item.id,
      status: toUiStatus(item.status),
      enviadoEm: item.opened_at ?? undefined,
    }
  }

  return {
    id: row.id,
    nome: row.name,
    responsavel: row.guardian_name ?? '',
    nascimento: row.birth_date ?? '',
    sexo: row.sex,
    telefone: row.phone,
    cidade: row.city ?? '',
    bairro: row.neighborhood ?? '',
    convenio: row.insurance ?? '',
    cid: row.cid ?? '',
    unidade: row.unit ?? '',
    dataConsulta: row.consultation_date,
    observacoes: row.notes ?? '',
    criadoEm: row.created_at,
    followups,
  }
}

function mapConsultation(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    patientId: row.patient_id,
    data: row.consultation_date,
    tipo: row.encounter_type,
    unidade: row.unit,
    peso: row.weight_kg === null ? '' : String(row.weight_kg),
    altura: row.height_cm === null ? '' : String(row.height_cm),
    queixa: row.chief_complaint,
    historiaEvolucao: row.clinical_history,
    antecedentesPessoais: row.personal_history,
    antecedentesFamiliares: row.family_history,
    alergias: row.allergies,
    medicamentos: row.current_medications,
    exameFisico: row.physical_exam,
    avaliacao: row.assessment,
    cid: row.cid,
    conduta: row.plan,
    prescricao: row.prescription,
    retorno: row.return_plan,
    observacoes: row.notes,
    criadoEm: row.created_at,
  }
}

function decimalOrNull(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function consultationPayload(
  clinicId: string,
  patientId: string,
  draft: ConsultationDraft,
): ConsultationInsert {
  return {
    clinic_id: clinicId,
    patient_id: patientId,
    consultation_date: draft.data,
    encounter_type: draft.tipo,
    unit: draft.unidade.trim(),
    weight_kg: decimalOrNull(draft.peso),
    height_cm: decimalOrNull(draft.altura),
    chief_complaint: draft.queixa.trim(),
    clinical_history: draft.historiaEvolucao.trim(),
    personal_history: draft.antecedentesPessoais.trim(),
    family_history: draft.antecedentesFamiliares.trim(),
    allergies: draft.alergias.trim(),
    current_medications: draft.medicamentos.trim(),
    physical_exam: draft.exameFisico.trim(),
    assessment: draft.avaliacao.trim(),
    cid: draft.cid.trim(),
    plan: draft.conduta.trim(),
    prescription: draft.prescricao.trim(),
    return_plan: draft.retorno.trim(),
    notes: draft.observacoes.trim(),
  }
}

function patientCreatePayload(draft: PatientDraft): Omit<PatientInsert, 'clinic_id'> {
  return {
    name: draft.nome.trim(),
    guardian_name: draft.responsavel.trim(),
    birth_date: draft.nascimento || null,
    sex: draft.sexo,
    phone: draft.telefone.replace(/\D/g, ''),
    city: draft.cidade.trim(),
    neighborhood: draft.bairro.trim(),
    insurance: draft.convenio.trim(),
    cid: draft.cid.trim(),
    unit: draft.unidade.trim(),
    consultation_date: draft.dataConsulta,
    notes: draft.observacoes.trim(),
  }
}

function patientUpdatePayload(patch: Partial<Patient>): PatientUpdate {
  const payload: PatientUpdate = {}
  if (patch.nome !== undefined) payload.name = patch.nome.trim()
  if (patch.responsavel !== undefined) payload.guardian_name = patch.responsavel.trim()
  if (patch.nascimento !== undefined) payload.birth_date = patch.nascimento || null
  if (patch.sexo !== undefined) payload.sex = patch.sexo
  if (patch.telefone !== undefined) payload.phone = patch.telefone.replace(/\D/g, '')
  if (patch.cidade !== undefined) payload.city = patch.cidade.trim()
  if (patch.bairro !== undefined) payload.neighborhood = patch.bairro.trim()
  if (patch.convenio !== undefined) payload.insurance = patch.convenio.trim()
  if (patch.cid !== undefined) payload.cid = patch.cid.trim()
  if (patch.unidade !== undefined) payload.unit = patch.unidade.trim()
  if (patch.dataConsulta !== undefined) payload.consultation_date = patch.dataConsulta
  if (patch.observacoes !== undefined) payload.notes = patch.observacoes.trim()
  return payload
}

async function followupsForPatient(clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from('followups')
    .select('id,patient_id,followup_key,status,opened_at')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .is('archived_at', null)

  if (error) fail(error)
  return (data ?? []) as FollowupRow[]
}

async function patientById(clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('id', patientId)
    .is('archived_at', null)
    .single()

  if (error) fail(error)
  const followups = await followupsForPatient(clinicId, patientId)
  return mapPatient(data as PatientRow, followups)
}

export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('clinic_memberships')
    .select('clinic_id,role')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) fail(membershipError)
  if (!membership?.clinic_id) return null
  return {
    clinicId: String(membership.clinic_id),
    role: membership.role as ClinicRole,
  }
}

export async function ensureClinic() {
  const membership = await getCurrentMembership()
  if (membership) return membership.clinicId
  throw new Error(PENDING_ACCESS_MESSAGE)
}

export async function listPendingAccessRequests(clinicId: string): Promise<AccessRequest[]> {
  const { data, error } = await supabase
    .from('access_requests')
    .select('id,requested_name,requested_email,requested_at')
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error) fail(error)
  return ((data ?? []) as Pick<AccessRequestRow, 'id' | 'requested_name' | 'requested_email' | 'requested_at'>[]).map(
    (request) => ({
      id: request.id,
      name: request.requested_name || 'Usuário sem nome',
      email: request.requested_email,
      requestedAt: request.requested_at,
    }),
  )
}

export async function approveAccessRequest(requestId: string, role: Exclude<ClinicRole, 'owner'>) {
  const { error } = await supabase.rpc('approve_access_request', {
    request_id: requestId,
    assigned_role: role,
  })
  if (error) fail(error)
}

export async function rejectAccessRequest(requestId: string) {
  const { error } = await supabase.rpc('reject_access_request', { request_id: requestId })
  if (error) fail(error)
}

/* ------------------------------------------------------------------ *
 * Agenda
 *
 * Os horarios livres NAO sao calculados aqui: vem da funcao available_slots
 * no banco. A mesma resposta precisa servir para esta tela e para o
 * agendamento pelo WhatsApp, e duas implementacoes divergiriam com o tempo.
 * ------------------------------------------------------------------ */

export interface Unit {
  id: string
  name: string
  address: string
}

export interface AvailabilityRule {
  id: string
  unitId: string
  weekday: number
  startsAt: string
  endsAt: string
}

export interface ScheduleException {
  id: string
  unitId: string | null
  date: string
  isClosed: boolean
  startsAt: string | null
  endsAt: string | null
  reason: string
}

export interface SchedulePreferences {
  slotMinutes: number
  horizonDays: number
  minNoticeHours: number
  /** Liga ou desliga o lembrete automatico de consulta. */
  reminderEnabled: boolean
  /** Dias antes da consulta. 1 = vespera, 0 = no proprio dia. */
  reminderDays: number
}

export interface Appointment {
  id: string
  unitId: string
  patientId: string | null
  patientName: string
  startsAt: string
  endsAt: string
  status: 'scheduled' | 'attended' | 'cancelled' | 'no_show'
  source: 'clinic' | 'whatsapp'
  staffNote: string
  /** Nome e telefone de quem marcou pelo WhatsApp sem ter cadastro. */
  contactName: string
  contactPhone: string
  /** Falso enquanto for solicitacao de pessoa sem cadastro aguardando a equipe. */
  confirmedByClinic: boolean
  /** Ate quando a vaga fica reservada para essa solicitacao. */
  holdExpiresAt: string | null
}

export const WEEKDAY_LABEL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

export async function listUnits(clinicId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('clinic_units')
    .select('id,name,address')
    .eq('clinic_id', clinicId)
    .is('archived_at', null)
    .order('name')
  if (error) fail(error)
  return data ?? []
}

export async function createUnit(clinicId: string, name: string, address: string): Promise<Unit> {
  const { data, error } = await supabase
    .from('clinic_units')
    .insert({ clinic_id: clinicId, name: name.trim(), address: address.trim() })
    .select('id,name,address')
    .single()
  if (error) fail(error)
  return data
}

/** Arquiva em vez de apagar: agendamentos antigos continuam apontando para a unidade. */
export async function archiveUnit(unitId: string) {
  const { error } = await supabase
    .from('clinic_units')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', unitId)
  if (error) fail(error)
}

export async function listAvailabilityRules(unitId: string): Promise<AvailabilityRule[]> {
  const { data, error } = await supabase
    .from('availability_rules')
    .select('id,unit_id,weekday,starts_at,ends_at')
    .eq('unit_id', unitId)
    .order('weekday')
    .order('starts_at')
  if (error) fail(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    weekday: row.weekday,
    startsAt: row.starts_at.slice(0, 5),
    endsAt: row.ends_at.slice(0, 5),
  }))
}

export async function createAvailabilityRule(
  clinicId: string,
  unitId: string,
  weekday: number,
  startsAt: string,
  endsAt: string,
) {
  const { error } = await supabase
    .from('availability_rules')
    .insert({ clinic_id: clinicId, unit_id: unitId, weekday, starts_at: startsAt, ends_at: endsAt })
  if (error) fail(error)
}

export async function deleteAvailabilityRule(ruleId: string) {
  const { error } = await supabase.from('availability_rules').delete().eq('id', ruleId)
  if (error) fail(error)
}

export async function listScheduleExceptions(clinicId: string): Promise<ScheduleException[]> {
  const { data, error } = await supabase
    .from('schedule_exceptions')
    .select('id,unit_id,exception_date,is_closed,starts_at,ends_at,reason')
    .eq('clinic_id', clinicId)
    .gte('exception_date', new Date().toISOString().slice(0, 10))
    .order('exception_date')
  if (error) fail(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    date: row.exception_date,
    isClosed: row.is_closed,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
  }))
}

export async function createScheduleException(
  clinicId: string,
  date: string,
  reason: string,
  unitId: string | null,
) {
  const { error } = await supabase.from('schedule_exceptions').insert({
    clinic_id: clinicId,
    unit_id: unitId,
    exception_date: date,
    is_closed: true,
    reason: reason.trim(),
  })
  if (error) fail(error)
}

export async function deleteScheduleException(exceptionId: string) {
  const { error } = await supabase.from('schedule_exceptions').delete().eq('id', exceptionId)
  if (error) fail(error)
}

export async function getSchedulePreferences(clinicId: string): Promise<SchedulePreferences> {
  const { data, error } = await supabase
    .from('clinic_settings')
    // Precisa ser uma string literal unica: concatenar quebra a inferencia de
    // tipos do supabase-js e o retorno vira GenericStringError.
    .select('schedule_slot_minutes,schedule_horizon_days,schedule_min_notice_hours,appointment_reminder_enabled,appointment_reminder_days')
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (error) fail(error)
  return {
    slotMinutes: data?.schedule_slot_minutes ?? 40,
    horizonDays: data?.schedule_horizon_days ?? 15,
    minNoticeHours: data?.schedule_min_notice_hours ?? 2,
    reminderEnabled: data?.appointment_reminder_enabled ?? true,
    reminderDays: data?.appointment_reminder_days ?? 1,
  }
}

export async function saveSchedulePreferences(clinicId: string, prefs: SchedulePreferences) {
  const { error } = await supabase
    .from('clinic_settings')
    .update({
      schedule_slot_minutes: prefs.slotMinutes,
      schedule_horizon_days: prefs.horizonDays,
      schedule_min_notice_hours: prefs.minNoticeHours,
      appointment_reminder_enabled: prefs.reminderEnabled,
      appointment_reminder_days: prefs.reminderDays,
    })
    .eq('clinic_id', clinicId)
  if (error) fail(error)
}

export async function listAvailableSlots(unitId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('available_slots', { p_unit_id: unitId })
  if (error) fail(error)
  return (data ?? []).map((row) => row.slot_start)
}

export async function listAppointments(clinicId: string, unitId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id,unit_id,patient_id,starts_at,ends_at,status,source,staff_note,contact_name,contact_phone,confirmed_by_clinic,hold_expires_at')
    .eq('clinic_id', clinicId)
    .eq('unit_id', unitId)
    .neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
  if (error) fail(error)

  const rows = data ?? []
  const patientIds = [...new Set(rows.map((r) => r.patient_id).filter(Boolean))] as string[]
  const { data: patients } = patientIds.length
    ? await supabase.from('patients').select('id,name').in('id', patientIds)
    : { data: [] }
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.name]))

  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    patientId: row.patient_id,
    patientName:
      (row.patient_id && nameById.get(row.patient_id)) ||
      row.contact_name ||
      'Sem paciente vinculado',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    source: row.source,
    staffNote: row.staff_note,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    confirmedByClinic: row.confirmed_by_clinic,
    holdExpiresAt: row.hold_expires_at,
  }))
}

export interface PendingRequest {
  id: string
  unitId: string
  unitName: string
  contactName: string
  contactPhone: string
  startsAt: string
  /** Ate quando a vaga fica presa. Passou disso, a faxina horaria devolve. */
  holdExpiresAt: string | null
}

/**
 * Solicitacoes feitas pelo WhatsApp por quem nao tem cadastro, esperando a
 * equipe confirmar.
 *
 * Consulta a clinica inteira, e nao uma unidade: o aviso precisa aparecer para
 * quem abre o sistema, sem depender de a pessoa lembrar de olhar cada agenda.
 */
export async function listPendingRequests(clinicId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id,unit_id,contact_name,contact_phone,starts_at,hold_expires_at')
    .eq('clinic_id', clinicId)
    .eq('status', 'scheduled')
    .eq('confirmed_by_clinic', false)
    .order('starts_at', { ascending: true })

  if (error) fail(error)
  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: units } = await supabase
    .from('clinic_units')
    .select('id,name')
    .eq('clinic_id', clinicId)
  const nomePorUnidade = new Map((units ?? []).map((u) => [u.id, u.name]))

  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    unitName: nomePorUnidade.get(row.unit_id) ?? 'Unidade',
    contactName: row.contact_name || '',
    contactPhone: formatarTelefone(row.contact_phone || ''),
    startsAt: row.starts_at,
    holdExpiresAt: row.hold_expires_at,
  }))
}

/**
 * Ajustes que a equipe faz numa consulta ja marcada.
 *
 * Vale principalmente para o que chegou pelo WhatsApp: corrigir um nome mal
 * digitado, anotar um recado, e sobretudo dizer de quem e aquela consulta.
 * Enquanto patientId for nulo, a consulta nao entra no prontuario nem nos
 * acompanhamentos de 30 e 90 dias.
 */
export async function updateAppointmentDetails(
  appointmentId: string,
  dados: {
    contactName: string
    contactPhone: string
    staffNote: string
    patientId: string | null
  },
) {
  const { error } = await supabase
    .from('appointments')
    .update({
      contact_name: dados.contactName.trim().slice(0, 160),
      contact_phone: dados.contactPhone.replace(/\D/g, '').slice(0, 20),
      staff_note: dados.staffNote.trim(),
      patient_id: dados.patientId,
    })
    .eq('id', appointmentId)
  if (error) fail(error)
}

/**
 * Avisa pelo WhatsApp que a equipe confirmou a solicitacao.
 *
 * Sem isto a pessoa recebia "confirmamos em ate 24 horas" e nunca mais ouvia
 * falar: a proxima noticia era o lembrete da vespera. Falhar aqui nao desfaz a
 * confirmacao - a consulta ja esta valida, so o aviso nao saiu.
 */
export async function notifyAppointmentConfirmed(
  clinicId: string,
  appointmentId: string,
): Promise<{ avisou: boolean; motivo?: string }> {
  const { data: consulta, error } = await supabase
    .from('appointments')
    .select('starts_at,contact_phone,unit_id')
    .eq('id', appointmentId)
    .maybeSingle()
  if (error) fail(error)
  const digitos = (consulta?.contact_phone ?? '').replace(/\D/g, '')
  if (!digitos) return { avisou: false, motivo: 'sem telefone' }

  // O wa_id chega com 55 na frente; o cadastro pode ter so o DDD.
  const variantes = [digitos, `55${digitos}`, digitos.replace(/^55/, '')]
  const { data: conversa } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('clinic_id', clinicId)
    .in('wa_id', variantes)
    .limit(1)
    .maybeSingle()
  if (!conversa) return { avisou: false, motivo: 'sem conversa' }

  const { data: unidade } = await supabase
    .from('clinic_units')
    .select('name,address')
    .eq('id', consulta!.unit_id)
    .maybeSingle()

  const quando = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(consulta!.starts_at))

  const texto =
    `Consulta confirmada!\n\n${quando}\n${unidade?.name ?? ''}` +
    `${unidade?.address ? `\n${unidade.address}` : ''}\n\n` +
    'Um dia antes enviamos um lembrete. Digite MENU se precisar de alguma coisa.'

  try {
    await sendConversationReply(conversa.id, texto, true)
    return { avisou: true }
  } catch (causa) {
    return { avisou: false, motivo: causa instanceof Error ? causa.message : 'falha no envio' }
  }
}

/** A recepcao aceita a solicitacao feita pelo WhatsApp por quem nao tem cadastro. */
export async function confirmAppointment(appointmentId: string) {
  const { error } = await supabase
    .from('appointments')
    .update({ confirmed_by_clinic: true, hold_expires_at: null })
    .eq('id', appointmentId)
  if (error) fail(error)
}

export async function createAppointment(
  clinicId: string,
  unitId: string,
  patientId: string | null,
  startsAt: string,
  slotMinutes: number,
  staffNote = '',
) {
  const endsAt = new Date(new Date(startsAt).getTime() + slotMinutes * 60000).toISOString()
  const { error } = await supabase.from('appointments').insert({
    clinic_id: clinicId,
    unit_id: unitId,
    patient_id: patientId,
    starts_at: startsAt,
    ends_at: endsAt,
    source: 'clinic',
    staff_note: staffNote.trim(),
  })
  // O indice unico do banco e a garantia real contra dois pacientes no mesmo
  // horario. Traduzimos o erro tecnico para algo que a recepcao entenda.
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('Este horário acabou de ser ocupado. Atualize a agenda e escolha outro.')
    }
    fail(error)
  }
}

export async function cancelAppointment(appointmentId: string) {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', appointmentId)
  if (error) fail(error)
}

/* ------------------------------------------------------------------ *
 * Conversas do WhatsApp
 *
 * O webhook grava as respostas dos pacientes em whatsapp_conversations e
 * whatsapp_messages. Estas funcoes existem para que essas respostas apareçam
 * na tela: sem elas o paciente responde "Preciso de ajuda" e ninguem ve.
 * ------------------------------------------------------------------ */

/**
 * Telefone do jeito que se le em voz alta. O banco guarda so digitos, com o 55
 * na frente, e "5511975175747" na tela nao ajuda ninguem a conferir um numero.
 */
export function formatarTelefone(digitos: string) {
  const limpo = (digitos ?? '').replace(/\D/g, '')
  const nacional = limpo.startsWith('55') && limpo.length > 11 ? limpo.slice(2) : limpo
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
  }
  return limpo
}

export interface Conversation {
  id: string
  patientId: string | null
  patientName: string
  /**
   * Nome que a pessoa configurou no WhatsApp dela. Serve para reconhecer a
   * conversa; nao e nome verificado e nunca substitui o cadastro.
   */
  profileName: string
  phone: string
  /** So digitos, para casar com o cadastro e montar o pre-cadastro. */
  phoneDigits: string
  status: 'open' | 'resolved' | 'opted_out'
  needsAttention: boolean
  /**
   * Por que a conversa pede alguem da equipe. 'atendente' e o paciente pedindo
   * para falar com gente; 'falha' e o sistema admitindo que travou. Os dois
   * merecem destaque diferente de uma resposta comum.
   */
  attentionReason: 'atendente' | 'remarcacao' | 'cancelamento' | 'ajuda' | 'falha' | null
  unreadCount: number
  lastMessageAt: string | null
  lastMessage: string
  /**
   * Todo o texto trocado nesta conversa, em minusculas, so para a busca. Vem
   * das mensagens que a listagem ja carrega para descobrir a ultima de cada
   * conversa - nao custa consulta nova.
   */
  textoBusca: string
}

export interface ConversationMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  templateName: string | null
  createdAt: string
  failureReason: string | null
}

export async function listConversations(clinicId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select(
      'id,patient_id,display_phone,wa_id,profile_name,status,needs_attention,attention_reason,unread_count,last_message_at',
    )
    .eq('clinic_id', clinicId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) fail(error)
  const rows = data ?? []
  if (rows.length === 0) return []

  // Nomes dos pacientes e ultima mensagem de cada conversa, em duas consultas
  // em vez de uma por conversa.
  const patientIds = [...new Set(rows.map((row) => row.patient_id).filter(Boolean))] as string[]
  const [patientsResult, messagesResult] = await Promise.all([
    patientIds.length
      ? supabase.from('patients').select('id,name').in('id', patientIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('whatsapp_messages')
      .select('conversation_id,body,created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),
  ])
  if (patientsResult.error) fail(patientsResult.error)
  if (messagesResult.error) fail(messagesResult.error)

  const nameById = new Map((patientsResult.data ?? []).map((p) => [p.id, p.name]))
  const lastBodyByConversation = new Map<string, string>()
  const textoPorConversa = new Map<string, string[]>()
  for (const message of messagesResult.data ?? []) {
    if (!lastBodyByConversation.has(message.conversation_id)) {
      lastBodyByConversation.set(message.conversation_id, message.body)
    }
    const acumulado = textoPorConversa.get(message.conversation_id)
    if (acumulado) acumulado.push(message.body)
    else textoPorConversa.set(message.conversation_id, [message.body])
  }

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: (row.patient_id && nameById.get(row.patient_id)) || 'Contato sem cadastro',
    profileName: row.profile_name ?? '',
    phone: formatarTelefone(row.display_phone || row.wa_id),
    phoneDigits: (row.display_phone || row.wa_id || '').replace(/\D/g, ''),
    status: row.status as Conversation['status'],
    needsAttention: row.needs_attention,
    attentionReason: (row.attention_reason ?? null) as Conversation['attentionReason'],
    unreadCount: row.unread_count,
    lastMessageAt: row.last_message_at,
    lastMessage: lastBodyByConversation.get(row.id) ?? '',
    textoBusca: (textoPorConversa.get(row.id) ?? []).join(' \n ').toLowerCase(),
  }))
}

/**
 * Liga conversas, mensagens e consultas do WhatsApp ao paciente recem-cadastrado.
 *
 * O robo so procura o paciente pelo telefone quando a mensagem chega. Sem esta
 * costura, cadastrar alguem depois deixaria a conversa como "Contato sem
 * cadastro" ate a proxima mensagem - e a consulta que a pessoa marcou sozinha
 * ficaria sem dono, fora do prontuario.
 */
export async function vincularContatoAoPaciente(patientId: string) {
  const { data, error } = await supabase.rpc('vincular_contato_ao_paciente', {
    p_patient_id: patientId,
  })
  if (error) fail(error)
  const linha = Array.isArray(data) ? data[0] : data
  return {
    conversas: linha?.conversas ?? 0,
    mensagens: linha?.mensagens ?? 0,
    consultas: linha?.consultas ?? 0,
  }
}

export async function listConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id,direction,body,status,template_name,created_at,failure_reason')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) fail(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    direction: row.direction,
    body: row.body,
    status: row.status,
    templateName: row.template_name,
    createdAt: row.created_at,
    failureReason: row.failure_reason,
  }))
}

/** Zera o contador de nao lidas e tira o destaque de atencao. */
export async function markConversationSeen(conversationId: string) {
  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ unread_count: 0, needs_attention: false, attention_reason: null })
    .eq('id', conversationId)
  if (error) fail(error)
}

export interface AutoReplySettings {
  enabled: boolean
  /** Saudacao mostrada acima do menu para quem nao esta cadastrado. */
  text: string
  /** Saudacao para quem o sistema reconhece pelo telefone. Aceita {nome}. */
  knownText: string
  /** Conteudo da opcao 1 do menu: valores, contatos e orientacoes. */
  infoText: string
}

/** Menu automatico enviado a quem escreve para o numero da clinica. */
export async function getAutoReply(clinicId: string): Promise<AutoReplySettings> {
  const { data, error } = await supabase
    .from('clinic_settings')
    .select(
      'whatsapp_autoreply_enabled,whatsapp_autoreply_text,whatsapp_autoreply_known_text,whatsapp_menu_info_text',
    )
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (error) fail(error)
  return {
    enabled: data?.whatsapp_autoreply_enabled ?? false,
    text: data?.whatsapp_autoreply_text ?? '',
    knownText: data?.whatsapp_autoreply_known_text ?? '',
    infoText: data?.whatsapp_menu_info_text ?? '',
  }
}

export async function saveAutoReply(clinicId: string, prefs: AutoReplySettings) {
  const { error } = await supabase
    .from('clinic_settings')
    .update({
      whatsapp_autoreply_enabled: prefs.enabled,
      whatsapp_autoreply_text: prefs.text,
      whatsapp_autoreply_known_text: prefs.knownText,
      whatsapp_menu_info_text: prefs.infoText,
    })
    .eq('clinic_id', clinicId)
  if (error) fail(error)
}

/**
 * Ate quando a equipe pode responder em texto livre nesta conversa.
 * A Meta so permite isso por 24h depois da ultima mensagem do paciente; depois
 * disso, apenas modelo aprovado. Devolve null quando o paciente nunca escreveu.
 */
export async function getReplyWindow(conversationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) fail(error)
  if (!data) return null
  return new Date(new Date(data.created_at).getTime() + 24 * 3600 * 1000).toISOString()
}

/** Envia uma resposta escrita pela equipe. O servidor revalida a janela de 24h. */
export async function sendConversationReply(
  conversationId: string,
  text: string,
  /** Verdadeiro para aviso do sistema; falso para o que a equipe digitou. */
  automatico = false,
) {
  const { data, error } = await supabase.functions.invoke('whatsapp-reply', {
    body: { conversationId, text, automatico },
  })
  if (error) {
    // O corpo da resposta traz a mensagem em portugues; o error do invoke traz
    // so "non-2xx status code", que nao ajuda ninguem na tela.
    const detalhe =
      (error as { context?: { body?: { error?: string } } }).context?.body?.error ??
      (data as { error?: string } | null)?.error
    throw new Error(detalhe || 'Não foi possível enviar a mensagem.')
  }
  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error)
  }
}

/** Marca a conversa como resolvida sem apagar o historico. */
export async function resolveConversation(conversationId: string) {
  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ status: 'resolved', needs_attention: false, attention_reason: null, unread_count: 0 })
    .eq('id', conversationId)
  if (error) fail(error)
}

export async function fetchDb(
  clinicId: string,
  defaults: Record<FollowupKey, string>,
): Promise<Db> {
  const [patientsResult, followupsResult, settingsResult] = await Promise.all([
    supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('followups')
      .select('id,patient_id,followup_key,status,opened_at')
      .eq('clinic_id', clinicId)
      .is('archived_at', null),
    supabase
      .from('clinic_settings')
      .select('template_d30,template_m90')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
  ])

  if (patientsResult.error) fail(patientsResult.error)
  if (followupsResult.error) fail(followupsResult.error)
  if (settingsResult.error) fail(settingsResult.error)

  const followupRows = (followupsResult.data ?? []) as FollowupRow[]
  const byPatient = new Map<string, FollowupRow[]>()
  for (const item of followupRows) {
    const list = byPatient.get(item.patient_id) ?? []
    list.push(item)
    byPatient.set(item.patient_id, list)
  }

  const settings = settingsResult.data as SettingsRow | null
  return {
    patients: ((patientsResult.data ?? []) as PatientRow[]).map((patient) =>
      mapPatient(patient, byPatient.get(patient.id) ?? []),
    ),
    templates: {
      d30: settings?.template_d30 ?? defaults.d30,
      m90: settings?.template_m90 ?? defaults.m90,
    },
  }
}

export async function createPatient(clinicId: string, draft: PatientDraft) {
  const { data, error } = await supabase
    .from('patients')
    .insert({ clinic_id: clinicId, ...patientCreatePayload(draft) })
    .select('*')
    .single()

  if (error) fail(error)
  const followups = await followupsForPatient(clinicId, data.id)
  return mapPatient(data as PatientRow, followups)
}

export async function listConsultations(clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .is('archived_at', null)
    .order('consultation_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) fail(error)
  return ((data ?? []) as ConsultationRow[]).map(mapConsultation)
}

export async function createConsultation(
  clinicId: string,
  patientId: string,
  draft: ConsultationDraft,
) {
  const { data, error } = await supabase
    .from('consultations')
    .insert(consultationPayload(clinicId, patientId, draft))
    .select('*')
    .single()

  if (error) fail(error)
  return {
    consultation: mapConsultation(data as ConsultationRow),
    patient: await patientById(clinicId, patientId),
  }
}

export async function editConsultation(
  clinicId: string,
  patientId: string,
  consultationId: string,
  draft: ConsultationDraft,
) {
  const payload: ConsultationUpdate = {
    consultation_date: draft.data,
    encounter_type: draft.tipo,
    unit: draft.unidade.trim(),
    weight_kg: decimalOrNull(draft.peso),
    height_cm: decimalOrNull(draft.altura),
    chief_complaint: draft.queixa.trim(),
    clinical_history: draft.historiaEvolucao.trim(),
    personal_history: draft.antecedentesPessoais.trim(),
    family_history: draft.antecedentesFamiliares.trim(),
    allergies: draft.alergias.trim(),
    current_medications: draft.medicamentos.trim(),
    physical_exam: draft.exameFisico.trim(),
    assessment: draft.avaliacao.trim(),
    cid: draft.cid.trim(),
    plan: draft.conduta.trim(),
    prescription: draft.prescricao.trim(),
    return_plan: draft.retorno.trim(),
    notes: draft.observacoes.trim(),
  }
  const { data, error } = await supabase
    .from('consultations')
    .update(payload)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('id', consultationId)
    .is('archived_at', null)
    .select('*')
    .single()

  if (error) fail(error)
  return {
    consultation: mapConsultation(data as ConsultationRow),
    patient: await patientById(clinicId, patientId),
  }
}

export async function editPatient(clinicId: string, id: string, patch: Partial<Patient>) {
  const { data, error } = await supabase
    .from('patients')
    .update(patientUpdatePayload(patch))
    .eq('clinic_id', clinicId)
    .eq('id', id)
    .is('archived_at', null)
    .select('*')
    .single()

  if (error) fail(error)
  const followups = await followupsForPatient(clinicId, id)
  return mapPatient(data as PatientRow, followups)
}

export async function archivePatient(clinicId: string, id: string) {
  const { error } = await supabase
    .from('patients')
    .update({ archived_at: new Date().toISOString() })
    .eq('clinic_id', clinicId)
    .eq('id', id)

  if (error) fail(error)
}

export async function changeFollowup(
  clinicId: string,
  patientId: string,
  key: FollowupKey,
  status: FollowupStatus,
) {
  const { data, error } = await supabase
    .from('followups')
    .update({ status: toDbStatus(status) })
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('followup_key', key)
    .select('id,patient_id,followup_key,status,opened_at')
    .single()

  if (error) fail(error)
  const row = data as FollowupRow
  return {
    id: row.id,
    status: toUiStatus(row.status),
    enviadoEm: row.opened_at ?? undefined,
  } satisfies FollowupState
}

export async function saveTemplates(
  clinicId: string,
  templates: Record<FollowupKey, string>,
) {
  const { error } = await supabase
    .from('clinic_settings')
    .update({
      template_d30: templates.d30,
      template_m90: templates.m90,
    })
    .eq('clinic_id', clinicId)
  if (error) fail(error)
}

export async function archiveAllPatients(clinicId: string) {
  const { error } = await supabase
    .from('patients')
    .update({ archived_at: new Date().toISOString() })
    .eq('clinic_id', clinicId)
    .is('archived_at', null)
  if (error) fail(error)
}

export async function importPatients(clinicId: string, data: Db) {
  await saveTemplates(clinicId, data.templates)
  for (const patient of data.patients) {
    const draft: PatientDraft = {
      nome: patient.nome,
      responsavel: patient.responsavel,
      nascimento: patient.nascimento,
      sexo: patient.sexo,
      telefone: patient.telefone,
      cidade: patient.cidade,
      bairro: patient.bairro,
      convenio: patient.convenio,
      cid: patient.cid,
      unidade: patient.unidade,
      dataConsulta: patient.dataConsulta,
      observacoes: patient.observacoes,
    }
    const created = await createPatient(clinicId, draft)
    for (const key of FOLLOWUP_KEYS) {
      const state = patient.followups?.[key]
      if (state && state.status !== 'pendente') {
        await changeFollowup(clinicId, created.id, key, state.status)
      }
    }
  }
}
