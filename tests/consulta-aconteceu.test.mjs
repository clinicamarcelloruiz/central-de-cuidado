// Acompanhamento so para consulta que aconteceu (23/10/2026, caso do Kadu).
// Ver supabase/functions/_shared/consulta-aconteceu.ts.
import { consultaAconteceu, consultasQueNaoAconteceram, diaEmSaoPaulo, temProntuario } from './consulta-aconteceu.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond) => (cond ? ok++ : falhas.push(nome))

const vazia = { chief_complaint: '', clinical_history: null, assessment: '  ', plan: null }
const escrita = { ...vazia, plan: 'Retorno em 30 dias' }

// O Kadu: marcou pelo robo, nao veio, ninguem marcou presenca.
confere('Kadu: consulta vazia e agenda so "marcada" nao manda', !consultaAconteceu(vazia, ['scheduled']))
confere('Cancelou: nao manda', !consultaAconteceu(vazia, ['cancelled']))
confere('Faltou: nao manda', !consultaAconteceu(vazia, ['no_show']))
confere('Cancelou e remarcou no mesmo dia, sem presenca: nao manda', !consultaAconteceu(vazia, ['cancelled', 'scheduled']))
confere('Chegou na agenda: manda', consultaAconteceu(vazia, ['cancelled', 'attended']))
confere('Prontuario escrito: manda, mesmo com a agenda dizendo falta', consultaAconteceu(escrita, ['no_show']))
confere('Ficha cadastrada a mao, sem agenda: manda (uso de antes do robo)', consultaAconteceu(vazia, []))
confere('So espaco nao e prontuario', !temProntuario(vazia) && temProntuario(escrita))

// A agenda guarda em UTC: a consulta das 22h de Santos e 01h do dia seguinte.
confere('Dia no relogio de Sao Paulo', diaEmSaoPaulo('2026-09-24T01:00:00Z') === '2026-09-23')
confere('Kadu 16:40 em Santos', diaEmSaoPaulo('2026-09-23T19:40:00+00:00') === '2026-09-23')

// O conjunto usado pelo envio e pela tela (23/10/2026).
{
  const consultas = [
    { id: 'kadu', clinic_id: 'c1', patient_id: 'p1', consultation_date: '2026-09-23', ...vazia },
    { id: 'veio', clinic_id: 'c1', patient_id: 'p2', consultation_date: '2026-09-23', ...vazia },
    { id: 'escrita', clinic_id: 'c1', patient_id: 'p3', consultation_date: '2026-09-23', ...escrita },
    { id: 'outra-clinica', clinic_id: 'c1', patient_id: 'p4', consultation_date: '2026-09-23', ...vazia },
  ]
  const agenda = [
    { patient_id: 'p1', clinic_id: 'c1', starts_at: '2026-09-23T19:40:00+00:00', status: 'scheduled' },
    { patient_id: 'p2', clinic_id: 'c1', starts_at: '2026-09-23T13:00:00+00:00', status: 'attended' },
    { patient_id: 'p3', clinic_id: 'c1', starts_at: '2026-09-23T13:00:00+00:00', status: 'no_show' },
    // Mesmo paciente em outra clinica nao conta para esta.
    { patient_id: 'p4', clinic_id: 'c2', starts_at: '2026-09-23T13:00:00+00:00', status: 'cancelled' },
    // Outro dia nao conta.
    { patient_id: 'p2', clinic_id: 'c1', starts_at: '2026-09-30T13:00:00+00:00', status: 'cancelled' },
  ]
  const fora = consultasQueNaoAconteceram(consultas, agenda)
  confere('conjunto: so o Kadu fica de fora', fora.size === 1 && fora.has('kadu'))
}

console.log(`consulta aconteceu: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
