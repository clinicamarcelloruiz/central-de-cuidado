-- Com qual familia o medico esta conversando pelo WhatsApp dele (18/10/2026).
--
-- No primeiro dia de uso, o Dr. Marcello e o Edu tinham dois avisos abertos
-- (Paula e Heitor). O Edu tocou "Eu respondo" no do Heitor e escreveu "Tudo
-- bem. Como podemos ajudar?": o robo respondeu "Ha 2 alertas recentes... segure
-- a mensagem do alerta certo", e de novo na mensagem seguinte. Quem esta numa
-- conversa quer mandar varias mensagens seguidas sem escolher a familia a cada
-- uma.
--
-- respondido_em / respondido_por: a ultima vez que este numero respondeu a este
-- aviso (botao ou mensagem enviada). O texto sem citar segue para o aviso da
-- ultima resposta dele, enquanto nao chegar aviso novo. Ver escolherAlerta em
-- _shared/resposta-ao-alerta.ts. Colunas novas: lidas em consulta separada,
-- com try/catch; sem elas, volta a pergunta de qual familia.
alter table public.alertas_de_urgencia
  add column if not exists respondido_em timestamptz,
  add column if not exists respondido_por text;

create index if not exists alertas_de_urgencia_respondido_idx
  on public.alertas_de_urgencia (clinic_id, respondido_por, respondido_em desc);
