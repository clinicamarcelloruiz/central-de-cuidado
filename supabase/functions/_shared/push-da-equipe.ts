import { enviarPush, gerarChavesVapid, type ChavesVapid, type Inscricao } from './web-push.ts'
import type { Aviso } from './aviso-da-equipe.ts'
import type { adminClient } from './whatsapp.ts'

/**
 * Entrega de notificacao no celular da equipe (28/09/2026).
 *
 * As chaves VAPID moram no banco (push_chaves, so o service role le) e nascem
 * sozinhas no primeiro uso. Assim ninguem precisa gerar chave e colar em
 * segredo do Supabase - o passo manual que, com o lembrete da vespera, ficou
 * tres semanas errado sem ninguem ver.
 *
 * NADA aqui pode derrubar o atendimento: quem chama e o webhook do WhatsApp.
 * Toda falha vira console.warn e fica gravada na linha do aparelho
 * (ultimo_erro), que a tela de Preferencias mostra.
 */

type Admin = ReturnType<typeof adminClient>

export async function chavesDaClinica(admin: Admin): Promise<ChavesVapid> {
  const ler = async () => {
    const { data, error } = await admin.from('push_chaves').select('publica,privada_jwk').eq('id', 1).maybeSingle()
    if (error) throw new Error(`push_chaves: ${error.message}`)
    return data ? ({ publica: data.publica, privadaJwk: data.privada_jwk } as ChavesVapid) : null
  }
  const existentes = await ler()
  if (existentes) return existentes

  // Duas chamadas ao mesmo tempo podem gerar duas chaves; o id fixo faz so a
  // primeira entrar, e as duas releem a que ficou. Chave trocada depois
  // invalidaria todo aparelho ja inscrito.
  const novas = await gerarChavesVapid()
  const { error } = await admin
    .from('push_chaves')
    .upsert({ id: 1, publica: novas.publica, privada_jwk: novas.privadaJwk }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(`push_chaves: ${error.message}`)
  const gravadas = await ler()
  if (!gravadas) throw new Error('push_chaves: chave gerada e nao encontrada')
  return gravadas
}

type Linha = Inscricao & { id: string; user_id: string }

/** Envia para as linhas dadas e registra o resultado em cada uma. */
export async function entregar(admin: Admin, linhas: Linha[], carga: unknown, chaves: ChavesVapid) {
  const resultados = await Promise.all(
    linhas.map(async (linha) => {
      const r = await enviarPush(linha, carga, chaves)
      if (r.ok) {
        await admin.from('push_inscricoes').update({ ultimo_envio_em: new Date().toISOString(), ultimo_erro: null }).eq('id', linha.id)
      } else if (r.status === 404 || r.status === 410) {
        // O aparelho desinstalou, limpou os dados ou revogou a permissao. A
        // linha nao serve mais; guardar so faria cada aviso falhar de novo.
        await admin.from('push_inscricoes').delete().eq('id', linha.id)
      } else {
        console.warn('Notificacao no celular recusada', { status: r.status, detalhe: r.detalhe, inscricao: linha.id })
        await admin
          .from('push_inscricoes')
          .update({ ultimo_erro: `${r.status || 'rede'}: ${r.detalhe}`.slice(0, 300) })
          .eq('id', linha.id)
      }
      return r
    }),
  )
  return {
    enviados: resultados.filter((r) => r.ok).length,
    removidos: resultados.filter((r) => r.status === 404 || r.status === 410).length,
    falhas: resultados.filter((r) => !r.ok && r.status !== 404 && r.status !== 410).map((r) => `${r.status}: ${r.detalhe}`),
  }
}

/** Avisa todos os aparelhos inscritos da clinica. Nunca lanca. */
export async function avisarEquipe(admin: Admin, clinicId: string, aviso: Aviso): Promise<void> {
  try {
    const { data: inscricoes, error } = await admin
      .from('push_inscricoes')
      .select('id,user_id,endpoint,p256dh,auth')
      .eq('clinic_id', clinicId)
    if (error) {
      console.warn('Notificacao no celular: nao consegui ler as inscricoes', error)
      return
    }
    if (!inscricoes?.length) return

    // So quem ainda e da equipe. Quem saiu da clinica pode ter deixado o
    // celular inscrito, e a mensagem da familia nao e mais da conta dela.
    const { data: membros } = await admin
      .from('clinic_memberships')
      .select('user_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
    const ativos = new Set((membros ?? []).map((m: { user_id: string }) => m.user_id))
    const linhas = (inscricoes as Linha[]).filter((l) => ativos.has(l.user_id))
    if (!linhas.length) return

    const chaves = await chavesDaClinica(admin)
    const r = await entregar(admin, linhas, aviso, chaves)
    if (r.falhas.length) console.warn('Notificacao no celular: falhas', r.falhas)
  } catch (erro) {
    console.warn('Notificacao no celular falhou', erro)
  }
}
