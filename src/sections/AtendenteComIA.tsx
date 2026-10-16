import { useEffect, useState } from 'react'
import { Bot, Check } from 'lucide-react'
import { useDialogos } from '@/components/dialogos-contexto'
import { getAtendenteIA, saveAtendenteIA, type ModoDoAtendenteIA } from '@/lib/repository'

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
      'A IA conversa com as famílias. Marcar, remarcar, cancelar e 2ª via continuam pelos passos do robô. Sintoma, urgência e foto ficam com o robô e a equipe.',
  },
]

export default function AtendenteComIA({ clinicId }: { clinicId: string | null }) {
  const { avisar } = useDialogos()
  const [modo, setModo] = useState<ModoDoAtendenteIA | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    void getAtendenteIA(clinicId).then((atual) => {
      if (!vivo) return
      if (atual === null) setIndisponivel(true)
      else setModo(atual)
    })
    return () => {
      vivo = false
    }
  }, [clinicId])

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
        <p className="text-[10px] leading-relaxed text-slate-400">
          Precisa da chave da API da Anthropic cadastrada nos segredos das funções do Supabase, com o nome{' '}
          <strong>ANTHROPIC_API_KEY</strong>. Sem a chave, mesmo ligado, o robô de sempre responde.
        </p>
      </div>
    </section>
  )
}
