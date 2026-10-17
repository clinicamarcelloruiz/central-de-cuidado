import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, Check, MessageCircle, Send } from 'lucide-react'
import { useDialogos } from '@/components/dialogos-contexto'
import {
  buscarComentariosInstagram,
  comentarioEmPublico,
  comentarioNoDirect,
  listarComentariosInstagram,
  listarConversasInstagram,
  listarMensagensInstagram,
  marcarComentarioVisto,
  marcarConversaInstagram,
  responderInstagram,
  type ComentarioInstagram,
  type ConversaInstagram,
  type MensagemInstagram,
} from '@/lib/instagram'

/**
 * Direct e comentarios do Instagram na tela de Respostas (16/10/2026).
 *
 * Mais simples que a tela do WhatsApp de proposito: aqui nao ha agenda nem
 * cadastro (isso e no WhatsApp). A equipe ve o que o robo respondeu, responde
 * quem precisa e fecha a conversa. Atualiza a cada 15 s.
 */
const MOTIVO: Record<string, string> = {
  urgencia: '🚨 Urgência',
  medico: 'Pergunta médica',
  atendente: 'Quer falar com a equipe',
  falha: 'Resposta do robô não saiu',
}

const DIA = 86400000

function quando(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function janelaAberta(c: ConversaInstagram) {
  return Boolean(c.ultimaDaPessoaEm && Date.now() - Date.parse(c.ultimaDaPessoaEm) < DIA)
}

export default function InstagramInbox({ clinicId }: { clinicId: string }) {
  const { avisar } = useDialogos()
  const [aba, setAba] = useState<'direct' | 'comentarios'>('direct')
  const [conversas, setConversas] = useState<ConversaInstagram[]>([])
  const [comentarios, setComentarios] = useState<ComentarioInstagram[]>([])
  const [aberta, setAberta] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<MensagemInstagram[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respostaPublica, setRespostaPublica] = useState<Record<string, string>>({})
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [cs, cms] = await Promise.all([listarConversasInstagram(clinicId), listarComentariosInstagram(clinicId)])
      setConversas(cs)
      setComentarios(cms)
      setErroDeLeitura(null)
    } catch (causa) {
      setErroDeLeitura(causa instanceof Error ? causa.message : 'Não consegui ler o Instagram.')
    }
  }, [clinicId])

  const carregarMensagens = useCallback(async (id: string) => {
    try {
      setMensagens(await listarMensagensInstagram(id))
    } catch (causa) {
      setErroDeLeitura(causa instanceof Error ? causa.message : 'Não consegui ler a conversa.')
    }
  }, [])

  useEffect(() => {
    void carregar()
    const relogio = setInterval(() => {
      void carregar()
      if (aberta) void carregarMensagens(aberta)
    }, 15000)
    return () => clearInterval(relogio)
  }, [carregar, carregarMensagens, aberta])

  async function abrir(c: ConversaInstagram) {
    setAberta(c.id)
    setTexto('')
    await carregarMensagens(c.id)
    if (c.naoLidas > 0) {
      await marcarConversaInstagram(c.id, { lida: true }).catch(() => undefined)
      void carregar()
    }
  }

  const atual = useMemo(() => conversas.find((c) => c.id === aberta) ?? null, [conversas, aberta])
  const pendentesDirect = conversas.filter((c) => c.precisaEquipe && c.status === 'aberta').length
  const pendentesComentarios = comentarios.filter((c) => c.precisaEquipe).length

  async function enviar() {
    if (!atual || !texto.trim()) return
    setEnviando(true)
    try {
      await responderInstagram(atual.id, texto.trim())
      setTexto('')
      await Promise.all([carregarMensagens(atual.id), carregar()])
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível enviar.', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  async function concluir(c: ConversaInstagram) {
    try {
      await marcarConversaInstagram(c.id, { status: 'concluida', precisaEquipe: false, lida: true })
      avisar('Conversa concluída. Se a pessoa escrever de novo, ela volta para a lista.', 'ok')
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível concluir.', 'erro')
    }
  }

  async function buscarComentarios() {
    setBuscando(true)
    try {
      const r = await buscarComentariosInstagram(clinicId)
      const novos = r.novos ?? 0
      avisar(
        novos
          ? `${novos} comentário${novos > 1 ? 's' : ''} novo${novos > 1 ? 's' : ''} dos últimos 7 dias.`
          : `Nenhum comentário novo nos ${r.posts ?? 0} posts mais recentes (últimos 7 dias).`,
        r.falhas ? 'erro' : 'ok',
      )
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível buscar os comentários.', 'erro')
    } finally {
      setBuscando(false)
    }
  }

  async function acaoNoComentario(c: ComentarioInstagram, acao: 'direct' | 'publico' | 'visto') {
    try {
      if (acao === 'direct') await comentarioNoDirect(c.commentId)
      if (acao === 'publico') await comentarioEmPublico(c.commentId, (respostaPublica[c.commentId] ?? '').trim())
      if (acao === 'visto') await marcarComentarioVisto(c.commentId)
      avisar(acao === 'direct' ? 'Mensagem enviada no direct.' : acao === 'publico' ? 'Comentário respondido.' : 'Marcado como visto.', 'ok')
      setRespostaPublica((r) => ({ ...r, [c.commentId]: '' }))
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível concluir.', 'erro')
    }
  }

  return (
    <section className="surface-card overflow-hidden rounded-[26px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#081b2c]/[0.06] p-4">
        {(
          [
            ['direct', 'Direct', pendentesDirect],
            ['comentarios', 'Comentários', pendentesComentarios],
          ] as const
        ).map(([id, rotulo, pendentes]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`rounded-full px-4 py-1.5 text-[11px] font-extrabold transition ${
              aba === id ? 'bg-[#081b2c] text-white' : 'bg-[#f0f4f8] text-[#1f4f78] hover:bg-[#e3ecf5]'
            }`}
          >
            {rotulo}
            {pendentes > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[9px] text-white">{pendentes}</span>}
          </button>
        ))}
      </div>

      {erroDeLeitura && (
        <p className="m-4 flex gap-2 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {erroDeLeitura}
        </p>
      )}

      {aba === 'direct' ? (
        <div className="grid min-h-[420px] md:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="max-h-[70vh] overflow-y-auto border-b border-[#081b2c]/[0.06] md:border-b-0 md:border-r">
            {conversas.length === 0 && (
              <li className="p-5 text-[11px] leading-relaxed text-slate-400">
                Nenhuma conversa ainda. Quando alguém mandar mensagem no direct, ela aparece aqui com a resposta do robô.
              </li>
            )}
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void abrir(c)}
                  className={`w-full border-b border-[#081b2c]/[0.04] px-4 py-3 text-left transition hover:bg-[#f6f9fc] ${aberta === c.id ? 'bg-[#eef4fa]' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-extrabold text-[#081b2c]">{c.username ? `@${c.username}` : 'Contato do Instagram'}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{quando(c.ultimaMensagemEm)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {c.precisaEquipe && c.status === 'aberta' && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold text-red-600">{MOTIVO[c.motivo ?? 'atendente'] ?? 'Para a equipe'}</span>
                    )}
                    {c.naoLidas > 0 && <span className="rounded-full bg-[#2f7fc1] px-2 py-0.5 text-[9px] font-extrabold text-white">{c.naoLidas} nova(s)</span>}
                    {c.status === 'concluida' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">Concluída</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex min-w-0 flex-col">
            {!atual ? (
              <p className="m-auto p-6 text-center text-[11px] text-slate-400">Escolha uma conversa.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#081b2c]/[0.06] px-4 py-3">
                  <span className="text-xs font-extrabold text-[#081b2c]">{atual.username ? `@${atual.username}` : 'Contato do Instagram'}</span>
                  {atual.status === 'aberta' && (
                    <button type="button" onClick={() => void concluir(atual)} className="flex items-center gap-1 rounded-full border border-[#081b2c]/10 px-3 py-1 text-[10px] font-extrabold text-[#081b2c] hover:bg-[#f6f9fc]">
                      <Check className="h-3 w-3" strokeWidth={3} /> Concluir
                    </button>
                  )}
                </div>
                <ol className="max-h-[55vh] flex-1 space-y-2 overflow-y-auto bg-[#f8f7f4] p-4">
                  {mensagens.map((m) => (
                    <li key={m.id} className={`flex ${m.direcao === 'entrada' ? 'justify-start' : m.direcao === 'nota' ? 'justify-center' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] px-3 py-2 text-[12px] leading-relaxed ${
                          m.direcao === 'entrada'
                            ? 'bg-white text-[#081b2c]'
                            : m.direcao === 'nota'
                              ? 'border border-dashed border-amber-300 bg-amber-50 text-[11px] text-amber-800'
                              : 'bg-[#081b2c] text-white'
                        }`}
                      >
                        {m.automatica && m.direcao === 'saida' && (
                          <span className="mb-0.5 flex items-center gap-1 text-[9px] font-extrabold text-white/60">
                            <Bot className="h-3 w-3" /> Robô
                          </span>
                        )}
                        {m.texto}
                        {m.anexoUrl && (
                          <a href={m.anexoUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[10px] font-extrabold underline">
                            Abrir anexo
                          </a>
                        )}
                        <span className={`mt-1 block text-[9px] ${m.direcao === 'saida' ? 'text-white/50' : 'text-slate-400'}`}>
                          {quando(m.createdAt)}
                          {m.status === 'falhou' && <strong className="ml-1 text-red-300">não enviada: {m.erro}</strong>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                {janelaAberta(atual) ? (
                  <div className="flex items-end gap-2 border-t border-[#081b2c]/[0.06] p-3">
                    <textarea
                      id="instagram-resposta"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="Responder no direct…"
                      className="min-w-0 flex-1 resize-none rounded-[14px] border border-[#081b2c]/10 bg-white p-2.5 text-[12px] text-[#081b2c] outline-none focus:border-[#2f7fc1]/50"
                    />
                    <button
                      type="button"
                      disabled={enviando || !texto.trim()}
                      onClick={() => void enviar()}
                      aria-label="Enviar"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#081b2c] text-white disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="border-t border-[#081b2c]/[0.06] p-3 text-[10px] leading-relaxed text-slate-500">
                    Passaram 24 h desde a última mensagem desta pessoa: o Instagram não deixa responder pelo sistema. Responda pelo app do
                    Instagram ou espere ela escrever de novo.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-[#081b2c]/[0.05]">
          <li className="flex flex-wrap items-center justify-between gap-2 bg-[#f8f7f4] px-4 py-3">
            <span className="text-[10px] leading-relaxed text-slate-500">Traz os comentários dos últimos 7 dias nos 10 posts mais recentes.</span>
            <button
              type="button"
              disabled={buscando}
              onClick={() => void buscarComentarios()}
              className="rounded-full bg-[#081b2c] px-3 py-1.5 text-[10px] font-extrabold text-white disabled:opacity-50"
            >
              {buscando ? 'Buscando…' : 'Buscar comentários'}
            </button>
          </li>
          {comentarios.length === 0 && (
            <li className="p-5 text-[11px] leading-relaxed text-slate-400">
              Nenhum comentário ainda. Comentários que pedem contato recebem mensagem no direct sozinhos; perguntas aparecem aqui para a equipe.
              Para ver os comentários recentes agora, toque em Buscar comentários.
            </li>
          )}
          {comentarios.map((c) => {
            const podeDirect = !c.respondidoNoDirectEm && Date.now() - Date.parse(c.createdAt) < 7 * DIA
            return (
              <li key={c.commentId} className={`space-y-2 p-4 ${c.precisaEquipe ? 'bg-red-50/40' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
                    <MessageCircle className="h-3.5 w-3.5 text-[#2f7fc1]" />
                    {c.autorUsername ? `@${c.autorUsername}` : 'Comentário'}
                  </span>
                  <span className="text-[10px] text-slate-400">{quando(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#081b2c]">{c.texto}</p>
                <div className="flex flex-wrap gap-1">
                  {c.respondidoNoDirectEm && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">Mensagem no direct enviada</span>}
                  {c.respostaPublica && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">Respondido: “{c.respostaPublica}”</span>}
                  {c.precisaEquipe && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold text-red-600">Para a equipe</span>}
                  {c.erro && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold text-red-600">Erro: {c.erro}</span>}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  {podeDirect && (
                    <button type="button" onClick={() => void acaoNoComentario(c, 'direct')} className="rounded-full bg-[#081b2c] px-3 py-1.5 text-[10px] font-extrabold text-white">
                      Mandar link no direct
                    </button>
                  )}
                  <input
                    id={`comentario-${c.commentId}`}
                    value={respostaPublica[c.commentId] ?? ''}
                    onChange={(e) => setRespostaPublica((r) => ({ ...r, [c.commentId]: e.target.value }))}
                    placeholder="Responder em público…"
                    className="min-w-[180px] flex-1 rounded-full border border-[#081b2c]/10 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-[#2f7fc1]/50"
                  />
                  <button
                    type="button"
                    disabled={!(respostaPublica[c.commentId] ?? '').trim()}
                    onClick={() => void acaoNoComentario(c, 'publico')}
                    className="rounded-full border border-[#081b2c]/10 px-3 py-1.5 text-[10px] font-extrabold text-[#081b2c] disabled:opacity-40"
                  >
                    Responder
                  </button>
                  {c.precisaEquipe && (
                    <button type="button" onClick={() => void acaoNoComentario(c, 'visto')} className="rounded-full px-3 py-1.5 text-[10px] font-extrabold text-slate-500 hover:bg-[#f6f9fc]">
                      Marcar como visto
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
