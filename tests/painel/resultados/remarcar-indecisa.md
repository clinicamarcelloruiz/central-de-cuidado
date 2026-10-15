# remarcar-indecisa (C1)

**Persona:** Marina, mãe da Helena (família `com_consulta`; consulta já marcada para qua., 21/10, 08:00, Livance · Santos). Escreve curto, sem acento, no celular. Começa querendo mudar a consulta para a semana seguinte; depois de ver os horários, desiste e quer manter a original.

**Objetivo:** manter a consulta original intacta (nada cancelado sem ela confirmar) e o robô entender a desistência.

**Início:** 2026-10-14T15:00:00Z (qua., 12h).

**Resultado: PARCIAL.** A consulta de 21/10 08:00 continua `scheduled` no fim (nada foi cancelado, e o robô avisou no turno 3 que a atual só sai depois da nova marcada). Mas o robô não entendeu a desistência em duas tentativas, não disse em momento nenhum que a consulta continuava de pé, e a pergunta direta "a consulta do dia 21 continua marcada ne?" caiu na equipe. Marina termina sem confirmação, esperando uma pessoa.

## Saída final completa

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
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[6] FAMÍLIA (qua., 14/10, 12:03): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (5 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[7] FAMÍLIA (qua., 14/10, 12:04): [tocou] quarta, 28/10
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

[8] FAMÍLIA (qua., 14/10, 12:05): ah nao, pensando bem deixa a que ja ta marcada mesmo
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[9] FAMÍLIA (qua., 14/10, 12:06): nao quero remarcar mais, quero manter a do dia 21
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[10] FAMÍLIA (qua., 14/10, 12:06): 0
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

[11] FAMÍLIA (qua., 14/10, 12:07): a consulta do dia 21 continua marcada ne?
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[12] FAMÍLIA (qua., 14/10, 12:08): so queria confirmar que a consulta da Helena dia 21 as 8h nao foi desmarcada. obrigada
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: qua., 21/10, 08:00 Livance · Santos [scheduled] Helena Souza Lima
```

## Problemas

**MÉDIA · turnos 8 e 9 · desistência não entendida, resposta repetida.** "ah nao, pensando bem deixa a que ja ta marcada mesmo" e depois "nao quero remarcar mais, quero manter a do dia 21" receberam as duas vezes o mesmo "Não entendi. Responda com o número do horário da lista acima. Digite VOLTAR para escolher outro dia, ou 0 para o início." Esperado: entender "deixa a que já tá marcada / manter" e responder algo como "Tudo bem, sua consulta de quarta, 21/10 às 08:00 continua marcada." Nada sugere que existe a saída "manter"; o botão "Não, manter" só apareceu no turno 3.

**MÉDIA · turno 10 · voltar ao menu não tranquiliza.** Ao digitar 0, veio só o menu inicial de novo ("Olá, Helena! ... Como podemos ajudar hoje?"). Esperado: dizer que a remarcação foi abandonada e que a consulta de 21/10 08:00 segue marcada. Do jeito que ficou, a mãe não sabe se a consulta antiga sobreviveu.

**MÉDIA · turno 11 · pergunta simples sobre a própria consulta foi para a equipe.** "a consulta do dia 21 continua marcada ne?" → "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." O robô tem a consulta à mão (mostrou no turno 2). Esperado: mostrar "Sua consulta: quarta, 21/10 às 08:00 ..." (como faz a opção 4). Resultado: a conversa vai para a fila da equipe por uma dúvida que o robô respondia sozinho.

**MÉDIA · turno 1 · "mudar a consulta" não reconhecido.** "oi, preciso mudar a consulta da Helena, nao vou conseguir ir" recebeu o menu genérico. Esperado: ir direto para "Vamos remarcar esta consulta" (ou ao menos "Sua consulta: ..."), como acontece quando a mãe escreve "cancelar" (ver família cancelar-melhorou, turno 1). Custou um toque a mais.

**MÉDIA · turno 5 · unidade pelo nome não aceita.** "santos" na lista de unidades → "Não entendi. Responda com o número da unidade da lista acima." A lista mostrava "Livance · Santos". Esperado: aceitar o nome. No código, a etapa `aguardando_unidade` (atendimento.ts, ~linha 4656) só aceita número ou "voltar".

**BAIXA · turnos 1 e 10 · saudação com o nome da filha.** "Olá, Helena! ... Estamos aqui para cuidar do seu filho." Quem escreve é a Marina; a saudação chama a mãe pelo nome da criança e logo depois fala "seu filho" para uma menina. É uma escolha deliberada do código (usa o nome do paciente único), mas lida pela mãe soa como engano.

**BAIXA · turno 11 · texto redundante.** "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." seguido de "Estou direcionando você para alguém da nossa equipe." diz a mesma coisa duas vezes.

**BAIXA · turno 11 · motivo registrado impreciso.** Bastidores: "Chamou a equipe: Quer falar com a equipe". Ela não pediu a equipe; foi o robô que não entendeu. A equipe vê um motivo que não corresponde ao que aconteceu.

**Artefato do simulador (não é defeito do robô em produção) · turno 11.** "Agora estamos fora do horário de atendimento ... Alguém da equipe responde hoje, a partir das 8h." numa quarta às 12h07 simuladas. `avisoDeHorario()` é chamado sem `agora` na maioria dos lugares de atendimento.ts e usa o relógio real da máquina (era ~00h30 de quinta quando rodei). Em produção o relógio real é a hora da mensagem, então lá sai certo; no painel, toda família que cai na equipe vai receber esse aviso de acordo com a hora em que o script roda.

## O que funcionou bem

- Nada foi cancelado em momento nenhum; a consulta original terminou `scheduled`.
- Turno 3: antes de mostrar datas, o robô deixou claro "A consulta atual só será cancelada depois que a nova estiver marcada", com o botão "Não, manter". Exatamente o que protege a indecisa.
- Turno 9: "a do dia 21" não foi lido como opção numérica de horário (só existiam 1 a 6), então não houve marcação acidental.
- Turno 12: com a equipe chamada, o robô ficou em silêncio e não falou por cima.
