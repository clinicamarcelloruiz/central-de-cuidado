/**
 * Roteiros prontos para reuniao: a conversa se digita sozinha, passo a passo.
 *
 * Cada passo e o que a familia faria: escrever, tocar numa opcao (pelo id da
 * opcao, o mesmo que o WhatsApp devolve), mandar uma foto - ou a equipe
 * entrar na conversa.
 *
 * `espera` e o que precisa ter acontecido no fim, e tests/simulador.test.mjs
 * cobra isso das duas identidades a cada `npm run test:bot`. Quando o robo
 * mudar um caminho, o roteiro quebra no teste, e nao na frente do cliente.
 */
import type { ChaveFamilia } from './dados'

export type Passo = { texto: string } | { toque: string } | { anexo: true } | { equipe: string }

export type Roteiro = {
  chave: string
  titulo: string
  resumo: string
  familia: ChaveFamilia
  passos: Passo[]
  espera: {
    /** Consultas marcadas (status scheduled) deste telefone no fim. */
    marcadas: number
    canceladas?: number
    /** Pacientes deste telefone no fim. */
    pacientes?: number
    /** Motivo da bandeira acesa no fim; null = nenhuma. */
    motivo: string | null
    resolvida?: boolean
  }
}

const t = (texto: string): Passo => ({ texto })
const toque = (id: string): Passo => ({ toque: id })

export const ROTEIROS: Roteiro[] = [
  {
    chave: 'marcar',
    titulo: 'Família nova marca a primeira consulta',
    resumo: 'Do "oi" ao comprovante: unidade, dia, horário e cadastro, sem ninguém da equipe.',
    familia: 'nova',
    passos: [
      t('Oi, boa tarde!'),
      toque('2'),
      toque('1'),
      toque('1'),
      toque('2'),
      t('Helena Souza Lima'),
      t('14/03/2021'),
      t('Marina Souza Lima'),
      toque('PULAR'),
      t('marina@exemplo.com'),
    ],
    espera: { marcadas: 1, pacientes: 1, motivo: null, resolvida: true },
  },
  {
    chave: 'valor',
    titulo: 'Pergunta o valor',
    resumo: 'Pergunta escrita do jeito dela: o robô responde direto, sem empurrar o menu.',
    familia: 'nova',
    passos: [t('Olá! Vim pelo Instagram e queria saber o valor da consulta.'), toque('1')],
    espera: { marcadas: 0, motivo: null },
  },
  {
    chave: 'convenio',
    titulo: 'Convênio e endereço',
    resumo: 'Duas dúvidas comuns, respondidas com os textos que a clínica cadastrou.',
    familia: 'nova',
    passos: [t('Vocês atendem Unimed?'), t('Onde fica o consultório?')],
    espera: { marcadas: 0, motivo: null },
  },
  {
    chave: 'urgencia',
    titulo: 'Urgência',
    resumo: 'A conversa sobe na lista com a etiqueta vermelha, e a família recebe a orientação.',
    familia: 'nova',
    passos: [t('Socorro, é urgente! Meu filho está muito mal.')],
    espera: { marcadas: 0, motivo: 'urgencia' },
  },
  {
    chave: 'clinica',
    titulo: 'Pergunta sobre remédio',
    resumo: 'O robô não orienta sobre sintomas nem remédios: explica e oferece a consulta.',
    familia: 'cadastrada',
    passos: [t('Ela está com dor de barriga há 3 dias, posso dar dipirona?')],
    espera: { marcadas: 0, pacientes: 1, motivo: null },
  },
  {
    chave: 'remarcar',
    titulo: 'Paciente remarca a consulta',
    resumo: 'Escolhe a data nova na mesma unidade; a antiga só é cancelada depois que a nova está garantida.',
    familia: 'com_consulta',
    // Desde 17/10/2026 o SIM abre direto as datas da unidade da consulta: a
    // pergunta da unidade saiu do caminho.
    passos: [t('Oi! Preciso remarcar a consulta da Helena.'), toque('REMARCAR'), toque('SIM'), toque('1'), toque('3')],
    espera: { marcadas: 1, canceladas: 1, pacientes: 1, motivo: null },
  },
  {
    chave: 'irmaos',
    titulo: 'Mãe com dois filhos',
    resumo: 'O robô pergunta para quem é a consulta, em vez de adivinhar o irmão.',
    familia: 'irmaos',
    passos: [t('Oi'), toque('2'), toque('2'), toque('2'), toque('1'), toque('4')],
    espera: { marcadas: 1, pacientes: 2, motivo: null },
  },
  {
    chave: 'receita',
    titulo: '2ª via de receita',
    resumo: 'O pedido chega pronto para a equipe, com o remédio e a correção que a farmácia pediu.',
    familia: 'cadastrada',
    passos: [t('Oi'), toque('5'), toque('1'), t('Domperidona 1mg/ml'), t('a farmácia disse que a validade venceu')],
    espera: { marcadas: 0, pacientes: 1, motivo: 'documento' },
  },
  {
    chave: 'foto',
    titulo: 'Manda foto do exame',
    resumo: 'O robô não finge que leu: entrega para a equipe e diz que entregou.',
    familia: 'cadastrada',
    passos: [t('Oi, bom dia'), { anexo: true }],
    espera: { marcadas: 0, pacientes: 1, motivo: 'anexo' },
  },
  {
    chave: 'equipe',
    titulo: 'A equipe assume a conversa',
    resumo: 'Com alguém da recepção conversando, o robô fica quieto e não atropela.',
    familia: 'cadastrada',
    passos: [
      t('Oi'),
      toque('3'),
      { equipe: 'Oi, Marina! Aqui é a Júlia, da recepção. Como posso ajudar?' },
      t('Queria saber se ela precisa levar os exames de sangue.'),
    ],
    espera: { marcadas: 0, pacientes: 1, motivo: 'atendente' },
  },
]
