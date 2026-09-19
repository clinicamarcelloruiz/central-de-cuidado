begin;

/**
 * Duas correções que vêm da leitura das conversas de 18/09.
 *
 * ---------------------------------------------------------------
 * 1. O consultório passou a atender um convênio
 * ---------------------------------------------------------------
 *
 * O Dr. Marcello atende TRASMONTANO, na unidade de Santos. Isso derruba a
 * premissa em que toda a resposta de convênio foi construída em 15/09: "o
 * consultório não atende convênio nenhum, então a resposta é a mesma para
 * todos". Não é mais. Existe exceção, e ela muda o que a família precisa fazer.
 *
 * A resposta passa a dizer as três coisas, na ordem em que interessam: o que é
 * aceito, onde, e o que levar. E diz também o que NÃO é aceito, porque quem
 * tem outro plano precisa saber antes de marcar, não na recepção.
 *
 * Trocada em três lugares, senão o robô se contradiz: a resposta pronta, o
 * texto de informações de Santos, e o de São Paulo e telemedicina, que seguem
 * particulares.
 *
 * ---------------------------------------------------------------
 * 2. "Vocês atendem bebês?" recebia o texto de convênio
 * ---------------------------------------------------------------
 *
 * Em 18/09 a Crislaine perguntou três vezes se o consultório atende bebê de
 * três meses, e nas três recebeu a resposta de convênio. Ela só foi atendida
 * por gente às 00:03, seis horas depois.
 *
 * A causa está escrita na migration de 15/09, que previu o problema e aceitou
 * o custo: as palavras 'atende' e 'atendem' entraram na lista de convênio para
 * pegar "vocês atendem Unimed?", e o comentário reconhece que "vocês atendem
 * crianças de 2 anos?" passaria a cair ali. Na época o cálculo fazia sentido,
 * porque a resposta de convênio servia para todo mundo. Agora não serve, e o
 * erro custou uma mãe com um bebê de três meses esperando meia-noite.
 *
 * Então 'atende', 'atendem' e 'atendimento' saem da lista de convênio - as
 * marcas e as palavras próprias de plano continuam lá e dão conta. E nasce uma
 * resposta de idade, que nunca existiu: é a primeira coisa que alguém com
 * recém-nascido pergunta numa gastro pediátrica.
 *
 * A idade vem do que a própria equipe respondeu para a Crislaine: "desde
 * recém-nascidos até 19 anos".
 */

-- ---------------------------------------------------------------
-- Convênios: agora com exceção
-- ---------------------------------------------------------------

update public.bot_answers
set answer = E'💳 *Convênios*\n\n' ||
      E'Atendemos *Trasmontano* na unidade de *Santos*. Basta levar a carteirinha e um documento com foto: não é preciso guia nem autorização antes da consulta.\n\n' ||
      E'Em São Paulo e na telemedicina o atendimento é particular.\n\n' ||
      E'Outros convênios não são atendidos. Nesses casos a consulta é particular, com pagamento em pix ou dinheiro, e emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano. O valor devolvido depende do seu contrato.',
    keywords = array[
      -- as palavras próprias de plano de saúde
      'convenio', 'convênio', 'convenios', 'convênios', 'plano', 'planos',
      'saude', 'saúde', 'aceita', 'aceitam', 'cobertura', 'coberto',
      'credenciado', 'credenciada', 'carteirinha', 'reembolso', 'particular',
      -- as marcas mais ouvidas na Baixada e em São Paulo
      'unimed', 'bradesco', 'amil', 'sulamerica', 'sulamérica', 'porto',
      'notredame', 'notre', 'hapvida', 'trasmontano', 'bluemed', 'blue',
      'omint', 'careplus', 'golden', 'prevent', 'seguros'
      -- 'atende', 'atendem' e 'atendimento' saíram: pegavam "vocês atendem
      -- bebês?" e mandavam a família para o texto errado.
    ]
where subject = 'Convênios';

-- ---------------------------------------------------------------
-- Idade atendida: resposta nova
-- ---------------------------------------------------------------
--
-- Position 15 para ficar entre "Valor e pagamento" (10) e o resto. A ordem
-- desempata quando duas respostas pontuam igual, e perguntar idade é mais
-- comum do que a maioria dos assuntos abaixo.

insert into public.bot_answers (clinic_id, subject, keywords, answer, ask_unit, position, is_active)
select
  c.id,
  'Idade atendida',
  array[
    'bebe', 'bebê', 'bebes', 'bebês', 'recem', 'recém', 'nascido', 'nascidos',
    'neném', 'nenem', 'idade', 'idades', 'meses', 'mes', 'mês',
    'crianca', 'criança', 'criancas', 'crianças', 'adolescente', 'adolescentes',
    'adulto', 'adultos', 'anos'
  ],
  E'👶 *Idade atendida*\n\n' ||
    E'O Dr. Marcello atende desde *recém-nascidos até 19 anos*.\n\n' ||
    E'Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.',
  false,
  15,
  true
from public.clinics as c
where not exists (
  select 1 from public.bot_answers as b
  where b.clinic_id = c.id and b.subject = 'Idade atendida'
);

-- ---------------------------------------------------------------
-- Texto das unidades
-- ---------------------------------------------------------------
--
-- Só onde a frase antiga ainda está. Se a clínica já reescreveu o texto pela
-- tela, o que ela escreveu vale mais do que o que eu suponho aqui.

update public.clinic_units
set info_text = replace(
      info_text,
      'Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
      'Atendemos Trasmontano: leve a carteirinha e um documento com foto. Outros convênios não são atendidos, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.'
    )
where archived_at is null
  and name ilike '%santos%'
  and strpos(info_text, 'Não atendemos convênio') > 0;

update public.clinic_units
set info_text = replace(
      info_text,
      'Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
      'Nesta unidade não atendemos convênio (o Trasmontano vale só em Santos), mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.'
    )
where archived_at is null
  and name not ilike '%santos%'
  and strpos(info_text, 'Não atendemos convênio') > 0;

update public.clinic_settings
set telemedicine_info_text = replace(
      telemedicine_info_text,
      'Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.',
      'Na telemedicina não atendemos convênio (o Trasmontano vale só em Santos, presencial), mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.'
    )
where strpos(coalesce(telemedicine_info_text, ''), 'Não atendemos convênio') > 0;

commit;
