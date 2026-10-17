// Banco falso em memoria para os testes do alerta de urgencia (17/10/2026).
// Entende so o que o codigo usa: select, insert, update e os filtros eq, neq,
// is, in, gte, order e limit. Tabela listada em `semTabela` responde com erro,
// como o Postgres faz quando a migration ainda nao chegou.
export function bancoFalso(tabelas = {}, { semTabela = [] } = {}) {
  const db = structuredClone(tabelas)
  const gravado = []

  function from(nome) {
    const filtros = []
    let acao = 'select'
    let valores = null
    let ordem = null
    let limite = null

    const executar = () => {
      if (semTabela.includes(nome)) return { data: null, error: { message: `relation "public.${nome}" does not exist` } }
      db[nome] ??= []
      if (acao === 'insert') {
        const linhas = (Array.isArray(valores) ? valores : [valores]).map((l) => ({
          id: l.id ?? (nome === 'alertas_de_urgencia' ? crypto.randomUUID() : `${nome}-${db[nome].length + 1}`),
          criado_em: l.criado_em ?? new Date().toISOString(),
          ...l,
        }))
        db[nome].push(...linhas)
        for (const l of linhas) gravado.push(['insert', nome, l])
        return { data: linhas.map((l) => ({ ...l })), error: null }
      }
      let linhas = db[nome].filter((r) => filtros.every((f) => f(r)))
      if (acao === 'update') {
        for (const r of linhas) Object.assign(r, valores)
        gravado.push(['update', nome, valores, linhas.length])
        return { data: linhas.map((r) => ({ ...r })), error: null }
      }
      if (ordem) {
        const [campo, crescente] = ordem
        linhas = [...linhas].sort((a, b) => (String(a[campo]) < String(b[campo]) ? -1 : 1) * (crescente ? 1 : -1))
      }
      if (limite !== null) linhas = linhas.slice(0, limite)
      return { data: linhas.map((r) => ({ ...r })), error: null }
    }

    const q = {
      select() { return q },
      eq(k, v) { filtros.push((r) => r[k] === v); return q },
      neq(k, v) { filtros.push((r) => r[k] !== v); return q },
      is(k, v) { filtros.push((r) => (r[k] ?? null) === v); return q },
      in(k, vs) { filtros.push((r) => vs.includes(r[k])); return q },
      gte(k, v) { filtros.push((r) => String(r[k]) >= String(v)); return q },
      order(k, o = {}) { ordem = [k, o.ascending !== false]; return q },
      limit(n) { limite = n; return q },
      insert(v) { acao = 'insert'; valores = v; return q },
      update(v) { acao = 'update'; valores = v; return q },
      async maybeSingle() { const r = executar(); return { data: r.data?.[0] ?? null, error: r.error } },
      async single() { const r = executar(); return { data: r.data?.[0] ?? null, error: r.error } },
      then(ok, ko) { return Promise.resolve(executar()).then(ok, ko) },
    }
    return q
  }

  return { db, gravado, from }
}
