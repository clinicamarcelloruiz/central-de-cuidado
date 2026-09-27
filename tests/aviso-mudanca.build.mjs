const MODELO_DO_AVISO = "mudanca_santos_livance";
const VIRADA = "2026-10-01T03:00:00.000Z";
function ehLivanceSantos(nome) {
  return String(nome ?? "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase() === "livancesantos";
}
function motivoParaNaoAvisar(consulta) {
  if (!ehLivanceSantos(consulta.unidade)) return "outra unidade";
  if (consulta.status !== "scheduled") return `status ${consulta.status}`;
  if (consulta.modality === "telemedicina") return "telemedicina";
  if (consulta.confirmed_by_clinic === false) return "solicitacao ainda nao confirmada";
  if (new Date(consulta.starts_at).getTime() < new Date(VIRADA).getTime()) return "antes de 01/10";
  return null;
}
function dataEHoraDoAviso(iso, timezone = "America/Sao_Paulo") {
  const data = new Date(iso);
  const semana = data.toLocaleDateString("pt-BR", { timeZone: timezone, weekday: "long" }).split("-")[0].trim();
  const diaMes = data.toLocaleDateString("pt-BR", { timeZone: timezone, day: "2-digit", month: "2-digit" });
  const hora = data.toLocaleTimeString("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  return { data: `${semana}, ${diaMes}`, hora };
}
export {
  MODELO_DO_AVISO,
  VIRADA,
  dataEHoraDoAviso,
  ehLivanceSantos,
  motivoParaNaoAvisar
};
