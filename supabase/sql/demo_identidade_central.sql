-- Identidade propria da clinica de teste (27/09/2026).
--
-- A "Clinica de teste Memed" nasceu como copia da clinica real e carregava o
-- nome do Dr. Marcello, as unidades Livance/Liferty, o site e o e-mail dele. E
-- a conta mostrada a outros medicos e a base para desenvolver sem mexer na
-- clinica real. Aqui ela vira "Consultorio Central de Cuidado", com uma medica
-- ficticia (Dra. Ana Ribeiro) e unidades ficticias.
--
-- TUDO filtrado pelo id da clinica de teste. A clinica real nao e tocada.
--
-- Ficam de proposito: signer_name e signer_crm. Sao os dados do prescritor na
-- homologacao da Memed; troca-los pode derrubar o teste de receita.

do $$
declare
  c uuid := 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9';
begin
  if not exists (select 1 from public.clinics where id = c and name in ('Clínica de teste Memed', 'Consultório Central de Cuidado')) then
    raise exception 'Clinica de teste nao encontrada pelo id e nome - nada alterado.';
  end if;

  update public.clinics set name = 'Consultório Central de Cuidado' where id = c;

  -- Unidades: nomes e enderecos ficticios.
  update public.clinic_units set
    name = 'Moema',
    address = 'Rua das Acácias, 1000, 10º andar, Moema',
    info_text = E'💙 *Consulta em Moema: R$ 450,00.* Inclui retorno em até 30 dias.\n\n'
      || E'💳 Pagamento na recepção, na chegada: pix, débito ou crédito à vista. Não atendemos convênio, mas emitimos recibo para você pedir reembolso ao seu plano.\n\n'
      || E'📍 Moema — Rua das Acácias, 1000, 10º andar. Estacionamento conveniado no prédio.\n\n'
      || E'🖥️ Ao chegar, faça o check-in na recepção com o nome do paciente. A Dra. Ana recebe o aviso e chama vocês na sala de espera.\n\n'
      || E'📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.'
  where clinic_id = c and id = '2d4e2f29-d8c6-41b4-88f8-73389b271b58';

  update public.clinic_units set
    name = 'Pinheiros',
    address = 'Rua das Flores, 250, Pinheiros',
    info_text = E'💙 *Consulta em Pinheiros: R$ 550,00.* Inclui retorno em até 30 dias.\n\n'
      || E'💳 Pagamento em pix ou cartão. Não atendemos convênio, mas emitimos recibo para você pedir reembolso ao seu plano.\n\n'
      || E'📍 Pinheiros — Rua das Flores, 250. Estacionamento particular no local.\n\n'
      || E'📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.'
  where clinic_id = c and id = 'a872e4ea-fd7a-401b-9d39-1b5f98dd1509';

  update public.clinic_units set name = 'Unidade antiga', address = 'Rua Antiga, 10', info_text = ''
  where clinic_id = c and id = '2ce81651-5e22-4b77-ac47-414ce8d43bad';

  -- Configuracoes e perfil do WhatsApp de teste.
  update public.clinic_settings set
    telemedicine_info_text = E'💙 *Telemedicina: R$ 450,00.* Inclui um retorno presencial em até 30 dias, em Moema ou em Pinheiros.\n\n'
      || E'💳 Pagamento por pix, antes da consulta. O link da chamada chega por aqui no dia.',
    whatsapp_profile_about = 'Pediatria · Modelo de demonstração',
    whatsapp_profile_address = 'Rua das Acácias, 1000, 10º andar, Moema',
    whatsapp_profile_description = 'Consultório Central de Cuidado, da Dra. Ana Ribeiro (pediatria). Modelo de demonstração do sistema Central de Cuidado.',
    whatsapp_autoreply_text = 'Olá! 👋 Aqui é o Consultório Central de Cuidado, da Dra. Ana Ribeiro, pediatra.',
    whatsapp_autoreply_known_text = 'Olá, {nome}! 👋 Aqui é o Consultório Central de Cuidado.',
    whatsapp_profile_email = '',
    whatsapp_profile_website = ''
  where clinic_id = c;

  -- Respostas do robo que citavam as unidades reais.
  update public.bot_answers set answer =
    E'Atendemos em duas unidades, as duas com estacionamento:\n\n'
    || E'📍 *Moema* — Rua das Acácias, 1000, 10º andar.\n\n'
    || E'📍 *Pinheiros* — Rua das Flores, 250.'
  where clinic_id = c and id = '296553ae-4c6a-475f-b7d1-9d31b6a387d0';

  update public.bot_answers set answer =
    E'💙 *Valores da consulta:*\n\n'
    || E'• Moema: R$ 450,00\n• Pinheiros: R$ 550,00\n• Telemedicina: R$ 450,00\n\n'
    || E'Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).\n\n'
    || E'💳 Pagamento por pix ou cartão. Emitimos recibo para você pedir reembolso ao seu plano.'
  where clinic_id = c and id = '31126300-2b16-49ce-93e0-57ccc32af79c';
end
$$;

-- Troca de nomes no que sobrou (textos de acompanhamento, outras respostas,
-- conversas de demonstracao). Mesma trava: so a clinica de teste.
create or replace function pg_temp.sem_marcello(t text) returns text language sql as $f$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(t,
    'Clínica Dr. Marcello Ruiz', 'Consultório Central de Cuidado'),
    'do Dr. Marcello Ruiz da Silva', 'da Dra. Ana Ribeiro'),
    'do Dr. Marcello Ruiz', 'da Dra. Ana Ribeiro'),
    'O Dr. Marcello', 'A Dra. Ana'),
    'o Dr. Marcello', 'a Dra. Ana'),
    'Dr. Marcello Ruiz', 'Dra. Ana Ribeiro'),
    'Dr. Marcello', 'Dra. Ana'),
    'gastroenterologista pediátrico', 'pediatra'),
    'Livance · Santos', 'Moema'),
    'Livance - Santos', 'Moema'),
    'Livance Ibirapuera - São Paulo', 'Pinheiros'),
    'Livance · Ibirapuera', 'Pinheiros'),
    'Unidade Centro', 'Moema'),
    'Unidade Jardins', 'Pinheiros')
$f$;

update public.clinic_settings set
  template_d15 = pg_temp.sem_marcello(template_d15),
  template_d30 = pg_temp.sem_marcello(template_d30),
  template_m90 = pg_temp.sem_marcello(template_m90)
where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9';

update public.bot_answers set answer = pg_temp.sem_marcello(answer)
where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9' and answer ~* '(marcello|livance|unidade centro|unidade jardins)';

update public.whatsapp_messages set body = pg_temp.sem_marcello(body)
where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9' and body ~* '(marcello|livance|unidade centro|unidade jardins)';

-- Conferir: o que ainda cita o Dr. Marcello ou a Livance na clinica de teste.
select 'unidades' onde, count(*) from public.clinic_units where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9' and (name || coalesce(info_text,'') || coalesce(address,'')) ~* '(marcello|livance|liferty)'
union all select 'respostas', count(*) from public.bot_answers where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9' and answer ~* '(marcello|livance|liferty)'
union all select 'mensagens', count(*) from public.whatsapp_messages where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9' and body ~* '(marcello|livance|liferty)'
union all select 'config', count(*) from public.clinic_settings s where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9' and (to_jsonb(s) - 'signer_name')::text ~* '(marcello|livance|liferty)'
union all select 'CLINICA REAL intacta (unidades Livance)', count(*) from public.clinic_units where clinic_id = '1ffde840-a905-4300-b4fd-51571fcefdc0' and name ~* 'livance';

-- Modelos da Meta proprios da clinica de teste (aprovados em 27/09/2026 na
-- conta de teste). Os outros dois (lembrete_consulta, consulta_cancelada) nao
-- citam o Dr. Marcello e seguem com o mesmo nome.
update public.clinic_settings set
  whatsapp_template_name = 'demo_acompanhamento',
  whatsapp_reopen_template_name = 'demo_retomar_atendimento',
  whatsapp_reply_template_name = 'demo_resposta_da_clinica'
where clinic_id = 'f392fe85-ef6e-4729-bd2c-54dbfc9901b9';
