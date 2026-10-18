// Painel de pacientes simulados COM a IA no circuito (17/10/2026).
//
// O conversar.mjs de 14/10 conversa so com o robo de regras. Desde 15/10 o
// texto livre da familia passa primeiro pelo atendente com IA (Claude), entao
// um painel so com o robo testaria um caminho que quase ninguem usa. Aqui a
// mensagem passa pelo mesmo caminho do meta-webhook: o que fica com o robo
// (urgencia, sinal de alarme, anexo, equipe conversando) vai ao robo; o resto,
// a IA, que abre os fluxos do robo e chama a equipe.
//
// A IA nao e deterministica, e refazer a conversa inteira a cada mensagem
// gastaria de novo e daria outra resposta. Por isso cada resposta da IA fica
// num cache ao lado da conversa (<conversa>.ia.json): a reprise usa o cache, e
// so a mensagem nova chama a API. Apague o .ia.json para recomecar do zero.
//
// Clinica: o robo real do Dr. Marcello no banco falso do simulador, com a
// agenda REAL de 17/10/2026 (Santos qua 14:00-18:40 e sex 08:00-12:00; Sao
// Paulo seg 15:00-20:00 e sab 14:30-17:00; telemedicina com agenda propria seg
// 18:00-20:00; consultas de 40 min, janela de 45 dias, 2 h de antecedencia) e o
// texto do consultorio que a IA usa em producao.
//
// Uso:
//   1. Empacotar (uma vez, ou depois de mudar o robo):
//      npx esbuild tests/painel/motor-com-ia.ts --bundle --format=esm --outfile=tests/painel/motor-com-ia.build.mjs
//   2. node tests/painel/conversar-ia.mjs <conversa.json>
// A chave vem de tests/painel/.env (ANTHROPIC_API_KEY=...), que o git ignora.
//
// O arquivo da conversa:
//   { "familia": "nova" | "cadastrada" | "irmaos" | "com_consulta",
//     "inicio": "2026-10-19T13:00:00Z",
//     "mensagens": [ "Oi", { "toque": "titulo ou id da opcao" }, { "anexo": true },
//                    { "equipe": "texto da secretaria" }, { "espera_min": 90 } ] }
// Mensagem pode ser texto puro ou { "texto": "..." }. 45 s entre mensagens.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const [arquivo] = process.argv.slice(2)
if (!arquivo) {
  console.error('Uso: node tests/painel/conversar-ia.mjs <conversa.json>')
  process.exit(2)
}
const roteiro = JSON.parse(readFileSync(arquivo, 'utf8'))

const env = existsSync(path.join(aqui, '.env')) ? readFileSync(path.join(aqui, '.env'), 'utf8') : ''
const chave = (env.match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1] ?? '').trim()
if (!chave.startsWith('sk-ant-')) {
  console.error('Sem a chave da Anthropic em tests/painel/.env (ANTHROPIC_API_KEY=...).')
  process.exit(2)
}

// O robo avisa muita coisa no console; o painel so quer a conversa.
const avisos = []
console.warn = (...a) => avisos.push(a.map(String).join(' '))
console.info = () => undefined

const M = await import('./motor-com-ia.build.mjs')
const { Simulacao, IDENTIDADES, FAMILIAS } = M

// O texto que a IA usa sobre o consultorio: o mesmo que a migration de 16/10
// gravou na clinica real (conferido em producao em 17/10/2026: 1391 caracteres).
const migration = readFileSync(path.join(aqui, '../../supabase/migrations/20261016090000_conhecimento_do_atendente_ia.sql'), 'utf8')
const conhecimento = migration.match(/\$texto\$([\s\S]*?)\$texto\$/)?.[1] ?? ''

const base = IDENTIDADES.marcello
const [santos, saoPaulo] = base.agendaPadrao.unidades
const p = (id, weekday, inicio, fim) => ({ id, weekday, inicio, fim })
const agendaReal = {
  ...base.agendaPadrao,
  unidades: [
    { ...santos, valor: 45000, periodos: [p('santos-qua', 3, '14:00', '18:40'), p('santos-sex', 5, '08:00', '12:00')] },
    { ...saoPaulo, valor: 60000, periodos: [p('sp-seg', 1, '15:00', '20:00'), p('sp-sab', 6, '14:30', '17:00')] },
    {
      id: 'unidade-telemedicina',
      nome: 'Telemedicina',
      endereco: '',
      informacoes: '',
      convenio: '',
      telemedicina: true,
      valor: null,
      periodos: [p('tele-seg', 1, '18:00', '20:00')],
    },
  ],
  preferencias: { duracao: 40, janela: 45, antecedencia: 2 },
  telemedicinaAtiva: true,
  telemedicinaValor: 45000,
}

const familia = FAMILIAS[roteiro.familia ?? 'nova']
if (!familia) {
  console.error(`familia desconhecida: ${roteiro.familia}`)
  process.exit(2)
}

// ---- cache das respostas da IA --------------------------------------------
const arquivoDoCache = arquivo.replace(/\.json$/i, '') + '.ia.json'
const cache = existsSync(arquivoDoCache) ? JSON.parse(readFileSync(arquivoDoCache, 'utf8')) : []
let indice = 0
let chamadasNovas = 0
const api = M.claudePelaApi(chave)
const chamar = async (corpo, limiteMs) => {
  const i = indice++
  if (i < cache.length) {
    if (cache[i].erro) throw new Error(cache[i].erro)
    return cache[i]
  }
  chamadasNovas++
  try {
    const r = await api(corpo, limiteMs)
    cache.push({ content: r.content })
    writeFileSync(arquivoDoCache, JSON.stringify(cache))
    return r
  } catch (erro) {
    // Falha (inclusive passar dos 12 s de producao) entra no cache: na reprise
    // a IA falha no mesmo lugar e o robo responde, como no WhatsApp.
    cache.push({ erro: String(erro?.message ?? erro).slice(0, 200) })
    writeFileSync(arquivoDoCache, JSON.stringify(cache))
    throw erro
  }
}

// ---- o atendimento, na ordem do meta-webhook --------------------------------
let agora = new Date(roteiro.inicio ?? '2026-10-19T13:00:00Z')
let ultimoDesfecho = null
const quemAtende = 'o Dr. Marcello'

const atender = async (op, sim) => {
  const situacao = await M.montarSituacao(sim.banco, {
    clinicId: op.clinicId,
    conversationId: op.conversationId,
    texto: op.texto,
    anexo: op.anexo,
    etapa: op.estadoAtual,
    criancas: op.pacientes.map((x) => String(x.name ?? '').split(/\s+/)[0]).filter(Boolean),
    consultas: op.consultas,
    quemAtende,
    agora,
    equipeConversando: !op.podeIniciarMenu,
    urgenciaAberta: Boolean(sim.conversa.needs_attention && sim.conversa.attention_reason === 'urgencia'),
  })
  const ferramentas = {
    robo: (texto, etapa) => {
      if (etapa === 'atual') {
        const c = sim.conversa
        return M.tratarConversa({
          ...op,
          texto,
          estadoAtual: c.booking_state ?? null,
          opcoesAtuais: c.booking_options ?? null,
          unidadeEmAndamento: c.booking_unit_id ?? null,
          pacienteEmAndamento: c.booking_patient_id ?? null,
          consultaASubstituir: c.booking_replaces_id ?? null,
          consultaEmCadastro: c.booking_intake_id ?? null,
          modalidadeEmAndamento: c.booking_modality ?? null,
          convenioEmAndamento: c.booking_insurance ?? null,
          podeIniciarMenu: true,
          jaViuOMenu: true,
          anexo: false,
        })
      }
      return M.tratarConversa({
        ...op,
        texto,
        estadoAtual: etapa === 'mesma' ? op.estadoAtual : etapa === 'menu' ? 'menu' : null,
        opcoesAtuais: etapa === 'mesma' ? op.opcoesAtuais : null,
        podeIniciarMenu: true,
        jaViuOMenu: true,
        anexo: false,
      })
    },
    horarios: (unidade) => M.horariosEmTexto(sim.banco, op.clinicId, unidade),
    equipe: (motivo, texto, o) => M.entregarParaEquipe(sim.banco, op.conversationId, motivo, texto, o?.manterEtapa),
    etapa: async () => sim.conversa.booking_state ?? null,
  }
  ultimoDesfecho = await M.atenderComAssistente({
    modo: 'ligado',
    situacao,
    ferramentas,
    chamar,
    roboDireto: () => M.tratarConversa(op),
    roboNaoEntendeuAgora: () => false,
  })
  if (ultimoDesfecho.nota) {
    sim.banco.linhas('conversation_notes').push({ conversation_id: op.conversationId, texto: ultimoDesfecho.nota, created_at: agora.toISOString() })
  }
  return ultimoDesfecho.resultado
}

const s = new Simulacao(base, familia, { agenda: agendaReal, relogio: () => agora, atender })
for (const linha of s.banco.linhas('clinic_settings')) linha.assistente_ia_conhecimento = conhecimento

// ---- a conversa ------------------------------------------------------------
const hora = (d) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const recuo = (t, n = 6) => t.split('\n').map((l) => ' '.repeat(n) + l).join('\n')

console.log(`Clínica: Dr. Marcello Ruiz (agenda real de 17/10) · Família: ${familia.rotulo} (${familia.descricao})`)
console.log(`Atendente: IA (${M.MODELO_PADRAO}) + robô de regras, como no WhatsApp`)
if (s.consultas().length) console.log(`Consultas já marcadas: ${s.consultas().map((c) => `${hora(new Date(c.starts_at))} ${c.unidade}`).join('; ')}`)
console.log('')

let ultimosToques = null
let n = 0
const alertas = []
for (const bruto of roteiro.mensagens ?? []) {
  const passo = typeof bruto === 'string' ? { texto: bruto } : bruto
  if (passo.espera_min) {
    agora = new Date(agora.getTime() + passo.espera_min * 60000)
    console.log(`  … ${passo.espera_min} min depois …\n`)
    continue
  }
  n += 1
  if (passo.equipe) {
    s.responderComoEquipe(passo.equipe)
    console.log(`[${n}] EQUIPE (${hora(agora)}): ${passo.equipe}\n`)
    agora = new Date(agora.getTime() + 45000)
    continue
  }
  let texto = passo.texto ?? ''
  let idDoToque
  if (passo.toque !== undefined) {
    const pedido = String(passo.toque)
    const opcao = ultimosToques?.opcoes.find((o) => o.id === pedido || o.titulo === pedido)
    if (!opcao) console.log(`  (aviso: a opção "${pedido}" não existe na última lista/botões; vai como texto)`)
    idDoToque = opcao?.id
    texto = opcao?.titulo ?? pedido
  }
  const motivoAntes = s.motivo
  ultimoDesfecho = null
  const r = await s.enviarDaFamilia({ texto, idDoToque, anexo: Boolean(passo.anexo) })
  const quem = ultimoDesfecho ? (ultimoDesfecho.origem === 'ia' ? 'IA' : 'ROBÔ') : 'ROBÔ'
  console.log(`[${n}] FAMÍLIA (${hora(agora)}): ${passo.anexo ? '📷 [foto/arquivo] ' : ''}${idDoToque ? `[tocou] ${texto}` : texto}`)
  if (r.respostas.length === 0) console.log(`    ${quem}: (silêncio)`)
  for (const m of r.respostas) {
    console.log(`    ${quem}:\n${recuo(m.texto)}`)
    if (m.toques) {
      ultimosToques = m.toques
      console.log(`      [${m.toques.tipo === 'lista' ? `lista "${m.toques.rotulo}"` : 'botões'}: ${m.toques.opcoes.map((o) => `${o.titulo} (id ${o.id})`).join(' | ')}]`)
    }
  }
  const eventos = (ultimoDesfecho?.eventos ?? []).map((e) => `${e.evento}${e.detalhe ? `: ${e.detalhe}` : ''}`)
  if (eventos.length) console.log(`      (eventos: ${eventos.join('; ')})`)
  if (ultimoDesfecho?.nota) console.log(`      (nota interna para a equipe: ${ultimoDesfecho.nota.replace(/\n+/g, ' ').slice(0, 300)})`)
  const sinal = M.sinalDeAlarme(texto)
  if (sinal) console.log(`      (sinal de alarme reconhecido pela regra: ${sinal.nome}, nível ${sinal.risco === 'vida' ? 'risco de vida' : 'urgente'})`)
  // O alerta no WhatsApp do medico sai quando a conversa ENTRA em urgencia (deveAlertar).
  if (s.motivo === 'urgencia' && motivoAntes !== 'urgencia') {
    alertas.push(n)
    console.log('      🚨 ALERTA DE URGÊNCIA disparado para o WhatsApp do Dr. Marcello')
  }
  console.log('')
  agora = new Date(agora.getTime() + 45000)
}

// ---- estado no fim (o que o juiz confere) -----------------------------------
const c = s.conversa
console.log('================ ESTADO NO FIM ================')
console.log(`Etapa do robô: ${c.booking_state ?? '(nenhuma)'}`)
console.log(`Etiqueta para a equipe: ${s.motivo ?? '(nenhuma)'}${c.status === 'resolved' ? ' · conversa concluída' : ''}`)
console.log(`Alerta de urgência ao médico: ${alertas.length ? `sim, na mensagem ${alertas.join(', ')}` : 'não'}`)
const consultas = s.consultas()
console.log(`Consultas deste telefone: ${consultas.length ? '' : 'nenhuma'}`)
for (const x of consultas) {
  console.log(`  - ${hora(new Date(x.starts_at))} · ${x.unidade} · ${x.modality ?? 'presencial'} · ${x.status} · contato ${x.contact_name ?? '-'}${x.patient_id ? ` · paciente ${x.patient_id}` : ''}${x.chief_complaint ? ` · queixa: ${x.chief_complaint}` : ''}`)
}
const pacientes = s.pacientes()
console.log(`Pacientes cadastrados neste telefone: ${pacientes.length ? '' : 'nenhum'}`)
for (const x of pacientes) console.log(`  - ${x.name} · nascimento ${x.birth_date ?? '-'} · responsável ${x.guardian_name ?? '-'} · CPF ${x.cpf ?? '-'} · e-mail ${x.email ?? '-'}`)
const notas = s.banco.linhas('conversation_notes')
if (notas.length) console.log(`Notas internas: ${notas.length}`)
console.log(`IA: ${indice} chamada(s) nesta conversa, ${chamadasNovas} nova(s) agora (as outras vieram do cache).`)
