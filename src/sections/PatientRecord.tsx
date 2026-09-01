import { useEffect, useRef, useState } from 'react'
import { invokeWithFormData } from '@/lib/supabase'
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkPlus,
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
  Printer,
  RefreshCw,
  Ruler,
  Scale,
  Search,
  Stethoscope,
  Underline,
  UserRound,
  Video,
  X,
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
import {
  archiveNoteTemplate,
  createNoteTemplate,
  getCurrentMembership,
  listNoteTemplates,
  type NoteTemplate,
} from '@/lib/repository'
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

/**
 * Formatos que o navegador pode usar para gravar. O Chrome prefere webm/opus,
 * o Safari so aceita mp4. Testamos em ordem e usamos o primeiro suportado.
 */
const FORMATOS_AUDIO = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

function extensaoDoFormato(mime: string) {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/* ------------------------------------------------------------------ *
 * Áudio compartilhado por toda a tela
 *
 * O prontuario tem mais de dez campos de texto, e cada um e um componente
 * independente. Se cada um criasse o proprio AudioContext e a propria reserva
 * de microfone, o navegador estouraria o limite (o Chrome permite cerca de
 * seis contextos por pagina) depois de o medico ditar em alguns campos - e a
 * partir dali nenhum audio passaria mais, em campo nenhum, ate fechar o
 * navegador.
 *
 * Por isso o contexto e o microfone vivem aqui fora, um para a tela inteira.
 * ------------------------------------------------------------------ */

let contextoCompartilhado: AudioContext | null = null
let streamCompartilhado: MediaStream | null = null
let timerLiberacao: number | null = null

function obterContexto(): AudioContext {
  if (!contextoCompartilhado || contextoCompartilhado.state === 'closed') {
    contextoCompartilhado = new AudioContext()
  }
  return contextoCompartilhado
}

function faixaViva(stream: MediaStream | null) {
  const faixa = stream?.getAudioTracks()[0]
  return Boolean(faixa && faixa.readyState === 'live' && !faixa.muted)
}

async function obterMicrofone(): Promise<MediaStream> {
  if (timerLiberacao) {
    window.clearTimeout(timerLiberacao)
    timerLiberacao = null
  }
  if (faixaViva(streamCompartilhado)) return streamCompartilhado as MediaStream

  liberarMicrofone()
  streamCompartilhado = await navigator.mediaDevices.getUserMedia({
    // Melhora bastante a transcricao em sala de consultorio.
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  return streamCompartilhado
}

function liberarMicrofone() {
  if (timerLiberacao) {
    window.clearTimeout(timerLiberacao)
    timerLiberacao = null
  }
  streamCompartilhado?.getTracks().forEach((faixa) => faixa.stop())
  streamCompartilhado = null
}

/** Mantem o microfone por um tempo curto, para ditados seguidos nao repedirem. */
function agendarLiberacaoMicrofone() {
  if (timerLiberacao) window.clearTimeout(timerLiberacao)
  timerLiberacao = window.setTimeout(liberarMicrofone, 20000)
}

const editorColors = [
  { label: 'Escuro', value: '#081b2c' },
  { label: 'Vermelho', value: '#c02626' },
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

/** Converte "24,5" ou "24.5" em numero. Vazio ou invalido vira null. */
function numeroBR(valor: string): number | null {
  const limpo = valor.replace(',', '.').replace(/[^\d.]/g, '')
  if (!limpo) return null
  const numero = Number(limpo)
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

/**
 * IMC a partir de peso em kg e altura em cm.
 *
 * Fica aqui e nao no banco porque e derivado: guardar o resultado criaria a
 * chance de peso e IMC discordarem depois de uma correcao no cadastro.
 */
function calcularIMC(peso: string, altura: string): number | null {
  const kg = numeroBR(peso)
  const cm = numeroBR(altura)
  if (!kg || !cm) return null
  const metros = cm / 100
  return kg / (metros * metros)
}

function formatarVariacao(atual: number | null, anterior: number | null) {
  if (atual === null || anterior === null) return null
  const diferenca = atual - anterior
  if (Math.abs(diferenca) < 0.05) return 'sem mudança'
  return `${diferenca > 0 ? '+' : ''}${diferenca.toFixed(1).replace('.', ',')}`
}

/**
 * Monta e abre a versao para impressao do prontuario.
 *
 * Usa uma janela separada de proposito: o prontuario vive dentro de um painel
 * com rolagem propria, e mandar imprimir a pagina como esta cortaria o
 * conteudo. Aqui o documento nasce ja no formato de papel.
 */
function imprimirProntuario(patient: Patient, consultas: Consultation[]) {
  const campos: [string, keyof Consultation][] = [
    ['Queixa principal', 'queixa'],
    ['História / evolução', 'historiaEvolucao'],
    ['Antecedentes pessoais', 'antecedentesPessoais'],
    ['Antecedentes familiares', 'antecedentesFamiliares'],
    ['Alergias', 'alergias'],
    ['Medicamentos em uso', 'medicamentos'],
    ['Exame físico', 'exameFisico'],
    ['Avaliação / hipótese diagnóstica', 'avaliacao'],
    ['Conduta', 'conduta'],
    ['Prescrição', 'prescricao'],
    ['Retorno', 'retorno'],
    ['Observações clínicas', 'observacoes'],
  ]

  const cabecalhoPaciente = [
    ['Paciente', patient.nome],
    ['Nascimento', patient.nascimento ? `${fmtBR(patient.nascimento)} (${idade(patient.nascimento)})` : ''],
    ['Responsável', patient.responsavel],
    ['Convênio', patient.convenio],
    ['Cidade', [patient.cidade, patient.bairro].filter(Boolean).join(' · ')],
    ['Contato', patient.telefone],
  ]
    .filter(([, valor]) => valor)
    .map(([rotulo, valor]) => `<div><span class="r">${rotulo}</span><span class="v">${escapeHtml(String(valor))}</span></div>`)
    .join('')

  const corpo = consultas
    .map((consulta) => {
      const imc = calcularIMC(consulta.peso, consulta.altura)
      const medidas = [
        consulta.peso ? `${consulta.peso} kg` : '',
        consulta.altura ? `${consulta.altura} cm` : '',
        imc !== null ? `IMC ${imc.toFixed(1).replace('.', ',')}` : '',
      ]
        .filter(Boolean)
        .join(' · ')

      const blocos = campos
        .filter(([, chave]) => temTexto(String(consulta[chave] ?? '')))
        .map(
          ([rotulo, chave]) =>
            `<div class="bloco"><h3>${rotulo}</h3><div class="txt">${editorValue(String(consulta[chave]))}</div></div>`,
        )
        .join('')

      return `<section class="consulta">
        <h2>${consultationLabels[consulta.tipo]} — ${fmtBR(consulta.data)}</h2>
        <p class="meta">${[consulta.unidade, medidas, consulta.cid ? `CID ${consulta.cid.toUpperCase()}` : '']
          .filter(Boolean)
          .join('  ·  ')}</p>
        ${blocos}
      </section>`
    })
    .join('')

  const documento = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Prontuário - ${escapeHtml(patient.nome)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #14202c; margin: 0; padding: 28px 32px; font-size: 12pt; line-height: 1.55; }
      header { border-bottom: 2px solid #14202c; padding-bottom: 12px; margin-bottom: 18px; }
      header h1 { margin: 0; font-size: 17pt; }
      header p { margin: 2px 0 0; font-size: 10pt; color: #55606b; }
      .paciente { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 22px; font-size: 11pt; }
      .paciente .r { display: inline-block; min-width: 105px; color: #55606b; }
      .paciente .v { font-weight: bold; }
      .consulta { page-break-inside: avoid; border-top: 1px solid #d4d9de; padding-top: 14px; margin-top: 18px; }
      .consulta h2 { font-size: 13pt; margin: 0 0 2px; }
      .meta { margin: 0 0 12px; font-size: 10pt; color: #55606b; }
      .bloco { margin-bottom: 11px; page-break-inside: avoid; }
      .bloco h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: .04em; color: #55606b; margin: 0 0 3px; font-weight: bold; }
      .txt ul, .txt ol { margin: 4px 0; padding-left: 20px; }
      footer { margin-top: 32px; border-top: 1px solid #d4d9de; padding-top: 10px; font-size: 9pt; color: #7b858e; }
      @page { margin: 16mm; }
    </style></head><body>
    <header>
      <h1>Clínica Dr. Marcello Ruiz</h1>
      <p>Prontuário clínico</p>
    </header>
    <div class="paciente">${cabecalhoPaciente}</div>
    ${corpo || '<p>Nenhuma consulta registrada.</p>'}
    <footer>Documento gerado pelo sistema em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}. Documento sigiloso, de uso restrito conforme a legislação de proteção de dados.</footer>
    </body></html>`

  const janela = window.open('', '_blank', 'width=900,height=1000')
  if (!janela) {
    window.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.')
    return
  }
  janela.document.write(documento)
  janela.document.close()
  janela.focus()
  // Espera o conteudo assentar antes de chamar a impressao.
  window.setTimeout(() => janela.print(), 350)
}

/** Texto puro de um campo do editor, para comparar e para buscar. */
function textoSimples(html: string) {
  if (typeof window === 'undefined') return html
  const documento = new DOMParser().parseFromString(html, 'text/html')
  return (documento.body.textContent || '').replace(/\s+/g, ' ').trim()
}

/** Diz se o HTML tem conteudo de verdade, ignorando <br> e espacos. */
function temTexto(html: string) {
  if (typeof window === 'undefined') return html.trim().length > 0
  const documento = new DOMParser().parseFromString(html, 'text/html')
  return (documento.body.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0
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
  campo,
  modelos,
  onSalvarModelo,
  onApagarModelo,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  /** Chave do campo. Sem ela o botao de modelos nem aparece. */
  campo?: string
  modelos?: NoteTemplate[]
  onSalvarModelo?: (campo: string, titulo: string, texto: string) => Promise<void>
  onApagarModelo?: (id: string) => Promise<void>
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const dispositivoRef = useRef('')
  const chunksCountRef = useRef(0)
  const fonteRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const picoRef = useRef(0)
  const [nivel, setNivel] = useState(0)
  const [diagnostico, setDiagnostico] = useState('')
  const [listening, setListening] = useState(false)
  const [transcrevendo, setTranscrevendo] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [painelModelos, setPainelModelos] = useState(false)
  const [novoModelo, setNovoModelo] = useState('')
  const [salvandoModelo, setSalvandoModelo] = useState(false)

  const doCampo = campo ? (modelos ?? []).filter((m) => m.campo === campo) : []

  /**
   * Insere o modelo no fim do que ja existe, em vez de substituir.
   *
   * Mesmo caminho do ditado, e pelo mesmo motivo: campo "vazio" no
   * contenteditable costuma conter <br>, e sem a checagem o texto entraria
   * depois desse resto, nascendo com linha em branco na frente.
   */
  function inserirModelo(texto: string) {
    const atual = sanitizeRichText(editorRef.current?.innerHTML || '')
    const proximo = temTexto(atual) ? `${atual}<br>${texto}` : texto
    if (editorRef.current) editorRef.current.innerHTML = proximo
    onChange(sanitizeRichText(proximo))
    setPainelModelos(false)
  }

  async function salvarComoModelo() {
    const titulo = novoModelo.trim()
    const texto = sanitizeRichText(editorRef.current?.innerHTML || '')
    if (!titulo || !campo || !onSalvarModelo || !temTexto(texto)) return
    setSalvandoModelo(true)
    try {
      await onSalvarModelo(campo, titulo, texto)
      setNovoModelo('')
    } finally {
      setSalvandoModelo(false)
    }
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    // Nao reescreve o conteudo enquanto o medico esta digitando dentro dele.
    //
    // O editor guarda o texto no estado do React e devolve para o campo a cada
    // mudanca. Como a limpeza do HTML normaliza o que o navegador gera, os dois
    // quase nunca ficam identicos - e o campo era reescrito a cada tecla. Isso
    // movia o cursor, desligava o negrito recem-ativado e impedia as listas de
    // se formarem. Fora de foco a sincronia continua, para refletir edicoes
    // vindas de outro lugar, como o ditado.
    if (document.activeElement === editor) return
    const nextValue = editorValue(value)
    if (editor.innerHTML !== nextValue) editor.innerHTML = nextValue
  }, [value])

  // Se a tela for fechada no meio de uma gravacao, o microfone precisa ser
  // liberado. Sem isto o indicador de gravacao fica aceso no navegador.
  useEffect(
    () => () => {
      try {
        recorderRef.current?.stop()
      } catch {
        // gravacao ja encerrada
      }
      liberarMicrofone()
    },
    [],
  )

  /**
   * Solta o microfone ao sair da aba.
   *
   * Sem isto, a reserva do dispositivo continua enquanto o usuario abre o
   * WhatsApp Web ou uma chamada, os dois disputam o mesmo microfone, e o
   * servico de audio do Chrome trava - estado em que nem recarregar a pagina
   * resolve, so fechar o navegador.
   */
  useEffect(() => {
    function aoTrocarDeAba() {
      if (document.visibilityState !== 'hidden') return
      if (recorderRef.current?.state === 'recording') {
        // Gravacao em andamento: encerra normalmente para nao perder o audio.
        try {
          recorderRef.current.requestData()
          recorderRef.current.stop()
        } catch {
          // ja parado
        }
        return
      }
      liberarMicrofone()
    }

    document.addEventListener('visibilitychange', aoTrocarDeAba)
    return () => document.removeEventListener('visibilitychange', aoTrocarDeAba)
  }, [])

  function syncEditor() {
    onChange(sanitizeRichText(editorRef.current?.innerHTML || ''))
  }

  function command(commandName: string, commandValue?: string) {
    editorRef.current?.focus()
    // Só a cor precisa sair como estilo. Negrito, itálico e sublinhado devem
    // virar as tags <b>, <i> e <u>: com styleWithCSS ligado o navegador gera
    // <span style="font-weight:bold">, e a limpeza do HTML remove estilos que
    // não sejam cor - o negrito era aplicado e desaparecia em seguida.
    document.execCommand('styleWithCSS', false, commandName === 'foreColor' ? 'true' : 'false')
    document.execCommand(commandName, false, commandValue)
    window.setTimeout(syncEditor, 0)
  }

  function pasteAsText(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    window.setTimeout(syncEditor, 0)
  }

  /**
   * Gravacao de audio no estilo WhatsApp: aperta e grava, aperta de novo e o
   * texto cai no editor.
   *
   * Substituiu o SpeechRecognition do Chrome, que mandava o audio do prontuario
   * para servidor do Google sem contrato de tratamento de dados, so funcionava
   * no Chrome e parava a cada pausa da fala. Aqui o audio vai para uma Edge
   * Function nossa, que fala com a Groq com a chave guardada no servidor.
   */
  async function toggleDictation() {
    if (listening) {
      const gravador = recorderRef.current
      // Se o gravador sumiu ou ja parou mas o estado ficou preso em "gravando",
      // o botao ficaria morto ate recarregar a pagina. Aqui ele se destrava.
      if (!gravador || gravador.state === 'inactive') {
        encerrarMicrofone()
        setListening(false)
        return
      }
      try {
        // Pede o pedaco pendente antes de parar. Sem isto, uma gravacao curta
        // pode terminar antes do primeiro corte automatico e voltar vazia.
        if (gravador.state === 'recording') gravador.requestData()
        gravador.stop()
      } catch {
        encerrarMicrofone()
        setListening(false)
      }
      return
    }
    if (transcrevendo) return

    setSpeechError('')

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechError('Este navegador não permite gravar áudio. Use o Google Chrome atualizado.')
      return
    }

    let stream: MediaStream
    try {
      stream = await obterMicrofone()
    } catch (error) {
      const nome = error instanceof DOMException ? error.name : ''
      if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError') {
        setSpeechError('Nenhum microfone foi encontrado neste computador. Conecte um e tente de novo.')
      } else if (nome === 'NotAllowedError' || nome === 'SecurityError') {
        setSpeechError('O microfone está bloqueado. Clique no cadeado ao lado do endereço do site, permita Microfone e recarregue a página.')
      } else {
        setSpeechError('Não foi possível acessar o microfone.')
      }
      return
    }

    chunksRef.current = []
    const faixa = stream.getAudioTracks()[0]
    dispositivoRef.current = faixa?.label || 'microfone sem nome'
    // Uma faixa "muted" entrega frames vazios: o navegador achou o dispositivo,
    // mas o sistema operacional nao esta deixando o som passar.
    if (faixa && faixa.muted) {
      setSpeechError(
        `O microfone "${dispositivoRef.current}" está mudo no Windows. Abra Configurações do Windows, Sistema, Som, e verifique o volume e a privacidade do microfone.`,
      )
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    const formato = FORMATOS_AUDIO.find((tipo) => MediaRecorder.isTypeSupported(tipo)) || ''
    const recorder = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined)
    recorderRef.current = recorder

    chunksCountRef.current = 0
    recorder.ondataavailable = (evento) => {
      chunksCountRef.current += 1
      if (evento.data && evento.data.size > 0) chunksRef.current.push(evento.data)
    }

    recorder.onerror = () => {
      setSpeechError('A gravação falhou. Tente novamente.')
      encerrarMicrofone()
      setListening(false)
    }

    recorder.onstop = () => {
      const mime = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mime })
      chunksRef.current = []
      pararMonitor()
      recorderRef.current = null
      agendarLiberacaoMicrofone()
      setListening(false)
      void enviarParaTranscricao(blob, mime)
    }

    // Uma faixa que nao esta "live" nao entrega audio nenhum. Acontece quando o
    // Chrome segurou o dispositivo de uma gravacao anterior e nao soltou.
    if (faixa && faixa.readyState !== 'live') {
      setSpeechError(
        'O microfone não respondeu. Feche e abra o Chrome novamente — ele costuma ficar segurando o dispositivo.',
      )
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    void monitorarNivel(stream)

    // Cortes curtos: garantem que mesmo uma gravacao de 1 segundo tenha dados.
    recorder.start(250)
    setListening(true)

  }

  /**
   * Autoteste do microfone: grava 3 segundos e mostra os numeros crus.
   *
   * Existe porque o ambiente de desenvolvimento nao tem microfone, entao esta e
   * a unica forma de saber o que realmente acontece na maquina da clinica em
   * vez de deduzir pelo sintoma.
   */
  async function testarMicrofone() {
    setSpeechError('')
    setDiagnostico('Testando por 3 segundos, fale alguma coisa...')
    const linhas: string[] = []

    // Duas configuracoes: com o processamento do navegador e sem nada. Se a
    // segunda gravar e a primeira nao, o culpado e o processamento - conflito
    // conhecido entre o cancelamento de eco do Chrome e drivers de headset USB.
    const cenarios: { nome: string; restricao: MediaTrackConstraints | boolean }[] = [
      {
        nome: 'COM processamento',
        restricao: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      },
      {
        nome: 'SEM processamento',
        restricao: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      },
    ]

    for (const cenario of cenarios) {
      linhas.push(`--- ${cenario.nome} ---`)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: cenario.restricao })
        const faixa = stream.getAudioTracks()[0]
        linhas.push(`Dispositivo: ${faixa?.label || 'sem nome'}`)
        linhas.push(`Faixa: ${faixa?.readyState} | mudo: ${faixa?.muted}`)

        // Usa o contexto compartilhado: criar um por teste ajudaria a
        // estourar justamente o limite que estamos investigando.
        const contexto = obterContexto()
        if (contexto.state === 'suspended') await contexto.resume()
        const analisador = contexto.createAnalyser()
        analisador.fftSize = 512
        const fonteTeste = contexto.createMediaStreamSource(stream)
        fonteTeste.connect(analisador)
        const amostras = new Uint8Array(analisador.frequencyBinCount)
        let pico = 0

        const formato = FORMATOS_AUDIO.find((tipo) => MediaRecorder.isTypeSupported(tipo)) || ''
        const pedacos: Blob[] = []
        const gravador = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined)
        gravador.ondataavailable = (evento) => {
          if (evento.data) pedacos.push(evento.data)
        }

        await new Promise<void>((resolve) => {
          const relogio = window.setInterval(() => {
            analisador.getByteTimeDomainData(amostras)
            let soma = 0
            for (const amostra of amostras) {
              const desvio = (amostra - 128) / 128
              soma += desvio * desvio
            }
            pico = Math.max(pico, Math.sqrt(soma / amostras.length))
          }, 100)
          gravador.onstop = () => {
            window.clearInterval(relogio)
            resolve()
          }
          gravador.start(250)
          window.setTimeout(() => gravador.stop(), 3000)
        })

        const total = pedacos.reduce((soma, pedaco) => soma + pedaco.size, 0)
        linhas.push(`Bytes: ${total} | pico: ${pico.toFixed(4)}`)
        linhas.push(total > 0 && pico > 0.005 ? '>>> GRAVOU <<<' : 'nao gravou')

        fonteTeste.disconnect()
        stream.getTracks().forEach((t) => t.stop())
      } catch (erro) {
        linhas.push(`Falhou: ${erro instanceof Error ? `${erro.name} - ${erro.message}` : String(erro)}`)
      }
      // Deixa o dispositivo respirar entre um teste e outro.
      await new Promise((resolve) => window.setTimeout(resolve, 600))
    }

    setDiagnostico(linhas.join('\n'))
  }

  /**
   * Mede o som que esta realmente entrando pelo microfone.
   *
   * Serve para duas coisas: mostrar ao medico que a gravacao esta captando, e
   * distinguir "o navegador nao gravou" de "o microfone nao mandou som" - que
   * sao problemas diferentes e levam a solucoes diferentes.
   */
  async function monitorarNivel(stream: MediaStream) {
    try {
      // Um unico AudioContext para toda a vida do componente. Criar um novo a
      // cada gravacao estourava o limite do Chrome (cerca de seis) e, a partir
      // dali, o medidor parava de funcionar sem aviso - era o motivo de o
      // ditado morrer depois de algumas gravacoes.
      const contexto = obterContexto()

      // Contextos entram em suspensao sozinhos apos um tempo ocioso.
      if (contexto.state === 'suspended') await contexto.resume()

      const fonte = contexto.createMediaStreamSource(stream)
      fonteRef.current = fonte
      const analisador = contexto.createAnalyser()
      analisador.fftSize = 512
      fonte.connect(analisador)

      const amostras = new Uint8Array(analisador.frequencyBinCount)
      picoRef.current = 0

      const medir = () => {
        if (!fonteRef.current) return
        analisador.getByteTimeDomainData(amostras)
        let soma = 0
        for (const amostra of amostras) {
          const desvio = (amostra - 128) / 128
          soma += desvio * desvio
        }
        const rms = Math.sqrt(soma / amostras.length)
        picoRef.current = Math.max(picoRef.current, rms)
        setNivel(Math.min(1, rms * 4))
        requestAnimationFrame(medir)
      }
      medir()
    } catch {
      // Medicao e um extra: se o navegador nao permitir, a gravacao segue.
    }
  }

  function pararMonitor() {
    // Desliga so a ligacao com este microfone. O AudioContext continua vivo e
    // e reaproveitado na proxima gravacao.
    try {
      fonteRef.current?.disconnect()
    } catch {
      // ja desconectado
    }
    fonteRef.current = null
    setNivel(0)
  }

  function encerrarMicrofone() {
    pararMonitor()
    liberarMicrofone()
    recorderRef.current = null
  }

  /**
   * Solta o microfone depois de um tempo sem uso, em vez de solta-lo a cada
   * gravacao.
   *
   * Motivo: com headset USB, soltar e pedir o dispositivo de novo a cada
   * ditado faz o Chrome devolver um stream mudo a partir da segunda vez. Era
   * por isso que o ditado funcionava logo apos abrir o navegador e parava
   * depois. Mantendo a reserva entre ditados seguidos, o problema nao ocorre.
   *
   * O indicador de gravacao do navegador fica aceso durante esse intervalo.
   */

  async function enviarParaTranscricao(blob: Blob, mime: string) {
    if (blob.size === 0) {
      // O pico de som separa dois problemas diferentes: microfone que nao manda
      // som algum, e navegador que nao consegue gravar o que recebe.
      if (picoRef.current < 0.01) {
        setSpeechError(
          `Nenhum som chegou do "${dispositivoRef.current}". A causa mais comum é outro programa ` +
            `ou outra aba ter pegado o microfone — WhatsApp Web, Zoom, Teams ou Meet reservam o ` +
            `dispositivo mesmo em segundo plano. Feche essas abas e programas e, se não resolver, ` +
            `feche o Chrome por completo e abra de novo: recarregar a página não basta, porque o ` +
            `travamento é do navegador inteiro.`,
        )
      } else {
        setSpeechError(
          `O microfone captou som, mas a gravação voltou vazia ` +
            `(${chunksCountRef.current} pedaços, formato ${mime}). Tente fechar e reabrir o Chrome.`,
        )
      }
      return
    }

    setTranscrevendo(true)
    try {
      const arquivo = new File([blob], `audio.${extensaoDoFormato(mime)}`, { type: mime })
      const corpo = new FormData()
      corpo.append('audio', arquivo)

      const payload = await invokeWithFormData<{ texto?: string }>('transcrever-audio', corpo)
      const texto = (payload?.texto || '').trim()
      if (!texto) {
        setSpeechError('Nenhuma fala foi reconhecida no áudio.')
        return
      }

      const atual = sanitizeRichText(editorRef.current?.innerHTML || '')
      // Campo "vazio" no contenteditable costuma conter <br> ou <div><br></div>.
      // Sem esta checagem o texto ditado entrava depois desses restos e nascia
      // com linhas em branco na frente.
      const proximo = temTexto(atual) ? `${atual}<br>${textToEditorHtml(texto)}` : textToEditorHtml(texto)
      if (editorRef.current) editorRef.current.innerHTML = proximo
      onChange(sanitizeRichText(proximo))
    } catch (causa) {
      setSpeechError(causa instanceof Error ? causa.message : 'Não foi possível transcrever o áudio.')
    } finally {
      setTranscrevendo(false)
    }
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
          {/* So aparece onde ha campo declarado: um botao de modelos num campo
              que nao guarda modelo seria botao que nao faz nada. */}
          {campo && onSalvarModelo && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setPainelModelos((aberto) => !aberto)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-extrabold transition ${
                painelModelos
                  ? 'bg-[#081b2c] text-white'
                  : 'bg-[#eef3f2] text-[#557f75] hover:bg-[#e2ece9]'
              }`}
              title="Textos prontos para reusar neste campo"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Modelos{doCampo.length ? ` (${doCampo.length})` : ''}
            </button>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void toggleDictation()}
            disabled={transcrevendo}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-extrabold transition disabled:cursor-wait ${
              listening
                ? 'bg-red-50 text-red-600'
                : transcrevendo
                  ? 'bg-[#fdf3ec] text-[#8a4b1d]'
                  : 'bg-[#eef3f2] text-[#557f75] hover:bg-[#e2ece9]'
            }`}
            aria-label={listening ? 'Parar gravação' : 'Gravar e transcrever'}
            title={
              listening
                ? 'Clique para parar e transcrever'
                : transcrevendo
                  ? 'Transcrevendo o áudio...'
                  : 'Gravar e transcrever'
            }
          >
            {transcrevendo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : listening ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {transcrevendo ? 'Transcrevendo...' : listening ? 'Gravando' : 'Ditar'}
          </button>
          {listening && (
            <span
              className="flex items-center gap-0.5"
              title="Nível do som captado. Se as barras não se mexem quando você fala, o microfone não está captando."
            >
              {[0.15, 0.35, 0.55, 0.75, 0.95].map((limite) => (
                <span
                  key={limite}
                  className={`h-3 w-1 rounded-full transition-colors ${
                    nivel >= limite ? 'bg-red-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </span>
          )}
        </div>
        {painelModelos && campo && (
          <div className="border-b border-[#081b2c]/[0.07] bg-[#fbfaf8] px-3 py-2.5">
            {doCampo.length === 0 ? (
              <p className="text-[10px] font-semibold text-slate-400">
                Nenhum modelo salvo para {label.toLowerCase()} ainda. Escreva o texto no campo e
                salve abaixo — ele fica disponível para as próximas consultas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {doCampo.map((modelo) => (
                  <span
                    key={modelo.id}
                    className="inline-flex items-center overflow-hidden rounded-lg border border-[#081b2c]/10 bg-white"
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => inserirModelo(modelo.texto)}
                      className="px-2.5 py-1.5 text-[10px] font-bold text-[#081b2c] transition hover:bg-[#eef3f2]"
                      title="Inserir no fim do texto"
                    >
                      {modelo.titulo}
                    </button>
                    {onApagarModelo && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void onApagarModelo(modelo.id)}
                        className="border-l border-[#081b2c]/10 px-1.5 py-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        aria-label={`Aposentar o modelo ${modelo.titulo}`}
                        title="Aposentar este modelo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {/* Criar o modelo a partir do que ja esta escrito, e nao numa tela
                separada de configuracao: o texto bom aparece durante a consulta,
                e e ali que ele precisa poder ser guardado. */}
            <div className="mt-2 flex items-center gap-1.5 border-t border-[#081b2c]/[0.07] pt-2">
              <input
                value={novoModelo}
                onChange={(event) => setNovoModelo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void salvarComoModelo()
                  }
                }}
                maxLength={80}
                placeholder="Salvar o texto atual como modelo. Dê um nome..."
                className="min-w-0 flex-1 rounded-lg border border-[#081b2c]/10 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#081b2c] outline-none placeholder:text-slate-300 focus:border-[#dc8e5f]"
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void salvarComoModelo()}
                disabled={!novoModelo.trim() || salvandoModelo}
                className="shrink-0 rounded-lg bg-[#081b2c] px-3 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-[#102d47] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {salvandoModelo ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
        <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholder} onInput={syncEditor} onPaste={pasteAsText} className="min-h-[92px] px-3.5 py-2.5 text-[14px] font-medium leading-[1.6] text-[#081b2c] outline-none empty:before:pointer-events-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)] [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5" />
      </div>
      {speechError && (
        <div className="mt-1.5">
          <p className="text-[9px] font-semibold leading-relaxed text-red-500">{speechError}</p>
          <button
            type="button"
            onClick={() => void testarMicrofone()}
            className="mt-1 rounded-lg bg-[#eef3f2] px-2 py-1 text-[9px] font-extrabold text-[#557f75] transition hover:bg-[#e2ece9]"
          >
            Testar microfone
          </button>
        </div>
      )}
      {diagnostico && (
        <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-[#fafaf8] p-2 text-[9px] leading-relaxed text-[#081b2c]">
          {diagnostico}
        </pre>
      )}
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

function Detail({ label, value, alerta = false }: { label: string; value: string; alerta?: boolean }) {
  // value.trim() nao bastava: o editor salva "<div><br></div>" quando o campo
  // fica vazio, e o rotulo aparecia sozinho (era o caso de "Observacoes").
  if (!temTexto(value)) return null
  return (
    <div>
      {/* "Documento sereno": rotulo pequeno e apagado, texto clinico em serifa
          grande. Nada de caixas ou fundos — a leitura corrida e o que importa.
          Cor so aparece no campo de alergias, o unico que precisa saltar. */}
      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">{label}</p>
      <div
        className={`mt-1 whitespace-pre-wrap font-serif text-[16.5px] leading-[1.72] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 ${
          alerta ? 'font-semibold text-[#b42318]' : 'text-[#2b4257]'
        }`}
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
  anterior,
  onEdit,
}: {
  consultation: Consultation
  /** Consulta imediatamente anterior, para mostrar o que mudou. */
  anterior?: Consultation
  onEdit: (consultation: Consultation) => void
}) {
  // Os campos guardam HTML (negrito, cor). Para a linha de resumo so interessa
  // o texto: sem esta limpeza o cartao exibia a marcacao crua, tipo
  // <span style="color:...">, no lugar da frase.
  const summary = textoSimples(
    consultation.avaliacao || consultation.queixa || consultation.historiaEvolucao || consultation.conduta,
  )

  const imc = calcularIMC(consultation.peso, consultation.altura)
  const imcAnterior = anterior ? calcularIMC(anterior.peso, anterior.altura) : null
  const variacaoPeso = anterior ? formatarVariacao(numeroBR(consultation.peso), numeroBR(anterior.peso)) : null
  const variacaoImc = formatarVariacao(imc, imcAnterior)

  // Campos em que a mudanca importa clinicamente. Antecedentes e alergias
  // mudam pouco e poluiriam o aviso.
  const mudancas = anterior
    ? (
        [
          ['Avaliação', consultation.avaliacao, anterior.avaliacao],
          ['Conduta', consultation.conduta, anterior.conduta],
          ['Prescrição', consultation.prescricao, anterior.prescricao],
          ['Medicamentos', consultation.medicamentos, anterior.medicamentos],
        ] as const
      )
        .filter(([, atual, antigo]) => textoSimples(atual) !== textoSimples(antigo))
        .map(([rotulo]) => rotulo)
    : []

  return (
    <AccordionItem
      value={consultation.id}
      className="overflow-hidden rounded-[18px] border border-[#081b2c]/[0.09] bg-white shadow-[0_6px_20px_rgba(8,27,44,.04)]"
    >
      <AccordionTrigger className="group gap-3 px-4 py-4 hover:no-underline sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f5e7dd] text-[#c87543]">
            <ConsultationTypeIcon type={consultation.tipo} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-extrabold text-[#081b2c]">
                {consultationLabels[consultation.tipo]}
              </span>
              {consultation.cid && (
                <span className="rounded-full bg-[#eef3f2] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#557f75]">
                  CID {consultation.cid.toUpperCase()}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] font-bold text-slate-500">
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
                  {variacaoPeso && variacaoPeso !== 'sem mudança' && (
                    <span className="text-slate-400">({variacaoPeso} kg)</span>
                  )}
                </span>
              )}
              {consultation.altura && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="h-3 w-3" /> {consultation.altura} cm
                </span>
              )}
              {imc !== null && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[#eef3f2] px-2 py-0.5 text-[#41695f]"
                  title="Índice de massa corporal, calculado a partir do peso e da altura desta consulta"
                >
                  IMC {imc.toFixed(1).replace('.', ',')}
                  {variacaoImc && variacaoImc !== 'sem mudança' && (
                    <span className="font-medium">({variacaoImc})</span>
                  )}
                </span>
              )}
            </div>
            {/* Some quando o cartao abre: la embaixo o mesmo texto ja aparece
                inteiro em "Avaliacao", e repetido virava ruido. */}
            {summary && (
              <p className="mt-2 line-clamp-1 text-[12px] font-medium text-slate-500 group-data-[state=open]:hidden">
                {summary}
              </p>
            )}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-6 sm:px-7 sm:pb-7">
        {/* Regua escura separando cabecalho e documento, como no modelo. A
            alergia sobe para ca como etiqueta: e a informacao que nao pode
            passar batida, e no meio da lista de campos ela se perdia. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#081b2c] pt-3">
          {temTexto(consultation.alergias) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fceceb] px-3 py-1 text-[12px] font-extrabold text-[#b42318]">
              <AlertTriangle className="h-3.5 w-3.5" /> {textoSimples(consultation.alergias)}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onEdit(consultation)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#c87543]/20 bg-[#fdf4ef] px-3 py-2 text-[10px] font-extrabold text-[#b96535] transition hover:bg-[#f8e6dc]"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar consulta
          </button>
        </div>
        {mudancas.length > 0 && (
          <div className="mt-3 rounded-[14px] border border-[#dc8e5f]/30 bg-[#fdf5ef] px-4 py-3">
            <p className="text-[11px] font-extrabold text-[#8a4b1d]">
              Mudou desde a consulta de {fmtBR(anterior!.data)}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[#8a4b1d]/80">{mudancas.join(' · ')}</p>
          </div>
        )}
        {/* Uma coluna so, com largura de leitura limitada (~66 caracteres). Em
            tres colunas o texto quebrava em pedacos curtos e desalinhados; em
            coluna unica cada campo respira e a ordem de leitura fica obvia. */}
        <div className="mt-3 max-w-[78ch] space-y-5 border-t border-[#081b2c]/[0.06] pt-5">
          <Detail label="Queixa principal" value={consultation.queixa} />
          <Detail label="História e evolução" value={consultation.historiaEvolucao} />
          <Detail label="Antecedentes pessoais" value={consultation.antecedentesPessoais} />
          <Detail label="Antecedentes familiares" value={consultation.antecedentesFamiliares} />
          <Detail label="Medicamentos em uso" value={consultation.medicamentos} />
          <Detail label="Exame físico" value={consultation.exameFisico} />
          <Detail label="Avaliação e hipótese diagnóstica" value={consultation.avaliacao} />
          <Detail label="Conduta" value={consultation.conduta} />
          <Detail label="Prescrição" value={consultation.prescricao} />
          <Detail label="Retorno" value={consultation.retorno} />
          <Detail label="Observações clínicas" value={consultation.observacoes} />
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
  // Os modelos sao da clinica, entao sao carregados uma vez por abertura do
  // prontuario e compartilhados por todos os campos - e nao um pedido por campo.
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [modelos, setModelos] = useState<NoteTemplate[]>([])
  const [buscaConsulta, setBuscaConsulta] = useState('')

  useEffect(() => {
    if (!open) return
    let vivo = true
    void (async () => {
      try {
        const membership = await getCurrentMembership()
        if (!membership || !vivo) return
        setClinicId(membership.clinicId)
        const lista = await listNoteTemplates(membership.clinicId)
        if (vivo) setModelos(lista)
      } catch {
        // Modelo e conveniencia: se a lista falhar, o prontuario continua
        // inteiro e o medico escreve como sempre escreveu.
      }
    })()
    return () => {
      vivo = false
    }
  }, [open])

  async function salvarModelo(campo: string, titulo: string, texto: string) {
    if (!clinicId) return
    const criado = await createNoteTemplate(clinicId, campo, titulo, texto)
    setModelos((atuais) => [...atuais, criado].sort((a, b) => a.titulo.localeCompare(b.titulo)))
  }

  async function apagarModelo(id: string) {
    await archiveNoteTemplate(id)
    setModelos((atuais) => atuais.filter((m) => m.id !== id))
  }

  // Busca em todos os campos de texto da consulta, sem acento e sem marcacao,
  // para "sinusite" achar tanto "Sinusite" quanto "<b>sinusite</b>".
  const consultasFiltradas = (() => {
    const termo = buscaConsulta
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (!termo) return consultations
    return consultations.filter((consulta) =>
      [
        consulta.queixa,
        consulta.historiaEvolucao,
        consulta.antecedentesPessoais,
        consulta.antecedentesFamiliares,
        consulta.alergias,
        consulta.medicamentos,
        consulta.exameFisico,
        consulta.avaliacao,
        consulta.conduta,
        consulta.prescricao,
        consulta.retorno,
        consulta.observacoes,
        consulta.cid,
        consulta.unidade,
      ]
        .map(textoSimples)
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(termo),
    )
  })()
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
      {/* Metade da tela como piso: em monitores largos o prontuario vai ate o
          meio do monitor, e nunca fica menor do que os 900px de antes. */}
      <SheetContent
        side="left"
        className="w-full gap-0 border-r border-[#081b2c]/10 bg-[#fbfaf8] p-0 sm:max-w-[760px] lg:max-w-[max(900px,50vw)]"
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
                <div
                  className={`mt-2 flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400 ${
                    mode === 'history' ? 'hidden' : 'flex'
                  }`}
                >
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
              {/* No historico esses dados vivem no painel da esquerda; repetir
                  aqui so ocupava espaco util da tela. */}
              {patient && mode !== 'history' && (
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
              <div className="flex items-center gap-2">
                {consultations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => imprimirProntuario(patient, consultasFiltradas)}
                    className="flex items-center justify-center gap-2 rounded-[14px] border border-[#081b2c]/10 bg-white px-3.5 py-2.5 text-[11px] font-extrabold text-slate-600 transition hover:border-[#081b2c]/25 hover:text-[#081b2c]"
                    title="Abre a versão para impressão ou para salvar em PDF"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </button>
                )}
                <button
                  type="button"
                  onClick={startNewConsultation}
                  className="flex items-center justify-center gap-2 rounded-[14px] bg-[#dc8e5f] px-4 py-2.5 text-[11px] font-extrabold text-white shadow-[0_8px_18px_rgba(220,142,95,.2)] transition hover:-translate-y-0.5 hover:bg-[#cf7f50]"
                >
                  <Plus className="h-3.5 w-3.5" /> Nova consulta
                </button>
              </div>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {/* Duas colunas: o cadastro do paciente fica sempre visivel a
                  esquerda enquanto o medico percorre as consultas a direita.
                  Antes era preciso rolar ate o topo para conferir convenio,
                  idade ou responsavel no meio de uma leitura. */}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:items-start">
                <aside className="surface-card rounded-[20px] p-4 lg:sticky lg:top-0">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#c87543]">
                    Dados do paciente
                  </p>
                  <p className="mt-2 text-sm font-extrabold leading-tight text-[#081b2c]">{patient.nome}</p>

                  <dl className="mt-3 space-y-2">
                    {[
                      { rotulo: 'Idade', valor: patient.nascimento ? idade(patient.nascimento) : '' },
                      { rotulo: 'Nascimento', valor: patient.nascimento ? fmtBR(patient.nascimento) : '' },
                      { rotulo: 'Responsável', valor: patient.responsavel },
                      { rotulo: 'WhatsApp', valor: patient.telefone },
                      { rotulo: 'Convênio', valor: patient.convenio },
                      { rotulo: 'Unidade', valor: patient.unidade },
                      {
                        rotulo: 'Cidade',
                        valor: [patient.cidade, patient.bairro].filter(Boolean).join(' · '),
                      },
                      { rotulo: 'CID-10', valor: patient.cid },
                    ]
                      .filter((linha) => linha.valor)
                      .map((linha) => (
                        <div key={linha.rotulo}>
                          <dt className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">
                            {linha.rotulo}
                          </dt>
                          <dd className="text-[11px] font-semibold text-[#081b2c]">{linha.valor}</dd>
                        </div>
                      ))}
                  </dl>

                  <button
                    type="button"
                    onClick={() => onEditRegistration(patient)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#081b2c]/10 bg-[#fbfaf8] px-3 py-2 text-[10px] font-extrabold text-slate-500 transition hover:border-[#c87543]/30 hover:text-[#c87543]"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Editar cadastro
                  </button>
                </aside>

                <div className="min-w-0">
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
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={buscaConsulta}
                      onChange={(evento) => setBuscaConsulta(evento.target.value)}
                      placeholder="Buscar no prontuário: sintoma, medicamento, CID..."
                      className="w-full rounded-2xl border border-[#081b2c]/[0.08] bg-white py-2.5 pl-10 pr-4 text-[13px] font-medium text-[#081b2c] outline-none transition placeholder:text-slate-400 focus:border-[#dc8e5f]/60 focus:ring-4 focus:ring-[#dc8e5f]/10"
                    />
                  </div>

                  {consultasFiltradas.length === 0 ? (
                    <p className="py-10 text-center text-[13px] font-semibold text-slate-400">
                      Nenhuma consulta menciona "{buscaConsulta}".
                    </p>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-3">
                      {consultasFiltradas.map((consultation) => (
                        <ConsultationCard
                          key={consultation.id}
                          consultation={consultation}
                          // A lista vem da mais recente para a mais antiga,
                          // entao a anterior no tempo e a proxima na lista.
                          anterior={
                            consultations[
                              consultations.findIndex((item) => item.id === consultation.id) + 1
                            ]
                          }
                          onEdit={startEditingConsultation}
                        />
                      ))}
                    </Accordion>
                  )}
                </>
              )}
                </div>
              </div>
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
                {/* O recado da recepcao aparece aqui de proposito, e so para
                    ler. Enquanto os dois textos eram a mesma coluna, escrever a
                    observacao clinica apagava este aviso. Mostrar em vez de
                    esconder tambem tira o motivo de alguem usar o campo errado. */}
                {patient.observacoes.trim() && (
                  <div className="sm:col-span-2 rounded-[14px] border border-[#dc8e5f]/25 bg-[#fdf6f1] px-4 py-3">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#c87543]">
                      Recado da recepção
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] font-semibold leading-relaxed text-[#8a4b1d]">
                      {patient.observacoes}
                    </p>
                  </div>
                )}
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
                  campo="queixa"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Motivo principal desta consulta..."
                />
                <RichTextField
                  label="História / evolução"
                  value={form.historiaEvolucao}
                  onChange={(value) => set('historiaEvolucao', value)}
                  campo="historiaEvolucao"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Início, duração, sintomas e evolução..."
                />

                <SectionTitle>Antecedentes</SectionTitle>
                <RichTextField
                  label="Antecedentes pessoais"
                  value={form.antecedentesPessoais}
                  onChange={(value) => set('antecedentesPessoais', value)}
                  campo="antecedentesPessoais"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Condições, cirurgias e internações..."
                />
                <RichTextField
                  label="Antecedentes familiares"
                  value={form.antecedentesFamiliares}
                  onChange={(value) => set('antecedentesFamiliares', value)}
                  campo="antecedentesFamiliares"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Histórico familiar relevante..."
                />
                <RichTextField
                  label="Alergias"
                  value={form.alergias}
                  onChange={(value) => set('alergias', value)}
                  campo="alergias"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Medicamentos, alimentos ou outras alergias..."
                />
                <RichTextField
                  label="Medicamentos em uso"
                  value={form.medicamentos}
                  onChange={(value) => set('medicamentos', value)}
                  campo="medicamentos"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Nome, dose e frequência..."
                />

                <SectionTitle>Exame e avaliação</SectionTitle>
                <RichTextField
                  label="Exame físico"
                  value={form.exameFisico}
                  onChange={(value) => set('exameFisico', value)}
                  campo="exameFisico"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Achados do exame físico..."
                />
                <RichTextField
                  label="Avaliação / hipótese diagnóstica"
                  value={form.avaliacao}
                  onChange={(value) => set('avaliacao', value)}
                  campo="avaliacao"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
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
                  campo="conduta"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Orientações, exames e encaminhamentos..."
                />
                <RichTextField
                  label="Prescrição"
                  value={form.prescricao}
                  onChange={(value) => set('prescricao', value)}
                  campo="prescricao"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Medicamento, dose, via e duração..."
                />
                <RichTextField
                  label="Retorno"
                  value={form.retorno}
                  onChange={(value) => set('retorno', value)}
                  campo="retorno"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Prazo e condições para retorno..."
                />
                <RichTextField
                  label="Observações clínicas"
                  value={form.observacoes}
                  onChange={(value) => set('observacoes', value)}
                  campo="observacoes"
                  modelos={modelos}
                  onSalvarModelo={salvarModelo}
                  onApagarModelo={apagarModelo}
                  placeholder="Informações complementares deste atendimento..."
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

