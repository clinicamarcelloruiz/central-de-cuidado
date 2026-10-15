# datas-por-extenso (depois das correções)

**Persona:** mãe que ignora as listas e responde do jeito dela ("pode ser em santos", "quarta que vem de manha", "tem 9 e 20?"). Só usa número quando o robô insiste duas vezes.
**Família:** nova · início qua 14/10/2026 10:15 (13:15Z)
**Objetivo:** marcar consulta em Santos, vendo se o robô entende unidade, data e hora escritas por extenso.

## Resultado: CONSEGUIU

Consulta marcada em Livance · Santos, qua 21/10 às 09:20, em 4 mensagens (antes eram 7) e sem nenhum "Não entendi": a mãe não precisou digitar número nenhum. A ficha saiu limpa. Conferi a tabela `patients` do banco falso no fim do roteiro: `birth_date` = 2020-03-12, `guardian_name` = "Fernanda Oliveira Prado" e `cpf` vazio, porque ela pediu para mandar depois. Fica um problema num caminho que o roteiro anterior não tinha testado. Ela disse "mando depois" e, quando mandou o CPF de fato (turno 11), o robô respondeu "Não consegui entender por aqui". O CPF não foi para o cadastro e só chegou à equipe por uma etiqueta genérica.

## Antes x depois

- **(ALTA) Data de nascimento por extenso perdida no cadastro (antes no turno 9): corrigido.** No turno 6, "12 de março de 2020" virou `birth_date` 2020-03-12 no paciente. A ficha da consulta (`intake_birth_date`) continua guardando o texto como veio, o que é o certo para a equipe ler.
- **(MÉDIA) Unidade por nome não entendida (antes nos turnos 2 e 3): corrigido.** No turno 2, "pode ser em santos" foi direto para as datas de Livance · Santos.
- **(MÉDIA) "tem 9 e 20?" não entendido (antes no turno 6): corrigido.** No turno 4, o robô marcou 09:20 direto ("Seu horário de *quarta, 21/10 às 09:20* está guardado").
- **(MÉDIA) Responsável gravado com o comentário (antes no turno 10): corrigido.** No turno 7, o bastidor mostra `responsável (Fernanda Oliveira Prado)`, e o `guardian_name` saiu igual.
- **(MÉDIA) "nao sei de cabeça, mando depois" lido como CPF errado (antes no turno 11): corrigido.** No turno 8, o robô respondeu "Sem problema." e passou para o e-mail.
- **(BAIXA) Instrução de PULAR repetida (antes no turno 11): não ocorreu.** O CPF não deu erro desta vez, então a mensagem de erro não apareceu e não deu para conferir na conversa.
- **(BAIXA) "lista acima" sem a lista (antes nos turnos 2, 3 e 6): não ocorreu.** Não houve nenhum "Não entendi" durante a marcação, então não deu para conferir.
- **"quarta que vem de manha": igual ao antes, certo.** No turno 3, caiu em 21/10. Ainda não dá para saber se o "de manha" filtra alguma coisa, porque todos os horários de Santos nesse dia são de manhã.
- **Novo problema, num caminho que o roteiro anterior não testava (turno 11):** o CPF mandado depois não é entendido. Detalhe abaixo.

## Problemas que restam

### MÉDIA
- **Turnos 8 e 11 · CPF mandado depois cai em "não entendi".** No turno 8, o robô aceitou "mando depois" com "Sem problema." e não disse como mandar depois. Três horas mais tarde, "oi, o cpf do Davi é 529.982.247-25" recebeu "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe. ... Pode já escrever sua dúvida por aqui". O CPF não entrou no cadastro (`patients.cpf` continua vazio), e a conversa acendeu na lista como "Quer falar com a equipe", sem indicar que é o CPF do Davi para completar o cadastro. O dado não se perde, porque a equipe vê a mensagem. Mas a mãe ouve "não consegui entender" para uma mensagem clara, e a recepção só descobre o que é lendo a conversa. E é um dado que o próprio robô diz ser "exigido por lei na receita digital" (turno 7).

### BAIXA
- **Turno 11 · duas frases seguidas dizendo a mesma coisa:** "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." e, logo depois, "Estou direcionando você para alguém da nossa equipe."

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 10:15): Bom dia, queria marcar uma consulta pro meu filho
    ROBÔ:
      Olá! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Já separei a agenda para você 👇 Se antes quiser saber valores ou tirar uma dúvida, digite *0* para ver todas as opções.
      
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[2] FAMÍLIA (qua., 14/10, 10:15): pode ser em santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[3] FAMÍLIA (qua., 14/10, 10:16): quarta que vem de manha
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

[4] FAMÍLIA (qua., 14/10, 10:17): tem 9 e 20?
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 09:20* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 09:20 · Livance · Santos · Marina)

[5] FAMÍLIA (qua., 14/10, 10:18): Davi Oliveira Prado
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Davi Oliveira Prado)

[6] FAMÍLIA (qua., 14/10, 10:18): 12 de março de 2020
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12 de março de 2020)

[7] FAMÍLIA (qua., 14/10, 10:19): Fernanda Oliveira Prado, sou a mae
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Fernanda Oliveira Prado)

[8] FAMÍLIA (qua., 14/10, 10:20): nao sei de cabeça, mando depois
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[9] FAMÍLIA (qua., 14/10, 10:21): fe.prado@gmail.com
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Davi Oliveira Prado
      🗓️ quarta, 21/10 às 09:20
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (fe.prado@gmail.com) · Paciente cadastrado no sistema (Davi Oliveira Prado)

[10] FAMÍLIA (qua., 14/10, 10:21): obrigada!! 🙏
    ROBÔ:
      😊 Por nada! Se precisar de algo, é só escrever *0* para ver as opções.
      [botões] 0 = Ver as opções

  … 180 min depois …

[11] FAMÍLIA (qua., 14/10, 13:22): oi, o cpf do Davi é 529.982.247-25
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: qua., 21/10, 09:20 Livance · Santos [scheduled] Marina
```
