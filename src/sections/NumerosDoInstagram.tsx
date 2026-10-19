import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck2, Instagram, Megaphone, Search, Sun } from 'lucide-react'
import {
  getCurrentMembership,
  numerosDosAnuncios,
  type ChegadaPorAnuncio,
  type NumerosDosAnuncios,
  type OrigemDoAnuncio,
} from '@/lib/repository'

const NAVY = '#081b2c'
const AZUL = '#2f7fc1'
const SAGE = '#6f9d91'
const ROSA = '#c13584'

/**
 * Quem chegou pelos anuncios (19/10/2026).
 *
 * Pedido do Edu no dia seguinte ao da campanha do Instagram entrar no ar: "os
 * clientes clicam e vao para o bot, tem como eu saber quando isso acontece?".
 * O Gerenciador da Meta conta cliques; aqui aparece quem de fato escreveu, o
 * nome, e se marcou consulta. O Google entra junto porque o caminho e o mesmo
 * (anuncio -> site -> WhatsApp), mas o titulo da aba e o que foi pedido.
 */
const PERIODOS = [
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: 90 },
]

const DA_META: OrigemDoAnuncio[] = ['instagram', 'meta']

const NOME_DA_ORIGEM: Record<OrigemDoAnuncio, string> = {
  instagram: 'Instagram',
  // A Meta mandou o anuncio sem dizer se foi Instagram ou Facebook.
  meta: 'Anúncio Meta',
  facebook: 'Facebook',
  google: 'Google',
}

function porcento(parte: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((parte / total) * 100)}%`
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Numero({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  cor,
}: {
  rotulo: string
  valor: string | number
  detalhe: string
  icone: typeof Instagram
  cor: string
}) {
  return (
    <div className="surface-card rounded-[20px] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{rotulo}</p>
        <Icone className="h-4 w-4 shrink-0" style={{ color: cor }} />
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-[-0.05em]" style={{ color: NAVY }}>
        {valor}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">{detalhe}</p>
    </div>
  )
}

function Situacao({ chegada }: { chegada: ChegadaPorAnuncio }) {
  if (chegada.consultaEm && !chegada.consultaCancelada) {
    return (
      <span className="rounded-full bg-[#e8f3ef] px-2 py-0.5 text-[9px] font-extrabold text-[#2f6b5c]">
        Marcou para {quando(chegada.consultaEm).replace(',', ' às')}
      </span>
    )
  }
  if (chegada.consultaCancelada) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold text-red-700">
        Marcou e cancelou
      </span>
    )
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-500">
      Sem consulta ainda
    </span>
  )
}

/**
 * O Google ganhou aba propria no mesmo dia, a pedido do Edu ("da pra fazer do
 * google tb?"). Diferenca que a tela precisa dizer: no Google nao ha aviso
 * invisivel como o referral da Meta - o WhatsApp so recebe o texto. Quem veio
 * do Google so e reconhecido se mandar a frase pronta sem mudar.
 */
export type Canal = 'instagram' | 'google'

export default function NumerosDoInstagram({ canal = 'instagram' }: { canal?: Canal }) {
  const [dias, setDias] = useState(7)
  const [dados, setDados] = useState<NumerosDosAnuncios | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const inicio = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - dias)
    return d
  }, [dias])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro('')
    void (async () => {
      try {
        const membership = await getCurrentMembership()
        if (!membership) throw new Error('Não identifiquei a clínica do seu usuário.')
        const numeros = await numerosDosAnuncios(membership.clinicId, inicio, new Date())
        if (vivo) setDados(numeros)
      } catch (causa) {
        if (vivo) setErro(causa instanceof Error ? causa.message : 'Não consegui carregar os números.')
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [inicio])

  const contas = useMemo(() => {
    const chegadas = dados?.chegadas ?? []
    const daMeta = chegadas.filter((c) => DA_META.includes(c.origem))
    const google = chegadas.filter((c) => c.origem === 'google')
    const doCanal = canal === 'google' ? google : daMeta
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return {
      doCanal,
      doOutro: canal === 'google' ? daMeta.length : google.length,
      metaSemPlataforma: chegadas.filter((c) => c.origem === 'meta').length,
      marcaram: doCanal.filter((c) => c.consultaEm && !c.consultaCancelada).length,
      hoje: doCanal.filter((c) => new Date(c.chegouEm) >= hoje).length,
      facebook: chegadas.filter((c) => c.origem === 'facebook').length,
    }
  }, [dados, canal])
  const nomeDoCanal = canal === 'google' ? 'Google' : 'Instagram'

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold tracking-[-0.02em] text-[#081b2c]">Quem chegou pelo {nomeDoCanal}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {canal === 'google'
              ? 'Famílias que acharam o Dr. Marcello no Google e escreveram no WhatsApp do robô.'
              : 'Famílias que tocaram no anúncio e escreveram no WhatsApp do robô.'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.dias}
              type="button"
              onClick={() => setDias(periodo.dias)}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-extrabold transition ${
                dias === periodo.dias ? 'bg-[#081b2c] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {periodo.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-[16px] border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando && !dados ? (
        <div className="surface-card rounded-[24px] p-10 text-center text-xs text-slate-500">Contando...</div>
      ) : dados && !dados.disponivel ? (
        // Zero aqui pareceria "ninguem veio do anuncio"; e so o banco atrasado.
        <div className="flex items-start gap-2 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O banco ainda não tem o registro de origem dos anúncios. Ele chega com a próxima publicação; até lá
            esta aba fica vazia, e não quer dizer que ninguém veio do anúncio.
          </span>
        </div>
      ) : dados ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Numero
              rotulo={`Chegaram pelo ${nomeDoCanal}`}
              valor={contas.doCanal.length}
              detalhe={canal === 'google' ? 'mandaram a frase do Google' : 'tocaram no anúncio e escreveram'}
              icone={canal === 'google' ? Search : Instagram}
              cor={canal === 'google' ? NAVY : ROSA}
            />
            <Numero
              rotulo="Marcaram consulta"
              valor={contas.marcaram}
              detalhe={`${porcento(contas.marcaram, contas.doCanal.length)} de quem chegou pelo ${nomeDoCanal}`}
              icone={CalendarCheck2}
              cor={SAGE}
            />
            <Numero
              rotulo="Hoje"
              valor={contas.hoje}
              detalhe={`chegaram pelo ${nomeDoCanal} hoje`}
              icone={Sun}
              cor={AZUL}
            />
            <Numero
              rotulo={canal === 'google' ? 'Pelo Instagram' : 'Pelo Google'}
              valor={contas.doOutro}
              detalhe={`no mesmo período, para comparar (aba ${canal === 'google' ? 'Instagram' : 'Google'})`}
              icone={canal === 'google' ? Instagram : Search}
              cor={canal === 'google' ? ROSA : NAVY}
            />
          </div>

          <div className="surface-card rounded-[24px] p-5">
            <p className="text-sm font-extrabold tracking-[-0.02em] text-[#081b2c]">Quem chegou</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              A mais recente em cima. Para abrir a conversa, procure o telefone em Respostas.
            </p>
            {contas.doCanal.length === 0 ? (
              <p className="mt-4 text-[11px] text-slate-500">Ninguém chegou pelo {nomeDoCanal} neste período.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {contas.doCanal.map((c) => (
                  <li key={c.conversaId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-extrabold text-[#081b2c]">{c.nome}</p>
                      <p className="text-[10px] text-slate-500">
                        {c.telefone} · chegou {quando(c.chegouEm).replace(',', ' às')}
                        {c.tituloDoAnuncio ? ` · anúncio "${c.tituloDoAnuncio}"` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SeloDaOrigem origem={c.origem} />
                      <Situacao chegada={c} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canal === 'google' ? (
            <p className="text-[10px] leading-relaxed text-slate-400">
              Conta quem mandou a frase pronta "Encontrei o Dr. Marcello no Google", que vem do botão de WhatsApp
              do site (para quem chegou pelo anúncio) e do chat do perfil no Google. Diferente do Instagram, o
              Google não manda aviso escondido: se a pessoa apagar a frase antes de enviar, ela não entra aqui.
              Os cliques no WhatsApp do site, mesmo de quem desistiu, aparecem no Google Ads como conversão.
            </p>
          ) : (
          <p className="text-[10px] leading-relaxed text-slate-400">
            Conta só quem escreveu no WhatsApp. Quem viu ou clicou e desistiu antes de mandar a mensagem aparece
            apenas no Gerenciador de Anúncios da Meta.
            {contas.metaSemPlataforma > 0 &&
              ` ${contas.metaSemPlataforma} veio de anúncio da Meta sem dizer se foi Instagram ou Facebook; entra na conta do Instagram porque a campanha atual só roda lá.`}
            {contas.facebook > 0 && ` ${contas.facebook} veio pelo Facebook.`}
          </p>
          )}
        </>
      ) : null}
    </section>
  )
}

/** Selo de origem, o mesmo na aba e no cartao da conversa em Respostas. */
export function SeloDaOrigem({ origem }: { origem: OrigemDoAnuncio }) {
  const google = origem === 'google'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
        google ? 'bg-[#eef5fd] text-[#16456b]' : 'bg-[#fbeaf3] text-[#9b2c6a]'
      }`}
    >
      {google ? <Search className="h-2.5 w-2.5" /> : origem === 'facebook' ? <Megaphone className="h-2.5 w-2.5" /> : <Instagram className="h-2.5 w-2.5" />}
      {google ? 'Google' : NOME_DA_ORIGEM[origem]}
    </span>
  )
}
