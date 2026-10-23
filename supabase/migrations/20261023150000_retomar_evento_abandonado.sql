-- Evento do webhook so vale como "feito" quando o processamento termina.
--
-- 23/10/2026: a mae do Arthur respondeu o dia da consulta com o Supabase
-- instavel. A plataforma derrubou a funcao por tempo (504) e funcao derrubada
-- nao chega ao catch que libera a chave (20260924100000). A chave ficou, os
-- reenvios da Meta foram descartados como repetidos e a familia ficou sem
-- resposta, sem erro em lugar nenhum. Agora o webhook grava concluded_at ao
-- terminar cada evento; chave sem conclusao e com mais de 3 minutos e de uma
-- execucao que morreu, e o reenvio a retoma. Ver
-- supabase/functions/_shared/eventos-do-webhook.ts.

alter table public.whatsapp_webhook_events
  add column if not exists concluded_at timestamptz;

-- O que ja estava gravado foi processado pelo codigo antigo: conta como
-- concluido, senao um reenvio tardio da Meta seria retomado e respondido de novo.
update public.whatsapp_webhook_events
  set concluded_at = processed_at
  where concluded_at is null;

-- concluir e retomar sao UPDATE; o service_role so tinha select, insert e
-- delete (20260823193000, 20260924100000). Sem isto a retomada falha e o
-- webhook volta a descartar, como antes.
grant update on table public.whatsapp_webhook_events to service_role;

-- O alerta de urgencia (Edge Function, service_role) grava uma nota interna na
-- conversa, mas a tabela so foi liberada para authenticated (20260925140000).
-- No log de 23/10 as 09:59: "permission denied for table conversation_notes" -
-- o alerta saiu para os celulares, mas a nota nunca apareceu na conversa.
grant select, insert on table public.conversation_notes to service_role;
