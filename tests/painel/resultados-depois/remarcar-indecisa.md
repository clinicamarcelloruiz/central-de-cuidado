# remarcar-indecisa (C1), depois das correções

**Persona:** Marina, mãe da Helena (família `com_consulta`; consulta já marcada para qua., 21/10, 08:00, Livance · Santos). Escreve curto, sem acento, no celular. Começa querendo mudar a consulta para a semana seguinte; depois de ver os horários, desiste e quer manter a original.

**Família:** `com_consulta` (identidade `marcello`).

**Início:** 2026-10-14T15:00:00Z (qua., 12h), igual à rodada anterior.

**Objetivo:** manter a consulta original intacta (nada cancelado sem ela confirmar) e o robô entender a desistência.

## Resultado: CONSEGUIU

No turno 7, "ah nao, pensando bem deixa a que ja ta marcada mesmo" (a mesma frase que antes recebeu "Não entendi" duas vezes) foi entendida. O robô respondeu "Tudo bem! Não mudei nada: sua consulta continua marcada." e mostrou de novo a consulta (Helena, quarta 21/10 às 08:00, Livance · Santos, endereço). O "ok obrigada" do turno 8 recebeu um "Por nada!" curto. A conversa terminou `resolvida`, sem passar pela equipe, com 8 mensagens da família (antes foram 12, e ela saiu sem confirmação). **Estado final conferido:** existe uma consulta só, qua., 21/10, 08:00, Livance · Santos, `[scheduled]`, Helena Souza Lima. Nada foi cancelado nem marcado.

## Antes x depois

- **Turnos 8 e 9 (antes): desistência não entendida, "Não entendi" repetido.** **Corrigido.** Turno 7 agora: "Tudo bem! Não mudei nada: sua consulta continua marcada." Sonda fora do roteiro: a segunda frase da rodada anterior ("nao quero remarcar mais, quero manter a do dia 21") também é entendida na lista de horários, e "pensando bem deixa a que ja ta marcada mesmo" também funciona na lista de dias.
- **Turno 10 (antes): "0" volta ao menu sem tranquilizar.** **Ainda acontece** (não apareceu na conversa principal porque a Marina não precisou do 0). Sonda: "0" na lista de horários devolve só "Olá, Helena! 👋 ... Como podemos ajudar hoje?", sem dizer que a remarcação foi abandonada e que a de 21/10 continua.
- **Turno 11 (antes): "a consulta do dia 21 continua marcada ne?" ia para a equipe.** **Ainda acontece** (só em sonda). Logo depois do menu, a mesma pergunta recebe "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." e a conversa vai para `aguardando_equipe`.
- **Turno 1 (antes): "preciso mudar a consulta" não reconhecido.** **Ainda acontece** (turno 1): veio o menu genérico, e foi preciso tocar em "Minha consulta" e depois em "Remarcar".
- **Turno 5 (antes): "santos" não aceito na lista de unidades.** **Corrigido** (turno 5): "santos" abriu "Datas disponíveis em Livance · Santos". Economizou uma mensagem.
- **Turnos 1 e 10 (antes): "Olá, Helena! ... cuidar do seu filho".** **Ainda acontece** (turno 1).
- **Turno 11 (antes): texto redundante ao chamar a equipe.** **Ainda acontece** (só em sonda): "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." seguido de "Estou direcionando você para alguém da nossa equipe."
- **Turno 11 (antes): motivo registrado "Quer falar com a equipe" quando foi o robô que não entendeu.** **Ainda acontece** (só em sonda): "Chamou a equipe: Quer falar com a equipe".
- **Artefato do simulador (aviso de horário pelo relógio da máquina).** **Corrigido.** O aviso agora segue o relógio do roteiro: na sonda das 12h05 de quarta saiu "Atendemos de segunda a sexta, das 8h às 18h."
- **Problema novo (só em sonda):** "manter" junto com o dia da própria consulta é lido como escolha de dia. Ver abaixo.

## Problemas que restam

1. **MÉDIA · sonda, turno 6 (lista de dias) · "manter a de quarta dia 21" vira escolha do dia 21.** Na lista "Datas disponíveis em Livance · Santos" (que inclui a própria quarta, 21/10), "deixa quieto, vou manter a de quarta dia 21 mesmo" recebeu "⏰ *Horários de quarta, 21/10:* 1 08:40 ... 5 11:20". A palavra "manter" foi ignorada porque a frase também cita um dia da lista. Se a mãe tocar um horário achando que é a confirmação, sai "✅ *Consulta remarcada!* ... quarta, 21/10 às 08:40" e a das 08:00 é cancelada (conferido na sonda: 08:00 `[cancelled]`, 08:40 `[scheduled]`). Na mesma sonda, a mensagem seguinte "nao, quero manter a que ja tenho" foi entendida e nada mudou. Na lista de horários, a mesma ideia ("quero manter a do dia 21") funciona.
2. **MÉDIA · sonda, depois do "0" · voltar ao menu não tranquiliza.** O "0" no meio da remarcação devolve só o menu ("Olá, Helena! ... Como podemos ajudar hoje?"). Falta dizer "a consulta de quarta, 21/10 às 08:00 continua marcada".
3. **MÉDIA · sonda, mensagem seguinte ao menu · pergunta sobre a própria consulta vai para a equipe.** "a consulta do dia 21 continua marcada ne?" → "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." O robô tem a consulta à mão e responderia sozinho, como na opção 4. (Como primeira mensagem da conversa, a mesma pergunta recebe o menu.)
4. **MÉDIA · turno 1 · "mudar a consulta" não leva à remarcação.** "oi, preciso mudar a consulta da Helena, nao vou conseguir ir" → menu genérico. Custa dois toques a mais ("Minha consulta", "Remarcar").
5. **BAIXA · turno 1 · saudação com o nome da criança.** "Olá, Helena! 👋 ... Estamos aqui para cuidar do seu filho." Quem escreve é a mãe, e Helena é menina.
6. **BAIXA · sonda, ao chamar a equipe · frase repetida e motivo impreciso.** "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." + "Estou direcionando você para alguém da nossa equipe."; motivo "Quer falar com a equipe", sendo que ela não pediu.

Sondas usadas (fora do roteiro, no mesmo começo até a lista de dias ou de horários): "nao quero remarcar mais, quero manter a do dia 21" (horários); "0" e depois "a consulta do dia 21 continua marcada ne?" (horários); "pensando bem deixa a que ja ta marcada mesmo" (dias); "deixa quieto, vou manter a de quarta dia 21 mesmo", seguida de "nao, quero manter a que ja tenho" ou de um toque em 08:40 (dias).

## Saída final do script

`node tests/painel/conversar.mjs tests/painel/familias-depois/remarcar-indecisa.json`

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Com consulta marcada (Helena tem consulta nos próximos dias: dá para ver, remarcar ou cancelar.)
Consultas já marcadas: qua., 21/10, 08:00 Livance · Santos

[1] FAMÍLIA (qua., 14/10, 12:00): oi, preciso mudar a consulta da Helena, nao vou conseguir ir
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

[2] FAMÍLIA (qua., 14/10, 12:00): [tocou] Minha consulta
    ROBÔ:
      Sua consulta:
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Digite CANCELAR para desmarcar, REMARCAR para trocar a data, ou 0 para voltar.
      [botões] REMARCAR = Remarcar | CANCELAR = Cancelar consulta | MENU = Voltar ao menu
    · bastidores: Família escolheu: Minha consulta

[3] FAMÍLIA (qua., 14/10, 12:01): [tocou] Remarcar
    ROBÔ:
      Vamos remarcar esta consulta:
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Responda SIM para escolher a nova data. A consulta atual só será cancelada depois que a nova estiver marcada.
      [botões] SIM = Sim, escolher data | MENU = Não, manter

[4] FAMÍLIA (qua., 14/10, 12:02): [tocou] Sim, escolher data
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (17 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (32 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 12:03): santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (5 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[6] FAMÍLIA (qua., 14/10, 12:03): [tocou] quarta, 28/10
    ROBÔ:
      ⏰ *Horários de quarta, 28/10:*
      
      *1* 08:00
      *2* 08:40
      *3* 09:20
      *4* 10:00
      *5* 10:40
      *6* 11:20
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 08:00 | 2 = 08:40 | 3 = 09:20 | 4 = 10:00 | 5 = 10:40 | 6 = 11:20 | 9 = Falar com a equipe | 0 = Voltar ao menu

[7] FAMÍLIA (qua., 14/10, 12:04): ah nao, pensando bem deixa a que ja ta marcada mesmo
    ROBÔ:
      Tudo bem! Não mudei nada: sua consulta continua marcada.
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Se precisar, é só escrever por aqui. Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém

[8] FAMÍLIA (qua., 14/10, 12:05): ok obrigada
    ROBÔ:
      😊 Por nada! Se precisar de algo, é só escrever *0* para ver as opções.
      [botões] 0 = Ver as opções
    · bastidores: Atendimento concluído sem precisar de ninguém

--- estado no fim ---
Etapa do robô: nenhuma · Situação: resolvida
Consultas: qua., 21/10, 08:00 Livance · Santos [scheduled] Helena Souza Lima
```
