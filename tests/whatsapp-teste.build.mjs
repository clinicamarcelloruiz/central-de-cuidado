// supabase/functions/_shared/telefone-br.ts
function variantesDoTelefone(numero) {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  if (!digitos) return [];
  const semPais = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
  const variantes = /* @__PURE__ */ new Set([digitos, semPais, `55${semPais}`]);
  if (semPais.length === 10 || semPais.length === 11) {
    const ddd = semPais.slice(0, 2);
    const local = semPais.slice(2);
    let outro = null;
    if (local.length === 8 && /^[6-9]/.test(local)) outro = `${ddd}9${local}`;
    if (local.length === 9 && local.startsWith("9") && /^[6-9]/.test(local.slice(1))) outro = `${ddd}${local.slice(1)}`;
    if (outro) {
      variantes.add(outro);
      variantes.add(`55${outro}`);
    }
  }
  return [...variantes].filter((v) => v.length >= 8);
}

// supabase/functions/_shared/whatsapp-teste.ts
var lerDoDeno = (nome) => globalThis.Deno?.env.get(nome);
function chaveDoWhatsApp(phoneNumberId, ler = lerDoDeno) {
  const propria = phoneNumberId ? ler(`WHATSAPP_ACCESS_TOKEN_${String(phoneNumberId).trim()}`)?.trim() : void 0;
  return propria || ler("WHATSAPP_ACCESS_TOKEN")?.trim() || void 0;
}
function foraDaListaDeTeste(lista, telefone) {
  if (lista == null) return false;
  const permitidos = new Set(lista.flatMap((numero) => variantesDoTelefone(numero)));
  return !variantesDoTelefone(telefone).some((v) => permitidos.has(v));
}
async function listaDeTeste(admin, clinicId) {
  try {
    const { data, error } = await admin.from("clinic_settings").select("whatsapp_telefones_teste").eq("clinic_id", clinicId).maybeSingle();
    if (error) {
      console.warn("AVISO: nao consegui ler whatsapp_telefones_teste; seguindo sem trava de teste.", error.message);
      return null;
    }
    const valor = data?.whatsapp_telefones_teste;
    return Array.isArray(valor) ? valor.map(String) : null;
  } catch (causa) {
    console.warn("AVISO: falha ao ler a lista de teste; seguindo sem trava.", causa);
    return null;
  }
}
export {
  chaveDoWhatsApp,
  foraDaListaDeTeste,
  listaDeTeste
};
