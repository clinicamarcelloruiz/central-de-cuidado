# H1 · retorno-40-dias

**Persona:** Marina, mãe da Helena (paciente já cadastrada). Escreve numa quarta, 10h45, do celular, sem paciência para menu. O Dr. Marcello pediu retorno em ~40 dias (fim de novembro).

**Objetivo:** deixar o retorno de fim de novembro encaminhado (marcado ou anotado com a equipe), sem marcar uma data que não serve.

**Resultado: parcial.** Nada foi marcado errado e o pedido chegou à equipe (situação `aguardando_equipe`, conversa acesa na lista, o recado com "Santos, fim de novembro, dia 25 ou semana depois, de manhã" ficou escrito). Mas o robô não reconheceu o pedido de retorno distante, ofereceu só datas de outubro/início de novembro, respondeu "Não entendi" duas vezes a pedidos claros, e a mãe só saiu porque lembrou do "9 se precisar de uma data mais distante" de duas mensagens antes. Nenhuma resposta da equipe dentro do roteiro (a equipe não foi simulada).

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 10:45): bom dia, o dr marcello pediu pra Helena voltar daqui uns 40 dias, mais ou menos no fim de novembro, consigo marcar ja?
    ROBÔ:
      Olá, Helena! 👋 Aqui é o consultório do Dr. Marcello Ruiz, Gastroenterologista Pediátrico.
      
      Já separei a agenda para você 👇 Se antes quiser saber valores ou tirar uma dúvida, digite *0* para ver todas as opções.
      
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Marcar uma consulta

[2] FAMÍLIA (qua., 14/10, 10:45): [tocou] Livance · Santos
    ROBÔ:
      🗓️ *Datas disponíveis em Livance · Santos:*
      
      *1* quarta, 21/10 (6 horários)
      *2* quarta, 28/10 (6 horários)
      *3* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      [lista "Escolher o dia"] 1 = quarta, 21/10 | 2 = quarta, 28/10 | 3 = quarta, 04/11 | 9 = Falar com a equipe | 0 = Voltar ao menu

[3] FAMÍLIA (qua., 14/10, 10:46): e pro dia 25 de novembro?
    ROBÔ:
      Não entendi. Responda com o número do dia da lista acima.
      Digite VOLTAR para escolher outra unidade, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[4] FAMÍLIA (qua., 14/10, 10:47): mas nenhuma dessas serve, ela tem q voltar so no fim de novembro. nao tem data mais pra frente?
    ROBÔ:
      Não entendi. Responda com o número do dia da lista acima.
      Digite VOLTAR para escolher outra unidade, ou 0 para o início.
    · bastidores: Não entendeu a resposta e explicou de novo

[5] FAMÍLIA (qua., 14/10, 10:48): [tocou] Falar com a equipe
    ROBÔ:
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[6] FAMÍLIA (qua., 14/10, 10:48): oi! queria marcar o retorno da Helena em Santos pro fim de novembro, tipo dia 25 ou a semana depois. o dr pediu uns 40 dias. pode ser qualquer horario de manha
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 90 min depois …

[7] FAMÍLIA (qua., 14/10, 12:19): oi, conseguem ver pra mim?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: nenhuma
```

## Problemas

1. **ALTA · turnos 3 e 4 · laço de "Não entendi" sem a saída certa.** A mãe pediu "e pro dia 25 de novembro?" e depois "nenhuma dessas serve, ela tem q voltar so no fim de novembro. nao tem data mais pra frente?". As duas vezes o robô respondeu igual: "Não entendi. Responda com o número do dia da lista acima. Digite VOLTAR para escolher outra unidade, ou 0 para o início." A mensagem de erro **tira** a opção "*9* se precisar de uma data mais distante", que era justamente a saída para ela. Esperado: entender "25 de novembro" / "mais pra frente" como data além da agenda e passar para a equipe (o robô já tem essa resposta pronta: "Anotei seu pedido de retorno para *novembro*... a equipe reserva"), ou ao menos manter o "9" no texto de erro. Uma mãe menos atenta marcaria 04/11 (data que não serve) ou desistiria.

2. **MÉDIA · turno 1 · pedido de retorno distante não reconhecido.** "o dr marcello pediu pra Helena voltar daqui uns 40 dias, mais ou menos no fim de novembro" abriu a agenda comum ("Já separei a agenda para você 👇"), que só vai até 04/11. É o mesmo caso do Ben (05/10, comentário de `retornoAlemDaAgenda` em `supabase/functions/_shared/atendimento.ts`). Conferido no código: a regex de `retornoAlemDaAgenda` exige o número colado em "daqui" e só aceita mês/semana/ano. "daqui **uns** 40 **dias**" falha nas duas coisas, e nome de mês ("fim de novembro", "25 de novembro") não é lido. Esperado: "Anotei seu pedido de retorno para novembro..." já no primeiro turno.

3. **BAIXA · turno 5 · encaminhamento genérico.** Ao tocar 9 na lista de dias (anunciado como "se precisar de uma data mais distante"), o robô respondeu o texto genérico "Estou direcionando você para alguém da nossa equipe" e o motivo gravado foi "Quer falar com a equipe". Esperado: algo como "Anotei que você precisa de uma data mais distante" e o motivo na lista dizer isso (a equipe só sabe o que é lendo a conversa inteira).

4. **BAIXA · turno 1 · chama a mãe pelo nome da criança.** "Olá, Helena! 👋 ... Em qual unidade você prefere ser atendido?" Quem escreve é a Marina (responsável cadastrada em `guardian_name`); Helena tem 5 anos. Esperado: "Olá, Marina!" ou "Olá! Vamos marcar o retorno da Helena".

## Artefato do simulador (não é defeito do robô)

- **Turno 5:** "Agora estamos fora do horário de atendimento ... Alguém da equipe responde hoje, a partir das 8h", numa quarta às 10h48 simulada. `avisoDeHorario()` é chamado sem a data (`atendimento.ts`, várias linhas) e usa o relógio real da máquina (qui 15/10, 00h28 quando rodou), não o relógio do roteiro. Em produção as duas horas coincidem, então o texto sairia certo. Mas todo encaminhamento do painel vai mostrar esse texto até o simulador passar o relógio para `avisoDeHorario`.

## O que funcionou bem

Não marcou nada errado. Depois do 9 ficou calado de verdade (turnos 6 e 7, inclusive 90 min depois), sem falar por cima da equipe, e a conversa ficou acesa na lista com o recado completo da mãe.
