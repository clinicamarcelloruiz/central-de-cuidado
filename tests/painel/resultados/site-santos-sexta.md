# site-santos-sexta

**Persona:** Juliana, 34 anos, mãe. Clicou no botão do site; escreve direitinho, com acento. Quer Santos, de preferência sexta de manhã; se não houver, aceita outro dia em Santos. Informa a data de nascimento por extenso e não sabe o CPF da filha de cabeça.

**Objetivo:** consulta marcada em Santos e cadastro feito.

**Resultado:** CONSEGUIU, com tropeços. Consulta marcada para qua., 21/10, 09:20, Livance · Santos [scheduled]; o robô disse "seu cadastro está feito" e criou o paciente (Helena Martins Costa). Doze mensagens, uma delas gasta porque o robô não entendeu o nome da unidade.

## Problemas

1. **MÉDIA · turno 2.** Ela escreveu "Santos, por favor. Vocês têm horário na sexta de manhã?" e o robô respondeu "Não entendi. Responda com o número da unidade da lista acima." O que ela esperava: que "Santos" bastasse para escolher a unidade *Livance · Santos* e que a pergunta sobre sexta fosse respondida ou ao menos guardada. Testei variações nesta mesma etapa: "Santos" sozinho, "Santos, por favor." e "Santos. Tem sexta de manhã?" receberam o mesmo "Não entendi". No código, `aguardando_unidade` só aceita número (`escolha(texto, ids.length)` em `supabase/functions/_shared/atendimento.ts`, por volta da linha 4656). Não há leitura pelo nome da unidade nesta etapa.
2. **MÉDIA · turno 2.** A resposta de "Não entendi" troca a lista tocável das unidades por um único botão "0 = Voltar ao início". Quem usa só o toque fica sem as opções e precisa rolar a conversa ou digitar o número.
3. **MÉDIA · turno 10.** Ela escreveu "Não sei o CPF dela de cabeça agora. Posso mandar depois?" e o robô respondeu "Esse CPF não confere. Pode conferir e mandar de novo, ou responder PULAR." Ela não mandou CPF nenhum. Esperava algo como "Sem problema, pode mandar depois", ou que a frase fosse lida como PULAR. O robô também não respondeu se dá para mandar o CPF depois; nem a confirmação final toca no assunto.
4. **MÉDIA · turno 8, achado no código, não na tela.** "12 de março de 2020" foi aceito sem pedir outro formato. Os bastidores mostram "Ficha da consulta: data de nascimento (12 de março de 2020)". Só que o cadastro criado no fim passa a data por `dataDeNascimentoIso` (`_shared/cadastro.ts`, linha 74), que só lê `dd/mm/aaaa` (`_shared/datas.ts`, linha 18). Resultado: o paciente fica com `birth_date` vazio, mesmo com o robô dizendo "seu cadastro está feito". A data por extenso não tem ambiguidade nenhuma: ou ela é lida, ou o robô pede "dia/mês/ano" na hora.
5. **BAIXA · turno 10.** O mesmo texto manda PULAR duas vezes ("...ou responder PULAR." e logo abaixo "_Ou digite PULAR para seguir sem esse dado._").

Observação, não é defeito do robô: a consulta aparece com contact_name "Marina", que é o nome de perfil fixo da família `nova` no simulador. A persona é Juliana.

## O que funcionou bem
- Turno 1: veio pelo site e já caiu direto na escolha de unidade ("Já separei a agenda para você"), sem menu no caminho.
- Turno 4: "Não tem nenhum horário na sexta-feira?" teve resposta direta e correta ("Nesta unidade não temos horário livre na sexta").
- Turno 5: "quarta, dia 21, de manhã" foi entendido e caiu nos horários de 21/10.
- O horário foi segurado antes do questionário ("está guardado"). As perguntas foram curtas e a confirmação final veio com data, hora e endereço.

## Saída final completa do script

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
      Não entendi. Responda com o número da unidade da lista acima.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo

[3] FAMÍLIA (qua., 14/10, 10:01): 1
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[4] FAMÍLIA (qua., 14/10, 10:02): Não tem nenhum horário na sexta-feira?
    ROBÔ:
      Nesta unidade não temos horário livre na sexta. Escolha um dos dias da lista acima.
      Digite VOLTAR para ver outra unidade, *9* se precisar de outra data, ou 0 para o início.
      [botões] VOLTAR = Outra unidade | 9 = Falar com a equipe | 0 = Voltar ao menu

[5] FAMÍLIA (qua., 14/10, 10:03): Entendi. Então pode ser na quarta, dia 21, de manhã.
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

[6] FAMÍLIA (qua., 14/10, 10:03): [tocou] 09:20
    ROBÔ:
      📋 Seu horário de *quarta, 21/10 às 09:20* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (qua., 21/10, 09:20 · Livance · Santos · Marina)

[7] FAMÍLIA (qua., 14/10, 10:04): Helena Martins Costa
    ROBÔ:
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Helena Martins Costa)

[8] FAMÍLIA (qua., 14/10, 10:05): 12 de março de 2020
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (12 de março de 2020)

[9] FAMÍLIA (qua., 14/10, 10:06): Juliana Martins Costa
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Juliana Martins Costa)

[10] FAMÍLIA (qua., 14/10, 10:06): Não sei o CPF dela de cabeça agora. Posso mandar depois?
    ROBÔ:
      Esse CPF não confere. Pode conferir e mandar de novo, ou responder PULAR.
      
      _Ou digite PULAR para seguir sem esse dado._
      [botões] PULAR = Pular

[11] FAMÍLIA (qua., 14/10, 10:07): [tocou] Pular
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[12] FAMÍLIA (qua., 14/10, 10:08): juliana.mcosta@gmail.com
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
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (juliana.mcosta@gmail.com) · Paciente cadastrado no sistema (Helena Martins Costa)

--- estado no fim ---
Etapa do robô: menu · Situação: resolvida
Consultas: qua., 21/10, 09:20 Livance · Santos [scheduled] Marina
```
