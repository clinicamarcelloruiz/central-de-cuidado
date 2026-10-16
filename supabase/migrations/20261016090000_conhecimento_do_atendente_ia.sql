-- O que o atendente com IA sabe do consultorio alem dos cartoes (16/10/2026).
--
-- No segundo teste real o Claude respondeu "essa avaliacao e medica" para "o
-- doutor pode fazer exame para meu filho?". Faltava a ele o que qualquer
-- secretaria sabe: quem e o medico, o que ele trata, como e a consulta. Isso
-- estava so no site (drmarcelloruiz.com.br), em lugar nenhum do banco.
--
-- Um texto livre por clinica, editavel no cartao "Atendente com IA". Coluna
-- nova: as funcoes leem em consulta separada, com try/catch, e sem ela o
-- Claude so perde este bloco.

alter table public.clinic_settings
  add column if not exists assistente_ia_conhecimento text;

comment on column public.clinic_settings.assistente_ia_conhecimento is
  'Texto livre que o atendente com IA usa para responder: o medico, o que trata, como e a consulta. Editavel em Preferencias > Atendente com IA.';

grant update (assistente_ia_conhecimento) on table public.clinic_settings to authenticated;

-- So a clinica real, e so se ninguem escreveu nada ainda: texto que a equipe
-- ja editou na tela nao e sobrescrito.
update public.clinic_settings
   set assistente_ia_conhecimento = $texto$Dr. Marcello Ruiz da Silva, gastroenterologista pediátrico (CRM 85878, RQE Pediatria 150713). Tem doutorado e é professor da Faculdade de Ciências Médicas de Santos (UNILUS). Referência em gastroenterologia pediátrica na Baixada Santista. Atende crianças e adolescentes, de recém-nascidos até 19 anos.

Condições que ele diagnostica e trata no consultório (entre outras do aparelho digestivo):
- Refluxo gastroesofágico: regurgitação frequente, vômitos, irritabilidade e desconforto depois das mamadas ou refeições.
- Intolerância à lactose: barriga estufada, gases e diarreia com leite e derivados.
- Doença celíaca (intolerância ao glúten), com impacto no crescimento e na absorção de nutrientes.
- Síndrome do intestino irritável.
- Alergia alimentar, incluindo APLV (alergia à proteína do leite de vaca).
- Constipação crônica (intestino preso) e diarreia persistente.
- Dor abdominal funcional e dores de barriga que voltam sem causa aparente.

Como é a consulta: escuta e avaliação completa, com a história da criança e exame físico, com calma e sem pressa. O Dr. Marcello explica as hipóteses aos pais com clareza e pede exames complementares só quando são necessários. O plano de tratamento é feito para cada criança, e a evolução é acompanhada consulta a consulta.

Instagram do consultório: @drmarcelloruizgastroped (dicas de saúde digestiva infantil). Site: drmarcelloruiz.com.br.$texto$
 where clinic_id = '1ffde840-a905-4300-b4fd-51571fcefdc0'
   and coalesce(trim(assistente_ia_conhecimento), '') = '';
