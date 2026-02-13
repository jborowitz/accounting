import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600">-${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function fmtPlain(n) {
  if (n == null) return '—'
  const v = Number(n)
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function AdjustmentForm({ producers, onSubmit, saving }) {
  const [form, setForm] = useState({ producer_id: '', adj_type: 'clawback_offset', amount: 0, description: '', period: '2026-01' })

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}
      className="p-4 bg-white border border-gray-200 rounded-lg mb-6">
      <h3 className="text-sm font-semibold mb-3">Add Adjustment</h3>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Producer</label>
          <input type="text" value={form.producer_id} required
            onChange={(e) => setForm({ ...form, producer_id: e.target.value })}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28" placeholder="PROD-001" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={form.adj_type} onChange={(e) => setForm({ ...form, adj_type: e.target.value })}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="clawback_offset">Clawback Offset</option>
            <option value="chargeback">Chargeback</option>
            <option value="draw_advance">Draw Advance</option>
            <option value="draw_repayment">Draw Repayment</option>
            <option value="bonus">Bonus</option>
            <option value="fee_deduction">Fee Deduction</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount</label>
          <input type="number" step="0.01" value={form.amount} required
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <input type="text" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Optional..." />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Add'}
        </button>
      </div>
    </form>
  )
}

const adjTypeColors = {
  clawback_offset: 'bg-purple-100 text-purple-800',
  chargeback: 'bg-red-100 text-red-800',
  draw_advance: 'bg-amber-100 text-amber-800',
  draw_repayment: 'bg-green-100 text-green-800',
  bonus: 'bg-blue-100 text-blue-800',
  fee_deduction: 'bg-gray-100 text-gray-800',
}

export default function Netting() {
  const [netting, setNetting] = useState(null)
  const [adjustments, setAdjustments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [tab, setTab] = useState('waterfall') // waterfall | adjustments

  const load = useCallback(async () => {
    const [n, a] = await Promise.all([api.getNetting(), api.listAdjustments()])
    setNetting(n)
    setAdjustments(a.rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddAdj = async (form) => {
    setSaving(true)
    try {
      await api.createAdjustment(form)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.seedAdjustments()
      await load()
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!netting) return null

  const { producers, totals } = netting

  // Chart data for top producers
  const chartData = producers.slice(0, 10).map((p) => ({
    name: p.producer_id,
    gross: Math.round(p.gross_commission),
    producer: Math.round(p.producer_share),
    adjustments: Math.round(p.adjustments_total),
    net: Math.round(p.net_payout),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Netting & Adjustments</h2>
        <div className="flex items-center gap-3">
          {adjustments.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50">
              {seeding ? 'Seeding...' : 'Seed Demo Adjustments'}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="rounded-lg border-l-4 border-blue-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Gross Commission</div>
          <div className="mt-1 text-lg font-bold">{fmt(totals.gross_commission)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-purple-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Clawbacks</div>
          <div className="mt-1 text-lg font-bold">{fmt(totals.clawbacks)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-green-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Producer Share</div>
          <div className="mt-1 text-lg font-bold">{fmt(totals.producer_share)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-gray-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">House Share</div>
          <div className="mt-1 text-lg font-bold">{fmt(totals.house_share)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-amber-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Adjustments</div>
          <div className="mt-1 text-lg font-bold">{fmt(totals.adjustments)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-teal-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Net Payout</div>
          <div className="mt-1 text-lg font-bold">{fmt(totals.net_payout)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'waterfall', label: 'Net Position' },
          { key: 'adjustments', label: `Adjustments (${adjustments.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'waterfall' && (
        <>
          {/* Chart */}
          {chartData.length > 0 && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold mb-3">Net Payout by Producer (Top 10)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [fmtPlain(v), '']} />
                    <Legend />
                    <Bar dataKey="producer" name="Producer Share" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="adjustments" name="Adjustments" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Producer netting table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Producer</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Lines</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Gross</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Clawbacks</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Producer %</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">House %</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Adjustments</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Net Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {producers.map((p) => (
                  <tr key={p.producer_id}
                    className={`hover:bg-gray-50 cursor-pointer ${expanded === p.producer_id ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpanded(expanded === p.producer_id ? null : p.producer_id)}>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{p.producer_id}</td>
                    <td className="px-3 py-2 text-right">{p.lines}</td>
                    <td className="px-3 py-2 text-right">{fmt(p.gross_commission)}</td>
                    <td className="px-3 py-2 text-right">{fmt(p.clawbacks)}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{fmt(p.producer_share)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmt(p.house_share)}</td>
                    <td className="px-3 py-2 text-right">{fmt(p.adjustments_total)}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(p.net_payout)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium">
                <tr>
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right">{producers.reduce((s, p) => s + p.lines, 0)}</td>
                  <td className="px-3 py-2 text-right">{fmt(totals.gross_commission)}</td>
                  <td className="px-3 py-2 text-right">{fmt(totals.clawbacks)}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{fmt(totals.producer_share)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmt(totals.house_share)}</td>
                  <td className="px-3 py-2 text-right">{fmt(totals.adjustments)}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(totals.net_payout)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expanded adjustment detail */}
          {expanded && (() => {
            const p = producers.find(x => x.producer_id === expanded)
            if (!p || !p.adjustment_details?.length) return (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 text-sm text-gray-500">
                No adjustments for {expanded}. Add one below.
              </div>
            )
            return (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold mb-2">{expanded} — Adjustment Details</h3>
                <div className="space-y-1.5">
                  {p.adjustment_details.map((a) => (
                    <div key={a.adj_id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${adjTypeColors[a.adj_type] || 'bg-gray-100 text-gray-700'}`}>
                          {a.adj_type}
                        </span>
                        <span className="text-gray-600 text-xs">{a.description || ''}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{a.period}</span>
                        <span className={`font-medium ${a.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {a.amount > 0 ? '+' : ''}{fmt(a.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </>
      )}

      {tab === 'adjustments' && (
        <>
          <AdjustmentForm producers={producers} onSubmit={handleAddAdj} saving={saving} />
          {adjustments.length === 0 ? (
            <p className="text-gray-500 text-sm">No adjustments yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Producer</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Period</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adjustments.map((a) => (
                    <tr key={a.adj_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{a.adj_id}</td>
                      <td className="px-3 py-2 font-mono text-xs font-medium">{a.producer_id}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${adjTypeColors[a.adj_type] || 'bg-gray-100 text-gray-700'}`}>
                          {a.adj_type}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${a.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {a.amount > 0 ? '+' : ''}{fmt(a.amount)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[200px]">{a.description || '—'}</td>
                      <td className="px-3 py-2 text-xs">{a.period || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          a.status === 'applied' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{a.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
