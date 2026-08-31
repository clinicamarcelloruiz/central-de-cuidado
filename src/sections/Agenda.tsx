import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarOff,
  CalendarPlus,
  Clock,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import {
  archiveUnit,
  cancelAppointment,
  createAppointment,
  createAvailabilityRule,
  createScheduleException,
  createUnit,
  deleteAvailabilityRule,
  deleteScheduleException,
  getCurrentMembership,
  getSchedulePreferences,
  confirmAppointment,
  notifyAppointmentConfirmed,
  listAppointments,
  listAvailabilityRules,
  listAvailableSlots,
  listScheduleExceptions,
  listUnits,
  saveSchedulePreferences,
  updateAppointmentDetails,
  WEEKDAY_LABEL,
  type Appointment,
  type AvailabilityRule,
  type ScheduleException,
  type SchedulePreferences,
  type Unit,
} from '@/lib/repository'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Patient } from '@/types/patient'

type Aba = 'calendario' | 'configuracao'

/**
 * Sugestoes de paciente mostradas de uma vez ao vincular uma consulta.
 *
 * Cinco cabe na tela sem rolar e obriga quem procura a escrever mais duas
 * letras em vez de varrer a lista com o olho. Despejar a base inteira aqui nao
 * ajudaria a achar ninguem.
 */
const MAX_SUGESTOES = 5

function diaLegivel(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso))
}

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

/** Junta horarios livres e consultas marcadas num unico calendario por dia. */
function agruparPorDia(slots: string[], appointments: Appointment[]) {
  const dias = new Map<string, { livres: string[]; marcados: Appointment[] }>()
  const garantir = (chave: string) => {
    if (!dias.has(chave)) dias.set(chave, { livres: [], marcados: [] })
    return dias.get(chave)!
  }
  for (const slot of slots) garantir(slot.slice(0, 10)).livres.push(slot)
  for (const item of appointments) garantir(item.startsAt.slice(0, 10)).marcados.push(item)
  return [...dias.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

export default function Agenda({
  patients,
  /** Avisa o Home para o contador do menu e o aviso da Visao geral acompanharem. */
  onSolicitacoesMudaram,
  onCadastrarContato,
}: {
  patients: Patient[]
  onSolicitacoesMudaram?: () => void
  /** Abre a tela de pacientes com nome e telefone da consulta ja preenchidos. */
  onCadastrarContato?: (dados: {
    nome: string
    telefone: string
    dataConsulta?: string
    unidade?: string
  }) => void
}) {
  const [aba, setAba] = useState<Aba>('calendario')
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState<string | null>(null)
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [prefs, setPrefs] = useState<SchedulePreferences>({
    slotMinutes: 40,
    horizonDays: 15,
    minNoticeHours: 2,
    reminderEnabled: true,
    reminderDays: 1,
  })
  const [slots, setSlots] = useState<string[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [slotEscolhido, setSlotEscolhido] = useState<string | null>(null)

  // Formularios
  const [novaUnidade, setNovaUnidade] = useState({ nome: '', endereco: '' })
  const [novaRegra, setNovaRegra] = useState({ weekday: 1, inicio: '08:00', fim: '12:00' })
  const [novoBloqueio, setNovoBloqueio] = useState({ data: '', motivo: '' })

  const carregarBase = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const membership = await getCurrentMembership()
      if (!membership) throw new Error('Não foi possível identificar a clínica do seu usuário.')
      setClinicId(membership.clinicId)
      const [lista, preferencias, excecoes] = await Promise.all([
        listUnits(membership.clinicId),
        getSchedulePreferences(membership.clinicId),
        listScheduleExceptions(membership.clinicId),
      ])
      setUnits(lista)
      setPrefs(preferencias)
      setExceptions(excecoes)
      setUnitId((atual) => atual ?? lista[0]?.id ?? null)
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'Não foi possível carregar a agenda.')
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarUnidade = useCallback(async () => {
    if (!clinicId || !unitId) {
      setRules([])
      setSlots([])
      setAppointments([])
      return
    }
    try {
      const [regras, livres, marcados] = await Promise.all([
        listAvailabilityRules(unitId),
        listAvailableSlots(unitId),
        listAppointments(clinicId, unitId),
      ])
      setRules(regras)
      setSlots(livres)
      setAppointments(marcados)
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'Não foi possível carregar os horários.')
    }
  }, [clinicId, unitId])

  useEffect(() => {
    void carregarBase()
  }, [carregarBase])
  useEffect(() => {
    void carregarUnidade()
  }, [carregarUnidade])

  const dias = useMemo(() => agruparPorDia(slots, appointments), [slots, appointments])
  const unidadeAtual = units.find((u) => u.id === unitId) ?? null

  // ---- Painel de edicao de uma consulta ----
  //
  // Existe sobretudo por causa do que chega pelo WhatsApp: a consulta nasce sem
  // paciente vinculado, e enquanto ficar assim nao entra no prontuario nem nos
  // acompanhamentos de 30 e 90 dias.
  const [emEdicao, setEmEdicao] = useState<Appointment | null>(null)
  const [formConsulta, setFormConsulta] = useState({
    contactName: '',
    contactPhone: '',
    staffNote: '',
    patientId: '',
  })
  const [salvandoConsulta, setSalvandoConsulta] = useState(false)
  const [buscaPaciente, setBuscaPaciente] = useState('')

  function abrirConsulta(item: Appointment) {
    setEmEdicao(item)
    setBuscaPaciente('')
    setFormConsulta({
      contactName: item.contactName,
      contactPhone: item.contactPhone,
      staffNote: item.staffNote,
      patientId: item.patientId ?? '',
    })
  }

  /**
   * Paciente que ja usa o telefone da consulta.
   *
   * O WhatsApp entrega o numero com o 55 na frente e o cadastro costuma ter so
   * o DDD, entao os dois lados sao normalizados antes de comparar. A comparacao
   * inclui o DDD de proposito: olhar so o final confundiria (11) 99723-7155 com
   * (13) 99723-7155, que sao pessoas diferentes.
   */
  const sugeridos = useMemo(() => {
    const nacional = (bruto: string) => {
      const d = bruto.replace(/\D/g, '')
      return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d
    }
    const alvo = nacional(formConsulta.contactPhone)
    if (alvo.length < 10) return []
    return patients.filter((p) => nacional(p.telefone) === alvo)
  }, [patients, formConsulta.contactPhone])

  /**
   * Resultado da busca. Sem termo nao devolve nada de proposito: despejar os
   * primeiros da base nao ajuda a achar ninguem, e ainda passa a impressao de
   * que so existem aqueles.
   */
  const encontrados = useMemo(() => {
    const termo = buscaPaciente.trim().toLowerCase()
    const digitos = termo.replace(/\D/g, '')
    if (termo.length < 2 && digitos.length < 4) return []
    return patients.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (digitos.length >= 4 && p.telefone.replace(/\D/g, '').includes(digitos)),
    )
  }, [patients, buscaPaciente])

  /**
   * Confirma a solicitacao e conta ao paciente.
   *
   * O aviso e melhor-esforco: se a janela de 24h da Meta ja fechou, a consulta
   * segue confirmada do mesmo jeito e a tela diz que o aviso nao saiu. Deixar
   * a confirmacao presa a um envio seria pior.
   */
  async function confirmarEAvisar(appointmentId: string) {
    if (!clinicId) return
    await acao(
      () => confirmAppointment(appointmentId),
      'Consulta confirmada. A vaga deixou de ser provisória.',
    )
    onSolicitacoesMudaram?.()
    const aviso = await notifyAppointmentConfirmed(clinicId, appointmentId)
    setAviso(
      aviso.avisou
        ? 'Consulta confirmada e paciente avisado pelo WhatsApp.'
        : 'Consulta confirmada. Não consegui avisar pelo WhatsApp — responda pela tela de Respostas.',
    )
  }

  async function salvarConsulta() {
    if (!emEdicao) return
    setSalvandoConsulta(true)
    await acao(
      () =>
        updateAppointmentDetails(emEdicao.id, {
          contactName: formConsulta.contactName,
          contactPhone: formConsulta.contactPhone,
          staffNote: formConsulta.staffNote,
          patientId: formConsulta.patientId || null,
        }),
      'Consulta atualizada.',
    )
    setSalvandoConsulta(false)
    setEmEdicao(null)
  }

  async function acao(fn: () => Promise<void>, mensagem?: string) {
    setError('')
    setAviso('')
    try {
      await fn()
      if (mensagem) setAviso(mensagem)
      await carregarBase()
      await carregarUnidade()
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'A operação não foi concluída.')
    }
  }

  if (loading) {
    return (
      <div className="surface-card rounded-[22px] p-8 text-center text-xs font-semibold text-slate-500">
        Carregando agenda...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-[16px] border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {aviso && (
        <div className="rounded-[16px] border border-[#3fa88a]/30 bg-[#eef7f4] p-3 text-[11px] font-bold text-[#2f6f5e]">
          {aviso}
        </div>
      )}

      {units.length === 0 ? (
        <div className="surface-card rounded-[22px] p-8">
          <Building2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-center text-sm font-bold text-[#081b2c]">
            Cadastre a primeira unidade
          </p>
          <p className="mx-auto mt-1 max-w-md text-center text-xs text-slate-500">
            A agenda é organizada por unidade de atendimento. Cada uma tem horários próprios, e é
            entre elas que o paciente escolhe ao marcar pelo WhatsApp.
          </p>
          <div className="mx-auto mt-4 flex max-w-md flex-col gap-2">
            <input
              value={novaUnidade.nome}
              onChange={(e) => setNovaUnidade({ ...novaUnidade, nome: e.target.value })}
              placeholder="Nome da unidade"
              className="rounded-xl border border-[#081b2c]/10 bg-[#fafaf8] px-3 py-2 text-xs outline-none focus:border-[#dc8e5f]"
            />
            <input
              value={novaUnidade.endereco}
              onChange={(e) => setNovaUnidade({ ...novaUnidade, endereco: e.target.value })}
              placeholder="Endereço (opcional)"
              className="rounded-xl border border-[#081b2c]/10 bg-[#fafaf8] px-3 py-2 text-xs outline-none focus:border-[#dc8e5f]"
            />
            <button
              type="button"
              disabled={!novaUnidade.nome.trim()}
              onClick={() =>
                void acao(async () => {
                  if (!clinicId) return
                  await createUnit(clinicId, novaUnidade.nome, novaUnidade.endereco)
                  setNovaUnidade({ nome: '', endereco: '' })
                }, 'Unidade cadastrada.')
              }
              className="rounded-xl bg-[#081b2c] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#102d47] disabled:opacity-40"
            >
              Cadastrar unidade
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={unitId ?? ''}
                onChange={(e) => setUnitId(e.target.value)}
                className="rounded-xl border border-[#081b2c]/10 bg-white px-3 py-1.5 text-[11px] font-bold text-[#081b2c] outline-none"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <div className="flex rounded-xl bg-[#eef3f2] p-0.5">
                {(['calendario', 'configuracao'] as Aba[]).map((chave) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setAba(chave)}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-extrabold transition ${
                      aba === chave ? 'bg-white text-[#081b2c] shadow-sm' : 'text-[#557f75]'
                    }`}
                  >
                    {chave === 'calendario' ? 'Calendário' : 'Configuração'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void carregarUnidade()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#eef3f2] px-3 py-1.5 text-[10px] font-extrabold text-[#557f75] transition hover:bg-[#e2ece9]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
          </div>

          {aba === 'calendario' ? (
            <div className="space-y-3">
              {rules.length === 0 && (
                <div className="flex items-start gap-2 rounded-[16px] border border-[#dc8e5f]/40 bg-[#fdf3ec] p-3 text-[11px] font-bold text-[#8a4b1d]">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Esta unidade ainda não tem horário de atendimento definido, então não há
                    horários para oferecer. Vá em Configuração e informe os dias e períodos.
                  </span>
                </div>
              )}

              {dias.length === 0 && rules.length > 0 && (
                <div className="surface-card rounded-[22px] p-8 text-center text-xs font-semibold text-slate-500">
                  Nenhum horário disponível nos próximos {prefs.horizonDays} dias.
                </div>
              )}

              {dias.map(([dia, { livres, marcados }]) => (
                <div key={dia} className="surface-card rounded-[20px] p-4">
                  <p className="text-xs font-extrabold capitalize text-[#081b2c]">
                    {diaLegivel(dia + 'T12:00:00')}
                  </p>

                  {marcados.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {marcados.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                            item.confirmedByClinic
                              ? 'bg-[#081b2c]'
                              : 'border border-[#dc8e5f] bg-[#8a4b1d]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => abrirConsulta(item)}
                            title="Abrir para editar"
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-[11px] font-bold text-white">
                              {hora(item.startsAt)} · {item.patientName}
                              {!item.confirmedByClinic && ' · AGUARDANDO CONFIRMAÇÃO'}
                            </p>
                            <p className="text-[9px] font-bold text-white/60">
                              {item.confirmedByClinic
                                ? [
                                    item.source === 'whatsapp'
                                      ? 'marcado pelo paciente no WhatsApp'
                                      : 'marcado pela equipe',
                                    // Sem vinculo, o telefone e a unica pista de
                                    // quem vem - e o aviso lembra que falta
                                    // cadastrar para virar prontuario.
                                    ...(item.patientId
                                      ? []
                                      : [
                                          item.contactPhone || 'telefone não informado',
                                          'sem cadastro',
                                        ]),
                                  ].join(' · ')
                                : `sem cadastro · ${item.contactPhone || 'telefone não informado'} · ` +
                                  `vaga reservada até ${
                                    item.holdExpiresAt
                                      ? new Date(item.holdExpiresAt).toLocaleString('pt-BR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '-'
                                  }`}
                            </p>
                          </button>
                          {/* Solicitacao de quem nao tem cadastro: a recepcao
                              precisa aceitar, senao a vaga se libera sozinha. */}
                          {!item.confirmedByClinic && (
                            <button
                              type="button"
                              title="Confirmar solicitação"
                              onClick={() =>
                                void confirmarEAvisar(item.id)
                              }
                              className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-[9px] font-extrabold text-white transition hover:bg-white/25"
                            >
                              Confirmar
                            </button>
                          )}
                          <button
                            type="button"
                            title="Cancelar"
                            onClick={() =>
                              void acao(
                                () => cancelAppointment(item.id),
                                'Consulta cancelada. O horário voltou a ficar livre.',
                              )
                            }
                            className="shrink-0 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {livres.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {livres.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSlotEscolhido(slot)}
                          className="rounded-lg border border-[#081b2c]/10 bg-[#fafaf8] px-2.5 py-1.5 text-[10px] font-bold text-[#081b2c] transition hover:border-[#dc8e5f] hover:bg-white"
                        >
                          {hora(slot)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Horarios de atendimento */}
              <div className="surface-card rounded-[20px] p-4">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
                  <Clock className="h-3.5 w-3.5 text-[#dc8e5f]" />
                  Horários de atendimento
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Em {unidadeAtual?.name}. Pode haver mais de um período no mesmo dia, por exemplo
                  manhã e tarde.
                </p>

                <div className="mt-3 space-y-1.5">
                  {rules.length === 0 && (
                    <p className="text-[11px] text-slate-400">Nenhum período definido ainda.</p>
                  )}
                  {rules.map((regra) => (
                    <div
                      key={regra.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#fafaf8] px-3 py-2"
                    >
                      <span className="text-[11px] font-bold text-[#081b2c]">
                        {WEEKDAY_LABEL[regra.weekday]} · {regra.startsAt} às {regra.endsAt}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void acao(() => deleteAvailabilityRule(regra.id), 'Período removido.')
                        }
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#081b2c]/[0.07] pt-3">
                  <select
                    value={novaRegra.weekday}
                    onChange={(e) => setNovaRegra({ ...novaRegra, weekday: Number(e.target.value) })}
                    className="rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  >
                    {WEEKDAY_LABEL.map((nome, indice) => (
                      <option key={nome} value={indice}>
                        {nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={novaRegra.inicio}
                    onChange={(e) => setNovaRegra({ ...novaRegra, inicio: e.target.value })}
                    className="rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  />
                  <input
                    type="time"
                    value={novaRegra.fim}
                    onChange={(e) => setNovaRegra({ ...novaRegra, fim: e.target.value })}
                    className="rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void acao(async () => {
                        if (!clinicId || !unitId) return
                        if (novaRegra.fim <= novaRegra.inicio) {
                          throw new Error('O fim do período precisa ser depois do início.')
                        }
                        await createAvailabilityRule(
                          clinicId,
                          unitId,
                          novaRegra.weekday,
                          novaRegra.inicio,
                          novaRegra.fim,
                        )
                      }, 'Período adicionado.')
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-[#081b2c] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#102d47]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Datas bloqueadas */}
              <div className="surface-card rounded-[20px] p-4">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
                  <CalendarOff className="h-3.5 w-3.5 text-[#dc8e5f]" />
                  Datas bloqueadas
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Feriado, férias, congresso. O dia some da agenda e deixa de ser oferecido ao
                  paciente.
                </p>

                <div className="mt-3 space-y-1.5">
                  {exceptions.length === 0 && (
                    <p className="text-[11px] text-slate-400">Nenhuma data bloqueada.</p>
                  )}
                  {exceptions.map((excecao) => (
                    <div
                      key={excecao.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#fafaf8] px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-[11px] font-bold text-[#081b2c]">
                        {new Intl.DateTimeFormat('pt-BR').format(
                          new Date(excecao.date + 'T12:00:00'),
                        )}
                        {excecao.reason && (
                          <span className="font-normal text-slate-500"> · {excecao.reason}</span>
                        )}
                        {!excecao.unitId && (
                          <span className="font-normal text-slate-400"> · todas as unidades</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void acao(() => deleteScheduleException(excecao.id), 'Bloqueio removido.')
                        }
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#081b2c]/[0.07] pt-3">
                  <input
                    type="date"
                    value={novoBloqueio.data}
                    onChange={(e) => setNovoBloqueio({ ...novoBloqueio, data: e.target.value })}
                    className="rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  />
                  <input
                    value={novoBloqueio.motivo}
                    onChange={(e) => setNovoBloqueio({ ...novoBloqueio, motivo: e.target.value })}
                    placeholder="Motivo"
                    className="min-w-[120px] flex-1 rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    disabled={!novoBloqueio.data}
                    onClick={() =>
                      void acao(async () => {
                        if (!clinicId) return
                        await createScheduleException(
                          clinicId,
                          novoBloqueio.data,
                          novoBloqueio.motivo,
                          unitId,
                        )
                        setNovoBloqueio({ data: '', motivo: '' })
                      }, 'Data bloqueada.')
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-[#081b2c] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#102d47] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Bloquear
                  </button>
                </div>
              </div>

              {/* Preferencias */}
              <div className="surface-card rounded-[20px] p-4">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
                  <Settings2 className="h-3.5 w-3.5 text-[#dc8e5f]" />
                  Preferências da agenda
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { chave: 'slotMinutes' as const, rotulo: 'Duração (min)', min: 5, max: 240 },
                    { chave: 'horizonDays' as const, rotulo: 'Janela (dias)', min: 1, max: 180 },
                    { chave: 'minNoticeHours' as const, rotulo: 'Antecedência (h)', min: 0, max: 168 },
                  ].map((campo) => (
                    <label key={campo.chave} className="block">
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">
                        {campo.rotulo}
                      </span>
                      <input
                        type="number"
                        min={campo.min}
                        max={campo.max}
                        value={prefs[campo.chave]}
                        onChange={(e) =>
                          setPrefs({ ...prefs, [campo.chave]: Number(e.target.value) })
                        }
                        className="mt-1 w-full rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[#dc8e5f]"
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  A antecedência impede o paciente de marcar para daqui a poucos minutos.
                </p>

                {/* Lembrete de consulta. Fica junto das preferencias porque e
                    salvo no mesmo botao - dois "salvar" no mesmo cartao
                    confundiriam sobre o que cada um grava. */}
                <div className="mt-4 border-t border-[#081b2c]/[0.07] pt-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prefs.reminderEnabled}
                      onChange={(e) => setPrefs({ ...prefs, reminderEnabled: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[#dc8e5f]"
                    />
                    <span className="text-[11px] font-bold text-[#081b2c]">
                      Enviar lembrete de consulta pelo WhatsApp
                    </span>
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      disabled={!prefs.reminderEnabled}
                      value={prefs.reminderDays}
                      onChange={(e) => setPrefs({ ...prefs, reminderDays: Number(e.target.value) })}
                      className="w-16 rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[#dc8e5f] disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    <span className="text-[11px] text-slate-600">
                      {prefs.reminderDays === 0
                        ? 'dias antes — envia na manhã do próprio dia'
                        : prefs.reminderDays === 1
                          ? 'dia antes — envia na véspera'
                          : 'dias antes da consulta'}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    Sai todo dia às 10h. O paciente responde CONFIRMAR ou REAGENDAR; quem pede para
                    remarcar aparece marcado em Respostas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void acao(async () => {
                      if (!clinicId) return
                      await saveSchedulePreferences(clinicId, prefs)
                    }, 'Preferências salvas.')
                  }
                  className="mt-3 rounded-xl bg-[#081b2c] px-4 py-2 text-[10px] font-bold text-white transition hover:bg-[#102d47]"
                >
                  Salvar preferências
                </button>
              </div>

              {/* Unidades */}
              <div className="surface-card rounded-[20px] p-4">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#081b2c]">
                  <Building2 className="h-3.5 w-3.5 text-[#dc8e5f]" />
                  Unidades
                </p>
                <div className="mt-3 space-y-1.5">
                  {units.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#fafaf8] px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-[11px] font-bold text-[#081b2c]">
                        {u.name}
                        {u.address && (
                          <span className="font-normal text-slate-500"> · {u.address}</span>
                        )}
                      </span>
                      {units.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            void acao(async () => {
                              await archiveUnit(u.id)
                              if (unitId === u.id) setUnitId(null)
                            }, 'Unidade arquivada. O histórico foi preservado.')
                          }
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#081b2c]/[0.07] pt-3">
                  <input
                    value={novaUnidade.nome}
                    onChange={(e) => setNovaUnidade({ ...novaUnidade, nome: e.target.value })}
                    placeholder="Nome"
                    className="min-w-[100px] flex-1 rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  />
                  <input
                    value={novaUnidade.endereco}
                    onChange={(e) => setNovaUnidade({ ...novaUnidade, endereco: e.target.value })}
                    placeholder="Endereço"
                    className="min-w-[100px] flex-1 rounded-xl border border-[#081b2c]/10 bg-white px-2 py-1.5 text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    disabled={!novaUnidade.nome.trim()}
                    onClick={() =>
                      void acao(async () => {
                        if (!clinicId) return
                        await createUnit(clinicId, novaUnidade.nome, novaUnidade.endereco)
                        setNovaUnidade({ nome: '', endereco: '' })
                      }, 'Unidade cadastrada.')
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-[#081b2c] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#102d47] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Marcar consulta num horario livre */}
      {slotEscolhido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#081b2c]/40 p-4">
          <div className="w-full max-w-sm rounded-[22px] bg-white p-5 shadow-xl">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#081b2c]">
              <CalendarPlus className="h-4 w-4 text-[#dc8e5f]" />
              Marcar consulta
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {diaLegivel(slotEscolhido)} às {hora(slotEscolhido)} · {unidadeAtual?.name}
            </p>

            <select
              id="paciente-agenda"
              defaultValue=""
              className="mt-4 w-full rounded-xl border border-[#081b2c]/10 bg-[#fafaf8] px-3 py-2 text-xs outline-none focus:border-[#dc8e5f]"
            >
              <option value="">Selecione o paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSlotEscolhido(null)}
                className="rounded-xl bg-[#eef3f2] px-3 py-2 text-[11px] font-bold text-[#557f75]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const select = document.getElementById('paciente-agenda') as HTMLSelectElement
                  const escolhido = select?.value || null
                  const inicio = slotEscolhido
                  setSlotEscolhido(null)
                  void acao(async () => {
                    if (!clinicId || !unitId) return
                    await createAppointment(
                      clinicId,
                      unitId,
                      escolhido,
                      inicio,
                      prefs.slotMinutes,
                    )
                  }, 'Consulta marcada.')
                }}
                className="rounded-xl bg-[#081b2c] px-4 py-2 text-[11px] font-bold text-white transition hover:bg-[#102d47]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={emEdicao !== null} onOpenChange={(aberto) => !aberto && setEmEdicao(null)}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-[#081b2c]/10 bg-[#fbfaf8] p-0 sm:max-w-[520px]"
        >
          {emEdicao && (
            <>
              <SheetHeader className="border-b border-[#081b2c]/[0.07] bg-white px-5 pb-5 pt-6">
                <SheetTitle className="text-left text-lg font-extrabold tracking-[-0.03em] text-[#081b2c]">
                  {diaLegivel(emEdicao.startsAt)}, {hora(emEdicao.startsAt)}
                </SheetTitle>
                <SheetDescription className="mt-1 text-left text-[11px]">
                  {emEdicao.source === 'whatsapp'
                    ? 'Marcada pelo próprio paciente no WhatsApp.'
                    : 'Marcada pela equipe.'}
                  {!emEdicao.confirmedByClinic && ' Ainda aguardando confirmação.'}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 overflow-y-auto px-5 py-5">
                {/* Vincular vem primeiro: e o que falta para a consulta virar
                    prontuario e disparar os acompanhamentos. */}
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Paciente
                  </p>
                  {formConsulta.patientId ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-[14px] border border-[#557f75]/30 bg-[#eef3f2] px-3 py-2.5">
                      <span className="truncate text-[11px] font-bold text-[#2f5a50]">
                        {patients.find((p) => p.id === formConsulta.patientId)?.nome ??
                          'Paciente vinculado'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormConsulta({ ...formConsulta, patientId: '' })}
                        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold text-[#557f75] transition hover:bg-white"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Sem paciente vinculado, esta consulta não entra no prontuário nem gera
                        acompanhamento de 30 e 90 dias.
                      </p>
                      {/* Mesmo telefone: e quase sempre a pessoa certa, entao
                          vem antes da busca e ja destacado. */}
                      {sugeridos.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#557f75]">
                            Mesmo telefone desta consulta
                          </p>
                          <div className="mt-1 space-y-1">
                            {sugeridos.slice(0, MAX_SUGESTOES).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setFormConsulta({ ...formConsulta, patientId: p.id })}
                                className="flex w-full items-center justify-between gap-2 rounded-[12px] border border-[#557f75]/40 bg-[#eef3f2] px-3 py-2 text-left transition hover:border-[#557f75]"
                              >
                                <span className="truncate text-[11px] font-bold text-[#2f5a50]">
                                  {p.nome}
                                </span>
                                <span className="shrink-0 text-[10px] text-[#557f75]">
                                  {p.telefone}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <input
                        value={buscaPaciente}
                        onChange={(e) => setBuscaPaciente(e.target.value)}
                        placeholder="Buscar entre os pacientes cadastrados"
                        className="mt-2 w-full rounded-[12px] border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dc8e5f]"
                      />
                      <div className="mt-2 space-y-1">
                        {encontrados.slice(0, MAX_SUGESTOES).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormConsulta({ ...formConsulta, patientId: p.id })}
                            className="flex w-full items-center justify-between gap-2 rounded-[12px] border border-[#081b2c]/10 bg-white px-3 py-2 text-left transition hover:border-[#dc8e5f]"
                          >
                            <span className="truncate text-[11px] font-bold text-[#081b2c]">
                              {p.nome}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400">{p.telefone}</span>
                          </button>
                        ))}

                        {encontrados.length > MAX_SUGESTOES && (
                          <p className="px-1 text-[10px] text-slate-400">
                            e mais {encontrados.length - MAX_SUGESTOES}. Escreva um pouco mais para afinar
                            a busca.
                          </p>
                        )}

                        {buscaPaciente.trim().length === 0 && (
                          <p className="rounded-[12px] bg-white px-3 py-3 text-center text-[10px] text-slate-400">
                            Digite o nome ou o telefone para procurar entre os{' '}
                            {patients.length} pacientes cadastrados.
                          </p>
                        )}

                        {buscaPaciente.trim().length > 0 && encontrados.length === 0 && (
                          <p className="rounded-[12px] bg-white px-3 py-3 text-center text-[10px] text-slate-400">
                            {buscaPaciente.trim().length < 2
                              ? 'Escreva ao menos duas letras.'
                              : 'Nenhum paciente encontrado com esse nome ou telefone.'}
                          </p>
                        )}
                      </div>
                      {onCadastrarContato && (
                        <button
                          type="button"
                          onClick={() =>
                            onCadastrarContato({
                              nome: formConsulta.contactName,
                              telefone: formConsulta.contactPhone,
                              // A consulta ja sabe quando e onde: repetir isso a
                              // mao e onde nasce divergencia entre agenda e
                              // cadastro.
                              dataConsulta: emEdicao.startsAt.slice(0, 10),
                              unidade: unidadeAtual?.name,
                            })
                          }
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#081b2c]/15 bg-white px-3 py-2.5 text-[10px] font-extrabold text-[#081b2c] transition hover:border-[#dc8e5f] hover:text-[#8a4b1d]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Cadastrar como paciente novo
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Quem marcou
                  </p>
                  <input
                    value={formConsulta.contactName}
                    onChange={(e) =>
                      setFormConsulta({ ...formConsulta, contactName: e.target.value })
                    }
                    placeholder="Nome informado no contato"
                    className="mt-1 w-full rounded-[12px] border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dc8e5f]"
                  />
                  <input
                    value={formConsulta.contactPhone}
                    onChange={(e) =>
                      setFormConsulta({ ...formConsulta, contactPhone: e.target.value })
                    }
                    placeholder="Telefone"
                    className="mt-2 w-full rounded-[12px] border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dc8e5f]"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Observação da equipe
                  </p>
                  <textarea
                    value={formConsulta.staffNote}
                    onChange={(e) =>
                      setFormConsulta({ ...formConsulta, staffNote: e.target.value })
                    }
                    rows={4}
                    placeholder="Recado interno sobre esta consulta"
                    className="mt-1 w-full resize-y rounded-[12px] border border-[#081b2c]/10 bg-white p-3 text-[11px] leading-relaxed outline-none focus:border-[#dc8e5f]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#081b2c]/[0.07] bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => void salvarConsulta()}
                  disabled={salvandoConsulta}
                  className="rounded-xl bg-[#081b2c] px-4 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#102d47] disabled:opacity-40"
                >
                  {salvandoConsulta ? 'Salvando...' : 'Salvar'}
                </button>
                {!emEdicao.confirmedByClinic && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = emEdicao.id
                      setEmEdicao(null)
                      void confirmarEAvisar(id)
                    }}
                    className="rounded-xl bg-[#557f75] px-4 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#456a61]"
                  >
                    Confirmar consulta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const id = emEdicao.id
                    setEmEdicao(null)
                    void acao(
                      () => cancelAppointment(id),
                      'Consulta cancelada. O horário voltou a ficar livre.',
                    ).then(() => onSolicitacoesMudaram?.())
                  }}
                  className="ml-auto rounded-xl px-3 py-2.5 text-[11px] font-extrabold text-red-600 transition hover:bg-red-50"
                >
                  Cancelar consulta
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
