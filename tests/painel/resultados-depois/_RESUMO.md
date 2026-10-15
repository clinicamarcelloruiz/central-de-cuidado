# Painel de famílias: antes x depois (14 e 15/10/2026)

Primeira rodada: `tests/painel/resultados/`. Segunda rodada, depois das correções 1 a 7: aqui. As mesmas 16 personas jogadas de novo por agentes; roteiros em `tests/painel/familias-depois/`.

| Família | Antes | Depois |
|---|---|---|
| audio-transcrito | parcial | parcial |
| avo-maiusculas | parcial | conseguiu |
| cancelar-melhorou | parcial | parcial |
| convenio-reembolso | parcial | conseguiu |
| datas-por-extenso | conseguiu | conseguiu (4 mensagens em vez de 7) |
| farmacia | parcial | parcial |
| foto-exame | conseguiu com tropeços | conseguiu com tropeços |
| irmaos-mesmo-dia | conseguiu com passos a mais | conseguiu com passos a mais |
| numero-errado | parcial | parcial (o simulador não passa pelo webhook) |
| pai-apressado | parcial | conseguiu |
| remarcar-indecisa | parcial | conseguiu |
| retorno-40-dias | parcial | conseguiu |
| segunda-via-receita | parcial | parcial |
| sintoma-noite | parcial | conseguiu |
| site-santos-sexta | conseguiu com tropeços | conseguiu |
| telemedicina-longe | parcial | parcial |

Placar: 4 → 10 famílias chegaram ao objetivo.

## Achados da segunda rodada já corrigidos (15/10)

- Consulta da "Outra criança" ligada ao cadastro do irmão (`cadastro.ts`, `mesmaCrianca`).
- "Inclui retorno em 30 dias?" virava pedido de retorno para novembro (`retornoAlemDaAgenda`).
- "Tá bom, obrigada" ou o fim da ficha apagavam a bandeira que já estava acesa: o aviso de cancelamento, a pergunta do app, a da dipirona (`meta-webhook` e simulador).
- "Deixa quieto, vou manter a de quarta dia 21" abria os horários do dia 21, e um toque a mais trocava a consulta (`desistiuComCerteza`).
- "Quero marcar em São Paulo" com a lista de informações na tela ia para a equipe.
- "Não precisa ser em Santos" escolhia Santos (unidade negada).
- "Não agora, não precisa... obrigada" não era entendido como saída.

## O que resta (não corrigido)

- "Olá, Helena!" para a mãe: o nome do paciente usado como se fosse de quem escreve.
- Perguntas sem resposta pronta: "precisa de app?", "fazem consulta online?", "qual o telefone?", "o retorno é cobrado?" (cadastrar em Respostas prontas).
- Irmãos: não há caminho para "os dois" de uma vez.
- CPF mandado depois do PULAR não entra no cadastro (vai para a equipe).
- Opt-out sem cadastro se desfaz se a pessoa escrever de novo (o webhook grava `open` em toda mensagem).
- Farmácia tratada como família; 2ª via com dois itens só registra o primeiro.
