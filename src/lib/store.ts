import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ConsultationDraft,
  Db,
  FollowupKey,
  FollowupStatus,
  Patient,
} from '@/types/patient'
import {
  archiveAllPatients,
  archivePatient,
  changeFollowup,
  createConsultation,
  createPatient,
  editPatient,
  ensureClinic,
  fetchDb,
  importPatients,
  listConsultations,
  saveTemplates,
} from '@/lib/repository'

export const DEFAULT_TEMPLATES: Record<FollowupKey, string> = {
  d30: 'Olá! Aqui é da equipe do Dr. Marcello Ruiz, gastroenterologista pediátrico. Já se passaram 30 dias da consulta de {nome}. Como {pronome} está? Está tudo bem? Se precisarem de qualquer auxílio, é só responder por aqui. 💙',
  m90: 'Olá! Aqui é da equipe do Dr. Marcello Ruiz. Já se passaram 3 meses da consulta de {nome} e gostaríamos de saber como {pronome} está. Está tudo bem? Qualquer necessidade, estamos à disposição. 💙',
}

export type PatientDraft = Omit<Patient, 'id' | 'criadoEm' | 'followups'>

const EMPTY_DB: Db = {
  patients: [],
  templates: { ...DEFAULT_TEMPLATES },
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Não foi possível salvar os dados. Tente novamente.'
}

function validImport(data: unknown): data is Db {
  if (!data || typeof data !== 'object') return false
  const candidate = data as Partial<Db>
  return Array.isArray(candidate.patients)
}

export function useDb() {
  const [db, setDb] = useState<Db>(EMPTY_DB)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    try {
      const id = clinicId ?? (await ensureClinic())
      const next = await fetchDb(id, DEFAULT_TEMPLATES)
      if (loadSequence.current !== sequence) return
      setClinicId(id)
      setDb(next)
    } catch (cause) {
      if (loadSequence.current === sequence) setError(errorMessage(cause))
    } finally {
      if (loadSequence.current === sequence) setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    void load()
    return () => {
      loadSequence.current += 1
    }
  }, [load])

  function requireClinic() {
    if (!clinicId) throw new Error('A clínica ainda não foi carregada.')
    return clinicId
  }

  async function run<T>(operation: () => Promise<T>) {
    setBusy(true)
    setError('')
    try {
      return await operation()
    } catch (cause) {
      const text = errorMessage(cause)
      setError(text)
      throw new Error(text)
    } finally {
      setBusy(false)
    }
  }

  async function addPatient(draft: PatientDraft) {
    const patient = await run(() => createPatient(requireClinic(), draft))
    setDb((current) => ({ ...current, patients: [patient, ...current.patients] }))
    return patient
  }

  async function updatePatient(id: string, patch: Partial<Patient>) {
    const patient = await run(() => editPatient(requireClinic(), id, patch))
    setDb((current) => ({
      ...current,
      patients: current.patients.map((item) => (item.id === id ? patient : item)),
    }))
  }

  async function removePatient(id: string) {
    await run(() => archivePatient(requireClinic(), id))
    setDb((current) => ({
      ...current,
      patients: current.patients.filter((patient) => patient.id !== id),
    }))
  }

  async function getConsultations(patientId: string) {
    return run(() => listConsultations(requireClinic(), patientId))
  }

  async function addConsultation(patientId: string, draft: ConsultationDraft) {
    const result = await run(() => createConsultation(requireClinic(), patientId, draft))
    setDb((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === patientId ? result.patient : patient,
      ),
    }))
  }

  async function setFollowup(id: string, key: FollowupKey, status: FollowupStatus) {
    const followup = await run(() => changeFollowup(requireClinic(), id, key, status))
    setDb((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === id
          ? { ...patient, followups: { ...patient.followups, [key]: followup } }
          : patient,
      ),
    }))
  }

  async function setTemplates(templates: Record<FollowupKey, string>) {
    await run(() => saveTemplates(requireClinic(), templates))
    setDb((current) => ({ ...current, templates }))
  }

  async function importDb(data: unknown) {
    if (!validImport(data)) return false
    const normalized: Db = {
      patients: data.patients,
      templates: { ...DEFAULT_TEMPLATES, ...(data.templates ?? {}) },
    }
    await run(() => importPatients(requireClinic(), normalized))
    await load()
    return true
  }

  async function clearAll() {
    await run(() => archiveAllPatients(requireClinic()))
    setDb((current) => ({ ...current, patients: [] }))
  }

  return {
    db,
    loading,
    busy,
    error,
    retry: load,
    addPatient,
    updatePatient,
    removePatient,
    getConsultations,
    addConsultation,
    setFollowup,
    setTemplates,
    importDb,
    clearAll,
  }
}

