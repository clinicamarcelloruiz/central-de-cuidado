begin;

/**
 * Gatilho manual do aviso da mudanca de Santos (Edge Function
 * aviso-mudanca-santos).
 *
 * Envio unico, para familias de verdade: por isso nao tem cron. Quem dispara e
 * uma pessoa, no editor SQL, em dois passos:
 *
 *   select private.disparar_aviso_mudanca_santos(true);   -- simula
 *   select private.disparar_aviso_mudanca_santos(false);  -- envia
 *
 * Cada chamada devolve o id do pedido no pg_net. A resposta da funcao - a
 * lista de quem recebeu, quem foi pulado e por que, e as falhas com o motivo
 * da Meta - fica em net._http_response:
 *
 *   select status_code, content::jsonb from net._http_response where id = <id>;
 *
 * O segredo sai do Vault, como no lembrete (ver 20260920180000), para nao
 * ficar escrito em lugar nenhum.
 */

create or replace function private.disparar_aviso_mudanca_santos(p_simular boolean default true)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  segredo text;
  pedido bigint;
begin
  select decrypted_secret into segredo
  from vault.decrypted_secrets
  where name in ('cron_secret', 'CRON_SECRET')
  order by case when name = 'cron_secret' then 0 else 1 end
  limit 1;

  if segredo is null then
    raise exception 'cron_secret ausente no Vault: o aviso nao foi disparado';
  end if;

  select net.http_post(
    url := 'https://favohmryseurvnlxocfc.supabase.co/functions/v1/aviso-mudanca-santos'::text,
    body := jsonb_build_object('simular', coalesce(p_simular, true)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', segredo
    ),
    timeout_milliseconds := 60000
  ) into pedido;

  return pedido;
end;
$$;

revoke all on function private.disparar_aviso_mudanca_santos(boolean) from public, anon, authenticated;

comment on function private.disparar_aviso_mudanca_santos(boolean) is
  'Dispara a Edge Function aviso-mudanca-santos. true simula (padrao), false envia. Devolve o id do pedido em net._http_response.';

commit;
