import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  CircleUserRound,
  Edit3,
  FileHeart,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  UsersRound,
} from 'lucide-react'
import type { Patient } from '@/types/patient'
import type { PatientDraft } from '@/lib/store'
import { fmtBR, idade } from '@/lib/followup'
import { FOLLOWUP_LABEL, UNIDADES } from '@/types/patient'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

function emptyDraft(): PatientDraft {
  return {
    nome: '',
    responsavel: '',
    nascimento: '',
    sexo: 'F',
    telefone: '',
    cidade: '',
    bairro: '',
    convenio: '',
    cid: '',
    unidade: UNIDADES[0],
    dataConsulta: new Date().toISOString().slice(0, 10),
    observacoes: '',
  }
}

const inputClass =
  'mt-1.5 w-full rounded-[13px] border border-[#081b2c]/10 bg-[#fafaf8] px-3.5 py-2.5 text-xs font-semibold text-[#081b2c] outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-[#dc8e5f] focus:bg-white focus:ring-4 focus:ring-[#dc8e5f]/10'

function Field({
  label,
  children,
  required,
  className = '',
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
        {label}
        {required && <span className="ml-1 text-[#d37543]">*</span>}
      </span>
      {children}
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { text: string; className: string }> = {
    pendente: { text: 'Pendente', className: 'bg-[#fff4df] text-[#a96d1d]' },
    enviado: { text: 'Aberto', className: 'bg-[#e8f0f8] text-[#4d6f91]' },
    concluido: { text: 'Concluído', className: 'bg-[#e7f3ef] text-[#4d7c70]' },
  }
  const style = styles[status] ?? styles.pendente
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] ${style.className}`}>
      {status === 'concluido' && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      {style.text}
    </span>
  )
}

function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

interface Props {
  patients: Patient[]
  addPatient: (draft: PatientDraft) => Promise<void>
  updatePatient: (id: string, patch: Partial<Patient>) => Promise<void>
  removePatient: (id: string) => Promise<void>
  openCreateSignal?: number
}

export default function Patients({
  patients,
  addPatient,
  updatePatient,
  removePatient,
  openCreateSignal = 0,
}: Props) {
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PatientDraft>(emptyDraft)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (openCreateSignal <= 0) return
    setEditingId(null)
    setForm(emptyDraft())
    setError('')
    setFormOpen(true)
  }, [openCreateSignal])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return patients
    return patients.filter((patient) =>
      [patient.nome, patient.responsavel, patient.cidade, patient.bairro, patient.cid, patient.convenio]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [patients, query])

  function set<K extends keyof PatientDraft>(key: K, value: PatientDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function createNew() {
    setEditingId(null)
    setForm(emptyDraft())
    setError('')
    setFormOpen(true)
  }

  function edit(patient: Patient) {
    setEditingId(patient.id)
    setForm({
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
    })
    setError('')
    setFormOpen(true)
  }

  async function save() {
    if (!form.nome.trim()) {
      setError('Informe o nome do paciente.')
      return
    }
    if (form.telefone.replace(/\D/g, '').length < 10) {
      setError('Informe um telefone válido com DDD.')
      return
    }
    if (!form.dataConsulta) {
      setError('Informe a data da consulta.')
      return
    }

    setSaving(true)
    try {
      if (editingId) await updatePatient(editingId, form)
      else await addPatient(form)
      setFormOpen(false)
      setEditingId(null)
      setForm(emptyDraft())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o paciente.')
    } finally {
      setSaving(false)
    }
  }

  function handleOpenChange(open: boolean) {
    setFormOpen(open)
    if (!open) setError('')
  }

  return (
    <div className="space-y-5">
      <section className="surface-card overflow-hidden rounded-[26px]">
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f5e7dd] text-[#c87543]">
                <UsersRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#c87543]">Base ativa</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-[-0.05em] text-[#081b2c]">{patients.length}</span>
                  <span className="text-xs font-semibold text-slate-400">{patients.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#081b2c]/[0.06] p-4 md:border-l md:border-t-0 md:p-5">
            <button
              type="button"
              onClick={createNew}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#dc8e5f] px-5 py-3 text-xs font-extrabold text-white shadow-[0_10px_24px_rgba(220,142,95,.22)] transition hover:-translate-y-0.5 hover:bg-[#cf7f50]"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Cadastrar paciente
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-[#081b2c]/[0.08] bg-white/80 py-3 pl-11 pr-4 text-xs font-semibold text-[#081b2c] shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#dc8e5f]/60 focus:bg-white focus:ring-4 focus:ring-[#dc8e5f]/10"
            placeholder="Buscar por nome, responsável, cidade, CID ou convênio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar pacientes"
          />
        </div>
        <p className="shrink-0 px-1 text-[10px] font-bold text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
        </p>
      </div>

      {filtered.length === 0 ? (
        <section className="surface-card rounded-[26px] px-6 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#f5e7dd] text-[#c87543]">
            <CircleUserRound className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-base font-extrabold text-[#081b2c]">
            {patients.length === 0 ? 'Cadastre seu primeiro paciente' : 'Nenhum paciente encontrado'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            {patients.length === 0
              ? 'O cadastro alimenta os indicadores e programa automaticamente os acompanhamentos de 30 e 90 dias.'
              : 'Tente buscar por outro nome, cidade, responsável ou diagnóstico.'}
          </p>
          {patients.length === 0 && (
            <button type="button" onClick={createNew} className="mt-5 rounded-xl bg-[#081b2c] px-4 py-2.5 text-[10px] font-extrabold text-white">
              Começar cadastro
            </button>
          )}
        </section>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((patient) => (
            <article
              key={patient.id}
              className="surface-card group rounded-[24px] p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(8,27,44,.075)] sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#eef3f2] text-xs font-extrabold text-[#557f75]">
                  {initials(patient.nome)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-extrabold tracking-[-0.02em] text-[#081b2c]">{patient.nome}</h2>
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">
                        {idade(patient.nascimento)} · {patient.sexo === 'F' ? 'Feminino' : patient.sexo === 'M' ? 'Masculino' : 'Outro / NI'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => edit(patient)}
                        title="Editar paciente"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f3eee9] hover:text-[#c87543]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Arquivar o cadastro de ${patient.nome}?`)) {
                            void removePatient(patient.id).catch((cause) => {
                              alert(cause instanceof Error ? cause.message : 'Não foi possível arquivar o paciente.')
                            })
                          }
                        }}
                        title="Apagar paciente"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f6f3] px-2.5 py-1.5 text-[9px] font-bold text-slate-500">
                      <CalendarDays className="h-3 w-3 text-[#d98e5f]" />
                      Consulta {fmtBR(patient.dataConsulta)}
                    </span>
                    {(patient.cidade || patient.bairro) && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f6f3] px-2.5 py-1.5 text-[9px] font-bold text-slate-500">
                        <MapPin className="h-3 w-3 text-[#6f9d91]" />
                        {[patient.cidade, patient.bairro].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {patient.cid && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f6f3] px-2.5 py-1.5 text-[9px] font-bold text-slate-500">
                        <Stethoscope className="h-3 w-3 text-[#081b2c]" />
                        CID {patient.cid.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#081b2c]/[0.06] pt-3">
                {(['d30', 'm90'] as const).map((key) => (
                  <div key={key} className="flex items-center justify-between gap-2 rounded-xl bg-[#faf9f7] px-2.5 py-2">
                    <span className="text-[9px] font-extrabold text-slate-400">{FOLLOWUP_LABEL[key]}</span>
                    <StatusBadge status={patient.followups[key].status} />
                  </div>
                ))}
              </div>

              {(patient.responsavel || patient.convenio || patient.observacoes) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-slate-400">
                  {patient.responsavel && (
                    <span className="inline-flex items-center gap-1"><CircleUserRound className="h-3 w-3" /> Resp. {patient.responsavel}</span>
                  )}
                  {patient.convenio && <span>Convênio: {patient.convenio}</span>}
                  {patient.telefone && (
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {patient.telefone}</span>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Sheet open={formOpen} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full gap-0 border-l border-[#081b2c]/10 bg-[#fbfaf8] p-0 sm:max-w-[660px]">
          <SheetHeader className="border-b border-[#081b2c]/[0.07] bg-white px-5 pb-5 pt-6 sm:px-7">
            <div className="flex items-center gap-3 pr-8">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f5e7dd] text-[#c87543]">
                {editingId ? <Edit3 className="h-5 w-5" /> : <FileHeart className="h-5 w-5" />}
              </span>
              <div>
                <SheetTitle className="text-left text-lg font-extrabold tracking-[-0.03em] text-[#081b2c]">
                  {editingId ? 'Editar paciente' : 'Novo paciente'}
                </SheetTitle>
                <SheetDescription className="mt-1 text-left text-[11px]">
                  Dados clínicos essenciais para organizar o acompanhamento.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            <div className="mb-5 flex items-center gap-2">
              <span className="h-px flex-1 bg-[#081b2c]/[0.07]" />
              <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Identificação e contato</span>
              <span className="h-px flex-1 bg-[#081b2c]/[0.07]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do paciente" required className="sm:col-span-2">
                <input className={inputClass} value={form.nome} onChange={(event) => set('nome', event.target.value)} placeholder="Nome completo da criança" />
              </Field>
              <Field label="Responsável">
                <input className={inputClass} value={form.responsavel} onChange={(event) => set('responsavel', event.target.value)} placeholder="Nome do pai, mãe ou tutor" />
              </Field>
              <Field label="WhatsApp com DDD" required>
                <input className={inputClass} value={form.telefone} onChange={(event) => set('telefone', event.target.value)} placeholder="(13) 99999-9999" inputMode="tel" />
              </Field>
              <Field label="Data de nascimento">
                <input type="date" className={inputClass} value={form.nascimento} onChange={(event) => set('nascimento', event.target.value)} />
              </Field>
              <Field label="Sexo">
                <select className={inputClass} value={form.sexo} onChange={(event) => set('sexo', event.target.value as PatientDraft['sexo'])}>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                  <option value="O">Outro / não informado</option>
                </select>
              </Field>
            </div>

            <div className="my-6 flex items-center gap-2">
              <span className="h-px flex-1 bg-[#081b2c]/[0.07]" />
              <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Consulta e contexto clínico</span>
              <span className="h-px flex-1 bg-[#081b2c]/[0.07]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data da consulta" required>
                <input type="date" className={inputClass} value={form.dataConsulta} onChange={(event) => set('dataConsulta', event.target.value)} />
              </Field>
              <Field label="Unidade">
                <select className={inputClass} value={form.unidade} onChange={(event) => set('unidade', event.target.value)}>
                  {UNIDADES.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </Field>
              <Field label="Cidade">
                <input className={inputClass} value={form.cidade} onChange={(event) => set('cidade', event.target.value)} placeholder="Santos" />
              </Field>
              <Field label="Bairro / região">
                <input className={inputClass} value={form.bairro} onChange={(event) => set('bairro', event.target.value)} placeholder="Gonzaga" />
              </Field>
              <Field label="Convênio">
                <input className={inputClass} value={form.convenio} onChange={(event) => set('convenio', event.target.value)} placeholder="Particular, Unimed..." />
              </Field>
              <Field label="CID-10">
                <input className={inputClass} value={form.cid} onChange={(event) => set('cid', event.target.value)} placeholder="K59.0" />
              </Field>
              <Field label="Observações" className="sm:col-span-2">
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={form.observacoes}
                  onChange={(event) => set('observacoes', event.target.value)}
                  placeholder="Queixa principal, orientações, retornos marcados..."
                />
              </Field>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] font-bold text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-2 border-t border-[#081b2c]/[0.07] bg-white px-5 py-4 sm:px-7">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#081b2c] px-5 py-3 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(8,27,44,.16)] transition hover:bg-[#102d47]"
            >
              <Check className="h-4 w-4 text-[#e3a078]" strokeWidth={3} />
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar paciente'}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-[14px] border border-[#081b2c]/10 bg-white px-4 py-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
