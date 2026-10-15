# B1 · avo-maiusculas

**Persona:** Dona Cida, 68 anos, avó cuidando do neto. Escreve TUDO EM MAIÚSCULAS, sem acento e sem pontuação.
**Família no simulador:** `nova` · início 2026-10-14T14:00:00Z (quarta, 11h).
**Objetivo:** saber o valor e o endereço de São Paulo, confirmar que o médico atende um neto de 15 anos, e marcar em São Paulo sem saber o CPF e sem ter e-mail.

## Resultado: PARCIAL

- Valor, endereço e idade: respondidos certo, logo de cara (turnos 1 a 3).
- A consulta entrou na agenda (sex. 23/10, 14:00, Livance Ibirapuera, `scheduled`) no turno 12. Ela custou 5 mensagens a mais por causa do robô (turnos 4, 5, 7, 10 e 11).
- No limite de 14 mensagens o cadastro parou na pergunta do responsável, e as perguntas de CPF e e-mail (o ponto central da persona) não chegaram. Por isso rodei uma continuação **fora do limite**, só para diagnóstico, em `/tmp` (não fica no projeto). Está na seção "Extra" abaixo e mostra mais três defeitos.

## Problemas

| # | Gravidade | Turno | O que o robô respondeu | O que a família esperava |
|---|---|---|---|---|
| 1 | ALTA | 4 | "ENTAO QUERO MARCAR EM SAO PAULO PRO MEU NETO" → "Passei sua pergunta para a nossa equipe, que responde por aqui." A conversa foi para `aguardando_equipe` | Ir para a agenda de São Paulo. Ela pediu para marcar e a conversa caiu na fila humana. Diagnóstico: o problema não são as maiúsculas, porque "quero marcar" em minúsculas também falha nessa etapa (`informacoes_unidade`). Ali, "quero marcar" dá "Não entendi. Responda com o número da unidade" e "QUERO MARCAR CONSULTA" vai para a equipe. Numa conversa nova, "QUERO MARCAR" funciona. |
| 2 | MÉDIA (artefato do simulador) | 4 | "Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h." às 11h02 de uma quarta | "Atendemos de segunda a sexta…". Causa: `avisoDeHorario()` é chamado sem o `agora` (atendimento.ts:851, 1547, 3563 e outros) e lê o relógio real da máquina (quinta 00h26). Em produção sai certo, mas no painel qualquer resultado sobre horário fica falso. |
| 3 | MÉDIA | 6 | Depois do botão "Marcar uma consulta": "Em qual unidade você prefere ser atendido? 1 Santos 2 São Paulo 3 Telemedicina" | Ela já tinha dito São Paulo duas vezes (turnos 2 e 4). Esperava a agenda de SP direto. |
| 4 | MÉDIA | 7 | "SAO PAULO JA FALEI" → "Não entendi. Responda com o número da unidade da lista acima." | Aceitar o nome. Diagnóstico: em `aguardando_unidade` nem "São Paulo", "sao paulo", "sp" ou "ibirapuera" funcionam. O handler (atendimento.ts:4656) só chama `escolha()`, enquanto `unidadePeloNome` existe e é usado em `informacoes_unidade` e no passo do dia. Além disso, a resposta de erro troca a lista por um botão só, "0 = Voltar ao início", e ela tem que voltar à mensagem antiga para ver os números. |
| 5 | MÉDIA | 10 | "AS 14 HORAS QUE ELE SAI DA ESCOLA" → "Nesse horário temos 14:00 e 14:40." | Para quem fala, "14 horas" é 14:00, e 14:00 estava na lista. "14h" e "14 horas" também viram faixa de horário, e só "14:00" ou "1" marcam. |
| 6 | MÉDIA | 11 | "14 EM PONTO" → "Não entendi. Responda com o número do horário da lista acima." | Entender "em ponto" como 14:00. Ela só conseguiu digitando "1". |
| 7 | BAIXA | 1 | Ela abre com "BOA TARDE QUANTO CUSTA" e o robô vai direto aos valores, sem cumprimentar nem se apresentar | Não atrapalhou. A resposta foi direta e correta. |
| 8 | BAIXA | 2 | Pediu o endereço de São Paulo e veio também o de Santos | Só SP. A informação não está errada. |
| 9 | BAIXA | 12, 13 | "nome completo do paciente (a criança)", "data de nascimento da criança" | O neto tem 15 anos. "Paciente" soaria melhor. |
| 10 | BAIXA | 13 | O nome ficou gravado como "JOAO PEDRO OLIVEIRA DOS SANTOS", em maiúsculas e sem acento, e o cadastro final sai assim | Normalizar a capitalização (João Pedro Oliveira dos Santos) antes de gravar no cadastro. |
| 11 | BAIXA | 12 a 14 | A situação continua `aguardando_equipe (atendente)` durante toda a marcação | A equipe recebe um "Quer falar com a equipe" para um assunto que o robô já está resolvendo. Na continuação extra, ao concluir, a situação passa a `resolvida`. |

### Extra (além do limite de 14, só para diagnóstico de CPF e e-mail)

Continuação A: responsável em frase longa, depois "NAO SEI O CPF DELE A MAE QUE TEM", "NAO TENHO EMAIL" e "OBRIGADA"

| # | Gravidade | Turno | O que o robô respondeu | O que a família esperava |
|---|---|---|---|---|
| 12 | MÉDIA | 15 | O responsável foi gravado como "A MAE E MINHA FILHA ROSANGELA MAS QUEM VAI LEVAR SOU EU A AVO" | Gravar só o nome, ou perguntar de novo. A frase inteira vai para `guardian_name`. |
| 13 | MÉDIA | 16 | "NAO SEI O CPF DELE A MAE QUE TEM" → "Esse CPF não confere. Pode conferir e mandar de novo, ou responder PULAR. / _Ou digite PULAR para seguir sem esse dado._" | Entender que ela não sabe e pular. "NAO SEI" sozinho funciona ("Sem problema."), mas a frase não. A instrução de PULAR aparece duas vezes seguidas, que é o que o comentário do código diz querer evitar. |
| 14 | MÉDIA (beira ALTA) | 17 | "NAO TENHO EMAIL", respondido ainda na pergunta do CPF → "Tudo bem, deixamos esse campo em branco: o Dr. Marcello completa na consulta. ✉️ Por fim, qual é o *e-mail*…" | Ela acabou de dizer que não tem e-mail e o robô pergunta o e-mail. O "deixamos em branco" fala do CPF, mas lido em seguida a "não tenho email" parece falar do e-mail. Para ela, a conversa fica sem sentido. |
| 15 | MÉDIA | 18 | "OBRIGADA" → "Esse e-mail parece incompleto." | Ela achou que tinha terminado. |

Continuação B: "NAO SEI" sozinho no CPF, depois "NAO TENHO EMAIL" na pergunta do e-mail

| # | Gravidade | Turno | O que o robô respondeu | O que a família esperava |
|---|---|---|---|---|
| 16 | MÉDIA | 17 | "NAO TENHO EMAIL" na pergunta do e-mail → "Esse e-mail parece incompleto. Pode mandar de novo, ou responder PULAR." | "Não tenho e-mail" é exatamente o caso de pular. Na tentativa seguinte o robô seguiu sozinho e concluiu o cadastro ("✅ Tudo certo… Consulta marcada!"). |

## O que funcionou bem
- Valor, forma de pagamento e recibo para reembolso vieram na primeira resposta, apesar das maiúsculas e da falta de pontuação. A idade atendida (até 19 anos) também veio certa.
- No turno 5, quando ela insistiu ("NAO E PERGUNTA EU QUERO MARCAR"), o robô ofereceu o botão "Marcar uma consulta" sem tirá-la da fila da equipe. Foi uma boa saída.
- "PODE SER DIA 23" foi entendido direto.
- A consulta entrou na agenda assim que ela escolheu o horário, e o cadastro de texto livre aceitou "DIA 10 DE MARCO DE 2011" (é proposital).

## Saída final completa do script (14 mensagens)

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
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
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
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[8] FAMÍLIA (qua., 14/10, 11:05): 2
    ROBÔ:
      🗓️ *Datas disponíveis em Livance Ibirapuera - São Paulo:*
      
      *1* sexta, 16/10 (5 horários)
      *2* sexta, 23/10 (5 horários)
      *3* sexta, 30/10 (5 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = sexta, 16/10 | 2 = sexta, 23/10 | 3 = sexta, 30/10 | 9 = Falar com a equipe | 0 = Voltar ao menu

[9] FAMÍLIA (qua., 14/10, 11:06): PODE SER DIA 23
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

[10] FAMÍLIA (qua., 14/10, 11:06): AS 14 HORAS QUE ELE SAI DA ESCOLA
    ROBÔ:
      Nesse horário temos 14:00 e 14:40.
      
      Responda com o horário exato, ou com o número da lista acima.

[11] FAMÍLIA (qua., 14/10, 11:07): 14 EM PONTO
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[12] FAMÍLIA (qua., 14/10, 11:08): 1
    ROBÔ:
      📋 Seu horário de *sexta, 23/10 às 14:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (sex., 23/10, 14:00 · Livance Ibirapuera - São Paulo · Marina)

[13] FAMÍLIA (qua., 14/10, 11:09): JOAO PEDRO OLIVEIRA DOS SANTOS
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (JOAO PEDRO OLIVEIRA DOS SANTOS)

[14] FAMÍLIA (qua., 14/10, 11:09): DIA 10 DE MARCO DE 2011
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (DIA 10 DE MARCO DE 2011)

--- estado no fim ---
Etapa do robô: dados_responsavel · Situação: aguardando_equipe (atendente)
Consultas: sex., 23/10, 14:00 Livance Ibirapuera - São Paulo [scheduled] Marina
```

## Extra A (fora do limite, rodado em /tmp: turnos 15-18)

```
[15] FAMÍLIA (qua., 14/10, 11:10): A MAE E MINHA FILHA ROSANGELA MAS QUEM VAI LEVAR SOU EU A AVO
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (A MAE E MINHA FILHA ROSANGELA MAS QUEM VAI LEVAR SOU EU A AVO)

[16] FAMÍLIA (qua., 14/10, 11:11): NAO SEI O CPF DELE A MAE QUE TEM
    ROBÔ:
      Esse CPF não confere. Pode conferir e mandar de novo, ou responder PULAR.
      
      _Ou digite PULAR para seguir sem esse dado._
      [botões] PULAR = Pular

[17] FAMÍLIA (qua., 14/10, 11:12): NAO TENHO EMAIL
    ROBÔ:
      Tudo bem, deixamos esse campo em branco: o Dr. Marcello completa na consulta.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[18] FAMÍLIA (qua., 14/10, 11:12): OBRIGADA
    ROBÔ:
      Esse e-mail parece incompleto. Pode mandar de novo, ou responder PULAR.
      
      _Ou digite PULAR para seguir sem esse dado._
      [botões] PULAR = Pular

--- estado no fim ---
Etapa do robô: dados_email · Situação: aguardando_equipe (atendente)
Consultas: sex., 23/10, 14:00 Livance Ibirapuera - São Paulo [scheduled] Marina
```

## Extra B (fora do limite, rodado em /tmp: turnos 15-18)

```
[15] FAMÍLIA (qua., 14/10, 11:10): ROSANGELA OLIVEIRA
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (ROSANGELA OLIVEIRA)

[16] FAMÍLIA (qua., 14/10, 11:11): NAO SEI
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[17] FAMÍLIA (qua., 14/10, 11:12): NAO TENHO EMAIL
    ROBÔ:
      Esse e-mail parece incompleto. Pode mandar de novo, ou responder PULAR.
      
      _Ou digite PULAR para seguir sem esse dado._
      [botões] PULAR = Pular

[18] FAMÍLIA (qua., 14/10, 11:12): OBRIGADA
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      🗓️ sexta, 23/10 às 14:00
      📍 Livance Ibirapuera - São Paulo
      Rua Agostinho Rodrigues Filho, 550, Vila Clementino - CEP 04026-040
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Paciente cadastrado no sistema (JOAO PEDRO OLIVEIRA DOS SANTOS)

--- estado no fim ---
Etapa do robô: menu · Situação: resolvida
Consultas: sex., 23/10, 14:00 Livance Ibirapuera - São Paulo [scheduled] Marina
```
