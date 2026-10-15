# cancelar-melhorou (C2) · depois das correções

**Persona:** mãe da Helena (Marina). Educada, religiosa, escreve frases inteiras sem acento. A filha melhorou e ela quer cancelar; depois quer entender se perde o retorno e se pode marcar de novo. Dois dias depois a menina volta a ter dor e ela tenta remarcar.

**Família:** `com_consulta` (consulta marcada para qua., 21/10, 08:00, Livance · Santos). Início 2026-10-14T20:00:00Z (qua., 17h), igual à rodada anterior.

**Objetivo:** cancelar com segurança (com confirmação) e entender o que acontece depois.

## Resultado: PARCIAL

O cancelamento continua seguro e correto (turnos 2 e 3: confirmação, "sim pode cancelar" aceito, horário liberado, equipe avisada). A remarcação dois dias depois ficou bem mais lisa: o estado velho não vale mais, "santos por favor" foi aceito pelo nome e a confirmação agora mostra o nome da criança. A despedida no fim da tarde agora fecha bem no turno 7. Mas a parte "entender o que acontece depois" segue falhando do mesmo jeito: a pergunta sobre o retorno recebe o texto de preparo da consulta (turno 4), "posso marcar de novo depois?" abre o agendamento (turno 5) e "nao agora nao precisa... obrigada" ainda recebe "Não entendi qual unidade" (turno 6). Novo: o "obrigada" do turno 7 fecha a conversa como resolvida e apaga a bandeira "Cancelou pelo WhatsApp" três minutos depois do cancelamento.

## Antes x depois

- **Turno 4, pergunta sobre o retorno respondida com o texto de preparo:** continua. Resposta idêntica ("Leve um documento com foto do responsável... O retorno está incluído e pode ser feito em até 30 dias").
- **Turno 5, pergunta virou ação ("e posso marcar de novo depois?" → "Vamos agendar!"):** continua, idêntico.
- **Turnos 6 e 7, desistência e agradecimento não entendidos:** metade corrigida. Turno 7 ("ta bom, obrigada!") agora recebe "Tudo bem, não marquei nada. Quando quiser, é só escrever por aqui. 💙" e encerra. Turno 6 ("nao agora nao precisa, so queria saber mesmo. obrigada") continua em "Não entendi qual unidade...", agora com a lista inteira repetida.
- **Turno 8, estado velho de 40 h:** corrigido. Dois dias depois o robô não cobra mais "o número da unidade da lista acima"; mostra o aviso de sintomas e o menu. Mas ainda não trata "queria marcar de novo" como pedido de agendamento (ver problemas).
- **Turno 9, unidade pelo nome:** corrigido na pergunta "Em qual unidade?": no turno 10, "santos por favor" foi direto para as datas de Livance · Santos. Ainda falha quando o nome vem junto do pedido, a partir do menu (turno 9, ver problemas).
- **Turno 12, "as 8 mesmo" não aceito:** continua, idêntico ("Não entendi. Responda com o número do horário da lista acima.").
- **Turnos 1 e 2, confirmação dobrada:** continua. Ela escreveu "pode cancelar a consulta da Helena" e ainda passa pela tela "Digite CANCELAR para desmarcar" antes da confirmação.
- **Turno 1, "Olá, Helena!" para a mãe:** continua.
- **Turno 3, tom ("Consulta cancelada. Obrigado por avisar!" sem reagir a "ela já melhorou"):** continua.
- **Novo, turno 7:** o agradecimento conclui o atendimento e a situação passa de `aguardando_equipe (cancelou_sozinho)` para `resolvida`. Na rodada anterior a conversa ficou acesa até o fim.
- **Melhoria a mais, turno 13:** a confirmação da consulta nova agora traz "👶 Helena Souza Lima".

## Problemas que restam

1. **MÉDIA · turno 4 · pergunta sobre o retorno respondida fora de contexto.** "mas se ela piorar eu perco o retorno?" → "Leve um documento com foto do responsável, a carteirinha de vacinação... ✅ Não precisa de jejum... O retorno está incluído e pode ser feito em até 30 dias." Ela acabou de cancelar; o texto fala de preparo de consulta e a frase dos 30 dias pode ser lida como se ela ainda tivesse direito a retorno.
2. **MÉDIA · turno 5 · pergunta virou ação.** "e posso marcar de novo depois?" → "📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?". Ela perguntou se *pode*, *depois*.
3. **MÉDIA · turno 6 · "não precisa" não é entendido como desistência.** "nao agora nao precisa, so queria saber mesmo. obrigada" → "Não entendi qual unidade. Responda com o número da unidade ou escreva o nome (por exemplo, Livance · Santos)." + a lista inteira de novo. Pelo código, `desistiuDoAgendamento` só pega "não precisa" seguido de "mais/remarcar/marcar/mudar", e a frase é longa demais para contar como agradecimento.
4. **MÉDIA · turno 7 (novo) · o "obrigada" apaga o aviso de cancelamento para a equipe.** "ta bom, obrigada!" → "Tudo bem, não marquei nada..." e a situação vira `resolvida` (needs_attention falso), três minutos depois de "Chamou a equipe: Cancelou pelo WhatsApp". O próprio código diz que a conversa acende porque "a vaga que abriu interessa a recepção"; aqui ela apaga antes de alguém ver. O horário liberado continua marcado na agenda, então o prejuízo é a conversa sumir da lista de atenção, não a vaga.
5. **BAIXA · turno 8 · pedido claro de marcar recebe o menu.** "a Helena voltou a reclamar de dor na barriga, queria marcar de novo" → aviso de sintomas + "Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:" e o menu. O texto é correto, mas é um passo a mais para quem já disse que quer marcar.
6. **MÉDIA · turno 9 · unidade dita junto do pedido é ignorada.** "quero marcar em santos" (a partir do menu) → "📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?". Ela precisou repetir "santos por favor" no turno 10.
7. **MÉDIA · turno 12 · hora sem "h" não é lida.** "as 8 mesmo" com "*1* 08:00" na lista → "Não entendi. Responda com o número do horário da lista acima." Pelo código, `horaEscrita` só lê hora com "h", ":", "e meia/e 20" ou "em ponto"; "as 8" fica de fora, e 8 não é índice (a lista tem 6).
8. **BAIXA · turnos 1 e 2 · confirmação dobrada.** Pedido explícito de cancelar, uma consulta só, e ainda passa por "Digite CANCELAR para desmarcar" antes de "Confirma o cancelamento desta consulta?".
9. **BAIXA · turno 1 · "Olá, Helena! 👋"** para a mãe que escreve.
10. **BAIXA · turno 3 · tom.** "Consulta cancelada. Obrigado por avisar!" não reage a "ela já melhorou graças a Deus".

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Com consulta marcada (Helena tem consulta nos próximos dias: dá para ver, remarcar ou cancelar.)
Consultas já marcadas: qua., 21/10, 08:00 Livance · Santos

[1] FAMÍLIA (qua., 14/10, 17:00): boa tarde, pode cancelar a consulta da Helena, ela ja melhorou graças a Deus
    ROBÔ:
      Olá, Helena! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Sua consulta:
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Digite CANCELAR para desmarcar, REMARCAR para trocar a data, ou 0 para voltar.
      [botões] REMARCAR = Remarcar | CANCELAR = Cancelar consulta | MENU = Voltar ao menu
    · bastidores: Família escolheu: Minha consulta

[2] FAMÍLIA (qua., 14/10, 17:00): [tocou] Cancelar consulta
    ROBÔ:
      Confirma o cancelamento desta consulta?
      
      Helena Souza Lima
      quarta, 21/10 às 08:00
      Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      Responda SIM para cancelar, ou 0 para deixar como está.
      [botões] SIM = Sim, cancelar | MENU = Não, manter

[3] FAMÍLIA (qua., 14/10, 17:01): sim pode cancelar
    ROBÔ:
      Consulta cancelada. Obrigado por avisar!
      
      Se quiser marcar outra data, digite 2. Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: A família cancelou a consulta · Chamou a equipe: Cancelou pelo WhatsApp · Consulta cancelada: o horário voltou a ficar livre (qua., 21/10, 08:00 · Livance · Santos) · Conversa acesa na lista: Cancelou pelo WhatsApp

[4] FAMÍLIA (qua., 14/10, 17:02): ok obrigada. mas se ela piorar eu perco o retorno?
    ROBÔ:
      Leve um documento com foto do responsável, a carteirinha de vacinação da criança e os exames anteriores, se houver.
      
      ⏱️ A consulta dura de 40 minutos a 1 hora.
      
      ✅ Não precisa de jejum nem de preparo: é só a consulta.
      
      O retorno está incluído e pode ser feito em até 30 dias.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 17:03): e posso marcar de novo depois?
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[6] FAMÍLIA (qua., 14/10, 17:03): nao agora nao precisa, so queria saber mesmo. obrigada
    ROBÔ:
      Não entendi qual unidade. Responda com o número da unidade ou escreva o nome (por exemplo, Livance · Santos).
      
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Não entendeu a resposta e explicou de novo

[7] FAMÍLIA (qua., 14/10, 17:04): ta bom, obrigada!
    ROBÔ:
      Tudo bem, não marquei nada. Quando quiser, é só escrever por aqui. 💙
    · bastidores: Atendimento concluído sem precisar de ninguém

  … 2400 min depois …

[8] FAMÍLIA (sex., 16/10, 09:05): oi bom dia, a Helena voltou a reclamar de dor na barriga, queria marcar de novo
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[9] FAMÍLIA (sex., 16/10, 09:06): quero marcar em santos
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (20 horários livres)
      *3* Telemedicina (por vídeo) (38 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (sex., 16/10, 09:06): santos por favor
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[11] FAMÍLIA (sex., 16/10, 09:07): [tocou] quarta, 21/10
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

[12] FAMÍLIA (sex., 16/10, 09:08): as 8 mesmo
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[13] FAMÍLIA (sex., 16/10, 09:09): [tocou] 08:00
    ROBÔ:
      ✅ *Consulta marcada!*
      
      👶 Helena Souza Lima
      🗓️ quarta, 21/10 às 08:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Consulta marcada na agenda (qua., 21/10, 08:00 · Livance · Santos · Helena Souza Lima)

[14] FAMÍLIA (sex., 16/10, 09:09): obrigada, Deus abencoe
    ROBÔ:
      😊 Por nada! Se precisar de algo, é só escrever *0* para ver as opções.
      [botões] 0 = Ver as opções
    · bastidores: Atendimento concluído sem precisar de ninguém

--- estado no fim ---
Etapa do robô: nenhuma · Situação: resolvida
Consultas: qua., 21/10, 08:00 Livance · Santos [cancelled] Helena Souza Lima; qua., 21/10, 08:00 Livance · Santos [scheduled] Helena Souza Lima
```
