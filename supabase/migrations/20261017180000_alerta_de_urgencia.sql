-- Alerta de urgencia no WhatsApp pessoal (17/10/2026).
--
-- Pedido do Edu: quando o robo ou a IA entendem que uma crianca esta mal, o
-- Dr. Marcello e o Edu recebem uma mensagem no WhatsApp deles, a qualquer
-- hora. Ate aqui a urgencia so acendia a conversa na Central e mandava
-- notificacao para quem tinha o app instalado.
--
-- Os numeros moram aqui, editaveis no cartao "Atendente com IA", e nao num
-- segredo do Supabase: trocar o numero de quem recebe nao pode depender de
-- alguem lembrar de mexer no painel (o lembrete da vespera ficou tres semanas
-- parado por um segredo escrito errado). Coluna nova: as funcoes leem em
-- consulta separada, com try/catch, e sem ela so o alerta deixa de sair - com
-- erro no log.

alter table public.clinic_settings
  add column if not exists alerta_urgencia_telefones text[] not null default '{}'::text[];

comment on column public.clinic_settings.alerta_urgencia_telefones is
  'Celulares (55 + DDD + numero) que recebem o modelo alerta_urgencia quando uma conversa entra em urgencia, a qualquer hora. Editavel em Preferencias > Atendente com IA.';

grant update (alerta_urgencia_telefones) on table public.clinic_settings to authenticated;

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
