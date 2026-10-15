const CAMPOS = [
  { nome: "valor", ajuda: "O valor da consulta deste atendimento", onde: ["unidade", "telemedicina"] },
  { nome: "endereco", ajuda: "O endere\xE7o desta unidade", onde: ["unidade"] },
  { nome: "unidade", ajuda: "O nome desta unidade", onde: ["unidade", "telemedicina"] },
  { nome: "valores", ajuda: "A lista com o valor de cada atendimento", onde: ["unidade", "telemedicina", "geral"] },
  { nome: "enderecos", ajuda: "A lista com o endere\xE7o de cada unidade", onde: ["unidade", "telemedicina", "geral"] }
];
const NOMES = new Set(CAMPOS.map((c) => c.nome));
const CHAVE = /\{\s*([A-Za-z\u00c0-\u00ff]+)\s*\}/g;
function semAcento(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function chave(bruta) {
  const nome = semAcento(bruta);
  return NOMES.has(nome) ? nome : null;
}
function temCampo(texto) {
  for (const m of texto.matchAll(CHAVE)) if (chave(m[1])) return true;
  return false;
}
function formatarValor(centavos) {
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, "0");
  const milhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${milhar},${resto}`;
}
const TETO = 1e7;
function lerValor(digitado) {
  const limpo = digitado.replace(/r\$/gi, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(limpo)) return null;
  let normal;
  if (limpo.includes(",")) {
    if ((limpo.match(/,/g) ?? []).length > 1) return null;
    const [inteiro, decimal] = limpo.split(",");
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(inteiro) || !/^\d{1,2}$/.test(decimal)) return null;
    normal = `${inteiro.replace(/\./g, "")}.${decimal}`;
  } else if (/^\d+\.\d{2}$/.test(limpo)) {
    normal = limpo;
  } else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(limpo)) {
    normal = limpo.replace(/\./g, "");
  } else {
    return null;
  }
  const centavos = Math.round(Number(normal) * 100);
  if (!Number.isFinite(centavos) || centavos <= 0 || centavos > TETO) return null;
  return centavos;
}
function valorDaConsulta(digitado) {
  if (!digitado.trim()) return { erro: "Preencha o valor da consulta." };
  const centavos = lerValor(digitado);
  if (centavos === null) return { erro: "N\xE3o entendi o valor. Escreva assim: 600 ou 600,00." };
  if (centavos < 1e3) return { erro: "Valor abaixo de R$ 10,00: confira se digitou certo." };
  return { centavos };
}
function listaDeValores(lugares) {
  const com = lugares.filter((l) => l.valorCentavos);
  return {
    texto: com.map((l) => `\u2022 ${l.nome}: ${formatarValor(l.valorCentavos)}`).join("\n"),
    sem: lugares.filter((l) => !l.valorCentavos).map((l) => `valor de ${l.nome}`)
  };
}
function listaDeEnderecos(lugares) {
  const fisicos = lugares.filter((l) => !l.telemedicina);
  return {
    texto: fisicos.filter((l) => l.endereco.trim()).map((l) => `\u2022 ${l.nome}: ${l.endereco.trim()}`).join("\n"),
    sem: fisicos.filter((l) => !l.endereco.trim()).map((l) => `endere\xE7o de ${l.nome}`)
  };
}
function preencherCampos(texto, lugar, lugares) {
  if (!temCampo(texto)) return { texto, faltando: [] };
  const faltando = [];
  const valores = listaDeValores(lugares);
  const enderecos = listaDeEnderecos(lugares);
  const valorDe = (nome) => {
    switch (nome) {
      case "valor":
        return lugar?.valorCentavos ? formatarValor(lugar.valorCentavos) : null;
      case "endereco":
        return lugar && !lugar.telemedicina && lugar.endereco.trim() ? lugar.endereco.trim() : null;
      case "unidade":
        return lugar?.nome.trim() || null;
      case "valores":
        faltando.push(...valores.sem);
        return valores.texto || null;
      case "enderecos":
        faltando.push(...enderecos.sem);
        return enderecos.texto || null;
    }
  };
  const linhas = texto.split("\n").flatMap((linha) => {
    let caiu = false;
    const pronta = linha.replace(CHAVE, (inteira, bruta) => {
      const nome = chave(bruta);
      if (!nome) return inteira;
      const valor = valorDe(nome);
      if (valor === null) {
        caiu = true;
        faltando.push(lugar ? `${nome} de ${lugar.nome}` : `${nome} (texto sem unidade)`);
        return "";
      }
      return valor;
    });
    return caiu ? [] : [pronta];
  });
  return {
    // Linha que caiu no meio deixaria buraco de tres quebras.
    texto: linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    faltando: [...new Set(faltando)]
  };
}
function problemasDoTexto(texto, onde, lugar, lugares) {
  const problemas = [];
  for (const m of texto.matchAll(CHAVE)) {
    const nome = chave(m[1]);
    if (!nome) {
      problemas.push(
        `"${m[0]}" n\xE3o \xE9 um campo conhecido. Os campos s\xE3o: ${CAMPOS.filter((c) => c.onde.includes(onde)).map((c) => `{${c.nome}}`).join(", ")}.`
      );
      continue;
    }
    const campo = CAMPOS.find((c) => c.nome === nome);
    if (!campo?.onde.includes(onde)) {
      problemas.push(
        onde === "telemedicina" ? `A telemedicina n\xE3o tem endere\xE7o: tire o ${m[0]}.` : `${m[0]} precisa de uma unidade, e este texto vale para todas. Use {valores} ou {enderecos}, que listam cada uma.`
      );
      continue;
    }
    if (nome === "valor" && !lugar?.valorCentavos) problemas.push("Preencha o valor para usar {valor}.");
    if (nome === "endereco" && !lugar?.endereco.trim()) problemas.push("Preencha o endere\xE7o para usar {endereco}.");
    if (nome === "valores") {
      const sem = listaDeValores(lugares).sem;
      if (sem.length) problemas.push(`Falta o ${sem.join(", ")} para montar {valores}.`);
    }
    if (nome === "enderecos") {
      const sem = listaDeEnderecos(lugares).sem;
      if (sem.length) problemas.push(`Falta o ${sem.join(", ")} para montar {enderecos}.`);
    }
  }
  return [...new Set(problemas)];
}
const ESCRITO = /R\$[\s\u00a0]*\d(?:[\d.]*\d)?(?:,\d{1,2})?/gi;
function valoresEscritos(texto) {
  return [...texto.matchAll(ESCRITO)].map((m) => ({
    trecho: m[0],
    centavos: lerValor(m[0].replace(/\u00a0/g, " "))
  }));
}
function trocarPorCampo(texto, centavos) {
  return texto.replace(
    ESCRITO,
    (trecho) => lerValor(trecho.replace(/\u00a0/g, " ")) === centavos ? "{valor}" : trecho
  );
}
export {
  CAMPOS,
  formatarValor,
  lerValor,
  preencherCampos,
  problemasDoTexto,
  temCampo,
  trocarPorCampo,
  valorDaConsulta,
  valoresEscritos
};
