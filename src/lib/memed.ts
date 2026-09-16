import { supabase } from '@/lib/supabase'
import type { Consultation, Patient } from '@/types/patient'

/**
 * Prescricao digital da Memed dentro do prontuario.
 *
 * A Memed nao e um iframe que a gente desenha: e um script que ela carrega na
 * pagina e comanda por eventos. Este arquivo isola essa conversa - o resto do
 * sistema so pede "abrir a prescricao deste paciente" e recebe de volta a
 * receita emitida.
 *
 * Vive fora do React de proposito. O script da Memed e global, carrega uma vez
 * por sessao e sobrevive a qualquer componente; tentar amarrar isso ao ciclo de
 * vida de uma tela produziria dois scripts carregados e eventos duplicados.
 */

const URL_SCRIPT_HOMOLOGACAO =
  'https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js'
// Producao: MESMO caminho da homologacao, so muda o dominio.
//
// Ate 16/09/2026 aqui estava 'https://partners.memed.com.br/integration.js',
// tirado de um guia de boas praticas. Esse arquivo nao existe: no primeiro
// teste com as chaves de producao o script falhou em silencio, e o botao
// "Prescrever" ficou girando para sempre esperando algo que nunca chegava.
// Conferido no ar: este endereco responde 200 com a versao 3.25.0; o outro
// nao responde.
const URL_SCRIPT_PRODUCAO =
  'https://partners.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js'
// Id fixo exigido pela homologacao da Memed: e por ele que se garante que o
// script entrou uma unica vez na pagina.
const ID_SCRIPT = 'memed-prescricao-script'

/** Os objetos que a Memed pendura no window quando o script carrega. */
type MemedGlobal = {
  MdSinapsePrescricao?: {
    event: { add: (nome: string, callback: (dados: unknown) => void) => void }
  }
  MdHub?: {
    command: { send: (modulo: string, comando: string, dados: unknown) => Promise<unknown> }
    module: { show: (modulo: string) => Promise<unknown>; hide?: (modulo: string) => void }
    event: { add: (nome: string, callback: (dados: unknown) => void) => void }
  }
}

function janela() {
  return window as unknown as MemedGlobal
}

export type ReceitaEmitida = {
  id: string
  itens: number
}

type Ouvintes = {
  onReceita?: (dados: unknown) => void
  onExcluida?: (id: string) => void
  onFechar?: () => void
}

let carregando: Promise<void> | null = null
const ouvintes: Ouvintes = {}

/**
 * Carrega o script uma unica vez.
 *
 * A promessa fica guardada para que dois cliques seguidos no botao nao
 * disparem dois carregamentos - o segundo espera o primeiro em vez de criar um
 * script paralelo, que e a origem classica de evento chegando em dobro.
 */
async function carregarScript(token: string, producao: boolean) {
  if (carregando) return carregando
  // Guarda exigida pela Memed: se o script ja esta na pagina (por exemplo,
  // depois de um hot reload), nao entra de novo.
  if (document.getElementById(ID_SCRIPT) && janela().MdHub) return Promise.resolve()

  carregando = new Promise<void>((resolve, reject) => {
    // Guardado fora dos dois fechamentos para o prazo tambem conseguir parar a
    // espera: sem isso, um carregamento que falhou continuaria perguntando pelo
    // MdHub a cada 200ms para sempre.
    let espera = 0
    // Prazo para o script se anunciar.
    //
    // A promessa só termina dentro do evento 'core:moduleInit' da Memed. Se
    // esse evento não vier - script inexistente, rede caída, mudança do lado
    // deles -, o botão gira para sempre e ninguém sabe por quê. Foi o que
    // aconteceu em 16/09/2026, com o endereço errado do script de produção.
    // Vinte segundos é folgado para um arquivo de 19 KB, e transforma um
    // travamento silencioso numa frase que a pessoa lê.
    const prazo = window.setTimeout(() => {
      window.clearInterval(espera)
      carregando = null
      reject(new Error('A Memed não respondeu a tempo. Tente de novo em instantes.'))
    }, 20_000)
    const pronto = () => {
      window.clearTimeout(prazo)
      resolve()
    }
    const falhou = (causa: Error) => {
      window.clearTimeout(prazo)
      window.clearInterval(espera)
      carregando = null
      reject(causa)
    }

    const script = document.createElement('script')
    script.id = ID_SCRIPT
    script.src = producao ? URL_SCRIPT_PRODUCAO : URL_SCRIPT_HOMOLOGACAO
    script.dataset.token = token
    script.async = true

    script.onload = () => {
      const memed = janela()
      if (!memed.MdSinapsePrescricao) {
        falhou(new Error('A Memed carregou mas não se anunciou.'))
        return
      }

      // Fechamento do modulo e evento do MdSinapsePrescricao, nao do MdHub.
      memed.MdSinapsePrescricao.event.add('core:moduleHide', (modulo) => {
        const dados = modulo as { moduleName?: string; name?: string }
        const nome = dados?.moduleName ?? dados?.name
        if (nome && nome !== 'plataforma.prescricao') return
        ouvintes.onFechar?.()
      })

      // Espera o MdHub existir, e nao um evento com um nome especifico.
      //
      // Ate 16/09/2026 a promessa so terminava dentro do evento
      // 'core:moduleInit' quando o modulo se chamasse 'plataforma.prescricao'.
      // Isso funcionava em homologacao e travou no primeiro teste em producao:
      // o console mostrava "Todos os modulos da plataforma foram carregados com
      // sucesso", o MdHub existia, a prescricao abria quando chamada a mao - e
      // o botao girava para sempre, porque o evento nunca casou com a condicao.
      //
      // Perguntar "o MdHub ja existe?" nao depende do nome nem do formato do
      // evento, que sao deles e mudam sem aviso. O que a gente precisa saber e
      // exatamente isso: da para mandar comando.
      //
      // Os ouvintes de receita sao registrados aqui, uma vez so. Registrar a
      // cada abertura acumularia callbacks e salvaria a mesma receita varias
      // vezes.
      espera = window.setInterval(() => {
        const hub = janela().MdHub
        if (!hub) return
        window.clearInterval(espera)

        hub.event.add('prescricaoImpressa', (receita) => ouvintes.onReceita?.(receita))
        hub.event.add('prescricaoExcluida', (dados) => {
          const excluida = dados as { id?: string | number }
          if (excluida?.id !== undefined) ouvintes.onExcluida?.(String(excluida.id))
        })

        pronto()
      }, 200)
    }

    script.onerror = () => {
      falhou(new Error('Não foi possível carregar a prescrição da Memed.'))
    }

    document.body.appendChild(script)
  })

  return carregando
}

/** Busca o token do medico. As chaves da Memed ficam no servidor, nunca aqui. */
async function tokenDoPrescritor() {
  const { data, error } = await supabase.functions.invoke('memed-prescritor', { body: {} })
  if (error) {
    const contexto = (error as { context?: unknown }).context
    if (contexto instanceof Response) {
      try {
        const corpo = await contexto.clone().json()
        if (corpo?.error) throw new Error(String(corpo.error))
      } catch (lido) {
        if (lido instanceof Error && lido.message) throw lido
      }
    }
    throw new Error('Não foi possível conectar à Memed.')
  }
  // O ambiente vem do servidor, que e quem tem as chaves: assim a tela nunca
  // carrega o script de producao com token de homologacao, nem o contrario.
  const resposta = data as {
    token: string
    ambiente?: string
    cadastro?: { feito: boolean; detalhe?: string }
  }
  return { token: resposta.token, producao: resposta.ambiente === 'producao', cadastro: resposta.cadastro }
}

/** Resultado da ultima tentativa de completar o cadastro do medico na Memed. */
export let ultimoCadastro: { feito: boolean; detalhe?: string } | undefined

/**
 * O que a Memed precisa saber sobre o paciente.
 *
 * O CPF vai porque a RDC 1000/25 passou a exigi-lo em toda prescricao, e a data
 * de nascimento pelo mesmo motivo. Sao os dois campos que fazem a emissao ser
 * recusada quando faltam - por isso a checagem acontece antes de abrir a tela,
 * e nao depois de o medico escrever a receita inteira.
 */
export function faltaParaPrescrever(patient: Patient): string[] {
  const falta: string[] = []
  if (!patient.cpf?.trim()) falta.push('CPF')
  if (!patient.nascimento) falta.push('data de nascimento')
  return falta
}

function dataBR(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

const SEXO: Record<string, string> = { F: 'Feminino', M: 'Masculino', O: 'Outro' }

/**
 * Abre a prescricao com o paciente ja preenchido.
 *
 * As alergias vao junto: o campo que o medico ja escreve no prontuario vira
 * alerta na hora de prescrever. E a parte da integracao que deixa de ser
 * conveniencia e vira seguranca.
 */
export type LocalDeAtendimento = {
  nome: string
  endereco?: string
  telefone?: string
}

export async function abrirPrescricao(
  patient: Patient,
  consultation: Consultation | null,
  ouvir: Ouvintes,
  local?: LocalDeAtendimento | null,
) {
  const { token, producao, cadastro } = await tokenDoPrescritor()
  ultimoCadastro = cadastro
  await carregarScript(token, producao)

  ouvintes.onReceita = ouvir.onReceita
  ouvintes.onExcluida = ouvir.onExcluida
  ouvintes.onFechar = ouvir.onFechar

  const hub = janela().MdHub
  if (!hub) throw new Error('A prescrição da Memed não está pronta.')

  // So o VIDaaS na lista de certificadoras: e o certificado que o medico ja
  // usa para assinar o prontuario. Sem isto a Memed oferece sete opcoes e a
  // pessoa tem de saber qual e a sua. O resto fica no padrao da Memed.
  try {
    await hub.command.send('plataforma.prescricao', 'setFeatureToggle', {
      setAllowedSignatureProviders: ['vidaas'],
    })
  } catch {
    // Preferencia de tela: se a Memed recusar, a prescricao segue igual.
  }

  const primeiroNome = patient.nome.trim().split(/\s+/)[0] ?? patient.nome

  // O local de atendimento sai impresso no rodape da receita, e a Memed passou
  // a exigir endereco e telefone do local na identificacao. Vai ANTES do
  // paciente, na ordem que a Memed documenta: depois, o modulo ignorava e a
  // receita saia sem endereco nem telefone. Vai o endereco da
  // unidade cadastrada na Agenda; sem ele o medico teria de digitar a cada
  // receita.
  const nomeDoLocal = local?.nome ?? consultation?.unidade
  if (nomeDoLocal) {
    try {
      await hub.command.send('plataforma.prescricao', 'setWorkplace', {
        id: `central-de-cuidado-${nomeDoLocal}`,
        nome: nomeDoLocal,
        endereco: local?.endereco || undefined,
        telefone: local?.telefone || undefined,
        cidade: nomeDoLocal.split('·').pop()?.trim() || undefined,
        uf: 'SP',
      })
    } catch (causa) {
      // Local e detalhe do rodape: se a Memed recusar, a receita ainda sai.
      // Mas fica registrado, porque "endereco em branco" sem pista custou
      // uma tarde de teste.
      console.warn('[Memed] setWorkplace recusado', causa)
    }
  }

  await hub.command.send('plataforma.prescricao', 'setPaciente', {
    // Prefixo do parceiro, como a Memed pede: o id sozinho colidiria com o
    // de outros sistemas no ambiente compartilhado de homologacao.
    idExterno: `central-de-cuidado-${patient.id}`,
    nome: patient.nome,
    sexo: SEXO[patient.sexo] ?? 'Outro',
    cpf: patient.cpf?.replace(/\D/g, '') || undefined,
    data_nascimento: patient.nascimento ? dataBR(patient.nascimento) : undefined,
    telefone: patient.telefone?.replace(/\D/g, '') || undefined,
    email: patient.email || undefined,
    nome_mae: patient.responsavel || undefined,
    peso: consultation?.peso ? Number(consultation.peso.replace(',', '.')) : undefined,
    altura: consultation?.altura
      ? Number(consultation.altura.replace(',', '.')) / 100
      : undefined,
    cidade: patient.cidade || undefined,
  })

  await hub.module.show('plataforma.prescricao')
  return primeiroNome
}

/** Arquiva no prontuario a receita que a Memed devolveu. */
export async function guardarReceita(
  patientId: string,
  consultationId: string | null,
  receita: unknown,
) {
  const pacote = receita as { prescricao?: Record<string, unknown> }
  const prescricao = pacote?.prescricao ?? (receita as Record<string, unknown>)

  const { error } = await supabase.functions.invoke('memed-receita', {
    body: { patientId, consultationId, prescricao },
  })
  if (error) throw new Error('A receita foi emitida, mas não pôde ser arquivada no prontuário.')
}

export async function marcarReceitaExcluida(memedId: string) {
  await supabase.functions.invoke('memed-receita', { body: { excluir: memedId } })
}
