function aparelhoDaTela(ambiente) {
  if (ambiente.toquePrincipal) return "celular";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ambiente.userAgent) ? "celular" : "computador";
}
function aparelhosDe(entradas) {
  const tem = (a) => entradas.some((e) => e.aparelho === a);
  return ["computador", "celular"].filter(tem);
}
function descreverAparelhos(aparelhos) {
  if (aparelhos.length === 2) return "no computador e no celular";
  if (aparelhos[0] === "celular") return "no celular";
  if (aparelhos[0] === "computador") return "no computador";
  return "online";
}
export {
  aparelhoDaTela,
  aparelhosDe,
  descreverAparelhos
};
