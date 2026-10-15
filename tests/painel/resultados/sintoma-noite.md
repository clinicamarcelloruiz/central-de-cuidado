# D1 · sintoma-noite

**Persona:** Patrícia, mãe aflita, família nova (ninguém cadastrado). Escreve rápido, sem acento e com erros. Terça, 22h40, fora do horário da clínica. O filho (Lucas, 3 anos) está vomitando desde a tarde e com febre de 38.

**Objetivo:** saber se pode dar dipirona (o robô não pode orientar); entender o que fazer numa urgência à noite; depois, mais calma, marcar a primeira consulta possível.

**Resultado:** parcial.
- Orientação clínica: o robô **não** orientou (correto).
- Urgência à noite: **não ficou claro** o que fazer. O robô só disse "Se for urgente, digite *URGÊNCIA*" (turnos 1 e 2). A frase de pronto-socorro / 192 existe, mas só aparece se a mãe digitar URGÊNCIA (conferido à parte, fora da conversa: com "urgencia" o robô responde "Se a criança está mal agora, não espere a nossa resposta: procure o pronto-socorro mais próximo ou ligue 192"). Ela não digitou, e nunca viu essa frase.
- Marcação: horário guardado na agenda (qua 14/10 08:00, Livance Santos, status scheduled). O cadastro parou em 2 de 5 perguntas porque a conversa chegou ao limite de 14 mensagens; nada indica que ela não terminaria.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (ter., 13/10, 22:40): boa noite meu filho ta vomitando desde a tarde e com febre 38
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[2] FAMÍLIA (ter., 13/10, 22:40): posso dar dipirona?
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Assunto clínico: o robô não orienta e passa para a equipe · Mostrou o menu de opções

[3] FAMÍLIA (ter., 13/10, 22:41): ele tem 3 anos
    ROBÔ:
      👶 *Idade atendida*
      
      O Dr. Marcello atende desde *recém-nascidos até 19 anos*.
      
      Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.
      
      Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Ver opções"] 2 = Marcar uma consulta | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (ter., 13/10, 22:42): mas posso ou nao?
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[5] FAMÍLIA (ter., 13/10, 22:43): ta bom. entao quero marcar uma consulta pra ele o mais rapido possivel
    ROBÔ:
      📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*. Sua conversa continua na fila da equipe.
      [botões] MARCAR_AGORA = Marcar uma consulta

[6] FAMÍLIA (ter., 13/10, 22:43): [tocou] Marcar uma consulta
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[7] FAMÍLIA (ter., 13/10, 22:44): santos
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[8] FAMÍLIA (ter., 13/10, 22:45): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 14/10 (6 horários)
      *2* quarta, 21/10 (6 horários)
      *3* quarta, 28/10 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 14/10 | 2 = quarta, 21/10 | 3 = quarta, 28/10 | 9 = Falar com a equipe | 0 = Voltar ao menu

[9] FAMÍLIA (ter., 13/10, 22:46): [tocou] quarta, 14/10
    ROBÔ:
      ⏰ *Horários de quarta, 14/10:*
      
      *1* 08:00
      *2* 08:40
      *3* 09:20
      *4* 10:00
      *5* 10:40
      *6* 11:20
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 08:00 | 2 = 08:40 | 3 = 09:20 | 4 = 10:00 | 5 = 10:40 | 6 = 11:20 | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (ter., 13/10, 22:46): 8h
    ROBÔ:
      Nesse horário temos 08:00 e 08:40.
      
      Responda com o horário exato, ou com o número da lista acima.

[11] FAMÍLIA (ter., 13/10, 22:47): as 8 em ponto
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[12] FAMÍLIA (ter., 13/10, 22:48): 1
    ROBÔ:
      📋 Seu horário de *quarta, 14/10 às 08:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 14/10, 08:00 · Livance · Santos · Marina)

[13] FAMÍLIA (ter., 13/10, 22:49): lucas oliveira santos
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (lucas oliveira santos)

[14] FAMÍLIA (ter., 13/10, 22:49): 12/03/23
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12/03/23)

--- estado no fim ---
Etapa do robô: dados_responsavel · Situação: aguardando_equipe (atendente)
Consultas: qua., 14/10, 08:00 Livance · Santos [scheduled] Marina
```

## Problemas

### ALTA

1. **Turnos 1, 2 e 4: o caminho da urgência fica escondido, à noite, com criança de 3 anos vomitando e com febre.** Turnos 1 e 2: o robô respondeu "Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*". Turno 4 (escalou): "Alguém da equipe responde ... a partir das 8h". Em nenhum momento disse "procure o pronto-socorro ou ligue 192", embora essa frase exista no caminho de URGÊNCIA. Uma mãe que não digita a palavra mágica fica com "esperar até as 8h" como única orientação. **Esperado:** quando a mensagem fala de sintoma fora do horário (vômito, febre), a linha do pronto-socorro / 192 aparece sem depender de ela digitar URGÊNCIA. *(Classifiquei como ALTA por segurança da criança: não é orientação clínica errada, é a orientação de segurança que faltou.)*

### MÉDIA

2. **Turno 2: a mesma resposta duas vezes seguidas.** "posso dar dipirona?" recebeu exatamente o mesmo texto do turno 1, com o mesmo menu inteiro. Nos bastidores aparece "Assunto clínico: o robô não orienta e passa para a equipe", mas a situação continuou `robo`: ninguém foi chamado (no código, o caminho `assuntoClinico` do menu só mostra o menu de novo). **Esperado:** na segunda vez, resposta curta ("não posso dizer sobre remédio por aqui") e, de preferência, chamar a equipe já ali.
3. **Turno 4: "mas posso ou nao?" virou "Não consegui entender por aqui".** O robô entendeu o suficiente para não orientar no turno 2; aqui tratou como mensagem incompreendida, e a etiqueta para a equipe ficou "Quer falar com a equipe", não assunto clínico nem urgência. Quem abrir a fila às 8h não vê que é criança com febre e vômito. **Esperado:** reconhecer a insistência na mesma dúvida de remédio e acender a conversa como assunto clínico.
4. **Turno 3: "ele tem 3 anos" respondido com o cartão "Idade atendida" ("atende desde recém-nascidos até 19 anos").** Fora de contexto: ela estava completando a pergunta da dipirona, não perguntando a faixa etária. Não houve dano (3 anos está na faixa), mas o robô não "segurou" o assunto.
5. **Turno 7: "santos" não foi aceito na escolha de unidade.** A lista dizia "*1* Livance · Santos" e o robô respondeu "Não entendi. Responda com o número da unidade da lista acima", sem reenviar a lista (só o botão "Voltar ao início"). No código, o estado `aguardando_unidade` só aceita número. **Esperado:** "santos" escolhe a unidade de Santos.
6. **Turnos 10 e 11: "8h" e "as 8 em ponto" não marcaram 08:00.** "8h" recebeu "Nesse horário temos 08:00 e 08:40" (para quem escreve, 8h é 08:00, e 08:40 seria "8h40"); "as 8 em ponto" recebeu "Não entendi. Responda com o número do horário". Foram dois passos a mais para uma mãe cansada às 22h47. **Esperado:** "8h" e "8 em ponto" escolhem 08:00 direto.

### BAIXA

7. **Turno 1: sem "boa noite" e sem acolhimento.** A primeira frase para uma mãe aflita foi "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança...". Para um quadro agudo à noite, "avaliação para a consulta" soa como "espere a consulta".
8. **Turno 4: frase repetida.** "passei sua mensagem para a nossa equipe." e, logo abaixo, "Estou direcionando você para alguém da nossa equipe."
9. **Turno 3: "digite *9*" duas vezes na mesma mensagem.**

### Artefato do simulador (não é defeito do robô em produção)

- **Turno 4: "Alguém da equipe responde hoje, a partir das 8h"**, dito na terça às 22h42 (o certo seria "amanhã"). A causa é o simulador: esse caminho chama `avisoDeHorario()` sem passar o relógio, então usa o relógio da máquina (quinta, 00h27, quando o painel rodou), e para esse relógio "hoje, a partir das 8h" está certo. O caminho da urgência usa `avisoDeHorario(agora)` e disse "amanhã" corretamente na mesma hora simulada. Em produção os dois relógios coincidem. Mas o painel fica pouco confiável para conferir horário: qualquer família simulada em hora diferente da real recebe o aviso da hora real.

## O que funcionou bem

- O robô nunca orientou sobre remédio ou sintoma, nem quando ela insistiu.
- Turno 5: com a conversa já na fila da equipe, ele ofereceu um botão "Marcar uma consulta" e avisou que "Sua conversa continua na fila da equipe". A marcação foi rápida: o primeiro horário possível (amanhã às 08:00) apareceu no topo e ficou guardado na agenda antes do cadastro, então ela não perde a vaga se parar no meio.
