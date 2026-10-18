import { semDadosPessoais } from './assistente.ts'
import { montarConteudo } from './conteudo.ts'
import { textoDoModelo } from './modelos.ts'
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
// Com os botoes de resposta (17/10/2026, ver resposta-ao-alerta.ts). Enquanto a
// Meta nao aprova, o envio cai sozinho no modelo sem botoes.
export const MODELO_COM_BOTOES = 'alerta_urgencia_v2'

/**
 * Pedido que nao e urgencia, nos mesmos celulares (18/10/2026).
 *
 * Pedido do Edu: "quando for algo que precisa ele ou eu, ja pode ir para o
 * wpp, pq nao vamos estar com secretaria agora". Os casos sao os mesmos que
 * ja tocavam o app (aviso-da-equipe.ts), menos a urgencia, que tem o alerta
 * proprio. A resposta volta para a familia pelo mesmo caminho do alerta
 * (resposta-ao-alerta.ts): texto em cima da mensagem, ou o botao "Eu respondo".
 */
export const MODELO_DO_PEDIDO = 'pedido_equipe'
export const MOTIVOS_QUE_ENCAMINHAM = ['atendente', 'documento', 'farmacia', 'nao_suportada'] as const
export type TipoDoAviso = 'urgencia' | 'pedido'

/**
 * Encaminhar agora? 'novo' quando a conversa entra na fila (ou troca de
 * pedido); 'seguimento' quando ela ja estava na fila e a familia escreveu de
 * novo. O seguimento so sai se nao houver encaminhamento sem resposta nas
 * ultimas 6 horas (ver pedidoEmAberto): assim o medico recebe a mensagem
 * seguinte depois de responder, e nao uma por mensagem enquanto nao olhou.
 */
export function deveEncaminhar(e: { atencaoAntes: boolean; motivoAntes: string | null; motivoAgora: string | null }): 'novo' | 'seguimento' | null {
  if (!e.motivoAgora || !(MOTIVOS_QUE_ENCAMINHAM as readonly string[]).includes(e.motivoAgora)) return null
  return e.atencaoAntes && e.motivoAntes === e.motivoAgora ? 'seguimento' : 'novo'
}

/**
 * O assunto, numa linha. O motivo que a IA deu ao chamar a equipe diz mais do
 * que a etiqueta da conversa ("pergunta para o Dr." e nao "quer falar com a
 * equipe"), entao vem primeiro.
 */
export function assuntoDoPedido(motivo: string | null, motivoDaIA: string | null, quemAtende = 'o médico'): string {
  const daIA: Record<string, string> = {
    medico: `pergunta para ${quemAtende}`,
    documento: 'receita ou pedido de exame',
    financeiro: 'valores ou pagamento',
    excecao: 'pedido fora do padrão',
    sem_informacao: 'pergunta que o robô não soube responder',
    pessoa: 'quer falar com alguém da equipe',
  }
  const doRobo: Record<string, string> = {
    atendente: 'quer falar com a equipe',
    documento: '2ª via de receita ou pedido de exame',
    farmacia: 'farmácia pediu correção de receita',
    nao_suportada: 'tentou falar com a clínica (talvez uma ligação)',
  }
  return (motivoDaIA && daIA[motivoDaIA]) || (motivo && doRobo[motivo]) || 'pedido para a equipe'
}

export type Veredito = 'urgente' | 'aguardar' | 'responde'

/** Os botoes do modelo, na ordem cadastrada na Meta. */
export const BOTOES_DO_ALERTA: { veredito: Veredito; titulo: string }[] = [
  { veredito: 'urgente', titulo: 'É urgente' },
  { veredito: 'aguardar', titulo: 'Pode aguardar' },
  { veredito: 'responde', titulo: 'Eu respondo' },
]

/** O que volta no webhook quando o medico toca: qual alerta e qual botao. */
export const payloadDoVeredito = (alertaId: string, veredito: Veredito) => `URG:${alertaId}:${veredito}`

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
export function deveAlertar(e: { atencaoAntes: boolean; motivoAntes: string | null; motivoAgora: string | null; piora?: boolean }): boolean {
  if (e.motivoAgora !== 'urgencia') return false
  // Piora contada na mesma urgencia avisa de novo (17/10/2026, rodada 6 do
  // painel): "ela piorou, ta gritando de dor" as 3h nao gerava alerta nenhum.
  if (e.piora) return true
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

/** Os cinco do pedido: os quatro do alerta, com o assunto antes do trecho. */
export function parametrosDoPedido(e: { quem: string; canal: 'WhatsApp' | 'Instagram'; texto: string; agora: Date; assunto?: string }): string[] {
  const [quem, canal, hora, trecho] = parametrosDoAlerta(e)
  return [quem, canal, hora, parametro(e.assunto ?? 'pedido para a equipe', 80), trecho]
}

export type EnvioDoAlerta = { numero: string; ok: boolean; erro?: string }

const final = (numero: string) => `final ${numero.slice(-4)}`

/**
 * O que fica registrado: o detalhe curto do evento (ate 120 caracteres) e a
 * nota que a equipe le na conversa.
 */
export function descreverEnvio(envios: EnvioDoAlerta[], tipo: TipoDoAviso = 'urgencia'): { detalhe: string; nota: string; falhou: boolean } {
  const certos = envios.filter((e) => e.ok)
  const errados = envios.filter((e) => !e.ok)
  const pedido = tipo === 'pedido'
  if (!errados.length) {
    const quantos = envios.length === 1 ? '1 número' : `${envios.length} números`
    const finais = certos.map((e) => final(e.numero)).join(', ')
    return {
      detalhe: `enviado ${certos.length}/${envios.length}`,
      nota: pedido
        ? `📲 Pedido encaminhado no WhatsApp para ${quantos} (${finais}). A resposta de lá volta para a família.`
        : `🚨 Alerta de urgência enviado no WhatsApp para ${quantos} (${finais}).`,
      falhou: false,
    }
  }
  const motivo = errados[0].erro ?? 'sem detalhe'
  const naoAprovado = /132001|template name does not exist|does not exist in/i.test(motivo)
  // Pedido que nao e urgencia: a fila da Central continua sendo o caminho, e
  // nao precisa de telefonema.
  const explicacao = naoAprovado ? `o modelo ${pedido ? MODELO_DO_PEDIDO : 'alerta_urgencia'} ainda não foi aprovado na Meta` : motivo
  return {
    detalhe: `falhou ${errados.length}/${envios.length}: ${motivo}`.slice(0, 120),
    nota:
      `⚠️ ${pedido ? 'O encaminhamento' : 'O alerta de urgência'} no WhatsApp NÃO chegou a ${errados.map((e) => final(e.numero)).join(', ')}: ${explicacao}. ` +
      (pedido ? 'Responda a família por aqui.' : 'Avise o Dr. Marcello por telefone.') +
      (certos.length ? ` Chegou a ${certos.map((e) => final(e.numero)).join(', ')}.` : ''),
    falhou: true,
  }
}

export async function lerNumeros(admin: Admin, clinicId: string): Promise<string[]> {
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

/** 132001: modelo inexistente ou ainda nao aprovado nesse idioma. */
function modeloInexistente(corpo: { error?: { code?: number; message?: string } } | null): boolean {
  return corpo?.error?.code === 132001 || /template name does not exist|does not exist in/i.test(String(corpo?.error?.message ?? ''))
}

async function registrarAlerta(admin: Admin, p: PedidoDeAlerta): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('alertas_de_urgencia')
      .insert({
        clinic_id: p.clinicId,
        canal: p.canal,
        conversa_whatsapp: p.conversaWhatsApp ?? null,
        conversa_instagram: p.conversaInstagram ?? null,
        teste: !p.conversaWhatsApp && !p.conversaInstagram,
        quem: String(p.quem ?? '').slice(0, 120),
      })
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  } catch (erro) {
    console.error('Alerta de urgencia: nao registrei o alerta; vai sem botoes de resposta', erro)
    return null
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
  /** 'pedido' (18/10/2026): o que nao e urgencia, pelo modelo pedido_equipe. */
  tipo?: TipoDoAviso
  /** A linha "Assunto" do pedido (ver assuntoDoPedido). */
  assunto?: string
  /** Mensagem seguinte na mesma fila: so sai se nao houver pedido sem resposta. */
  seguimento?: boolean
}

const JANELA_DO_PEDIDO_MS = 6 * 3600 * 1000

/**
 * Ha encaminhamento (ou alerta) desta conversa sem resposta nas ultimas 6
 * horas? Na duvida (tabela fora, erro), diz que sim: o seguimento e so o
 * reforco, e o erro de leitura viraria uma mensagem por mensagem da familia.
 */
export async function pedidoEmAberto(admin: Admin, p: Pick<PedidoDeAlerta, 'clinicId' | 'conversaWhatsApp' | 'conversaInstagram' | 'agora'>): Promise<boolean> {
  try {
    const coluna = p.conversaWhatsApp ? 'conversa_whatsapp' : 'conversa_instagram'
    const conversa = p.conversaWhatsApp ?? p.conversaInstagram
    if (!conversa) return true
    const { data, error } = await admin
      .from('alertas_de_urgencia')
      .select('id')
      .eq('clinic_id', p.clinicId)
      .eq(coluna, conversa)
      .is('veredito', null)
      .gte('criado_em', new Date(p.agora.getTime() - JANELA_DO_PEDIDO_MS).toISOString())
      .limit(1)
    if (error) throw error
    return Boolean(data?.length)
  } catch (erro) {
    console.error('Encaminhamento: nao li alertas_de_urgencia; seguimento nao vai', erro)
    return true
  }
}

/**
 * Manda o alerta para cada numero e registra o resultado. Nunca lanca: quem
 * chama e o webhook, depois de a familia ja ter recebido a resposta.
 */
export async function enviarAlertaDeUrgencia(admin: Admin, p: PedidoDeAlerta, buscar: typeof fetch = fetch): Promise<EnvioDoAlerta[]> {
  try {
    const pedido = p.tipo === 'pedido'
    const numeros = p.numeros ?? (await lerNumeros(admin, p.clinicId))
    if (!numeros.length) {
      console.info('Alerta de urgencia: nenhum numero cadastrado nesta clinica')
      return []
    }
    if (pedido && p.seguimento && (await pedidoEmAberto(admin, p))) return []

    const { data: ajustes, error: erroDosAjustes } = await admin
      .from('clinic_settings')
      .select('whatsapp_phone_number_id,whatsapp_template_language')
      .eq('clinic_id', p.clinicId)
      .maybeSingle()
    if (erroDosAjustes) console.error('Alerta de urgencia: nao li o clinic_settings', erroDosAjustes)
    const numeroDoRobo = (ajustes as { whatsapp_phone_number_id?: string } | null)?.whatsapp_phone_number_id
    const token = chaveDoWhatsApp(numeroDoRobo)
    const versao = (typeof Deno !== 'undefined' ? Deno.env.get('META_GRAPH_VERSION')?.trim() : '') || 'v25.0'
    const idioma = (ajustes as { whatsapp_template_language?: string } | null)?.whatsapp_template_language || 'pt_BR'
    const parametros = pedido ? parametrosDoPedido(p) : parametrosDoAlerta(p)
    const corpoDoModelo = { type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) }

    // O alerta fica registrado antes de sair: e o id dele que vai nos botoes.
    // Sem a tabela (migration nao chegou), sai sem botoes, como antes.
    const alertaId = await registrarAlerta(admin, p)
    // Com botoes so quando ha alerta registrado; se a Meta disser que o modelo
    // com botoes nao existe (ainda em analise), o resto vai pelo sem botoes.
    // No pedido, "com botoes" e o modelo; sem ele, o texto (ver textoDoPedido).
    let comBotoes = pedido || Boolean(alertaId)

    const envios: EnvioDoAlerta[] = []
    const mensagens: string[] = []
    for (const numero of numeros) {
      if (!numeroDoRobo || !token) {
        envios.push({ numero, ok: false, erro: 'WhatsApp da clínica sem número ou token no servidor' })
        continue
      }
      // O pedido sem o modelo aprovado vai como texto, com o mesmo botao: chega
      // a quem escreveu para o numero da clinica nas ultimas 24 horas (o medico
      // que acabou de responder um alerta, o Edu testando). Fora disso, a Meta
      // recusa e a nota diz que nao chegou.
      const textoDoPedido = () =>
        montarConteudo(
          // Sem a linha "[Eu respondo]" do registro: o botao vai de verdade.
          (textoDoModelo(MODELO_DO_PEDIDO, parametros) ?? parametros.join(' · ')).replace(/\n\[[^\]\n]*\]$/, ''),
          alertaId ? { botoes: [{ id: payloadDoVeredito(alertaId, 'responde'), titulo: 'Eu respondo' }] } : undefined,
        )
      const doPedido = () => ({
        type: 'template',
        template: {
          name: MODELO_DO_PEDIDO,
          language: { code: idioma },
          components: [
            corpoDoModelo,
            ...(alertaId
              ? [{ type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: payloadDoVeredito(alertaId, 'responde') }] }]
              : []),
          ],
        },
      })
      const doAlerta = (botoes: boolean) => ({
        type: 'template',
        template: botoes
          ? {
              name: MODELO_COM_BOTOES,
              language: { code: idioma },
              components: [
                corpoDoModelo,
                ...BOTOES_DO_ALERTA.map((b, i) => ({
                  type: 'button',
                  sub_type: 'quick_reply',
                  index: String(i),
                  parameters: [{ type: 'payload', payload: payloadDoVeredito(alertaId!, b.veredito) }],
                })),
              ],
            }
          : { name: MODELO_DO_ALERTA, language: { code: idioma }, components: [corpoDoModelo] },
      })
      const enviar = async (botoes: boolean) => {
        const resposta = await buscar(`https://graph.facebook.com/${versao}/${numeroDoRobo}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: numero,
            ...(pedido ? (botoes ? doPedido() : textoDoPedido()) : doAlerta(botoes)),
          }),
        })
        return { ok: resposta.ok, status: resposta.status, corpo: await resposta.json().catch(() => ({})) }
      }
      try {
        let r = await enviar(comBotoes)
        if (!r.ok && comBotoes && modeloInexistente(r.corpo)) {
          console.warn(pedido ? `Encaminhamento: ${MODELO_DO_PEDIDO} ainda nao aprovado; vai como texto` : `Alerta de urgencia: ${MODELO_COM_BOTOES} ainda nao aprovado; vai o modelo sem botoes`)
          comBotoes = false
          r = await enviar(false)
        }
        if (r.ok) {
          envios.push({ numero, ok: true })
          const id = r.corpo?.messages?.[0]?.id
          if (id) mensagens.push(String(id))
        } else {
          const codigo = r.corpo?.error?.code ? `(#${r.corpo.error.code}) ` : ''
          envios.push({ numero, ok: false, erro: `${codigo}${r.corpo?.error?.message ?? `HTTP ${r.status}`}` })
        }
      } catch (erro) {
        envios.push({ numero, ok: false, erro: String(erro).slice(0, 200) })
      }
    }
    if (alertaId && mensagens.length) {
      try {
        const { error } = await admin.from('alertas_de_urgencia').update({ mensagens }).eq('id', alertaId)
        if (error) console.error('Alerta de urgencia: ids das mensagens nao gravados', error)
      } catch (erro) {
        console.error('Alerta de urgencia: ids das mensagens nao gravados', erro)
      }
    }

    const { detalhe, nota, falhou } = descreverEnvio(envios, pedido ? 'pedido' : 'urgencia')
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
          .insert({ clinic_id: p.clinicId, conversation_id: p.conversaWhatsApp, evento: pedido ? 'pedido_equipe' : 'alerta_urgencia', detalhe })
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
