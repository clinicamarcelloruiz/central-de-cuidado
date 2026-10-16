-- Atendente com IA, em teste (15/10/2026). Ver supabase/functions/_shared/assistente.ts.
--
-- Um modo por clinica, desligado por padrao: nenhuma conversa muda ate alguem
-- escolher "sombra" ou "ligado" em Preferencias. E as mensagens que o Claude
-- escreveu ficam marcadas, para a equipe saber quem falou e para dar para
-- comparar depois.

alter table public.clinic_settings
  add column if not exists assistente_ia text not null default 'desligado';

alter table public.clinic_settings
  drop constraint if exists clinic_settings_assistente_ia_check;
alter table public.clinic_settings
  add constraint clinic_settings_assistente_ia_check
  check (assistente_ia in ('desligado', 'sombra', 'ligado'));

comment on column public.clinic_settings.assistente_ia is
  'Atendente com IA no WhatsApp: desligado (robo de regras), sombra (o robo responde e a IA so escreve nota interna) ou ligado (a IA responde).';

grant update (assistente_ia) on table public.clinic_settings to authenticated;

alter table public.whatsapp_messages
  add column if not exists gerada_por_ia boolean not null default false;

comment on column public.whatsapp_messages.gerada_por_ia is
  'Mensagem escrita pelo atendente com IA (Claude), e nao pelo robo de regras nem pela equipe.';
