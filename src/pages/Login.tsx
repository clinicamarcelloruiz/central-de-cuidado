import { useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  HeartHandshake,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import logo from '@/assets/logo.webp'

const inputClass =
  'w-full rounded-2xl border border-[#081b2c]/10 bg-[#fafaf8] py-3.5 pl-11 pr-4 text-sm font-semibold text-[#081b2c] outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-[#dc8e5f] focus:bg-white focus:ring-4 focus:ring-[#dc8e5f]/10 disabled:cursor-not-allowed disabled:opacity-60'

export default function Login() {
  const { signIn, authError, configurationError, clearAuthError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearAuthError()

    if (!email.trim() || !password) {
      setValidationError('Preencha seu e-mail e sua senha.')
      return
    }

    setValidationError(null)
    setSubmitting(true)
    try {
      const result = await signIn(email, password)
      if (!result.error) setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleError = configurationError ?? validationError ?? authError
  const disabled = submitting || Boolean(configurationError)

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f7f5f1] text-[#081b2c]">
      <div className="pointer-events-none absolute -left-32 -top-40 h-[440px] w-[440px] rounded-full bg-[#9fc2b8]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -right-32 h-[520px] w-[520px] rounded-full bg-[#e9b18f]/25 blur-3xl" />

      <div className="relative mx-auto grid min-h-dvh max-w-[1500px] lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,.92fr)]">
        <section className="soft-grid relative hidden overflow-hidden bg-[#081b2c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-[#dc8e5f]/15 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#6f9d91]/15 blur-3xl" />

          <div className="relative">
            <img
              src={logo}
              alt="Dr. Marcello Ruiz"
              className="h-14 w-auto max-w-[220px] brightness-0 invert"
            />
            <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
              <HeartHandshake className="h-4 w-4 text-[#e2a077]" />
              Central de cuidado
            </div>
          </div>

          <div className="relative max-w-2xl py-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#efb28e]">
              <Sparkles className="h-3.5 w-3.5" />
              Cuidado contínuo
            </div>
            <h1 className="mt-6 max-w-xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.05em] xl:text-5xl">
              Cada família acompanhada no momento certo.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/50 xl:text-base">
              Uma visão segura da jornada de cada paciente, das consultas aos contatos de 30 e 90 dias.
            </p>

            <div className="mt-9 grid max-w-xl grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <ShieldCheck className="h-5 w-5 text-[#e4a078]" />
                <p className="mt-3 text-xs font-extrabold text-white/90">Acesso protegido</p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/40">Somente para a equipe autorizada</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <HeartHandshake className="h-5 w-5 text-[#9fc2b8]" />
                <p className="mt-3 text-xs font-extrabold text-white/90">Cuidado organizado</p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/40">Informações sincronizadas com segurança</p>
              </div>
            </div>
          </div>

          <p className="relative text-[10px] font-semibold text-white/30">
            Gastroenterologia pediátrica · Central de Cuidado
          </p>
        </section>

        <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[470px]">
            <div className="mb-8 flex justify-center lg:hidden">
              <div className="rounded-[22px] bg-[#081b2c] px-6 py-4 shadow-[0_18px_40px_rgba(8,27,44,.18)]">
                <img
                  src={logo}
                  alt="Dr. Marcello Ruiz"
                  className="h-10 w-auto max-w-[180px] brightness-0 invert"
                />
              </div>
            </div>

            <div className="surface-card rounded-[30px] p-6 shadow-[0_24px_70px_rgba(8,27,44,.11)] sm:p-8">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#f5e7dd] text-[#c87543]">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#c87543]">
                    Área restrita
                  </p>
                  <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-0.04em] text-[#081b2c]">
                    Acesse sua conta
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Entre com as credenciais fornecidas pelo administrador da clínica.
                  </p>
                </div>
              </div>

              <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    E-mail
                  </span>
                  <div className="relative mt-2">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className={inputClass}
                      placeholder="seuemail@clinica.com.br"
                      value={email}
                      disabled={disabled}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        if (validationError) setValidationError(null)
                        if (authError) clearAuthError()
                      }}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    Senha
                  </span>
                  <div className="relative mt-2">
                    <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className={`${inputClass} pr-12`}
                      placeholder="Sua senha"
                      value={password}
                      disabled={disabled}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        if (validationError) setValidationError(null)
                        if (authError) clearAuthError()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={disabled}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f3eee9] hover:text-[#c87543] disabled:pointer-events-none"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {visibleError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3 text-[11px] font-semibold leading-relaxed text-red-600"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{visibleError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={disabled}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#081b2c] px-5 py-3.5 text-xs font-extrabold text-white shadow-[0_12px_26px_rgba(8,27,44,.18)] transition hover:-translate-y-0.5 hover:bg-[#102d47] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar com segurança
                      <ArrowRight className="h-4 w-4 text-[#e6a47b] transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-2 border-t border-[#081b2c]/[0.06] pt-5 text-[10px] leading-relaxed text-slate-400">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#6f9d91]" />
                <span>Não possui acesso? Solicite suas credenciais ao administrador.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
