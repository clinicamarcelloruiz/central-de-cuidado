import { useEffect, useState } from 'react'
import { Bot, Check, Siren } from 'lucide-react'
import { useDialogos } from '@/components/dialogos-contexto'
import {
  getAlertaUrgencia,
  getAtendenteIA,
  getConhecimentoIA,
  getUltimoAlertaUrgencia,
  numerosParaOAlerta,
  saveAlertaUrgencia,
  saveAtendenteIA,
  saveConhecimentoIA,
  type ModoDoAtendenteIA,
} from '@/lib/repository'
import { testarAlertaUrgencia } from '@/lib/notificacoes'

/**
 * O liga/desliga do atendente com IA (15/10/2026). Ver
 * supabase/functions/_shared/assistente.ts para o que cada modo faz.
 *
 * Desligado e o padrao e a saida de emergencia: um toque e o robo de sempre
 * volta a responder tudo, na mensagem seguinte.
 */
const MODOS: { id: ModoDoAtendenteIA; titulo: string; texto: string }[] = [
  {
    id: 'desligado',
    titulo: 'Desligado',
    texto: 'O robô de sempre responde tudo. Nenhuma mensagem passa pela IA.',
  },
  {
    id: 'sombra',
    titulo: 'Sombra',
    texto:
      'O robô continua respondendo. A IA escreve, como nota interna em cada conversa, o que ela responderia. A família não vê. Bom para comparar.',
  },
  {
    id: 'ligado',
    titulo: 'Ligado',
    texto:
      'A IA conversa com as famílias. Marcar, remarcar, cancelar e 2ª via continuam pelos passos do robô. Urgência e foto ficam com o robô; conduta médica vai para a equipe.',
  },
]

// O prompt inteiro vai a cada mensagem: texto grande custa em toda conversa.
const MAXIMO_DO_CONHECIMENTO = 6000

/** 5513997039614 -> (13) 99703-9614: a equipe confere o numero do jeito que conhece. */
function telefoneLegivel(numero: string): string {
  const local = numero.startsWith('55') && numero.length >= 12 ? numero.slice(2) : numero
  return local.length >= 10 ? `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}` : numero
}

export default function AtendenteComIA({ clinicId }: { clinicId: string | null }) {
  const { avisar } = useDialogos()
  const [modo, setModo] = useState<ModoDoAtendenteIA | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [conhecimento, setConhecimento] = useState<string | null>(null)
  const [salvo, setSalvo] = useState('')
  const [salvandoTexto, setSalvandoTexto] = useState(false)
  // Alerta de urgencia no WhatsApp (17/10/2026): null = banco sem a coluna.
  const [alerta, setAlerta] = useState<string | null>(null)
  const [alertaSalvo, setAlertaSalvo] = useState('')
  const [salvandoAlerta, setSalvandoAlerta] = useState(false)
  const [testandoAlerta, setTestandoAlerta] = useState(false)
  const [ultimoAlerta, setUltimoAlerta] = useState<{ quando: string; detalhe: string } | null>(null)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    void getAtendenteIA(clinicId).then((atual) => {
      if (!vivo) return
      if (atual === null) setIndisponivel(true)
      else setModo(atual)
    })
    void getConhecimentoIA(clinicId).then((texto) => {
      if (!vivo || texto === null) return
      setConhecimento(texto)
      setSalvo(texto)
    })
    void getAlertaUrgencia(clinicId).then((numeros) => {
      if (!vivo || numeros === null) return
      const texto = numeros.map(telefoneLegivel).join('\n')
      setAlerta(texto)
      setAlertaSalvo(texto)
    })
    void getUltimoAlertaUrgencia(clinicId).then((ultimo) => {
      if (vivo) setUltimoAlerta(ultimo)
    })
    return () => {
      vivo = false
    }
  }, [clinicId])

  async function salvarConhecimento() {
    if (!clinicId || conhecimento === null) return
    setSalvandoTexto(true)
    try {
      await saveConhecimentoIA(clinicId, conhecimento)
      setSalvo(conhecimento)
      avisar('Texto salvo: vale a partir da próxima mensagem.', 'ok')
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar o texto.', 'erro')
    } finally {
      setSalvandoTexto(false)
    }
  }

  async function salvarAlerta() {
    if (!clinicId || alerta === null) return
    const numeros = numerosParaOAlerta(alerta)
    // Linha que nao virou numero some calada? Nao: quem digitou errado precisa saber.
    const linhas = alerta.split(/[\n,;]+/).filter((l) => l.trim()).length
    if (numeros.length < linhas) {
      avisar('Algum número não parece um celular com DDD. Confira e salve de novo.', 'erro')
      return
    }
    setSalvandoAlerta(true)
    try {
      await saveAlertaUrgencia(clinicId, numeros)
      const texto = numeros.map(telefoneLegivel).join('\n')
      setAlerta(texto)
      setAlertaSalvo(texto)
      avisar(numeros.length ? `Alerta de urgência salvo para ${numeros.length} número(s).` : 'Alerta de urgência desligado: nenhum número.', 'ok')
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar os números.', 'erro')
    } finally {
      setSalvandoAlerta(false)
    }
  }

  async function testarAlerta() {
    if (!clinicId) return
    setTestandoAlerta(true)
    try {
      const r = await testarAlertaUrgencia(clinicId)
      avisar(r.nota, r.falhou ? 'erro' : 'ok')
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'O teste não saiu.', 'erro')
    } finally {
      setTestandoAlerta(false)
    }
  }

  async function escolher(novo: ModoDoAtendenteIA) {
    if (!clinicId || novo === modo) return
    setSalvando(true)
    try {
      await saveAtendenteIA(clinicId, novo)
      setModo(novo)
      avisar(novo === 'desligado' ? 'IA desligada: o robô de sempre responde.' : `Atendente com IA: ${novo}.`, 'ok')
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível mudar o modo.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="surface-card overflow-hidden rounded-[26px]">
      <div className="border-b border-[#081b2c]/[0.06] bg-gradient-to-r from-white to-[#f0f6fc] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#dceaf7] text-[#1f4f78]">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#1f4f78]">Em teste</p>
            <h2 className="mt-1 text-base font-extrabold tracking-[-0.03em] text-[#081b2c]">Atendente com IA (Claude)</h2>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-slate-400">
              Responde às famílias no WhatsApp usando só o que está nos cartões das unidades e nas respostas prontas.
              Mensagens escritas por ela aparecem com 🤖 na conversa. Se a IA falhar, o robô responde.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {indisponivel ? (
          <p className="rounded-[16px] bg-[#f8f7f4] px-4 py-3 text-[11px] text-slate-500">
            Ainda não disponível: a atualização do banco não chegou. Depois do próximo PUBLICAR, recarregue a página.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {MODOS.map((m) => {
              const ativo = modo === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={salvando || modo === null}
                  onClick={() => void escolher(m.id)}
                  className={`rounded-[18px] border p-3.5 text-left transition disabled:opacity-60 ${
                    ativo ? 'border-[#081b2c] bg-[#081b2c] text-white' : 'border-[#081b2c]/10 bg-white hover:border-[#2f7fc1]/40'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-extrabold">
                    {ativo && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    {m.titulo}
                  </span>
                  <span className={`mt-1 block text-[10px] leading-relaxed ${ativo ? 'text-white/70' : 'text-slate-500'}`}>
                    {m.texto}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {conhecimento !== null && (
          <div className="rounded-[18px] border border-[#081b2c]/10 bg-white p-3.5">
            <label htmlFor="conhecimento-ia" className="text-xs font-extrabold text-[#081b2c]">
              O que a IA sabe do consultório
            </label>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Além dos cartões das unidades e das respostas prontas: quem é o médico, o que ele trata, como é a consulta. A IA
              só afirma o que está escrito aqui ou nos cartões.
            </p>
            <textarea
              id="conhecimento-ia"
              value={conhecimento}
              maxLength={MAXIMO_DO_CONHECIMENTO}
              onChange={(e) => setConhecimento(e.target.value)}
              rows={10}
              className="mt-2 w-full resize-y rounded-[14px] border border-[#081b2c]/10 bg-[#f8f7f4] p-3 text-[11px] leading-relaxed text-[#081b2c] outline-none focus:border-[#2f7fc1]/50"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                {conhecimento.length} / {MAXIMO_DO_CONHECIMENTO}
              </span>
              <button
                type="button"
                disabled={salvandoTexto || conhecimento === salvo}
                onClick={() => void salvarConhecimento()}
                className="rounded-full bg-[#081b2c] px-4 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
              >
                {salvandoTexto ? 'Salvando…' : 'Salvar texto'}
              </button>
            </div>
          </div>
        )}
        {alerta !== null ? (
          <div className="rounded-[18px] border border-[#081b2c]/10 bg-white p-3.5">
            <label htmlFor="alerta-urgencia" className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
              <Siren className="h-3.5 w-3.5 text-[#b42318]" />
              Alerta de urgência no WhatsApp
            </label>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Quando o robô ou a IA reconhecem uma urgência, a qualquer hora, estes celulares recebem no WhatsApp quem
              escreveu, o horário e um trecho da mensagem. Um número por linha, com DDD.
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              <strong>O primeiro número é o do médico.</strong> Pelo próprio WhatsApp ele toca em "É urgente", "Pode
              aguardar" ou "Eu respondo", ou escreve a orientação, e o robô repassa para a família (o texto só sai depois
              de ele tocar em Enviar). Os outros números respondem como equipe e não classificam a urgência.
            </p>
            <textarea
              id="alerta-urgencia"
              value={alerta}
              onChange={(e) => setAlerta(e.target.value)}
              rows={3}
              placeholder="(13) 99999-9999"
              className="mt-2 w-full resize-y rounded-[14px] border border-[#081b2c]/10 bg-[#f8f7f4] p-3 text-[11px] leading-relaxed text-[#081b2c] outline-none focus:border-[#2f7fc1]/50"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                {ultimoAlerta
                  ? `Último alerta: ${new Date(ultimoAlerta.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}, ${ultimoAlerta.detalhe}`
                  : 'Nenhum alerta enviado ainda.'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={testandoAlerta || !alertaSalvo.trim() || alerta !== alertaSalvo}
                  onClick={() => void testarAlerta()}
                  className="rounded-full border border-[#081b2c]/15 bg-white px-4 py-1.5 text-[11px] font-extrabold text-[#081b2c] disabled:opacity-40"
                >
                  {testandoAlerta ? 'Enviando…' : 'Mandar alerta de teste'}
                </button>
                <button
                  type="button"
                  disabled={salvandoAlerta || alerta === alertaSalvo}
                  onClick={() => void salvarAlerta()}
                  className="rounded-full bg-[#081b2c] px-4 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
                >
                  {salvandoAlerta ? 'Salvando…' : 'Salvar números'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              Usa o modelo <strong>alerta_urgencia</strong>, que precisa estar aprovado na Meta. Se o alerta não sair, a
              conversa mostra um aviso para ligar para o médico.
            </p>
          </div>
        ) : (
          !indisponivel && (
            <p className="rounded-[16px] bg-[#f8f7f4] px-4 py-3 text-[11px] text-slate-500">
              Alerta de urgência ainda não disponível: a atualização do banco não chegou. Depois do próximo PUBLICAR,
              recarregue a página.
            </p>
          )
        )}
        <p className="text-[10px] leading-relaxed text-slate-400">
          Precisa da chave da API da Anthropic cadastrada nos segredos das funções do Supabase, com o nome{' '}
          <strong>ANTHROPIC_API_KEY</strong>. Sem a chave, mesmo ligado, o robô de sempre responde.
        </p>
      </div>
    </section>
  )
}
