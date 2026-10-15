# G2 · numero-errado (depois das correções)

**Persona:** Seu Antônio, sem nenhuma ligação com a clínica. Recebeu uma ligação deste número. Escreve curto e meio irritado.
**Família:** `nova` · início qua. 14/10/2026, 18h00.
**Objetivo:** ser entendido (número errado) e não receber mais mensagens.

## Resultado: PARCIAL

No simulador a conversa saiu idêntica à de antes, palavra por palavra. Ele foi entendido como número errado no turno 2, e os três pedidos seguintes (turnos 3, 4 e 5) continuaram sem resposta. A correção do pedido de remoção foi feita fora do robô: em `interpretarResposta` (`_shared/lembrete.ts`, que agora reconhece "tirem meu número") e no `meta-webhook`, que passou a responder "Pronto, retiramos este número: não vamos mais enviar mensagens. Desculpe o incômodo. 🙏" a quem não é paciente. **O simulador não passa por esse caminho**, então o painel não consegue mostrar a correção. Conferi a regra sozinha (`tests/lembrete.build.mjs`, gerado às 08:11 de 15/10): "tirem meu número da lista por favor" dá `optedOut = true`, e "e aí? vão tirar ou não" e "vou bloquear esse número então. absurdo" dão `false`. Em produção, portanto, o turno 3 deve receber a confirmação e a conversa deve ficar `opted_out`. Isso vem da leitura do código e não de uma conversa reproduzida, e a remoção não se sustenta se ele escrever de novo (ver "Problemas que restam", item 2).

## Antes x depois

- **Turnos 3, 4 e 5 · silêncio depois do pedido explícito** → no simulador, **continua igual**: os três turnos têm "ROBÔ: (silêncio)". Em produção o turno 3 **provavelmente está corrigido** pela confirmação do webhook, mas isso não foi reproduzido. Os turnos 4 e 5 continuariam em silêncio, porque nenhum dos dois é reconhecido como pedido de remoção.
- **Turnos 3 e 4 · o pedido de remoção não gerava registro próprio** → **em parte**. Em produção, a conversa passa para o status `opted_out`. Não há etiqueta nem motivo de atenção próprio ("pediu para sair"): a conversa continua acesa só como "☎️ Número errado no cadastro". No simulador, os bastidores mostram apenas "Ficou em silêncio: quem responde agora é a equipe".
- **Turno 2 · não diz quando alguém vai ver** → **continua**. O texto é idêntico e nada diz que, às 18h00, a equipe só vê o pedido no dia seguinte.
- **Turno 1 · "Estamos aqui para cuidar do seu filho" e o menu completo para "quem é?"** → **continua** (texto idêntico).
- **Turno 2 · "Vamos corrigir o cadastro" e "pode desconsiderar a mensagem" para quem nunca foi paciente e recebeu uma ligação** → **continua** (texto idêntico).
- **Novo (leitura de código, não reproduzido) · a remoção é desfeita pela mensagem seguinte.** O `meta-webhook` grava `status: optedOut ? 'opted_out' : 'open'` em toda mensagem que chega (linhas 752 e 764). Por isso, depois do turno 3, o "e aí? vão tirar ou não" do turno 4 (ou um simples "ok") devolve a conversa para `open`. O `appointment-reminders` (linha 219) só pula conversa `opted_out`. Para quem não é paciente, nada mais guarda a remoção: o `whatsapp_opt_out_at` só é gravado quando há `patient.id` (linha 808).

## Problemas que restam

1. **Turnos 3, 4 e 5 · o painel não cobre o pedido de remoção.** No simulador, "tirem meu número da lista por favor", "e aí? vão tirar ou não" e "vou bloquear esse número então. absurdo" recebem "ROBÔ: (silêncio)". A correção existe no webhook, mas o simulador não roda `interpretarResposta` nem a confirmação de remoção, então nenhuma família do painel consegue prová-la. Os turnos 4 e 5, mesmo em produção, não recebem nada.
2. **Turno 4 (código) · remoção volta para `open`.** Em produção, qualquer mensagem depois da confirmação que não repita o pedido ("e aí? vão tirar ou não", "ok", "obrigado") troca `opted_out` por `open` (`meta-webhook`, linhas 752 e 764). A partir daí os lembretes voltam a valer para esse número.
3. **Turno 2 · sem prazo e com texto de paciente.** "Vamos corrigir o cadastro. Se este número não é de um paciente do consultório, pode desconsiderar a mensagem." Às 18h00 o texto não diz quando a equipe vê o pedido, fala em cadastro que ele não tem e em "mensagem" quando ele recebeu uma ligação.
4. **Turno 1 · menu de paciente para quem perguntou "quem é?".** "Estamos aqui para cuidar do seu filho. Como podemos ajudar hoje?" e as cinco opções, ignorando o "recebi ligação desse número".

## Saída final do script

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
