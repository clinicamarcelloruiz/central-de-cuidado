/**
 * Le a configuracao da clinica de teste no Supabase, so leitura, com a sessao
 * de quem abriu o simulador. Ver da-clinica.ts para o que vira o que.
 *
 * So tabelas de configuracao: unidades, horarios, excecoes, clinic_settings e
 * respostas prontas. Paciente e consulta nunca sao lidos - a demonstracao
 * aparece na frente de cliente.
 *
 * Mesma regra do resto do sistema para coluna nova: vai em consulta separada,
 * dentro de try/catch. O Postgres recusa o SELECT inteiro quando falta uma
 * coluna, e perder a marca de telemedicina e um arranhao; perder a agenda
 * inteira por causa dela, nao.
 */
import { supabase } from '@/lib/supabase'
import type { Linha } from './banco-falso'
import { diaDeBrasilia } from './agenda'
import type { LinhasDaClinica } from './da-clinica'

/** A clinica de teste, a mesma da identidade demo (ver dados.ts e quem-atende.ts). */
export const CLINICA_DE_TESTE = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9'

type Resposta = { data: unknown; error: { message: string } | null }
type Consulta = PromiseLike<Resposta> & {
  select(colunas: string): Consulta
  eq(coluna: string, valor: unknown): Consulta
  gte(coluna: string, valor: unknown): Consulta
  limit(n: number): Consulta
}

// As tabelas de configuracao do robo nem todas estao nos tipos gerados do
// banco (bot_answers, colunas novas de clinic_units); repository.ts faz o
// mesmo com tabelaCrua.
const tabela = (nome: string) => (supabase.from as unknown as (n: string) => Consulta)(nome)

async function linhas(consulta: Consulta): Promise<Linha[]> {
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return (data ?? []) as Linha[]
}

/** Coluna opcional: se o banco ainda nao a tem, fica sem ela e avisa no console. */
async function opcional(consulta: Consulta, oQue: string): Promise<Linha[]> {
  try {
    return await linhas(consulta)
  } catch (erro) {
    console.warn(`[simulador] sem ${oQue} da clinica de teste; seguindo sem`, erro)
    return []
  }
}

export async function lerClinicaDeTeste(): Promise<LinhasDaClinica> {
  const c = CLINICA_DE_TESTE
  const hoje = diaDeBrasilia(new Date())
  const [clinica, unidades, regras, excecoes, agenda, saudacao, telemedicina, respostas, marcaTele, convenios] =
    await Promise.all([
      opcional(tabela('clinics').select('id,name').eq('id', c), 'o nome da clinica'),
      linhas(tabela('clinic_units').select('id,name,address,info_text,archived_at').eq('clinic_id', c)),
      linhas(tabela('availability_rules').select('id,unit_id,weekday,starts_at,ends_at').eq('clinic_id', c)),
      linhas(
        tabela('schedule_exceptions')
          .select('id,unit_id,exception_date,is_closed,starts_at,ends_at,reason')
          .eq('clinic_id', c)
          .gte('exception_date', hoje),
      ),
      opcional(
        tabela('clinic_settings').select('schedule_slot_minutes,schedule_horizon_days,schedule_min_notice_hours').eq('clinic_id', c).limit(1),
        'as preferencias da agenda',
      ),
      opcional(
        tabela('clinic_settings').select('whatsapp_autoreply_text,whatsapp_autoreply_known_text,whatsapp_menu_info_text').eq('clinic_id', c).limit(1),
        'a saudacao do robo',
      ),
      opcional(tabela('clinic_settings').select('telemedicine_enabled,telemedicine_info_text').eq('clinic_id', c).limit(1), 'a telemedicina'),
      opcional(tabela('bot_answers').select('id,subject,keywords,answer,ask_unit,is_active,position').eq('clinic_id', c), 'as respostas prontas'),
      opcional(tabela('clinic_units').select('id,telemedicina').eq('clinic_id', c), 'a marca de telemedicina das unidades'),
      opcional(tabela('clinic_units').select('id,accepts_insurance').eq('clinic_id', c), 'o convenio das unidades'),
    ])

  // RLS nao da erro para quem nao e membro: devolve lista vazia. Sem unidade
  // nenhuma, ou a conta nao enxerga a clinica de teste ou ela esta sem
  // unidades - nos dois casos o simulador nao pode fingir que leu.
  if (unidades.length === 0) {
    throw new Error('a sua conta não enxerga nenhuma unidade da clínica de teste')
  }

  const porId = (lista: Linha[]) => new Map(lista.map((l) => [l.id, l]))
  const tele = porId(marcaTele)
  const convenio = porId(convenios)
  return {
    clinica: clinica[0] ?? null,
    unidades: unidades.map((u) => ({
      ...u,
      telemedicina: tele.get(u.id)?.telemedicina === true,
      accepts_insurance: convenio.get(u.id)?.accepts_insurance ?? null,
    })),
    regras,
    excecoes,
    configuracoes: { ...(agenda[0] ?? {}), ...(saudacao[0] ?? {}), ...(telemedicina[0] ?? {}) },
    respostas,
  }
}
