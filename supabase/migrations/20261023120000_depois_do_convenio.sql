begin;

/**
 * "Sobre o Dr. Marcello" 30 minutos depois de quem perguntou convenio ou preco
 * e nao escreveu mais (23/10/2026, pedido do Edu).
 *
 * after_price_silence: a resposta pronta que a funcao depois-do-convenio manda
 * sozinha. Desligada para o robo (is_active false) ela continua aparecendo para
 * a equipe na conversa, marcada "(so equipe)". Comeca falsa em todas: nada sai
 * ate alguem ligar a chave na tela de Respostas prontas.
 *
 * O cron roda a cada 10 minutos, o dia todo; a regra (8h as 22h, 30 min de
 * silencio, uma vez por familia) mora em _shared/depois-do-convenio.ts.
 * Mesmo desenho do disparar_bom_dia_da_equipe: o segredo e lido do Vault e a
 * falta dele grita no log.
 */
alter table public.bot_answers
  add column if not exists after_price_silence boolean not null default false;

comment on column public.bot_answers.after_price_silence is
  'Texto que a funcao depois-do-convenio manda 30 min depois de quem perguntou convenio ou preco e sumiu.';

create or replace function private.disparar_depois_do_convenio()
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
    raise warning 'cron_secret ausente no Vault; envio depois do convenio nao sera feito';
    return;
  end if;

  perform net.http_post(
    url := 'https://favohmryseurvnlxocfc.supabase.co/functions/v1/depois-do-convenio'::text,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', segredo
    ),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function private.disparar_depois_do_convenio() from public, anon, authenticated;

comment on function private.disparar_depois_do_convenio() is
  'Chama a Edge Function depois-do-convenio com o segredo do Vault. Avisa no log quando nao acha o segredo.';

select cron.unschedule('depois-do-convenio')
where exists (select 1 from cron.job where jobname = 'depois-do-convenio');

select cron.schedule(
  'depois-do-convenio',
  '*/10 * * * *',
  $$ select private.disparar_depois_do_convenio(); $$
);

/**
 * O texto, cadastrado so na clinica real e so se ainda nao existe (rodar de
 * novo nao duplica; o que a equipe editar na tela fica). Entra DESLIGADO para
 * o robo (is_active false: ele nunca o manda por palavra-chave) e com a chave
 * do envio automatico DESLIGADA: a lista do que o medico trata e a "consulta
 * longa e sem pressa" ainda esperam o OK do Dr. Marcello. Quem liga e a
 * equipe, na tela de Respostas prontas. Texto aprovado pelo Edu em 23/10/2026
 * (26 anos de experiencia como medico e professor de medicina).
 */
do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
  n int;
begin
  insert into public.bot_answers (clinic_id, subject, keywords, answer, ask_unit, position, is_active, after_price_silence)
  select c, 'Sobre o Dr. Marcello', array[]::text[], E'Oi! Passando para te contar um pouco mais sobre o Dr. Marcello, para ajudar na sua decisão 😊\n\n👨‍⚕️ *Dr. Marcello Ruiz* é gastroenterologista pediátrico, com *mestrado e doutorado pela Unifesp* e *26 anos de experiência como médico e professor de medicina*. Cuida da barriga das crianças, do recém-nascido ao adolescente.\n\n🩺 *O que ele trata:*\n• refluxo e vômitos frequentes\n• cólica e choro excessivo no bebê\n• alergia ao leite (APLV) e outras alergias alimentares\n• intestino preso e diarreia que não passa\n• doença celíaca e intolerâncias\n• dor de barriga que vai e volta\n• dificuldade para ganhar peso\n\n⏱️ A consulta é *longa e sem pressa*, para entender a história toda e sair com um plano claro.\n\n📍 Atende em *Santos* (Livance Gonzaga), em *São Paulo* (Livance Ibirapuera) e por *vídeo*.\n\n💳 Mesmo sem convênio, emitimos *recibo com CRM e CNPJ para pedir reembolso* ao seu plano.\n\nSe quiser, te mostro os próximos horários livres. É só me responder aqui 💚', false, 900, false, false
  where exists (select 1 from public.clinics where id = c)
    and not exists (
      select 1 from public.bot_answers
       where clinic_id = c and lower(btrim(subject)) = 'sobre o dr. marcello'
    );
  get diagnostics n = row_count;
  raise notice 'Resposta "Sobre o Dr. Marcello" criada: %', n;
end
$$;

commit;
