begin;

/**
 * Parcelamento: resposta pronta propria, so para quem pergunta (16/10/2026).
 *
 * O Edu: "nao parcela", e logo depois "acho que nao precisa falar que nao
 * parcelamos, somente se perguntar". Por isso a regra nao entra nos cartoes
 * das unidades nem em "Valor e pagamento" - esses textos saem inteiros para
 * toda familia que pergunta o valor. Vira um assunto separado, que o robo
 * manda e a IA usa so quando a pergunta e sobre parcelar ou forma de
 * pagamento.
 *
 * "parcela" sai das palavras de "Valor e pagamento": com ela la, "parcela?"
 * empatava os dois assuntos, e o empate fica com o de cima (Valor, posicao
 * 10), que nao fala de parcelamento.
 *
 * Nada aqui diz se o link da Livance aceita cartao: ninguem confirmou, e
 * escrever seria inventar.
 *
 * So a clinica real, e so se o assunto ainda nao existe: rodar de novo nao
 * duplica, e o que a equipe editar na tela fica.
 */

do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
  n int;
begin
  insert into public.bot_answers (clinic_id, subject, keywords, answer, ask_unit, position, is_active)
  select
    c,
    'Parcelamento',
    array[
      'parcela', 'parcelamento', 'parcelado', 'vezes', 'juros',
      '2x', '3x', '4x', '5x', '6x', '10x', '12x',
      'cartao', 'cartão', 'credito', 'crédito', 'aceita', 'aceitam'
    ],
    E'💳 *Parcelamento*\n\n' ||
      E'Não parcelamos: o pagamento da consulta é à vista. ' ||
      E'Em Santos e em São Paulo, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, por pix.',
    false,
    60,
    true
  where exists (select 1 from public.clinics where id = c)
    and not exists (
      select 1 from public.bot_answers
       where clinic_id = c and lower(btrim(subject)) = 'parcelamento'
    );
  get diagnostics n = row_count;
  raise notice 'Resposta "Parcelamento" criada: %', n;

  update public.bot_answers
     set keywords = array_remove(keywords, 'parcela'),
         updated_at = now()
   where clinic_id = c
     and subject = 'Valor e pagamento'
     and 'parcela' = any(keywords);
  get diagnostics n = row_count;
  raise notice '"parcela" tirada de Valor e pagamento: %', n;
end
$$;

commit;
