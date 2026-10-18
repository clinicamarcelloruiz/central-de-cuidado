// Cadastro automatico a partir da ficha do WhatsApp (_shared/cadastro.ts).
//
// 18/10/2026: sem o nome da crianca na ficha, o cadastro nasce com o nome do
// contato (quase sempre a mae) e marcado, para o prontuario mostrar o aviso
// vermelho de "nome nao confirmado".
import { cadastrarDaFicha } from './cadastro.build.mjs'

let ok = 0
const falhas = []
const confere = (nome, cond, detalhe = '') => (cond ? ok++ : falhas.push(`${nome} ${detalhe}`))

/** Banco falso: ninguem com o telefone; guarda o que foi inserido. */
function bancoFalso({ semColunaNova = false } = {}) {
  const inseridos = []
  const tentativas = []
  const lista = { data: [], error: null }
  const encadeia = () => {
    const c = { eq: () => c, is: () => c, limit: async () => lista }
    return c
  }
  const admin = {
    from(tabela) {
      if (tabela === 'patients') {
        return {
          select: () => encadeia(),
          insert: (linha) => ({
            select: () => ({
              maybeSingle: async () => {
                tentativas.push({ ...linha })
                if (semColunaNova && 'name_from_contact_at' in linha) {
                  return { data: null, error: { code: '42703', message: 'column name_from_contact_at does not exist' } }
                }
                inseridos.push({ ...linha })
                return { data: { id: 'p1', name: linha.name, phone: linha.phone, whatsapp_opt_out_at: null }, error: null }
              },
            }),
          }),
        }
      }
      if (tabela === 'appointments') return { update: () => ({ eq: async () => ({ error: null }) }) }
      throw new Error('tabela nao prevista: ' + tabela)
    },
  }
  return { admin, inseridos, tentativas }
}

const consulta = (extra = {}) => ({
  id: 'c1',
  starts_at: '2026-10-21T17:00:00Z',
  contact_name: 'Marina Souza',
  contact_phone: '5513999999999',
  intake_patient_name: '',
  intake_birth_date: '03/02/2020',
  clinic_units: { name: 'Livance · Santos' },
  ...extra,
})

{
  const b = bancoFalso()
  const criado = await cadastrarDaFicha(b.admin, 'clinica', consulta())
  const linha = b.inseridos[0] ?? {}
  confere('sem nome na ficha: cadastro criado com o nome do contato', criado?.name === 'Marina Souza', JSON.stringify(criado))
  confere('sem nome na ficha: marcado como nome do contato', Boolean(linha.name_from_contact_at), JSON.stringify(linha))
  confere('sem nome na ficha: aviso tambem nas observacoes', /do contato do WhatsApp/.test(String(linha.notes)), String(linha.notes))
}
{
  const b = bancoFalso()
  await cadastrarDaFicha(b.admin, 'clinica', consulta({ intake_patient_name: 'Helena Souza Lima' }))
  const linha = b.inseridos[0] ?? {}
  confere('nome na ficha: sem a marca', linha.name === 'Helena Souza Lima' && !('name_from_contact_at' in linha), JSON.stringify(linha))
}
{
  // Banco ainda sem a coluna (a funcao sobe antes da migration): o cadastro
  // nasce do mesmo jeito, so sem a marca.
  const b = bancoFalso({ semColunaNova: true })
  const criado = await cadastrarDaFicha(b.admin, 'clinica', consulta())
  confere('sem a coluna nova: cadastro criado mesmo assim', criado?.id === 'p1' && b.tentativas.length === 2, JSON.stringify({ criado, n: b.tentativas.length }))
}

console.log(`cadastro: ${ok} verificacoes ok`)
if (falhas.length) {
  for (const f of falhas) console.log('✗ ' + f)
  process.exit(1)
}
