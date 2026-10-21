function telefoneDoLembrete(consulta, pacientes) {
  const doCadastro = consulta.patientId ? (pacientes.find((p) => p.id === consulta.patientId)?.telefone ?? "").trim() : "";
  return doCadastro || (consulta.contactPhone ?? "").trim();
}
export {
  telefoneDoLembrete
};
