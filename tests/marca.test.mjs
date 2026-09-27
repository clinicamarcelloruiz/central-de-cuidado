// Logo por clinica (27/09/2026). O id da clinica real e o de producao.
import { marcaDaClinica, marcaSemClinicaConhecida } from './marca.build.mjs'

let ok = 0
let falhas = 0
function confere(nome, cond, detalhe) {
  if (cond) ok++
  else {
    falhas++
    console.error('FALHOU:', nome, detalhe ?? '')
  }
}

const REAL = '1ffde840-a905-4300-b4fd-51571fcefdc0'
const TESTE = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9'

confere('clinica real continua com o logo do Dr. Marcello', marcaDaClinica(REAL).nome === 'Dr. Marcello Ruiz')
confere('clinica de teste mostra Central de Cuidado', marcaDaClinica(TESTE).nome === 'Central de Cuidado')
confere('clinica nova entra com a marca do produto', marcaDaClinica('00000000-0000-0000-0000-000000000000').nome === 'Central de Cuidado')
confere('logo do produto nao repete a etiqueta', marcaDaClinica(TESTE).mostraEtiquetaDoProduto === false)
confere('logo do Dr. Marcello mantem a etiqueta', marcaDaClinica(REAL).mostraEtiquetaDoProduto === true)
// Sem window/localStorage (como no node): o login e a impressao ficam no logo de sempre.
confere('sem clinica conhecida, login e impressao ficam no logo de sempre', marcaSemClinicaConhecida(null).nome === 'Dr. Marcello Ruiz')
confere('impressao da clinica de teste sai com Central de Cuidado', marcaSemClinicaConhecida(TESTE).nome === 'Central de Cuidado')

console.log(`Marca: ${ok} verificações passaram.`)
if (falhas) {
  console.error(`FALHAS: ${falhas}`)
  process.exit(1)
}
