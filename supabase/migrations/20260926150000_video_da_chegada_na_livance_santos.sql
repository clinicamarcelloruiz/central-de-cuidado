begin;

/**
 * O video da chegada na Livance Santos vai nas respostas do robo.
 *
 * O reel da Livance mostra o totem, o check-in e o profissional buscando o
 * paciente - explica em 30 segundos o que o texto leva um paragrafo para
 * dizer. Ele NAO pode ir no modelo de aviso da mudanca: em 26/09/2026 a Meta
 * classificou o modelo como Marketing por causa do link do Instagram, e so
 * aprovou como Utilidade sem ele. Resposta do robo nao passa por aprovacao
 * (so sai depois que a familia escreve), entao o link mora aqui.
 *
 * Dois lugares: o texto da unidade (informacoes e valor de Santos) e a
 * resposta de endereco. Idempotente pelo proprio link: se ja estiver no
 * texto, nao entra de novo.
 */

-- Texto da unidade: logo depois do paragrafo do check-in. Se a clinica
-- reescreveu esse paragrafo pela tela, o video vai para o fim do texto.
update public.clinic_units
set info_text = case
      when strpos(info_text, 'assim que terminar a consulta anterior.') > 0 then
        replace(
          info_text,
          'assim que terminar a consulta anterior.',
          E'assim que terminar a consulta anterior.\n\n🎥 Veja como funciona a chegada: https://www.instagram.com/reels/DYmuhB1xqJf/'
        )
      else
        info_text || E'\n\n🎥 Veja como funciona a chegada: https://www.instagram.com/reels/DYmuhB1xqJf/'
    end
where archived_at is null
  and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos'
  and strpos(info_text, 'DYmuhB1xqJf') = 0
  and char_length(info_text) <= 1024 - 90;

-- Resposta de endereco: logo abaixo da linha da Livance Santos. A frase de
-- transicao "(Ate 30/09...)" continua colada no fim, e a tarefa de 01/10
-- (private.mudar_santos_para_livance) segue achando e tirando ela.
update public.bot_answers
set answer = replace(
      answer,
      'Av. Anna Costa, 228, 20º e 21º andares, Gonzaga, Santos.',
      E'Av. Anna Costa, 228, 20º e 21º andares, Gonzaga, Santos.\n🎥 Como funciona a chegada: https://www.instagram.com/reels/DYmuhB1xqJf/'
    )
where subject = 'Endereço e estacionamento'
  and strpos(answer, 'Av. Anna Costa, 228, 20º e 21º andares, Gonzaga, Santos.') > 0
  and strpos(answer, 'DYmuhB1xqJf') = 0
  and char_length(answer) <= 1024 - 90;

do $$
declare
  n integer;
begin
  select count(*) into n
    from public.clinic_units
   where archived_at is null
     and lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'livancesantos'
     and strpos(info_text, 'DYmuhB1xqJf') = 0;
  if n > 0 then
    raise warning 'ATENCAO: o texto da Livance · Santos ficou sem o video da chegada (texto longo demais?).';
  end if;

  select count(*) into n
    from public.bot_answers
   where is_active
     and subject = 'Endereço e estacionamento'
     and answer ilike '%anna costa%'
     and strpos(answer, 'DYmuhB1xqJf') = 0;
  if n > 0 then
    raise warning 'ATENCAO: a resposta de endereco ficou sem o video da chegada (a clinica reescreveu a linha da Livance?).';
  end if;
end $$;

commit;
