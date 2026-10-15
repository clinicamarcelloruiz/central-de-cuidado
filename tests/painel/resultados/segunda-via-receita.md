# F1 · segunda-via-receita

**Persona:** Marina, mãe da Helena (paciente já cadastrada). Escreve normal, educada. Quarta, 14/10, 11h30.
**Objetivo:** pedir a 2ª via da receita do omeprazol (perdeu o papel) e o pedido do exame de sangue que o médico falou na consulta; saber se recebe por e-mail ou pelo WhatsApp.

**Resultado:** PARCIAL. Os dois pedidos ficaram registrados para a equipe, mas só depois de um desvio: o robô registrou só a receita e ficou calado quando ela pediu o exame, então ela teve de voltar ao menu sozinha e refazer o caminho. A pergunta "e-mail ou WhatsApp?" não recebeu resposta, só silêncio (agora é com a equipe). A única pista é o "vai revisar e responder por aqui", do turno 5.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 11:30): Oi, bom dia! Sou a mãe da Helena. Perdi a receita do omeprazol dela, tem como pedir uma segunda via?
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[2] FAMÍLIA (qua., 14/10, 11:30): [tocou] 2ª via ou exame
    ROBÔ:
      O que você precisa para *Helena Souza Lima*?
      
      *1* 💊 2ª via de receita
      *2* 🔬 Pedido de exame
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [botões] 1 = 2ª via de receita | 2 = Pedido de exame
    · bastidores: Família escolheu: 2ª via ou exame

[3] FAMÍLIA (qua., 14/10, 11:31): Na verdade preciso dos dois, a receita e tbm o pedido do exame de sangue que o dr falou na consulta
    ROBÔ:
      Qual medicamento? Pode escrever como está na receita.

[4] FAMÍLIA (qua., 14/10, 11:32): omeprazol
    ROBÔ:
      A farmácia pediu alguma correção?
      
      Se pediram, escreva o que foi. Se não, responda *não*.
      
      📎 Se tiver foto do documento que não foi aceito, pode mandar aqui.
      [botões] não = Não pediram nada

[5] FAMÍLIA (qua., 14/10, 11:33): não, eu perdi o papel mesmo
    ROBÔ:
      ✅ Pedido registrado.
      
      💊 2ª via de receita · Helena Souza Lima
      omeprazol
      _Pediram correção:_ não, eu perdi o papel mesmo
      
      O Dr. Marcello vai revisar e responder por aqui, em até *1 dia útil*.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: 📄 Pediu 2ª via / exame · Conversa acesa na lista: 📄 Pediu 2ª via / exame

[6] FAMÍLIA (qua., 14/10, 11:33): Obrigada! E o pedido do exame de sangue? Também preciso
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 5 min depois …

[7] FAMÍLIA (qua., 14/10, 11:39): [tocou] Voltar ao início
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

[8] FAMÍLIA (qua., 14/10, 11:40): [tocou] 2ª via ou exame
    ROBÔ:
      O que você precisa para *Helena Souza Lima*?
      
      *1* 💊 2ª via de receita
      *2* 🔬 Pedido de exame
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [botões] 1 = 2ª via de receita | 2 = Pedido de exame
    · bastidores: Família escolheu: 2ª via ou exame

[9] FAMÍLIA (qua., 14/10, 11:41): [tocou] Pedido de exame
    ROBÔ:
      Qual exame? Pode escrever como está no pedido.

[10] FAMÍLIA (qua., 14/10, 11:41): Não tenho o pedido, é o exame de sangue que o dr falou na última consulta. Não sei o nome certinho
    ROBÔ:
      O laboratório ou a clínica de exames pediu alguma correção?
      
      Se pediram, escreva o que foi. Se não, responda *não*.
      
      📎 Se tiver foto do documento que não foi aceito, pode mandar aqui.
      [botões] não = Não pediram nada

[11] FAMÍLIA (qua., 14/10, 11:42): [tocou] Não pediram nada
    ROBÔ:
      ✅ Pedido registrado.
      
      🔬 Pedido de exame · Helena Souza Lima
      Não tenho o pedido, é o exame de sangue que o dr falou na última consulta. Não sei o nome certinho
      
      O Dr. Marcello vai revisar e responder por aqui, em até *1 dia útil*.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: 📄 Pediu 2ª via / exame

[12] FAMÍLIA (qua., 14/10, 11:43): Perfeito. Vocês mandam por aqui pelo WhatsApp mesmo ou por e-mail? Se for por e-mail é marina@exemplo.com
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (documento)
Consultas: nenhuma
```

## Problemas

1. **MÉDIA · turno 1.** Ela escreveu "Perdi a receita do omeprazol dela, tem como pedir uma segunda via?" e o robô respondeu "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios." Não era pergunta clínica, era pedido de documento, e o próprio menu tem a opção 5 para isso. A frase sugere que ela precisaria marcar consulta para conseguir a 2ª via. Esperado: reconhecer "perdi a receita" / "segunda via" e abrir direto a opção 5 (o comentário do OPCOES em atendimento.ts cita "perdi a receita" como o jeito como a família chega, mas nada no texto livre leva até lá).
2. **MÉDIA · turno 3.** Ela pediu "preciso dos dois, a receita e tbm o pedido do exame de sangue". O robô seguiu só com a receita ("Qual medicamento?"), sem mencionar o exame nem avisar que ele viria depois. Esperado: registrar os dois, um depois do outro, ou pelo menos dizer "primeiro a receita, depois o exame".
3. **MÉDIA · turno 3.** "Qual medicamento? Pode escrever como está na receita." O medicamento (omeprazol) já estava na primeira mensagem. Esperado: aproveitar o que ela já disse, ou ao menos confirmar ("é o omeprazol?").
4. **MÉDIA · turno 4.** "A farmácia pediu alguma correção?" Ela perdeu o papel, não houve farmácia nem recusa. A pergunta não cabe nesse caso e a deixa em dúvida sobre o que responder. Esperado: perguntar antes o motivo (perdeu ou a farmácia recusou) e só fazer a pergunta de correção no segundo caso. O mesmo acontece no turno 10 com "O laboratório ou a clínica de exames pediu alguma correção?", para um exame que ela nem tem o pedido.
5. **MÉDIA · turno 5 (dado gravado no campo errado).** A resposta "não, eu perdi o papel mesmo" foi gravada como correção: o resumo mostra "_Pediram correção:_ não, eu perdi o papel mesmo". Isso acontece porque o teste de "não" em `documento_exigencia` só aceita a palavra sozinha (`/^(n|nao|não|nada|nenhuma|negativo)$/`). Quem lê entende, mas o campo diz que houve pedido de correção quando não houve. Esperado: um "não" no começo da frase vale como "nada foi exigido" (e o resto pode ir como observação).
6. **MÉDIA · turno 6.** "Obrigada! E o pedido do exame de sangue? Também preciso" teve como resposta (silêncio). O pedido de exame não foi registrado nem confirmado. Ela só conseguiu porque decidiu, por conta própria, tocar em 0 e refazer o caminho (turnos 7 a 11). Uma mãe que não fizesse isso ficaria achando que o exame estava pedido. Esperado: com a conversa aguardando a equipe por um pedido de documento, um segundo pedido de documento deveria ser registrado ou, no mínimo, receber um "anotei, a equipe vê junto".
7. **BAIXA · turno 12.** "Vocês mandam por aqui pelo WhatsApp mesmo ou por e-mail? Se for por e-mail é marina@exemplo.com" teve como resposta (silêncio). Faz sentido pela regra de não falar por cima da equipe, mas ela sai sem a resposta que queria. Antes, o robô tinha dito só "responder por aqui" (turnos 5 e 11), sem dizer que o documento vem pelo WhatsApp nem se o e-mail é uma opção.
8. **BAIXA · turno 7.** "Olá, Helena! 👋 ... Estamos aqui para cuidar do seu filho." Saúda a criança (quem escreve é a mãe, Marina, que se apresentou como "mãe da Helena") e diz "filho" para uma menina. Além disso, a saudação de primeiro contato aparece no meio de uma conversa de 9 minutos.

## O que funcionou bem

O fluxo da opção 5 é curto e claro. Os botões aparecem nas horas certas. O resumo "✅ Pedido registrado" mostra o tipo, o nome da paciente e o item, e dá prazo ("em até 1 dia útil"). A conversa acende na lista da equipe com a etiqueta "📄 Pediu 2ª via / exame". O 0 para voltar funcionou mesmo com a conversa aguardando a equipe.
