# pai-apressado

**Persona:** Rodrigo, pai, com pressa, digitando no trânsito. Manda mensagens curtas e abreviadas, sem acento, às vezes duas seguidas. Não lê parágrafo.

**Objetivo:** marcar o mais rápido possível, em qualquer unidade.

**Resultado:** PARCIAL. A consulta foi marcada (qua., 21/10, 08:00, Livance · Santos [scheduled], com o nome da criança), mas ele passou quatro mensagens preso na escolha da unidade e só saiu porque digitou "1". A persona não lê a lista, e um pai de verdade provavelmente teria desistido ou ligado. Bateu no limite de 14 mensagens no meio do cadastro: a etapa final é `dados_cpf`, com CPF e e-mail pendentes.

## Problemas

1. **ALTA · turnos 3 a 6. Laço na escolha da unidade.** As quatro mensagens, "tem p semana q vem?", "qlq uma", "a q tiver mais cedo" e "so qro marcar", receberam a mesma resposta, idêntica: "Não entendi. Responda com o número da unidade da lista acima." O que ele esperava:
   - "qlq uma" e "a q tiver mais cedo": que o robô oferecesse o horário mais próximo em qualquer unidade.
   - "tem p semana q vem?": um "sim, a partir de quarta 21/10".
   - Depois de duas falhas: a oferta da equipe.

   Não houve escalada nem variação, e a lista tocável sumiu: só sobrou o botão "0 = Voltar ao início". No código, `naoEntendi` (`supabase/functions/_shared/atendimento.ts`, linha 1380) não conta as falhas seguidas. A etapa `aguardando_unidade` (linha 4656) só aceita número; nem `unidadePeloNome`, que já é usado em `informacoes_unidade` e `aguardando_dia`, é chamado ali.
2. **MÉDIA · turno 8.** "qlq dia" recebeu "Não entendi. Responda com o número do dia da lista acima." Ele esperava o primeiro dia (21/10) ou os horários dele. Essa resposta também veio sem nenhum botão.
3. **MÉDIA · turno 10.** "8h" recebeu "Nesse horário temos 08:00 e 08:40. Responda com o horário exato, ou com o número da lista acima." No uso comum, "8h" é 08:00; quem quer 08:40 escreve "8h40". Para quem tem pressa, é um turno a mais. Dá para defender a desambiguação, mas ela custou uma mensagem.
4. **BAIXA · turno 12.** O nome ficou gravado como foi digitado, "pedro henrique alves", em minúsculas (bastidores: "Ficha da consulta: nome da criança (pedro henrique alves)"). O mesmo vale para o responsável, "rodrigo alves".
5. **BAIXA · turno 11.** Logo depois de marcar vieram "5 perguntas rápidas". A mensagem não diz que a consulta já está garantida, nem o que acontece se ele parar no meio. Para quem está no trânsito, um "pode responder depois" ajudaria.

Observação: as duas mensagens seguidas dos turnos 4 e 5 tiveram uma resposta cada. O simulador as espaça 45 s, então isso não testa a junção de mensagens em sequência.

## O que funcionou bem
- Turno 2: "qro marcar p meu filho" foi entendido de primeira e já caiu nas unidades.
- Turno 13: a data com ano de dois dígitos ("5/6/19") foi aceita sem pergunta extra.
- Turno 11: "8:00" marcou na hora, e o horário foi segurado antes do questionário.

## Saída final completa do script

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
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[4] FAMÍLIA (qua., 14/10, 16:32): qlq uma
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[5] FAMÍLIA (qua., 14/10, 16:33): a q tiver mais cedo
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[6] FAMÍLIA (qua., 14/10, 16:33): so qro marcar
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[7] FAMÍLIA (qua., 14/10, 16:34): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[8] FAMÍLIA (qua., 14/10, 16:35): qlq dia
    ROBÔ:
      Não entendi. Responda com o número do dia da lista acima.
      Digite VOLTAR para escolher outra unidade, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[9] FAMÍLIA (qua., 14/10, 16:36): 1
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
      Nesse horário temos 08:00 e 08:40.
      
      Responda com o horário exato, ou com o número da lista acima.

[11] FAMÍLIA (qua., 14/10, 16:37): 8:00
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 08:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 08:00 · Livance · Santos · Marina)

[12] FAMÍLIA (qua., 14/10, 16:38): pedro henrique alves
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (pedro henrique alves)

[13] FAMÍLIA (qua., 14/10, 16:39): 5/6/19
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (5/6/19)

[14] FAMÍLIA (qua., 14/10, 16:39): rodrigo alves
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (rodrigo alves)

--- estado no fim ---
Etapa do robô: dados_cpf · Situação: robo
Consultas: qua., 21/10, 08:00 Livance · Santos [scheduled] Marina
```
