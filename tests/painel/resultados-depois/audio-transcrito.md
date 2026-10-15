# G1 · audio-transcrito (depois dos consertos)

**Persona:** mãe da Helena (já paciente), escreve mensagens longas, sem pontuação, como áudio transcrito, misturando vários assuntos numa mensagem só.
**Família:** `cadastrada` · início qua. 14/10/2026, 12h30 (`2026-10-14T15:30:00Z`, igual à rodada anterior).
**Objetivo:** (1) saber se o retorno da Helena é cobrado; (2) marcar o retorno em Santos, semana que vem, de manhã; (3) saber se o médico atende o irmão de 16 anos (refluxo).

Roteiro: `tests/painel/familias-depois/audio-transcrito.json` (25 mensagens). Os turnos 1 a 9 repetem as mensagens da rodada anterior, porque o robô respondeu igual. Os turnos 17 a 25 passam do limite de ~16 mensagens. Ficaram no roteiro para levar a consulta do irmão até o fim, que antes só foi feito numa "verificação extra".

## Resultado: PARCIAL

O objetivo (2) foi cumprido como antes: qua. 21/10, 10h, Livance · Santos, em nome da Helena, no turno 6. O (3) também, com a idade respondida no turno 2. O (1) continua sem resposta. A mãe perguntou da cobrança nos turnos 1, 2, 3, 5, 7, 10, 11 e 12, e o robô só deu a regra geral ("Inclui retorno em até 30 dias"), no turno 9 (Dúvidas > Santos) e no 11 (tabela).

Agora está pior em um ponto. No turno 10 o robô leu "inclui retorno em 30 dias ne" como um pedido de retorno e respondeu "Anotei seu pedido de retorno para *novembro*". No turno 12 repetiu a mesma frase, mesmo depois de ela escrever "nao é pra novembro".

A marcação do irmão melhorou na conversa: o robô pergunta para quem é e o comprovante sai com "👶 Pedro Souza Lima". No banco, porém, a consulta ficou ligada ao cadastro da Helena. E quando a ficha do Pedro terminou, a conversa foi marcada como resolvida, o que tirou da fila da equipe a pergunta sobre a cobrança que ninguém tinha respondido.

## Antes x depois

- **Consulta do irmão gravada no nome da Helena** (turno 14 antes, mais a verificação extra): **consertado em parte.** "Marcar mais uma" agora pergunta "Para quem é a consulta? *1* Helena Souza Lima *2* Outra criança" (turno 16). A ficha pede nome, nascimento e responsável, e o comprovante diz "👶 Pedro Souza Lima · quarta, 21/10 às 10:40" (turno 25). **No banco o defeito continua:** no fim da ficha, a consulta é ligada ao cadastro da Helena (detalhes em "Problemas que restam").
- **Turno 1, recusa de sintoma cobrindo as três perguntas:** **continua.** O turno 1 é idêntico ("Essa é uma avaliação para a consulta… Por aqui eu não posso orientar sobre sintomas, exames ou remédios").
- **Turnos 2, 3 e 5, "o retorno é cobrado?" ignorado:** **continua.** As respostas desses turnos são idênticas às de antes: só a idade, "Vamos agendar!" e a lista de horários.
- **Turno 7, recusa de sintoma logo depois de marcar:** **continua.** O texto é idêntico e ainda diz "Digite *2* para marcar uma consulta".
- **Turno 10, tabela genérica para uma pergunta concreta:** **piorou (problema novo).** O turno 10 agora responde "🗓️ Anotei seu pedido de retorno para *novembro*" e chama a equipe. A tabela genérica passou para o turno 11, com o mesmo "pelo link de pagamento que a Livance envia antes da consulta".
- **Turno 6, nada mostra que foi marcado como retorno:** **continua.** A confirmação ganhou o nome da criança ("👶 Helena Souza Lima"), o que é uma melhora, mas ainda diz só "✅ *Consulta marcada!*".
- **Turno 3, passo a mais (pergunta a unidade):** **continua** no turno 3. Dentro da pergunta "Em qual unidade?" o nome agora funciona: no turno 18, "santos tambem dia 21…" foi aceito.
- **Turno 1, sem o nome:** **continua.** O nome só aparece no menu do turno 14, e dirigido à mãe como "Olá, Helena!" (ver abaixo).
- **Turno 9, "⚡ Agendar por aqui é mais rápido: digite 2" para quem acabou de agendar:** **continua** (turno 9).
- **Turno 11, horário errado no aviso (artefato do simulador):** **consertado.** Às 12h36 de quarta, os turnos 10 e 12 dizem "Atendemos de segunda a sexta, das 8h às 18h."
- **Novo:** turnos 10 e 12, o pedido de retorno para novembro que ela não fez.
- **Novo:** turno 13. O pedido para marcar o Pedro ficou sem resposta, porque as respostas automáticas da fila foram gastas nos turnos 11 e 12.
- **Novo:** turno 25. A ficha concluída marca a conversa como resolvida e apaga a pendência da equipe.

## Problemas que restam

**ALTA**

- **Turno 25 (banco): a consulta do Pedro ficou no cadastro da Helena.** A família vê "👶 Pedro Souza Lima", mas no banco falso a consulta das 10:40 ficou com `patient_id: paciente-helena`. Só o `intake_patient_name` diz Pedro, e nenhum paciente novo foi criado. A causa é `cadastrarDaFicha` (`supabase/functions/_shared/cadastro.ts`, perto da linha 52): pela regra "telefone já conhecido não vira cadastro novo, vira vínculo", ela acha a Helena pelo telefone e liga a consulta a ela. O conserto de `OUTRA_CRIANCA` evita o erro na marcação, mas o fim da ficha o refaz. O resultado é que o prontuário de um adolescente de 16 anos iria para a ficha de uma criança de 5. É uma falha silenciosa: nada na conversa mostra o erro. A linha "Consultas" do script mostra "Marina" porque imprime `contact_name`. O vínculo foi conferido lendo o banco falso depois da conversa.
- **Turnos 10 e 12: "🗓️ Anotei seu pedido de retorno para *novembro*. Nossa agenda abre só 21 dias à frente…"** Ela perguntava se paga ("inclui retorno em 30 dias ne… nao vou pagar de novo?"), e `retornoAlemDaAgenda` leu "em 30 dias" como o prazo de um retorno pedido. No turno 12, "e nao é pra novembro ta" casou com "pra novembro" e o robô repetiu a frase, sem dar peso ao "nao". A equipe recebe um pedido de retorno em novembro que não existe, e a mãe recebe uma resposta que não tem nada a ver com a pergunta.
- **Turno 25: a pendência sumiu da fila.** Desde o turno 10 a conversa estava em `aguardando_equipe`, com a pergunta da cobrança e do link da Livance sem resposta. No turno 12 ela escreveu "deixa eu explicar pra moça". Quando a ficha do Pedro terminou, os bastidores registraram "Atendimento concluído sem precisar de ninguém" e a situação passou a `resolvida` (status `resolved`, `needs_attention: false`). Em produção o `meta-webhook` faz o mesmo (`index.ts`, perto da linha 944). A pergunta dela sai da lista da equipe sem ter sido respondida.

**MÉDIA**

- **Turno 13: silêncio para "deixa eu ja marcar o do pedro… por aqui mesmo pode ser?".** Os bastidores registram "Ficou em silêncio: quem responde agora é a equipe". Na rodada anterior, um pedido parecido recebeu o botão "Marcar uma consulta". Agora o limite de respostas na fila já tinha sido gasto: a do turno 12 foi a do "novembro". Ela só conseguiu marcar porque tocou em "Voltar ao início" por conta própria.
- **Turno 1: "Essa é uma avaliação para a consulta… Por aqui eu não posso orientar sobre sintomas, exames ou remédios".** Nenhuma das três perguntas foi respondida.
- **Turnos 2, 3, 5 e 7: "o retorno é cobrado?" ignorado.** No turno 7 veio de novo a recusa de sintoma e "Digite *2* para marcar uma consulta", um minuto depois de ela marcar.
- **Turno 11: tabela "Santos: R$ 450,00 · São Paulo: R$ 600,00…" com "pelo link de pagamento que a Livance envia antes da consulta"** como resposta a "eu so quero saber se esse retorno é cobrado ou nao". Quem lê pode achar que vai pagar de novo.
- **Turno 6: "✅ *Consulta marcada!*", sem dizer que é retorno.** O robô nunca pergunta se é consulta nova ou retorno.
- **Turno 3: "Em qual unidade você prefere ser atendido?"** Ela já tinha escrito "tem horario semana que vem em santos de manha?".

**BAIXA**

- **Turno 9:** "⚡ *Agendar por aqui é mais rápido*: digite *2*", para quem acabou de agendar.
- **Turno 14:** "Olá, Helena! 👋 … Estamos aqui para cuidar do seu filho." A mãe (Marina, no perfil) é chamada pelo nome da filha, e a filha vira "seu filho". O `{nome}` da saudação é o primeiro nome do paciente.
- **Turno 18:** "santos tambem dia 21 logo depois da helena" levou à lista de datas. A unidade foi entendida, mas o "dia 21" não foi aproveitado.

## O que melhorou

- A consulta do irmão agora pergunta para quem é, com a opção "Outra criança", e faz a ficha.
- O comprovante mostra o nome da criança (turnos 6 e 25).
- O nome digitado em minúsculas sai normalizado: "Pedro Souza Lima", "Marina Souza Lima".
- "o cpf dele eu nao tenho aqui agora depois eu mando" foi entendido ("Sem problema.").
- A unidade pelo nome é aceita na pergunta "Em qual unidade?" (turno 18).
- O aviso de horário no simulador saiu certo.

## Saída final do script

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
      
      👶 Helena Souza Lima
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
      🗓️ Anotei seu pedido de retorno para *novembro*.
      
      Nossa agenda abre só 21 dias à frente, então esse horário a nossa equipe reserva para você e confirma a data por aqui.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Retorno além da agenda aberta: anotado para a equipe · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[11] FAMÍLIA (qua., 14/10, 12:37): oi? nao nao eu nao pedi retorno pra novembro nao o retorno da helena ja ta marcado dia 21/10 as 10h em santos eu marquei agora ai mesmo eu so quero saber se esse retorno é cobrado ou nao porque ela passou dia 22/09 e se eu tenho que pagar o link da livance
    ROBÔ:
      💙 *Valores da consulta:*
      
      • Santos: R$ 450,00
      • São Paulo: R$ 600,00
      • Telemedicina: R$ 450,00
      
      Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).
      
      💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      🙋 Sua conversa continua na fila: alguém da nossa equipe responde por aqui.

[12] FAMÍLIA (qua., 14/10, 12:38): ta bom entao deixa eu explicar pra moça marquei agora o retorno da helena dia 21/10 as 10h em santos ela passou dia 22/09 queria confirmar que nao paga e que eu nao preciso pagar aquele link da livance e nao é pra novembro ta e aproveitando queria marcar tambem pro meu filho o pedro de 16 anos que ta com refluxo se der no mesmo dia logo depois dela seria otimo porque ai eu levo os dois de manha
    ROBÔ:
      🗓️ Anotei seu pedido de retorno para *novembro*.
      
      Nossa agenda abre só 21 dias à frente, então esse horário a nossa equipe reserva para você e confirma a data por aqui.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Retorno além da agenda aberta: anotado para a equipe · Chamou a equipe: Quer falar com a equipe

[13] FAMÍLIA (qua., 14/10, 12:39): gente nao é novembro kkk ta bom a moça me responde depois entao mas deixa eu ja marcar o do pedro o meu filho de 16 anos por aqui mesmo pode ser?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

[14] FAMÍLIA (qua., 14/10, 12:39): [tocou] Voltar ao início
    ROBÔ:
      Olá, Helena! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Estamos aqui para cuidar do seu filho. Como podemos ajudar hoje?
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      
      Responda com o número ou toque em "Ver opções".
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[15] FAMÍLIA (qua., 14/10, 12:40): [tocou] Marcar uma consulta
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

[16] FAMÍLIA (qua., 14/10, 12:41): [tocou] Marcar mais uma
    ROBÔ:
      👶 *Vamos agendar!* Para quem é a consulta?
      
      *1* Helena Souza Lima
      *2* Outra criança
      
      Responda com o número ou o nome. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher paciente"] 1 = Helena Souza Lima | 2 = Outra criança | 9 = Falar com a equipe | 0 = Voltar ao menu

[17] FAMÍLIA (qua., 14/10, 12:42): [tocou] Outra criança
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (17 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (32 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[18] FAMÍLIA (qua., 14/10, 12:42): santos tambem dia 21 logo depois da helena
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (5 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[19] FAMÍLIA (qua., 14/10, 12:43): [tocou] quarta, 21/10
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

[20] FAMÍLIA (qua., 14/10, 12:44): [tocou] 10:40
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 10:40* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 10:40 · Livance · Santos · Marina)

[21] FAMÍLIA (qua., 14/10, 12:45): pedro souza lima
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Pedro Souza Lima)

[22] FAMÍLIA (qua., 14/10, 12:45): 12/05/2010
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12/05/2010)

[23] FAMÍLIA (qua., 14/10, 12:46): marina souza lima
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Marina Souza Lima)

[24] FAMÍLIA (qua., 14/10, 12:47): o cpf dele eu nao tenho aqui agora depois eu mando
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[25] FAMÍLIA (qua., 14/10, 12:48): marina@exemplo.com
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Pedro Souza Lima
      🗓️ quarta, 21/10 às 10:40
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (marina@exemplo.com)

--- estado no fim ---
Etapa do robô: menu · Situação: resolvida
Consultas: qua., 21/10, 10:00 Livance · Santos [scheduled] Helena Souza Lima; qua., 21/10, 10:40 Livance · Santos [scheduled] Marina
```
