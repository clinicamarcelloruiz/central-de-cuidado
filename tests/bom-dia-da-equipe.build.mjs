// supabase/functions/_shared/expediente.ts
var EXPEDIENTE = {
  /** 0 = domingo ... 6 = sabado. */
  dias: [1, 2, 3, 4, 5],
  inicio: 8,
  fim: 18,
  fuso: "America/Sao_Paulo",
  texto: "segunda a sexta, das 8h \xE0s 18h"
};
var DIA_DA_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = (h + l - 7 * m + 114) % 31 + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}
function iso(data) {
  return data.toISOString().slice(0, 10);
}
function somar(data, dias) {
  return new Date(data.getTime() + dias * 864e5);
}
function feriadosDoAno(ano) {
  const p = pascoa(ano);
  const fixos = [
    ["01-01", "Confraterniza\xE7\xE3o Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independ\xEAncia do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclama\xE7\xE3o da Rep\xFAblica"],
    ["11-20", "Consci\xEAncia Negra"],
    ["12-25", "Natal"]
  ];
  const mapa = new Map(fixos.map(([md, nome]) => [`${ano}-${md}`, nome]));
  mapa.set(iso(somar(p, -48)), "Carnaval");
  mapa.set(iso(somar(p, -47)), "Carnaval");
  mapa.set(iso(somar(p, -46)), "Quarta-feira de Cinzas");
  mapa.set(iso(somar(p, -2)), "Sexta-feira Santa");
  mapa.set(iso(somar(p, 60)), "Corpus Christi");
  return mapa;
}
function feriado(data) {
  const ano = Number(data.slice(0, 4));
  if (!Number.isFinite(ano)) return null;
  return feriadosDoAno(ano).get(data.slice(0, 10)) ?? null;
}
function relogioDaClinica(agora) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: EXPEDIENTE.fuso,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(agora);
  const pega = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    data: `${pega("year")}-${pega("month")}-${pega("day")}`,
    dia: DIA_DA_SEMANA[pega("weekday")] ?? 1,
    hora: Number(pega("hour")) + Number(pega("minute")) / 60
  };
}
function diaDeAtendimento(data, diaDaSemana) {
  return EXPEDIENTE.dias.includes(diaDaSemana) && !feriado(data);
}
function dentroDoExpediente(agora = /* @__PURE__ */ new Date()) {
  const { data, dia, hora } = relogioDaClinica(agora);
  return diaDeAtendimento(data, dia) && hora >= EXPEDIENTE.inicio && hora < EXPEDIENTE.fim;
}

// supabase/functions/_shared/bom-dia-da-equipe.ts
var BOM_DIA_DA_EQUIPE = "Bom dia! \u{1F499} A equipe j\xE1 est\xE1 por aqui. Voc\xEA chamou a gente fora do hor\xE1rio: em que podemos te ajudar?";
var BOM_DIA_FORA_DO_EXPEDIENTE = "Bom dia! \u{1F499} Voc\xEA chamou a gente fora do hor\xE1rio: em que posso te ajudar? Por aqui j\xE1 d\xE1 para tirar d\xFAvidas e marcar a consulta, e o que precisar da equipe eu passo para ela.";
function textoDoBomDia(agora) {
  return dentroDoExpediente(agora) ? BOM_DIA_DA_EQUIPE : BOM_DIA_FORA_DO_EXPEDIENTE;
}
var TRECHOS_DO_PEDIDO = [
  "Estou direcionando voc\xEA para algu\xE9m da nossa equipe",
  "Me conta aqui o que voc\xEA precisa"
];
var JANELA_MS = 23 * 3600 * 1e3;
function deManha(agora) {
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: EXPEDIENTE.fuso, hour: "2-digit", hourCycle: "h23" }).format(agora)
  );
  return hora >= EXPEDIENTE.inicio && hora < 12;
}
function precisaDoBomDia(mensagens, agora) {
  if (!deManha(agora)) return false;
  const ultima = mensagens.at(-1);
  if (!ultima || ultima.direction !== "outbound" || ultima.automatic === false) return false;
  if (!TRECHOS_DO_PEDIDO.some((trecho) => String(ultima.body ?? "").includes(trecho))) return false;
  const daFamilia = [...mensagens].reverse().find((m) => m.direction === "inbound");
  if (!daFamilia) return false;
  const quando = new Date(daFamilia.created_at);
  if (Number.isNaN(quando.getTime()) || dentroDoExpediente(quando)) return false;
  return agora.getTime() - quando.getTime() < JANELA_MS;
}
export {
  BOM_DIA_DA_EQUIPE,
  BOM_DIA_FORA_DO_EXPEDIENTE,
  TRECHOS_DO_PEDIDO,
  precisaDoBomDia,
  textoDoBomDia
};
