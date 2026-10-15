# D2 · convenio-reembolso · depois das correções

**Persona:** mãe da Helena (paciente já cadastrada). Quarta, 13h, dentro do horário. Pergunta em sequência, uma mensagem por pergunta, escrita curta de WhatsApp.

**Família:** `cadastrada` (Helena já é paciente). Início 2026-10-14T16:00:00Z (qua., 13h), igual à rodada anterior.

**Objetivo:** entender se a clínica atende Unimed / Bradesco Saúde e como funciona o reembolso; encaminhar o pedido da nota fiscal da consulta do mês passado para mandar ao plano.

## Resultado: CONSEGUIU

O defeito grave da rodada anterior sumiu: o mesmo pedido de nota fiscal, logo depois da lista "Escolha o atendimento", agora é reconhecido na primeira tentativa (turno 4), vai para a equipe como `documento`, pede nome do paciente e data da consulta, e o aviso de horário sai certo para uma quarta às 13h. Ela respondeu com nome e data (turno 5), o robô ficou quieto e a conversa terminou na fila certa. A conversa ficou dois turnos mais curta (sem o "oi? nao perguntei idade kkk"). O que não mudou: "como funciona o reembolso?" ainda recebe a tabela de preços com uma linha sobre recibo (turno 3), e "alguem viu minha msg da nota fiscal?" ainda recebe o cartão de valores inteiro (turno 6). Convênio e reembolso ela entendeu o essencial (consulta particular, recibo com CRM e CNPJ, valor depende do plano), mas sem explicação de como pedir.

## Antes x depois

- **ALTA · turno 4, pedido de nota fiscal virou cartão "Idade atendida":** corrigido. Turno 4 → "🧾 Anotei o pedido de *nota fiscal / recibo*. Para a equipe já localizar, escreva aqui o *nome do paciente* e a *data da consulta*..."; bastidores "Pedido de nota fiscal", situação `aguardando_equipe (documento)`.
- **MÉDIA · turno 3, "como funciona o reembolso?" → tabela de preços + "Escolha o atendimento":** continua, resposta idêntica. A diferença é que a etapa `informacoes_unidade` já não estraga o turno seguinte.
- **MÉDIA · turno 5, pedido foi como dúvida genérica ("Quer falar com a equipe", sem pedir nome e data):** corrigido, agora no turno 4 (etiqueta de documento, pede nome e data).
- **MÉDIA · turno 7, "alguem viu minha msg da nota fiscal?" → cartão de valores inteiro:** continua, agora no turno 6, idêntico.
- **BAIXA · turno 2, "👆 Essa informação está logo acima.":** continua, idêntico.
- **Artefato do simulador, aviso "fora do horário" numa quarta às 13h:** corrigido. Turno 4 → "Atendemos de segunda a sexta, das 8h às 18h."
- **Observação à parte, rótulo "📄 Pediu 2ª via / exame" para nota fiscal:** continua, e agora aparece nesta conversa (turno 4, bastidores "Chamou a equipe: 📄 Pediu 2ª via / exame").
- Silêncio depois de passar para a equipe (turnos 5 e 7), sem menu depois do "obrigada": continua funcionando.

## Problemas que restam

1. **MÉDIA · turno 3 · reembolso respondido com a tabela de preços.** "como funciona o reembolso?" → "💙 *Valores da consulta:* • Santos: R$ 450,00..." e no fim "📍 Quer ver endereço e o que levar? Escolha o atendimento". O reembolso é só a frase "Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano"; como pedir o recibo de uma consulta já feita não aparece.
2. **MÉDIA · turno 6 · cobrança de resposta recebe o cartão de valores.** "oi, alguem viu minha msg da nota fiscal?" → o mesmo cartão de valores do turno 3, seguido de "🙋 Sua conversa continua na fila". Pelo código, na fila uma pergunta com uma palavra do assunto ("nota", que está nas palavras-chave de valores) já casa com a resposta pronta, e o cartão do turno 3 saiu duas horas antes, então não conta como "já mandada".
3. **BAIXA · turno 4 · rótulo da fila.** O pedido de nota fiscal acende como "📄 Pediu 2ª via / exame". A situação (`documento`) está certa, mas quem abre a lista pode achar que é receita ou pedido de exame.
4. **BAIXA · turno 2 · resposta seca.** "e bradesco saude?" → "👆 Essa informação está logo acima." Correto, mas a mãe precisa deduzir que Bradesco também não é aceito.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 13:00): vcs atendem unimed?
    ROBÔ:
      💳 *Convênios*
      
      Não atendemos convênio: a consulta do Dr. Marcello é particular, em todas as unidades e na telemedicina.
      
      Emitimos recibo para você pedir reembolso ao seu plano. O valor devolvido depende do seu contrato.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[2] FAMÍLIA (qua., 14/10, 13:00): e bradesco saude?
    ROBÔ:
      👆 Essa informação está logo acima. Se ficou alguma dúvida, é só perguntar à nossa equipe.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[3] FAMÍLIA (qua., 14/10, 13:01): como funciona o reembolso?
    ROBÔ:
      💙 *Valores da consulta:*
      
      • Santos: R$ 450,00
      • São Paulo: R$ 600,00
      • Telemedicina: R$ 450,00
      
      Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).
      
      💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      📍 Quer ver endereço e o que levar? Escolha o atendimento:
      
      *1* Livance · Santos
      *2* Livance Ibirapuera - São Paulo
      *3* Telemedicina (por vídeo)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (qua., 14/10, 13:02): preciso da nota fiscal da consulta do mes passado pra mandar pro plano
    ROBÔ:
      🧾 Anotei o pedido de *nota fiscal / recibo*.
      
      Para a equipe já localizar, escreva aqui o *nome do paciente* e a *data da consulta*, se ainda não mandou.
      
      Atendemos de segunda a sexta, das 8h às 18h.
    · bastidores: Pedido de nota fiscal · Chamou a equipe: 📄 Pediu 2ª via / exame · Conversa acesa na lista: 📄 Pediu 2ª via / exame

[5] FAMÍLIA (qua., 14/10, 13:03): helena. foi dia 16/09 em santos. pode mandar por aqui msm ou no email
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 120 min depois …

[6] FAMÍLIA (qua., 14/10, 15:03): oi, alguem viu minha msg da nota fiscal?
    ROBÔ:
      💙 *Valores da consulta:*
      
      • Santos: R$ 450,00
      • São Paulo: R$ 600,00
      • Telemedicina: R$ 450,00
      
      Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).
      
      💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      🙋 Sua conversa continua na fila: alguém da nossa equipe responde por aqui.

[7] FAMÍLIA (qua., 14/10, 15:04): ta, fico no aguardo. obrigada
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (documento)
Consultas: nenhuma
```
