-- Leva para o campo "Prescrição" TODAS as receitas Memed já emitidas que ainda
-- não estão no texto da consulta (qualquer clínica, qualquer paciente).
-- Só consultas não assinadas; não duplica se rodar de novo.
-- Rodar uma vez no SQL Editor do Supabase.
with blocos as (
  select
    p.consultation_id,
    string_agg(
      'Receita Memed de ' || to_char(p.emitida_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || E'\n' ||
      (
        select string_agg(
          case when coalesce(i->>'posologia', '') <> ''
               then (i->>'nome') || ': ' || (i->>'posologia')
               else (i->>'nome') end,
          E'\n' order by ord)
        from jsonb_array_elements(p.itens) with ordinality as t(i, ord)
      ),
      E'\n\n' order by p.emitida_em
    ) as bloco
  from public.prescriptions p
  where p.excluida_em is null
    and p.consultation_id is not null
    and jsonb_array_length(p.itens) > 0
  group by p.consultation_id
)
update public.consultations c
set prescription = case when c.prescription = '' then b.bloco
                        else c.prescription || E'\n\n' || b.bloco end
from blocos b
where c.id = b.consultation_id
  and c.signed_at is null
  and position('Receita Memed de' in c.prescription) = 0
returning c.id, left(c.prescription, 120) as prescricao;
