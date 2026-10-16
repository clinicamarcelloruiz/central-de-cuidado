begin;

/**
 * Pagamento tambem presencial, no dia da consulta (16/10/2026).
 *
 * A mae do Leon perguntou se podia pagar no dia; a IA nao tinha a resposta e
 * passou para a equipe. O Edu, depois: "pode ser pago com o link enviado pela
 * Livance antes da consulta ou presencialmente, e as formas de pagamento sao
 * cartao ou pix, parcelado nao". Pediu tambem para nao citar o pix com o
 * medico nem o totem: so link ou presencial, cartao ou pix.
 *
 * Vale para as duas unidades (as duas sao Livance). A telemedicina continua so
 * pix. "Nao parcelamos" segue so na resposta "Parcelamento", que sai apenas
 * para quem pergunta.
 *
 * So a clinica real. Cada troca e por replace() do trecho exato, pula texto que
 * ja fala em "presencialmente" (rodar de novo nao duplica) e avisa (raise
 * warning) quando o trecho nao esta la: texto editado pela equipe na tela nao
 * e sobrescrito as cegas.
 */

do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
  n int;
begin
  -- 1. Cartao de cada unidade.
  update public.clinic_units
     set info_text = replace(info_text,
           '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento.',
           '💳 Pagamento com cartão ou pix: pelo link que a Livance envia antes da consulta ou presencialmente, no dia.')
   where clinic_id = c
     and strpos(coalesce(info_text, ''), '💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento.') > 0
     and strpos(lower(info_text), 'presencialmente') = 0;
  get diagnostics n = row_count;
  raise notice 'Unidades com pagamento presencial: %', n;
  if n = 0 then raise warning 'Nenhum cartao de unidade com o trecho do link da Livance: nao mudou'; end if;

  -- 2. Resposta pronta "Valor e pagamento".
  update public.bot_answers
     set answer = replace(answer,
           'em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix.',
           'em Santos e em São Paulo, com cartão ou pix, pelo link que a Livance envia antes da consulta ou presencialmente, no dia; na telemedicina, pix.'),
         updated_at = now()
   where clinic_id = c
     and subject = 'Valor e pagamento'
     and strpos(answer, 'em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix.') > 0;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'Resposta "Valor e pagamento" sem o trecho esperado: nao mudou'; end if;

  -- 3. Resposta pronta "Parcelamento" (criada em 20261016120000).
  update public.bot_answers
     set answer = replace(answer,
           'o pagamento da consulta é à vista. Em Santos e em São Paulo, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, por pix.',
           'o pagamento da consulta é à vista, com cartão ou pix. Em Santos e em São Paulo, pelo link que a Livance envia antes da consulta ou presencialmente, no dia; na telemedicina, por pix.'),
         updated_at = now()
   where clinic_id = c
     and lower(btrim(subject)) = 'parcelamento'
     and strpos(answer, 'o pagamento da consulta é à vista. Em Santos e em São Paulo, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, por pix.') > 0;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'Resposta "Parcelamento" sem o trecho esperado: nao mudou'; end if;
end
$$;

commit;
