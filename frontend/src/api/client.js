const BASE = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  getSummary: () => request('/api/v1/demo/summary'),
  getMatchSummary: () => request('/api/v1/demo/match-summary'),

  createMatchRun: () => request('/api/v1/demo/match-runs', { method: 'POST' }),
  listMatchRuns: (limit = 50) => request(`/api/v1/demo/match-runs?limit=${limit}`),
  listMatchResults: (status, limit = 500) => {
    const params = new URLSearchParams({ limit })
    if (status) params.set('status', status)
    return request(`/api/v1/demo/match-results?${params}`)
  },

  listExceptions: (status = 'open', limit = 100) =>
    request(`/api/v1/demo/exceptions?status=${status}&limit=${limit}`),
  resolveException: (payload) =>
    request('/api/v1/demo/exceptions/resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listRules: (limit = 200) => request(`/api/v1/demo/rules/policy?limit=${limit}`),
  createRule: (payload) =>
    request('/api/v1/demo/rules/policy', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listStatements: () => request('/api/v1/demo/statements'),
  getStatementPdfUrl: (statementId) => `${BASE}/api/v1/demo/statements/${statementId}.pdf`,

  getLineDetail: (lineId) => request(`/api/v1/demo/line-detail/${lineId}`),
  getRevenueSummary: () => request('/api/v1/demo/revenue/summary'),

  listBankTransactions: (counterparty, limit = 500) => {
    const params = new URLSearchParams({ limit })
    if (counterparty) params.set('counterparty', counterparty)
    return request(`/api/v1/demo/bank-transactions?${params}`)
  },

  // Audit trail
  listAuditEvents: (entityType, entityId, limit = 200) => {
    const params = new URLSearchParams({ limit })
    if (entityType) params.set('entity_type', entityType)
    if (entityId) params.set('entity_id', entityId)
    return request(`/api/v1/demo/audit?${params}`)
  },

  // Accruals
  getAccruals: () => request('/api/v1/demo/accruals'),

  // Journal
  getJournal: () => request('/api/v1/demo/journal'),
  postJournal: () => request('/api/v1/demo/journal/post', { method: 'POST' }),

  // Exports
  getExportUrl: (name) => `${BASE}/api/v1/demo/exports/${name}`,

  // Producers
  getProducers: () => request('/api/v1/demo/producers'),

  // Statement upload simulation
  uploadStatement: (carrier) => {
    const params = new URLSearchParams()
    if (carrier) params.set('carrier', carrier)
    return request(`/api/v1/demo/statements/upload?${params}`, { method: 'POST' })
  },

  // Aging / variance
  getAging: () => request('/api/v1/demo/aging'),

  // Carrier scorecard
  getCarriers: () => request('/api/v1/demo/carriers'),

  // Background reconciliation
  backgroundResolve: (count = 3) => request(`/api/v1/demo/background-resolve?count=${count}`, { method: 'POST' }),

  // Split rules (3.2)
  listSplits: (producerId) => {
    const params = new URLSearchParams()
    if (producerId) params.set('producer_id', producerId)
    return request(`/api/v1/demo/splits?${params}`)
  },
  upsertSplit: (payload) => request('/api/v1/demo/splits', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSplit: (ruleId) => request(`/api/v1/demo/splits/${ruleId}`, { method: 'DELETE' }),
  seedSplits: () => request('/api/v1/demo/splits/seed', { method: 'POST' }),

  // Adjustments (3.3)
  listAdjustments: (producerId) => {
    const params = new URLSearchParams()
    if (producerId) params.set('producer_id', producerId)
    return request(`/api/v1/demo/adjustments?${params}`)
  },
  createAdjustment: (payload) => request('/api/v1/demo/adjustments', { method: 'POST', body: JSON.stringify(payload) }),
  seedAdjustments: () => request('/api/v1/demo/adjustments/seed', { method: 'POST' }),
  getNetting: () => request('/api/v1/demo/netting'),

  // Rule versions (3.4)
  listRuleVersions: (ruleType, ruleId) => {
    const params = new URLSearchParams()
    if (ruleType) params.set('rule_type', ruleType)
    if (ruleId) params.set('rule_id', ruleId)
    return request(`/api/v1/demo/rule-versions?${params}`)
  },
  testRuleChange: (payload) => request('/api/v1/demo/rules/test', { method: 'POST', body: JSON.stringify(payload) }),
}
