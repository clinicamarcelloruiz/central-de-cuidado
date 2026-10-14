import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Loader2, Lock, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import logoCentral from '@/assets/logo-central-de-cuidado.webp'

/**
 * Quem pode abrir o simulador: o login do sistema, e so as contas listadas.
 *
 * A lista guarda o SHA-256 do e-mail, e nao o e-mail: a pagina e publica no
 * GitHub Pages e qualquer um le o codigo dela. Para liberar outra pessoa, gere
 * o hash do e-mail em minusculas e acrescente aqui:
 *   node -e "console.log(require('crypto').createHash('sha256').update('email@exemplo.com').digest('hex'))"
 *
 * O que esta trava protege e o acesso a demonstracao, nao dado da clinica: o
 * simulador roda inteiro no navegador, com banco falso, e nao le nem grava nada
 * no Supabase. A sessao e a do proprio sistema (mesmo endereco), entao quem ja
 * entrou na Central entra direto.
 */
const CONTAS_LIBERADAS = [
  '86c69d3de7e3c3f8b51abe860f78d35d2a1c23682c638c579439ae5f8b0746cf',
]

async function impressaoDoEmail(email: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function Carregando() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#081b2c]">
      <Loader2 className="h-6 w-6 animate-spin text-[#6fadde]" />
    </main>
  )
}

function Moldura({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#081b2c] px-4 py-10">
      <div className="w-full max-w-[400px] rounded-[28px] bg-white p-8 shadow-[0_30px_80px_rgba(0,0,0,.35)]">
        <img src={logoCentral} alt="Central de Cuidado" className="h-9 w-auto brightness-0" />
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#2f7fc1]">Simulador do atendimento</p>
        {children}
      </div>
    </main>
  )
}

export function Acesso({ children }: { children: ReactNode }) {
  const { session, user, loading, signIn, signOut, authError, configurationError } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [liberado, setLiberado] = useState<{ email: string; ok: boolean } | null>(null)

  const emailDaSessao = user?.email ?? ''
  useEffect(() => {
    if (!emailDaSessao) return
    let vivo = true
    void impressaoDoEmail(emailDaSessao).then((h) => {
      if (vivo) setLiberado({ email: emailDaSessao, ok: CONTAS_LIBERADAS.includes(h) })
    })
    return () => {
      vivo = false
    }
  }, [emailDaSessao])

  // So no servidor de desenvolvimento (npm run dev), para conferir a tela sem
  // senha: o build de producao troca import.meta.env.DEV por false e este
  // atalho nao chega ao site publicado.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('semlogin')) return <>{children}</>

  if (loading) return <Carregando />

  if (!session) {
    const entrar = async (e: FormEvent) => {
      e.preventDefault()
      setEntrando(true)
      await signIn(email, senha)
      setEntrando(false)
    }
    return (
      <Moldura>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-[#081b2c]">Entre com o seu acesso da Central</h1>
        <p className="mt-2 text-sm text-slate-500">O mesmo e-mail e senha do sistema.</p>
        <form onSubmit={entrar} className="mt-6 space-y-3">
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full rounded-2xl border border-slate-200 bg-[#f7f5f1] px-4 py-3 text-[15px] text-[#081b2c] outline-none focus:border-[#2f7fc1] focus:bg-white"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-2xl border border-slate-200 bg-[#f7f5f1] px-4 py-3 text-[15px] text-[#081b2c] outline-none focus:border-[#2f7fc1] focus:bg-white"
          />
          {(authError || configurationError) && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{authError || configurationError}</p>
          )}
          <button
            type="submit"
            disabled={entrando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#081b2c] px-4 py-3 text-[15px] font-bold text-white transition hover:bg-[#10304d] disabled:opacity-60"
          >
            {entrando && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>
      </Moldura>
    )
  }

  if (!liberado || liberado.email !== emailDaSessao) return <Carregando />

  if (!liberado.ok) {
    return (
      <Moldura>
        <h1 className="mt-2 flex items-center gap-2 text-[22px] font-extrabold text-[#081b2c]">
          <Lock className="h-5 w-5 text-[#2f7fc1]" /> Acesso restrito
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta demonstração está liberada só para contas específicas. Você entrou como <strong>{emailDaSessao}</strong>.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[15px] font-bold text-[#081b2c] hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" /> Sair e entrar com outra conta
        </button>
      </Moldura>
    )
  }

  return <>{children}</>
}
