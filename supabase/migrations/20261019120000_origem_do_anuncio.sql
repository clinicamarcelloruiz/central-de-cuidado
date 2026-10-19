begin;

/**
 * De qual anuncio a conversa veio (19/10/2026).
 *
 * A campanha do Instagram (18/10) leva direto ao WhatsApp do robo, e nada na
 * Central dizia quem tinha chegado por ela. O webhook passa a gravar aqui o
 * que a Meta manda no bloco `referral` (ou, sem ele, a mensagem pronta do
 * anuncio). Ver _shared/origem-do-anuncio.ts.
 *
 *   origem_anuncio         instagram | facebook | meta (a Meta nao disse qual) | google
 *   origem_anuncio_em      quando a mensagem do anuncio chegou (a ultima, se vier de novo)
 *   origem_anuncio_titulo  titulo do anuncio, quando a Meta manda
 *   origem_anuncio_url     o link cru, para conferir a classificacao depois
 */
alter table public.whatsapp_conversations
  add column if not exists origem_anuncio text,
  add column if not exists origem_anuncio_em timestamptz,
  add column if not exists origem_anuncio_titulo text,
  add column if not exists origem_anuncio_url text;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_origem_anuncio_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_origem_anuncio_check
  check (origem_anuncio is null or origem_anuncio in ('instagram', 'facebook', 'meta', 'google'));

create index if not exists whatsapp_conversations_origem_anuncio
  on public.whatsapp_conversations (clinic_id, origem_anuncio_em desc)
  where origem_anuncio is not null;

-- Quem ja chegou desde que as campanhas entraram no ar (18/10) nao tinha o
-- referral guardado. A mensagem pronta e o que sobrou para reconhecer: a do
-- anuncio do Instagram e a que o site poe para quem veio do Google.
with pelo_texto as (
  select m.conversation_id,
         case
           when m.body ilike '%vi o an_ncio e quero agendar%' then 'instagram'
           else 'google'
         end as origem,
         min(m.created_at) as quando
  from public.whatsapp_messages m
  where m.direction = 'inbound'
    and m.created_at >= '2026-10-18'
    and (m.body ilike '%vi o an_ncio e quero agendar%'
         or m.body ilike '%encontrei o dr. marcello no google%'
         or m.body ilike '%encontrei o dr marcello no google%')
  group by 1, 2
)
update public.whatsapp_conversations c
set origem_anuncio = p.origem,
    origem_anuncio_em = p.quando
from pelo_texto p
where p.conversation_id = c.id
  and c.origem_anuncio is null;

commit;
