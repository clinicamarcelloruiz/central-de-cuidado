# site-santos-sexta (depois das correções)

**Persona:** Juliana, 34 anos, mãe. Clicou no botão do site; escreve direitinho, com acento. Quer Santos, de preferência sexta de manhã; se não houver, aceita outro dia em Santos. Informa a data de nascimento por extenso e não sabe o CPF da filha de cabeça.
**Família:** nova · início qua 14/10/2026 10:00 (13:00Z)
**Objetivo:** consulta marcada em Santos e cadastro feito.

## Resultado: CONSEGUIU

Consulta marcada para qua., 21/10, 09:20, Livance · Santos [scheduled], e paciente Helena Martins Costa criada **com a data de nascimento certa** (`birth_date` 2020-03-12, conferido no banco falso do simulador), responsável e e-mail gravados, CPF em branco por escolha dela. Foram 10 mensagens (antes, 12) e nenhum "Não entendi" no caminho. O único passo a mais é o turno 3, porque a pergunta sobre a sexta, feita junto com a escolha da unidade, ficou sem resposta.

## Antes x depois

- **"Santos, por favor. Vocês têm horário na sexta de manhã?" recebia "Não entendi. Responda com o número" (antes, turno 2):** corrigido. No turno 2 de agora o robô já mostra as "Datas disponíveis em Livance · Santos".
- **O "Não entendi" trocava a lista das unidades por um botão só (antes, turno 2):** não aconteceu nesta conversa, porque não houve "Não entendi". Numa sonda à parte, fora da conversa da persona, "Guarujá" na mesma etapa recebeu "Não entendi qual unidade. Responda com o número da unidade ou escreva o nome (por exemplo, Livance · Santos)." com a lista tocável das três unidades de volta. Corrigido.
- **"Não sei o CPF dela de cabeça agora. Posso mandar depois?" recebia "Esse CPF não confere" (antes, turno 10):** corrigido. No turno 9 de agora a resposta é "Sem problema." e o robô passa ao e-mail.
- **Data por extenso aceita, mas o cadastro saía com `birth_date` vazio (antes, turno 8):** corrigido. "12 de março de 2020" (turno 7 de agora) virou `birth_date` 2020-03-12 no paciente. A ficha da consulta (`intake_birth_date`) continua guardando o texto como veio, como `datas.ts` prevê, para a equipe ler.
- **PULAR repetido duas vezes no mesmo texto (antes, turno 10):** não se repetiu, porque a mensagem de erro do CPF não apareceu desta vez.
- **Melhorou:** o comprovante final (turno 10) traz o nome da criança ("👶 Helena Martins Costa").

## Problemas que restam

1. **BAIXA · turno 2.** A pergunta "Vocês têm horário na sexta de manhã?", que veio junto com a unidade, foi ignorada. O robô mostrou só as quartas ("*1* quarta, 21/10 ... *3* quarta, 04/11") sem dizer que Santos não atende sexta, e ela precisou perguntar de novo no turno 3. Antes era igual (antes, turno 4); agora é o único passo a mais da conversa.
2. **BAIXA · turno 3.** "Nesta unidade não temos horário livre na sexta. Escolha um dos dias da lista acima." vem com os botões VOLTAR / 9 / 0 e sem a lista dos dias, então quem usa só o toque precisa rolar a conversa. E o texto diz "*9* se precisar de outra data", enquanto o botão 9 se chama "Falar com a equipe".
3. **BAIXA · turnos 9 e 10.** "Posso mandar depois?" recebe só "Sem problema.": o robô não diz como nem onde mandar o CPF depois. O comprovante final também não lembra que o CPF ficou faltando, embora a própria pergunta avise que ele "é exigido por lei na receita digital".

Observação, não é defeito do robô: a consulta aparece com contact_name "Marina", que é o nome de perfil fixo da família `nova` no simulador. A persona é Juliana.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 10:00): Olá! Vim pelo site do Dr. Marcello e gostaria de agendar uma consulta.
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

[2] FAMÍLIA (qua., 14/10, 10:00): Santos, por favor. Vocês têm horário na sexta de manhã?
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[3] FAMÍLIA (qua., 14/10, 10:01): Não tem nenhum horário na sexta-feira?
    ROBÔ:
      Nesta unidade não temos horário livre na sexta. Escolha um dos dias da lista acima.
      Digite VOLTAR para ver outra unidade, *9* se precisar de outra data, ou 0 para o início.
      [botões] VOLTAR = Outra unidade | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (qua., 14/10, 10:02): Entendi. Então pode ser na quarta, dia 21, de manhã.
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

[5] FAMÍLIA (qua., 14/10, 10:03): [tocou] 09:20
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 09:20* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 09:20 · Livance · Santos · Marina)

[6] FAMÍLIA (qua., 14/10, 10:03): Helena Martins Costa
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Helena Martins Costa)

[7] FAMÍLIA (qua., 14/10, 10:04): 12 de março de 2020
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12 de março de 2020)

[8] FAMÍLIA (qua., 14/10, 10:05): Juliana Martins Costa
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Juliana Martins Costa)

[9] FAMÍLIA (qua., 14/10, 10:06): Não sei o CPF dela de cabeça agora. Posso mandar depois?
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[10] FAMÍLIA (qua., 14/10, 10:06): juliana.mcosta@gmail.com
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Helena Martins Costa
      🗓️ quarta, 21/10 às 09:20
      📍 Livance · Santos
      Av. Anna Costa, 228, 20º andar, Gonzaga, Santos - SP
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (juliana.mcosta@gmail.com) · Paciente cadastrado no sistema (Helena Martins Costa)

--- estado no fim ---
Etapa do robô: menu · Situação: resolvida
Consultas: qua., 21/10, 09:20 Livance · Santos [scheduled] Marina
```
