begin;

/**
 * Sao Paulo tambem paga pelo link da Livance (01/10/2026).
 *
 * Em 28/09 (20260928160000) Santos passou para "link de pagamento que a
 * Livance envia ao agendar", e Sao Paulo ficou em "pix ou dinheiro" esperando
 * confirmacao - a unidade de Sao Paulo tambem e Livance (Ibirapuera). O Edu
 * confirmou em 01/10: o pagamento nao e mais no totem nem na hora, o paciente
 * recebe o link. Vale para as duas unidades Livance. Telemedicina segue pix.
 *
 * So a clinica real, por replace do trecho exato, com aviso se o texto nao
 * estiver como esperado (texto editado na tela nao e sobrescrito as cegas).
 */

do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
begin
  update public.clinic_units
     set info_text = replace(info_text,
           'Pagamento somente em pix ou dinheiro.',
           'Pagamento online, pelo link que a Livance envia para você assim que a consulta é agendada.')
   where clinic_id = c
     and archived_at is null
     and name = 'Livance Ibirapuera - São Paulo';

  update public.bot_answers
     set answer = replace(answer,
           'em Santos, online, pelo link que a Livance envia assim que a consulta é agendada; em São Paulo, pix ou dinheiro;',
           'em Santos e em São Paulo, online, pelo link que a Livance envia assim que a consulta é agendada;')
   where clinic_id = c and subject = 'Valor e pagamento';

  if exists (
    select 1 from public.clinic_units
     where clinic_id = c and archived_at is null and name ilike 'Livance%'
       and info_text ~* '(pix ou dinheiro|pagamento no totem)'
  ) or exists (
    select 1 from public.bot_answers
     where clinic_id = c and answer ~* '(pix ou dinheiro|no totem da Livance)'
  ) then
    raise warning 'Ainda ha texto de pagamento antigo numa unidade Livance ou resposta do robo. Conferir.';
  end if;
end
$$;

commit;
