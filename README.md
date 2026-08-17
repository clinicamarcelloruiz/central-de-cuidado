# Central de Cuidado — Dr. Marcello Ruiz

Sistema web responsivo para cadastro de pacientes e organização de acompanhamentos de 30 e 90 dias após a consulta.

## Publicação

O sistema é publicado automaticamente no GitHub Pages a cada atualização da branch `main`. O site é público apenas na tela de login; pacientes e dados clínicos permanecem no Supabase, protegidos por autenticação e RLS.

## Estado atual

- Interface desktop e mobile.
- Login por e-mail e senha com Supabase Auth.
- Pacientes, preferências e follow-ups armazenados no Supabase.
- RLS forçado em todas as tabelas clínicas; nenhuma tabela é acessível por `anon`.
- Pacientes são arquivados, sem exclusão direta pelo navegador.
- O botão de WhatsApp ainda abre uma mensagem pronta; o envio automático e a caixa de entrada serão ligados em uma etapa posterior pela API oficial.

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha apenas:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Nunca coloque senha do banco, secret key ou `service_role` no frontend.
4. Instale e execute:

```bash
npm install
npm run dev
```

## Banco de dados

As migrations ficam em `supabase/migrations/`. O primeiro usuário autenticado cria de forma atômica sua clínica, associação de proprietário e preferências iniciais.

## Verificação

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Primeiro acesso

Crie manualmente o primeiro usuário em **Supabase → Authentication → Users → Add user** e mantenha cadastro público desativado. Ao entrar pela primeira vez, o sistema cria o espaço da clínica e começa com a base vazia — nenhum paciente fictício é enviado para a nuvem.

