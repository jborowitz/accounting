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
}
