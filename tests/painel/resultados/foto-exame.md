# H2 · foto-exame

**Persona:** Marina, mãe da Helena (paciente já cadastrada). Quarta, 14h30, manda a foto de um exame e quer saber se está normal. Ansiosa, escreve várias mensagens curtas seguidas; depois de duas horas sem resposta, resolve marcar o retorno ela mesma, em São Paulo.

**Objetivo:** alguém da equipe/o médico ver o exame e, se preciso, o retorno ficar marcado. Observar se o robô não interpreta o exame e se a mensagem chega à equipe.

**Resultado: conseguiu (com tropeços).** O exame foi para a fila da equipe logo no turno 1 (situação `aguardando_equipe (anexo)`, conversa acesa com "📎 Enviou um arquivo") e continuou lá até o fim, inclusive depois de marcar. O robô não interpretou o exame. O retorno ficou marcado: sexta, 23/10, 16:00, Livance Ibirapuera, Helena Souza Lima. A equipe não foi simulada, então a resposta sobre o exame em si não aconteceu dentro do roteiro.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 14:30): 📷 [foto/arquivo] 
    ROBÔ:
      📎 Recebi o que você enviou e já avisei a nossa equipe: alguém do consultório vai olhar e responder por aqui.
      
      Se quiser, escreva junto o que é e o que você gostaria de saber. Isso ajuda quem for responder.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
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
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[9] FAMÍLIA (qua., 14/10, 16:36): 2
    ROBÔ:
      🗓️ *Datas disponíveis em Livance Ibirapuera - São Paulo:*
      
      *1* sexta, 16/10 (5 horários)
      *2* sexta, 23/10 (5 horários)
      *3* sexta, 30/10 (5 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = sexta, 16/10 | 2 = sexta, 23/10 | 3 = sexta, 30/10 | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (qua., 14/10, 16:36): [tocou] sexta, 23/10
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

[11] FAMÍLIA (qua., 14/10, 16:37): as 16h
    ROBÔ:
      Nesse horário temos 16:00 e 16:40.
      
      Responda com o horário exato, ou com o número da lista acima.

[12] FAMÍLIA (qua., 14/10, 16:38): 16:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      🗓️ sexta, 23/10 às 16:00
      📍 Livance Ibirapuera - São Paulo
      Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (sex., 23/10, 16:00 · Livance Ibirapuera - São Paulo · Helena Souza Lima)

[13] FAMÍLIA (qua., 14/10, 16:39): obrigada! mas o dr vai olhar o exame antes ne? se precisar de algo antes me avisa
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

--- estado no fim ---
Etapa do robô: menu · Situação: aguardando_equipe (anexo)
Consultas: sex., 23/10, 16:00 Livance Ibirapuera - São Paulo [scheduled] Helena Souza Lima
```

## Problemas

1. **MÉDIA · turno 13 · resposta pronta de "não posso orientar" fora de contexto, logo depois de marcar.** A mãe escreveu "obrigada! mas o dr vai olhar o exame antes ne? se precisar de algo antes me avisa". O robô respondeu "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta..." e o menu inteiro. A palavra "exame" disparou `fraseClinica` (`atendimento.ts`). Ela não pediu orientação. Recebeu um aviso de urgência no "obrigada" e um convite para marcar a consulta que acabou de marcar, e o texto ainda dá a entender que o exame só vai ser visto na consulta, contrariando o turno 1 ("alguém do consultório vai olhar e responder por aqui"). Esperado: "O exame que você mandou já está com a equipe; se o Dr. precisar de algo antes, avisamos por aqui", ou silêncio, já que a conversa continua `aguardando_equipe (anexo)`.

2. **MÉDIA · turno 5 · silêncio diante de um pedido claro de agendamento.** Duas horas depois, em horário comercial, sem ninguém da equipe ter respondido: "oi, ninguem respondeu ainda. vou deixar marcado o retorno entao, quero em sao paulo" → "(silêncio)". O robô ficar quieto enquanto a equipe tem a vez está certo, mas ninguém da equipe tinha assumido. A mãe só seguiu porque lembrou do botão "0" do turno 1. Esperado: pelo menos abrir o agendamento quando ela pede para marcar, ou dizer que a equipe ainda vai responder e que dá para marcar pelo 0.

3. **MÉDIA · turno 8 · "sao paulo" não reconhecido na escolha de unidade.** "Não entendi. Responda com o número da unidade da lista acima." Conferido no código: `unidadePeloNome` (que aceita "Santos", "sao paulo", "telemedicina" desde 09/10) é usada na etapa de informações e na de dia, mas **não** em `aguardando_unidade`, que é a pergunta principal de "Vamos agendar!". A resposta de erro ainda troca a lista por um botão só ("0 = Voltar ao início"), então não dava mais para tocar na unidade. Esperado: ir direto para as datas de São Paulo.

4. **MÉDIA · turno 11 · passo a mais para "as 16h".** A lista tinha "16:00" e a mãe escreveu "as 16h". O robô respondeu "Nesse horário temos 16:00 e 16:40. Responda com o horário exato". "16h" é o horário exato 16:00, que estava livre. Esperado: marcar 16:00 (ou confirmar "16:00, certo?").

5. **BAIXA · turno 6 · saudação para a pessoa errada e gênero errado.** "Olá, Helena! 👋 ... Estamos aqui para cuidar do seu filho." Quem escreve é a Marina, e Helena é menina. Esperado: "Olá, Marina!" e "cuidar da Helena" / "do seu filho ou filha".

## Artefato do simulador (não é defeito do robô)

- **Turno 1:** "Agora estamos fora do horário de atendimento ... Alguém da equipe responde hoje, a partir das 8h", numa quarta às 14h30 simulada. `avisoDeHorario()` é chamado sem a data e usa o relógio real da máquina (qui 15/10, de madrugada), não o do roteiro. Em produção sairia "Atendemos de segunda a sexta, das 8h às 18h."

## O que funcionou bem

Não interpretou o exame: ficou calado em "o resultado ta normal?" e "o dr pode dar uma olhada?" em vez de arriscar resposta clínica. O anexo foi para a equipe na hora, com etiqueta própria, e continuou na fila depois de ela sair e marcar. O agendamento em si (dia, horário, endereço, aviso da véspera) saiu limpo e com o paciente certo.
