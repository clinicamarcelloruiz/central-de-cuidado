begin;

/**
 * Na Livance Santos o pagamento e no totem NA CHEGADA, junto com o check-in.
 *
 * 20260926120000 escreveu "Pagamento depois da consulta, no totem" no texto da
 * unidade. Errado: o Edu corrigiu em 26/09/2026 - a familia paga no totem ao
 * chegar, e so entao o Dr. Marcello recebe o aviso. Uma familia que lesse o
 * texto antigo iria direto para a sala de espera e ficaria sem ser chamada.
 *
 * Corrige por replace() das frases exatas que aquela migration escreveu. Se a
 * clinica ja reescreveu pela tela, nada muda e a conferencia avisa.
 */

update public.clinic_units
set info_text = replace(
      replace(
        info_text,
        'Pagamento depois da consulta, no totem: pix, débito ou crédito à vista.',
        'Pagamento no totem, na chegada, junto com o check-in: pix, débito ou crédito à vista.'
      ),
      'Ao chegar, faça o check-in no totem digitando o nome do paciente. O Dr. Marcello recebe o aviso',
      'Ao chegar, faça o check-in no totem digitando o nome do paciente e, ali mesmo, o pagamento. O Dr. Marcello recebe o aviso'
    )
where strpos(info_text, 'Pagamento depois da consulta, no totem') > 0
   or strpos(info_text, 'digitando o nome do paciente. O Dr. Marcello') > 0;

do $$
declare
  n integer;
begin
  select count(*) into n
    from public.clinic_units
   where archived_at is null
     and info_text ilike '%depois da consulta%';
  if n > 0 then
    raise warning 'ATENCAO: % texto(s) de unidade ainda dizem "depois da consulta". Corrigir em Respostas do robo.', n;
  end if;

  select count(*) into n
    from public.bot_answers
   where is_active
     and answer ilike '%totem%'
     and answer ilike '%depois da consulta%';
  if n > 0 then
    raise warning 'ATENCAO: % resposta(s) do robo ligam o totem a "depois da consulta".', n;
  end if;
end $$;

commit;
