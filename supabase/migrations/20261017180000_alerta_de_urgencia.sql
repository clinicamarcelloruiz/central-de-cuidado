-- Alerta de urgencia no WhatsApp pessoal (17/10/2026).
--
-- Pedido do Edu: quando o robo ou a IA entendem que uma crianca esta mal, o
-- Dr. Marcello e o Edu recebem uma mensagem no WhatsApp deles, a qualquer
-- hora. Ate aqui a urgencia so acendia a conversa na Central e mandava
-- notificacao para quem tinha o app instalado.
--
-- Os numeros moram aqui, editaveis no cartao "Atendente com IA", e nao num
-- segredo do Supabase: trocar o numero de quem recebe nao pode depender de
-- alguem lembrar de mexer no painel (o lembrete da vespera ficou tres semanas
-- parado por um segredo escrito errado). Coluna nova: as funcoes leem em
-- consulta separada, com try/catch, e sem ela so o alerta deixa de sair - com
-- erro no log.

alter table public.clinic_settings
  add column if not exists alerta_urgencia_telefones text[] not null default '{}'::text[];

comment on column public.clinic_settings.alerta_urgencia_telefones is
  'Celulares (55 + DDD + numero) que recebem o modelo alerta_urgencia quando uma conversa entra em urgencia, a qualquer hora. Editavel em Preferencias > Atendente com IA.';

grant update (alerta_urgencia_telefones) on table public.clinic_settings to authenticated;
