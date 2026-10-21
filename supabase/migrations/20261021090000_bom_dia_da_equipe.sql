begin;

/**
 * Bom dia das 8h para quem chamou a equipe fora do horario (21/10/2026).
 *
 * Ver supabase/functions/bom-dia-da-equipe e _shared/bom-dia-da-equipe.ts. O
 * cron roda em UTC: 11h UTC sao 8h em Sao Paulo (sem horario de verao desde
 * 2019). De segunda a sexta; o feriado a propria regra recusa.
 *
 * Mesmo desenho do disparar_ficha_pendente: o segredo e lido do Vault dentro
 * de uma funcao, aceita os dois nomes, e a falta dele grita no log - o
 * lembrete ficou tres semanas parado por um erro de maiusculas que ninguem
 * via (20260920180000_consertar_segredo_do_lembrete).
 */
create or replace function private.disparar_bom_dia_da_equipe()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  segredo text;
begin
  select decrypted_secret into segredo
  from vault.decrypted_secrets
  where name in ('cron_secret', 'CRON_SECRET')
  order by case when name = 'cron_secret' then 0 else 1 end
  limit 1;

  if segredo is null then
    raise warning 'cron_secret ausente no Vault; bom dia da equipe nao sera enviado';
    return;
  end if;

  perform net.http_post(
    url := 'https://favohmryseurvnlxocfc.supabase.co/functions/v1/bom-dia-da-equipe'::text,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', segredo
    ),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function private.disparar_bom_dia_da_equipe() from public, anon, authenticated;

comment on function private.disparar_bom_dia_da_equipe() is
  'Chama a Edge Function do bom dia da equipe com o segredo do Vault. Avisa no log quando nao acha o segredo.';

select cron.unschedule('bom-dia-da-equipe')
where exists (select 1 from cron.job where jobname = 'bom-dia-da-equipe');

select cron.schedule(
  'bom-dia-da-equipe',
  '0 11 * * 1-5',
  $$ select private.disparar_bom_dia_da_equipe(); $$
);

commit;
