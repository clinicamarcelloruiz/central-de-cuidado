# F2 · farmacia (depois das correções)

**Persona:** Carlos, farmacêutico da Drogaria São Paulo (unidade Gonzaga, Santos), escrevendo por uma cliente. Tom profissional. Quarta, 14/10, 15h.
**Família:** nova · início qua 14/10/2026 15:00 (18:00Z)
**Objetivo:** falar com alguém do consultório que confirme a dose de uma receita do Dr. Marcello (paciente Laura Mendes, letra ilegível).

## Resultado: PARCIAL

Igual ao antes. Carlos chegou à fila da equipe porque ele mesmo tocou em "Falar com a equipe" (turno 2). A conversa ficou acesa até o fim, inclusive depois de ele digitar 0 (turno 6) e de se despedir (turno 8). Mas o robô de novo não percebeu que era uma farmácia, ficou calado em quatro mensagens ao longo de uns 45 minutos e não deu o telefone pedido duas vezes. Ninguém confirmou a dose, porque a equipe não responde no simulador. Dos três problemas do relatório anterior, nenhum mudou. O que foi corrigido é a nota sobre o simulador (relógio).

## Antes x depois

- **(MÉDIA) Farmácia tratada como pai com dúvida clínica (antes no turno 1): continua.** O turno 1 saiu idêntico: "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança... Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta...". O robô tem um caminho próprio para farmácia, dentro da opção 5 ("*2* 🏥 Sou de farmácia ou laboratório"). Só que a frase livre com "Drogaria" + "receita" não leva até ele, e a resposta também não aponta para a opção 5.
- **(MÉDIA) Etiqueta genérica na lista (antes no turno 2): continua.** No turno 2, a conversa acende como "Quer falar com a equipe". No turno 7, de novo "Chamou a equipe: Quer falar com a equipe". Nada indica que é farmácia, nem que há uma cliente esperando no balcão.
- **(MÉDIA) Silêncio depois do repasse e telefone que não vem (antes nos turnos 3 a 5): continua.** Houve silêncio nos turnos 3, 4, 5 e 8 (das 15:01 às 15:45). No turno 5, "Vocês têm um telefone fixo do consultório para eu ligar?" ficou sem resposta. No turno 7, já no menu, "Qual o telefone do consultório?" recebeu "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe". Entre as respostas prontas da clínica no simulador (valor, idade, convênios, endereço, o que levar), nenhuma tem telefone. Pode ser falta de conteúdo e não de código.
- **(Nota do simulador) Aviso de horário pelo relógio real: corrigido.** No turno 2 agora sai "Atendemos de segunda a sexta, das 8h às 18h.", coerente com as 15h da simulação. Como o relógio real da máquina estava em horário comercial no momento do teste (qui 08h28), essa saída sozinha não provaria a correção. Por isso conferi à parte: o mesmo começo às 23h da simulação responde "Agora estamos fora do horário de atendimento... Alguém da equipe responde amanhã, a partir das 8h.", então o aviso segue o relógio da simulação. Em `lembrete.ts:296` a chamada `avisoDeHorario()` continua sem o relógio, mas isso não afeta esta conversa.
- **Novos turnos, que não existiam no roteiro anterior:**
  - **Turno 6:** "0" na fila mostrou o menu e a conversa continuou na fila da equipe (situação `aguardando_equipe`). Está certo.
  - **Turno 8:** a despedida teve silêncio e a conversa continuou na fila, sem ser dada como resolvida. Está certo.
  - **Turnos 6 e 7:** dois textos pequenos fora do lugar, descritos abaixo.

## Problemas que restam

### MÉDIA
- **Turno 1 · farmácia não reconhecida.** "sou da Drogaria São Paulo, estou com uma receita do Dr. Marcello ... preciso confirmar a dosagem" recebeu "Essa é uma avaliação para a consulta ... Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta". O caminho de farmácia existe na opção 5, mas a frase livre não chega a ele.
- **Turnos 2 e 7 · etiqueta "Quer falar com a equipe".** É a mesma de qualquer família, sem marca de farmácia, de receita já emitida ou de cliente esperando.
- **Turnos 3, 4, 5 e 8 · silêncio por uns 45 min, e o telefone não vem.** O pedido do turno 5 ficou sem resposta. No turno 7, "Qual o telefone do consultório?" recebeu "Não consegui entender por aqui". Para quem está no balcão, isso parece abandono.

### BAIXA
- **Turno 7 · texto repetido e fora de hora.** "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." e logo depois "Estou direcionando você para alguém da nossa equipe." Em seguida vem "Pode já escrever sua dúvida por aqui", quando Carlos já tinha escrito tudo 33 minutos antes (turno 3).
- **Turno 6 · "Estamos aqui para cuidar do seu filho."** É a saudação do menu, dirigida ao farmacêutico. É consequência de o robô não ter percebido que era farmácia.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 15:00): Boa tarde, sou da Drogaria São Paulo, estou com uma receita do Dr. Marcello da paciente Laura Mendes e preciso confirmar a dosagem do medicamento, a letra ficou ilegível
    ROBÔ:
      Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta ou *3* para falar com a equipe, ou escolha:
      
      *1* 💬 Dúvidas sobre a consulta
      *2* 🗓️ Marcar uma consulta ou retorno
      *3* 🗣️ Falar com alguém da equipe
      *4* 🔄 Ver, remarcar ou cancelar
      *5* 📄 2ª via de receita ou pedido de exame
      [lista "Ver opções"] 1 = Dúvidas sobre a consulta | 2 = Marcar uma consulta | 3 = Falar com a equipe | 4 = Minha consulta | 5 = 2ª via ou exame
    · bastidores: Mostrou o menu de opções

[2] FAMÍLIA (qua., 14/10, 15:00): [tocou] Falar com a equipe
    ROBÔ:
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Família escolheu: Falar com a equipe · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[3] FAMÍLIA (qua., 14/10, 15:01): Ok. Meu nome é Carlos, sou farmacêutico da Drogaria São Paulo (unidade Gonzaga, Santos). A receita é da paciente Laura Mendes, datada de 10/10. O medicamento parece ser domperidona suspensão mas não dá pra ler a dose nem a posologia. A mãe está aqui no balcão aguardando. Podem me confirmar?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 15 min depois …

[4] FAMÍLIA (qua., 14/10, 15:17): Boa tarde, alguém disponível? A cliente ainda está aguardando aqui na farmácia
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 10 min depois …

[5] FAMÍLIA (qua., 14/10, 15:28): Vocês têm um telefone fixo do consultório para eu ligar?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 5 min depois …

[6] FAMÍLIA (qua., 14/10, 15:33): 0
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

[7] FAMÍLIA (qua., 14/10, 15:34): Qual o telefone do consultório?
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe

  … 10 min depois …

[8] FAMÍLIA (qua., 14/10, 15:45): Tudo bem. Vou orientar a mãe a entrar em contato com vocês depois. Obrigado.
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: nenhuma
```
