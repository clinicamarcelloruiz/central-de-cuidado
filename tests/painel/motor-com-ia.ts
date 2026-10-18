// O que o painel com IA (conversar-ia.mjs) precisa, num pacote so (17/10/2026).
// Um pacote, e nao dois: o simulador e o atendente com IA tem de usar a MESMA
// copia do robo (atendimento.ts), senao a etapa gravada por um nao e a que o
// outro le. Empacotar: ver o comeco de conversar-ia.mjs.
export { Simulacao } from '../../src/simulador/sessao.ts'
export { IDENTIDADES, FAMILIAS } from '../../src/simulador/dados.ts'
export { atenderComAssistente, montarSituacao, claudePelaApi, MODELO_PADRAO } from '../../supabase/functions/_shared/assistente.ts'
export { horariosEmTexto, entregarParaEquipe, tratarConversa, sinalDeAlarme, roboRegistrou } from '../../supabase/functions/_shared/atendimento.ts'
