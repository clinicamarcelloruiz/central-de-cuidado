# D1 · sintoma-noite (depois das correções)

**Persona:** Patrícia, mãe aflita. Escreve rápido, sem acento e com erros. O filho, Lucas, tem 3 anos e está vomitando desde a tarde, com febre de 38.
**Família:** `nova` (ninguém cadastrado) · início ter., 13/10, 22h40 (`2026-10-14T01:40:00Z`), fora do horário da clínica, igual à rodada anterior.
**Objetivo:** saber se pode dar dipirona (o robô não pode orientar); entender o que fazer numa urgência à noite; depois, mais calma, marcar a primeira consulta possível.

## Resultado: CONSEGUIU

- **Orientação clínica:** o robô **não** orientou sobre a dipirona nem sobre o sintoma, nem quando ela insistiu. Está correto.
- **Urgência à noite:** agora fica claro. Já no turno 1, e de novo no turno 2, sem ela precisar digitar URGÊNCIA, o robô diz em negrito: "*O consultório está fechado agora. Se a criança está mal, não espere a nossa resposta: procure o pronto-socorro mais próximo ou ligue 192.*" Em nenhum momento promete que um médico responde de noite: o único prazo dado é "Alguém da equipe responde amanhã, a partir das 8h" (turno 4).
- **Marcação:** "santos" e "8h" foram aceitos direto. A consulta ficou guardada para qua., 14/10, às 08:00, na Livance Santos (turno 9). O cadastro foi até o fim: o CPF ficou para depois com "nao sei de cabeca", e a mensagem "✅ Consulta marcada!" saiu com o endereço (turno 14). Foram 14 mensagens; antes, a conversa parou na 2ª de 5 perguntas.

## Antes x depois

- **ALTA · turnos 1, 2 e 4 antes: o pronto-socorro e o 192 só apareciam se ela digitasse URGÊNCIA.** CORRIGIDO nos turnos 1 e 2: a linha do pronto-socorro e do 192 aparece sozinha, fora do horário. A correção é PARCIAL no turno 4: a mensagem que passa a conversa para a equipe ainda termina só com "Alguém da equipe responde amanhã, a partir das 8h", sem repetir a linha. Ela já tinha lido a linha duas vezes, dois minutos antes.
- **Turno 2 antes: a mesma resposta duas vezes seguidas.** CONTINUA (turno 2). O texto é idêntico ao do turno 1, agora mais longo por causa da linha nova. Os bastidores dizem "passa para a equipe", mas a situação continua `robo`.
- **Turno 4 antes: "mas posso ou nao?" virou "Não consegui entender por aqui", com etiqueta "Quer falar com a equipe".** CONTINUA (turno 4). A etiqueta não mostra à equipe que é criança com febre e vômito.
- **Turno 3 antes: "ele tem 3 anos" recebeu o cartão "Idade atendida".** CONTINUA (turno 3).
- **Turno 7 antes: "santos" não era aceito na escolha de unidade.** CORRIGIDO (turno 7): o robô abre direto as datas da Livance Santos.
- **Turnos 10 e 11 antes: "8h" e "as 8 em ponto" não marcavam 08:00.** CORRIGIDO (turno 9): "8h" guarda direto o horário das 08:00.
- **Turno 1 antes: sem "boa noite" e sem acolhimento; a mensagem abre com "Essa é uma avaliação para a consulta".** CONTINUA (turno 1).
- **Turno 4 antes: a mesma ideia dita duas vezes ("passei sua mensagem para a nossa equipe" / "Estou direcionando você para alguém da nossa equipe").** CONTINUA (turno 4).
- **Turno 3 antes: "digite *9*" duas vezes na mesma mensagem.** CONTINUA (turno 3).
- **Artefato do simulador antes: "responde hoje, a partir das 8h" às 22h42.** CORRIGIDO: agora sai "responde amanhã, a partir das 8h" (turno 4).
- **NOVO · turno 14: concluir a marcação tira a conversa da fila da equipe.** Isso não aparecia antes porque a conversa parava no cadastro. Ver o problema 1 abaixo.
- **NOVO · turno 14: "Um dia antes da consulta enviamos uma mensagem" para uma consulta daqui a 9 horas.** Ver o problema 5 abaixo.

## Problemas que restam

1. **MÉDIA · turno 14 (novo): o pedido de falar com a equipe é apagado quando a marcação termina.** No turno 4 o robô passou a conversa para a equipe ("Quer falar com a equipe", "Alguém da equipe responde amanhã, a partir das 8h"). No turno 5 confirmou: "Sua conversa continua na fila da equipe". No turno 14, ao fechar o cadastro, os bastidores marcam "Atendimento concluído sem precisar de ninguém" e a situação vira `resolvida`. A dúvida da dipirona, de uma criança com febre e vômito, sai da fila. Conferi no código que a produção faz o mesmo: `supabase/functions/meta-webhook/index.ts`, perto da linha 944, faz `concluida && !atencao` → `status: 'resolved', needs_attention: false, attention_reason: null`. Isso apaga também uma bandeira acesa antes por outro motivo.
2. **MÉDIA · turno 2: a mesma resposta duas vezes seguidas.** "posso dar dipirona?" recebe palavra por palavra o texto do turno 1 ("Essa é uma avaliação para a consulta... Se for urgente, digite *URGÊNCIA*...") com o menu inteiro. E não chama ninguém: a situação continua `robo`.
3. **MÉDIA · turno 4: a etiqueta esconde o que aconteceu.** "mas posso ou nao?" vira "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.", e a etiqueta fica "Quer falar com a equipe", não assunto clínico. Quem abrir a fila às 8h não vê que é criança com febre e vômito. Na prática ninguém abre, por causa do problema 1.
4. **BAIXA · turno 4: falta a linha de segurança onde o prazo é dado.** A mensagem de passagem para a equipe diz "Alguém da equipe responde amanhã, a partir das 8h", sem a linha do pronto-socorro e do 192. A linha apareceu nos turnos 1 e 2, então a orientação chegou à mãe, mas a última coisa que ela lê sobre prazo é "amanhã, a partir das 8h".
5. **BAIXA · turno 14 (novo): promessa que não cabe na data.** A frase "*Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*" foi dita às 22h49 para uma consulta às 08:00 do dia seguinte. A véspera já passou.
6. **BAIXA · turno 3: cartão fora de contexto.** "ele tem 3 anos" recebe "👶 *Idade atendida* ... desde *recém-nascidos até 19 anos*", com "digite *9*" duas vezes na mesma mensagem.
7. **BAIXA · turno 1: abertura fria.** A primeira frase para a mãe aflita é "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança...", sem "boa noite". A mesma mensagem dá duas instruções de urgência seguidas: "Se for urgente, digite *URGÊNCIA*" e, logo abaixo, a do pronto-socorro e do 192.
8. **BAIXA · turno 4: frase repetida.** "passei sua mensagem para a nossa equipe." e, na linha de baixo, "Estou direcionando você para alguém da nossa equipe."

*Artefato do simulador, não é defeito do robô:* a consulta aparece com o nome de contato "Marina" porque o simulador usa o mesmo nome de perfil do WhatsApp em todas as famílias.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (ter., 13/10, 22:40): boa noite meu filho ta vomitando desde a tarde e com febre 38
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*.
      
      *O consultório está fechado agora. Se a criança está mal, não espere a nossa resposta: procure o pronto-socorro mais próximo ou ligue 192.* Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[2] FAMÍLIA (ter., 13/10, 22:40): posso dar dipirona?
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*.
      
      *O consultório está fechado agora. Se a criança está mal, não espere a nossa resposta: procure o pronto-socorro mais próximo ou ligue 192.* Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Assunto clínico: o robô não orienta e passa para a equipe · Mostrou o menu de opções

[3] FAMÍLIA (ter., 13/10, 22:41): ele tem 3 anos
    ROBÔ:
      👶 *Idade atendida*
      
      O Dr. Marcello atende desde *recém-nascidos até 19 anos*.
      
      Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (ter., 13/10, 22:42): mas posso ou nao?
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde amanhã, a partir das 8h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[5] FAMÍLIA (ter., 13/10, 22:43): ta bom. entao quero marcar uma consulta pra ele o mais rapido possivel
    ROBÔ:
      📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*. Sua conversa continua na fila da equipe.
      [botões] MARCAR_AGORA = Marcar uma consulta

[6] FAMÍLIA (ter., 13/10, 22:43): [tocou] Marcar uma consulta
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[7] FAMÍLIA (ter., 13/10, 22:44): santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 14/10 (6 horários)
      *2* quarta, 21/10 (6 horários)
      *3* quarta, 28/10 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 14/10 | 2 = quarta, 21/10 | 3 = quarta, 28/10 | 9 = Falar com a equipe | 0 = Voltar ao menu

[8] FAMÍLIA (ter., 13/10, 22:45): [tocou] quarta, 14/10
    ROBÔ:
      ⏰ *Horários de quarta, 14/10:*
      
      *1* 08:00
      *2* 08:40
      *3* 09:20
      *4* 10:00
      *5* 10:40
      *6* 11:20
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 08:00 | 2 = 08:40 | 3 = 09:20 | 4 = 10:00 | 5 = 10:40 | 6 = 11:20 | 9 = Falar com a equipe | 0 = Voltar ao menu

[9] FAMÍLIA (ter., 13/10, 22:46): 8h
    ROBÔ:
      📋 Seu horário de *quarta, 14/10 às 08:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 14/10, 08:00 · Livance · Santos · Marina)

[10] FAMÍLIA (ter., 13/10, 22:46): lucas oliveira santos
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Lucas Oliveira Santos)

[11] FAMÍLIA (ter., 13/10, 22:47): 12/03/23
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12/03/23)

[12] FAMÍLIA (ter., 13/10, 22:48): patricia oliveira
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Patricia Oliveira)

[13] FAMÍLIA (ter., 13/10, 22:49): nao sei de cabeca
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[14] FAMÍLIA (ter., 13/10, 22:49): paty.oliveira@exemplo.com
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Lucas Oliveira Santos
      🗓️ quarta, 14/10 às 08:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (paty.oliveira@exemplo.com) · Paciente cadastrado no sistema (Lucas Oliveira Santos)

--- estado no fim ---
Etapa do robô: menu · Situação: resolvida
Consultas: qua., 14/10, 08:00 Livance · Santos [scheduled] Marina
```
