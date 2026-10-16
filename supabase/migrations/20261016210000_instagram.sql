-- Instagram da clinica no robo da Central de Cuidado (16/10/2026).
-- Ver supabase/functions/instagram-webhook, instagram-equipe e _shared/instagram.ts.
--
-- Tabelas proprias, e nao um "canal" nas do WhatsApp: muita coisa la trata o
-- wa_id como telefone (lembrete, acompanhamento, busca de paciente, janela de
-- 24 h, modelo aprovado). Um id do Instagram ali dentro seria um envio de
-- WhatsApp para um numero que nao existe, em algum caminho que ninguem lembrou.
-- Separado, o WhatsApp em producao nao muda nada.

create table if not exists public.instagram_contas (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  ig_user_id text not null unique,
  username text,
  -- So o servidor le (ver os grants abaixo): a tela nunca recebe o token.
  access_token text not null,
  token_expira_em timestamptz,
  token_renovado_em timestamptz,
  -- Numero do WhatsApp da clinica (so digitos, com 55): o destino do link de agendamento.
  whatsapp text not null,
  robo_direct boolean not null default true,
  robo_comentarios boolean not null default true,
  -- Falha barulhenta: o ultimo envio recusado aparece em vermelho na tela.
  ultimo_erro text,
  ultimo_erro_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_conversas (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  igsid text not null,
  username text,
  status text not null default 'aberta' check (status in ('aberta', 'concluida')),
  precisa_equipe boolean not null default false,
  motivo text check (motivo is null or motivo in ('urgencia', 'medico', 'atendente', 'falha')),
  nao_lidas integer not null default 0,
  ultima_mensagem_em timestamptz not null default now(),
  ultima_da_pessoa_em timestamptz,
  created_at timestamptz not null default now(),
  unique (clinic_id, igsid)
);
create index if not exists instagram_conversas_recentes_idx on public.instagram_conversas (clinic_id, ultima_mensagem_em desc);

create table if not exists public.instagram_mensagens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversa_id uuid not null references public.instagram_conversas(id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida', 'nota')),
  texto text,
  mid text unique,
  automatica boolean not null default false,
  anexo_url text,
  -- 'enviando': gravada antes do envio, para o eco da Meta reconhecer a mensagem (ver instagram-webhook).
  status text not null default 'enviada' check (status in ('recebida', 'enviando', 'enviada', 'falhou')),
  erro text,
  created_at timestamptz not null default now()
);
create index if not exists instagram_mensagens_conversa_idx on public.instagram_mensagens (conversa_id, created_at);

create table if not exists public.instagram_comentarios (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  comment_id text not null unique,
  media_id text,
  autor_id text,
  autor_username text,
  texto text,
  precisa_equipe boolean not null default false,
  respondido_no_direct_em timestamptz,
  resposta_publica text,
  respondido_em_publico_em timestamptz,
  erro text,
  created_at timestamptz not null default now()
);
create index if not exists instagram_comentarios_recentes_idx on public.instagram_comentarios (clinic_id, created_at desc);

alter table public.instagram_contas enable row level security;
alter table public.instagram_conversas enable row level security;
alter table public.instagram_mensagens enable row level security;
alter table public.instagram_comentarios enable row level security;
alter table public.instagram_contas force row level security;
alter table public.instagram_conversas force row level security;
alter table public.instagram_mensagens force row level security;
alter table public.instagram_comentarios force row level security;

drop policy if exists instagram_contas_select_member on public.instagram_contas;
create policy instagram_contas_select_member on public.instagram_contas for select to authenticated
using ((select private.is_clinic_member(clinic_id)));
drop policy if exists instagram_contas_update_owner on public.instagram_contas;
create policy instagram_contas_update_owner on public.instagram_contas for update to authenticated
using ((select private.is_clinic_owner(clinic_id))) with check ((select private.is_clinic_owner(clinic_id)));

drop policy if exists instagram_conversas_select_member on public.instagram_conversas;
create policy instagram_conversas_select_member on public.instagram_conversas for select to authenticated
using ((select private.is_clinic_member(clinic_id)));
drop policy if exists instagram_conversas_update_editor on public.instagram_conversas;
create policy instagram_conversas_update_editor on public.instagram_conversas for update to authenticated
using ((select private.is_clinic_editor(clinic_id))) with check ((select private.is_clinic_editor(clinic_id)));

drop policy if exists instagram_mensagens_select_member on public.instagram_mensagens;
create policy instagram_mensagens_select_member on public.instagram_mensagens for select to authenticated
using ((select private.is_clinic_member(clinic_id)));

drop policy if exists instagram_comentarios_select_member on public.instagram_comentarios;
create policy instagram_comentarios_select_member on public.instagram_comentarios for select to authenticated
using ((select private.is_clinic_member(clinic_id)));
drop policy if exists instagram_comentarios_update_editor on public.instagram_comentarios;
create policy instagram_comentarios_update_editor on public.instagram_comentarios for update to authenticated
using ((select private.is_clinic_editor(clinic_id))) with check ((select private.is_clinic_editor(clinic_id)));

revoke all on table public.instagram_contas from public, anon, authenticated;
revoke all on table public.instagram_conversas from public, anon, authenticated;
revoke all on table public.instagram_mensagens from public, anon, authenticated;
revoke all on table public.instagram_comentarios from public, anon, authenticated;

-- Coluna a coluna: access_token fica de fora de proposito.
grant select (clinic_id, ig_user_id, username, whatsapp, token_expira_em, token_renovado_em, robo_direct, robo_comentarios,
  ultimo_erro, ultimo_erro_em, created_at, updated_at) on table public.instagram_contas to authenticated;
grant update (whatsapp, robo_direct, robo_comentarios) on table public.instagram_contas to authenticated;
grant select on table public.instagram_conversas to authenticated;
grant update (status, precisa_equipe, motivo, nao_lidas) on table public.instagram_conversas to authenticated;
grant select on table public.instagram_mensagens to authenticated;
grant select on table public.instagram_comentarios to authenticated;
grant update (precisa_equipe) on table public.instagram_comentarios to authenticated;

grant all on table public.instagram_contas to service_role;
grant all on table public.instagram_conversas to service_role;
grant all on table public.instagram_mensagens to service_role;
grant all on table public.instagram_comentarios to service_role;
