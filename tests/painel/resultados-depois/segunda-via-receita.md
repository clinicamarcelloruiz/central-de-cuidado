# F1 · segunda-via-receita (depois das correções)

**Persona:** Marina, mãe da Helena (paciente já cadastrada). Escreve normal, educada.
**Família:** `cadastrada` · início qua., 14/10, 11h30 (`2026-10-14T14:30:00Z`), igual à rodada anterior.
**Objetivo:** pedir a 2ª via da receita do omeprazol (perdeu o papel) e o pedido do exame de sangue que o médico falou na consulta; saber se recebe por e-mail ou pelo WhatsApp.

## Resultado: PARCIAL

O começo melhorou: "Perdi a receita do omeprazol..." agora abre direto a opção 5 (2ª via ou exame), sem a frase de assunto clínico e sem o toque no menu. Daí em diante a conversa é a mesma da rodada anterior. O robô registra só a receita, fica em silêncio quando ela pede o exame (turno 5) e ela só consegue registrar o exame porque volta ao menu sozinha e refaz o caminho (turnos 6 a 10). A pergunta "WhatsApp ou e-mail?" (turno 11) continua sem resposta: o robô fica em silêncio porque a conversa já está com a equipe. Os dois pedidos chegam à equipe, mas Marina sai sem saber como vai receber os documentos.

## Antes x depois

- **Turno 1 antes: frase de assunto clínico ("não posso orientar sobre sintomas, exames ou remédios") para um pedido de 2ª via.** CORRIGIDO. No turno 1 o robô abre direto "O que você precisa para *Helena Souza Lima*? 1 2ª via de receita / 2 Pedido de exame". Isso economiza um turno.
- **Turno 3 antes: "preciso dos dois", e o robô seguiu só com a receita, sem falar do exame.** CONTINUA (turno 2). A resposta é "Qual medicamento? Pode escrever como está na receita.", sem mencionar o exame.
- **Turno 3 antes: o robô perguntou "Qual medicamento?" com o omeprazol já dito na 1ª mensagem.** CONTINUA (turno 2). O robô agora reconhece a 1ª mensagem como pedido de 2ª via, mas não aproveita o "omeprazol" que estava nela.
- **Turnos 4 e 10 antes: "A farmácia pediu alguma correção?" para quem perdeu o papel.** CONTINUA (turno 3 e, para o exame, turno 9: "O laboratório ou a clínica de exames pediu alguma correção?").
- **Turno 5 antes: "não, eu perdi o papel mesmo" gravado como correção.** CONTINUA (turno 4). O resumo mostra "_Pediram correção:_ não, eu perdi o papel mesmo".
- **Turno 6 antes: silêncio no 2º pedido ("E o pedido do exame de sangue? Também preciso").** CONTINUA (turno 5): "(silêncio)", com a conversa em `aguardando_equipe (documento)`. O exame não fica registrado e ninguém confirma que viu.
- **Turno 12 antes: silêncio em "WhatsApp ou e-mail?".** CONTINUA (turno 11).
- **Turno 7 antes: "Olá, Helena! 👋 ... cuidar do seu filho": saúda a criança, diz "filho" para uma menina e repete a saudação de 1º contato no meio da conversa.** CONTINUA (turno 6). O mesmo "Olá, Helena!" agora também abre o turno 1, que é o caminho novo da 2ª via, embora ela tenha escrito "Sou a mãe da Helena".

## Problemas que restam

1. **MÉDIA · turno 5: o segundo pedido de documento se perde em silêncio.** "Obrigada! E o pedido do exame de sangue? Também preciso" teve como resposta "(silêncio)". Uma mãe que não volte ao menu por conta própria fica achando que o exame foi pedido.
2. **MÉDIA · turno 2: o pedido duplo é ignorado.** Para "preciso dos dois, a receita e tbm o pedido do exame", o robô responde só "Qual medicamento?", sem dizer que o exame vem depois.
3. **MÉDIA · turno 2: o robô pergunta o que já foi dito.** "Qual medicamento? Pode escrever como está na receita." O omeprazol estava na 1ª mensagem.
4. **MÉDIA · turnos 3 e 9: a pergunta não cabe no caso.** "A farmácia pediu alguma correção?" e "O laboratório ou a clínica de exames pediu alguma correção?", para quem perdeu o papel ou nem tem o pedido.
5. **MÉDIA · turno 4: dado gravado no campo errado.** "_Pediram correção:_ não, eu perdi o papel mesmo". Um "não" no começo da frase não vale como "nada foi exigido".
6. **BAIXA · turno 11: pergunta sem resposta.** "Vocês mandam por aqui pelo WhatsApp mesmo ou por e-mail?" teve como resposta "(silêncio)". O robô só tinha dito "vai revisar e responder por aqui" (turnos 4 e 10).
7. **BAIXA · turnos 1 e 6: saudação para a pessoa errada.** "Olá, Helena! 👋" saúda a criança, embora quem escreve tenha se apresentado como mãe. No turno 6 vêm ainda "Estamos aqui para cuidar do seu filho", para uma menina, e a saudação de 1º contato no meio da conversa.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 11:30): Oi, bom dia! Sou a mãe da Helena. Perdi a receita do omeprazol dela, tem como pedir uma segunda via?
    ROBÔ:
      Olá, Helena! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      O que você precisa para *Helena Souza Lima*?
      
      *1* 💊 2ª via de receita
      *2* 🔬 Pedido de exame
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [botões] 1 = 2ª via de receita | 2 = Pedido de exame
    · bastidores: Família escolheu: 2ª via ou exame

[2] FAMÍLIA (qua., 14/10, 11:30): Na verdade preciso dos dois, a receita e tbm o pedido do exame de sangue que o dr falou na consulta
    ROBÔ:
      Qual medicamento? Pode escrever como está na receita.

[3] FAMÍLIA (qua., 14/10, 11:31): omeprazol
    ROBÔ:
      A farmácia pediu alguma correção?
      
      Se pediram, escreva o que foi. Se não, responda *não*.
      
      📎 Se tiver foto do documento que não foi aceito, pode mandar aqui.
      [botões] não = Não pediram nada

[4] FAMÍLIA (qua., 14/10, 11:32): não, eu perdi o papel mesmo
    ROBÔ:
      ✅ Pedido registrado.
      
      💊 2ª via de receita · Helena Souza Lima
      omeprazol
      _Pediram correção:_ não, eu perdi o papel mesmo
      
      O Dr. Marcello vai revisar e responder por aqui, em até *1 dia útil*.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: 📄 Pediu 2ª via / exame · Conversa acesa na lista: 📄 Pediu 2ª via / exame

[5] FAMÍLIA (qua., 14/10, 11:33): Obrigada! E o pedido do exame de sangue? Também preciso
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 5 min depois …

[6] FAMÍLIA (qua., 14/10, 11:38): [tocou] Voltar ao início
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

[7] FAMÍLIA (qua., 14/10, 11:39): [tocou] 2ª via ou exame
    ROBÔ:
      O que você precisa para *Helena Souza Lima*?
      
      *1* 💊 2ª via de receita
      *2* 🔬 Pedido de exame
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [botões] 1 = 2ª via de receita | 2 = Pedido de exame
    · bastidores: Família escolheu: 2ª via ou exame

[8] FAMÍLIA (qua., 14/10, 11:40): [tocou] Pedido de exame
    ROBÔ:
      Qual exame? Pode escrever como está no pedido.

[9] FAMÍLIA (qua., 14/10, 11:41): Não tenho o pedido, é o exame de sangue que o dr falou na última consulta. Não sei o nome certinho
    ROBÔ:
      O laboratório ou a clínica de exames pediu alguma correção?
      
      Se pediram, escreva o que foi. Se não, responda *não*.
      
      📎 Se tiver foto do documento que não foi aceito, pode mandar aqui.
      [botões] não = Não pediram nada

[10] FAMÍLIA (qua., 14/10, 11:41): [tocou] Não pediram nada
    ROBÔ:
      ✅ Pedido registrado.
      
      🔬 Pedido de exame · Helena Souza Lima
      Não tenho o pedido, é o exame de sangue que o dr falou na última consulta. Não sei o nome certinho
      
      O Dr. Marcello vai revisar e responder por aqui, em até *1 dia útil*.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: 📄 Pediu 2ª via / exame

[11] FAMÍLIA (qua., 14/10, 11:42): Perfeito. Vocês mandam por aqui pelo WhatsApp mesmo ou por e-mail? Se for por e-mail é marina@exemplo.com
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (documento)
Consultas: nenhuma
```
