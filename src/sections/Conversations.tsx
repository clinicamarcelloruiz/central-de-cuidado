import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CircleSlash,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  getAutoReply,
  getCurrentMembership,
  listConversationMessages,
  listConversations,
  getReplyWindow,
  markConversationSeen,
  resolveConversation,
  saveAutoReply,
  sendConversationReply,
  type AutoReplySettings,
  type Conversation,
  type ConversationMessage,
} from '@/lib/repository'

const STATUS_LABEL: Record<Conversation['status'], string> = {
  open: 'Em aberto',
  resolved: 'Resolvida',
  opted_out: 'Pediu para não receber',
}

/**
 * Nem todo pedido de atencao e igual. Quem escolheu "falar com a equipe" no
 * menu esta esperando uma pessoa agora; uma falha do sistema e assunto nosso,
 * nao do paciente. Cada motivo tem sua cor para a equipe priorizar de longe.
 */
const MOTIVO_ATENCAO: Record<
  NonNullable<Conversation['attentionReason']>,
  { rotulo: string; classe: string; borda: string }
> = {
  atendente: {
    rotulo: 'Quer falar com a equipe',
    classe: 'bg-[#8a4b1d] text-white',
    borda: 'border-[#8a4b1d] ring-1 ring-[#8a4b1d]/30',
  },
  remarcacao: {
    rotulo: 'Pediu para remarcar',
    classe: 'bg-[#fdf3ec] text-[#8a4b1d]',
    borda: 'border-[#dc8e5f]',
  },
  cancelamento: {
    rotulo: 'Cancelou a consulta',
    classe: 'bg-red-50 text-red-700',
    borda: 'border-red-300',
  },
  ajuda: {
    rotulo: 'Pediu ajuda',
    classe: 'bg-[#fdf3ec] text-[#8a4b1d]',
    borda: 'border-[#dc8e5f]',
  },
  falha: {
    rotulo: 'Falha no atendimento automático',
    classe: 'bg-red-600 text-white',
    borda: 'border-red-500 ring-1 ring-red-500/30',
  },
}

function formatWhen(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  const today = new Date()
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  return new Intl.DateTimeFormat('pt-BR',
    sameDay ? { timeStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' },
  ).format(date)
}

export type PreCadastro = { nome: string; telefone: string }

export default function Conversations({
  focoPatientId,
  onCadastrarContato,
}: {
  focoPatientId?: string | null
  /** Abre a tela de pacientes com nome e telefone do contato ja preenchidos. */
  onCadastrarContato?: (dados: PreCadastro) => void
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [aoVivo, setAoVivo] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Instante em que a janela de 24h da Meta fecha para a conversa aberta.
  const [janelaAte, setJanelaAte] = useState<string | null>(null)
  // Recalculado a cada minuto: sem isso a caixa continuaria habilitada depois
  // de a janela vencer com a tela aberta.
  const [agora, setAgora] = useState(() => Date.now())
  const [autoReply, setAutoReply] = useState<AutoReplySettings>({
    enabled: false,
    text: '',
    knownText: '',
    infoText: '',
  })
  const [autoReplyAberto, setAutoReplyAberto] = useState(false)
  const [salvandoAuto, setSalvandoAuto] = useState(false)
  const [avisoAuto, setAvisoAuto] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const janelaAberta = janelaAte !== null && new Date(janelaAte).getTime() > agora

  // A assinatura de tempo real e criada uma vez so. Sem estas refs ela ficaria
  // presa ao valor de selectedId do primeiro render e nunca saberia qual
  // conversa esta aberta agora.
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError('')
    try {
      const membership = await getCurrentMembership()
      if (!membership) throw new Error('Não foi possível identificar a clínica do seu usuário.')
      setClinicId(membership.clinicId)
      const [lista, automatica] = await Promise.all([
        listConversations(membership.clinicId),
        getAutoReply(membership.clinicId),
      ])
      setConversations(lista)
      setAutoReply(automatica)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as conversas.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Quando a tela e aberta pelo botao "Conversa" do acompanhamento, ja abre a
   * conversa daquele paciente. Sem isso a equipe cairia na lista e teria de
   * procurar de novo - que e justamente o atalho que queremos evitar.
   */
  useEffect(() => {
    if (!focoPatientId || conversations.length === 0) return
    const alvo = conversations.find((item) => item.patientId === focoPatientId)
    if (alvo && alvo.id !== selectedId) void openConversation(alvo)
    // openConversation e estavel o bastante para este uso pontual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoPatientId, conversations])

  /**
   * Tempo real: a tela se atualiza sozinha quando um paciente responde, sem
   * ninguem precisar clicar em Atualizar. Numa clinica, depender de alguem
   * lembrar de atualizar a pagina significa resposta de paciente parada na tela.
   */
  useEffect(() => {
    if (!clinicId) return

    const canal = supabase
      .channel(`conversas-${clinicId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `clinic_id=eq.${clinicId}` },
        () => {
          // Recarrega o historico da conversa aberta em qualquer evento. Nao da
          // para olhar so o registro novo: em exclusao o Supabase manda apenas o
          // registro antigo, e a tela ficaria mostrando algo que ja nao existe.
          const aberta = selectedIdRef.current
          if (aberta) {
            void listConversationMessages(aberta).then(setMessages).catch(() => {})
            // Se quem escreveu foi o paciente, a janela de 24h reabriu: sem
            // isto a caixa continuaria bloqueada ate alguem trocar de conversa.
            void getReplyWindow(aberta).then(setJanelaAte).catch(() => {})
          }
          // A lista lateral sempre reflete a ultima mensagem e o contador.
          void load(true)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `clinic_id=eq.${clinicId}` },
        () => void load(true),
      )
      .subscribe((status) => setAoVivo(status === 'SUBSCRIBED'))

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [clinicId, load])

  async function openConversation(conversation: Conversation) {
    setSelectedId(conversation.id)
    setLoadingMessages(true)
    setResposta('')
    setJanelaAte(null)
    try {
      const [historico, janela] = await Promise.all([
        listConversationMessages(conversation.id),
        getReplyWindow(conversation.id),
      ])
      setMessages(historico)
      setJanelaAte(janela)
      if (conversation.unreadCount > 0 || conversation.needsAttention) {
        await markConversationSeen(conversation.id)
        setConversations((current) =>
          current.map((item) =>
            item.id === conversation.id
              ? { ...item, unreadCount: 0, needsAttention: false, attentionReason: null }
              : item,
          ),
        )
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a conversa.')
    } finally {
      setLoadingMessages(false)
    }
  }

  async function enviarResposta() {
    const texto = resposta.trim()
    if (!selectedId || !texto || enviando) return
    setEnviando(true)
    setError('')
    try {
      await sendConversationReply(selectedId, texto)
      setResposta('')
      // O tempo real ja traz a mensagem nova, mas recarregar aqui evita a
      // sensacao de "sumiu" caso a assinatura esteja fora do ar.
      setMessages(await listConversationMessages(selectedId))
      void load(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a mensagem.')
      // Se a recusa foi por janela fechada, a tela precisa refletir isso.
      setJanelaAte(await getReplyWindow(selectedId).catch(() => null))
    } finally {
      setEnviando(false)
    }
  }

  async function salvarAutoReply() {
    if (!clinicId || salvandoAuto) return
    setSalvandoAuto(true)
    setAvisoAuto('')
    try {
      await saveAutoReply(clinicId, autoReply)
      setAvisoAuto('Resposta automática salva.')
    } catch (cause) {
      setAvisoAuto(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      setSalvandoAuto(false)
    }
  }

  async function resolve(conversationId: string) {
    try {
      await resolveConversation(conversationId)
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? { ...item, status: 'resolved', needsAttention: false, attentionReason: null, unreadCount: 0 }
            : item,
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a conversa.')
    }
  }

  // Busca e filtro rodam sobre o que ja esta na tela: a listagem carrega as
  // mensagens da clinica para descobrir a ultima de cada conversa, entao
  // procurar dentro do texto nao custa consulta nova.
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitosBusca = termo.replace(/\D/g, '')
    const inicio = de ? new Date(`${de}T00:00:00`).getTime() : null
    // Ate o fim do dia escolhido, e nao a meia-noite: quem digita 15/08 quer o
    // dia 15 inteiro.
    const fim = ate ? new Date(`${ate}T23:59:59.999`).getTime() : null

    return conversations.filter((item) => {
      if (inicio !== null || fim !== null) {
        const quando = item.lastMessageAt ? new Date(item.lastMessageAt).getTime() : null
        if (quando === null) return false
        if (inicio !== null && quando < inicio) return false
        if (fim !== null && quando > fim) return false
      }
      if (!termo) return true
      if (item.patientName.toLowerCase().includes(termo)) return true
      if (item.profileName.toLowerCase().includes(termo)) return true
      if (digitosBusca && item.phoneDigits.includes(digitosBusca)) return true
      return item.textoBusca.includes(termo)
    })
  }, [conversations, busca, de, ate])

  const filtrando = Boolean(busca.trim() || de || ate)
  const attention = conversations.filter((item) => item.needsAttention)
  const querAtendente = attention.filter(
    (item) => item.attentionReason === 'atendente' || item.attentionReason === 'falha',
  )
  const outrasAtencoes = attention.filter(
    (item) => item.attentionReason !== 'atendente' && item.attentionReason !== 'falha',
  )
  const selected = conversations.find((item) => item.id === selectedId) ?? null

  if (loading) {
    return (
      <div className="surface-card rounded-[22px] p-8 text-center text-xs font-semibold text-slate-500">
        Carregando conversas...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-[16px] border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quem escolheu "falar com a equipe" ganha um aviso proprio e mais forte:
          o robo parou de responder essa pessoa, entao ela so sai do lugar se
          alguem daqui abrir a conversa. */}
      {querAtendente.length > 0 && (
        <button
          type="button"
          onClick={() => void openConversation(querAtendente[0])}
          className="flex w-full items-center gap-2 rounded-[16px] border-2 border-[#8a4b1d] bg-[#8a4b1d] p-3 text-left text-[11px] font-bold text-white transition hover:bg-[#763f18]"
        >
          <MessageSquareText className="h-4 w-4 shrink-0" />
          {querAtendente.length === 1
            ? '1 pessoa pediu para falar com a equipe e está esperando resposta.'
            : `${querAtendente.length} pessoas pediram para falar com a equipe e estão esperando resposta.`}
        </button>
      )}

      {outrasAtencoes.length > 0 && (
        <div className="flex items-center gap-2 rounded-[16px] border border-[#dc8e5f]/40 bg-[#fdf3ec] p-3 text-[11px] font-bold text-[#8a4b1d]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {outrasAtencoes.length === 1
            ? '1 paciente respondeu e está aguardando retorno da equipe.'
            : `${outrasAtencoes.length} pacientes responderam e estão aguardando retorno da equipe.`}
        </div>
      )}

      {/* Resposta automatica de primeiro contato. Fica aqui, e nao numa tela de
          configuracao escondida, porque quem cuida das conversas e quem sabe se
          o texto esta certo. */}
      <div className="surface-card rounded-[18px] p-3">
        <button
          type="button"
          onClick={() => setAutoReplyAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-[11px] font-extrabold text-[#081b2c]">
            <Sparkles className="h-3.5 w-3.5 text-[#dc8e5f]" />
            Menu automático do WhatsApp
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
              autoReply.enabled
                ? 'bg-[#eef3f2] text-[#557f75]'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {autoReply.enabled ? 'Ligada' : 'Desligada'}
          </span>
        </button>

        {autoReplyAberto && (
          <div className="mt-3 border-t border-[#081b2c]/[0.07] pt-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoReply.enabled}
                onChange={(e) => setAutoReply({ ...autoReply, enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#dc8e5f]"
              />
              <span className="text-[11px] font-bold text-[#081b2c]">
                Responder automaticamente quem escreve para a clínica
              </span>
            </label>

            {/* As opcoes 1, 2 e 3 nao sao editaveis: elas correspondem ao que o
                sistema sabe fazer. Mostrar o menu montado evita a duvida de
                "onde eu escrevo as opcoes?". */}
            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Como a mensagem chega
            </p>
            <div className="mt-1 rounded-[14px] border border-[#081b2c]/10 bg-[#fbfaf8] p-3 text-[11px] leading-relaxed text-[#081b2c]">
              <span className="text-slate-500">{autoReply.text || 'Saudação'}</span>
              <br />
              <br />
              Como podemos ajudar? Responda com o número:
              <br />
              <br />
              1 - Informações sobre a consulta
              <br />
              2 - Agendar consulta
              <br />
              3 - Falar com a nossa equipe
            </div>

            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Saudação para quem não é paciente cadastrado
            </p>
            <textarea
              value={autoReply.text}
              onChange={(e) => setAutoReply({ ...autoReply, text: e.target.value })}
              rows={2}
              className="mt-1 w-full resize-y rounded-[14px] border border-[#081b2c]/10 bg-white p-3 text-[11px] leading-relaxed outline-none focus:border-[#dc8e5f]"
            />

            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Saudação para quem já é paciente
            </p>
            <textarea
              value={autoReply.knownText}
              onChange={(e) => setAutoReply({ ...autoReply, knownText: e.target.value })}
              rows={2}
              className="mt-1 w-full resize-y rounded-[14px] border border-[#081b2c]/10 bg-white p-3 text-[11px] leading-relaxed outline-none focus:border-[#dc8e5f]"
            />
            <p className="mt-2 text-[10px] text-slate-500">
              O sistema identifica o paciente pelo telefone. Escreva <strong>{'{nome}'}</strong> onde
              quiser o primeiro nome dele.
            </p>

            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Opção 1 - Informações sobre a consulta
            </p>
            <textarea
              value={autoReply.infoText}
              onChange={(e) => setAutoReply({ ...autoReply, infoText: e.target.value })}
              rows={12}
              className="mt-1 w-full resize-y rounded-[14px] border border-[#081b2c]/10 bg-white p-3 text-[11px] leading-relaxed outline-none focus:border-[#dc8e5f]"
            />
            <p className="mt-2 text-[10px] text-slate-500">
              Valores, formas de contato e orientações. É o que o paciente recebe ao responder 1.
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              A opção 2 usa a agenda das unidades. A opção 3 marca a conversa aqui em
              destaque e o robô para de responder, para não falar por cima da equipe.
              Quem está respondendo acompanhamento ou lembrete de consulta não recebe o menu.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void salvarAutoReply()}
                disabled={salvandoAuto}
                className="rounded-xl bg-[#081b2c] px-4 py-2 text-[10px] font-extrabold text-white transition hover:bg-[#102d47] disabled:opacity-40"
              >
                {salvandoAuto ? 'Salvando...' : 'Salvar menu automático'}
              </button>
              {avisoAuto && (
                <span className="text-[10px] font-bold text-[#557f75]">{avisoAuto}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {conversations.length > 0 && (
        <div className="surface-card flex flex-wrap items-center gap-2 rounded-[18px] p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone ou algo que foi dito"
              className="w-full rounded-[12px] border border-[#081b2c]/10 bg-white py-2 pl-9 pr-3 text-[11px] outline-none focus:border-[#dc8e5f]"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
            De
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-[12px] border border-[#081b2c]/10 bg-white px-2 py-2 text-[11px] outline-none focus:border-[#dc8e5f]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
            até
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-[12px] border border-[#081b2c]/10 bg-white px-2 py-2 text-[11px] outline-none focus:border-[#dc8e5f]"
            />
          </label>
          {filtrando && (
            <button
              type="button"
              onClick={() => {
                setBusca('')
                setDe('')
                setAte('')
              }}
              className="inline-flex items-center gap-1 rounded-[12px] bg-slate-100 px-3 py-2 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-200"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          {conversations.length === 0
            ? 'Nenhuma conversa ainda'
            : filtrando
              ? `${visiveis.length} de ${conversations.length} ${conversations.length === 1 ? 'conversa' : 'conversas'}`
              : `${conversations.length} ${conversations.length === 1 ? 'conversa' : 'conversas'}`}
          {aoVivo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef3f2] px-2 py-0.5 text-[9px] font-extrabold text-[#557f75]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3fa88a]" />
              Ao vivo
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#eef3f2] px-3 py-1.5 text-[10px] font-extrabold text-[#557f75] transition hover:bg-[#e2ece9]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="surface-card rounded-[22px] p-10 text-center">
          <MessageSquareText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-[#081b2c]">Nenhuma resposta recebida ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
            Quando um paciente responder a mensagem de acompanhamento, a conversa aparece aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-2">
            {visiveis.length === 0 && (
              <div className="surface-card rounded-[18px] p-6 text-center text-[11px] font-semibold text-slate-500">
                Nenhuma conversa encontrada com esses filtros.
              </div>
            )}
            {visiveis.map((conversation) => {
              const active = conversation.id === selectedId
              const motivo = conversation.needsAttention && conversation.attentionReason
                ? MOTIVO_ATENCAO[conversation.attentionReason]
                : null
              // O contorno do motivo vence o de "selecionada": quem pediu
              // atendente precisa saltar da lista mesmo sem estar aberta.
              const contorno = motivo
                ? `${motivo.borda} bg-white`
                : active
                  ? 'border-[#dc8e5f] bg-white shadow-[0_10px_28px_rgba(8,27,44,.10)]'
                  : 'border-[#081b2c]/10 bg-white/70 hover:border-[#081b2c]/20 hover:bg-white'
              const semCadastro = !conversation.patientId
              // Sem cadastro, o nome do WhatsApp e melhor do que "Contato sem
              // cadastro" - mas vem com etiqueta, porque e o apelido que a
              // pessoa escolheu, nao um nome conferido pela clinica.
              const titulo = semCadastro
                ? conversation.profileName || 'Contato sem cadastro'
                : conversation.patientName
              return (
                <div
                  key={conversation.id}
                  className={`w-full rounded-[18px] border p-3 transition ${contorno}`}
                >
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation)}
                    className="w-full text-left"
                  >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-xs font-extrabold text-[#081b2c]">
                      {titulo}
                    </span>
                    <span className="shrink-0 text-[9px] font-bold text-slate-400">
                      {formatWhen(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-bold tracking-wide text-slate-400">
                    {conversation.phone}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {conversation.lastMessage || 'Sem mensagens'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {semCadastro && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-500">
                        {conversation.profileName ? 'Nome do WhatsApp' : 'Sem cadastro'}
                      </span>
                    )}
                    {motivo ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${motivo.classe}`}
                      >
                        {motivo.rotulo}
                      </span>
                    ) : conversation.needsAttention ? (
                      <span className="rounded-full bg-[#fdf3ec] px-2 py-0.5 text-[9px] font-extrabold text-[#8a4b1d]">
                        Aguardando retorno
                      </span>
                    ) : null}
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-[#081b2c] px-2 py-0.5 text-[9px] font-extrabold text-white">
                        {conversation.unreadCount} nova{conversation.unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {conversation.status === 'opted_out' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold text-red-600">
                        <CircleSlash className="h-2.5 w-2.5" />
                        Não quer receber
                      </span>
                    )}
                    {conversation.status === 'resolved' && (
                      <span className="rounded-full bg-[#eef3f2] px-2 py-0.5 text-[9px] font-extrabold text-[#557f75]">
                        Resolvida
                      </span>
                    )}
                  </div>
                  </button>

                  {semCadastro && onCadastrarContato && (
                    <button
                      type="button"
                      onClick={() =>
                        onCadastrarContato({
                          // O apelido do WhatsApp entra so como ponto de
                          // partida: quem cadastra confere e corrige.
                          nome: conversation.profileName,
                          telefone: conversation.phone,
                        })
                      }
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#081b2c]/15 bg-white px-3 py-2 text-[10px] font-extrabold text-[#081b2c] transition hover:border-[#dc8e5f] hover:text-[#8a4b1d]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Cadastrar como paciente
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="surface-card min-h-[320px] rounded-[22px] p-4">
            {!selected ? (
              <p className="pt-16 text-center text-xs font-semibold text-slate-400">
                Escolha uma conversa para ver o histórico.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#081b2c]/[0.07] pb-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#081b2c]">{selected.patientName}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {selected.phone} · {STATUS_LABEL[selected.status]}
                    </p>
                  </div>
                  {selected.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => void resolve(selected.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#eef3f2] px-3 py-1.5 text-[10px] font-extrabold text-[#557f75] transition hover:bg-[#e2ece9]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Marcar como resolvida
                    </button>
                  )}
                </div>

                {loadingMessages ? (
                  <p className="pt-12 text-center text-xs font-semibold text-slate-400">
                    Carregando mensagens...
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {messages.map((message) => {
                      const outbound = message.direction === 'outbound'
                      return (
                        <div
                          key={message.id}
                          className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-[16px] px-3 py-2 ${
                              outbound
                                ? 'bg-[#081b2c] text-white'
                                : 'bg-[#f4f6f5] text-[#081b2c]'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-[11px] leading-relaxed">
                              {message.body ||
                                (message.templateName
                                  ? `[modelo: ${message.templateName}]`
                                  : '[sem conteúdo]')}
                            </p>
                            <p
                              className={`mt-1 flex items-center gap-1 text-[9px] font-bold ${
                                outbound ? 'text-white/60' : 'text-slate-400'
                              }`}
                            >
                              {outbound && <Send className="h-2.5 w-2.5" />}
                              {formatWhen(message.createdAt)}
                              {outbound && ` · ${message.status}`}
                            </p>
                            {message.failureReason && (
                              <p className="mt-1 text-[9px] font-bold text-red-300">
                                {message.failureReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Caixa de resposta. A Meta so aceita texto livre por 24h
                    depois da ultima mensagem do paciente, entao o prazo fica a
                    vista e a caixa se desliga sozinha quando fecha - senao a
                    equipe digita, envia e a mensagem falha sem explicacao. */}
                <div className="mt-4 border-t border-[#081b2c]/[0.07] pt-3">
                  {janelaAberta ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-bold text-[#557f75]">
                          Pode responder livremente até {formatWhen(janelaAte)}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {resposta.length}/4096
                        </p>
                      </div>
                      <textarea
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter envia, Shift+Enter quebra linha.
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void enviarResposta()
                          }
                        }}
                        rows={3}
                        maxLength={4096}
                        placeholder="Escreva sua resposta..."
                        className="mt-2 w-full resize-y rounded-[14px] border border-[#081b2c]/10 bg-white p-3 text-[12px] leading-relaxed outline-none focus:border-[#dc8e5f]"
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[9px] font-semibold text-slate-400">
                          Enter envia · Shift+Enter quebra linha
                        </p>
                        <button
                          type="button"
                          disabled={enviando || !resposta.trim()}
                          onClick={() => void enviarResposta()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#081b2c] px-4 py-2 text-[10px] font-extrabold text-white transition hover:bg-[#102d47] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {enviando ? 'Enviando...' : 'Enviar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[14px] border border-[#dc8e5f]/30 bg-[#fdf5ef] px-4 py-3">
                      <p className="text-[11px] font-extrabold text-[#8a4b1d]">
                        {janelaAte
                          ? `A janela de resposta fechou em ${formatWhen(janelaAte)}`
                          : 'Este contato ainda não escreveu para a clínica'}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-[#8a4b1d]/80">
                        A Meta só permite texto livre nas 24 horas seguintes à mensagem do
                        paciente. Para retomar agora, é preciso enviar um modelo aprovado.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
