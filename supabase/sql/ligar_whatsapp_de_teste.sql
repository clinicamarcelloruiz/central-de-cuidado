-- Liga o numero de teste da Meta na "Clinica de teste Memed" (27/09/2026).
--
-- RODAR SO DEPOIS do PUBLICAR.bat que levou a migration
-- 20260927120000_whatsapp_de_teste_por_clinica.sql e as funcoes com a trava
-- da lista de teste. Antes disso, os robos ainda nao conhecem a trava e
-- tentariam mandar para os pacientes ficticios.
--
-- Numero de teste (painel da Meta > app Central de Cuidado > Etapa 1):
--   +1 555 672-9523 | Phone Number ID 1275678148961223
--   Conta de teste (WABA) 2348838555650602
--
-- Modelos criados na conta de teste em 27/09/2026, com o mesmo nome e texto
-- da conta real: lembrete_consulta, acompanhamento_pos_consulta,
-- consulta_cancelada, retomar_atendimento, resposta_da_clinica.
--
-- A chave de acesso: o usuario do sistema "Employee" ja tem acesso total a
-- conta de teste, entao a chave geral (WHATSAPP_ACCESS_TOKEN) deve servir.
-- Se a Meta recusar com erro de permissao, crie o segredo
-- WHATSAPP_ACCESS_TOKEN_1275678148961223 no Supabase com uma chave propria.

do $$
declare
  c_teste uuid := (select id from public.clinics where name = 'Clínica de teste Memed');
begin
  if c_teste is null then
    raise exception 'Clinica de teste nao encontrada - nada foi alterado.';
  end if;

  -- 1. Liga o numero, em modo teste. PREENCHA a lista com os celulares
  --    confirmados no painel da Meta (ate 5), com DDD. Lista vazia = modo
  --    teste sem ninguem: nada sai, e o painel avisa isso.
  update public.clinic_settings
     set whatsapp_phone_number_id = '1275678148961223',
         -- 13 99116-5576: celular do Edu, o primeiro da lista (27/09/2026).
         whatsapp_telefones_teste = array['13991165576']::text[]
   where clinic_id = c_teste;

  -- 2. (Opcional) Troque o telefone de 2 ou 3 pacientes ficticios para os
  --    celulares da lista, para ver lembrete e acompanhamento chegando.
  --    Exemplo:
  -- update public.patients set phone = '13991234567'
  --  where clinic_id = c_teste and name = 'Beatriz Almeida Rocha';
end
$$;

-- Conferir:
select c.name, s.whatsapp_phone_number_id, s.whatsapp_telefones_teste
  from public.clinic_settings s
  join public.clinics c on c.id = s.clinic_id;

-- Para DESLIGAR o numero de teste (volta ao "WhatsApp nao conectado"):
-- update public.clinic_settings set whatsapp_phone_number_id = null, whatsapp_telefones_teste = null
--  where clinic_id = (select id from public.clinics where name = 'Clínica de teste Memed');
