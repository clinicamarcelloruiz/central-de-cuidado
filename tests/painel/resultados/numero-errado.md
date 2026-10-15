# G2 · numero-errado

**Persona:** Seu Antônio, sem nenhuma ligação com a clínica. Recebeu uma ligação deste número. Escreve curto e meio irritado.
**Família:** `nova` · início qua. 14/10/2026, 18h00.
**Objetivo:** ser entendido (número errado) e não receber mais mensagens.

## Resultado: PARCIAL

- Entendido como número errado: sim, no turno 2. A equipe foi avisada e a conversa foi acesa na lista com "☎️ Número errado no cadastro".
- Não receber mais mensagens: ele pediu para tirarem o número da lista e não teve nenhuma confirmação. As três mensagens seguintes ficaram sem resposta, e ele desistiu dizendo que ia bloquear o número.

## Saída completa do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 18:00): quem é? recebi ligação desse número
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

[2] FAMÍLIA (qua., 14/10, 18:00): não tenho filho pequeno, deve ser engano
    ROBÔ:
      Obrigado por avisar, e desculpe o engano! 🙏 Vamos corrigir o cadastro. Se este número não é de um paciente do consultório, pode desconsiderar a mensagem.
    · bastidores: Número errado: avisou a equipe · Chamou a equipe: ☎️ Número errado no cadastro · Conversa acesa na lista: ☎️ Número errado no cadastro

[3] FAMÍLIA (qua., 14/10, 18:01): tirem meu número da lista por favor
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 60 min depois …

[4] FAMÍLIA (qua., 14/10, 19:02): e aí? vão tirar ou não
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

[5] FAMÍLIA (qua., 14/10, 19:03): vou bloquear esse número então. absurdo
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

--- estado no fim ---
Etapa do robô: atendente · Situação: aguardando_equipe (numero_errado)
Consultas: nenhuma
```

## Problemas

**MÉDIA**

- **Turnos 3, 4 e 5 · silêncio total depois de um pedido explícito.** "tirem meu número da lista por favor", "e aí? vão tirar ou não" (uma hora depois) e "vou bloquear esse número então. absurdo" tiveram todas "ROBÔ: (silêncio)" e, nos bastidores, "Ficou em silêncio: quem responde agora é a equipe". Do lado dele, o pedido foi ignorado. O esperado era uma frase curta na primeira vez, do tipo "Pedido anotado: a equipe vai tirar seu número e você não vai receber mais mensagens nossas", e, como já era depois das 18h, dizer quando a equipe vê o pedido.
- **Turnos 3 e 4 · o pedido de remoção não gerou nenhum registro próprio.** Nos bastidores não aparece nada além de "Ficou em silêncio". O único registro é o "Número errado" do turno 2. A equipe só sabe que ele quer sair da lista se ler a conversa inteira.
- **Turno 2 · não disse quando alguém vai ver.** Às 18h00 (já fora do expediente) a resposta foi "Vamos corrigir o cadastro" sem dizer quando. Por isso ele cobrou uma hora depois e não teve resposta.

**BAIXA**

- **Turno 1 · "Estamos aqui para cuidar do seu filho"** e o menu completo para quem só perguntou "quem é?". O robô se identificou ("consultório do Dr. Marcello Ruiz"), o que resolveu a pergunta, mas ignorou o "recebi ligação desse número". Uma linha como "pode ter sido nossa equipe confirmando uma consulta; se não for com você, é engano" seria mais natural.
- **Turno 2 · texto que não serve para quem nunca foi paciente.** "Vamos corrigir o cadastro" (este número não tem cadastro) e "pode desconsiderar a mensagem" (ele recebeu uma ligação, não uma mensagem).

## O que funcionou bem

- "não tenho filho pequeno, deve ser engano" foi reconhecido de primeira como número errado, com um pedido de desculpas curto.
- A equipe foi chamada e a conversa ficou marcada como "Número errado".
- Depois disso o robô não insistiu com menu nem com outras perguntas.
