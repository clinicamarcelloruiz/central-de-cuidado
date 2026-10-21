begin;

/**
 * Bom dia das 8h todo dia, e nao so de segunda a sexta (21/10/2026).
 *
 * A primeira versao (20261021090000_bom_dia_da_equipe) rodava so nos dias de
 * atendimento, e o pedido de sexta a noite perdia a janela de 24h da Meta ate
 * segunda. O Edu: "nosso diferencial de ter robo e atender full time". Nos
 * dias sem equipe a funcao manda o texto que nao promete ninguem por aqui
 * (ver textoDoBomDia em _shared/bom-dia-da-equipe.ts).
 *
 * 11h UTC = 8h em Sao Paulo.
 */
select cron.unschedule('bom-dia-da-equipe')
where exists (select 1 from cron.job where jobname = 'bom-dia-da-equipe');

select cron.schedule(
  'bom-dia-da-equipe',
  '0 11 * * *',
  $$ select private.disparar_bom_dia_da_equipe(); $$
);

commit;
