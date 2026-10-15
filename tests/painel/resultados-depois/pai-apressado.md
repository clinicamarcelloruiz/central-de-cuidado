# pai-apressado (depois das correções)

**Persona:** Rodrigo, pai, com pressa, digitando no trânsito. Manda mensagens curtas e abreviadas, sem acento, às vezes duas seguidas. Não lê parágrafo.
**Família:** `nova` · início qua. 14/10/2026, 16h30.
**Objetivo:** marcar o mais rápido possível, em qualquer unidade.

## Resultado: CONSEGUIU

A consulta foi marcada (qua. 21/10, 08:00, Livance · Santos [scheduled]) e o cadastro terminou no turno 15, com o resumo "✅ *Consulta marcada!*" e os bastidores "Atendimento concluído sem precisar de ninguém · Paciente cadastrado no sistema (Pedro Henrique Alves)". CPF e e-mail ficaram para depois, pelo botão PULAR. Antes ele parou no meio da ficha, na etapa `dados_cpf`. A escolha do dia ("qlq dia") e do horário ("8h") agora passam de primeira. A escolha da unidade continua sendo o gargalo: dos turnos 3 a 7 ele não avançou (cinco mensagens, uma a mais que antes) e só saiu ao digitar "1" no turno 8. Um pai de verdade com essa pressa ainda poderia desistir ali.

## Antes x depois

- **ALTA · turnos 3 a 6, laço na escolha da unidade** → **melhorou, mas o atraso continua**.
  - Corrigido: a lista tocável volta junto do "não entendi" (turnos 3 e 4), o texto agora explica que dá para escrever o nome ("Não entendi qual unidade. Responda com o número da unidade ou escreva o nome"), e na terceira falha (turno 5) o robô chama a equipe ("Desculpe, não estou conseguindo entender por aqui. 🙏 Já chamei alguém da nossa equipe").
  - Continua: "tem p semana q vem?", "qlq uma" e "a q tiver mais cedo" não são entendidos nessa etapa. O "qualquer um" (`qualquerUm`) só vale na escolha do dia e do horário. Os turnos 3 e 4 receberam a mesma resposta, igual.
  - Novo: a saída oferecida no turno 6 (botão "Marcar uma consulta") levou de volta à mesma lista de unidades no turno 7.
  - Balanço: ele perdeu os turnos 3 a 7, antes 3 a 6.
- **MÉDIA · turno 8 antigo, "qlq dia" sem resposta útil** → **corrigido** (turno 9: abriu direto os horários de quarta, 21/10, o primeiro dia).
- **MÉDIA · turno 10 antigo, "8h" pedia confirmação** → **corrigido** (turno 10: "8h" marcou 08:00 sem pergunta extra).
- **BAIXA · turno 12 antigo, nomes gravados em minúsculas** → **corrigido** (turnos 11 e 13: "Pedro Henrique Alves" e "Rodrigo Alves").
- **BAIXA · turno 11 antigo, "5 perguntas rápidas" sem dizer que a consulta está garantida** → **continua** (turno 10: "Seu horário de *quarta, 21/10 às 08:00* está guardado. Para completar o cadastro, 5 perguntas rápidas.").
- **Novo · turnos 5 a 14, conversa na fila da equipe enquanto ele marcava sozinho.** Do turno 5 em diante a situação ficou `aguardando_equipe (atendente)`, acesa como "Quer falar com a equipe". Ela só saiu da fila no turno 15 ("Situação: resolvida"). Uma secretária que abrisse a conversa nesse intervalo entraria no meio da ficha.

## Problemas que restam

1. **MÉDIA · turnos 3, 4 e 5 · "qualquer unidade" e "a mais cedo" não são entendidos na escolha da unidade.** "tem p semana q vem?", "qlq uma" e "a q tiver mais cedo" receberam "Não entendi qual unidade. Responda com o número da unidade ou escreva o nome…" (3 e 4) e depois a chamada da equipe (5). Ninguém ofereceu o horário mais próximo em qualquer unidade, que era o pedido dele.
2. **MÉDIA · turnos 6 e 7 · a saída oferecida volta ao mesmo ponto.** Depois de "Já chamei alguém da nossa equipe", o robô respondeu "📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*", e o toque devolveu a mesma pergunta "Em qual unidade você prefere ser atendido?", que ele não tinha conseguido responder três vezes.
3. **BAIXA · turnos 5 a 14 · fila da equipe acesa durante a marcação.** "Chamou a equipe: Quer falar com a equipe" no turno 5, e a situação ficou `aguardando_equipe` enquanto o próprio pai marcava pelo robô, até o turno 15.
4. **BAIXA · turno 10 · questionário sem dizer que a consulta já está garantida.** "está guardado… 5 perguntas rápidas" não diz o que acontece se ele parar no meio. Para quem está no trânsito, um "pode responder depois" ajudaria.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 16:30): oi
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

[2] FAMÍLIA (qua., 14/10, 16:30): qro marcar p meu filho
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[3] FAMÍLIA (qua., 14/10, 16:31): tem p semana q vem?
    ROBÔ:
      Não entendi qual unidade. Responda com o número da unidade ou escreva o nome (por exemplo, Livance · Santos).
      
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Não entendeu a resposta e explicou de novo

[4] FAMÍLIA (qua., 14/10, 16:32): qlq uma
    ROBÔ:
      Não entendi qual unidade. Responda com o número da unidade ou escreva o nome (por exemplo, Livance · Santos).
      
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Não entendeu a resposta e explicou de novo

[5] FAMÍLIA (qua., 14/10, 16:33): a q tiver mais cedo
    ROBÔ:
      Desculpe, não estou conseguindo entender por aqui. 🙏 Já chamei alguém da nossa equipe, que continua a conversa com você.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · nao entendi repetido · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[6] FAMÍLIA (qua., 14/10, 16:33): so qro marcar
    ROBÔ:
      📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*. Sua conversa continua na fila da equipe.
      [botões] MARCAR_AGORA = Marcar uma consulta

[7] FAMÍLIA (qua., 14/10, 16:34): [tocou] Marcar uma consulta
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[8] FAMÍLIA (qua., 14/10, 16:35): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[9] FAMÍLIA (qua., 14/10, 16:36): qlq dia
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

[10] FAMÍLIA (qua., 14/10, 16:36): 8h
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 08:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 08:00 · Livance · Santos · Marina)

[11] FAMÍLIA (qua., 14/10, 16:37): pedro henrique alves
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Pedro Henrique Alves)

[12] FAMÍLIA (qua., 14/10, 16:38): 5/6/19
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (5/6/19)

[13] FAMÍLIA (qua., 14/10, 16:39): rodrigo alves
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Rodrigo Alves)

[14] FAMÍLIA (qua., 14/10, 16:39): [tocou] Pular
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[15] FAMÍLIA (qua., 14/10, 16:40): [tocou] Pular
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Pedro Henrique Alves
      🗓️ quarta, 21/10 às 08:00
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Paciente cadastrado no sistema (Pedro Henrique Alves)

--- estado no fim ---
Etapa do robô: menu · Situação: resolvida
Consultas: qua., 21/10, 08:00 Livance · Santos [scheduled] Marina
```
