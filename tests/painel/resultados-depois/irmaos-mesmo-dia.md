# B2 · irmaos-mesmo-dia (depois das correções)

**Persona:** Marina, mãe organizada, escreve bem. Tem Helena (5 anos) e Theo (8 anos) cadastrados no mesmo celular.
**Família no simulador:** `irmaos` · início 2026-10-14T13:30:00Z (quarta, 10h30).
**Objetivo:** marcar duas consultas em Santos, uma para cada filho, no mesmo dia e em horários seguidos.

## Resultado: CONSEGUIU (com passos a mais)

O estado final mostra `qua., 21/10, 09:20 Livance · Santos [scheduled] Helena Souza Lima` e `qua., 21/10, 10:00 Livance · Santos [scheduled] Theo Souza Lima`. Cada consulta ficou no filho certo, e 10:00 é o horário logo depois de 09:20 (consultas de 40 min). As duas consultas ficaram marcadas em 13 mensagens (antes, 14). A 14ª foi só o "obrigada", e o robô fechou o atendimento como `resolvida`. O robô agora aceita o nome da criança ("Então vamos começar pela Helena", "Theo") e põe o nome dela em cada confirmação, então a mãe sabe de quem é cada consulta. Ainda não existe caminho para "os dois": o robô continua marcando uma criança por vez, ignora o Theo quando ela pede os dois numa frase só, e se apresenta de novo no meio da conversa.

## Antes x depois

- **Antes, problema 1 (turno 1): a pergunta "Dá pra marcar os dois juntos…?" e o "Santos" eram ignorados.** **Continua** (turno 1). A única mudança é "Responda com o número ou o nome".
- **Antes, problema 2 (turno 2): "Para os dois" → "Não entendi", com a lista trocada por um botão só.** **Continua** (turno 2): "Não entendi. Responda com o número ou o nome do paciente da lista acima." e só o botão "0 = Voltar ao início".
- **Antes, problema 3 (turno 6): marcava só a Helena, sem dizer o nome e sem falar do Theo.** **Corrigido em parte** (turno 6): a confirmação agora mostra "👶 Helena Souza Lima". O Theo, porém, continua ignorado em silêncio, e não vem nenhum "agora vamos à do Theo?".
- **Antes, problema 4 (turno 7): o robô se apresentava de novo com o menu completo.** **Continua** (turno 7): "Ótimo, obrigada! E o Theo? Preciso dele às 10:00 no mesmo dia" → "Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz… Como podemos ajudar hoje?" e o menu.
- **Antes, problema 5 (turno 10): "Theo" escrito não era aceito.** **Corrigido** (turno 10: "Theo" foi direto para a unidade; turno 3: "Então vamos começar pela Helena" também foi aceito).
- **Antes, problema 6 (turno 11): o robô perguntava a unidade de novo.** **Continua** (turnos 3 e 10). Pelo menos "Santos, igual a Helena" escrito agora é entendido (turno 11).
- **Antes, problema 7 (turno 13): "Dia 21, às 10:00, logo depois da Helena" mostrava a lista de horários.** **Continua** (turno 12). Escolheu o dia certo e mostrou a lista, com 10:00 livre, em vez de marcar. Custou um toque a mais (turno 13).
- **Antes, problema 8 (turno 14): a segunda confirmação vinha sem o nome do Theo.** **Corrigido** (turno 13: "👶 Theo Souza Lima").
- **Novo, sem efeito aqui:** a lista "Para quem é a consulta?" do turno 9 tem "*3* Outra criança", e a do turno 1 não tem. A mesma pergunta aparece com opções diferentes.

## Problemas que restam

1. **MÉDIA · turnos 1 e 2 · nenhum caminho para "os dois".** No turno 1 a pergunta dela fica sem resposta. No turno 2, "Para os dois" → "Não entendi. Responda com o número ou o nome do paciente da lista acima.", e a lista some (fica só "0 = Voltar ao início"). Ela teve de escolher uma criança de memória. Esperado: "Vamos marcar um de cada vez, começando pela Helena" ou uma opção "os dois".
2. **MÉDIA · turno 6 · o pedido do Theo some em silêncio.** "Helena às 09:20 e o Theo logo em seguida, às 10:00" → "✅ *Consulta marcada!* 👶 Helena Souza Lima …" e mais nada sobre o Theo. Esperado: "Consulta da Helena marcada. Quer que eu marque o Theo às 10:00 no mesmo dia?".
3. **MÉDIA · turno 7 · nova apresentação no meio da conversa.** "Ótimo, obrigada! E o Theo? Preciso dele às 10:00 no mesmo dia" → "Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico. Estamos aqui para cuidar do seu filho. Como podemos ajudar hoje?" e o menu. O robô não respondeu e ela teve de recomeçar por "Marcar uma consulta" → "Marcar mais uma" (turnos 8 e 9).
4. **BAIXA · turnos 3 e 10 · a unidade é perguntada de novo**, embora ela tenha dito "em Santos" no turno 1 e a Helena tenha acabado de ser marcada em Santos.
5. **BAIXA · turno 12 · o horário escrito junto do dia não é usado.** "Dia 21, às 10:00, logo depois da Helena" → "⏰ *Horários de quarta, 21/10:*" com a lista, embora 10:00 estivesse livre.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Mãe com dois filhos (Helena e Theo no mesmo celular: o robô pergunta para quem é a consulta.)

[1] FAMÍLIA (qua., 14/10, 10:30): Bom dia! Gostaria de marcar consulta para os meus dois filhos, a Helena e o Theo, em Santos. Dá pra marcar os dois juntos, no mesmo dia, um seguido do outro?
    ROBÔ:
      Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Já separei a agenda para você 👇 Se antes quiser saber valores ou tirar uma dúvida, digite *0* para ver todas as opções.
      
      👶 *Vamos agendar!* Para quem é a consulta?
      
      *1* Helena Souza Lima
      *2* Theo Souza Lima
      
      Responda com o número ou o nome. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher paciente"] 1 = Helena Souza Lima | 2 = Theo Souza Lima | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[2] FAMÍLIA (qua., 14/10, 10:30): Para os dois
    ROBÔ:
      Não entendi. Responda com o número ou o nome do paciente da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[3] FAMÍLIA (qua., 14/10, 10:31): Então vamos começar pela Helena
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
      
      👶 Helena Souza Lima
      🗓️ quarta, 21/10 às 09:20
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 09:20 · Livance · Santos · Helena Souza Lima)

[7] FAMÍLIA (qua., 14/10, 10:34): Ótimo, obrigada! E o Theo? Preciso dele às 10:00 no mesmo dia
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
      *3* Outra criança
      
      Responda com o número ou o nome. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher paciente"] 1 = Helena Souza Lima | 2 = Theo Souza Lima | 3 = Outra criança | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (qua., 14/10, 10:36): Theo
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (17 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (32 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[11] FAMÍLIA (qua., 14/10, 10:37): Santos, igual a Helena
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (5 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[12] FAMÍLIA (qua., 14/10, 10:38): Dia 21, às 10:00, logo depois da Helena
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

[13] FAMÍLIA (qua., 14/10, 10:39): [tocou] 10:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      👶 Theo Souza Lima
      🗓️ quarta, 21/10 às 10:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 10:00 · Livance · Santos · Theo Souza Lima)

[14] FAMÍLIA (qua., 14/10, 10:39): Perfeito, obrigada!
    ROBÔ:
      😊 Por nada! Se precisar de algo, é só escrever *0* para ver as opções.
      [botões] 0 = Ver as opções
    · bastidores: Atendimento concluído sem precisar de ninguém

--- estado no fim ---
Etapa do robô: nenhuma · Situação: resolvida
Consultas: qua., 21/10, 09:20 Livance · Santos [scheduled] Helena Souza Lima; qua., 21/10, 10:00 Livance · Santos [scheduled] Theo Souza Lima
```
