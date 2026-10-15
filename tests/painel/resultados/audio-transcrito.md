# G1 · audio-transcrito

**Persona:** mãe da Helena (já paciente), escreve mensagens longas, sem pontuação, como áudio transcrito, misturando vários assuntos numa mensagem só.
**Família:** `cadastrada` · início qua. 14/10/2026, 12h30.
**Objetivo:** (1) saber se o retorno da Helena é cobrado; (2) marcar o retorno em Santos, semana que vem, de manhã; (3) saber se o médico atende o irmão de 16 anos (refluxo).

## Resultado: PARCIAL

- (2) Retorno marcado: qua. 21/10, 10h, Livance · Santos, em nome da Helena. OK.
- (3) Idade: respondida no turno 2 ("recém-nascidos até 19 anos"). OK.
- (1) Cobrança do retorno: perguntada nos turnos 1, 2, 3, 5 e 7 e ignorada em todos. Ela só achou a frase "Inclui retorno em até 30 dias" no turno 9, sozinha, entrando em Dúvidas > Santos. Quando pediu para confirmar o caso dela (turno 10), recebeu a tabela geral de preços de novo. No fim precisou chamar a equipe.
- Ao tentar marcar para o irmão (turnos 12 a 14), o robô não perguntou para quem era a consulta. Numa verificação extra (abaixo) a segunda consulta foi gravada em nome da Helena.

## Saída completa do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 12:30): oi bom dia tudo bem entao a helena passou com o dr mes passado e ele pediu pra voltar com os exames que ela fez semana passada ai eu queria saber se esse retorno é cobrado e se tem horario pra semana que vem em santos de preferencia de manha porque eu trabalho a tarde e outra coisa o irmao dela de 16 anos ta com refluxo o dr atende adolescente?
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[2] FAMÍLIA (qua., 14/10, 12:30): nao nao eu nao to pedindo orientacao nao kkk é que assim eu so queria saber duas coisas primeiro se o retorno da helena com os exames é cobrado ou se ta incluso na consulta que ela fez e segundo se o dr atende adolescente porque o meu filho mais velho tem 16 e eu queria levar ele tambem mas nao sei se pediatra atende ate essa idade
    ROBÔ:
      👶 *Idade atendida*
      
      O Dr. Marcello atende desde *recém-nascidos até 19 anos*.
      
      Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[3] FAMÍLIA (qua., 14/10, 12:31): ah que bom entao ele atende o meu filho tambem otimo depois eu vejo dele mas e o retorno da helena é cobrado ou nao? porque na primeira consulta eu paguei particular e a moça falou alguma coisa de retorno mas eu nao lembro direito e tem horario semana que vem em santos de manha?
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (qua., 14/10, 12:32): [tocou] Livance · Santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 12:33): pode ser dia 21 sim mas tem que ser de manha ta porque a tarde eu trabalho e voce ainda nao me respondeu se o retorno é cobrado ne porque se for eu preciso me programar
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

[6] FAMÍLIA (qua., 14/10, 12:33): [tocou] 10:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      🗓️ quarta, 21/10 às 10:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 10:00 · Livance · Santos · Helena Souza Lima)

[7] FAMÍLIA (qua., 14/10, 12:34): ai obrigada mas so pra deixar claro isso é o retorno ta nao é consulta nova ela passou com o dr dia 22 do mes passado se nao me engano e eu vou levar os exames de sangue e o ultrassom que ela fez e ai esse retorno é cobrado ou nao? ninguem me respondeu isso ainda
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[8] FAMÍLIA (qua., 14/10, 12:35): [tocou] Dúvidas sobre a consulta
    ROBÔ:
      💬 Para qual atendimento você quer informações?
      
      *1* Livance · Santos
      *2* Livance Ibirapuera - São Paulo
      *3* Telemedicina (por vídeo)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Dúvidas sobre a consulta

[9] FAMÍLIA (qua., 14/10, 12:36): [tocou] Livance · Santos
    ROBÔ:
      💙 *Consulta em Santos: R$ 450,00.* Inclui retorno em até 30 dias.
      
      💳 Pagamento online: antes da consulta, você recebe da Livance um link de pagamento. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      📍 Livance · Santos: Av. Anna Costa, 228, 20º andar, Gonzaga. Estacionamento no próprio prédio, com entrada ao lado da portaria.
      
      🖥️ Ao chegar, faça o check-in no totem digitando o nome do paciente. O Dr. Marcello recebe o aviso e vem chamar vocês na sala de espera assim que terminar a consulta anterior.
      
      📋 Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.
      
      ──────────────
      
      ⚡ *Agendar por aqui é mais rápido*: digite *2* e escolha unidade, dia e horário na hora.
      
      🙋 Quer falar com alguém da equipe? Digite *9*.
      
      ⏰ Segunda a sexta, 8h às 18h. Fora desse horário, respondemos no próximo dia útil.
      
      Digite *1* para ver outra unidade ou *0* para ver todas as opções.
      [lista "Ver opções"] 2 = Marcar uma consulta | 1 = Outra unidade | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (qua., 14/10, 12:36): ah ta agora sim entao inclui retorno em 30 dias ne ela passou dia 22/09 e o retorno ficou pra 21/10 entao ta dentro ne nao vou pagar de novo? e ai esse link de pagamento da livance eu nao preciso pagar ne porque é retorno, so confirma pra mim pra eu nao pagar errado
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

[11] FAMÍLIA (qua., 14/10, 12:37): [tocou] Falar com a equipe
    ROBÔ:
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[12] FAMÍLIA (qua., 14/10, 12:38): ta bom entao deixa eu explicar pra moça marquei agora o retorno da helena dia 21/10 as 10h em santos ela passou dia 22/09 queria confirmar que nao paga e que eu nao preciso pagar aquele link da livance e aproveitando queria marcar tambem pro meu filho o pedro de 16 anos que ta com refluxo se der no mesmo dia logo depois dela seria otimo porque ai eu levo os dois de manha
    ROBÔ:
      📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*. Sua conversa continua na fila da equipe.
      [botões] MARCAR_AGORA = Marcar uma consulta

[13] FAMÍLIA (qua., 14/10, 12:39): [tocou] Marcar uma consulta
    ROBÔ:
      Você já tem uma consulta marcada:
      
      Helena Souza Lima
      quarta, 21/10 às 10:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      O que você prefere?
      
      1 - Remarcar (trocar por outra data)
      2 - Marcar mais uma consulta, além dessa
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 1 = Remarcar essa | 2 = Marcar mais uma | MENU = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[14] FAMÍLIA (qua., 14/10, 12:39): [tocou] Marcar mais uma
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (17 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (32 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

--- estado no fim ---
Etapa do robô: aguardando_unidade · Situação: aguardando_equipe (atendente)
Consultas: qua., 21/10, 10:00 Livance · Santos [scheduled] Helena Souza Lima
```

## Verificação extra (fora das 14 mensagens da persona)

Mesma conversa, mais 3 toques (Santos > 21/10 > 11:20), rodada a partir de um arquivo temporário fora do projeto, só para confirmar em nome de quem a consulta do irmão seria gravada:

```
[14] FAMÍLIA (qua., 14/10, 12:39): [tocou] Marcar mais uma
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (17 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (32 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[15] FAMÍLIA (qua., 14/10, 12:40): [tocou] Livance · Santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (5 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[16] FAMÍLIA (qua., 14/10, 12:41): [tocou] quarta, 21/10
    ROBÔ:
      ⏰ *Horários de quarta, 21/10:*
      
      *1* 08:00
      *2* 08:40
      *3* 09:20
      *4* 10:40
      *5* 11:20
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 08:00 | 2 = 08:40 | 3 = 09:20 | 4 = 10:40 | 5 = 11:20 | 9 = Falar com a equipe | 0 = Voltar ao menu

[17] FAMÍLIA (qua., 14/10, 12:42): [tocou] 11:20
    ROBÔ:
      ✅ *Consulta marcada!*
      
      🗓️ quarta, 21/10 às 11:20
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 11:20 · Livance · Santos · Helena Souza Lima)

--- estado no fim ---
Etapa do robô: nenhuma · Situação: aguardando_equipe (atendente)
Consultas: qua., 21/10, 10:00 Livance · Santos [scheduled] Helena Souza Lima; qua., 21/10, 11:20 Livance · Santos [scheduled] Helena Souza Lima
```

## Problemas

**ALTA**

- **Turno 14 (+ verificação extra) · consulta do irmão gravada no nome da Helena.** No turno 12 a mãe escreveu que a consulta era "pro meu filho o pedro de 16 anos". Ela tocou em *Marcar mais uma* e o robô foi direto para "Em qual unidade você prefere ser atendido?", sem perguntar para quem. Com os 3 toques a mais o resultado foi: "Consulta marcada na agenda (qua., 21/10, 11:20 · Livance · Santos · Helena Souza Lima)". Ficaram duas consultas da Helena no mesmo dia e nenhuma do Pedro. O esperado era "Essa consulta é para a Helena ou para outra pessoa?" e, se fosse outra pessoa, pedir nome e idade. (No código: `iniciarAgendamento`, com um paciente só, grava `booking_patient_id: pacientes[0]` sem perguntar, em `supabase/functions/_shared/atendimento.ts` perto da linha 1797.)

**MÉDIA**

- **Turno 1 · nenhuma das três perguntas respondida.** O robô respondeu "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança... Por aqui eu não posso orientar sobre sintomas, exames ou remédios" e mostrou o menu. Ela não pediu orientação: perguntou se o retorno é cobrado, se tem horário e se o médico atende um adolescente. A palavra "refluxo" (e "exames") parece ter disparado a recusa de sintoma, que cobriu todo o resto. O esperado era responder a idade e o valor do retorno e oferecer a marcação.
- **Turnos 2, 3 e 5 · "o retorno é cobrado?" ignorado de novo, três vezes.** No turno 2 só a idade foi respondida. No turno 3 o robô foi direto para "Vamos agendar!". No turno 5 ("voce ainda nao me respondeu se o retorno é cobrado") mostrou só os horários. O robô tem a resposta ("Inclui retorno em até 30 dias", que apareceu no turno 9) e não a deu em nenhuma dessas vezes.
- **Turno 7 · recusa de sintoma de novo, logo depois de marcar.** Para "isso é o retorno... vou levar os exames de sangue e o ultrassom... esse retorno é cobrado ou nao?" o robô repetiu "Por aqui eu não posso orientar sobre sintomas, exames ou remédios" e "Digite *2* para marcar uma consulta", sendo que a consulta tinha sido marcada um minuto antes. O esperado era confirmar que é retorno e dizer se é cobrado.
- **Turno 10 · resposta genérica para uma pergunta concreta.** Ela perguntou: "ela passou dia 22/09 e o retorno ficou pra 21/10 entao ta dentro ne... esse link de pagamento da livance eu nao preciso pagar ne". O robô devolveu a tabela "Santos: R$ 450,00 · São Paulo: R$ 600,00 · Telemedicina: R$ 450,00" e repetiu "pelo link de pagamento que a Livance envia antes da consulta". Quem lê isso pode achar que vai pagar R$ 450 de novo. O esperado era "Dentro de 30 dias o retorno não é cobrado; a equipe confirma" ou passar direto para a equipe.
- **Turno 6 · nada mostra que foi marcado como retorno.** A confirmação diz "✅ *Consulta marcada!*" e os bastidores, "Consulta marcada na agenda". A mãe disse várias vezes que é retorno, e o robô nunca perguntou se era consulta nova ou retorno. Se a Livance mandar o link de pagamento de uma consulta comum, ela cai exatamente na dúvida do turno 10.
- **Turno 3 · passo a mais.** Ela escreveu "tem horario semana que vem em santos de manha?" e o robô perguntou "Em qual unidade você prefere ser atendido?". Ela teve que tocar em Santos de novo.

**BAIXA**

- **Turno 1 · sem o nome.** Para a família cadastrada, a primeira resposta não usou o nome da Helena. Começou direto pela recusa de sintoma.
- **Turno 9 · "⚡ Agendar por aqui é mais rápido: digite 2"** para quem acabou de agendar.
- **Turno 11 · horário errado no aviso (problema do simulador, não do robô de produção).** Às 12h37 de quarta o robô disse "Agora estamos fora do horário de atendimento... Alguém da equipe responde hoje, a partir das 8h". `avisoDeHorario()` é chamado sem o relógio da simulação (por exemplo em `atendimento.ts`, linhas 851, 1547, 1588, 3563, 3846, 4120, 4226, 4381 e 4457) e lê o relógio da máquina, que estava na quinta, 00h31. Em produção os dois relógios são o mesmo e a frase sai certa. Mas no painel esse aviso sai errado em qualquer persona que chame a equipe.

## O que funcionou bem

- Marcar foi rápido: Santos, 21/10, 10h em três toques, com endereço e aviso de confirmação na véspera.
- A idade atendida veio clara (0 a 19 anos).
- Diante do "refluxo" o robô não deu nenhuma orientação clínica.
- Com a conversa na fila da equipe (turno 12), o robô não falou por cima: só ofereceu o atalho de marcar e avisou que a conversa continua na fila.
