begin;

/**
 * Livance: andar, pagamento e valor de Sao Paulo (28/09/2026).
 *
 * Informacoes do Dr. Marcello, repassadas pelo Edu em 28/09:
 *
 *  - "Na Livance e sempre no 20 andar." Os textos diziam "20o e 21o
 *    andares" (20260926120000) - a familia podia subir para o 21o.
 *
 *  - "Quando coloco na agenda da Livance o paciente, ele recebe um link de
 *    pagamento." Os textos de Santos mandavam pagar no totem, na chegada
 *    (20260926140000). Com o link ja pago, a familia pagaria duas vezes ou
 *    ficaria em duvida na recepcao. O totem continua sendo o check-in.
 *
 *  - "SP vou deixar 600.00, tem todo deslocamento." Sao Paulo passa de
 *    R$ 550 para R$ 600. O pagamento de Sao Paulo NAO mudou aqui: o recado
 *    fala da agenda da Livance, e a unidade de Sao Paulo tambem e Livance
 *    (Ibirapuera), mas ninguem confirmou o link para la - fica pix ou
 *    dinheiro ate a clinica dizer.
 *
 * So a clinica real. Cada troca e por replace() do trecho exato, e avisa
 * (raise warning) quando o trecho nao esta la: texto editado pela equipe na
 * tela nao e sobrescrito as cegas.
 *
 * O modelo mudanca_santos_livance, aprovado na Meta, tem o andar e o
 * pagamento antigos gravados LA - isto nao o corrige. Ver modelos.ts.
 */

do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
  n int;
begin
  -- 1. Andar, em tudo que a familia le.
  update public.clinic_units
     set address = replace(address, '20º e 21º andares', '20º andar'),
         info_text = replace(info_text, '20º e 21º andares', '20º andar')
   where clinic_id = c
     and (strpos(address, '20º e 21º andares') > 0 or strpos(coalesce(info_text, ''), '20º e 21º andares') > 0);
  get diagnostics n = row_count;
  raise notice 'Unidades com andar corrigido: %', n;

  update public.bot_answers
     set answer = replace(answer, '20º e 21º andares', '20º andar')
   where clinic_id = c and strpos(answer, '20º e 21º andares') > 0;
  get diagnostics n = row_count;
  raise notice 'Respostas com andar corrigido: %', n;

  update public.clinic_settings
     set whatsapp_profile_address = replace(whatsapp_profile_address, '20º e 21º andares', '20º andar'),
         whatsapp_profile_description = replace(whatsapp_profile_description, '20º e 21º andares', '20º andar'),
         whatsapp_menu_info_text = replace(whatsapp_menu_info_text, '20º e 21º andares', '20º andar')
   where clinic_id = c;

  -- 2. Pagamento em Santos: link da Livance, nao totem.
  update public.clinic_units
     set info_text = replace(replace(info_text,
           'Pagamento no totem, na chegada, junto com o check-in: pix, débito ou crédito à vista.',
           'Pagamento online, pelo link que a Livance envia para você assim que a consulta é agendada.'),
           'faça o check-in no totem digitando o nome do paciente e, ali mesmo, o pagamento.',
           'faça o check-in no totem digitando o nome do paciente.')
   where clinic_id = c and name = 'Livance · Santos';
  if not exists (select 1 from public.clinic_units where clinic_id = c and name = 'Livance · Santos'
                  and strpos(info_text, 'pelo link que a Livance envia') > 0
                  and strpos(info_text, 'ali mesmo, o pagamento') = 0) then
    raise warning 'Livance · Santos: texto de pagamento fora do formato esperado. Conferir em Unidades.';
  end if;

  update public.bot_answers
     set answer = replace(answer,
           'em Santos, no totem da Livance, por pix, débito ou crédito à vista;',
           'em Santos, online, pelo link que a Livance envia assim que a consulta é agendada;'),
         keywords = array(select distinct unnest(keywords || array['link']))
   where clinic_id = c and subject = 'Valor e pagamento';

  -- 3. Sao Paulo: R$ 600.
  update public.clinic_units
     set info_text = replace(info_text, '*Consulta em São Paulo: R$ 550,00.*', '*Consulta em São Paulo: R$ 600,00.*')
   where clinic_id = c and name = 'Livance Ibirapuera - São Paulo';

  update public.bot_answers
     set answer = replace(answer, '• São Paulo: R$ 550,00', '• São Paulo: R$ 600,00')
   where clinic_id = c and subject = 'Valor e pagamento';

  -- Conferencia: o que ainda sobrou dos textos antigos.
  select count(*) into n from (
    select info_text t from public.clinic_units where clinic_id = c and archived_at is null
    union all select address from public.clinic_units where clinic_id = c and archived_at is null
    union all select answer from public.bot_answers where clinic_id = c
  ) x where t ~ '(21º|totem da Livance, por pix|ali mesmo, o pagamento|R\$ 550)';
  if n > 0 then
    raise warning 'Ainda ha % texto(s) com andar/pagamento/valor antigo na clinica real.', n;
  end if;
end
$$;

commit;
