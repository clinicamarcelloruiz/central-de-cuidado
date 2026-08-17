import { Routes, Route } from 'react-router'
import { HeartHandshake } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import Home from './pages/Home'
import Login from './pages/Login'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f7f5f1] text-[#081b2c]">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#081b2c] text-[#e6a47b] shadow-[0_18px_45px_rgba(8,27,44,.18)]">
            <HeartHandshake className="h-6 w-6 animate-pulse" />
          </span>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">
            Preparando ambiente seguro
          </p>
        </div>
      </main>
    )
  }

  if (!session) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}
