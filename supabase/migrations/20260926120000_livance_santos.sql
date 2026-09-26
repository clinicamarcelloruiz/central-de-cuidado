begin;

/**
 * Santos muda da Liferty para a Livance em 01/10/2026.
 *
 * A Liferty (Al. Armenio Mendes, 66, sala 2912) encerra em 30/09. A partir de
 * 01/10 o Dr. Marcello atende em Santos na Livance: Av. Anna Costa, 228, 20o e
 * 21o andares, Gonzaga. Mesmos dias e horarios. O pagamento passa a ser no
 * totem da Livance, depois da consulta: pix, debito ou credito a vista.
 *
 * Por que uma unidade NOVA, e nao renomear a Liferty: ate 30/09 ainda ha
 * consultas la. Renomeada, o lembrete de 29/09 mandaria a familia para a Anna
 * Costa - e o historico de quem foi atendido na Liferty passaria a dizer
 * Livance.
 *
 * Por que a transicao tem quatro dias com as duas unidades no ar: a Liferty
 * precisa continuar visivel na Agenda ate atender a ultima consulta (a tela
 * nao mostra unidade arquivada), e a Livance precisa existir desde ja para
 * quem marca outubro. Para o robo nao oferecer o dia errado no lugar errado:
 *  - Livance: mesmas regras semanais, fechada ate 30/09;
 *  - Liferty: perde as regras semanais e fica so com os ultimos dias, como
 *    horario avulso, e com um aviso no texto dela.
 *
 * Por que tirar as regras da Liferty, e nao bloquear outubro dia a dia: o
 * robo so enxerga 15 dias, mas o "marcar retorno" do prontuario procura em
 * 30, 60, 90 dias. Com outubro bloqueado, um retorno pedido em 29/09 cairia
 * na Liferty em dezembro.
 *
 * O que acontece sozinho em 01/10 (tarefa diaria, ver
 * private.mudar_santos_para_livance): a Liferty e arquivada e some do robo e
 * das telas, o cadastro dos pacientes passa para Livance · Santos, e sai da
 * resposta de endereco a frase de transicao. Todo dia ate la a mesma tarefa
 * move para a Livance qualquer consulta de outubro em diante que ainda tenha
 * caido na Liferty (uma conversa que ja estava no meio do agendamento quando
 * isto subiu). Roda 00h40, antes dos lembretes, que saem no minuto 20.
 *
 * Se uma consulta nao puder ser movida porque o horario ja esta ocupado na
 * Livance, ela fica na Liferty com um aviso na observacao da equipe, e a
 * Liferty NAO e arquivada - arquivada, a consulta sumiria da Agenda. A tarefa
 * continua tentando todo dia, e a Liferty visivel e o sinal de que ha o que
 * remarcar.
 *
 * Textos editaveis pela clinica (respostas prontas, texto da unidade) sao
 * trocados por replace() do trecho que as migrations escreveram. Se a clinica
 * reescreveu pela tela, o trecho nao bate, nada muda e a conferencia no fim
 * avisa no log do deploy.
 *
 * Fica para a clinica, pela tela, em 01/10: o endereco do perfil do WhatsApp
 * (Preferencias). A coluna sozinha nao muda nada na Meta - quem envia e a tela.
 */

-- ---------------------------------------------------------------
-- A tarefa da mudanca. Criada primeiro porque a migration ja a chama no fim.
-- ---------------------------------------------------------------

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
      update public.patients
         set unit = 'Livance · Santos'
       where clinic_id = liferty.clinic_id
         and lower(regexp_replace(unit, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos';

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

comment on function private.mudar_santos_para_livance() is
  'Transicao Liferty -> Livance em Santos (01/10/2026). Move consultas de outubro; a partir de 01/10 arquiva a Liferty e se desagenda.';

-- ---------------------------------------------------------------
-- A unidade nova, a agenda dela e o aviso na Liferty
-- ---------------------------------------------------------------

do $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  liferty record;
  livance uuid;
  texto text;
  achou boolean := false;
  endereco_livance text := E'📍 Livance · Santos — Av. Anna Costa, 228, 20º e 21º andares, Gonzaga. Estacionamento no próprio prédio, com entrada ao lado da portaria.\n\n' ||
    E'🖥️ Ao chegar, faça o check-in no totem digitando o nome do paciente. O Dr. Marcello recebe o aviso e vem chamar vocês na sala de espera assim que terminar a consulta anterior.';
  pagamento_livance text := 'Pagamento depois da consulta, no totem: pix, débito ou crédito à vista.';
  aviso_liferty text := E'\n\n⚠️ *Atendimento neste endereço até 30/09.* A partir de 01/10, em Santos, atendemos na Livance: Av. Anna Costa, 228, 20º e 21º andares, Gonzaga.';
begin
  for liferty in
    select id, clinic_id, info_text
      from public.clinic_units
     where archived_at is null
       and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos'
  loop
    achou := true;

    select id into livance
      from public.clinic_units
     where clinic_id = liferty.clinic_id
       and archived_at is null
       and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos'
     limit 1;

    if livance is not null then
      -- Alguem ja criou pela tela. Nao duplicar; a agenda dela e dela.
      raise warning 'Livance · Santos ja existia na clinica %: unidade, regras e bloqueios NAO foram criados. Conferir a Agenda.', liferty.clinic_id;
    else
      -- O texto de informacoes parte do da Liferty, para levar valor e o que
      -- a clinica tenha ajustado; troca so endereco e pagamento. Se o texto
      -- nao tem a forma esperada, vai o texto completo escrito aqui.
      texto := regexp_replace(coalesce(liferty.info_text, ''), '📍[^\n]*', endereco_livance);
      texto := replace(texto, 'Pagamento somente em pix ou dinheiro.', pagamento_livance);
      if strpos(texto, 'Anna Costa') = 0
         or strpos(texto, pagamento_livance) = 0
         or char_length(texto) > 1024 then
        raise warning 'Texto da Liferty fora do formato esperado: Livance · Santos recebeu o texto padrao (R$ 450). Conferir em Respostas do robo.';
        texto := E'💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\n' ||
          E'💳 ' || pagamento_livance || E' Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.\n\n' ||
          endereco_livance || E'\n\n' ||
          E'📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.';
      end if;

      -- CNES fica vazio: e outro estabelecimento, e a Memed so recebe o numero
      -- quando a clinica o cadastrar. Vazio, o campo simplesmente nao vai.
      insert into public.clinic_units (clinic_id, name, address, info_text)
      values (
        liferty.clinic_id,
        'Livance · Santos',
        'Av. Anna Costa, 228, 20º e 21º andares, Gonzaga, Santos - SP',
        texto
      )
      returning id into livance;

      -- Mesmos dias e horarios.
      insert into public.availability_rules (clinic_id, unit_id, weekday, starts_at, ends_at)
      select clinic_id, livance, weekday, starts_at, ends_at
        from public.availability_rules
       where unit_id = liferty.id;

      -- Bloqueios de outubro em diante que a clinica ja tinha lancado na
      -- Liferty (ferias, congresso) valem para a Livance.
      insert into public.schedule_exceptions (clinic_id, unit_id, exception_date, is_closed, starts_at, ends_at, reason)
      select clinic_id, livance, exception_date, is_closed, starts_at, ends_at, reason
        from public.schedule_exceptions
       where unit_id = liferty.id
         and exception_date >= date '2026-10-01';

      -- Livance fechada ate 30/09.
      insert into public.schedule_exceptions (clinic_id, unit_id, exception_date, is_closed, reason)
      select liferty.clinic_id, livance, d::date, true, 'Livance · Santos começa em 01/10'
        from generate_series(hoje, date '2026-09-30', interval '1 day') d;
    end if;

    -- Liferty: os dias que restam ate 30/09 viram horario avulso, e as regras
    -- semanais saem. Assim nenhuma busca, de qualquer largura, acha vaga na
    -- Liferty depois de 30/09. Dia ja bloqueado (da unidade ou da clinica
    -- toda) fica de fora: horario avulso passa por cima de bloqueio.
    insert into public.schedule_exceptions (clinic_id, unit_id, exception_date, is_closed, starts_at, ends_at, reason)
    select liferty.clinic_id, liferty.id, d::date, false, r.starts_at, r.ends_at, 'Últimos dias na Liferty'
      from generate_series(hoje, date '2026-09-30', interval '1 day') d
      join public.availability_rules r
        on r.unit_id = liferty.id
       and r.weekday = extract(dow from d)::smallint
     where not exists (
       select 1 from public.schedule_exceptions e
        where e.clinic_id = liferty.clinic_id
          and e.exception_date = d::date
          and e.is_closed
          and (e.unit_id is null or e.unit_id = liferty.id)
     );

    delete from public.availability_rules where unit_id = liferty.id;

    -- Quem pedir informacoes da Liferty nestes dias fica sabendo da mudanca.
    update public.clinic_units
       set info_text = info_text || aviso_liferty
     where id = liferty.id
       and strpos(info_text, 'Atendimento neste endereço até 30/09') = 0
       and char_length(info_text || aviso_liferty) <= 1024;
  end loop;

  if not achou then
    raise warning 'Nenhuma unidade Liferty · Santos ativa encontrada: nada foi criado nem movido.';
  end if;
end $$;

-- ---------------------------------------------------------------
-- Respostas prontas
-- ---------------------------------------------------------------

-- Endereco: a linha da Liferty vira a da Livance, com a frase de transicao
-- que a tarefa de 01/10 tira.
update public.bot_answers
set answer = regexp_replace(
      answer,
      '📍 \*Liferty[^\n]*',
      E'📍 *Livance · Santos* — Av. Anna Costa, 228, 20º e 21º andares, Gonzaga, Santos.\n(Até 30/09, as consultas de Santos ainda são na Liferty: Al. Armênio Mendes, 66, sala 2912, Aparecida.)'
    ),
    keywords = case
      when array_length(keywords, 1) is null or array_length(keywords, 1) <= 38
        then array(select distinct unnest(keywords || array['livance', 'gonzaga']))
      else keywords
    end
where subject = 'Endereço e estacionamento'
  and answer ~ '📍 \*Liferty';

-- Valor e pagamento. Com ask_unit ligado o robo responde o texto da unidade;
-- este texto e a reserva, e nao pode contradizer a unidade.
update public.bot_answers
set answer = replace(
      answer,
      'Pagamento somente em pix ou dinheiro.',
      'Pagamento: em Santos, no totem da Livance, por pix, débito ou crédito à vista; em São Paulo, pix ou dinheiro; na telemedicina, pix.'
    ),
    keywords = case
      when array_length(keywords, 1) is null or array_length(keywords, 1) <= 37
        then array(select distinct unnest(keywords || array['totem', 'debito', 'credito']))
      else keywords
    end
where subject = 'Valor e pagamento'
  and strpos(answer, 'Pagamento somente em pix ou dinheiro.') > 0;

-- Convenios: o meio de pagamento sai daqui, que ja nao e um so.
update public.bot_answers
set answer = replace(answer, ', com pagamento em pix ou dinheiro, em todas', ', em todas')
where subject = 'Convênios'
  and strpos(answer, ', com pagamento em pix ou dinheiro, em todas') > 0;

-- ---------------------------------------------------------------
-- Consultas de outubro ja marcadas na Liferty, e a tarefa diaria
-- ---------------------------------------------------------------

select private.mudar_santos_para_livance();

select cron.unschedule('mudar-santos-para-livance')
where exists (select 1 from cron.job where jobname = 'mudar-santos-para-livance');

-- Se esta migration subir depois de 01/10, a chamada acima ja fez tudo e nao
-- ha o que agendar.
select cron.schedule(
  'mudar-santos-para-livance',
  '40 3 * * *',
  $$ select private.mudar_santos_para_livance(); $$
)
where (now() at time zone 'America/Sao_Paulo')::date < date '2026-10-01';

-- ---------------------------------------------------------------
-- Conferencia. Nao derruba a migration (travaria todas as seguintes), mas
-- grita no log do deploy.
-- ---------------------------------------------------------------

do $$
declare
  n integer;
begin
  select count(*) into n
    from public.bot_answers
   where is_active
     and answer ilike '%liferty%'
     and strpos(answer, 'Até 30/09') = 0;
  if n > 0 then
    raise warning 'ATENCAO: % resposta(s) do robo ainda citam a Liferty como endereco atual. Corrigir em Respostas do robo.', n;
  end if;

  select count(*) into n
    from public.bot_answers
   where is_active
     and answer ilike '%somente em pix ou dinheiro%';
  if n > 0 then
    raise warning 'ATENCAO: % resposta(s) do robo ainda dizem "somente pix ou dinheiro". Santos passa a aceitar cartao.', n;
  end if;

  select count(*) into n
    from public.clinic_units
   where archived_at is null
     and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos'
     and (info_text ilike '%dinheiro%' or info_text ilike '%armênio%');
  if n > 0 then
    raise warning 'ATENCAO: o texto da Livance · Santos ainda fala em dinheiro ou no endereco da Liferty.';
  end if;

  select count(*) into n
    from public.clinic_settings
   where whatsapp_profile_address ilike '%armênio%';
  if n > 0 then
    raise warning 'Lembrete: o perfil do WhatsApp ainda mostra a Liferty. Trocar em Preferencias a partir de 01/10.';
  end if;
end $$;

commit;
