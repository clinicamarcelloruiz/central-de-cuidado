# H2 · foto-exame (depois das correções)

**Persona:** Marina, mãe da Helena (paciente já cadastrada). Quarta, 14h30, manda a foto de um exame e quer saber se está normal. Ansiosa, escreve várias mensagens curtas seguidas; depois de duas horas sem resposta, resolve marcar o retorno ela mesma, em São Paulo.
**Família no simulador:** `cadastrada` · início 2026-10-14T17:30:00Z (quarta, 14h30).
**Objetivo:** alguém da equipe/o médico ver o exame e, se preciso, o retorno ficar marcado. Observar se o robô não interpreta o exame e se a mensagem chega à equipe.

## Resultado: CONSEGUIU (com tropeços)

O exame foi para a fila da equipe no turno 1 (`aguardando_equipe (anexo)`, conversa acesa com "📎 Enviou um arquivo") e a conversa terminou na fila (`aguardando_equipe (atendente)`). O robô não interpretou o exame: ficou calado nos turnos 2 a 4. O retorno ficou marcado: sexta, 23/10, 16:00, Livance Ibirapuera, Helena Souza Lima. Antes ela levou 12 mensagens até a confirmação; agora levou 10, porque "sao paulo" e "as 16h" passaram a ser entendidos. O defeito mais visível continua: quando ela pergunta se o médico vai ver o exame, recebe a resposta pronta de "não posso orientar" com aviso de urgência (turnos 11 e 13). Para ter certeza de que alguém ia olhar o exame, ela precisou tocar em "Falar com a equipe" (turno 14). A equipe não foi simulada, então ninguém respondeu sobre o exame dentro do roteiro.

## Antes x depois

- **Antes, problema 1 (turno 13): "obrigada! mas o dr vai olhar o exame antes ne?" recebia a resposta pronta clínica e o menu.** **Continua** (agora no turno 11), com o mesmo texto e o mesmo menu. Voltou a acontecer no turno 13, quando ela reformulou para "so quero saber se o dr vai ver o exame que eu mandei".
- **Antes, problema 2 (turno 5): silêncio quando ela pede para marcar o retorno 2 h depois, sem ninguém ter assumido.** **Continua** (turno 5, "(silêncio)", bastidores "quem responde agora é a equipe"). Ela só seguiu porque tocou no "0" do turno 1.
- **Antes, problema 3 (turno 8): "sao paulo" não reconhecido em "Em qual unidade?".** **Corrigido** (turno 8): foi direto para "Datas disponíveis em Livance Ibirapuera - São Paulo".
- **Antes, problema 4 (turno 11): "as 16h" pedia o horário exato.** **Corrigido** (turno 10): marcou 16:00 direto.
- **Antes, problema 5 (turno 6): "Olá, Helena! … cuidar do seu filho" para a mãe Marina, e Helena é menina.** **Continua** (turno 6, texto idêntico).
- **Antes, artefato do simulador (turno 1): "Agora estamos fora do horário" numa quarta às 14h30.** **Corrigido** (turno 1): agora sai "Atendemos de segunda a sexta, das 8h às 18h."
- **Melhoria:** a confirmação traz o nome da criança ("👶 Helena Souza Lima", turno 10).
- **Novo (turno 12, apareceu porque a mãe reagiu ao turno 11, o que o roteiro antigo não fazia):** "ja marquei" → "Não entendi. Responda com o número da opção:" e o menu.

## Problemas que restam

1. **MÉDIA · turnos 11 e 13 · a resposta pronta clínica contradiz o turno 1.** Ela só quer saber se o médico vai ver o exame que já mandou. O robô responde "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta…" e o menu inteiro. Isso vem logo depois de ela marcar (turno 10) e apesar de a conversa continuar em `aguardando_equipe (anexo)`. No turno 13 os bastidores dizem "Assunto clínico: o robô não orienta e passa para a equipe", mas o texto manda a mãe digitar *3*. Esperado: "O exame que você mandou já está com a equipe; se o Dr. precisar de algo antes, avisamos por aqui", ou silêncio, porque a equipe já tem a vez.
2. **MÉDIA · turno 5 · silêncio diante de um pedido claro para marcar.** "oi, ninguem respondeu ainda. vou deixar marcado o retorno entao, quero em sao paulo" → "(silêncio)". Ninguém da equipe tinha assumido, e o pedido não é clínico. Esperado: abrir o agendamento (já em São Paulo) ou, pelo menos, dizer que a equipe ainda vai responder sobre o exame e que dá para marcar pelo *0*.
3. **BAIXA · turno 12 · "ja marquei" → "Não entendi. Responda com o número da opção:"** e o menu. Era uma resposta ao "Digite *2* para marcar uma consulta" do turno 11.
4. **BAIXA · turno 6 · saudação para a pessoa errada:** "Olá, Helena! 👋 … Estamos aqui para cuidar do seu filho." Quem escreve é a Marina, e a Helena é menina.
5. **BAIXA (observação) · turno 14 · a etiqueta do exame foi trocada.** Ao tocar "Falar com a equipe", o motivo passou de `anexo` ("📎 Enviou um arquivo") para `atendente` ("Quer falar com a equipe"). A conversa continua na fila, e até sobe na ordem de urgência. Só que quem filtrar as conversas por "anexo" deixa de vê-la, e a etiqueta já não lembra que há um exame esperando leitura.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 14:30): 📷 [foto/arquivo] 
    ROBÔ:
      📎 Recebi o que você enviou e já avisei a nossa equipe: alguém do consultório vai olhar e responder por aqui.
      
      Se quiser, escreva junto o que é e o que você gostaria de saber. Isso ajuda quem for responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: 📎 Enviou um arquivo · Conversa acesa na lista: 📎 Enviou um arquivo

[2] FAMÍLIA (qua., 14/10, 14:30): o resultado ta normal?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

[3] FAMÍLIA (qua., 14/10, 14:31): o dr pode dar uma olhada?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

[4] FAMÍLIA (qua., 14/10, 14:32): ou precisa marcar retorno pra mostrar o exame pra ele?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 120 min depois …

[5] FAMÍLIA (qua., 14/10, 16:33): oi, ninguem respondeu ainda. vou deixar marcado o retorno entao, quero em sao paulo
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

[6] FAMÍLIA (qua., 14/10, 16:33): [tocou] Voltar ao início
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

[7] FAMÍLIA (qua., 14/10, 16:34): [tocou] Marcar uma consulta
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[8] FAMÍLIA (qua., 14/10, 16:35): sao paulo
    ROBÔ:
      🗓️ *Datas disponíveis em Livance Ibirapuera - São Paulo:*
      
      *1* sexta, 16/10 (5 horários)
      *2* sexta, 23/10 (5 horários)
      *3* sexta, 30/10 (5 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = sexta, 16/10 | 2 = sexta, 23/10 | 3 = sexta, 30/10 | 9 = Falar com a equipe | 0 = Voltar ao menu

[9] FAMÍLIA (qua., 14/10, 16:36): [tocou] sexta, 23/10
    ROBÔ:
      ⏰ *Horários de sexta, 23/10:*
      
      *1* 14:00
      *2* 14:40
      *3* 15:20
      *4* 16:00
      *5* 16:40
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 14:00 | 2 = 14:40 | 3 = 15:20 | 4 = 16:00 | 5 = 16:40 | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (qua., 14/10, 16:36): as 16h
    ROBÔ:
      ✅ *Consulta marcada!*
      
      👶 Helena Souza Lima
      🗓️ sexta, 23/10 às 16:00
      📍 Livance Ibirapuera - São Paulo
      Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (sex., 23/10, 16:00 · Livance Ibirapuera - São Paulo · Helena Souza Lima)

[11] FAMÍLIA (qua., 14/10, 16:37): obrigada! mas o dr vai olhar o exame antes ne? se precisar de algo antes me avisa
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[12] FAMÍLIA (qua., 14/10, 16:38): ja marquei
    ROBÔ:
      Não entendi. Responda com o número da opção:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Não entendeu a resposta e explicou de novo · Mostrou o menu de opções

[13] FAMÍLIA (qua., 14/10, 16:39): so quero saber se o dr vai ver o exame que eu mandei
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Assunto clínico: o robô não orienta e passa para a equipe · Mostrou o menu de opções

[14] FAMÍLIA (qua., 14/10, 16:39): [tocou] Falar com a equipe
    ROBÔ:
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Família escolheu: Falar com a equipe · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[15] FAMÍLIA (qua., 14/10, 16:40): mandei a foto do exame da helena mais cedo. queria q o dr visse se ta tudo normal, ja marquei o retorno dia 23
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: sex., 23/10, 16:00 Livance Ibirapuera - São Paulo [scheduled] Helena Souza Lima
```
