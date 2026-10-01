begin;

/**
 * A virada de Santos para a Livance travou em 01/10/2026.
 *
 * A tarefa da madrugada (private.mudar_santos_para_livance) chegou na etapa
 * de 01/10 - trocar a unidade no cadastro dos pacientes - e o gatilho
 * sync_patient_consultations copiou essa troca para a ultima consulta de cada
 * paciente. 28 dos 51 tinham a ultima consulta assinada digitalmente, e
 * consultations_assinada_nao_muda recusou: "Este atendimento foi assinado
 * digitalmente e nao pode mais ser alterado". Como tudo era uma transacao so,
 * caiu junto o resto - a Liferty seguiu ativa e o robo continuou oferecendo o
 * endereco antigo para agendar.
 *
 * As consultas de outubro ja tinham sido movidas nos dias anteriores (nenhuma
 * familia ficou marcada na Liferty).
 *
 * Duas correcoes:
 *
 *  1. sync_patient_consultations nao tenta mais escrever em consulta
 *     assinada. O mesmo defeito acontecia na tela: mudar a unidade ou o CID
 *     no cadastro de um paciente com a ultima consulta assinada dava erro e
 *     nao salvava nada.
 *
 *  2. Troca em lote pode pedir para nao mexer no prontuario
 *     (set_config central.sem_sincronizar_prontuario). A virada usa isso: a
 *     consulta de setembro aconteceu na Liferty e assim continua registrada.
 *
 * E roda a virada de novo, agora.
 */

create or replace function private.sync_patient_consultations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_consultation_id uuid;
begin
  -- A consultation trigger writes the legacy summary back to patients. Do not
  -- mirror that nested write into the consultation a second time.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Troca em lote que NAO deve reescrever o prontuario (ver o cabecalho).
  if coalesce(current_setting('central.sem_sincronizar_prontuario', true), '') = 'on' then
    return new;
  end if;

  if new.archived_at is not null and old.archived_at is null then
    update public.consultations
    set archived_at = new.archived_at
    where patient_id = new.id
      and clinic_id = new.clinic_id
      and archived_at is null;
  elsif new.archived_at is null and old.archived_at is not null then
    update public.consultations
    set archived_at = null
    where patient_id = new.id
      and clinic_id = new.clinic_id
      and archived_at = old.archived_at;

    update public.followups
    set archived_at = null
    where patient_id = new.id
      and clinic_id = new.clinic_id
      and archived_at = old.archived_at;
  end if;

  if new.archived_at is null
     and row(new.consultation_date, new.cid, new.unit)
       is distinct from
       row(old.consultation_date, old.cid, old.unit) then
    select consultation.id
    into current_consultation_id
    from public.consultations consultation
    where consultation.patient_id = new.id
      and consultation.clinic_id = new.clinic_id
      and consultation.archived_at is null
    order by
      exists (
        select 1
        from public.followups followup
        where followup.consultation_id = consultation.id
          and followup.archived_at is null
      ) desc,
      consultation.consultation_date desc,
      consultation.created_at desc
    limit 1;

    if current_consultation_id is not null then
      update public.consultations
      set
        consultation_date = new.consultation_date,
        cid = new.cid,
        unit = new.unit
      where id = current_consultation_id
        -- Consulta assinada nao muda (consultations_assinada_nao_muda): tentar
        -- derrubava a edicao inteira do cadastro.
        and signed_at is null
        and row(consultation_date, cid, unit)
          is distinct from
          row(new.consultation_date, new.cid, new.unit);
    end if;
  end if;

  return new;
end
$function$;

create or replace function private.mudar_santos_para_livance()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  virada timestamptz := timestamptz '2026-10-01 00:00:00-03';
  -- A mesma frase que a migration pos na resposta de endereco.
  transicao text := E'\n(Até 30/09, as consultas de Santos ainda são na Liferty: Al. Armênio Mendes, 66, sala 2912, Aparecida.)';
  aviso_conflito text := 'NAO MOVIDA para a Livance · Santos: o horario ja esta ocupado la. Remarcar.';
  liferty record;
  consulta record;
  livance uuid;
  movidas integer := 0;
  presas integer;
begin
  for liferty in
    select id, clinic_id
      from public.clinic_units
     where archived_at is null
       and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos'
  loop
    select id into livance
      from public.clinic_units
     where clinic_id = liferty.clinic_id
       and archived_at is null
       and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos'
     limit 1;

    if livance is null then
      -- Sem Livance nao ha para onde mover. Gritar, e nao arquivar a Liferty:
      -- arquivada sem substituta, Santos sumiria do robo.
      raise warning 'mudar_santos_para_livance: clinica % tem Liferty mas nao tem Livance · Santos. Nada foi movido.', liferty.clinic_id;
      continue;
    end if;

    -- Uma a uma: um UPDATE unico pararia inteiro na primeira colisao com o
    -- indice de horario unico, e levaria junto o arquivamento de 01/10.
    presas := 0;
    for consulta in
      select id, staff_note
        from public.appointments
       where unit_id = liferty.id
         and starts_at >= virada
    loop
      begin
        update public.appointments set unit_id = livance where id = consulta.id;
        movidas := movidas + 1;
      exception when unique_violation then
        presas := presas + 1;
        update public.appointments
           set staff_note = left(
                 case when consulta.staff_note = '' then aviso_conflito
                      else consulta.staff_note || ' | ' || aviso_conflito end,
                 500)
         where id = consulta.id
           and strpos(staff_note, aviso_conflito) = 0;
        raise warning 'mudar_santos_para_livance: consulta % ficou na Liferty (horario ocupado na Livance). Remarcar.', consulta.id;
      end;
    end loop;

    if hoje >= date '2026-10-01' then
      -- A unidade do CADASTRO passa a ser a Livance; o prontuario fica como
      -- foi - a consulta de setembro aconteceu na Liferty. Sem a trava, o
      -- gatilho sync_patient_consultations copiava a unidade para a ultima
      -- consulta, e a assinada recusava (01/10/2026).
      --
      -- Em bloco proprio: se isto falhar, o resto (arquivar a Liferty, tirar
      -- o aviso de transicao) segue, e o erro aparece no log.
      begin
        perform set_config('central.sem_sincronizar_prontuario', 'on', true);
        update public.patients
           set unit = 'Livance · Santos'
         where clinic_id = liferty.clinic_id
           and lower(regexp_replace(unit, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos';
        perform set_config('central.sem_sincronizar_prontuario', '', true);
      exception when others then
        perform set_config('central.sem_sincronizar_prontuario', '', true);
        raise warning 'mudar_santos_para_livance: cadastro dos pacientes nao mudou de unidade: %', sqlerrm;
      end;

      update public.bot_answers
         set answer = replace(answer, transicao, '')
       where clinic_id = liferty.clinic_id
         and strpos(answer, transicao) > 0;

      if presas = 0 then
        update public.clinic_units
           set archived_at = now()
         where id = liferty.id;
      end if;
    end if;
  end loop;

  -- So se desagenda quando nao sobrou Liferty ativa: com consulta presa, a
  -- tarefa segue tentando todo dia.
  if hoje >= date '2026-10-01'
     and not exists (
       select 1 from public.clinic_units
        where archived_at is null
          and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos'
     )
     and exists (select 1 from cron.job where jobname = 'mudar-santos-para-livance') then
    perform cron.unschedule('mudar-santos-para-livance');
  end if;

  raise log 'mudar_santos_para_livance: % consulta(s) movida(s) para a Livance · Santos', movidas;
  return movidas;
end
$fn$;

revoke all on function private.mudar_santos_para_livance() from public, anon, authenticated;

select private.mudar_santos_para_livance();

do $$
begin
  if exists (select 1 from public.clinic_units
              where archived_at is null
                and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos') then
    raise warning 'Liferty · Santos continua ativa depois da virada. Conferir consultas presas.';
  end if;
end
$$;

commit;
