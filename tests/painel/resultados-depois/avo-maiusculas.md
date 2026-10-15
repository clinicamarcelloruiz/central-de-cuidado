# B1 · avo-maiusculas (depois dos consertos)

**Persona:** Dona Cida, 68 anos, avó cuidando do neto. Escreve TUDO EM MAIÚSCULAS, sem acento e sem pontuação.
**Família:** `nova` · início qua. 14/10/2026, 11h (`2026-10-14T14:00:00Z`, igual à rodada anterior).
**Objetivo:** saber o valor e o endereço de São Paulo, confirmar que o médico atende um neto de 15 anos, e marcar em São Paulo sem saber o CPF e sem ter e-mail.

Roteiro: `tests/painel/familias-depois/avo-maiusculas.json` (16 mensagens).

## Resultado: CONSEGUIU

Valor, endereço e idade foram respondidos certo nos turnos 1 a 3, como antes. A consulta entrou na agenda no turno 9 (antes, no turno 12): sex. 23/10, 14:00, Livance Ibirapuera, `scheduled`. O cadastro terminou dentro do limite no turno 15, com "✅ *Tudo certo, obrigado!*" e o comprovante "👶 Joao Pedro Oliveira dos Santos".

Ela passou pelo CPF e pelo e-mail sem nenhum "não confere" e sem nenhum "parece incompleto". No banco falso o paciente nasceu com nome capitalizado, nascimento 2011-03-10, responsável "Rosangela Oliveira" e CPF e e-mail em branco.

Ainda custou dois passos a mais por causa do robô. No turno 4, "quero marcar" foi parar na fila da equipe. No turno 6, o robô perguntou a unidade de novo.

## Antes x depois

- **#1 (ALTA), turno 4: "ENTAO QUERO MARCAR EM SAO PAULO PRO MEU NETO" vai para a equipe.** **Continua**, com o texto idêntico: "Passei sua pergunta para a nossa equipe, que responde por aqui." Numa checagem à parte, na mesma etapa (`informacoes_unidade`), "quero marcar em sao paulo pro meu neto" em minúsculas também vai para a equipe, e "QUERO MARCAR" sozinho dá "Não entendi. Responda com o número da unidade ou toque em *Escolher*."
- **#2, aviso de horário errado (artefato do simulador):** **consertado.** O turno 4 diz "Atendemos de segunda a sexta, das 8h às 18h."
- **#3, turno 6: pergunta a unidade depois do botão "Marcar uma consulta".** **Continua** (turno 6).
- **#4, turno 7: "SAO PAULO JA FALEI" dava "Não entendi".** **Consertado.** O robô foi direto às datas de São Paulo.
- **#5, turno 10: "AS 14 HORAS QUE ELE SAI DA ESCOLA" virava faixa de horário.** **Consertado.** No turno 9 o robô guardou "sexta, 23/10 às 14:00".
- **#6, turno 11: "14 EM PONTO" dava "Não entendi".** **Não se aplica mais**, porque ela não precisou repetir.
- **#7 (BAIXA), turno 1: sem cumprimento nem apresentação.** **Continua** (turno 1).
- **#8 (BAIXA), turno 2: veio também o endereço de Santos.** **Continua** (turno 2).
- **#9 (BAIXA): "nome completo do paciente (a criança)" e "data de nascimento da criança" para um neto de 15 anos.** **Continua** (turnos 9 e 10).
- **#10 (BAIXA): nome gravado em maiúsculas.** **Consertado.** Os bastidores registram "Joao Pedro Oliveira dos Santos" e o cadastro sai assim. Sem acento, mas isso não tem como adivinhar.
- **#11 (BAIXA): situação `aguardando_equipe` durante toda a marcação.** **Continua** dos turnos 4 a 14 e passa a `resolvida` no turno 15.
- **#12, responsável gravado com a frase inteira:** **consertado.** No turno 12 o robô não gravou a frase e pediu de novo. Ver a BAIXA abaixo sobre o texto dessa pergunta.
- **#13, "NAO SEI O CPF DELE A MAE QUE TEM" dava "Esse CPF não confere" e PULAR duas vezes:** **consertado.** O turno 14 responde "Sem problema." e segue.
- **#14, "NAO TENHO EMAIL" dito na pergunta do CPF seguido da pergunta do e-mail:** **não aconteceu nesta conversa**, porque o CPF foi resolvido de primeira. Numa checagem à parte, fora do roteiro, mandando "NAO TENHO EMAIL" na pergunta do CPF, o robô ainda responde "Sem problema. ✉️ Por fim, qual é o *e-mail*…". O "Sem problema" ficou mais claro que o antigo "deixamos esse campo em branco", mas a pergunta pelo e-mail continua.
- **#15, "OBRIGADA" dava "Esse e-mail parece incompleto":** **consertado.** No turno 16, depois do fim, veio "😊 Por nada!".
- **#16, "NAO TENHO EMAIL" na pergunta do e-mail dava "parece incompleto":** **consertado.** No turno 15 o robô concluiu o cadastro direto.

## Problemas que restam

**ALTA**

- **Turno 4: "ENTAO QUERO MARCAR EM SAO PAULO PRO MEU NETO" recebeu "Passei sua pergunta para a nossa equipe, que responde por aqui."** O pedido para marcar vira "Dúvida sem resposta pronta" e cai na fila humana. Isso acontece porque a conversa ainda está na etapa da lista de unidades do turno 1 (`informacoes_unidade`), e ali "quero marcar" não é reconhecido. Ela só chegou à agenda porque insistiu no turno 5 e tocou no botão.

**MÉDIA**

- **Turno 6: "📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?"** Ela já tinha dito São Paulo nos turnos 2 e 4. Agora o nome é aceito (turno 7), mas o passo continua lá.

**BAIXA**

- **Turno 12: "Não consegui ler o nome. Pode escrever de novo?"** Ela tinha escrito o nome, ROSANGELA, no meio da frase. O texto não diz o que se espera (por exemplo "só o nome completo da mãe, pai ou tutor"). Ela acertou na segunda tentativa.
- **Turnos 9 e 10:** "nome completo do paciente (a criança)" e "data de nascimento da criança", para um adolescente de 15 anos.
- **Turnos 4 a 14:** a conversa fica como "Quer falar com a equipe" na lista durante toda a marcação, e o motivo é só o defeito do turno 4.
- **Turno 1:** vai direto aos valores, sem cumprimentar o "BOA TARDE".
- **Turno 2:** pediu o endereço de São Paulo e veio também o de Santos.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 11:00): BOA TARDE QUANTO CUSTA A CONSULTA
    ROBÔ:
      💙 *Valores da consulta:*
      
      • Santos: R$ 450,00
      • São Paulo: R$ 600,00
      • Telemedicina: R$ 450,00
      
      Todas incluem retorno em até 30 dias (na telemedicina, o retorno é presencial).
      
      💳 Pagamento: em Santos e em São Paulo, online, pelo link de pagamento que a Livance envia antes da consulta; na telemedicina, pix. Emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      📍 Quer ver endereço e o que levar? Escolha o atendimento:
      
      *1* Livance · Santos
      *2* Livance Ibirapuera - São Paulo
      *3* Telemedicina (por vídeo)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[2] FAMÍLIA (qua., 14/10, 11:00): E O ENDERECO DE SAO PAULO
    ROBÔ:
      Atendemos em duas unidades, as duas com estacionamento particular no local:
      
      📍 *Livance · Ibirapuera*: R. Agostinho Rodrigues Filho, 550, Vila Clementino, São Paulo.
      
      📍 *Livance · Santos*: Av. Anna Costa, 228, 20º andar, Gonzaga, Santos.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início

[3] FAMÍLIA (qua., 14/10, 11:01): ELE ATENDE NETO DE 15 ANOS
    ROBÔ:
      👶 *Idade atendida*
      
      O Dr. Marcello atende desde *recém-nascidos até 19 anos*.
      
      Se a sua dúvida for sobre um caso específico, digite *9* e alguém da equipe responde.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início

[4] FAMÍLIA (qua., 14/10, 11:02): ENTAO QUERO MARCAR EM SAO PAULO PRO MEU NETO
    ROBÔ:
      Passei sua pergunta para a nossa equipe, que responde por aqui.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Dúvida sem resposta pronta: passou para a equipe · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[5] FAMÍLIA (qua., 14/10, 11:03): NAO E PERGUNTA EU QUERO MARCAR A CONSULTA DELE
    ROBÔ:
      📅 Para ver os horários livres e marcar agora, toque em *Marcar uma consulta*. Sua conversa continua na fila da equipe.
      [botões] MARCAR_AGORA = Marcar uma consulta

[6] FAMÍLIA (qua., 14/10, 11:03): [tocou] Marcar uma consulta
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[7] FAMÍLIA (qua., 14/10, 11:04): SAO PAULO JA FALEI
    ROBÔ:
      🗓️ *Datas disponíveis em Livance Ibirapuera - São Paulo:*
      
      *1* sexta, 16/10 (5 horários)
      *2* sexta, 23/10 (5 horários)
      *3* sexta, 30/10 (5 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = sexta, 16/10 | 2 = sexta, 23/10 | 3 = sexta, 30/10 | 9 = Falar com a equipe | 0 = Voltar ao menu

[8] FAMÍLIA (qua., 14/10, 11:05): PODE SER DIA 23
    ROBÔ:
      ⏰ *Horários de sexta, 23/10:*
      
      *1* 14:00
      *2* 14:40
      *3* 15:20
      *4* 16:00
      *5* 16:40
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 14:00 | 2 = 14:40 | 3 = 15:20 | 4 = 16:00 | 5 = 16:40 | 9 = Falar com a equipe | 0 = Voltar ao menu

[9] FAMÍLIA (qua., 14/10, 11:06): AS 14 HORAS QUE ELE SAI DA ESCOLA
    ROBÔ:
      📋 Seu horário de *sexta, 23/10 às 14:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (sex., 23/10, 14:00 · Livance Ibirapuera - São Paulo · Marina)

[10] FAMÍLIA (qua., 14/10, 11:06): JOAO PEDRO OLIVEIRA DOS SANTOS
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Joao Pedro Oliveira dos Santos)

[11] FAMÍLIA (qua., 14/10, 11:07): DIA 10 DE MARCO DE 2011
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (DIA 10 DE MARCO DE 2011)

[12] FAMÍLIA (qua., 14/10, 11:08): A MAE E MINHA FILHA ROSANGELA MAS QUEM VAI LEVAR SOU EU A AVO
    ROBÔ:
      Não consegui ler o nome. Pode escrever de novo?

[13] FAMÍLIA (qua., 14/10, 11:09): ROSANGELA OLIVEIRA
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Rosangela Oliveira)

[14] FAMÍLIA (qua., 14/10, 11:09): NAO SEI O CPF DELE A MAE QUE TEM
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[15] FAMÍLIA (qua., 14/10, 11:10): NAO TENHO EMAIL
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Joao Pedro Oliveira dos Santos
      🗓️ sexta, 23/10 às 14:00
      📍 Livance Ibirapuera - São Paulo
      Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Paciente cadastrado no sistema (Joao Pedro Oliveira dos Santos)

[16] FAMÍLIA (qua., 14/10, 11:11): OBRIGADA
    ROBÔ:
      😊 Por nada! Se precisar de algo, é só escrever *0* para ver as opções.
      [botões] 0 = Ver as opções

--- estado no fim ---
Etapa do robô: menu · Situação: robo
Consultas: sex., 23/10, 14:00 Livance Ibirapuera - São Paulo [scheduled] Marina
```
