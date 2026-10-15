# telemedicina-longe (depois das correções)

**Persona:** mãe que mora em Campinas, longe das unidades. Escreve normal, com algumas abreviações ("vcs", "q", "kkk"). Mistura toque e texto.
**Família:** nova · início qua 14/10/2026 14:00 (17:00Z)
**Objetivo:** entender como funciona a consulta online (como é, quanto custa, e se precisar examinar presencial) e marcar telemedicina.

## Resultado: PARCIAL

A marcação agora fecha: telemedicina na sex., 16/10, 16:00 (`modality` telemedicina), com o cadastro completo e limpo. O paciente Lucas Ferreira Campos saiu com `birth_date` 2022-05-03, responsável e e-mail gravados e CPF para depois. Valor (R$ 450) e regra do retorno presencial continuam vindo do texto fixo de "Dúvidas > Telemedicina". O "como funciona" segue sem resposta: as três perguntas digitadas sobre consulta online e aplicativo (turnos 2, 6 e 17) caíram em "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe", e no fim ela ainda não sabe se precisa baixar algum app. Foram 17 mensagens; a 17ª passou do limite de propósito, para ver se a dúvida do app tinha resposta depois da marcação.

## Antes x depois

- **O nome da criança era gravado com a data junto (antes, turno 13):** corrigido. No turno 13 de agora, a mesma frase gera "nome da criança (Lucas Ferreira Campos) · data de nascimento (03/05/2022)".
- **A data de nascimento era pedida de novo e se perdia no cadastro (antes, turno 14):** corrigido. A pergunta da data foi pulada (do nome o robô foi direto ao responsável) e o paciente nasceu com `birth_date` 2022-05-03.
- **A pergunta do primeiro contato era ignorada (antes, turno 1):** continua igual. No turno 1 de agora vem só o menu.
- **"vcs fazem consulta online?" ia para a fila da equipe (antes, turno 2):** continua igual no turno 2 de agora.
- **"como funciona? precisa baixar algum app?" ia para a fila da equipe (antes, turno 6):** continua igual no turno 6, e de novo no turno 17.
- **"quero marcar a consulta online" perguntava a unidade (antes, turno 9):** continua igual no turno 9. O apelido "online" foi ensinado só para a resposta à pergunta "Em qual unidade?", não para o pedido inicial.
- **A conversa ficava "aguardando_equipe" até o fim (antes, turno 2):** mudou. Ela fica acesa enquanto a mãe marca sozinha (turnos 2 a 15) e é fechada como "resolvida" ao terminar a ficha (turno 16). Esse fechamento criou um problema novo, o item 4 da lista abaixo.
- **Frase antiga de horário no texto da telemedicina (antes, turno 5, BAIXA):** continua igual no turno 5.
- **Texto longo da telemedicina (antes, turno 5, BAIXA):** continua igual.
- **O simulador dizia "fora do horário" numa quarta às 14h (antes, turnos 2 e 6):** corrigido. Agora sai "Atendemos de segunda a sexta, das 8h às 18h." nos turnos 2, 6 e 17.
- **As mensagens acabavam no meio da ficha (antes, turno 14):** agora a ficha termina no turno 16, com um comprovante que traz o nome da criança e "💻 Telemedicina, por vídeo. O link da consulta chega aqui pelo WhatsApp antes do horário."

## Problemas que restam

1. **MÉDIA · turno 1.** "Oi boa tarde! vcs fazem consulta online? moro em Campinas" recebe só o menu ("Como podemos ajudar hoje? *1* 💬 Dúvidas sobre a consulta ..."), sem nenhuma palavra sobre a consulta online.
2. **MÉDIA · turno 2.** "vcs fazem consulta online?" recebe "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." O robô tem a resposta (Dúvidas > Telemedicina), mas não liga "online" a telemedicina fora da etapa da unidade.
3. **MÉDIA · turnos 6 e 17.** "como funciona? precisa baixar algum app?" e "precisa baixar algum app pra chamada?" recebem o mesmo "Não consegui entender por aqui...". Nenhum texto do robô diz se é preciso instalar algum aplicativo: o turno 5 e o comprovante dizem só que o link chega pelo WhatsApp.
4. **MÉDIA · turno 16 (novo, não aparecia antes porque a conversa anterior parou no meio da ficha).** Ao terminar a ficha, o robô marca a conversa como "resolvida" ("Atendimento concluído sem precisar de ninguém") e apaga a bandeira da equipe que os turnos 2 e 6 tinham acendido. Com isso, a pergunta do app (turno 6) sai da fila sem ninguém ter respondido. Ela só voltou à fila porque a mãe perguntou de novo no turno 17. Em produção é igual: `meta-webhook/index.ts` (por volta da linha 944) zera `needs_attention` quando o resultado é "concluída" sem atenção nova.
5. **BAIXA · turno 9.** "quero marcar a consulta online" recebe "📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?", um passo a mais para quem já disse "online".
6. **BAIXA · turno 5.** A resposta pronta da telemedicina ainda traz "⏰ Segunda a sexta, 8h às 18h. Fora desse horário, respondemos no próximo dia útil.", a frase que o `expediente.ts` aposentou (ela vem do banco).
7. **BAIXA · turnos 15 e 16.** "ih nao sei de cabeça, depois eu mando" recebe só "Sem problema.", sem dizer como mandar o CPF depois. O comprovante também não lembra que o CPF ficou faltando, e na telemedicina a receita é sempre digital, o tipo de receita que a pergunta diz exigir CPF.

Observação, não é defeito: no estado final, a consulta aparece como "Livance Ibirapuera - São Paulo". É o previsto pelo código: sem agenda própria, a telemedicina usa o horário da unidade física com `modality = telemedicina`, e o comprovante diz "Telemedicina, por vídeo". O contact_name "Marina" é o perfil fixo da família `nova` no simulador. O silêncio do turno 7, com a conversa na mão da equipe, está correto.

## Saída final do script

```
Clínica: Dr. Marcello Ruiz (clínica real) · Família: Família nova (Primeiro contato: ninguém cadastrado com este número.)

[1] FAMÍLIA (qua., 14/10, 14:00): Oi boa tarde! vcs fazem consulta online? moro em Campinas
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

[2] FAMÍLIA (qua., 14/10, 14:00): vcs fazem consulta online?
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe · Conversa acesa na lista: Quer falar com a equipe

[3] FAMÍLIA (qua., 14/10, 14:01): [tocou] Voltar ao início
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

[4] FAMÍLIA (qua., 14/10, 14:02): [tocou] Dúvidas sobre a consulta
    ROBÔ:
      💬 Para qual atendimento você quer informações?
      
      *1* Livance · Santos
      *2* Livance Ibirapuera - São Paulo
      *3* Telemedicina (por vídeo)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu
    · bastidores: Família escolheu: Dúvidas sobre a consulta

[5] FAMÍLIA (qua., 14/10, 14:03): [tocou] Telemedicina (por vídeo)
    ROBÔ:
      💙 *Telemedicina: R$ 450,00.* Inclui um retorno presencial em até 30 dias, em Santos ou São Paulo.
      
      💳 Pagamento por pix. Não atendemos convênio, mas emitimos recibo com CRM e CNPJ para você pedir reembolso ao seu plano.
      
      💻 A consulta é por vídeo, no horário marcado. Você recebe o link aqui pelo WhatsApp.
      
      ──────────────
      
      ⚡ *Agendar por aqui é mais rápido*: digite *2* e escolha unidade, dia e horário na hora.
      
      🙋 Quer falar com alguém da equipe? Digite *9*.
      
      ⏰ Segunda a sexta, 8h às 18h. Fora desse horário, respondemos no próximo dia útil.
      
      Digite *1* para ver outra unidade ou *0* para ver todas as opções.
      
      🚨 Se for *urgência*, digite URGÊNCIA: a equipe entra em contato o mais rápido possível.
      [lista "Ver opções"] 2 = Marcar uma consulta | URGENCIA = 🚨 É urgência | 1 = Outra unidade | 9 = Falar com a equipe | 0 = Voltar ao menu

[6] FAMÍLIA (qua., 14/10, 14:03): como funciona? precisa baixar algum app?
    ROBÔ:
      Não consegui entender por aqui, então passei sua mensagem para a nossa equipe.
      
      Estou direcionando você para alguém da nossa equipe.
      
      Pode já escrever sua dúvida por aqui: a pessoa que assumir o atendimento vai ler tudo antes de responder.
      
      Atendemos de segunda a sexta, das 8h às 18h.
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Não entendeu a resposta e explicou de novo · Chamou a equipe: Quer falar com a equipe

[7] FAMÍLIA (qua., 14/10, 14:04): e se o medico precisar examinar presencial? ai tenho q ir ate santos?
    ROBÔ: (silêncio)
    · bastidores: Ficou em silêncio: quem responde agora é a equipe

  … 20 min depois …

[8] FAMÍLIA (qua., 14/10, 14:25): 0
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

[9] FAMÍLIA (qua., 14/10, 14:26): quero marcar a consulta online
    ROBÔ:
      📍 *Vamos agendar!* Em qual unidade você prefere ser atendido?
      
      *1* Livance · Santos (18 horários livres)
      *2* Livance Ibirapuera - São Paulo (15 horários livres)
      *3* Telemedicina (por vídeo) (33 horários livres)
      
      Responda com o número. Digite *9* para falar com a nossa equipe, ou *0* para voltar ao início.
      [lista "Escolher unidade"] 1 = Livance · Santos | 2 = Livance Ibirapuera | 3 = Telemedicina (por vídeo) | 9 = Falar com a equipe | 0 = Voltar ao menu

[10] FAMÍLIA (qua., 14/10, 14:26): [tocou] Telemedicina (por vídeo)
    ROBÔ:
      🗓️ *Datas disponíveis para telemedicina:*
      
      *1* sexta, 16/10 (5 horários)
      *2* quarta, 21/10 (6 horários)
      *3* sexta, 23/10 (5 horários)
      *4* quarta, 28/10 (6 horários)
      *5* sexta, 30/10 (5 horários)
      *6* quarta, 04/11 (6 horários)
      
      Responda com o número do dia.
      Digite VOLTAR para escolher outra unidade, *9* se precisar de uma data mais distante, ou *0* para o início.
      
      🚨 Se for *urgência*, digite URGÊNCIA: a nossa equipe entra em contato o mais rápido possível.
      [lista "Escolher o dia"] 1 = sexta, 16/10 | 2 = quarta, 21/10 | 3 = sexta, 23/10 | 4 = quarta, 28/10 | 5 = sexta, 30/10 | 6 = quarta, 04/11 | URGENCIA = 🚨 É urgência | 9 = Falar com a equipe | 0 = Voltar ao menu

[11] FAMÍLIA (qua., 14/10, 14:27): pode ser sexta dia 16
    ROBÔ:
      ⏰ *Horários de sexta, 16/10:*
      
      *1* 14:00
      *2* 14:40
      *3* 15:20
      *4* 16:00
      *5* 16:40
      
      Responda com o número do horário.
      Digite VOLTAR para escolher outro dia, *9* para falar com a nossa equipe, ou *0* para o início.
      [lista "Escolher horário"] 1 = 14:00 | 2 = 14:40 | 3 = 15:20 | 4 = 16:00 | 5 = 16:40 | 9 = Falar com a equipe | 0 = Voltar ao menu

[12] FAMÍLIA (qua., 14/10, 14:28): [tocou] 16:00
    ROBÔ:
      📋 Seu horário de *sexta, 16/10 às 16:00* está guardado.
      
      Para completar o cadastro, 5 perguntas rápidas.
      
      👶 Qual é o *nome completo do paciente* (a criança)?
    · bastidores: Consulta marcada na agenda (sex., 16/10, 16:00 · telemedicina · Marina)

[13] FAMÍLIA (qua., 14/10, 14:29): Lucas Ferreira Campos, nasceu 03/05/2022
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: nome da criança (Lucas Ferreira Campos) · Ficha da consulta: data de nascimento (03/05/2022)

[14] FAMÍLIA (qua., 14/10, 14:29): Camila Ferreira Campos
    ROBÔ:
      🪪 Qual é o *CPF do paciente*?
      
      _Ele é exigido por lei na receita digital. Se a criança não tiver CPF, ou você não souber agora, responda PULAR._
      [botões] PULAR = Pular
    · bastidores: Ficha da consulta: responsável (Camila Ferreira Campos)

[15] FAMÍLIA (qua., 14/10, 14:30): ih nao sei de cabeça, depois eu mando
    ROBÔ:
      Sem problema.
      
      ✉️ Por fim, qual é o *e-mail* para enviarmos receitas e documentos?
      
      _Se preferir não responder agora, digite PULAR._
      [botões] PULAR = Pular

[16] FAMÍLIA (qua., 14/10, 14:31): camila.fcampos@gmail.com
    ROBÔ:
      ✅ *Tudo certo, obrigado!* Já anotamos os dados e seu cadastro está feito.
      
      ━━━━━━━━━━━━━━
      ✅ *Consulta marcada!*
      
      👶 Lucas Ferreira Campos
      🗓️ sexta, 16/10 às 16:00
      💻 Telemedicina, por vídeo. O link da consulta chega aqui pelo WhatsApp antes do horário.
      
      *Um dia antes da consulta enviamos uma mensagem aqui pelo WhatsApp para você confirmar sua presença.*
      
      Digite *0* a qualquer momento para voltar ao início.
      [botões] 0 = Voltar ao início
    · bastidores: Atendimento concluído sem precisar de ninguém · Ficha da consulta: e-mail (camila.fcampos@gmail.com) · Paciente cadastrado no sistema (Lucas Ferreira Campos)

[17] FAMÍLIA (qua., 14/10, 14:32): blz obrigada! so mais uma coisa, precisa baixar algum app pra chamada?
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
Consultas: sex., 16/10, 16:00 Livance Ibirapuera - São Paulo [scheduled] Marina
```
