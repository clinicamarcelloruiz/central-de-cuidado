import { semDadosPessoais } from './assistente.ts'
import { paraEnvio } from './telefone-br.ts'
import { chaveDoWhatsApp } from './whatsapp-teste.ts'

/**
 * Alerta de urgencia no WhatsApp pessoal (17/10/2026).
 *
 * Pedido do Edu: quando o robo ou a IA entendem que uma crianca esta mal, o
 * Dr. Marcello e o Edu recebem uma mensagem no WhatsApp deles, a qualquer hora,
 * inclusive de noite e no fim de semana. Ate aqui a urgencia so acendia a
 * conversa na Central e mandava notificacao para quem tinha o app instalado -
 * de madrugada, ninguem olhando.
 *
 * Os numeros ficam em clinic_settings.alerta_urgencia_telefones, editaveis no
 * cartao "Atendente com IA". O envio e por modelo aprovado (alerta_urgencia):
 * fora da janela de 24 horas a Meta nao aceita texto livre, e o medico quase
 * nunca escreveu para o numero do robo no dia.
 *
 * A familia SEMPRE recebe primeiro a orientacao de pronto-socorro ou 192. O
 * alerta e reforco, nunca a unica protecao: por isso roda depois da resposta,
 * fora do caminho do atendimento, e nada aqui derruba o webhook.
 *
 * Falha nao pode ser silenciosa (o lembrete da vespera ficou tres semanas
 * parado sem um erro em lugar nenhum): todo envio vira nota na conversa, que a
 * equipe ve, e evento alerta_urgencia nos Numeros do WhatsApp. Se nao saiu, a
 * nota diz e manda avisar por telefone.
 */

export const MODELO_DO_ALERTA = 'alerta_urgencia'

// Coluna nova: o resto do clinic_settings e lido em consulta separada.
type Admin = { from: (tabela: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Os numeros do alerta, prontos para a Meta: 55 + DDD + celular. Aceita a
 * lista do banco ou o texto da tela (um por linha, ou separados por virgula).
 * Numero que nao fecha 12 ou 13 digitos fica de fora: melhor um alerta a menos
 * do que um erro da Meta que esconde os outros.
 */
export function numerosDoAlerta(valor: unknown): string[] {
  const brutos = Array.isArray(valor) ? valor.map(String) : String(valor ?? '').split(/[\n,;]+/)
  const vistos = new Set<string>()
  for (const bruto of brutos) {
    const digitos = bruto.replace(/\D/g, '')
    if (digitos.length < 10) continue
    const numero = paraEnvio(digitos)
    if (numero.length === 12 || numero.length === 13) vistos.add(numero)
  }
  return [...vistos]
}

/**
 * Alertar agora? So quando a conversa ENTRA em urgencia. A mae que continua
 * escrevendo na mesma urgencia nao dispara outro alerta a cada mensagem: o
 * medico ja foi avisado e a conversa esta no topo da lista. Urgencia nova,
 * depois de a equipe resolver a anterior, alerta de novo.
 */
export function deveAlertar(e: { atencaoAntes: boolean; motivoAntes: string | null; motivoAgora: string | null }): boolean {
  if (e.motivoAgora !== 'urgencia') return false
  return !(e.atencaoAntes && e.motivoAntes === 'urgencia')
}

/**
 * Parametro de modelo nao pode ter quebra de linha, tabulacao nem quatro
 * espacos seguidos (a Meta recusa o envio inteiro), nem ficar vazio.
 */
function parametro(texto: string, limite: number): string {
  const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (!limpo) return '-'
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo
}

/**
 * Os quatro parametros do modelo: quem, canal, hora e o trecho da mensagem.
 * O trecho sai sem CPF, e-mail e telefone (LGPD): o medico precisa saber o que
 * aconteceu, e o resto esta na Central.
 */
export function parametrosDoAlerta(e: { quem: string; canal: 'WhatsApp' | 'Instagram'; texto: string; agora: Date }): string[] {
  const hora = e.agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  return [parametro(e.quem, 60), e.canal, hora, parametro(semDadosPessoais(e.texto), 300)]
}

export type EnvioDoAlerta = { numero: string; ok: boolean; erro?: string }

const final = (numero: string) => `final ${numero.slice(-4)}`

/**
 * O que fica registrado: o detalhe curto do evento (ate 120 caracteres) e a
 * nota que a equipe le na conversa.
 */
export function descreverEnvio(envios: EnvioDoAlerta[]): { detalhe: string; nota: string; falhou: boolean } {
  const certos = envios.filter((e) => e.ok)
  const errados = envios.filter((e) => !e.ok)
  if (!errados.length) {
    return {
      detalhe: `enviado ${certos.length}/${envios.length}`,
      nota: `🚨 Alerta de urgência enviado no WhatsApp para ${envios.length === 1 ? '1 número' : `${envios.length} números`} (${certos.map((e) => final(e.numero)).join(', ')}).`,
      falhou: false,
    }
  }
  const motivo = errados[0].erro ?? 'sem detalhe'
  const naoAprovado = /132001|template name does not exist|does not exist in/i.test(motivo)
  const explicacao = naoAprovado ? 'o modelo alerta_urgencia ainda não foi aprovado na Meta' : motivo
  return {
    detalhe: `falhou ${errados.length}/${envios.length}: ${motivo}`.slice(0, 120),
    nota:
      `⚠️ O alerta de urgência no WhatsApp NÃO chegou a ${errados.map((e) => final(e.numero)).join(', ')}: ${explicacao}. ` +
      'Avise o Dr. Marcello por telefone.' +
      (certos.length ? ` Chegou a ${certos.map((e) => final(e.numero)).join(', ')}.` : ''),
    falhou: true,
  }
}

async function lerNumeros(admin: Admin, clinicId: string): Promise<string[]> {
  try {
    const { data, error } = await admin.from('clinic_settings').select('alerta_urgencia_telefones').eq('clinic_id', clinicId).maybeSingle()
    if (error) throw error
    return numerosDoAlerta((data as { alerta_urgencia_telefones?: unknown } | null)?.alerta_urgencia_telefones)
  } catch (erro) {
    // Banco sem a coluna (migration nao chegou): nada a enviar, mas grita.
    console.error('Alerta de urgencia: sem clinic_settings.alerta_urgencia_telefones', erro)
    return []
  }
}

export type PedidoDeAlerta = {
  clinicId: string
  canal: 'WhatsApp' | 'Instagram'
  quem: string
  texto: string
  agora: Date
  /** Onde fica a nota: a conversa do WhatsApp ou a do Instagram. */
  conversaWhatsApp?: string
  conversaInstagram?: string
  /** Para o teste da tela: manda mesmo sem conversa. */
  numeros?: string[]
}

/**
 * Manda o alerta para cada numero e registra o resultado. Nunca lanca: quem
 * chama e o webhook, depois de a familia ja ter recebido a resposta.
 */
export async function enviarAlertaDeUrgencia(admin: Admin, p: PedidoDeAlerta, buscar: typeof fetch = fetch): Promise<EnvioDoAlerta[]> {
  try {
    const numeros = p.numeros ?? (await lerNumeros(admin, p.clinicId))
    if (!numeros.length) {
      console.info('Alerta de urgencia: nenhum numero cadastrado nesta clinica')
      return []
    }

    const { data: ajustes, error: erroDosAjustes } = await admin
      .from('clinic_settings')
      .select('whatsapp_phone_number_id,whatsapp_template_language')
      .eq('clinic_id', p.clinicId)
      .maybeSingle()
    if (erroDosAjustes) console.error('Alerta de urgencia: nao li o clinic_settings', erroDosAjustes)
    const numeroDoRobo = (ajustes as { whatsapp_phone_number_id?: string } | null)?.whatsapp_phone_number_id
    const token = chaveDoWhatsApp(numeroDoRobo)
    const versao = (typeof Deno !== 'undefined' ? Deno.env.get('META_GRAPH_VERSION')?.trim() : '') || 'v25.0'
    const parametros = parametrosDoAlerta(p)

    const envios: EnvioDoAlerta[] = []
    for (const numero of numeros) {
      if (!numeroDoRobo || !token) {
        envios.push({ numero, ok: false, erro: 'WhatsApp da clínica sem número ou token no servidor' })
        continue
      }
      try {
        const resposta = await buscar(`https://graph.facebook.com/${versao}/${numeroDoRobo}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: numero,
            type: 'template',
            template: {
              name: MODELO_DO_ALERTA,
              language: { code: (ajustes as { whatsapp_template_language?: string } | null)?.whatsapp_template_language || 'pt_BR' },
              components: [{ type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) }],
            },
          }),
        })
        const corpo = await resposta.json().catch(() => ({}))
        if (resposta.ok) envios.push({ numero, ok: true })
        else {
          const codigo = corpo?.error?.code ? `(#${corpo.error.code}) ` : ''
          envios.push({ numero, ok: false, erro: `${codigo}${corpo?.error?.message ?? `HTTP ${resposta.status}`}` })
        }
      } catch (erro) {
        envios.push({ numero, ok: false, erro: String(erro).slice(0, 200) })
      }
    }

    const { detalhe, nota, falhou } = descreverEnvio(envios)
    if (falhou) console.error('Alerta de urgencia nao saiu para todos', detalhe)

    // Registro: cada parte no seu try, porque perder a nota nao pode custar o
    // evento, e vice-versa.
    if (p.conversaWhatsApp) {
      try {
        const { error } = await admin
          .from('conversation_notes')
          .insert({ clinic_id: p.clinicId, conversation_id: p.conversaWhatsApp, texto: nota })
        if (error) console.error('Alerta de urgencia: nota nao gravada', error)
      } catch (erro) {
        console.error('Alerta de urgencia: nota nao gravada', erro)
      }
      try {
        const { error } = await admin
          .from('whatsapp_bot_events')
          .insert({ clinic_id: p.clinicId, conversation_id: p.conversaWhatsApp, evento: 'alerta_urgencia', detalhe })
        if (error) console.error('Alerta de urgencia: evento nao gravado', error)
      } catch (erro) {
        console.error('Alerta de urgencia: evento nao gravado', erro)
      }
    }
    if (p.conversaInstagram) {
      try {
        const { error } = await admin
          .from('instagram_mensagens')
          .insert({ clinic_id: p.clinicId, conversa_id: p.conversaInstagram, direcao: 'nota', texto: nota, automatica: true })
        if (error) console.error('Alerta de urgencia: nota do Instagram nao gravada', error)
      } catch (erro) {
        console.error('Alerta de urgencia: nota do Instagram nao gravada', erro)
      }
    }
    return envios
  } catch (erro) {
    console.error('Alerta de urgencia: falhou antes de enviar', erro)
    return []
  }
}
