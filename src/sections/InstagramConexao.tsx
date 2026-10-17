import { useEffect, useState } from 'react'
import { AlertTriangle, AtSign, Check } from 'lucide-react'
import { useDialogos } from '@/components/dialogos-contexto'
import { parametrosDoEndereco } from '@/lib/endereco'
import {
  concluirLoginDoInstagram,
  conectarInstagram,
  desconectarInstagram,
  entrarComInstagram,
  estadoDoInstagram,
  salvarRoboInstagram,
  ultimaBuscaDeComentarios,
  type ContaInstagram,
} from '@/lib/instagram'

/**
 * Conexao do Instagram da clinica (16/10/2026). O caminho normal e o login
 * oficial ("Entrar com o Instagram"): a pessoa autoriza no proprio Instagram e
 * volta para ca, e a funcao instagram-equipe troca o codigo pelo acesso. Colar
 * o token gerado no painel da Meta ficou como opcao avancada. Nos dois casos a
 * funcao confere com o Instagram, grava e liga os avisos de mensagem e
 * comentario, e o token nunca volta para a tela.
 */
function diasAte(iso: string | null) {
  if (!iso) return null
  return Math.floor((Date.parse(iso) - Date.now()) / 86400000)
}

/**
 * A busca automatica de comentarios roda a cada 10 minutos (agendador do banco).
 * Passou de 30 sem rodar, a linha fica vermelha: agendador parado nao pode ser
 * silencioso (lembrete da vespera, setembro de 2026).
 */
function minutosDesde(iso: string | null) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000))
}

/**
 * Erro da busca de comentarios que a rodada seguinte ja superou (17/10/2026).
 * Uma falha passageira as 08:00 ficou o dia inteiro em vermelho, e o Edu
 * perguntou se era algo. A rodada grava a hora em que COMECA; a que falha grava
 * o erro depois disso. Entao, se a ultima rodada comecou depois do erro, ela
 * terminou sem erro. Outros erros (envio do direct, token) seguem vermelhos.
 */
function erroDaBuscaJaResolvido(erro: string, erroEm: string | null, ultimaBusca: string | null) {
  if (!erro.startsWith('Busca automática de comentários') || !erroEm || !ultimaBusca) return false
  return Date.parse(ultimaBusca) > Date.parse(erroEm)
}

function LinhaDaBusca({ ultima }: { ultima: string | null }) {
  const minutos = minutosDesde(ultima)
  const parou = minutos !== null && minutos > 30
  const quando = minutos === null ? 'ainda não rodou' : minutos < 1 ? 'agora há pouco' : minutos < 120 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`
  const cor = parou
    ? 'border border-red-200 bg-red-50 text-red-700'
    : minutos === null
      ? 'border border-amber-200 bg-amber-50 text-amber-800'
      : 'bg-[#f8f7f4] text-slate-500'
  return (
    <p className={`flex gap-2 rounded-[16px] px-4 py-2.5 text-[11px] leading-relaxed ${cor}`}>
      {(parou || minutos === null) && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>
        Busca automática de comentários (a cada 10 min): última {quando}.{parou ? ' Parou de rodar: avise o suporte.' : ''}
      </span>
    </p>
  )
}

export default function InstagramConexao({ clinicId }: { clinicId: string | null }) {
  const { avisar } = useDialogos()
  const [estado, setEstado] = useState<{ disponivel: boolean; conta: ContaInstagram | null } | null>(null)
  const [token, setToken] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const [ultimaBusca, setUltimaBusca] = useState<string | null | undefined>(undefined)

  async function carregar() {
    if (!clinicId) return
    const e = await estadoDoInstagram(clinicId)
    setEstado(e)
    if (e.conta) setWhatsapp(e.conta.whatsapp)
    if (e.conta) setUltimaBusca(await ultimaBuscaDeComentarios(clinicId))
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  // Volta do login oficial: a Home abre esta aba quando o endereco traz instagram_code.
  useEffect(() => {
    const p = parametrosDoEndereco()
    if (!p.get('instagram_code') && !p.get('instagram_erro')) return
    setOcupado(true)
    // concluirLoginDoInstagram apaga o endereco antes de esperar: a segunda
    // montagem do modo estrito do React ja nao ve o codigo.
    void concluirLoginDoInstagram().then(async (r) => {
      setOcupado(false)
      if (!r) return
      if (!r.ok) avisar(r.erro, 'erro')
      else avisar(r.aviso ?? `Instagram conectado${r.username ? `: @${r.username}` : ''}.`, r.aviso ? 'erro' : 'ok')
      await carregar()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function entrar() {
    if (!clinicId) return
    setOcupado(true)
    entrarComInstagram(clinicId, whatsapp)
  }

  async function conectar() {
    if (!clinicId) return
    setOcupado(true)
    try {
      const r = await conectarInstagram(clinicId, token.trim(), whatsapp)
      setToken('')
      avisar(r.aviso ?? `Instagram conectado${r.username ? `: @${r.username}` : ''}.`, r.aviso ? 'erro' : 'ok')
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível conectar.', 'erro')
    } finally {
      setOcupado(false)
    }
  }

  async function mudar(campos: { roboDirect?: boolean; roboComentarios?: boolean; whatsapp?: string }, aviso: string) {
    if (!clinicId) return
    setOcupado(true)
    try {
      await salvarRoboInstagram(clinicId, campos)
      avisar(aviso, 'ok')
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar.', 'erro')
    } finally {
      setOcupado(false)
    }
  }

  async function desconectar() {
    if (!clinicId) return
    setOcupado(true)
    try {
      await desconectarInstagram(clinicId)
      avisar('Instagram desconectado: o robô parou de responder no direct e nos comentários.', 'ok')
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível desconectar.', 'erro')
    } finally {
      setOcupado(false)
    }
  }

  const conta = estado?.conta ?? null
  const dias = diasAte(conta?.tokenExpiraEm ?? null)

  return (
    <section className="surface-card overflow-hidden rounded-[26px]">
      <div className="border-b border-[#081b2c]/[0.06] bg-gradient-to-r from-white to-[#f0f6fc] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#dceaf7] text-[#1f4f78]">
            <AtSign className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#1f4f78]">Novo</p>
            <h2 className="mt-1 text-base font-extrabold tracking-[-0.03em] text-[#081b2c]">Instagram da clínica</h2>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-slate-400">
              O robô responde no direct (valores, convênio, endereço, telemedicina) e manda o link do WhatsApp para agendar.
              Comentários que pedem contato recebem uma mensagem no direct. As conversas aparecem em Respostas, na aba Instagram.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {estado === null ? (
          <p className="text-[11px] text-slate-400">Carregando…</p>
        ) : !estado.disponivel ? (
          <p className="rounded-[16px] bg-[#f8f7f4] px-4 py-3 text-[11px] text-slate-500">
            Ainda não disponível: a atualização do banco não chegou. Depois do próximo PUBLICAR, recarregue a página.
          </p>
        ) : conta ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-[#081b2c]/10 bg-white p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
                <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                Conectado{conta.username ? ` como @${conta.username}` : ''}
              </span>
              <span className={`text-[10px] ${dias !== null && dias < 10 ? 'font-extrabold text-red-600' : 'text-slate-400'}`}>
                {dias === null ? 'Validade do acesso desconhecida' : dias < 0 ? 'Acesso vencido: gere um token novo' : `Acesso renova sozinho · vence em ${dias} dias`}
              </span>
            </div>
            {conta.ultimoErro &&
              (erroDaBuscaJaResolvido(conta.ultimoErro, conta.ultimoErroEm, ultimaBusca ?? null) ? (
                <p className="flex gap-2 rounded-[16px] bg-[#f8f7f4] px-4 py-3 text-[11px] leading-relaxed text-slate-500">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  <span>
                    <strong>Erro já resolvido</strong>
                    {conta.ultimoErroEm ? ` (${new Date(conta.ultimoErroEm).toLocaleString('pt-BR')})` : ''}: as buscas seguintes
                    funcionaram. {conta.ultimoErro}
                  </span>
                </p>
              ) : (
                <p className="flex gap-2 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[11px] leading-relaxed text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>Último erro do Instagram</strong>
                    {conta.ultimoErroEm ? ` (${new Date(conta.ultimoErroEm).toLocaleString('pt-BR')})` : ''}: {conta.ultimoErro}
                  </span>
                </p>
              ))}
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['roboDirect', 'Robô no direct', 'Responde as mensagens e manda o link de agendamento.'],
                  ['roboComentarios', 'Comentários viram conversa', 'Quem comenta "agendar", "valor"… recebe mensagem no direct.'],
                ] as const
              ).map(([campo, titulo, texto]) => {
                const ligado = conta[campo]
                return (
                  <button
                    key={campo}
                    type="button"
                    disabled={ocupado}
                    onClick={() => void mudar({ [campo]: !ligado }, `${titulo}: ${ligado ? 'desligado' : 'ligado'}.`)}
                    className={`rounded-[18px] border p-3.5 text-left transition disabled:opacity-60 ${
                      ligado ? 'border-[#081b2c] bg-[#081b2c] text-white' : 'border-[#081b2c]/10 bg-white hover:border-[#2f7fc1]/40'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-extrabold">
                      {ligado && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      {titulo}: {ligado ? 'ligado' : 'desligado'}
                    </span>
                    <span className={`mt-1 block text-[10px] leading-relaxed ${ligado ? 'text-white/70' : 'text-slate-500'}`}>{texto}</span>
                  </button>
                )
              })}
            </div>
            {ultimaBusca !== undefined && <LinhaDaBusca ultima={ultimaBusca} />}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 text-[10px] font-extrabold text-[#081b2c]">
                WhatsApp do link de agendamento
                <input
                  id="instagram-whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-[14px] border border-[#081b2c]/10 bg-[#f8f7f4] px-3 py-2 text-[12px] font-normal text-[#081b2c] outline-none focus:border-[#2f7fc1]/50"
                />
              </label>
              <button
                type="button"
                disabled={ocupado || whatsapp.replace(/\D/g, '') === conta.whatsapp}
                onClick={() => void mudar({ whatsapp }, 'Número do link salvo.')}
                className="rounded-full bg-[#081b2c] px-4 py-2 text-[11px] font-extrabold text-white disabled:opacity-40"
              >
                Salvar número
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] leading-relaxed text-slate-400">Para trocar a conta ou renovar o acesso na mão, entre de novo com o Instagram.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={entrar}
                  className="rounded-full border border-[#081b2c]/15 px-4 py-1.5 text-[11px] font-extrabold text-[#081b2c] disabled:opacity-40"
                >
                  Entrar de novo com o Instagram
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void desconectar()}
                  className="rounded-full border border-red-200 px-4 py-1.5 text-[11px] font-extrabold text-red-600 disabled:opacity-40"
                >
                  Desconectar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 rounded-[18px] border border-[#081b2c]/10 bg-white p-3.5">
            <label className="block text-[10px] font-extrabold text-[#081b2c]">
              WhatsApp da clínica (com 55 e DDD), para o link de agendamento
              <input
                id="instagram-whatsapp-novo"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="5513999990000"
                inputMode="numeric"
                className="mt-1 w-full rounded-[14px] border border-[#081b2c]/10 bg-[#f8f7f4] px-3 py-2 text-[12px] font-normal text-[#081b2c] outline-none focus:border-[#2f7fc1]/50"
              />
            </label>
            <button
              type="button"
              disabled={ocupado || whatsapp.replace(/\D/g, '').length < 12}
              onClick={entrar}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#081b2c] px-4 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-40"
            >
              <AtSign className="h-4 w-4" />
              {ocupado ? 'Conectando…' : 'Entrar com o Instagram'}
            </button>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Abre o Instagram para você entrar na conta da clínica e autorizar a Central a responder o direct e os comentários. Depois volta
              sozinho para cá.
            </p>
            <details className="text-[10px] text-slate-500">
              <summary className="cursor-pointer font-extrabold">Avançado: colar um token do painel da Meta</summary>
              <div className="mt-2 space-y-2">
                <input
                  id="instagram-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole aqui o token gerado no painel da Meta"
                  autoComplete="off"
                  className="w-full rounded-[14px] border border-[#081b2c]/10 bg-[#f8f7f4] px-3 py-2 font-mono text-[11px] font-normal text-[#081b2c] outline-none focus:border-[#2f7fc1]/50"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={ocupado || !token.trim() || whatsapp.replace(/\D/g, '').length < 12}
                    onClick={() => void conectar()}
                    className="rounded-full border border-[#081b2c]/15 px-4 py-1.5 text-[11px] font-extrabold text-[#081b2c] disabled:opacity-40"
                  >
                    Conectar com o token
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </section>
  )
}
