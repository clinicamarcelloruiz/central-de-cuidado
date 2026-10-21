// Etiqueta "Sem telefone" da Agenda (21/10/2026): a mesma regra do lembrete.
// Dados inventados: o repositorio e publico.
import { telefoneDoLembrete } from './telefone-do-lembrete.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

const pacientes = [
  { id: 'p1', telefone: '(13) 91234-5678' },
  { id: 'p2', telefone: '' },
]

// Real 21/10: o robo criou o cadastro depois de a Agenda abrir; o paciente nao
// estava na lista e a etiqueta dizia "Sem telefone" para quem marcou pelo WhatsApp.
confere('paciente fora da lista da tela: vale o telefone de quem marcou',
  telefoneDoLembrete({ patientId: 'novo', contactPhone: '5513998765432' }, pacientes) === '5513998765432')
confere('cadastro com telefone: vale o do cadastro',
  telefoneDoLembrete({ patientId: 'p1', contactPhone: '5513998765432' }, pacientes) === '(13) 91234-5678')
confere('cadastro sem telefone: vale o de quem marcou, como no lembrete',
  telefoneDoLembrete({ patientId: 'p2', contactPhone: '5513998765432' }, pacientes) === '5513998765432')
confere('sem paciente: o de quem marcou', telefoneDoLembrete({ patientId: null, contactPhone: ' 5513998765432 ' }, pacientes) === '5513998765432')
confere('sem nenhum telefone: vazio (a etiqueta aparece)', telefoneDoLembrete({ patientId: 'p2', contactPhone: '' }, pacientes) === '')
confere('contato nulo nao quebra', telefoneDoLembrete({ patientId: null, contactPhone: null }, pacientes) === '')

console.log(`telefone do lembrete: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
