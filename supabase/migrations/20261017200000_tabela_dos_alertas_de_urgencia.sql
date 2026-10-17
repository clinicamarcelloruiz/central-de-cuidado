-- A tabela dos alertas de urgencia, em migration propria (17/10/2026).
--
-- Ela foi escrita primeiro dentro de 20261017180000_alerta_de_urgencia.sql,
-- DEPOIS de aquele arquivo ja ter sido aplicado no PUBLICAR das 15:31 - e o
-- supabase db push nao roda de novo o que ja aplicou. Resultado: a coluna dos
-- numeros existia, a tabela nao, e a resposta do medico ao alerta caia no
-- robo de sempre (o codigo previa a falta da tabela, nada quebrou). E a regra
-- do CLAUDE.md, quebrada sem perceber: migration aplicada nunca se edita. O
-- arquivo das 15:31 voltou a ser exatamente o que rodou.
--
-- Cada alerta enviado, para a resposta do medico voltar a familia certa
-- (17/10/2026). O Dr. Marcello responde pelo WhatsApp dele: toca num botao do
-- alerta (urgente, pode aguardar, eu respondo) ou escreve a orientacao. Ver
-- _shared/resposta-ao-alerta.ts.
--
-- mensagens: os ids das mensagens de alerta na Meta. Quando ele responde "em
-- cima" do alerta, o WhatsApp manda esse id junto, e e assim que se sabe de
-- qual familia e a resposta sem perguntar.
-- rascunho: o texto que ele escreveu, esperando o "Enviar". Orientacao medica
-- em nome dele nao sai sem confirmacao: um "liga pra ela" que era para a
-- equipe nao pode chegar na mae.
create table if not exists public.alertas_de_urgencia (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  canal text not null check (canal in ('WhatsApp', 'Instagram')),
  conversa_whatsapp uuid references public.whatsapp_conversations(id) on delete cascade,
  conversa_instagram uuid references public.instagram_conversas(id) on delete cascade,
  -- O botao "Mandar alerta de teste" da tela: sem familia do outro lado.
  teste boolean not null default false,
  quem text not null default '',
  mensagens text[] not null default '{}'::text[],
  veredito text check (veredito is null or veredito in ('urgente', 'aguardar', 'responde', 'texto')),
  veredito_por text,
  veredito_em timestamptz,
  rascunho text,
  rascunho_de text,
  rascunho_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists alertas_de_urgencia_recentes_idx on public.alertas_de_urgencia (clinic_id, criado_em desc);

alter table public.alertas_de_urgencia enable row level security;
alter table public.alertas_de_urgencia force row level security;

drop policy if exists alertas_de_urgencia_select_member on public.alertas_de_urgencia;
create policy alertas_de_urgencia_select_member on public.alertas_de_urgencia for select to authenticated
using ((select private.is_clinic_member(clinic_id)));

revoke all on table public.alertas_de_urgencia from public, anon, authenticated;
grant select on table public.alertas_de_urgencia to authenticated;
grant all on table public.alertas_de_urgencia to service_role;
