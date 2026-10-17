begin;

/**
 * Busca automatica de comentarios do Instagram (16/10/2026).
 *
 * POR QUE: a Meta so manda aviso de comentario para app com Acesso Avancado, e
 * pedir isso na analise do app exige virar "Tech Provider" - cadastro sem volta,
 * feito para quem atende outras empresas. A clinica nao quis. Ler os comentarios
 * dos proprios posts e responde-los funciona sem isso, entao o agendador chama a
 * funcao instagram-webhook a cada 10 minutos, e o robo responde o comentario
 * novo como se o aviso tivesse chegado (ver separarComentariosDaBusca em
 * supabase/functions/_shared/instagram.ts).
 *
 * comentarios_buscados_em: a hora da ultima rodada. A tela mostra "ultima busca
 * ha X min" e fica vermelha se parar. Foi um agendador que parou em silencio
 * (o lembrete da vespera, 20260920180000) que custou tres semanas em setembro.
 */
alter table public.instagram_contas add column if not exists comentarios_buscados_em timestamptz;
grant select (comentarios_buscados_em) on table public.instagram_contas to authenticated;

-- Mesmo molde de private.disparar_lembretes_de_consulta: segredo do Vault com
-- os dois nomes aceitos, e grito no log se nenhum existir.
create or replace function private.buscar_comentarios_do_instagram()
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
    raise warning 'cron_secret ausente no Vault; a busca de comentarios do Instagram nao vai rodar';
    return;
  end if;

  perform net.http_post(
    url := 'https://favohmryseurvnlxocfc.supabase.co/functions/v1/instagram-webhook'::text,
    body := '{"acao":"buscar_comentarios"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', segredo
    ),
    -- Onze chamadas ao Instagram por conta: passa dos 5 s padrao do pg_net.
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.buscar_comentarios_do_instagram() from public, anon, authenticated;

comment on function private.buscar_comentarios_do_instagram() is
  'Chama a funcao instagram-webhook para buscar e responder comentarios novos. Aceita cron_secret e CRON_SECRET, e avisa no log quando nao acha nenhum.';

select cron.unschedule('instagram-comentarios')
where exists (select 1 from cron.job where jobname = 'instagram-comentarios');

select cron.schedule(
  'instagram-comentarios',
  '*/10 * * * *',
  $$ select private.buscar_comentarios_do_instagram(); $$
);

commit;
