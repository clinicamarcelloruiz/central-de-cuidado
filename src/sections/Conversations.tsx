import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CircleSlash,
  MessageSquareText,
  RefreshCw,
  Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  getCurrentMembership,
  listConversationMessages,
  listConversations,
  markConversationSeen,
  resolveConversation,
  type Conversation,
  type ConversationMessage,
} from '@/lib/repository'

const STATUS_LABEL: Record<Conversation['status'], string> = {
  open: 'Em aberto',
  resolved: 'Resolvida',
  opted_out: 'Pediu para não receber',
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

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [aoVivo, setAoVivo] = useState(false)

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
      setConversations(await listConversations(membership.clinicId))
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
        (payload) => {
          const nova = payload.new as { conversation_id?: string } | null
          // Se a conversa afetada esta aberta, recarrega o historico dela.
          if (nova?.conversation_id && nova.conversation_id === selectedIdRef.current) {
            void listConversationMessages(nova.conversation_id).then(setMessages).catch(() => {})
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
    try {
      setMessages(await listConversationMessages(conversation.id))
      if (conversation.unreadCount > 0 || conversation.needsAttention) {
        await markConversationSeen(conversation.id)
        setConversations((current) =>
          current.map((item) =>
            item.id === conversation.id ? { ...item, unreadCount: 0, needsAttention: false } : item,
          ),
        )
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a conversa.')
    } finally {
      setLoadingMessages(false)
    }
  }

  async function resolve(conversationId: string) {
    try {
      await resolveConversation(conversationId)
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? { ...item, status: 'resolved', needsAttention: false, unreadCount: 0 }
            : item,
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a conversa.')
    }
  }

  const attention = conversations.filter((item) => item.needsAttention)
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

      {attention.length > 0 && (
        <div className="flex items-center gap-2 rounded-[16px] border border-[#dc8e5f]/40 bg-[#fdf3ec] p-3 text-[11px] font-bold text-[#8a4b1d]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {attention.length === 1
            ? '1 paciente respondeu e está aguardando retorno da equipe.'
            : `${attention.length} pacientes responderam e estão aguardando retorno da equipe.`}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          {conversations.length === 0
            ? 'Nenhuma conversa ainda'
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
            {conversations.map((conversation) => {
              const active = conversation.id === selectedId
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void openConversation(conversation)}
                  className={`w-full rounded-[18px] border p-3 text-left transition ${
                    active
                      ? 'border-[#dc8e5f] bg-white shadow-[0_10px_28px_rgba(8,27,44,.10)]'
                      : 'border-[#081b2c]/10 bg-white/70 hover:border-[#081b2c]/20 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-xs font-extrabold text-[#081b2c]">
                      {conversation.patientName}
                    </span>
                    <span className="shrink-0 text-[9px] font-bold text-slate-400">
                      {formatWhen(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {conversation.lastMessage || 'Sem mensagens'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {conversation.needsAttention && (
                      <span className="rounded-full bg-[#fdf3ec] px-2 py-0.5 text-[9px] font-extrabold text-[#8a4b1d]">
                        Aguardando retorno
                      </span>
                    )}
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
