# B2 · irmaos-mesmo-dia

**Persona:** Marina, mãe organizada, escreve bem. Tem Helena (5 anos) e Theo (8 anos) cadastrados no mesmo celular.
**Família no simulador:** `irmaos` · início 2026-10-14T13:30:00Z (quarta, 10h30).
**Objetivo:** marcar duas consultas em Santos, uma para cada filho, no mesmo dia e em horários seguidos.

## Resultado: CONSEGUIU (com passos a mais)

O estado final mostra qua. 21/10 09:20 Livance · Santos `[scheduled]` Helena Souza Lima e qua. 21/10 10:00 Livance · Santos `[scheduled]` Theo Souza Lima. Cada consulta ficou no filho certo, e 10:00 é o horário logo depois do de 09:20 (consultas de 40 min). Ela gastou 14 mensagens, as 14 do limite: o robô não tem caminho para "os dois" e só entende uma criança por vez.

## Problemas

| # | Gravidade | Turno | O que o robô respondeu | O que a família esperava |
|---|---|---|---|---|
| 1 | MÉDIA | 1 | "Dá pra marcar os dois juntos, no mesmo dia, um seguido do outro?" (citando Helena, Theo e Santos) → "Para quem é a consulta? 1 Helena 2 Theo" | Uma resposta à pergunta ("sim, vamos marcar um de cada vez, começando pela Helena") ou uma opção "os dois". O pedido foi ignorado, e "Santos" também. |
| 2 | MÉDIA | 2 | "Para os dois" → "Não entendi. Responda com o número do paciente da lista acima." | Entender "os dois". A resposta de erro troca a lista por um botão só, "0 = Voltar ao início". |
| 3 | MÉDIA (beira ALTA) | 6 | "Helena às 09:20 e o Theo logo em seguida, às 10:00" → "✅ *Consulta marcada!* quarta, 21/10 às 09:20 …" | Marcou só a Helena e ignorou o Theo em silêncio. A confirmação **não diz o nome da criança**. Com dois filhos no mesmo celular, a mãe pode achar que marcou os dois, ou ficar sem saber de quem é a consulta. Esperava "Consulta da Helena marcada. Agora vamos à do Theo?" |
| 4 | MÉDIA | 7 | "Essa foi a da Helena, certo? E o Theo? Preciso dele às 10:00 no mesmo dia" → "Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz… Como podemos ajudar hoje?" com o menu completo | O robô se apresenta de novo no meio da conversa e não responde a nenhuma das duas perguntas. Esperava a confirmação de que a consulta era da Helena e a marcação do Theo. |
| 5 | MÉDIA | 10 | "Theo" → "Não entendi. Responda com o número do paciente da lista acima." | Aceitar o nome que ela acabou de ler na lista. O `aguardando_paciente` da marcação (atendimento.ts:4625) só aceita número. O fluxo da 2ª via (perto da linha 4246) já aceita o primeiro nome ("O nome escrito vale tanto quanto o numero"). |
| 6 | BAIXA | 11 | Pergunta a unidade outra vez: "Em qual unidade você prefere ser atendido?" | Ela disse Santos no turno 1 e a Helena acabou de ser marcada em Santos. Dava para sugerir a mesma unidade. |
| 7 | BAIXA | 13 | "Dia 21, às 10:00, logo depois da Helena" → escolheu o dia certo e mostrou a lista de horários do dia | Já marcar às 10:00 (ou só confirmar). Custou um toque a mais. |
| 8 | BAIXA | 14 | A segunda confirmação também não traz o nome do Theo | Igual ao item 3. Ela termina com duas mensagens "Consulta marcada!" iguais, que só se distinguem pela hora. |

## O que funcionou bem
- Cada consulta foi gravada no filho certo: Helena às 09:20 e Theo às 10:00.
- No turno 8 ("Marcar uma consulta"), o robô mostrou a consulta já marcada **com o nome Helena Souza Lima** e ofereceu "Marcar mais uma". Foi esse caminho que destravou a conversa.
- O horário 09:20 saiu da lista na segunda marcação, e a agenda continuou coerente.
- No turno 6, o robô tirou o horário certo (09:20) de uma frase escrita.

## Saída final completa do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Mãe com dois filhos (Helena e Theo no mesmo celular: o robô pergunta para quem é a consulta.)

[1] FAMÍLIA (qua., 14/10, 10:30): Bom dia! Gostaria de marcar consulta para os meus dois filhos, a Helena e o Theo, em Santos. Dá pra marcar os dois juntos, no mesmo dia, um seguido do outro?
    ROBÔ:
      Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Já separei a agenda para você 👇 Se antes quiser saber valores ou tirar uma dúvida, digite *0* para ver todas as opções.
      
      👶 *Vamos agendar!* Para quem é a consulta?
      
      *1* Helena Souza Lima
      *2* Theo Souza Lima
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher paciente"] 1 = Helena Souza Lima | 2 = Theo Souza Lima | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[2] FAMÍLIA (qua., 14/10, 10:30): Para os dois
    ROBÔ:
      Não entendi. Responda com o número do paciente da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[3] FAMÍLIA (qua., 14/10, 10:31): 1
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (qua., 14/10, 10:32): [tocou] Livance · Santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 10:33): [tocou] quarta, 21/10
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

[6] FAMÍLIA (qua., 14/10, 10:33): Helena às 09:20 e o Theo logo em seguida, às 10:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      🗓️ quarta, 21/10 às 09:20
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 09:20 · Livance · Santos · Helena Souza Lima)

[7] FAMÍLIA (qua., 14/10, 10:34): Essa foi a da Helena, certo? E o Theo? Preciso dele às 10:00 no mesmo dia
    ROBÔ:
      Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Estamos aqui para cuidar do seu filho. Como podemos ajudar hoje?
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      
      Responda com o número ou toque em "Ver opções".
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[8] FAMÍLIA (qua., 14/10, 10:35): [tocou] Marcar uma consulta
    ROBÔ:
      Você já tem uma consulta marcada:
      
      Helena Souza Lima
      quarta, 21/10 às 09:20
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      O que você prefere?
      
      1 - Remarcar (trocar por outra data)
      2 - Marcar mais uma consulta, além dessa
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 1 = Remarcar essa | 2 = Marcar mais uma | MENU = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[9] FAMÍLIA (qua., 14/10, 10:36): [tocou] Marcar mais uma
    ROBÔ:
      👶 *Vamos agendar!* Para quem é a consulta?
      
      *1* Helena Souza Lima
      *2* Theo Souza Lima
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher paciente"] 1 = Helena Souza Lima | 2 = Theo Souza Lima | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (qua., 14/10, 10:36): Theo
    ROBÔ:
      Não entendi. Responda com o número do paciente da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[11] FAMÍLIA (qua., 14/10, 10:37): 2
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (17 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (32 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[12] FAMÍLIA (qua., 14/10, 10:38): [tocou] Livance · Santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (5 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[13] FAMÍLIA (qua., 14/10, 10:39): Dia 21, às 10:00, logo depois da Helena
    ROBÔ:
      ⏰ *Horários de quarta, 21/10:*
      
      *1* 08:00
      *2* 08:40
      *3* 10:00
      *4* 10:40
      *5* 11:20
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 08:00 | 2 = 08:40 | 3 = 10:00 | 4 = 10:40 | 5 = 11:20 | 9 = Falar com a equipe | 0 = Voltar ao menu

[14] FAMÍLIA (qua., 14/10, 10:39): [tocou] 10:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      🗓️ quarta, 21/10 às 10:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 10:00 · Livance · Santos · Theo Souza Lima)

--- estado no fim ---
Etapa do robô: nenhuma · Situação: robo
Consultas: qua., 21/10, 09:20 Livance · Santos [scheduled] Helena Souza Lima; qua., 21/10, 10:00 Livance · Santos [scheduled] Theo Souza Lima
```
