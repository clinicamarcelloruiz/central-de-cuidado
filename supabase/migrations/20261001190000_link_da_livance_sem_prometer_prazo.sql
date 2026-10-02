begin;

/**
 * O link de pagamento chega "antes da consulta", nao "assim que agendada"
 * (01/10/2026).
 *
 * Quem dispara o link e a Livance, quando alguem da equipe do Dr. Marcello
 * lanca a consulta na agenda DELA - nao o agendamento no robo. Quanto tempo
 * isso leva depende da equipe. "Assim que a consulta e agendada" prometia um
 * prazo que nao e nosso: a familia marcava, nao via link nenhum e escrevia
 * perguntando. Texto do Edu: sem prazo, so "antes da consulta".
 */

do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
begin
  update public.clinic_units
     set info_text = replace(info_text,
           'Pagamento online, pelo link que a Livance envia para você assim que a consulta é agendada.',
           'Pagamento online: antes da consulta, você recebe da Livance um link de pagamento.')
   where clinic_id = c and archived_at is null;

  update public.bot_answers
     set answer = replace(answer,
           'em Santos e em São Paulo, online, pelo link que a Livance envia assim que a consulta é agendada;',
           'em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta;')
   where clinic_id = c and subject = 'Valor e pagamento';

  if exists (select 1 from public.clinic_units where clinic_id = c and info_text like '%assim que a consulta é agendada%')
     or exists (select 1 from public.bot_answers where clinic_id = c and answer like '%assim que a consulta é agendada%') then
    raise warning 'Ainda ha "assim que a consulta e agendada" em algum texto da clinica. Conferir.';
  end if;
end
$$;

commit;
