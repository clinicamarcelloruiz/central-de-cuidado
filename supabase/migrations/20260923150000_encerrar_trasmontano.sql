begin;

/**
 * O consultorio deixou de atender Trasmontano.
 *
 * Em 23/09/2026 o Dr. Marcello teve um problema com o convenio e pediu para
 * tirar do atendimento tudo que fala dele. Volta a valer o que era ate 19/09:
 * so particular, com recibo para reembolso, nas tres modalidades.
 *
 * Desfaz o que 20260919120000 e 20260919140000 ligaram, nos mesmos quatro
 * lugares - senao o robo se contradiz, dizendo numa mensagem que atende e na
 * outra que nao:
 *
 *  1. clinic_units.accepts_insurance: vazio, entao o robo para de perguntar
 *     "pelo convenio ou particular?" no agendamento de Santos.
 *  2. A resposta pronta de Convenios.
 *  3. O texto de informacoes de cada unidade.
 *  4. O texto da telemedicina.
 *
 * A palavra 'trasmontano' FICA na lista de palavras da resposta de convenio: a
 * familia que perguntar "atende Trasmontano?" precisa receber o "nao atendemos"
 * em vez de um "nao entendi".
 *
 * Os textos das unidades sao trocados por replace() da frase exata que a
 * migration de 19/09 escreveu. Se a clinica reescreveu o texto pela tela, a
 * frase nao bate e nada muda - e a conferencia no fim avisa.
 */

-- 1. Sem convenio na unidade, sem pergunta de convenio no agendamento.
update public.clinic_units
set accepts_insurance = ''
where accepts_insurance ilike '%smontano%';

-- 2. Resposta pronta.
update public.bot_answers
set answer = E'💳 *Convênios*\n\n' ||
      E'Não atendemos convênio: a consulta é particular, com pagamento em pix ou dinheiro, em todas as unidades e na telemedicina.\n\n' ||
      E'Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano. O valor devolvido depende do seu contrato.'
where subject = 'Convênios';

-- 3. Texto das unidades: Santos e as demais tinham frases diferentes.
update public.clinic_units
set info_text = replace(
      info_text,
      'Atendemos Trasmontano: leve a carteirinha e um documento com foto. Outros convênios não são atendidos, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
      'Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.'
    )
where strpos(info_text, 'Atendemos Trasmontano') > 0;

update public.clinic_units
set info_text = replace(
      info_text,
      'Nesta unidade não atendemos convênio (o Trasmontano vale só em Santos), mas',
      'Não atendemos convênio, mas'
    )
where strpos(info_text, '(o Trasmontano vale só em Santos)') > 0;

-- 4. Telemedicina.
update public.clinic_settings
set telemedicine_info_text = replace(
      telemedicine_info_text,
      'Na telemedicina não atendemos convênio (o Trasmontano vale só em Santos, presencial), mas',
      'Não atendemos convênio, mas'
    )
where strpos(coalesce(telemedicine_info_text, ''), '(o Trasmontano vale só em Santos, presencial)') > 0;

-- Conferencia. Nao derruba a migration (isso travaria todas as seguintes),
-- mas grita no log do deploy se algum texto que a familia le ainda cita o
-- convenio - o caso de a clinica ter reescrito a frase pela tela.
do $$
declare
  sobrou int;
begin
  select
    (select count(*) from public.clinic_units where archived_at is null and info_text ilike '%smontano%')
    + (select count(*) from public.clinic_settings where telemedicine_info_text ilike '%smontano%')
    + (select count(*) from public.bot_answers where is_active and answer ilike '%smontano%')
  into sobrou;
  if sobrou > 0 then
    raise warning 'ATENCAO: % texto(s) do robo ainda citam Trasmontano. Corrigir pela tela de Respostas/Configuracoes.', sobrou;
  end if;
end $$;

commit;
