# datas-por-extenso

**Persona:** mãe que ignora as listas e responde do jeito dela ("pode ser em santos", "quarta que vem de manha", "tem 9 e 20?"). Só usa número quando o robô insiste duas vezes.
**Família:** nova · início qua 14/10/2026 10:15 (13:15Z)
**Objetivo:** marcar consulta em Santos, vendo se o robô entende unidade, data e hora escritas por extenso.

## Resultado: CONSEGUIU

Consulta marcada em Livance · Santos, qua 21/10 às 09:20, ficha completa (CPF pulado) e cadastro criado. Mas a unidade escrita por extenso não foi entendida (precisou do número), uma das duas formas de hora também não, e o cadastro sai com dois campos estragados.

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
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[3] FAMÍLIA (qua., 14/10, 10:16): santos por favor
    ROBÔ:
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[4] FAMÍLIA (qua., 14/10, 10:17): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 10:18): quarta que vem de manha
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

[6] FAMÍLIA (qua., 14/10, 10:18): tem 9 e 20?
    ROBÔ:
      Não entendi. Responda com o número do horário da lista acima.
      Digite VOLTAR para escolher outro dia, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[7] FAMÍLIA (qua., 14/10, 10:19): as 9:20 pode ser
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 09:20* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 09:20 · Livance · Santos · Marina)

[8] FAMÍLIA (qua., 14/10, 10:20): Davi Oliveira Prado
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Davi Oliveira Prado)

[9] FAMÍLIA (qua., 14/10, 10:21): 12 de março de 2020
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12 de março de 2020)

[10] FAMÍLIA (qua., 14/10, 10:21): Fernanda Oliveira Prado, sou a mae
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Fernanda Oliveira Prado, sou a mae)

[11] FAMÍLIA (qua., 14/10, 10:22): nao sei de cabeça, mando depois
    ROBÔ:
      Esse CPF não confere. Pode conferir e mandar de novo, ou responder PULAR.
      
      _Ou digite PULAR para seguir sem esse dado._
      [botões] PULAR = Pular

[12] FAMÍLIA (qua., 14/10, 10:23): [tocou] Pular
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[13] FAMÍLIA (qua., 14/10, 10:24): fe.prado@gmail.com
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      🗓️ quarta, 21/10 às 09:20
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (fe.prado@gmail.com) · Paciente cadastrado no sistema (Davi Oliveira Prado)

[14] FAMÍLIA (qua., 14/10, 10:24): obrigada!! 🙏
    ROBÔ:
      😊 Por nada! Se precisar de algo, é só escrever *0* para ver as opções.
      [botões] 0 = Ver as opções

--- estado no fim ---
Etapa do robô: menu · Situação: robo
Consultas: qua., 21/10, 09:20 Livance · Santos [scheduled] Marina
```

## Problemas

### ALTA
- **Turno 9 · data de nascimento por extenso aceita, mas perdida no cadastro.** "12 de março de 2020" foi aceito sem comentário (bastidor: `data de nascimento (12 de março de 2020)`), e no turno 13 o robô diz "seu cadastro está feito". Pelo código (`cadastro.ts` → `dataDeNascimentoIso` em `datas.ts`), só dd/mm/aaaa vira data: o paciente "Davi Oliveira Prado" nasce com `birth_date` vazio. É uma decisão consciente para textos vagos ("março de 2019"), mas aqui a data é inequívoca e a família não fica sabendo. O próprio `datas.ts` lembra que sem data de nascimento a Memed recusa a receita. Esperado: converter "12 de março de 2020", ou pedir "pode mandar assim: 12/03/2020?".

### MÉDIA
- **Turnos 2 e 3 · unidade por nome não entendida.** "pode ser em santos" e "santos por favor" receberam as duas vezes "Não entendi. Responda com o número da unidade da lista acima." Causa no código (`unidadePeloNome`): toda palavra com 3+ letras precisa estar no nome da unidade, então "pode", "ser" e "favor" derrubam o "santos". Só "santos" sozinho passaria. Esperado: reconhecer Santos na frase (é a única unidade com essa palavra).
- **Turno 6 · "tem 9 e 20?" não entendido.** "Não entendi. Responda com o número do horário da lista acima." O 09:20 estava na lista. No turno 7, "as 9:20 pode ser" funcionou, então só a forma "9 e 20" (muito comum falada) falha. Esperado: marcar 09:20 (ou perguntar "09:20, certo?").
- **Turno 10 · nome do responsável gravado com o comentário.** "Fernanda Oliveira Prado, sou a mae" → bastidor `responsável (Fernanda Oliveira Prado, sou a mae)`; vai assim para `patients.guardian_name`. Esperado: "Fernanda Oliveira Prado".
- **Turno 11 · "nao sei de cabeça, mando depois" lido como CPF errado.** Resposta: "Esse CPF não confere. Pode conferir e mandar de novo, ou responder PULAR." A mãe não mandou CPF nenhum; a função `pulou()` só aceita a frase exata ("nao sei", "depois"...). Esperado: entender como pular, ou "Sem problema, pode mandar depois".

### BAIXA
- **Turno 11 · instrução de pular dita duas vezes seguidas:** "...ou responder PULAR." e logo abaixo "_Ou digite PULAR para seguir sem esse dado._" (o comentário do código sobre o CPF diz justamente que duas instruções coladas fazem a pessoa parar de ler).
- **Turnos 2, 3 e 6 · "lista acima" sem a lista:** a mensagem de erro traz só o botão "Voltar ao início"; para tocar na unidade/horário a mãe precisa rolar até a lista antiga. Reenviar a lista (ou os botões) junto do "Não entendi" ajudaria quem não lê lista.

## O que funcionou bem
- "Bom dia, queria marcar uma consulta pro meu filho" foi direto para a escolha de unidade, sem passar pelo menu.
- "quarta que vem de manha" caiu certo em 21/10 (todos os horários de Santos nesse dia são de manhã, então não deu para ver se o "de manha" filtra).
- "as 9:20 pode ser" marcou 09:20 direto. O "9" de "tem 9 e 20?" não foi confundido com a opção 9 (falar com a equipe).
- O resumo final traz dia, hora, unidade e endereço completo, e o "obrigada" recebeu uma resposta curta.
