-- Responsavel pelo sistema passa a ser o Edu (pedido de 01/10/2026).
--
-- Antes: clinicamarcelloruiz@gmail.com era administrador E responsavel pelo
-- sistema (a marca acima do administrador - ver a migration
-- 20260924160000_responsavel_pelo_sistema). O e-mail da clinica fica com o
-- Dr. Marcello; quem desenvolve e mantem o sistema entra com conta propria.
--
-- Depois:
--   eduaoe@gmail.com              -> administrador + responsavel pelo sistema
--   clinicamarcelloruiz@gmail.com -> administrador (sem a marca)
--
-- Roda pelo editor SQL, DEPOIS que eduaoe@gmail.com se cadastrar na
-- plataforma (criar a conta e escolher a Clinica Dr. Marcelo). Para tudo se
-- a conta ainda nao existir. Pode rodar de novo sem efeito.
--
-- Fica de fora de proposito a conta de teste eduaoebra@gmail.com: ela so tem
-- vinculo com a clinica de teste.

do $$
declare
  clinica constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
  edu uuid;
  marcello uuid;
begin
  select id into edu from auth.users where lower(email) = 'eduaoe@gmail.com';
  select id into marcello from auth.users where lower(email) = 'clinicamarcelloruiz@gmail.com';

  if edu is null then
    raise exception 'eduaoe@gmail.com ainda nao tem conta. Cadastre-se na plataforma e rode de novo - nada foi alterado.';
  end if;
  if marcello is null then
    raise exception 'Conta da clinica nao encontrada - nada foi alterado.';
  end if;

  -- Edu: administrador ativo na clinica real.
  insert into public.clinic_memberships (clinic_id, user_id, role, status)
  values (clinica, edu, 'owner'::public.clinic_role, 'active'::public.membership_status)
  on conflict (clinic_id, user_id) do update
    set role = 'owner'::public.clinic_role,
        status = 'active'::public.membership_status,
        updated_at = now();

  -- O pedido de acesso que o cadastro abriu nao fica pendente na tela.
  update public.access_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = marcello
   where clinic_id = clinica and user_id = edu and status = 'pending';

  -- Dr. Marcello continua administrador ativo (garantido, nao so suposto).
  update public.clinic_memberships
     set role = 'owner'::public.clinic_role, status = 'active'::public.membership_status, updated_at = now()
   where clinic_id = clinica and user_id = marcello;

  -- A marca de responsavel muda de mao. Primeiro entra o Edu, depois sai a
  -- clinica: em nenhum momento o sistema fica sem responsavel.
  insert into private.responsaveis_pelo_sistema (user_id) values (edu) on conflict (user_id) do nothing;
  delete from private.responsaveis_pelo_sistema where user_id = marcello;
end
$$;

-- Conferir.
select u.email,
       m.role as papel,
       m.status as situacao,
       private.e_responsavel_pelo_sistema(u.id) as responsavel
  from public.clinic_memberships m
  join auth.users u on u.id = m.user_id
 where m.clinic_id = '1ffde840-a905-4300-b4fd-51571fcefdc0'
 order by responsavel desc, u.email;
