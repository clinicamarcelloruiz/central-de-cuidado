const MODELOS = {
  acompanhamento_pos_consulta: {
    corpo: "Ol\xE1, {{1}}. A Cl\xEDnica Dr. Marcello Ruiz est\xE1 entrando em contato para acompanhar sua consulta realizada em {{2}}. Como voc\xEA est\xE1? Responda esta mensagem caso precise falar com nossa equipe.",
    rodape: "Para n\xE3o receber novos acompanhamentos, responda SAIR.",
    botoes: ["Estou bem", "Preciso de ajuda", "N\xE3o quero receber"]
  },
  lembrete_consulta: {
    corpo: "Ol\xE1, {{1}}. Lembrete da sua consulta em {{2}} \xE0s {{3}}, na unidade {{4}}. Podemos confirmar sua presen\xE7a?",
    botoes: ["Confirmar presen\xE7a", "Preciso remarcar"]
  },
  // A resposta da equipe fora da janela de 24 horas. O {{2}} é o texto que a
  // pessoa digitou na tela - por isso o registro precisa deste modelo aqui:
  // sem ele, a conversa guardaria "modelo enviado" e ninguém saberia o que a
  // família leu, que é justamente o conteúdo que importa.
  // Aviso unico da mudanca de Santos para a Livance (26/09/2026). Aprovado como
  // Utilidade so depois de falar da consulta da familia e perder o link do
  // Instagram - na primeira versao a Meta quis classificar como Marketing.
  mudanca_santos_livance: {
    corpo: "Ol\xE1, {{1}}. Aqui \xE9 do consult\xF3rio do Dr. Marcello Ruiz.\n\nSua consulta de {{2}} \xE0s {{3}} em Santos ser\xE1 no novo endere\xE7o:\n\u{1F4CD} Livance, Av. Anna Costa, 228, 20\xBA e 21\xBA andares, Gonzaga, Santos\n\nComo funciona a chegada:\n1. Fa\xE7a o check-in em um dos totens digitais, digitando o nome do paciente.\n2. Ainda no totem, fa\xE7a o pagamento da consulta: Pix, d\xE9bito ou cr\xE9dito (\xE0 vista).\n3. O Dr. Marcello recebe o aviso e chama voc\xEAs na sala de espera assim que terminar a consulta anterior.\n\nSe precisar remarcar, \xE9 s\xF3 responder esta mensagem."
  },
  // Modelos da clinica de teste (27/09/2026): os mesmos tres de cima que
  // citavam o Dr. Marcello, com o nome do Consultorio Central de Cuidado. Vivem
  // so na conta de teste da Meta; a clinica de teste aponta para eles em
  // clinic_settings.
  demo_acompanhamento: {
    corpo: "Ol\xE1, {{1}}. O Consult\xF3rio Central de Cuidado est\xE1 entrando em contato para acompanhar sua consulta realizada em {{2}}. Como voc\xEA est\xE1? Responda esta mensagem caso precise falar com nossa equipe.",
    rodape: "Para n\xE3o receber novos acompanhamentos, responda SAIR.",
    botoes: ["Estou bem", "Preciso de ajuda", "N\xE3o quero receber"]
  },
  demo_resposta_da_clinica: {
    corpo: "Ol\xE1, {{1}}. Aqui \xE9 o Consult\xF3rio Central de Cuidado.\n\n{{2}}\n\nSe precisar, \xE9 s\xF3 responder por aqui."
  },
  resposta_da_clinica: {
    corpo: "Ol\xE1, {{1}}. Aqui \xE9 o consult\xF3rio do Dr. Marcello Ruiz.\n\n{{2}}\n\nSe precisar, \xE9 s\xF3 responder por aqui."
  }
};
function textoDoModelo(nome, parametros) {
  const modelo = MODELOS[nome];
  if (!modelo) return null;
  const corpo = modelo.corpo.replace(/\{\{(\d+)\}\}/g, (_, indice) => parametros[Number(indice) - 1] ?? "");
  return [
    corpo,
    modelo.rodape,
    // Os botões entram no texto porque são parte do que a pessoa vê, e porque
    // explicam as respostas curtas que voltam depois ("Estou bem") para quem
    // ler a conversa semanas mais tarde.
    modelo.botoes?.length ? `[${modelo.botoes.join(" \xB7 ")}]` : null
  ].filter(Boolean).join("\n\n");
}
export {
  textoDoModelo
};
