begin;

/**
 * Telemedicina, informações por unidade e urgência.
 *
 * Três pedidos do dr. Marcello, em 11/09/2026, que mexem no mesmo lugar: o que
 * o robô diz quando alguém pergunta "quanto custa" e como ele marca.
 *
 * 1. O valor não é um só. Santos custa R$ 450 e São Paulo R$ 550, então a
 *    resposta de informações precisa perguntar onde antes de responder. O
 *    texto deixa de ser um campo único da clínica e passa a ser um por unidade.
 *
 * 2. Telemedicina vira uma opção de atendimento, com valor próprio (R$ 450 e
 *    retorno presencial em 30 dias). Ela não tem agenda própria: usa os
 *    horários das unidades físicas, porque é o mesmo médico no mesmo dia. Por
 *    isso a consulta continua presa à unidade que cedeu o horário, e o que
 *    muda é a modalidade.
 *
 * 3. Quem pede telemedicina pode dizer que é urgência. Aí o robô não marca:
 *    transfere para a equipe com uma bandeira própria, para saltar na lista.
 */

-- ---------------------------------------------------------------
-- 1. Texto de informações por unidade
-- ---------------------------------------------------------------

alter table public.clinic_units
  add column if not exists info_text text not null default '';

comment on column public.clinic_units.info_text is
  'O que o robo responde quando a familia pede informacoes desta unidade: valor, pagamento, endereco, o que levar.';

alter table public.clinic_units
  drop constraint if exists clinic_units_info_text_length;
alter table public.clinic_units
  add constraint clinic_units_info_text_length check (char_length(info_text) <= 1024);

-- ---------------------------------------------------------------
-- 2. Telemedicina
-- ---------------------------------------------------------------

alter table public.clinic_settings
  add column if not exists telemedicine_enabled boolean not null default true,
  add column if not exists telemedicine_info_text text not null default '';

comment on column public.clinic_settings.telemedicine_enabled is
  'Se o robo oferece telemedicina como opcao de informacao e de agendamento.';
comment on column public.clinic_settings.telemedicine_info_text is
  'O que o robo responde quando a familia pede informacoes sobre a telemedicina.';

grant update (telemedicine_enabled, telemedicine_info_text) on table public.clinic_settings to authenticated;

-- A modalidade da consulta. Presencial e o de sempre; telemedicina usa o
-- horario de uma unidade fisica, mas acontece por video.
alter table public.appointments
  add column if not exists modality text not null default 'presencial';

alter table public.appointments
  drop constraint if exists appointments_modality_check;
alter table public.appointments
  add constraint appointments_modality_check check (modality in ('presencial', 'telemedicina'));

comment on column public.appointments.modality is
  'presencial ou telemedicina. A unidade continua sendo a que cedeu o horario.';

-- O robo precisa lembrar, entre uma mensagem e outra, que a pessoa escolheu
-- telemedicina - senao ao escolher o dia ele marcaria presencial.
alter table public.whatsapp_conversations
  add column if not exists booking_modality text;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_booking_modality_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_booking_modality_check check (
    booking_modality is null or booking_modality in ('presencial', 'telemedicina')
  );

-- ---------------------------------------------------------------
-- 3. Urgência na bandeira de atenção
-- ---------------------------------------------------------------

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_attention_reason_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_attention_reason_check check (
    attention_reason is null
    or attention_reason in (
      'atendente', 'remarcacao', 'cancelamento', 'ajuda', 'falha', 'cancelou_sozinho', 'urgencia'
    )
  );

-- ---------------------------------------------------------------
-- 4. Os textos, como o dr. passou em 11/09/2026
--
-- Preenche so onde ainda esta vazio: a clinica pode ter editado antes.
-- ---------------------------------------------------------------

update public.clinic_units
set info_text = E'💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' ||
  E'💳 Pagamento somente em pix ou dinheiro. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' ||
  E'📍 Liferty · Santos — Al. Armênio Mendes, 66, sala 2912, Aparecida. Estacionamento particular no local.\n\n' ||
  E'📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.'
where info_text = ''
  and archived_at is null
  and name ilike '%santos%';

update public.clinic_units
set info_text = E'💙 *Consulta em São Paulo: R$ 550,00.* Inclui retorno em até 30 dias.\n\n' ||
  E'💳 Pagamento somente em pix ou dinheiro. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' ||
  E'📍 Livance · Ibirapuera — R. Agostinho Rodrigues Filho, 550, Vila Clementino. Estacionamento particular no local.\n\n' ||
  E'📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.'
where info_text = ''
  and archived_at is null
  and (name ilike '%ibirapuera%' or name ilike '%paulo%' or name ilike '%livance%');

update public.clinic_settings
set telemedicine_info_text = E'💙 *Telemedicina: R$ 450,00.* Inclui um retorno presencial em até 30 dias, em Santos ou São Paulo.\n\n' ||
  E'💳 Pagamento por pix. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' ||
  E'💻 A consulta é por vídeo, no horário marcado. Você recebe o link aqui pelo WhatsApp.\n\n' ||
  E'📋 Tenha em mãos a carteirinha de vacinação da criança e os exames anteriores, se houver.'
where telemedicine_info_text = '';

-- As respostas prontas saem do rascunho: o conteudo agora e real, entao
-- entram ligadas. So mexe nas linhas que ainda tinham o "___" do rascunho.
update public.bot_answers
set answer = E'💙 *Valores da consulta:*\n\n• Santos: R$ 450,00\n• São Paulo: R$ 550,00\n• Telemedicina: R$ 450,00\n\nTodas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).\n\n💳 Pagamento somente em pix ou dinheiro. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
    is_active = true
where subject = 'Valor e pagamento' and strpos(answer, '___') > 0;

update public.bot_answers
set answer = E'Não atendemos convênio: o atendimento é particular, com pagamento em pix ou dinheiro.\n\nEmitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano. O valor devolvido depende do seu contrato.',
    is_active = true
where subject = 'Convênios';

update public.bot_answers
set answer = E'Atendemos em duas unidades, as duas com estacionamento particular no local:\n\n📍 *Livance · Ibirapuera* — R. Agostinho Rodrigues Filho, 550, Vila Clementino, São Paulo.\n\n📍 *Liferty · Santos* — Al. Armênio Mendes, 66, sala 2912, Aparecida, Santos.',
    is_active = true
where subject = 'Endereço e estacionamento' and strpos(answer, '___') > 0;

update public.bot_answers
set answer = E'Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.\n\nO retorno está incluído e pode ser feito em até 30 dias.',
    is_active = true
where subject = 'O que levar e como é a consulta' and strpos(answer, '___') > 0;

commit;
