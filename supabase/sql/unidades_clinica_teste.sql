-- Copia as unidades (nome e endereço) da clínica real para a clínica de teste
-- da Memed, que não tinha nenhuma. Não duplica se rodar de novo.
insert into public.clinic_units (clinic_id, name, address)
select teste.id, u.name, u.address
from public.clinic_units u
join public.clinics real on real.id = u.clinic_id
cross join public.clinics teste
where teste.name = 'Clínica de teste Memed'
  and real.name <> 'Clínica de teste Memed'
  and u.archived_at is null
  and not exists (
    select 1 from public.clinic_units x
    where x.clinic_id = teste.id and x.name = u.name
  )
returning name, address;
