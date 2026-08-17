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
    .select('patient_id,followup_key,status,opened_at')
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

export async function ensureClinic() {
  const { data: membership, error: membershipError } = await supabase
    .from('clinic_memberships')
    .select('clinic_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) fail(membershipError)
  if (membership?.clinic_id) return String(membership.clinic_id)

  const { data, error } = await supabase.rpc('bootstrap_current_user_clinic', {
    clinic_name: 'Clínica Dr. Marcelo',
  })

  if (error) fail(error)
  const clinicId = data
  if (!clinicId) throw new Error('Não foi possível criar o espaço seguro da clínica.')
  return String(clinicId)
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
      .select('patient_id,followup_key,status,opened_at')
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
    .select('patient_id,followup_key,status,opened_at')
    .single()

  if (error) fail(error)
  const row = data as FollowupRow
  return {
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

