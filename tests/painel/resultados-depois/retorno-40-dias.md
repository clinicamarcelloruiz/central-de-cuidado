# H1 · retorno-40-dias, depois das correções

**Persona:** Marina, mãe da Helena (paciente já cadastrada). Escreve numa quarta, 10h45, do celular, sem paciência para menu. O Dr. Marcello pediu retorno em uns 40 dias (fim de novembro).

**Família:** `cadastrada` (identidade `marcello`).

**Início:** 2026-10-14T13:45:00Z (qua., 10h45), igual à rodada anterior.

**Objetivo:** deixar o retorno de fim de novembro encaminhado (marcado ou anotado com a equipe), sem marcar uma data que não serve.

## Resultado: CONSEGUIU

Já no turno 1 o robô reconheceu o retorno além da agenda: "🗓️ Anotei seu pedido de retorno para *novembro*. Nossa agenda abre só 21 dias à frente, então esse horário a nossa equipe reserva para você e confirma a data por aqui." A conversa foi para `aguardando_equipe`, acesa na lista, com o evento "Retorno além da agenda aberta: anotado para a equipe". No turno 2 a Marina completou sozinha (Santos, de manhã, dia 25 ou a semana seguinte) e o robô ficou calado, como deve, inclusive 90 min depois (turno 3). Nada foi marcado. Foram 3 mensagens da família; antes foram 7, com dois "Não entendi" e uma saída que ela só achou porque lembrou do "9". Como na rodada anterior, a resposta da equipe não foi simulada.

## Antes x depois

- **ALTA · turnos 3 e 4 (antes): laço de "Não entendi" na lista de dias, sem a opção 9.** **Corrigido.** Não apareceu na conversa principal (o robô nem abriu a agenda). Sonda pelo caminho da agenda ("quero marcar o retorno da Helena" → Santos): "e pro dia 25 de novembro?" e "mas nenhuma dessas serve, ela tem q voltar so no fim de novembro. nao tem data mais pra frente?" recebem as duas "Anotei seu pedido de retorno para *novembro*". Uma frase sem mês ("nao tem mais pra frente?") ainda recebe "Não entendi", mas agora o texto mantém "*9* se precisar de uma data mais distante" e vem com os botões "Outra unidade | Data mais distante | Voltar ao menu".
- **MÉDIA · turno 1 (antes): "daqui uns 40 dias, mais ou menos no fim de novembro" abria a agenda comum.** **Corrigido** (turno 1). Sondas: "a Helena tem que voltar no fim de novembro, como faço pra marcar?" e "o dr pediu retorno em 40 dias" também são reconhecidas.
- **BAIXA · turno 5 (antes): o 9 / "data mais distante" leva a um encaminhamento genérico.** **Ainda acontece** (só em sonda): o toque em "Data mais distante" responde "Estou direcionando você para alguém da nossa equipe." e registra "Chamou a equipe: Quer falar com a equipe". Na conversa principal o evento certo é registrado ("Retorno além da agenda aberta"), mas a conversa acende na lista com o mesmo rótulo genérico, "Quer falar com a equipe".
- **BAIXA · turno 1 (antes): "Olá, Helena!" para a mãe.** Não aparece na conversa principal (a resposta do retorno não tem saudação). **Ainda acontece** no caminho comum da agenda (sonda: "Olá, Helena! 👋 ... Em qual unidade você prefere ser atendido?").
- **Artefato do simulador (aviso de horário pelo relógio da máquina).** **Corrigido.** Às 10h45 de quarta sai "Atendemos de segunda a sexta, das 8h às 18h."; numa sonda às 22h30 sai "Agora estamos fora do horário ... Alguém da equipe responde amanhã, a partir das 8h." O aviso agora segue o relógio do roteiro.

## Problemas que restam

1. **BAIXA · turno 1 · a resposta do retorno não pede o que a equipe vai precisar.** "Anotei seu pedido de retorno para *novembro*. ... esse horário a nossa equipe reserva para você e confirma a data por aqui." O texto não pergunta unidade nem período e não diz que dá para escrever a preferência (o encaminhamento genérico diz "Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo"). "esse horário" fala de um horário que ninguém escolheu, e "fim de novembro" vira só "novembro". A Marina mandou os detalhes por conta própria no turno 2 e recebeu silêncio, sem saber se alguém leu. Uma mãe menos ativa pararia ali, e a equipe teria que perguntar a unidade.
2. **BAIXA · turno 1 · rótulo genérico na lista da equipe.** "Conversa acesa na lista: Quer falar com a equipe", sendo que o robô já sabe que é um retorno distante (o evento "Retorno além da agenda aberta" está registrado ao lado). Quem olha a lista não sabe que é uma reserva de retorno sem abrir a conversa.
3. **BAIXA · sonda (lista de dias, toque em "Data mais distante") · encaminhamento genérico.** "Estou direcionando você para alguém da nossa equipe." com o motivo "Quer falar com a equipe", em vez de registrar que ela precisa de uma data fora da agenda.
4. **BAIXA · sonda (caminho comum da agenda), turno 1 · saudação com o nome da criança.** "Olá, Helena! 👋".

Sem resposta da equipe no roteiro, o silêncio do turno 3 (90 min depois, dentro do horário) depende de a equipe atender. O robô não tem culpa nisso.

## Saída final do script

`node tests/painel/conversar.mjs tests/painel/familias-depois/retorno-40-dias.json`

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Paciente cadastrada (Helena já é paciente: o robô chama pelo nome e não pede o cadastro de novo.)

[1] FAMÍLIA (qua., 14/10, 10:45): bom dia, o dr marcello pediu pra Helena voltar daqui uns 40 dias, mais ou menos no fim de novembro, consigo marcar ja?
    ROBÔ:
      🗓️ Anotei seu pedido de retorno para *novembro*.
      
      Nossa agenda abre só 21 dias à frente, então esse horário a nossa equipe reserva para você e confirma a data por aqui.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Retorno além da agenda aberta: anotado para a equipe · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[2] FAMÍLIA (qua., 14/10, 10:45): ok. em santos, de manha, tipo dia 25 ou a semana depois
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 90 min depois …

[3] FAMÍLIA (qua., 14/10, 12:16): oi, conseguem ver pra mim?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: nenhuma
```
