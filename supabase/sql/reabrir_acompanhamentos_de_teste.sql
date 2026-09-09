-- Reabre os acompanhamentos já enviados de dois pacientes de teste, para
-- poderem ser enviados de novo. Rodar no SQL Editor do Supabase, de uma vez.
--
-- Três coisas travam o reenvio, e o script trata as três:
--   1. o acompanhamento fica com status "enviado";
--   2. o banco proíbe voltar atrás no status. É uma trava de propósito: no uso
--      normal um acompanhamento nunca "desacontece", e sem ela um clique errado
--      apagaria o registro de um contato que a família de fato recebeu. Aqui ela
--      é desligada por alguns milissegundos, dentro da transação, e religada;
--   3. a mensagem que saiu continua pendurada no acompanhamento, e o sistema
--      recusa mandar duas vezes o mesmo. A mensagem NÃO é apagada: continua na
--      conversa, só deixa de contar como "o envio deste acompanhamento".
--
-- Serve para dado de teste. Não use em paciente de verdade: reabrir um
-- acompanhamento faz a família receber a mesma mensagem outra vez.

begin;

alter table public.followups disable trigger followups_normalize_status;

with alvos as (
  select f.id
  from public.followups f
  join public.patients p on p.id = f.patient_id
  where p.name in ('Eduardo Marques', 'Marcelo Ruiz')
    and f.archived_at is null
),
desprender as (
  update public.whatsapp_messages m
  set followup_id = null
  where m.followup_id in (select id from alvos)
    and m.direction = 'outbound'
  returning m.id
)
update public.followups f
set status = 'pending',
    opened_at = null,
    completed_at = null
where f.id in (select id from alvos);

alter table public.followups enable trigger followups_normalize_status;

commit;

-- Como ficou:
select p.name, f.followup_key, f.status, f.due_date
from public.followups f
join public.patients p on p.id = f.patient_id
where p.name in ('Eduardo Marques', 'Marcelo Ruiz')
  and f.archived_at is null
order by p.name, f.due_date;
