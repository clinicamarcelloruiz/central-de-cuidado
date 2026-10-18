begin;

/**
 * Cadastro que nasceu com o nome do contato do WhatsApp (18/10/2026).
 *
 * Quando a ficha fica sem o nome da crianca, o cadastro automatico usa o nome
 * do contato, que quase sempre e o da mae ou do pai. No painel de pacientes
 * simulados (rodada 8) uma menina foi cadastrada como "Marina", a mae. O Edu
 * preferiu manter o cadastro (sem ele nao ha prontuario), mas com um aviso
 * vermelho no prontuario ate alguem confirmar o nome.
 *
 * Nulo depois que alguem da equipe salva o cadastro com o nome conferido.
 */
alter table public.patients
  add column if not exists name_from_contact_at timestamptz;

comment on column public.patients.name_from_contact_at is
  'Quando o sistema criou o cadastro com o nome do contato do WhatsApp, porque a ficha ficou sem o nome da crianca. Nulo depois que alguem da equipe confere e salva o nome.';

-- A tela limpa a marca ao salvar o cadastro com o nome conferido.
grant update (name_from_contact_at) on table public.patients to authenticated;

commit;
