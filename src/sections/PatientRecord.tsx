import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bold,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Edit3,
  FileHeart,
  HeartPulse,
  Italic,
  List,
  ListOrdered,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Ruler,
  Scale,
  Stethoscope,
  Underline,
  UserRound,
  Video,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { fmtBR, idade, todayISO } from '@/lib/followup'
import type {
  Consultation,
  ConsultationDraft,
  ConsultationType,
  Patient,
} from '@/types/patient'
import { UNIDADES } from '@/types/patient'

interface PatientRecordProps {
  patient: Patient | null
  open: boolean
  startInConsultationForm?: boolean
  onOpenChange: (open: boolean) => void
  listConsultations: (patientId: string) => Promise<Consultation[]>
  addConsultation: (patientId: string, draft: ConsultationDraft) => Promise<void>
  updateConsultation: (patientId: string, consultationId: string, draft: ConsultationDraft) => Promise<void>
  onEditRegistration: (patient: Patient) => void
}

const consultationLabels: Record<ConsultationType, string> = {
  initial: 'Consulta inicial',
  return: 'Retorno',
  telemedicine: 'Telemedicina',
  other: 'Outro atendimento',
}

const inputClass =
  'mt-1.5 w-full rounded-[13px] border border-[#081b2c]/10 bg-[#fafaf8] px-3.5 py-2.5 text-xs font-semibold text-[#081b2c] outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-[#dc8e5f] focus:bg-white focus:ring-4 focus:ring-[#dc8e5f]/10 disabled:cursor-not-allowed disabled:opacity-60'

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const editorColors = [
  { label: 'Escuro', value: '#081b2c' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Verde', value: '#557f75' },
  { label: 'Laranja', value: '#c87543' },
]

const editorTags = new Set(['B', 'BR', 'DIV', 'EM', 'FONT', 'I', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'U', 'UL'])

function normalizeEditorColor(value: string) {
  const compact = value.replace(/\s/g, '').toLowerCase()
  return editorColors.find((option) => {
    const hex = option.value.toLowerCase()
    const red = Number.parseInt(hex.slice(1, 3), 16)
    const green = Number.parseInt(hex.slice(3, 5), 16)
    const blue = Number.parseInt(hex.slice(5, 7), 16)
    return compact === hex || compact === `rgb(${red},${green},${blue})`
  })?.value
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

function textToEditorHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function sanitizeRichText(value: string) {
  if (typeof window === 'undefined') return value

  const document = new DOMParser().parseFromString(value, 'text/html')
  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    if (!editorTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    const color = (element instanceof HTMLElement ? element.style.color : '') || element.getAttribute('color') || ''
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)

    const selectedColor = normalizeEditorColor(color)
    if (selectedColor && element.tagName === 'SPAN') {
      element.setAttribute('style', `color: ${selectedColor}`)
    }
    if (selectedColor && element.tagName === 'FONT') {
      element.setAttribute('color', selectedColor)
    }
  }

  return document.body.innerHTML
}

function editorValue(value: string) {
  const sanitized = sanitizeRichText(value)
  return sanitized === value && !/[<>]/.test(value) ? textToEditorHtml(value) : sanitized
}

function emptyConsultation(patient: Patient | null): ConsultationDraft {
  return {
    data: todayISO(),
    tipo: 'return',
    unidade: patient?.unidade || UNIDADES[0],
    peso: '',
    altura: '',
    queixa: '',
    historiaEvolucao: '',
    antecedentesPessoais: '',
    antecedentesFamiliares: '',
    alergias: '',
    medicamentos: '',
    exameFisico: '',
    avaliacao: '',
    cid: patient?.cid || '',
    conduta: '',
    prescricao: '',
    retorno: '',
    observacoes: '',
  }
}

function consultationToDraft(consultation: Consultation): ConsultationDraft {
  return {
    data: consultation.data,
    tipo: consultation.tipo,
    unidade: consultation.unidade,
    peso: consultation.peso,
    altura: consultation.altura,
    queixa: consultation.queixa,
    historiaEvolucao: consultation.historiaEvolucao,
    antecedentesPessoais: consultation.antecedentesPessoais,
    antecedentesFamiliares: consultation.antecedentesFamiliares,
    alergias: consultation.alergias,
    medicamentos: consultation.medicamentos,
    exameFisico: consultation.exameFisico,
    avaliacao: consultation.avaliacao,
    cid: consultation.cid,
    conduta: consultation.conduta,
    prescricao: consultation.prescricao,
    retorno: consultation.retorno,
    observacoes: consultation.observacoes,
  }
}

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

function RichTextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState('')

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const nextValue = editorValue(value)
    if (editor.innerHTML !== nextValue) editor.innerHTML = nextValue
  }, [value])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  function syncEditor() {
    onChange(sanitizeRichText(editorRef.current?.innerHTML || ''))
  }

  function command(commandName: string, commandValue?: string) {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(commandName, false, commandValue)
    window.setTimeout(syncEditor, 0)
  }

  function pasteAsText(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    window.setTimeout(syncEditor, 0)
  }

  async function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('microfone indisponível')
      }
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
      microphone.getTracks().forEach((track) => track.stop())
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotFoundError') {
        setSpeechError('Nenhum microfone foi encontrado. Conecte um microfone e clique em Ditar novamente.')
      } else if (name === 'NotAllowedError' || name === 'SecurityError') {
        setSpeechError('O microfone está bloqueado no navegador. Clique no ícone de controles ou cadeado ao lado do endereço do site, permita Microfone e recarregue a página.')
      } else {
        setSpeechError('Não foi possível acessar o microfone. Verifique se ele está conectado e tente novamente.')
      }
      return
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!Recognition) {
      setSpeechError('O microfone foi autorizado, mas o ditado não é compatível com este navegador. Use o Google Chrome para converter a fala em texto.')
      return
    }

    setSpeechError('')
    const recognition = new Recognition()
    recognition.lang = 'pt-BR'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ')

      if (!transcript) return
      const current = sanitizeRichText(editorRef.current?.innerHTML || '')
      const next = `${current}${current ? '<br>' : ''}${textToEditorHtml(transcript)}`
      if (editorRef.current) editorRef.current.innerHTML = next
      onChange(sanitizeRichText(next))
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setSpeechError('Não foi possível concluir o ditado. Verifique a permissão do microfone e tente novamente.')
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  return (
    <Field label={label} required={required} className={className}>
      <div className="mt-1.5 overflow-hidden rounded-[13px] border border-[#081b2c]/10 bg-[#fafaf8] transition focus-within:border-[#dc8e5f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#dc8e5f]/10">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#081b2c]/[0.07] bg-white px-2 py-1.5">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('bold')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#081b2c]" aria-label="Negrito" title="Negrito"><Bold className="h-3.5 w-3.5" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('italic')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#081b2c]" aria-label="Itálico" title="Itálico"><Italic className="h-3.5 w-3.5" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('underline')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#081b2c]" aria-label="Sublinhado" title="Sublinhado"><Underline className="h-3.5 w-3.5" /></button>
          <span className="mx-0.5 h-4 w-px bg-[#081b2c]/10" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('insertUnorderedList')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#081b2c]" aria-label="Lista" title="Lista"><List className="h-3.5 w-3.5" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('insertOrderedList')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#081b2c]" aria-label="Lista numerada" title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></button>
          <span className="mx-0.5 h-4 w-px bg-[#081b2c]/10" />
          {editorColors.map((color) => <button key={color.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('foreColor', color.value)} className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-[#081b2c]/10" style={{ backgroundColor: color.value }} aria-label={`Cor ${color.label}`} title={`Cor ${color.label}`} />)}
          <span className="flex-1" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void toggleDictation()} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-extrabold transition ${listening ? 'bg-red-50 text-red-600' : 'bg-[#eef3f2] text-[#557f75] hover:bg-[#e2ece9]'}`} aria-label={listening ? 'Parar ditado' : 'Ditar por microfone'} title={listening ? 'Parar ditado' : 'Ditar por microfone'}>{listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}{listening ? 'Ouvindo...' : 'Ditar'}</button>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholder} onInput={syncEditor} onPaste={pasteAsText} className="min-h-[92px] px-3.5 py-2.5 text-xs font-medium leading-relaxed text-[#081b2c] outline-none empty:before:pointer-events-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)]" />
      </div>
      {speechError && <p className="mt-1.5 text-[9px] font-semibold leading-relaxed text-red-500">{speechError}</p>}
    </Field>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <span className="h-px flex-1 bg-[#081b2c]/[0.07]" />
      <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#081b2c]/[0.07]" />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
  return (
    <div className="rounded-[14px] border border-[#081b2c]/[0.06] bg-[#faf9f7] px-3.5 py-3">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <div
        className="mt-1.5 whitespace-pre-wrap text-[11px] font-medium leading-relaxed text-[#294054] [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
        dangerouslySetInnerHTML={{ __html: editorValue(value) }}
      />
    </div>
  )
}

function ConsultationTypeIcon({ type }: { type: ConsultationType }) {
  if (type === 'telemedicine') return <Video className="h-4 w-4" />
  if (type === 'return') return <RefreshCw className="h-4 w-4" />
  if (type === 'initial') return <FileHeart className="h-4 w-4" />
  return <Stethoscope className="h-4 w-4" />
}

function ConsultationCard({
  consultation,
  onEdit,
}: {
  consultation: Consultation
  onEdit: (consultation: Consultation) => void
}) {
  const summary = consultation.avaliacao || consultation.queixa || consultation.historiaEvolucao || consultation.conduta

  return (
    <AccordionItem
      value={consultation.id}
      className="overflow-hidden rounded-[20px] border border-[#081b2c]/[0.075] bg-white shadow-[0_8px_24px_rgba(8,27,44,.035)]"
    >
      <AccordionTrigger className="gap-3 px-4 py-4 hover:no-underline sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f5e7dd] text-[#c87543]">
            <ConsultationTypeIcon type={consultation.tipo} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-[#081b2c]">
                {consultationLabels[consultation.tipo]}
              </span>
              {consultation.cid && (
                <span className="rounded-full bg-[#eef3f2] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#557f75]">
                  CID {consultation.cid.toUpperCase()}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {fmtBR(consultation.data)}
              </span>
              {consultation.unidade && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {consultation.unidade}
                </span>
              )}
              {consultation.peso && (
                <span className="inline-flex items-center gap-1">
                  <Scale className="h-3 w-3" /> {consultation.peso} kg
                </span>
              )}
              {consultation.altura && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="h-3 w-3" /> {consultation.altura} cm
                </span>
              )}
            </div>
            {summary && <p className="mt-2 line-clamp-1 text-[10px] font-medium text-slate-500">{summary}</p>}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="flex justify-end border-t border-[#081b2c]/[0.06] pt-3">
          <button
            type="button"
            onClick={() => onEdit(consultation)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#c87543]/20 bg-[#fdf4ef] px-3 py-2 text-[10px] font-extrabold text-[#b96535] transition hover:bg-[#f8e6dc]"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar consulta
          </button>
        </div>
        <div className="grid gap-2 border-t border-[#081b2c]/[0.06] pt-4 sm:grid-cols-2">
          <Detail label="Queixa principal" value={consultation.queixa} />
          <Detail label="História / evolução" value={consultation.historiaEvolucao} />
          <Detail label="Antecedentes pessoais" value={consultation.antecedentesPessoais} />
          <Detail label="Antecedentes familiares" value={consultation.antecedentesFamiliares} />
          <Detail label="Alergias" value={consultation.alergias} />
          <Detail label="Medicamentos em uso" value={consultation.medicamentos} />
          <Detail label="Exame físico" value={consultation.exameFisico} />
          <Detail label="Avaliação / hipótese diagnóstica" value={consultation.avaliacao} />
          <Detail label="Conduta" value={consultation.conduta} />
          <Detail label="Prescrição" value={consultation.prescricao} />
          <Detail label="Retorno" value={consultation.retorno} />
          <Detail label="Observações" value={consultation.observacoes} />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default function PatientRecord({
  patient,
  open,
  startInConsultationForm = false,
  onOpenChange,
  listConsultations,
  addConsultation,
  updateConsultation,
  onEditRegistration,
}: PatientRecordProps) {
  const [mode, setMode] = useState<'history' | 'form'>('history')
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [form, setForm] = useState<ConsultationDraft>(() => emptyConsultation(patient))
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const loadSequence = useRef(0)

  async function load(patientId: string) {
    const sequence = ++loadSequence.current
    setLoading(true)
    setLoadError('')
    try {
      const result = await listConsultations(patientId)
      if (sequence !== loadSequence.current) return
      setConsultations(
        [...result].sort((a, b) => {
          const byDate = b.data.localeCompare(a.data)
          return byDate || b.criadoEm.localeCompare(a.criadoEm)
        }),
      )
    } catch (cause) {
      if (sequence !== loadSequence.current) return
      setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar o prontuário.')
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !patient) return
    setMode(startInConsultationForm ? 'form' : 'history')
    setForm(emptyConsultation(patient))
    setEditingConsultationId(null)
    setFormError('')
    void load(patient.id)

    return () => {
      loadSequence.current += 1
    }
    // A troca do paciente deve reiniciar integralmente o painel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient?.id, startInConsultationForm])

  function set<K extends keyof ConsultationDraft>(key: K, value: ConsultationDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function startNewConsultation() {
    setForm(emptyConsultation(patient))
    setEditingConsultationId(null)
    setFormError('')
    setMode('form')
  }

  function startEditingConsultation(consultation: Consultation) {
    setForm(consultationToDraft(consultation))
    setEditingConsultationId(consultation.id)
    setFormError('')
    setMode('form')
  }

  function backToHistory() {
    if (saving) return
    setEditingConsultationId(null)
    setFormError('')
    setMode('history')
  }

  async function save() {
    if (!patient) return
    if (!form.data || Number.isNaN(new Date(`${form.data}T12:00:00`).getTime())) {
      setFormError('Informe uma data válida para a consulta.')
      return
    }

    const clinicalSummary = [form.queixa, form.historiaEvolucao, form.avaliacao, form.conduta]
    if (!clinicalSummary.some((value) => value.trim())) {
      setFormError('Preencha ao menos a queixa, evolução, avaliação ou conduta.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const draft = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
      ) as unknown as ConsultationDraft
      if (editingConsultationId) {
        await updateConsultation(patient.id, editingConsultationId, draft)
      } else {
        await addConsultation(patient.id, draft)
      }
      setMode('history')
      setEditingConsultationId(null)
      setForm(emptyConsultation(patient))
      await load(patient.id)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar esta consulta.')
    } finally {
      setSaving(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      loadSequence.current += 1
      setMode('history')
      setEditingConsultationId(null)
      setFormError('')
      setLoadError('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[#081b2c]/10 bg-[#fbfaf8] p-0 sm:max-w-[760px] lg:max-w-[900px]"
      >
        <SheetHeader className="border-b border-[#081b2c]/[0.07] bg-white px-5 pb-5 pt-6 sm:px-7">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#e7f0ed] text-[#557f75]">
              <FileHeart className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#c87543]">
                Prontuário do paciente
              </p>
              <SheetTitle className="mt-1 truncate text-left text-lg font-extrabold tracking-[-0.03em] text-[#081b2c]">
                {patient?.nome || 'Paciente não selecionado'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Histórico clínico e registro de novas consultas do paciente.
              </SheetDescription>
              {patient && (patient.nascimento || patient.responsavel || patient.telefone || patient.convenio) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400">
                  {patient.nascimento && <span>{idade(patient.nascimento)}</span>}
                  {patient.responsavel && (
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3 w-3" /> Resp. {patient.responsavel}
                    </span>
                  )}
                  {patient.telefone && (
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3 w-3" /> {patient.telefone}
                    </span>
                  )}
                  {patient.convenio && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" /> {patient.convenio}
                    </span>
                  )}
                </div>
              )}
              {patient && (
                <button
                  type="button"
                  onClick={() => onEditRegistration(patient)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#081b2c]/10 bg-[#fbfaf8] px-3 py-2 text-[10px] font-extrabold text-slate-500 transition hover:border-[#c87543]/30 hover:text-[#c87543]"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Editar dados cadastrais
                </button>
              )}
            </div>
          </div>
        </SheetHeader>

        {!patient ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <UserRound className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-extrabold text-[#081b2c]">Nenhum paciente selecionado</p>
              <p className="mt-1 text-xs text-slate-400">Feche este painel e escolha um paciente.</p>
            </div>
          </div>
        ) : mode === 'history' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-[#081b2c]/[0.06] bg-[#fbfaf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <h2 className="text-sm font-extrabold tracking-[-0.02em] text-[#081b2c]">Histórico clínico</h2>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  {consultations.length > 0
                    ? `${consultations.length} ${consultations.length === 1 ? 'consulta registrada' : 'consultas registradas'} · mais recentes primeiro`
                    : 'Consultas e evoluções ficam organizadas aqui.'}
                </p>
              </div>
              <button
                type="button"
                onClick={startNewConsultation}
                className="flex items-center justify-center gap-2 rounded-[14px] bg-[#dc8e5f] px-4 py-2.5 text-[10px] font-extrabold text-white shadow-[0_8px_18px_rgba(220,142,95,.2)] transition hover:-translate-y-0.5 hover:bg-[#cf7f50]"
              >
                <Plus className="h-3.5 w-3.5" /> Nova consulta
              </button>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {loading ? (
                <div className="flex min-h-[280px] items-center justify-center text-center">
                  <div>
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#c87543]" />
                    <p className="mt-3 text-xs font-bold text-slate-400">Carregando prontuário...</p>
                  </div>
                </div>
              ) : loadError ? (
                <div className="mx-auto max-w-md rounded-[20px] border border-red-100 bg-red-50 px-5 py-6 text-center">
                  <HeartPulse className="mx-auto h-7 w-7 text-red-400" />
                  <p className="mt-3 text-xs font-extrabold text-red-700">Não foi possível abrir o prontuário</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-red-500">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void load(patient.id)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[10px] font-extrabold text-red-600 shadow-sm"
                  >
                    <RefreshCw className="h-3 w-3" /> Tentar novamente
                  </button>
                </div>
              ) : consultations.length === 0 ? (
                <div className="flex min-h-[320px] items-center justify-center text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#f5e7dd] text-[#c87543]">
                      <ClipboardList className="h-7 w-7" />
                    </span>
                    <h2 className="mt-4 text-sm font-extrabold text-[#081b2c]">Prontuário pronto para começar</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      Registre a primeira consulta para criar a linha do tempo clínica deste paciente.
                    </p>
                    <button
                      type="button"
                      onClick={startNewConsultation}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#081b2c] px-4 py-2.5 text-[10px] font-extrabold text-white"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#e3a078]" /> Registrar primeira consulta
                    </button>
                  </div>
                </div>
              ) : (
                <Accordion type="single" collapsible className="space-y-3">
                  {consultations.map((consultation) => (
                    <ConsultationCard
                      key={consultation.id}
                      consultation={consultation}
                      onEdit={startEditingConsultation}
                    />
                  ))}
                </Accordion>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[#081b2c]/[0.06] bg-[#fbfaf8] px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={backToHistory}
                disabled={saving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#081b2c]/10 bg-white text-slate-500 transition hover:text-[#c87543] disabled:opacity-50"
                aria-label="Voltar ao histórico"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-sm font-extrabold tracking-[-0.02em] text-[#081b2c]">
                  {editingConsultationId ? 'Editar consulta' : 'Nova consulta'}
                </h2>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  {editingConsultationId
                    ? 'Atualize o registro clínico e salve as alterações.'
                    : 'Registre a evolução clínica com segurança e clareza.'}
                </p>
              </div>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <SectionTitle>Atendimento</SectionTitle>
                <Field label="Data da consulta" required>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.data}
                    onChange={(event) => set('data', event.target.value)}
                  />
                </Field>
                <Field label="Tipo de atendimento">
                  <select
                    className={inputClass}
                    value={form.tipo}
                    onChange={(event) => set('tipo', event.target.value as ConsultationType)}
                  >
                    {Object.entries(consultationLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unidade" className="sm:col-span-2">
                  <select className={inputClass} value={form.unidade} onChange={(event) => set('unidade', event.target.value)}>
                    {UNIDADES.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
                  </select>
                </Field>
                <Field label="Peso (kg)">
                  <input
                    className={inputClass}
                    value={form.peso}
                    onChange={(event) => set('peso', event.target.value)}
                    inputMode="decimal"
                    placeholder="Ex.: 24,5"
                  />
                </Field>
                <Field label="Altura (cm)">
                  <input
                    className={inputClass}
                    value={form.altura}
                    onChange={(event) => set('altura', event.target.value)}
                    inputMode="decimal"
                    placeholder="Ex.: 128"
                  />
                </Field>

                <SectionTitle>Motivo e evolução</SectionTitle>
                <RichTextField
                  label="Queixa principal"
                  value={form.queixa}
                  onChange={(value) => set('queixa', value)}
                  placeholder="Motivo principal desta consulta..."
                />
                <RichTextField
                  label="História / evolução"
                  value={form.historiaEvolucao}
                  onChange={(value) => set('historiaEvolucao', value)}
                  placeholder="Início, duração, sintomas e evolução..."
                />

                <SectionTitle>Antecedentes</SectionTitle>
                <RichTextField
                  label="Antecedentes pessoais"
                  value={form.antecedentesPessoais}
                  onChange={(value) => set('antecedentesPessoais', value)}
                  placeholder="Condições, cirurgias e internações..."
                />
                <RichTextField
                  label="Antecedentes familiares"
                  value={form.antecedentesFamiliares}
                  onChange={(value) => set('antecedentesFamiliares', value)}
                  placeholder="Histórico familiar relevante..."
                />
                <RichTextField
                  label="Alergias"
                  value={form.alergias}
                  onChange={(value) => set('alergias', value)}
                  placeholder="Medicamentos, alimentos ou outras alergias..."
                />
                <RichTextField
                  label="Medicamentos em uso"
                  value={form.medicamentos}
                  onChange={(value) => set('medicamentos', value)}
                  placeholder="Nome, dose e frequência..."
                />

                <SectionTitle>Exame e avaliação</SectionTitle>
                <RichTextField
                  label="Exame físico"
                  value={form.exameFisico}
                  onChange={(value) => set('exameFisico', value)}
                  placeholder="Achados do exame físico..."
                />
                <RichTextField
                  label="Avaliação / hipótese diagnóstica"
                  value={form.avaliacao}
                  onChange={(value) => set('avaliacao', value)}
                  placeholder="Impressão clínica e hipóteses..."
                />
                <Field label="CID-10" className="sm:col-span-2">
                  <input
                    className={inputClass}
                    value={form.cid}
                    onChange={(event) => set('cid', event.target.value)}
                    placeholder="Ex.: K59.0"
                  />
                </Field>

                <SectionTitle>Plano de cuidado</SectionTitle>
                <RichTextField
                  label="Conduta"
                  value={form.conduta}
                  onChange={(value) => set('conduta', value)}
                  placeholder="Orientações, exames e encaminhamentos..."
                />
                <RichTextField
                  label="Prescrição"
                  value={form.prescricao}
                  onChange={(value) => set('prescricao', value)}
                  placeholder="Medicamento, dose, via e duração..."
                />
                <RichTextField
                  label="Retorno"
                  value={form.retorno}
                  onChange={(value) => set('retorno', value)}
                  placeholder="Prazo e condições para retorno..."
                />
                <RichTextField
                  label="Observações"
                  value={form.observacoes}
                  onChange={(value) => set('observacoes', value)}
                  placeholder="Informações complementares..."
                />
              </div>

              <p className="mt-5 rounded-[14px] bg-[#eef3f2] px-4 py-3 text-[10px] font-semibold leading-relaxed text-[#557f75]">
                Preencha pelo menos um destes campos: queixa principal, história/evolução, avaliação ou conduta.
              </p>

              {formError && (
                <p className="mt-3 rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-600">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#081b2c]/[0.07] bg-white px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#081b2c] px-5 py-3 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(8,27,44,.16)] transition hover:bg-[#102d47] disabled:cursor-wait disabled:opacity-70"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-[#e3a078]" strokeWidth={3} />}
                {saving
                  ? 'Salvando consulta...'
                  : editingConsultationId
                    ? 'Salvar alterações'
                    : 'Salvar consulta'}
              </button>
              <button
                type="button"
                onClick={backToHistory}
                disabled={saving}
                className="rounded-[14px] border border-[#081b2c]/10 bg-white px-4 py-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

