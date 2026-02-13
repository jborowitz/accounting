import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600">-${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function SplitBar({ producerPct, housePct }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-200 flex">
        <div className="h-full bg-blue-500" style={{ width: `${producerPct}%` }} />
        <div className="h-full bg-gray-400" style={{ width: `${housePct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-20 text-right">{producerPct}/{housePct}</span>
    </div>
  )
}

function RuleForm({ onSubmit, saving }) {
  const [form, setForm] = useState({
    producer_id: '', split_pct: 70, house_pct: 30,
    carrier: '', lob: '', fee_type: 'percentage', fee_amount: 0, note: '',
    effective_from: '', effective_to: '',
  })

  const handleChange = (field, value) => {
    const next = { ...form, [field]: value }
    if (field === 'split_pct') next.house_pct = 100 - Number(value)
    if (field === 'house_pct') next.split_pct = 100 - Number(value)
    setForm(next)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}
      className="p-4 bg-white border border-gray-200 rounded-lg mb-6">
      <h3 className="text-sm font-semibold mb-3">Add / Update Comp Rule</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Producer ID *</label>
          <input type="text" value={form.producer_id} required
            onChange={(e) => handleChange('producer_id', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="PROD-001" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Producer %</label>
          <input type="number" min="0" max="100" step="5" value={form.split_pct}
            onChange={(e) => handleChange('split_pct', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">House %</label>
          <input type="number" min="0" max="100" step="5" value={form.house_pct}
            onChange={(e) => handleChange('house_pct', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Carrier (optional)</label>
          <select value={form.carrier} onChange={(e) => handleChange('carrier', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">All carriers</option>
            <option value="Summit National">Summit National</option>
            <option value="Wilson Mutual">Wilson Mutual</option>
            <option value="Northfield Specialty">Northfield Specialty</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fee Type</label>
          <select value={form.fee_type} onChange={(e) => handleChange('fee_type', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="percentage">Percentage</option>
            <option value="flat">Flat Fee</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fee Amount</label>
          <input type="number" step="0.01" value={form.fee_amount}
            onChange={(e) => handleChange('fee_amount', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Effective From</label>
          <input type="date" value={form.effective_from}
            onChange={(e) => handleChange('effective_from', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Effective To</label>
          <input type="date" value={form.effective_to}
            onChange={(e) => handleChange('effective_to', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Note</label>
          <input type="text" value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Optional..." />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Rule'}
        </button>
      </div>
    </form>
  )
}

function TestHarness({ splits }) {
  const [form, setForm] = useState({ producer_id: '', split_pct: 70, house_pct: 30, carrier: '', lob: '' })
  const [result, setResult] = useState(null)
  const [testing, setTesting] = useState(false)

  const runTest = async (e) => {
    e.preventDefault()
    if (!form.producer_id) return
    setTesting(true)
    try {
      const r = await api.testRuleChange(form)
      setResult(r)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
      <h3 className="text-sm font-semibold mb-2">Test Rule Change (What-If)</h3>
      <p className="text-xs text-gray-500 mb-3">See how changing a split would affect last month's results.</p>
      <form onSubmit={runTest} className="flex flex-wrap gap-3 items-end mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Producer</label>
          <input type="text" value={form.producer_id} required
            onChange={(e) => setForm({ ...form, producer_id: e.target.value })}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28" placeholder="PROD-001" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">New Split %</label>
          <input type="number" min="0" max="100" step="5" value={form.split_pct}
            onChange={(e) => setForm({ ...form, split_pct: Number(e.target.value), house_pct: 100 - Number(e.target.value) })}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm w-20" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Carrier</label>
          <select value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">All</option>
            <option value="Summit National">Summit National</option>
            <option value="Wilson Mutual">Wilson Mutual</option>
            <option value="Northfield Specialty">Northfield Specialty</option>
          </select>
        </div>
        <button type="submit" disabled={testing}
          className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
          {testing ? 'Testing...' : 'Run Test'}
        </button>
      </form>

      {result && (
        <div className="bg-white rounded border border-amber-200 p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
            <div>
              <span className="text-xs text-gray-500">Affected Lines</span>
              <div className="font-bold">{result.affected_lines}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Current Total</span>
              <div className="font-bold">{fmt(result.current_total)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Proposed Total</span>
              <div className="font-bold">{fmt(result.proposed_total)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Delta</span>
              <div className={`font-bold ${result.delta > 0 ? 'text-green-600' : result.delta < 0 ? 'text-red-600' : ''}`}>
                {result.delta > 0 ? '+' : ''}{fmt(result.delta)}
              </div>
            </div>
          </div>
          {result.lines.length > 0 && (
            <div className="overflow-x-auto max-h-48 overflow-y-auto rounded border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Line</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Policy</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Carrier</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">Commission</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">Current</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">Proposed</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.lines.map((l) => (
                    <tr key={l.line_id} className="hover:bg-gray-50">
                      <td className="px-2 py-1 font-mono">{l.line_id}</td>
                      <td className="px-2 py-1 font-mono">{l.policy_number}</td>
                      <td className="px-2 py-1">{l.carrier}</td>
                      <td className="px-2 py-1 text-right">{fmt(l.commission)}</td>
                      <td className="px-2 py-1 text-right">{fmt(l.current_share)} <span className="text-gray-400">({l.current_pct}%)</span></td>
                      <td className="px-2 py-1 text-right">{fmt(l.proposed_share)} <span className="text-gray-400">({l.proposed_pct}%)</span></td>
                      <td className={`px-2 py-1 text-right font-medium ${l.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {l.delta > 0 ? '+' : ''}{fmt(l.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Splits() {
  const [splits, setSplits] = useState([])
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [tab, setTab] = useState('rules') // rules | history | test

  const load = useCallback(async () => {
    const [s, v] = await Promise.all([api.listSplits(), api.listRuleVersions('split_rule')])
    setSplits(s.rows)
    setVersions(v.rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    setSaving(true)
    try {
      await api.upsertSplit(form)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ruleId) => {
    await api.deleteSplit(ruleId)
    await load()
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.seedSplits()
      await load()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Compensation Plans</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{splits.length} rules</span>
          {splits.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50">
              {seeding ? 'Seeding...' : 'Seed Demo Rules'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'rules', label: 'Comp Rules' },
          { key: 'test', label: 'What-If Test' },
          { key: 'history', label: 'Version History' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <>
          <RuleForm onSubmit={handleSave} saving={saving} />

          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : splits.length === 0 ? (
            <p className="text-gray-500 text-sm">No compensation rules yet. Add one above or seed demo data.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Producer</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Carrier</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Line of Business</th>
                    <th className="px-3 py-2 font-medium text-gray-600 w-40">Split</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Fee</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Effective</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">v</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Note</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {splits.map((r) => (
                    <tr key={r.rule_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{r.producer_id}</td>
                      <td className="px-3 py-2 text-xs">{r.carrier || <span className="text-gray-400">All</span>}</td>
                      <td className="px-3 py-2 text-xs">{r.lob || <span className="text-gray-400">All</span>}</td>
                      <td className="px-3 py-2"><SplitBar producerPct={r.split_pct} housePct={r.house_pct} /></td>
                      <td className="px-3 py-2 text-xs">
                        {r.fee_amount > 0 ? `${r.fee_type === 'flat' ? '$' : ''}${r.fee_amount}${r.fee_type === 'percentage' ? '%' : ''}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.effective_from || '—'} → {r.effective_to || 'ongoing'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">v{r.version}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[120px]">{r.note || ''}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDelete(r.rule_id)}
                          className="text-red-400 hover:text-red-600 text-xs">del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'test' && <TestHarness splits={splits} />}

      {tab === 'history' && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Rule Change History</h3>
          {versions.length === 0 ? (
            <p className="text-gray-500 text-sm">No version history yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.version_id} className="flex items-start gap-3 p-3 bg-white rounded border border-gray-200">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    v.change_type === 'created' ? 'bg-green-500' : v.change_type === 'deleted' ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{v.change_type}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">Rule #{v.rule_id}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">v{v.version}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {v.changed_by} · {v.changed_at}
                    </div>
                    {v.old_value && v.new_value && (
                      <div className="text-xs mt-1">
                        <span className="text-red-500 line-through">{v.old_value}</span>
                        <span className="mx-1">→</span>
                        <span className="text-green-600">{v.new_value}</span>
                      </div>
                    )}
                    {v.new_value && !v.old_value && (
                      <div className="text-xs mt-1 text-green-600">{v.new_value}</div>
                    )}
                    {v.detail && <div className="text-xs text-gray-400 mt-0.5">{v.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
