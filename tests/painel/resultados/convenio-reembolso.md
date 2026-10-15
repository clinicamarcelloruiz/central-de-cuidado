# D2 · convenio-reembolso

**Persona:** mãe da Helena (paciente já cadastrada). Quarta, 13h, dentro do horário. Pergunta em sequência, uma mensagem por pergunta, escrita curta de WhatsApp.

**Objetivo:** entender se a clínica atende Unimed / Bradesco Saúde e como funciona o reembolso; encaminhar o pedido da nota fiscal da consulta do mês passado para mandar ao plano.

**Resultado:** parcial.
- Convênio: entendeu (consulta só particular, recibo para reembolso).
- Reembolso: só a frase "Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano", dentro do cartão de valores. Como pedir e quando o recibo chega, o robô não explicou.
- Nota fiscal: o primeiro pedido, claro e completo, recebeu o cartão "Idade atendida" e não foi registrado. Só na segunda tentativa a conversa foi para a equipe, e com a etiqueta genérica "Quer falar com a equipe", não como pedido de nota fiscal.

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
      👶 *Idade atendida*
      
      O Dr. Marcello atende desde *recém-nascidos até 19 anos*.
      
      Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início

[5] FAMÍLIA (qua., 14/10, 13:03): oi? nao perguntei idade kkk. eu quero a nota fiscal da consulta da helena
    ROBÔ:
      Passei sua pergunta para a nossa equipe, que responde por aqui.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Dúvida sem resposta pronta: passou para a equipe · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[6] FAMÍLIA (qua., 14/10, 13:03): foi dia 16/09 em santos. pode mandar por aqui msm ou no email
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 120 min depois …

[7] FAMÍLIA (qua., 14/10, 15:04): oi, alguem viu minha msg da nota fiscal?
    ROBÔ:
      💙 *Valores da consulta:*
      
      • Santos: R$ 450,00
      • São Paulo: R$ 600,00
      • Telemedicina: R$ 450,00
      
      Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).
      
      💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      🙋 Sua conversa continua na fila: alguém da nossa equipe responde por aqui.

[8] FAMÍLIA (qua., 14/10, 15:05): ta, fico no aguardo. obrigada
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: nenhuma
```

## Problemas

### ALTA

1. **Turno 4: o pedido de nota fiscal sumiu e ela recebeu o cartão de idade.** "preciso da nota fiscal da consulta do mes passado pra mandar pro plano" → "👶 *Idade atendida* O Dr. Marcello atende desde *recém-nascidos até 19 anos*." Ninguém foi chamado e o pedido não foi anotado. Causa no código: o turno 3 deixou a conversa na etapa `informacoes_unidade` (a pergunta "Escolha o atendimento"). Nessa etapa `pediuNotaFiscal` não é conferido, e o texto cai em `acharResposta`; a palavra "mes" está nas palavras-chave da resposta de idade. Conferi à parte, fora da conversa: a mesma frase mandada com o menu na tela (logo depois de "vcs atendem unimed?") cai certo em "🧾 Anotei o pedido de *nota fiscal / recibo*". **Esperado:** pedido de nota fiscal reconhecido em qualquer etapa sem fluxo aberto, como já acontece no menu.

### MÉDIA

2. **Turno 3: "como funciona o reembolso?" recebeu a tabela de preços e a pergunta "Quer ver endereço e o que levar? Escolha o atendimento".** O reembolso aparece numa linha só, no fim do cartão. Ela não perguntou preço nem endereço, e a lista de unidades a colocou numa etapa que estragou o turno seguinte (problema 1). **Esperado:** resposta sobre o reembolso: o recibo tem CRM e CNPJ, ela pede ao plano, o valor depende do contrato, e como pedir o recibo de uma consulta já feita.
3. **Turno 5: o pedido foi para a equipe como dúvida genérica.** "eu quero a nota fiscal da consulta da helena" → "Passei sua pergunta para a nossa equipe". Nos bastidores: "Dúvida sem resposta pronta" e "Chamou a equipe: Quer falar com a equipe" (situação `atendente`, não `documento`). O robô também não pediu o nome do paciente e a data da consulta, como faz o caminho próprio da nota fiscal. **Esperado:** "🧾 Anotei o pedido de nota fiscal", etiqueta de documento, pedido de nome e data.
4. **Turno 7: "oi, alguem viu minha msg da nota fiscal?" recebeu de novo o cartão inteiro de valores** (o mesmo do turno 3), seguido de "🙋 Sua conversa continua na fila". Ela perguntou se alguém viu, não quanto custa: a resposta pronta casou pela palavra "nota". **Esperado:** só a segunda parte ("sua conversa continua na fila...").

### BAIXA

5. **Turno 2: "e bradesco saude?" → "👆 Essa informação está logo acima."** Está correto (nenhum convênio é aceito), mas é seco e obriga a mãe a deduzir. "Bradesco Saúde também não: a consulta é só particular, com recibo para reembolso" resolveria numa linha.

### Artefato do simulador (não é defeito do robô em produção)

- **Turno 5: "Agora estamos fora do horário de atendimento ... Alguém da equipe responde hoje, a partir das 8h"**, dito numa quarta às 13h03 simulada. Como na D1, `avisoDeHorario()` é chamado sem o relógio e usa a hora real da máquina (quinta, ~00h30). Em produção, às 13h, sairia "Atendemos de segunda a sexta, das 8h às 18h". O painel não serve para conferir o aviso de horário enquanto isso não passar `agora`.

### Observação de uma conferência à parte (não aconteceu nesta conversa)

- Quando o pedido de nota fiscal cai no caminho certo, a conversa acende como "📄 Pediu 2ª via / exame". A situação é `documento`, mas o rótulo fala de 2ª via e exame, e quem abre a fila pode achar que é receita.

## O que funcionou bem

- Turno 1: resposta direta e correta sobre convênio, com o recibo para reembolso.
- Turnos 6 e 8: depois de passar para a equipe, o robô ficou em silêncio, sem falar por cima da equipe, e não mandou menu depois do "obrigada".
