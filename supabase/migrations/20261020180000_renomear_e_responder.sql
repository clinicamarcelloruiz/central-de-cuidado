begin;

/**
 * Nome da conversa escolhido pela equipe (20/10/2026).
 *
 * O numero corporativo do credenciamento da Trasmontano marcou consulta para
 * uma crianca pelo robo, e a ficha gravou aquele numero como telefone dela.
 * Dali em diante a conversa da Caroliny, do credenciamento, aparecia na tela
 * com o nome do paciente (Lorenzo), e a equipe nao tinha como corrigir ali.
 *
 * O nome daqui so muda o que a tela mostra no cartao e no cabecalho. O
 * cadastro do paciente continua como esta. Nulo = nome do cadastro ou do
 * WhatsApp, como antes.
 */
alter table public.whatsapp_conversations
  add column if not exists nome_personalizado text;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_nome_personalizado_tamanho;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_nome_personalizado_tamanho
  check (nome_personalizado is null or char_length(nome_personalizado) between 1 and 120);

comment on column public.whatsapp_conversations.nome_personalizado is
  'Nome que a equipe deu a esta conversa na tela (botao Renomear). Nao muda o cadastro do paciente. Nulo = nome do cadastro ou do WhatsApp.';

grant update (nome_personalizado) on table public.whatsapp_conversations to authenticated;

/**
 * Mensagem respondida (20/10/2026): o "responder" do WhatsApp.
 *
 * A equipe responde citando uma mensagem da familia, e a familia ve a citacao
 * no WhatsApp dela (context.message_id da Meta). Guardar aqui a mensagem citada
 * deixa a tela mostrar a mesma citacao em cima do balao. Tambem vale para a
 * familia citando uma mensagem nossa.
 */
alter table public.whatsapp_messages
  add column if not exists responde_a uuid references public.whatsapp_messages(id) on delete set null;

comment on column public.whatsapp_messages.responde_a is
  'Mensagem que esta responde, citada no WhatsApp (context.message_id). Nulo = mensagem solta.';

/**
 * "Este numero nao e do paciente" (20/10/2026).
 *
 * Desliga a conversa do cadastro quando o telefone casou com a crianca errada
 * (numero de convenio, de escola, de avo que marcou para varios netos). A tela
 * nao recebe permissao direta em patient_id: ligar a conversa a um paciente
 * qualquer continua so pelo vincular_contato_ao_paciente, que confere o
 * telefone. Aqui so se desliga.
 *
 * Se o cadastro continuar com este telefone, a proxima mensagem liga de novo:
 * corrigir o telefone do paciente e parte do conserto, e a tela avisa.
 */
create or replace function public.desvincular_conversa_do_paciente(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_clinic_id uuid;
begin
  select c.clinic_id into v_clinic_id
  from public.whatsapp_conversations c
  where c.id = p_conversation_id;

  if v_clinic_id is null then
    raise exception 'Conversa nao encontrada.';
  end if;

  if not (select private.is_clinic_editor(v_clinic_id)) then
    raise exception 'Sem permissao para mudar conversas nesta clinica.';
  end if;

  update public.whatsapp_conversations
  set patient_id = null
  where id = p_conversation_id;
end;
$fn$;

comment on function public.desvincular_conversa_do_paciente(uuid) is
  'Desliga a conversa do cadastro do paciente, quando o telefone casou com a crianca errada.';

revoke all on function public.desvincular_conversa_do_paciente(uuid) from public, anon;
grant execute on function public.desvincular_conversa_do_paciente(uuid) to authenticated;

commit;
