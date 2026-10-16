-- Etiqueta "Tentou falar (ligacao?)" (16/10/2026). Ver destinoDaNaoSuportada
-- em supabase/functions/_shared/mensagem-recebida.ts.
--
-- O contato (11) 91935-1515 mandou duas vezes algo que o WhatsApp entrega como
-- "[unsupported]" - provavelmente uma ligacao - e o menu do robo voltou
-- "Message undeliverable" nas duas. Agora o robo nao responde e a conversa vai
-- para a equipe com este motivo, que diz para usar um modelo aprovado.
--
-- A lista e a de 20261006120000 mais 'nao_suportada'. A funcao sobe antes
-- desta migration e, ate ela chegar, grava 'atendente' no lugar (plano B no
-- webhook).

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_attention_reason_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_attention_reason_check check (
    attention_reason is null
    or attention_reason in (
      'atendente', 'remarcacao', 'cancelamento', 'ajuda', 'falha', 'cancelou_sozinho',
      'urgencia', 'anexo', 'documento', 'farmacia', 'numero_errado', 'nao_suportada'
    )
  );
