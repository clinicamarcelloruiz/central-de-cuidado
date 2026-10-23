/**
 * Robo desligado so numa conversa (23/10/2026).
 *
 * Mais cedo no mesmo dia entrou um botao "Desligar robo" no topo das
 * Conversas, que desligava o robo da clinica inteira. O Edu: "o desligar robo
 * tem que ser na conversa individual, nao em tudo". A equipe assume uma
 * familia (a mae do Kadu, que recebeu acompanhamento sem ter consultado) e o
 * robo segue atendendo as outras.
 *
 * Nulo = o robo responde nesta conversa, como antes. Preenchido = quando a
 * equipe desligou; o robo (menu, agendamento, atendente com IA, envio depois
 * do convenio) fica calado ate alguem religar. Lembrete e acompanhamento
 * agendados continuam saindo: sao avisos da clinica, nao resposta do robo.
 */
alter table public.whatsapp_conversations
  add column if not exists robo_desligado_em timestamptz;

comment on column public.whatsapp_conversations.robo_desligado_em is
  'Quando a equipe desligou o robo so nesta conversa (botao na conversa). Nulo = o robo responde normalmente.';

grant update (robo_desligado_em) on table public.whatsapp_conversations to authenticated;
