# F2 · farmacia

**Persona:** Carlos, farmacêutico da Drogaria São Paulo (unidade Gonzaga, Santos), escrevendo por uma cliente. Tom profissional. Quarta, 14/10, 15h.
**Objetivo:** falar com alguém do consultório que confirme a dose de uma receita do Dr. Marcello (paciente Laura Mendes, letra ilegível).

**Resultado:** PARCIAL. Ele chegou à equipe, porque ele mesmo tocou em "Falar com a equipe" (turno 2), e a conversa acendeu na lista. O robô não percebeu que não era uma família: a primeira resposta foi a frase clínica para pais. Depois do repasse, o robô não confirmou nada e o telefone pedido não veio (silêncio nos turnos 3 a 5, uns 28 minutos). Ninguém confirmou a receita durante a simulação, já que a equipe não responde no simulador.

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
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
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

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (atendente)
Consultas: nenhuma
```

## Problemas

1. **MÉDIA · turno 1.** "Sou da Drogaria São Paulo ... preciso confirmar a dosagem do medicamento, a letra ficou ilegível" teve como resposta "Essa é uma avaliação para a consulta: é lá que o Dr. Marcello examina a criança e decide o que precisa investigar. Por aqui eu não posso orientar sobre sintomas, exames ou remédios. Se for urgente, digite *URGÊNCIA*. Digite *2* para marcar uma consulta..." O robô tratou um profissional de farmácia como um pai com dúvida clínica e ofereceu marcar consulta e URGÊNCIA, que não têm nada a ver. Esperado: perceber "farmácia/drogaria" + "receita" e ir direto para a equipe ("Vou passar para a equipe confirmar com o Dr. Marcello"), com uma etiqueta própria. A confirmação de dose é exatamente o tipo de assunto que deve ir para um humano, e quem levou para lá foi o Carlos, não o robô.
2. **MÉDIA · turno 2 (bastidores).** A conversa entrou na lista como "Quer falar com a equipe", igual a qualquer família, sem marca de que é farmácia ou de que é sobre uma receita já emitida. A equipe só descobre lendo o histórico. A clínica não perde o pedido, mas ele também não ganha prioridade, mesmo com o cliente esperando no balcão.
3. **MÉDIA · turnos 3, 4 e 5.** Três mensagens em ~28 min, incluindo "A mãe está aqui no balcão aguardando" e "Vocês têm um telefone fixo do consultório para eu ligar?", e nenhuma resposta: (silêncio) nos três turnos. É a regra de não falar por cima da equipe, mas, para quem está no balcão, o silêncio parece abandono. O telefone, que é uma informação fixa, também não veio. Esperado: um aviso curto na primeira mensagem depois do repasse ("Recebido, já está com a equipe") ou, pelo menos, o telefone do consultório quando pedido.

## Nota sobre o simulador (não é defeito do robô em produção)

No turno 2 o robô disse "Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h." numa quarta às 15h. Isso vem do simulador. `avisoDeHorario()` é chamada sem o `agora` em `atendimento.ts:1547` (e em 851, 1588, 3563, 3846, 4120, 4226, 4381, 4457 e `lembrete.ts:289`), então usa o relógio real da máquina e não o relógio fixo da simulação. Quando rodei, eram 00h34 de quinta em São Paulo. Em produção os dois relógios são o mesmo e às 15h viria "Atendemos de segunda a sexta, das 8h às 18h.". Duas consequências para o painel: essa frase muda conforme a hora em que o script roda (a saída deixa de ser reproduzível, como o cabeçalho do `conversar.mjs` promete), e qualquer família simulada em horário comercial pode receber "fora do horário". Só `urgenciaForaDoExpediente` (linha 2212) recebe o `agora`. Por isso o Carlos não reagiu a essa frase.

## O que funcionou bem

O repasse pela opção 3 é imediato e diz o que fazer enquanto se espera ("Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder"). A conversa acendeu na lista. O robô não tentou responder sobre a dose nem sobre o remédio, que é o correto: confirmar receita é com o médico.
