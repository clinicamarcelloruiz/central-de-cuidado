begin;

/**
 * Resposta pronta que pergunta onde é o atendimento antes de responder.
 *
 * "Quanto custa a consulta?" não tem uma resposta só: Santos é R$ 450, São
 * Paulo R$ 550 e a telemedicina R$ 450 com retorno presencial. Despejar os
 * três valores num parágrafo obriga a família a achar o dela no meio. Com este
 * interruptor ligado, o robô faz a mesma pergunta da opção 1 do menu - Santos,
 * São Paulo ou Telemedicina - e responde o texto daquele lugar, com valor,
 * pagamento e endereço certos.
 *
 * O texto da resposta continua existindo: vale quando a clínica tem um lugar
 * só (aí não há o que perguntar) e como reserva se o texto da unidade estiver
 * vazio.
 */

alter table public.bot_answers
  add column if not exists ask_unit boolean not null default false;

comment on column public.bot_answers.ask_unit is
  'Ligado, o robo pergunta a unidade (ou telemedicina) e responde o texto de informacoes dela, em vez do texto desta resposta.';

update public.bot_answers
set ask_unit = true
where subject = 'Valor e pagamento';

commit;
