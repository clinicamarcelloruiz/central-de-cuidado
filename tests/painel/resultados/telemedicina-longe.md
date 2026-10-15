# telemedicina-longe

**Persona:** mãe que mora em Campinas, longe das unidades. Escreve normal, com algumas abreviações ("vcs", "q", "kkk"). Mistura toque e texto.
**Família:** nova · início qua 14/10/2026 14:00 (17:00Z)
**Objetivo:** entender como funciona a consulta online (como é, quanto custa, e se precisar examinar presencial) e marcar telemedicina.

## Resultado: PARCIAL

- Marcou a telemedicina (sex 16/10 16:00, modalidade telemedicina) e recebeu o valor (R$ 450) e a regra do retorno presencial pelo texto fixo da opção "Dúvidas > Telemedicina".
- As duas perguntas digitadas ("vcs fazem consulta online?" e "como funciona? precisa baixar algum app?") não foram entendidas: as duas viraram "passei para a equipe". A pergunta sobre app nunca teve resposta.
- A ficha começou com o nome da criança gravado errado (o nome levou junto o "nasceu 03/05/2022") e a data de nascimento pedida de novo. O limite de 14 mensagens acabou no meio da ficha (faltam responsável, CPF e e-mail).

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
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
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
      
      Agora estamos fora do horário de atendimento (segunda a sexta, das 8h às 18h). Alguém da equipe responde hoje, a partir das 8h.
      
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
      🎂 Qual é a *data de nascimento* da criança? (dia/mês/ano)
    · bastidores: Ficha da consulta: nome da criança (Lucas Ferreira Campos, nasceu 03/05/2022)

[14] FAMÍLIA (qua., 14/10, 14:29): ja falei kkk 03/05/2022
    ROBÔ:
      👤 Qual é o *nome do responsável* (mãe, pai ou tutor)?
    · bastidores: Ficha da consulta: data de nascimento (ja falei kkk 03/05/2022)

--- estado no fim ---
Etapa do robô: dados_responsavel · Situação: aguardando_equipe (atendente)
Consultas: sex., 16/10, 16:00 Livance Ibirapuera - São Paulo [scheduled] Marina
```

## Problemas

### ALTA
- **Turno 13 · nome da criança gravado com a data junto.** A mãe escreveu "Lucas Ferreira Campos, nasceu 03/05/2022". Bastidores: `Ficha da consulta: nome da criança (Lucas Ferreira Campos, nasceu 03/05/2022)`. O campo `intake_patient_name` fica com ", nasceu 03/05/2022" no fim, e é esse texto que `cadastro.ts` copia para `patients.name`. Esperado: nome = "Lucas Ferreira Campos" e a data aproveitada (ou pelo menos não colada no nome).
- **Turno 14 · data de nascimento pedida de novo e perdida no cadastro.** Depois de a mãe já ter mandado a data junto com o nome, o robô perguntou "🎂 Qual é a *data de nascimento* da criança?". Ela respondeu "ja falei kkk 03/05/2022" e o bastidor gravou `data de nascimento (ja falei kkk 03/05/2022)`. Pelo código, `dataDeNascimentoIso` só aceita o texto inteiro no formato dd/mm/aaaa (regex ancorada), então o cadastro nasceria com `birth_date` vazio, sem aviso à família. O próprio `datas.ts` registra que sem data de nascimento a Memed recusa a receita. Esperado: reconhecer a data dentro da frase (e não perguntar o que já foi dito).

### MÉDIA
- **Turno 1 · pergunta ignorada.** "Oi boa tarde! vcs fazem consulta online? moro em Campinas" recebeu só o menu ("Como podemos ajudar hoje? *1* Dúvidas..."), sem nenhuma palavra sobre a consulta online. Esperado: "Sim, fazemos telemedicina por vídeo..." ou pelo menos levar direto às informações da telemedicina.
- **Turno 2 · pergunta comum vira fila da equipe.** "vcs fazem consulta online?" → "Não consegui entender por aqui, então passei sua mensagem para a nossa equipe." O robô tem a informação (a opção 1 > 3 responde tudo), mas não liga "online" a telemedicina. A conversa fica "aguardando_equipe" até o fim, mesmo depois que a mãe resolveu sozinha pelo menu (a equipe vai receber uma conversa já resolvida).
- **Turno 6 · "como funciona? precisa baixar algum app?" vira fila da equipe de novo.** Mesmo texto "Não consegui entender...". O texto da telemedicina (turno 5) diz só "Você recebe o link aqui pelo WhatsApp", sem dizer se precisa de aplicativo. Esperado: resposta direta (qual plataforma, se precisa instalar).
- **Turno 9 · "quero marcar a consulta online" pergunta a unidade.** O robô entendeu "marcar" mas não "online": mostrou de novo Santos / Ibirapuera / Telemedicina. Esperado: ir direto às datas da telemedicina (passo a mais).

### BAIXA
- **Turno 5 · frase de horário antiga no texto da telemedicina:** "⏰ Segunda a sexta, 8h às 18h. Fora desse horário, respondemos no próximo dia útil." É a frase que o `expediente.ts` diz ter aposentado em 24/09 (fora do horário ela não diz quando a equipe volta). Ela continua no texto da resposta pronta, que vem do banco (migration `20260916140000_fecho_sem_telefones.sql`, e igual em `src/simulador/dados.ts`).
- **Turno 5 · texto longo:** a resposta tem oito blocos (valor, pagamento, vídeo, agendar, equipe, horário, outra unidade, urgência). As informações estão certas, mas o "como funciona" fica diluído.

### Observação (artefato do simulador, não da produção)
- **Turnos 2 e 6:** "Agora estamos fora do horário de atendimento... Alguém da equipe responde hoje, a partir das 8h." numa quarta às 14h. Causa: `avisoDeHorario()` é chamado sem o `agora` em `atendimento.ts` (linhas 851, 1547, 3563 etc.) e usa o relógio da máquina (qui 15/10 00:26 quando rodei). Em produção o relógio real coincide, então a família real veria "Atendemos de segunda a sexta...". Mas o resultado do painel muda conforme a hora em que se roda o script.
- **Estado no fim:** a consulta aparece como "Livance Ibirapuera - São Paulo". Pelo código é o previsto: sem agenda própria de telemedicina, a consulta vai para a unidade física que cedeu o horário, com `modality = telemedicina` (o bastidor confirma "telemedicina", e o lembrete trata a modalidade).

## O que funcionou bem
- A informação da telemedicina (opção 1 > 3) responde direto "quanto fica" (R$ 450), pagamento por pix com recibo para reembolso, e "e se precisar examinar presencial" (retorno presencial em até 30 dias em Santos ou SP).
- "pode ser sexta dia 16" foi entendido na lista de datas, sem número.
- Silêncio correto no turno 7, quando a conversa estava com a equipe.
- O horário fica "guardado" antes da ficha: se a mãe parar no meio, a consulta não se perde.
