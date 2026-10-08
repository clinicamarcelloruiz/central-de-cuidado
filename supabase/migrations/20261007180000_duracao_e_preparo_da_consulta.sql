begin;

/**
 * Duracao e preparo na resposta "O que levar e como e a consulta" (07/10/2026).
 *
 * A resposta pronta disparava para "jejum", "preparo", "quanto tempo demora" e
 * "duracao" (estao nas palavras-chave dela), mas o texto so falava do que
 * levar e terminava em "O retorno e 30 dias." - frase que soava como "o
 * retorno TEM de ser em 30 dias". Quem perguntava se a crianca precisava de
 * jejum recebia uma lista de documentos e nenhuma resposta.
 *
 * Informacao do Dr. Marcello, repassada pelo Edu em 07/10: a consulta dura de
 * 40 minutos a 1 hora, e nao tem preparo nenhum - e so a consulta.
 *
 * Troca por replace() do trecho exato, como nas outras migrations de texto:
 * se a equipe ja tiver editado a resposta na tela, nada e sobrescrito e o
 * aviso abaixo aparece no log do deploy.
 */

do $$
declare
  c constant uuid := '1ffde840-a905-4300-b4fd-51571fcefdc0';
  n int;
begin
  update public.bot_answers
     set answer = replace(answer,
           'O retorno é 30 dias.',
           E'⏱️ A consulta dura de 40 minutos a 1 hora.\n\n' ||
           E'✅ Não precisa de jejum nem de preparo: é só a consulta.\n\n' ||
           'O retorno está incluído e pode ser feito em até 30 dias.')
   where clinic_id = c
     and subject = 'O que levar e como é a consulta'
     and strpos(answer, 'O retorno é 30 dias.') > 0;
  get diagnostics n = row_count;

  if n = 0 then
    raise warning 'Resposta "O que levar e como e a consulta" sem o trecho "O retorno e 30 dias." - editada na tela? Duracao e preparo NAO entraram. Conferir.';
  end if;
end
$$;

commit;
