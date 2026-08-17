import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

function getConfigurationError(): string | null {
  const missingVariables = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean) as string[]

  if (missingVariables.length > 0) {
    return `Configuração do Supabase ausente: ${missingVariables.join(', ')}. Crie um arquivo .env.local a partir do .env.example e reinicie o servidor.`
  }

  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return 'VITE_SUPABASE_URL precisa ser uma URL HTTP ou HTTPS válida.'
    }
  } catch {
    return 'VITE_SUPABASE_URL não contém uma URL válida.'
  }

  return null
}

export const supabaseConfigurationError = getConfigurationError()
export const isSupabaseConfigured = supabaseConfigurationError === null

const fallbackUrl = 'http://127.0.0.1:54321'
const fallbackPublishableKey = 'missing-publishable-key'

function createSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(
    supabaseUrl || fallbackUrl,
    supabasePublishableKey || fallbackPublishableKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    },
  )
}

/**
 * Cliente único do Supabase para toda a aplicação.
 *
 * `isSupabaseConfigured` deve ser verificado antes de iniciar autenticação. Os
 * valores de fallback existem apenas para manter um singleton tipado enquanto a
 * tela explica como corrigir um `.env.local` ausente; eles não são credenciais.
 */
export const supabase = createSupabaseClient()

export function requireSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigurationError ?? 'O cliente Supabase não está disponível.')
  }
  return supabase
}
