-- Demonstracao, parte 2: volume. Rodar DEPOIS de demo_clinica_teste.sql.
--
-- A parte 1 criou 7 pacientes detalhados para as cenas de prontuario. Com 8
-- pacientes os graficos ficam vazios e nao convencem um medico. Aqui entram
-- ~45 pacientes "de fundo" (uma ou duas consultas curtas nos ultimos 6
-- meses), conversas do robo com os eventos que alimentam a aba WhatsApp da
-- Visao geral, planos de saude para o quadro de convenios, e o "Paciente
-- Teste Memed" sai das listas (arquivado, volta quando precisar).
--
-- Mesmas travas da parte 1: so a Clinica de teste Memed, que nao tem numero
-- de WhatsApp, entao nada e enviado. Nomes e telefones inventados.

begin;

select setseed(0.27);

do $demo2$
declare
  cl uuid;
  u_santos uuid;
  u_sp uuid;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  tz text := 'America/Sao_Paulo';
  nomes_f text[] := array['Ana','Beatriz','Cecília','Clara','Isabela','Júlia','Lívia','Luísa','Manuela','Marina','Olívia','Valentina','Heloísa','Lara','Rafaela','Giovanna','Antonella','Maria Eduarda'];
  nomes_m text[] := array['Arthur','Bernardo','Benício','Enzo','Gabriel','Gael','Heitor','Joaquim','Lorenzo','Lucas','Mateus','Nicolas','Pedro','Rafael','Samuel','Vicente','Bento','Otávio'];
  sobrenomes text[] := array['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues','Almeida','Nascimento','Araújo','Barros','Moreira','Cardoso','Teixeira','Freitas','Rocha','Campos','Monteiro','Duarte','Ramos','Pinto','Vieira','Macedo'];
  maes text[] := array['Aline','Bruna','Carolina','Daniela','Elaine','Gabriela','Jéssica','Larissa','Mariana','Priscila','Tatiana','Vanessa','Renata','Camila','Letícia','Natália'];
  cidades text[] := array['Santos','Santos','Santos','São Vicente','Guarujá','Praia Grande','São Paulo','São Paulo','São Paulo','São Paulo'];
  bairros_santos text[] := array['Gonzaga','Boqueirão','Embaré','Aparecida','Ponta da Praia','Pompéia','Campo Grande','Marapé'];
  bairros_sp text[] := array['Vila Mariana','Moema','Vila Clementino','Saúde','Ipiranga','Brooklin','Campo Belo','Aclimação'];
  planos text[] := array['Unimed','Unimed','Bradesco Saúde','SulAmérica','Amil','Porto Saúde','NotreDame Intermédica','','',''];
  -- cid, queixa, avaliacao, plano; o peso da escolha vem da repeticao
  cids text[] := array['K59.0','K59.0','K59.0','K59.0','K59.0','K59.0','K21.9','K21.9','K21.9','K21.9','R10.4','R10.4','R10.4','K52.2','K52.2','R63.3','R63.3','E73.9','K30','K90.0','K58.9'];
  i int;
  n_pac int := 46;
  pid uuid;
  cid_ uuid;
  sexo text;
  nome text;
  sobrenome text;
  idade numeric;
  nasc date;
  cidade text;
  bairro text;
  unidade uuid;
  unidade_nome text;
  codigo text;
  queixa text;
  avaliacao text;
  plano text;
  dias int;
  dias2 int;
  peso numeric;
  altura numeric;
  conv uuid;
  quando timestamptz;
  cenario int;
  demo_pacs uuid[];
  alvo_dia date;
  k int;
begin
  select id into cl from public.clinics where name = 'Clínica de teste Memed';
  if cl is null then raise exception 'Clinica de teste Memed nao encontrada'; end if;
  if exists (select 1 from public.clinic_settings where clinic_id = cl and whatsapp_phone_number_id is not null) then
    raise exception 'A clinica de teste tem numero de WhatsApp configurado. Abortado.';
  end if;
  if not exists (select 1 from public.patients where clinic_id = cl and phone like '1_9900000%') then
    raise exception 'Rode primeiro demo_clinica_teste.sql (parte 1).';
  end if;
  if exists (select 1 from public.patients where clinic_id = cl and phone like '1_991000%') then
    raise exception 'A parte 2 ja foi rodada. Nada foi alterado.';
  end if;

  select id into u_santos from public.clinic_units
   where clinic_id = cl and archived_at is null
     and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos';
  select id into u_sp from public.clinic_units
   where clinic_id = cl and archived_at is null and name ilike '%ibirapuera%';

  -- O paciente das homologacoes da Memed sai das listas do video.
  update public.patients set archived_at = now()
   where clinic_id = cl and name = 'Paciente Teste Memed' and archived_at is null;

  -- Planos de saude dos 7 detalhados (reembolso; a consulta segue particular).
  update public.patients set insurance = v.plano
    from (values ('Helena Souza Lima','Unimed'), ('Theo Almeida Rocha','Bradesco Saúde'),
                 ('Laura Mendes Carvalho','SulAmérica'), ('Sofia Ribeiro Dias','Amil'),
                 ('Alice Martins Pereira','Unimed')) as v(nome, plano)
   where clinic_id = cl and name = v.nome;

  select array_agg(id) into demo_pacs from public.patients where clinic_id = cl and phone like '1_9900000%';

  -- ---------------------------------------------------------------
  -- Pacientes de fundo
  -- ---------------------------------------------------------------
  for i in 1..n_pac loop
    sexo := case when random() < 0.5 then 'F' else 'M' end;
    nome := case when sexo = 'F' then nomes_f[1 + floor(random() * array_length(nomes_f, 1))::int]
                 else nomes_m[1 + floor(random() * array_length(nomes_m, 1))::int] end;
    sobrenome := sobrenomes[1 + floor(random() * array_length(sobrenomes, 1))::int] || ' ' ||
                 sobrenomes[1 + floor(random() * array_length(sobrenomes, 1))::int];
    codigo := cids[1 + floor(random() * array_length(cids, 1))::int];
    -- idade coerente com o diagnostico
    idade := case codigo
      when 'K52.2' then 0.3 + random() * 1.6
      when 'K21.9' then 0.2 + random() * 3
      when 'K59.0' then 1.5 + random() * 8
      when 'R63.3' then 1 + random() * 5
      when 'K58.9' then 10 + random() * 5
      when 'K30' then 7 + random() * 8
      else 3 + random() * 11 end;
    nasc := hoje - (idade * 365.25)::int;
    cidade := cidades[1 + floor(random() * array_length(cidades, 1))::int];
    bairro := case when cidade = 'São Paulo' then bairros_sp[1 + floor(random() * 8)::int]
                   when cidade = 'Santos' then bairros_santos[1 + floor(random() * 8)::int]
                   else 'Centro' end;
    unidade := case when cidade = 'São Paulo' then u_sp else u_santos end;
    unidade_nome := case when cidade = 'São Paulo' then 'Livance Ibirapuera - São Paulo' else 'Livance · Santos' end;
    plano := planos[1 + floor(random() * array_length(planos, 1))::int];
    queixa := case codigo
      when 'K59.0' then 'Intestino preso, evacuações com dor.'
      when 'K21.9' then 'Regurgitação e vômitos depois das mamadas.'
      when 'R10.4' then 'Dor abdominal recorrente.'
      when 'K52.2' then 'Sangue nas fezes e cólicas.'
      when 'R63.3' then 'Come pouco e aceita poucos alimentos.'
      when 'E73.9' then 'Distensão e diarreia depois de leite.'
      when 'K30' then 'Dor na boca do estômago depois das refeições.'
      when 'K90.0' then 'Pouco ganho de peso e distensão abdominal.'
      else 'Dor abdominal com alteração do hábito intestinal.' end;
    avaliacao := case codigo
      when 'K59.0' then 'Constipação funcional.'
      when 'K21.9' then 'Doença do refluxo gastroesofágico.'
      when 'R10.4' then 'Dor abdominal funcional.'
      when 'K52.2' then 'Alergia à proteína do leite de vaca.'
      when 'R63.3' then 'Dificuldade alimentar (seletividade).'
      when 'E73.9' then 'Intolerância à lactose.'
      when 'K30' then 'Dispepsia funcional.'
      when 'K90.0' then 'Doença celíaca.'
      else 'Síndrome do intestino irritável.' end;
    -- mais consultas nos meses recentes: o grafico sobe, como num consultorio que cresce
    dias := 4 + floor(176 * power(random(), 1.4))::int;
    peso := round((case when idade < 1 then 3.5 + idade * 6 else 9 + (idade - 1) * 2.3 end * (0.9 + random() * 0.2))::numeric, 1);
    altura := round((case when idade < 1 then 50 + idade * 25 else 75 + (idade - 1) * 6.2 end * (0.97 + random() * 0.06))::numeric, 1);

    insert into public.patients (clinic_id, name, guardian_name, birth_date, sex, phone, city, neighborhood,
                                 unit, cid, insurance, consultation_date, whatsapp_opt_in_at, whatsapp_consent_source)
    values (cl, nome || ' ' || sobrenome,
            maes[1 + floor(random() * array_length(maes, 1))::int] || ' ' || sobrenome,
            nasc, sexo::public.patient_sex,
            (case when cidade = 'São Paulo' then '11' else '13' end) || '991' || lpad(i::text, 6, '0'),
            cidade, bairro, unidade_nome, codigo, plano, hoje - dias,
            now() - make_interval(days => dias), 'clinic_care_relationship')
    returning id into pid;

    update public.consultations set
      weight_kg = peso, height_cm = altura, chief_complaint = queixa, assessment = avaliacao, cid = codigo,
      clinical_history = 'Ver queixa principal. Sem sinais de alarme.',
      physical_exam = 'BEG, corado(a), hidratado(a). Abdome sem alterações relevantes.',
      plan = 'Orientações gerais e acompanhamento.', return_plan = 'Retorno em 60 a 90 dias.'
    where patient_id = pid and clinic_id = cl
    returning id into cid_;

    insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source, confirmed_by_clinic, confirmed_at, reminder_sent_at, created_at)
    values (cl, unidade, pid,
            ((hoje - dias) + time '08:00' + make_interval(mins => 40 * (i % 6))) at time zone tz,
            ((hoje - dias) + time '08:40' + make_interval(mins => 40 * (i % 6))) at time zone tz,
            'attended', case when random() < 0.62 then 'whatsapp' else 'clinic' end::public.appointment_source, true,
            ((hoje - dias - 1) + time '09:40') at time zone tz,
            ((hoje - dias - 1) + time '09:20') at time zone tz,
            ((hoje - dias - 6) + time '20:10') at time zone tz)
    on conflict (unit_id, starts_at) where status <> 'cancelled' do nothing;

    -- Um terco volta para retorno
    if random() < 0.33 and dias > 40 then
      dias2 := greatest(2, dias - 30 - floor(random() * 30)::int);
      insert into public.consultations (clinic_id, patient_id, consultation_date, encounter_type, unit, weight_kg, height_cm,
                                        chief_complaint, assessment, cid, plan, return_plan)
      values (cl, pid, hoje - dias2, 'return', unidade_nome, round(peso * 1.04, 1), round(altura * 1.01, 1),
              'Retorno.', 'Evolução favorável. ' || avaliacao, codigo, 'Manter as orientações.', 'Retorno em 3 a 6 meses.');
      insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source, confirmed_by_clinic, confirmed_at, reminder_sent_at, created_at)
      values (cl, unidade, pid,
              ((hoje - dias2) + time '10:00' + make_interval(mins => 40 * (i % 5))) at time zone tz,
              ((hoje - dias2) + time '10:40' + make_interval(mins => 40 * (i % 5))) at time zone tz,
              'attended', 'whatsapp', true,
              ((hoje - dias2 - 1) + time '09:31') at time zone tz,
              ((hoje - dias2 - 1) + time '09:20') at time zone tz,
              ((hoje - dias2 - 20) + time '21:40') at time zone tz)
      on conflict (unit_id, starts_at) where status <> 'cancelled' do nothing;
    end if;

    -- Algumas faltas espalhadas (taxa de faltas perto de 7%)
    if random() < 0.12 then
      alvo_dia := hoje - 5 - floor(random() * 80)::int;
      insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source, confirmed_by_clinic, reminder_sent_at, created_at)
      values (cl, unidade, pid,
              (alvo_dia + time '16:00') at time zone tz,
              (alvo_dia + time '16:40') at time zone tz,
              'no_show', 'whatsapp', true, now() - interval '30 days', now() - interval '40 days')
      on conflict (unit_id, starts_at) where status <> 'cancelled' do nothing;
    end if;

    -- Retornos marcados nas proximas 3 semanas, nos dias de atendimento
    if random() < 0.35 then
      k := 0;
      loop
        alvo_dia := hoje + 1 + floor(random() * 21)::int;
        exit when (unidade = u_santos and extract(dow from alvo_dia) in (3, 5))
               or (unidade = u_sp and extract(dow from alvo_dia) in (1, 6));
        k := k + 1;
        exit when k > 30;
      end loop;
      if k <= 30 then
        quando := (alvo_dia + case extract(dow from alvo_dia)::int when 3 then time '14:00' when 5 then time '08:00'
                                                                   when 1 then time '15:00' else time '14:00' end
                            + make_interval(mins => 40 * floor(random() * 3)::int)) at time zone tz;
        insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source, confirmed_by_clinic, created_at)
        values (cl, unidade, pid, quando, quando + interval '40 minutes',
                'scheduled', case when random() < 0.7 then 'whatsapp' else 'clinic' end::public.appointment_source, true,
                now() - make_interval(days => floor(random() * 10)::int, hours => floor(random() * 12)::int))
        on conflict (unit_id, starts_at) where status <> 'cancelled' do nothing;
      end if;
    end if;

    -- Conversa do robo para 2 em cada 3 familias, com o cenario e os eventos
    if random() < 0.66 then
      quando := ((hoje - least(dias, 29) + 1 - floor(random() * 3)::int)
                 + make_interval(hours => case when random() < 0.4 then 19 + floor(random() * 4)::int
                                               else 8 + floor(random() * 10)::int end,
                                 mins => floor(random() * 60)::int)) at time zone tz;
      cenario := 1 + floor(random() * 10)::int;  -- 1-5 agendou, 6-7 informacoes, 8 segunda via, 9 equipe, 10 remarcou
      insert into public.whatsapp_conversations (clinic_id, patient_id, wa_id, display_phone, profile_name, status,
                                                 needs_attention, unread_count, last_message_at, created_at)
      values (cl, pid,
              '55' || (case when cidade = 'São Paulo' then '11' else '13' end) || '991' || lpad(i::text, 6, '0'),
              (case when cidade = 'São Paulo' then '11' else '13' end) || '991' || lpad(i::text, 6, '0'),
              split_part((select guardian_name from public.patients where id = pid), ' ', 1),
              'resolved', false, 0, quando + interval '3 minutes', quando)
      returning id into conv;

      insert into public.whatsapp_messages (clinic_id, conversation_id, patient_id, direction, automatic, message_type, body, status, created_at, delivered_at, sent_at, read_at) values
      (cl, conv, pid, 'inbound', false, 'text',
       case cenario when 6 then 'Oi, qual o valor da consulta?' when 7 then 'Onde fica o consultório?'
                    when 8 then 'Preciso da receita de novo' when 9 then 'Queria falar com a secretária'
                    when 10 then 'Preciso trocar o dia da consulta' else 'Oi, quero marcar retorno' end,
       'delivered', quando, quando, null, null),
      (cl, conv, pid, 'outbound', true, 'text',
       case when cenario <= 5 then E'✅ *Tudo certo, obrigado!* Sua consulta está marcada.\n\nDigite *0* a qualquer momento para voltar ao início.'
            when cenario in (6, 7) then E'💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.\n\nDigite *1* para ver outra unidade ou *0* para ver todas as opções.'
            when cenario = 8 then E'✅ Pedido registrado.\n\nO Dr. Marcello vai revisar e responder por aqui, em até *1 dia útil*.'
            when cenario = 9 then 'Certo! Já chamei alguém da equipe. Respondemos por aqui em instantes.'
            else E'Certo! Já avisei a nossa equipe para remarcar com você. Alguém retorna por aqui.' end,
       'read', quando + interval '2 minutes', null, quando + interval '2 minutes', quando + interval '3 minutes');

      insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em) values
        (cl, conv, 'menu_enviado', '', quando + interval '5 seconds'),
        (cl, conv, 'opcao_escolhida',
         case when cenario <= 5 then '2' when cenario in (6, 7) then '1' when cenario = 8 then '5'
              when cenario = 9 then '3' else '4' end,
         quando + interval '20 seconds');
      if cenario <= 5 then
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em)
        values (cl, conv, 'agendou', '', quando + interval '2 minutes');
      elsif cenario in (6, 7) then
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em)
        values (cl, conv, 'concluiu_sozinho', 'informacoes', quando + interval '2 minutes');
      elsif cenario = 8 then
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em) values
          (cl, conv, 'documento_pedido', 'receita', quando + interval '2 minutes'),
          (cl, conv, 'chamou_equipe', 'documento', quando + interval '2 minutes');
      elsif cenario = 9 then
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em)
        values (cl, conv, 'chamou_equipe', 'atendente', quando + interval '1 minute');
      else
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em) values
          (cl, conv, 'remarcou', '', quando + interval '2 minutes');
      end if;

      -- Resposta ao lembrete da vespera: a maioria confirma
      if random() < 0.7 then
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em)
        values (cl, conv,
                case when random() < 0.84 then 'lembrete_confirmou' when random() < 0.6 then 'lembrete_remarcar' else 'lembrete_cancelou' end,
                '', quando + interval '1 day');
      end if;
      if random() < 0.08 then
        insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em)
        values (cl, conv, 'nao_entendi', '', quando + interval '10 seconds');
      end if;
    end if;
  end loop;

  -- ---------------------------------------------------------------
  -- Eventos das 5 conversas detalhadas da parte 1
  -- ---------------------------------------------------------------
  insert into public.whatsapp_bot_events (clinic_id, conversation_id, evento, detalhe, criado_em)
  select cl, c.id, e.evento, e.detalhe, c.last_message_at
    from public.whatsapp_conversations c
    join (values
      ('Beatriz', 'menu_enviado', ''), ('Beatriz', 'opcao_escolhida', '2'), ('Beatriz', 'agendou', ''),
      ('Fernanda Martins', 'lembrete_confirmou', ''),
      ('Renata Carvalho', 'menu_enviado', ''), ('Renata Carvalho', 'opcao_escolhida', '5'),
      ('Renata Carvalho', 'documento_pedido', 'receita'), ('Renata Carvalho', 'chamou_equipe', 'documento'),
      ('Patrícia Dias', 'menu_enviado', ''), ('Patrícia Dias', 'opcao_escolhida', '3'), ('Patrícia Dias', 'chamou_equipe', 'atendente')
    ) as e(perfil, evento, detalhe) on e.perfil = c.profile_name
   where c.clinic_id = cl and c.wa_id like '55__9900000%';

  -- ---------------------------------------------------------------
  -- Acompanhamentos dos pacientes de fundo: o passado ja foi feito
  -- ---------------------------------------------------------------
  -- quatro saíram na ultima semana e esperam resposta
  update public.followups f set status = 'opened',
         whatsapp_sent_at = (f.due_date + time '09:00') at time zone tz,
         whatsapp_delivered_at = (f.due_date + time '09:02') at time zone tz
   where f.id in (
     select f2.id from public.followups f2 join public.patients p on p.id = f2.patient_id
      where f2.clinic_id = cl and p.phone like '1_991000%' and f2.archived_at is null
        and f2.status = 'pending' and f2.due_date between hoje - 6 and hoje - 1
      order by f2.due_date desc limit 4);

  update public.followups f set status = 'completed',
         whatsapp_sent_at = (f.due_date + time '09:00') at time zone tz,
         whatsapp_delivered_at = (f.due_date + time '09:01') at time zone tz,
         whatsapp_read_at = (f.due_date + time '11:20') at time zone tz
    from public.patients p
   where p.id = f.patient_id and f.clinic_id = cl and p.phone like '1_991000%'
     and f.archived_at is null and f.status = 'pending' and f.due_date < hoje;
end
$demo2$;

commit;
