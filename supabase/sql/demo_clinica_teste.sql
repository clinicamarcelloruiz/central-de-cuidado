-- Dados de demonstracao para o video de apresentacao a outros medicos.
--
-- SO toca a "Clinica de teste Memed". Todos os pacientes, responsaveis,
-- telefones e historias sao INVENTADOS - o repositorio e publico, e o video
-- tambem vai ser. A clinica de teste nao tem numero de WhatsApp configurado
-- (whatsapp_phone_number_id nulo), entao lembrete, acompanhamento e aviso
-- automaticos NUNCA disparam para estes telefones: as funcoes de envio pulam
-- clinica sem numero. As conversas abaixo sao so registros, nada e enviado.
--
-- Datas relativas a hoje: rodar perto da gravacao. Roda uma vez so - se ja
-- houver paciente de demonstracao (telefone 1x99000000x), para sem mexer.

begin;

create temp table demo_consulta (
  pac int, ordem int, dias int, lugar text, tipo text, peso numeric, altura numeric,
  queixa text, historia text, pessoais text, familiares text, alergias text, medicacoes text,
  exame text, avaliacao text, cid text, plano text, receita text, retorno text
) on commit drop;

insert into demo_consulta values
-- 1 Helena: constipacao funcional, tres consultas
(1,1,150,'S','initial',13.2,93,
 'Evacuações endurecidas e dolorosas há 6 meses.',
 'Mãe relata evacuações a cada 4 a 5 dias, fezes em cíbalos, com dor e choro para evacuar. Postura de retenção frequente. Desfralde há 8 meses, com dificuldade. Baixa ingestão de água e de fibras.',
 'Nascida a termo, parto cesáreo. Vacinação em dia. Sem internações.',
 'Mãe com constipação na infância.',
 'Nega alergias.',
 'Nenhuma.',
 'BEG, corada, hidratada. Abdome flácido, fecaloma palpável em fossa ilíaca esquerda, indolor. Região perianal sem fissuras.',
 'Constipação funcional (critérios de Roma IV) com comportamento de retenção.',
 'K59.0',
 'Desimpactação por 3 dias, depois manutenção com macrogol. Dieta rica em fibras, água ao longo do dia, treino de toalete após as refeições e diário de evacuações.',
 'Macrogol 3350 (PEG 4000) 0,8 g/kg/dia por 3 dias; depois 0,4 g/kg/dia.',
 'Retorno em 60 dias com o diário de evacuações.'),
(1,2,60,'S','return',14.0,96,
 'Retorno: evolução da constipação.',
 'Evacuando todos os dias, fezes pastosas (Bristol 4), sem dor. Em uso de macrogol 0,4 g/kg/dia. Aceitando melhor frutas e verduras.',
 '', '', 'Nega alergias.', 'Macrogol 3350 4 g ao dia.',
 'BEG. Abdome sem massas palpáveis.',
 'Constipação funcional em boa resposta ao tratamento.',
 'K59.0',
 'Manter macrogol por mais 2 meses e iniciar redução gradual. Manter o treino de toalete.',
 'Macrogol 3350 4 g, 1 sachê ao dia.',
 'Retorno em 30 a 60 dias.'),
(1,3,12,'S','return',14.6,98,
 'Retorno: redução do laxativo.',
 'Sem episódios de retenção há 2 meses. Em uso de meio sachê ao dia, evacuações diárias sem dor.',
 '', '', 'Nega alergias.', 'Macrogol 3350 2 g ao dia.',
 'BEG, eutrófica. Abdome normal.',
 'Constipação funcional controlada, em desmame.',
 'K59.0',
 'Suspender o macrogol em 2 semanas se mantiver o padrão. Reforçar dieta e hidratação.',
 '',
 'Retorno em 90 dias.'),
-- 2 Theo: refluxo, duas consultas
(2,1,120,'P','initial',10.9,83,
 'Vômitos depois das refeições e recusa alimentar.',
 'Regurgitações frequentes desde lactente, persistindo depois de 1 ano. Agora com irritabilidade nas refeições, recusa alimentar e tosse ao deitar.',
 'Nascido a termo. Vacinação em dia.', 'Pai com refluxo.', 'Nega alergias.', 'Nenhuma.',
 'BEG, eutrófico. Abdome sem alterações.',
 'Suspeita de doença do refluxo gastroesofágico.',
 'K21.9',
 'Medidas posturais e dietéticas. Teste terapêutico com inibidor de bomba de prótons por 8 semanas. Solicitados hemograma e ultrassom de abdome.',
 'Omeprazol 10 mg, 1 cápsula ao dia, 30 minutos antes do café da manhã, por 8 semanas.',
 'Retorno em 60 a 90 dias.'),
(2,2,35,'P','return',11.8,86,
 'Retorno: refluxo.',
 'Melhora importante: sem vômitos, aceitando as refeições, dormindo bem. Ultrassom de abdome normal.',
 '', '', 'Nega alergias.', 'Omeprazol 10 mg ao dia.',
 'BEG, ganho de peso adequado.',
 'Doença do refluxo gastroesofágico em remissão clínica.',
 'K21.9',
 'Desmame do omeprazol em 4 semanas. Manter as medidas posturais.',
 '',
 'Retorno em 3 meses.'),
-- 3 Laura: doenca celiaca, tres consultas
(3,1,200,'P','initial',21.5,120,
 'Dor abdominal recorrente e pouco ganho de peso.',
 'Dor periumbilical 3 vezes por semana há 1 ano, distensão abdominal, fezes volumosas e fétidas. Anemia ferropriva em exame recente.',
 'Nascida a termo. Vacinação em dia.', 'Tia materna com doença celíaca.', 'Nega alergias.', 'Nenhuma.',
 'Emagrecida. Abdome distendido e timpânico, indolor.',
 'Suspeita de doença celíaca.',
 'R10.4',
 'Solicitados antitransglutaminase IgA, IgA total, hemograma e ferritina. Manter glúten na dieta até concluir a investigação.',
 'Sulfato ferroso, 3 mg/kg/dia de ferro elementar.',
 'Retorno com os exames.'),
(3,2,90,'P','return',22.4,122,
 'Retorno com exames.',
 'Antitransglutaminase IgA acima de 10 vezes o limite superior. Biópsia duodenal: Marsh 3b.',
 '', '', 'Nega alergias.', 'Sulfato ferroso.',
 'Abdome discretamente distendido.',
 'Doença celíaca confirmada.',
 'K90.0',
 'Dieta sem glúten rigorosa, com orientação sobre contaminação cruzada. Encaminhada à nutricionista.',
 'Sulfato ferroso, manter a dose.',
 'Retorno em 90 dias.'),
(3,3,3,'P','return',24.3,124.5,
 'Retorno: dieta sem glúten.',
 'Sem dor abdominal há 2 meses. Ganhou 1,9 kg. Boa adesão à dieta, escola orientada.',
 '', '', 'Nega alergias.', 'Sulfato ferroso.',
 'BEG, corada. Abdome normal.',
 'Doença celíaca com boa adesão à dieta sem glúten e recuperação do peso.',
 'K90.0',
 'Repetir antitransglutaminase em 6 meses. Manter o ferro por mais 2 meses.',
 'Sulfato ferroso, manter a dose atual por 60 dias.',
 'Retorno em 6 meses.'),
-- 4 Miguel: alergia a proteina do leite, duas consultas
(4,1,80,'S','initial',9.1,76,
 'Sangue nas fezes e cólicas.',
 'Fezes com raias de sangue e muco desde a introdução da fórmula infantil, aos 6 meses. Eczema no rosto.',
 'Nascido a termo, aleitamento materno até 5 meses.', 'Irmão com rinite alérgica.', 'Suspeita de alergia ao leite de vaca.', 'Nenhuma.',
 'Dermatite atópica leve nas bochechas. Abdome normal.',
 'Alergia à proteína do leite de vaca (proctocolite alérgica).',
 'K52.2',
 'Excluir leite e derivados. Fórmula extensamente hidrolisada. Orientação nutricional da família.',
 'Fórmula extensamente hidrolisada, volume conforme orientação.',
 'Retorno em 60 dias.'),
(4,2,20,'S','return',9.9,79,
 'Retorno: alergia ao leite.',
 'Sem sangue nas fezes desde a 2ª semana de exclusão. Eczema melhorou.',
 '', '', 'Alergia à proteína do leite de vaca.', 'Fórmula extensamente hidrolisada.',
 'BEG, pele sem lesões ativas.',
 'Alergia à proteína do leite de vaca em remissão com a dieta de exclusão.',
 'K52.2',
 'Manter a exclusão até completar 6 meses. Programar teste de provocação oral.',
 '',
 'Retorno em 4 meses para a provocação oral.'),
-- 5 Sofia: dor abdominal funcional
(5,1,15,'P','initial',36,145,
 'Dor abdominal há 4 meses.',
 'Dor periumbilical sem relação com a alimentação, pior em dias de prova. Sem sinais de alarme. Hábito intestinal normal.',
 'Sem antecedentes relevantes.', 'Mãe com síndrome do intestino irritável.', 'Nega alergias.', 'Nenhuma.',
 'BEG, eutrófica. Abdome sem alterações.',
 'Dor abdominal funcional.',
 'R10.4',
 'Explicado à família o caráter funcional. Diário de dor, exercícios de respiração e acompanhamento psicológico sugerido.',
 '',
 'Retorno em 60 dias.'),
-- 6 Davi: intolerancia a lactose
(6,1,95,'S','initial',22,119,
 'Distensão e diarreia depois de tomar leite.',
 'Há 6 meses: distensão, gases e fezes amolecidas 1 a 2 horas depois de leite e derivados.',
 'Sem antecedentes relevantes.', 'Pai com intolerância à lactose.', 'Nega alergias.', 'Nenhuma.',
 'BEG. Abdome levemente distendido, indolor.',
 'Intolerância à lactose.',
 'E73.9',
 'Teste terapêutico com leite sem lactose por 4 semanas. Manter cálcio na dieta.',
 '',
 'Retorno em 90 dias.'),
-- 7 Alice: dispepsia
(7,1,31,'P','initial',20,115,
 'Dor na boca do estômago e enjoo.',
 'Dor em queimação no epigástrio depois das refeições há 3 meses, com saciedade precoce. Sem vômitos ou perda de peso.',
 'Sem antecedentes relevantes.', 'Avó com gastrite.', 'Nega alergias.', 'Nenhuma.',
 'BEG. Dor leve à palpação do epigástrio.',
 'Dispepsia funcional.',
 'K30',
 'Fracionar as refeições e evitar alimentos gordurosos. Omeprazol por 4 semanas.',
 'Omeprazol 20 mg, 1 cápsula ao dia, por 4 semanas.',
 'Retorno em 30 dias.');

do $demo$
declare
  cl uuid;
  u_santos uuid;
  u_sp uuid;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  tz text := 'America/Sao_Paulo';
  semana text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  pac_ids uuid[] := array[]::uuid[];
  cons_ids uuid[];
  r record;
  c record;
  pid uuid;
  cid_ uuid;
  primeira int;
  ap uuid;
  conv uuid;
  fu uuid;
  -- datas futuras
  prox_qua date;
  prox_sex date;
  prox_seg date;
  prox_sab date;
  base timestamptz;
  ap_arthur uuid;
  ap_alice uuid;
  ap_theo uuid;
begin
  select id into cl from public.clinics where name = 'Clínica de teste Memed';
  if cl is null then
    raise exception 'Clinica de teste Memed nao encontrada';
  end if;

  if exists (select 1 from public.patients where clinic_id = cl and phone like '1_9900000%') then
    raise exception 'Os dados de demonstracao ja existem nesta clinica. Nada foi alterado.';
  end if;

  -- Trava de seguranca: a clinica de teste nao pode ter numero de WhatsApp,
  -- senao os envios automaticos iriam para estes telefones inventados.
  if exists (select 1 from public.clinic_settings where clinic_id = cl and whatsapp_phone_number_id is not null) then
    raise exception 'A clinica de teste tem numero de WhatsApp configurado. Abortado para nao enviar nada.';
  end if;

  select id into u_santos from public.clinic_units
   where clinic_id = cl and archived_at is null
     and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos';
  select id into u_sp from public.clinic_units
   where clinic_id = cl and archived_at is null and name ilike '%ibirapuera%';
  if u_santos is null or u_sp is null then
    raise exception 'Unidades da clinica de teste nao encontradas';
  end if;

  -- A Liferty ja fechou no video: fica so a Livance.
  update public.clinic_units set archived_at = now()
   where clinic_id = cl and archived_at is null
     and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'lifertysantos';

  -- Mesmos dias da clinica real: Santos qua 14-18 e sex 8-12; SP seg 15-20 e sab 14-16.
  if not exists (select 1 from public.availability_rules where unit_id = u_santos) then
    insert into public.availability_rules (clinic_id, unit_id, weekday, starts_at, ends_at) values
      (cl, u_santos, 3, '14:00', '18:00'), (cl, u_santos, 5, '08:00', '12:00');
  end if;
  if not exists (select 1 from public.availability_rules where unit_id = u_sp) then
    insert into public.availability_rules (clinic_id, unit_id, weekday, starts_at, ends_at) values
      (cl, u_sp, 1, '15:00', '20:00'), (cl, u_sp, 6, '14:00', '16:00');
  end if;

  -- ---------------------------------------------------------------
  -- Pacientes e consultas
  -- ---------------------------------------------------------------
  for r in
    select * from (values
      (1, 'Helena Souza Lima',      'F', date '2021-03-14', 'Marina Souza Lima',      '13990000001', 'Santos',     'Gonzaga'),
      (2, 'Theo Almeida Rocha',     'M', date '2022-08-02', 'Rafael Almeida Rocha',   '11990000002', 'São Paulo',  'Vila Mariana'),
      (3, 'Laura Mendes Carvalho',  'F', date '2017-11-20', 'Renata Mendes Carvalho', '11990000003', 'São Paulo',  'Moema'),
      (4, 'Miguel Ferreira Costa',  'M', date '2025-03-10', 'Juliana Ferreira Costa', '13990000004', 'São Vicente','Itararé'),
      (5, 'Sofia Ribeiro Dias',     'F', date '2015-06-30', 'Patrícia Ribeiro Dias',  '11990000005', 'São Paulo',  'Vila Clementino'),
      (6, 'Davi Oliveira Santos',   'M', date '2019-09-05', 'Camila Oliveira Santos', '13990000006', 'Santos',     'Boqueirão'),
      (7, 'Alice Martins Pereira',  'F', date '2020-01-25', 'Fernanda Martins Pereira','11990000007','São Paulo',  'Ibirapuera')
    ) as v(n, nome, sexo, nasc, resp, fone, cidade, bairro)
    order by n
  loop
    select max(dias) into primeira from demo_consulta where pac = r.n;
    select * into c from demo_consulta where pac = r.n and ordem = 1;

    insert into public.patients (clinic_id, name, guardian_name, birth_date, sex, phone, city, neighborhood,
                                 unit, cid, consultation_date, whatsapp_opt_in_at, whatsapp_consent_source)
    values (cl, r.nome, r.resp, r.nasc, r.sexo::public.patient_sex, r.fone, r.cidade, r.bairro,
            case c.lugar when 'S' then 'Livance · Santos' else 'Livance Ibirapuera - São Paulo' end,
            c.cid, hoje - primeira, now() - make_interval(days => primeira), 'clinic_care_relationship')
    returning id into pid;
    pac_ids := pac_ids || pid;

    -- A primeira consulta nasce do gatilho do cadastro; aqui ela ganha o conteudo.
    for c in select * from demo_consulta where pac = r.n order by ordem loop
      if c.ordem = 1 then
        update public.consultations set
          encounter_type = c.tipo, weight_kg = c.peso, height_cm = c.altura,
          chief_complaint = c.queixa, clinical_history = c.historia, personal_history = c.pessoais,
          family_history = c.familiares, allergies = c.alergias, current_medications = c.medicacoes,
          physical_exam = c.exame, assessment = c.avaliacao, cid = c.cid, plan = c.plano,
          prescription = c.receita, return_plan = c.retorno
        where patient_id = pid and clinic_id = cl
        returning id into cid_;
      else
        insert into public.consultations (clinic_id, patient_id, consultation_date, encounter_type, unit,
          weight_kg, height_cm, chief_complaint, clinical_history, personal_history, family_history,
          allergies, current_medications, physical_exam, assessment, cid, plan, prescription, return_plan)
        values (cl, pid, hoje - c.dias, c.tipo,
          case c.lugar when 'S' then 'Livance · Santos' else 'Livance Ibirapuera - São Paulo' end,
          c.peso, c.altura, c.queixa, c.historia, c.pessoais, c.familiares, c.alergias, c.medicacoes,
          c.exame, c.avaliacao, c.cid, c.plano, c.receita, c.retorno)
        returning id into cid_;
      end if;

      -- A consulta passada tambem esta na agenda, como presenca.
      insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source,
                                       confirmed_by_clinic, confirmed_at, reminder_sent_at)
      values (cl, case c.lugar when 'S' then u_santos else u_sp end, pid,
              ((hoje - c.dias) + time '08:00' + make_interval(mins => 40 * (r.n - 1))) at time zone tz,
              ((hoje - c.dias) + time '08:40' + make_interval(mins => 40 * (r.n - 1))) at time zone tz,
              'attended', case when r.n % 2 = 0 then 'whatsapp' else 'clinic' end::public.appointment_source,
              true,
              ((hoje - c.dias - 1) + time '09:35') at time zone tz,
              ((hoje - c.dias - 1) + time '09:20') at time zone tz);

      -- Receita da Memed, quando houve.
      if c.receita <> '' then
        insert into public.prescriptions (clinic_id, patient_id, consultation_id, memed_id, itens, emitida_em)
        values (cl, pid, cid_, 'demo-' || substr(md5(random()::text), 1, 10),
                jsonb_build_array(jsonb_build_object(
                  'nome', case
                    when c.receita like 'Macrogol%' then 'Macrogol 3350 (PEG 4000)'
                    when c.receita like 'Omeprazol 10%' then 'Omeprazol 10 mg'
                    when c.receita like 'Omeprazol 20%' then 'Omeprazol 20 mg'
                    when c.receita like 'Sulfato ferroso%' then 'Sulfato ferroso'
                    when c.receita like 'Fórmula%' then 'Fórmula extensamente hidrolisada'
                    else split_part(c.receita, ',', 1) end,
                  'posologia', c.receita,
                  'quantidade', 1, 'unidade', 'frasco', 'tipo', 'alopático', 'receituario', 'Simples')),
                ((hoje - c.dias) + time '09:10' + make_interval(mins => 40 * (r.n - 1))) at time zone tz);
      end if;
    end loop;
  end loop;

  -- ---------------------------------------------------------------
  -- Acompanhamentos: o que ja passou fica concluido ou enviado
  -- ---------------------------------------------------------------
  -- Concluidos: vencidos ha mais de 3 dias, menos os que a demonstracao
  -- quer mostrar em atraso (Davi 90 dias, Alice 30 dias).
  update public.followups f
     set status = 'completed',
         whatsapp_sent_at = (f.due_date + time '09:00') at time zone tz,
         whatsapp_delivered_at = (f.due_date + time '09:01') at time zone tz,
         whatsapp_read_at = (f.due_date + time '10:12') at time zone tz
   where f.clinic_id = cl and f.archived_at is null and f.status = 'pending'
     and f.due_date < hoje - 3
     and not (f.patient_id = pac_ids[6] and f.followup_key = 'm90')
     -- o de 30 dias do Theo fica "enviado, aguardando" logo abaixo; concluido
     -- antes, o gatilho recusaria a volta (concluido nao reabre)
     and not (f.patient_id = pac_ids[2] and f.followup_key = 'd30');

  -- Theo, 30 dias: saiu e a familia ainda nao respondeu.
  update public.followups f
     set status = 'opened',
         whatsapp_sent_at = (f.due_date + time '09:00') at time zone tz,
         whatsapp_delivered_at = (f.due_date + time '09:02') at time zone tz,
         whatsapp_read_at = (f.due_date + time '12:40') at time zone tz
   where f.clinic_id = cl and f.archived_at is null and f.patient_id = pac_ids[2] and f.followup_key = 'd30';

  -- ---------------------------------------------------------------
  -- Agenda: faltas, cancelamento, hoje e as proximas semanas
  -- ---------------------------------------------------------------
  prox_qua := hoje + ((3 - extract(dow from hoje)::int + 6) % 7) + 1;
  prox_sex := hoje + ((5 - extract(dow from hoje)::int + 6) % 7) + 1;
  prox_seg := hoje + ((1 - extract(dow from hoje)::int + 6) % 7) + 1;
  prox_sab := hoje + ((6 - extract(dow from hoje)::int + 6) % 7) + 1;

  insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source,
                                   confirmed_by_clinic, reminder_sent_at, staff_note, cancelled_at, cancellation_reason)
  values
    -- duas faltas no ultimo mes, para a taxa de faltas existir
    (cl, u_santos, pac_ids[6], ((hoje - 9) + time '10:00') at time zone tz, ((hoje - 9) + time '10:40') at time zone tz,
     'no_show', 'whatsapp', true, ((hoje - 10) + time '09:20') at time zone tz, '', null, null),
    (cl, u_sp, pac_ids[5], ((hoje - 22) + time '16:20') at time zone tz, ((hoje - 22) + time '17:00') at time zone tz,
     'no_show', 'clinic', true, ((hoje - 23) + time '09:20') at time zone tz, 'Não atendeu a ligação de confirmação.', null, null),
    -- um cancelamento feito pela propria familia no WhatsApp
    (cl, u_santos, pac_ids[1], ((hoje - 40) + time '08:40') at time zone tz, ((hoje - 40) + time '09:20') at time zone tz,
     'cancelled', 'whatsapp', true, ((hoje - 41) + time '09:20') at time zone tz, '',
     ((hoje - 41) + time '19:12') at time zone tz, 'Cancelado pela família pelo WhatsApp');

  -- Hoje: a agenda do dia com gente
  insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source,
                                   confirmed_by_clinic, confirmed_at, reminder_sent_at)
  values (cl, u_santos, pac_ids[6], (hoje + time '14:00') at time zone tz, (hoje + time '14:40') at time zone tz,
          'scheduled', 'whatsapp', true, ((hoje - 1) + time '10:05') at time zone tz, ((hoje - 1) + time '09:20') at time zone tz);
  insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source,
                                   confirmed_by_clinic, confirmed_at, reminder_sent_at)
  values (cl, u_santos, pac_ids[7], (hoje + time '14:40') at time zone tz, (hoje + time '15:20') at time zone tz,
          'scheduled', 'whatsapp', true, ((hoje - 1) + time '09:26') at time zone tz, ((hoje - 1) + time '09:20') at time zone tz)
  returning id into ap_alice;
  insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source,
                                   confirmed_by_clinic, reminder_sent_at)
  values (cl, u_santos, pac_ids[2], (hoje + time '15:20') at time zone tz, (hoje + time '16:00') at time zone tz,
          'scheduled', 'clinic', true, ((hoje - 1) + time '09:20') at time zone tz)
  returning id into ap_theo;

  -- Proximas semanas
  insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source, confirmed_by_clinic, modality)
  values
    (cl, u_santos, pac_ids[1], (prox_sex + time '08:40') at time zone tz, (prox_sex + time '09:20') at time zone tz, 'scheduled', 'whatsapp', true, 'presencial'),
    (cl, u_santos, pac_ids[4], (prox_sex + time '10:00') at time zone tz, (prox_sex + time '10:40') at time zone tz, 'scheduled', 'clinic', true, 'presencial'),
    (cl, u_sp,     pac_ids[5], (prox_seg + time '15:40') at time zone tz, (prox_seg + time '16:20') at time zone tz, 'scheduled', 'whatsapp', true, 'telemedicina'),
    (cl, u_sp,     pac_ids[3], (prox_sab + time '14:40') at time zone tz, (prox_sab + time '15:20') at time zone tz, 'scheduled', 'clinic', true, 'presencial'),
    (cl, u_santos, pac_ids[2], (prox_qua + 7 + time '15:20') at time zone tz, (prox_qua + 7 + time '16:00') at time zone tz, 'scheduled', 'whatsapp', true, 'presencial');

  -- Arthur: familia nova que marcou sozinha pelo robo, fora do horario
  insert into public.appointments (clinic_id, unit_id, patient_id, starts_at, ends_at, status, source, confirmed_by_clinic,
                                   contact_name, contact_phone, intake_patient_name, intake_birth_date, intake_guardian, intake_email)
  values (cl, u_santos, null, (prox_qua + time '14:40') at time zone tz, (prox_qua + time '15:20') at time zone tz,
          'scheduled', 'whatsapp', true, 'Beatriz Gomes Barbosa', '13990000008',
          'Arthur Gomes Barbosa', date '2024-02-18', 'Beatriz Gomes Barbosa', 'beatriz@exemplo.com')
  returning id into ap_arthur;

  -- ---------------------------------------------------------------
  -- Conversas do WhatsApp (so registro: nada e enviado)
  -- ---------------------------------------------------------------

  -- 1. Beatriz marca o Arthur sozinha, as 21h de ontem
  base := ((hoje - 1) + time '21:08') at time zone tz;
  insert into public.whatsapp_conversations (clinic_id, wa_id, display_phone, profile_name, status, needs_attention, unread_count, last_message_at)
  values (cl, '5513990000008', '13990000008', 'Beatriz', 'resolved', false, 0, base + interval '4 minutes')
  returning id into conv;
  insert into public.whatsapp_messages (clinic_id, conversation_id, direction, automatic, message_type, body, status, created_at, delivered_at, sent_at, read_at) values
  (cl, conv, 'inbound', false, 'text', 'Boa noite! Gostaria de marcar uma consulta para o meu filho', 'delivered', base, base, null, null),
  (cl, conv, 'outbound', true, 'text', E'📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?\n\n*1* Livance · Santos\n*2* Livance Ibirapuera - São Paulo\n*3* Telemedicina (por vídeo)\n\nResponda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.', 'read', base + interval '3 seconds', null, base + interval '3 seconds', base + interval '20 seconds'),
  (cl, conv, 'inbound', false, 'interactive', 'Livance · Santos', 'delivered', base + interval '31 seconds', base + interval '31 seconds', null, null),
  (cl, conv, 'outbound', true, 'text',
     E'🗓️ *Datas disponíveis em Livance · Santos:*\n\n*1* ' || semana[extract(dow from prox_qua)::int + 1] || ', ' || to_char(prox_qua, 'DD/MM') || E' (5 horários)\n*2* ' ||
     semana[extract(dow from prox_sex)::int + 1] || ', ' || to_char(prox_sex, 'DD/MM') || E' (4 horários)\n\nResponda com o número do dia.\nDigite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.',
     'read', base + interval '34 seconds', null, base + interval '34 seconds', base + interval '50 seconds'),
  (cl, conv, 'inbound', false, 'interactive', semana[extract(dow from prox_qua)::int + 1] || ', ' || to_char(prox_qua, 'DD/MM'), 'delivered', base + interval '58 seconds', base + interval '58 seconds', null, null),
  (cl, conv, 'outbound', true, 'text',
     E'⏰ *Horários de ' || semana[extract(dow from prox_qua)::int + 1] || ', ' || to_char(prox_qua, 'DD/MM') || E':*\n\n*1* 14:00\n*2* 14:40\n*3* 16:00\n*4* 16:40\n*5* 17:20\n\nResponda com o número do horário.\nDigite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.',
     'read', base + interval '61 seconds', null, base + interval '61 seconds', base + interval '70 seconds'),
  (cl, conv, 'inbound', false, 'interactive', '14:40', 'delivered', base + interval '75 seconds', base + interval '75 seconds', null, null),
  (cl, conv, 'outbound', true, 'text',
     E'📋 Seu horário de *' || semana[extract(dow from prox_qua)::int + 1] || ', ' || to_char(prox_qua, 'DD/MM') || E' às 14:40* está guardado.\n\nPara completar o cadastro, 5 perguntas rápidas.\n\n👶 Qual é o *nome completo do paciente* (a criança)?',
     'read', base + interval '78 seconds', null, base + interval '78 seconds', base + interval '85 seconds'),
  (cl, conv, 'inbound', false, 'text', 'Arthur Gomes Barbosa', 'delivered', base + interval '95 seconds', base + interval '95 seconds', null, null),
  (cl, conv, 'outbound', true, 'text', '🎂 Qual é a *data de nascimento* dele(a)? (dia/mês/ano)', 'read', base + interval '97 seconds', null, base + interval '97 seconds', base + interval '100 seconds'),
  (cl, conv, 'inbound', false, 'text', '18/02/2024', 'delivered', base + interval '108 seconds', base + interval '108 seconds', null, null),
  (cl, conv, 'outbound', true, 'text', '👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?', 'read', base + interval '110 seconds', null, base + interval '110 seconds', base + interval '115 seconds'),
  (cl, conv, 'inbound', false, 'text', 'Beatriz Gomes Barbosa', 'delivered', base + interval '124 seconds', base + interval '124 seconds', null, null),
  (cl, conv, 'outbound', true, 'text', E'🪪 Qual é o *CPF do paciente*?\n\n_Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._', 'read', base + interval '126 seconds', null, base + interval '126 seconds', base + interval '130 seconds'),
  (cl, conv, 'inbound', false, 'interactive', 'Pular', 'delivered', base + interval '140 seconds', base + interval '140 seconds', null, null),
  (cl, conv, 'outbound', true, 'text', E'Sem problema.\n\n✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?\n\n_Se preferir não responder agora, digite PULAR._', 'read', base + interval '142 seconds', null, base + interval '142 seconds', base + interval '150 seconds'),
  (cl, conv, 'inbound', false, 'text', 'beatriz@exemplo.com', 'delivered', base + interval '170 seconds', base + interval '170 seconds', null, null),
  (cl, conv, 'outbound', true, 'text', E'✅ *Tudo certo, obrigado!* Já anotamos os dados na sua consulta.\n\nDigite *0* a qualquer momento para voltar ao início.', 'read', base + interval '172 seconds', null, base + interval '172 seconds', base + interval '180 seconds');
  update public.whatsapp_messages set appointment_id = ap_arthur where conversation_id = conv and direction = 'outbound' and body like '✅%';

  -- 2. Fernanda confirma a consulta da Alice pelo lembrete
  base := ((hoje - 1) + time '09:20') at time zone tz;
  insert into public.whatsapp_conversations (clinic_id, patient_id, wa_id, display_phone, profile_name, status, needs_attention, unread_count, last_message_at)
  values (cl, pac_ids[7], '5511990000007', '11990000007', 'Fernanda Martins', 'resolved', false, 0, base + interval '6 minutes')
  returning id into conv;
  insert into public.whatsapp_messages (clinic_id, conversation_id, patient_id, appointment_id, direction, automatic, message_type, template_name, body, status, created_at, sent_at, delivered_at, read_at) values
  (cl, conv, pac_ids[7], ap_alice, 'outbound', true, 'template', 'lembrete_consulta',
   E'Olá, Alice Martins Pereira. Lembrete da sua consulta em ' || to_char(hoje, 'DD/MM/YYYY') || E' às 14:40, na unidade Livance · Santos. Podemos confirmar sua presença?\n\n[Confirmar presença · Preciso remarcar]',
   'read', base, base, base + interval '5 seconds', base + interval '5 minutes'),
  (cl, conv, pac_ids[7], null, 'inbound', false, 'button', null, 'Confirmar presença', 'delivered', base + interval '6 minutes', null, base + interval '6 minutes', null),
  (cl, conv, pac_ids[7], ap_alice, 'outbound', true, 'text', null, E'Consulta confirmada, obrigado! Até lá.\n\nDigite 0 se precisar de mais alguma coisa.', 'read', base + interval '366 seconds', base + interval '366 seconds', base + interval '367 seconds', base + interval '7 minutes');

  -- 3. Theo recebeu o lembrete de hoje e ainda nao respondeu
  base := ((hoje - 1) + time '09:20') at time zone tz;
  insert into public.whatsapp_conversations (clinic_id, patient_id, wa_id, display_phone, profile_name, status, needs_attention, unread_count, last_message_at)
  values (cl, pac_ids[2], '5511990000002', '11990000002', 'Rafael Rocha', 'open', false, 0, base)
  returning id into conv;
  select id into fu from public.followups where patient_id = pac_ids[2] and followup_key = 'd15' and archived_at is null;
  insert into public.whatsapp_messages (clinic_id, conversation_id, patient_id, followup_id, appointment_id, direction, automatic, message_type, template_name, body, status, created_at, sent_at, delivered_at, read_at) values
  (cl, conv, pac_ids[2], fu, null, 'outbound', true, 'template', 'acompanhamento_pos_consulta',
   E'Olá, Theo Almeida Rocha. A Clínica Dr. Marcello Ruiz está entrando em contato para acompanhar sua consulta realizada em ' || to_char(hoje - 35, 'DD/MM/YYYY') || E'. Como você está? Responda esta mensagem caso precise falar com nossa equipe.\n\nPara não receber novos acompanhamentos, responda SAIR.\n\n[Estou bem · Preciso de ajuda · Não quero receber]',
   'read', ((hoje - 20) + time '09:00') at time zone tz, ((hoje - 20) + time '09:00') at time zone tz, ((hoje - 20) + time '09:01') at time zone tz, ((hoje - 20) + time '11:30') at time zone tz),
  (cl, conv, pac_ids[2], null, null, 'inbound', false, 'button', null, 'Estou bem', 'delivered', ((hoje - 20) + time '11:31') at time zone tz, null, ((hoje - 20) + time '11:31') at time zone tz, null),
  (cl, conv, pac_ids[2], null, null, 'outbound', true, 'text', null, 'Que bom saber! 💙 Se surgir qualquer dúvida, é só escrever por aqui.', 'read', ((hoje - 20) + time '11:31:04') at time zone tz, ((hoje - 20) + time '11:31:04') at time zone tz, ((hoje - 20) + time '11:31:05') at time zone tz, ((hoje - 20) + time '11:33') at time zone tz),
  (cl, conv, pac_ids[2], null, ap_theo, 'outbound', true, 'template', 'lembrete_consulta',
   E'Olá, Theo Almeida Rocha. Lembrete da sua consulta em ' || to_char(hoje, 'DD/MM/YYYY') || E' às 15:20, na unidade Livance · Santos. Podemos confirmar sua presença?\n\n[Confirmar presença · Preciso remarcar]',
   'delivered', base, base, base + interval '4 seconds', null);

  -- 4. Renata pede 2a via da receita da Laura; a equipe responde
  base := (hoje + time '08:12') at time zone tz;
  insert into public.whatsapp_conversations (clinic_id, patient_id, wa_id, display_phone, profile_name, status, needs_attention, attention_reason, unread_count, last_message_at)
  values (cl, pac_ids[3], '5511990000003', '11990000003', 'Renata Carvalho', 'open', true, 'documento', 1, base + interval '2 minutes')
  returning id into conv;
  insert into public.whatsapp_messages (clinic_id, conversation_id, patient_id, direction, automatic, message_type, body, status, created_at, sent_at, delivered_at, read_at) values
  (cl, conv, pac_ids[3], 'inbound', false, 'text', 'Bom dia!', 'delivered', base, null, base, null),
  (cl, conv, pac_ids[3], 'outbound', true, 'text', E'Olá, Renata! 👋 Aqui é o consultório do Dr. Marcello Ruiz.\n\nEstamos aqui para cuidar do seu filho. Como podemos ajudar hoje?\n\n*1* 💬 Dúvidas sobre a consulta\n*2* 🗓️ Marcar uma consulta ou retorno\n*3* 🗣️ Falar com alguém da equipe\n*4* 🔄 Ver, remarcar ou cancelar\n*5* 📄 2ª via de receita ou pedido de exame\n\nResponda com o número ou toque em "Ver opções".', 'read', base + interval '3 seconds', base + interval '3 seconds', base + interval '4 seconds', base + interval '15 seconds'),
  (cl, conv, pac_ids[3], 'inbound', false, 'text', '5', 'delivered', base + interval '22 seconds', null, base + interval '22 seconds', null),
  (cl, conv, pac_ids[3], 'outbound', true, 'text', E'O que você precisa para *Laura Mendes Carvalho*?\n\n*1* 💊 2ª via de receita\n*2* 🔬 Pedido de exame\n\nDigite *9* para falar com a nossa equipe, ou *0* para voltar ao início.', 'read', base + interval '25 seconds', base + interval '25 seconds', base + interval '26 seconds', base + interval '30 seconds'),
  (cl, conv, pac_ids[3], 'inbound', false, 'interactive', '2ª via de receita', 'delivered', base + interval '36 seconds', null, base + interval '36 seconds', null),
  (cl, conv, pac_ids[3], 'outbound', true, 'text', 'Qual medicamento? Pode escrever como está na receita.', 'read', base + interval '38 seconds', base + interval '38 seconds', base + interval '39 seconds', base + interval '45 seconds'),
  (cl, conv, pac_ids[3], 'inbound', false, 'text', 'Sulfato ferroso', 'delivered', base + interval '58 seconds', null, base + interval '58 seconds', null),
  (cl, conv, pac_ids[3], 'outbound', true, 'text', E'A farmácia pediu alguma correção?\n\nSe pediram, escreva o que foi. Se não, responda *não*.\n\n📎 Se tiver foto do documento que não foi aceito, pode mandar aqui.', 'read', base + interval '60 seconds', base + interval '60 seconds', base + interval '61 seconds', base + interval '70 seconds'),
  (cl, conv, pac_ids[3], 'inbound', false, 'interactive', 'Não pediram nada', 'delivered', base + interval '80 seconds', null, base + interval '80 seconds', null),
  (cl, conv, pac_ids[3], 'outbound', true, 'text', E'✅ Pedido registrado.\n\n💊 2ª via de receita · Laura Mendes Carvalho\nSulfato ferroso\n\nO Dr. Marcello vai revisar e responder por aqui, em até *1 dia útil*.\n\nDigite *0* a qualquer momento para voltar ao início.', 'read', base + interval '82 seconds', base + interval '82 seconds', base + interval '83 seconds', base + interval '2 minutes');

  -- 5. Patricia faz uma pergunta clinica: o robo nao orienta e passa para a equipe
  base := (hoje + time '07:46') at time zone tz;
  insert into public.whatsapp_conversations (clinic_id, patient_id, wa_id, display_phone, profile_name, status, needs_attention, attention_reason, unread_count, last_message_at)
  values (cl, pac_ids[5], '5511990000005', '11990000005', 'Patrícia Dias', 'open', true, 'atendente', 2, base + interval '40 seconds')
  returning id into conv;
  insert into public.whatsapp_messages (clinic_id, conversation_id, patient_id, direction, automatic, message_type, body, status, created_at, sent_at, delivered_at, read_at) values
  (cl, conv, pac_ids[5], 'inbound', false, 'text', 'A Sofia acordou com dor de barriga de novo, posso dar o remédio que o doutor passou da outra vez?', 'delivered', base, null, base, null),
  (cl, conv, pac_ids[5], 'outbound', true, 'text', E'Sobre sintomas, remédios e o que fazer, quem responde é o Dr. Marcello ou alguém da equipe - por aqui eu não posso orientar. Digite *3* para falar com a equipe, ou escolha:\n\n*1* 💬 Dúvidas sobre a consulta\n*2* 🗓️ Marcar uma consulta ou retorno\n*3* 🗣️ Falar com alguém da equipe\n*4* 🔄 Ver, remarcar ou cancelar\n*5* 📄 2ª via de receita ou pedido de exame', 'read', base + interval '3 seconds', base + interval '3 seconds', base + interval '4 seconds', base + interval '20 seconds'),
  (cl, conv, pac_ids[5], 'inbound', false, 'text', '3', 'delivered', base + interval '40 seconds', null, base + interval '40 seconds', null);

  -- Saude dos envios: lembretes das ultimas 24h ja estao acima; mais
  -- acompanhamentos da semana, registrados nas conversas de quem os recebeu.
  raise notice 'Demonstracao criada: % pacientes, % consultas, % agendamentos, % conversas',
    (select count(*) from public.patients where clinic_id = cl),
    (select count(*) from public.consultations where clinic_id = cl),
    (select count(*) from public.appointments where clinic_id = cl),
    (select count(*) from public.whatsapp_conversations where clinic_id = cl);
end
$demo$;

-- Conferencia: a clinica real nao pode ter mudado em nada. Se algum destes
-- telefones inventados aparecer fora da clinica de teste, desfaz tudo.
do $conf$
begin
  if exists (
    select 1 from public.patients p join public.clinics c on c.id = p.clinic_id
     where p.phone like '1_9900000%' and c.name <> 'Clínica de teste Memed'
  ) then
    raise exception 'Dado de demonstracao fora da clinica de teste. Desfeito.';
  end if;
end
$conf$;

commit;
