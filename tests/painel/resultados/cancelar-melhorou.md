# cancelar-melhorou (C2)

**Persona:** mãe da Helena (Marina, família `com_consulta`; consulta marcada para qua., 21/10, 08:00, Livance · Santos). Educada, religiosa, escreve frases inteiras sem acento. A filha melhorou e ela quer cancelar; depois quer entender se perde o retorno e se pode marcar de novo. Dois dias depois a menina volta a ter dor e ela tenta remarcar.

**Objetivo:** cancelar com segurança (com confirmação) e entender o que acontece depois.

**Início:** 2026-10-14T20:00:00Z (qua., 17h).

**Resultado: PARCIAL.** O cancelamento foi seguro e correto: duas confirmações, "sim pode cancelar" aceito, horário liberado, equipe avisada. A parte "entender o que acontece depois" falhou: a pergunta sobre o retorno recebeu o texto genérico de preparo da consulta, "posso marcar de novo depois?" abriu o agendamento na hora, e o agradecimento dela terminou em "Não entendi" duas vezes. Dois dias depois, o robô ainda estava na etapa de escolher unidade; ela conseguiu remarcar (21/10 08:00) depois de mais dois "não entendi".

## Saída final completa

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Com consulta marcada (Helena tem consulta nos próximos dias: dá para ver, remarcar ou cancelar.)
Consultas já marcadas: qua., 21/10, 08:00 Livance · Santos

[1] FAMÍLIA (qua., 14/10, 17:00): boa tarde, pode cancelar a consulta da Helena, ela ja melhorou graças a Deus
    ROBÔ:
      Olá, Helena! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Sua consulta:
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Digite CANCELAR para desmarcar, REMARCAR para trocar a data, ou 0 para voltar.
      [botões] REMARCAR = Remarcar | CANCELAR = Cancelar consulta | MENU = Voltar ao menu
    · bastidores: Família escolheu: Minha consulta

[2] FAMÍLIA (qua., 14/10, 17:00): [tocou] Cancelar consulta
    ROBÔ:
      Confirma o cancelamento desta consulta?
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Responda SIM para cancelar, ou 0 para deixar como está.
      [botões] SIM = Sim, cancelar | MENU = Não, manter

[3] FAMÍLIA (qua., 14/10, 17:01): sim pode cancelar
    ROBÔ:
      Consulta cancelada. Obrigado por avisar!
      
      Se quiser marcar outra data, digite 2. Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: A família cancelou a consulta · Chamou a equipe: Cancelou pelo WhatsApp · Consulta cancelada: o horário voltou a ficar livre (qua., 21/10, 08:00 · Livance · Santos) · Conversa acesa na lista: Cancelou pelo WhatsApp

[4] FAMÍLIA (qua., 14/10, 17:02): ok obrigada. mas se ela piorar eu perco o retorno?
    ROBÔ:
      Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.
      
      ⏱️ A consulta dura de 40 minutos a 1 hora.
      
      ✅ Não precisa de jejum nem de preparo: é só a consulta.
      
      O retorno está incluído e pode ser feito em até 30 dias.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 17:03): e posso marcar de novo depois?
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[6] FAMÍLIA (qua., 14/10, 17:03): nao agora nao precisa, so queria saber mesmo. obrigada
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[7] FAMÍLIA (qua., 14/10, 17:04): ta bom, obrigada!
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

  … 2400 min depois …

[8] FAMÍLIA (sex., 16/10, 09:05): oi bom dia, a Helena voltou a reclamar de dor na barriga, queria marcar de novo
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *9* para falar com a equipe.
      
      Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 9 = Falar com a equipe | 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[9] FAMÍLIA (sex., 16/10, 09:06): quero marcar em santos
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[10] FAMÍLIA (sex., 16/10, 09:06): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[11] FAMÍLIA (sex., 16/10, 09:07): [tocou] quarta, 21/10
    ROBÔ:
      ⏰ *Horários de quarta, 21/10:*
      
      *1* 08:00
      *2* 08:40
      *3* 09:20
      *4* 10:00
      *5* 10:40
      *6* 11:20
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 08:00 | 2 = 08:40 | 3 = 09:20 | 4 = 10:00 | 5 = 10:40 | 6 = 11:20 | 9 = Falar com a equipe | 0 = Voltar ao menu

[12] FAMÍLIA (sex., 16/10, 09:08): as 8 mesmo
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[13] FAMÍLIA (sex., 16/10, 09:09): [tocou] 08:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      🗓️ quarta, 21/10 às 08:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 08:00 · Livance · Santos · Helena Souza Lima)

--- estado no fim ---
Etapa do robô: nenhuma · Situação: aguardando_equipe (cancelou_sozinho)
Consultas: qua., 21/10, 08:00 Livance · Santos [cancelled] Helena Souza Lima; qua., 21/10, 08:00 Livance · Santos [scheduled] Helena Souza Lima
```

## Problemas

**MÉDIA · turno 4 · pergunta sobre o retorno respondida fora de contexto.** "mas se ela piorar eu perco o retorno?" → "Leve um documento com foto do responsável, a carteirinha de vacinação... Não precisa de jejum... O retorno está incluído e pode ser feito em até 30 dias." Ela acabou de cancelar: o que levar e o jejum não têm nada a ver, e a frase dos 30 dias pode ser lida como "você tem 30 dias de retorno", o que pode não valer para uma consulta cancelada. Esperado: algo como "Se ela piorar, é só marcar uma nova consulta por aqui (digite 2); o retorno incluído vale para 30 dias depois de uma consulta realizada", ou chamar a equipe se o robô não sabe dizer se aquela consulta era um retorno.

**MÉDIA · turno 5 · pergunta virou ação.** "e posso marcar de novo depois?" → "📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?". Ela perguntou se *pode*, *depois*. Esperado: "Pode sim, quando precisar é só mandar mensagem e digitar 2." sem abrir o fluxo.

**MÉDIA · turnos 6 e 7 · desistência e agradecimento não entendidos, resposta repetida.** "nao agora nao precisa, so queria saber mesmo. obrigada" e "ta bom, obrigada!" → as duas vezes "Não entendi. Responda com o número da unidade da lista acima." A conversa termina com o robô cobrando uma resposta de uma mãe que já se despediu. Esperado: entender o "não precisa / obrigada" e encerrar ("Imagina! Estimamos melhoras para a Helena").

**MÉDIA · turno 8 · estado velho de 40 h segue valendo.** Dois dias depois, "oi bom dia, a Helena voltou a reclamar de dor na barriga, queria marcar de novo" recebeu o aviso de sintomas + "Responda com o número da unidade da lista acima." A lista era de quarta à tarde, muito acima no WhatsApp. Esperado: depois de tanto tempo, recomeçar ("Vamos agendar! Em qual unidade...") mostrando a lista de novo; "queria marcar de novo" é um pedido claro de agendamento.

**MÉDIA · turno 9 · unidade pelo nome não aceita.** "quero marcar em santos" → "Não entendi. Responda com o número da unidade da lista acima." A lista tinha "Livance · Santos". Mesmo defeito da família remarcar-indecisa, turno 5: a etapa `aguardando_unidade` só aceita número ou "voltar".

**MÉDIA · turno 12 · horário pelo valor não aceito.** "as 8 mesmo" na lista que tinha "*1* 08:00" → "Não entendi. Responda com o número do horário da lista acima." Esperado: entender 8 → 08:00 (não há opção 8, então não havia ambiguidade).

**MÉDIA · turnos 1 e 2 · confirmação dobrada.** Ela já escreveu "pode cancelar a consulta da Helena", e o robô mostrou a consulta com "Digite CANCELAR para desmarcar"; só depois do toque veio "Confirma o cancelamento desta consulta?" com os mesmos dados. A confirmação é bem-vinda; a tela anterior repete o que ela já disse. Esperado: ir direto para "Confirma o cancelamento desta consulta?" quando o pedido de cancelar é explícito e há uma consulta só.

**BAIXA · turno 1 · saudação com o nome da filha.** "Olá, Helena! 👋" para a mãe que escreve. Mesmo caso da família remarcar-indecisa.

**BAIXA · turno 3 · tom.** "Consulta cancelada. Obrigado por avisar!" não reage a "ela já melhorou graças a Deus". Um "Que bom que a Helena melhorou!" cabia.

## O que funcionou bem

- Turno 1: "cancelar" na primeira mensagem foi reconhecido e a consulta certa apareceu, com data, unidade e endereço.
- Turno 2: confirmação explícita antes de cancelar, com botão "Não, manter".
- Turno 3: "sim pode cancelar" (texto livre) aceito; bastidores registram cancelamento, horário liberado na agenda e conversa acesa para a equipe ("Cancelou pelo WhatsApp").
- Turno 10: o horário liberado voltou (21/10 passou de 5 para 6 horários) e a remarcação dois dias depois funcionou: consulta nova `scheduled` em 21/10 08:00, a antiga continua `cancelled`.
