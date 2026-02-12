import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../api/client'

function Card({ label, value, accent, onClick }) {
  const colors = {
    green: 'border-green-400 bg-green-50',
    yellow: 'border-yellow-400 bg-yellow-50',
    red: 'border-red-400 bg-red-50',
    blue: 'border-blue-400 bg-blue-50',
    purple: 'border-purple-400 bg-purple-50',
    gray: 'border-gray-300 bg-white',
  }
  const cls = `rounded-lg border-l-4 p-4 shadow-sm ${colors[accent] || colors.gray}`
  if (onClick) {
    return (
      <button onClick={onClick} className={`${cls} text-left hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-shadow`}>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value ?? '—'}</div>
      </button>
    )
  }
  return (
    <div className={cls}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value ?? '—'}</div>
    </div>
  )
}

function fmt(n) {
  if (n == null) return '—'
  const v = Math.abs(Number(n))
  return `−$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [runs, setRuns] = useState([])
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api.getSummary(), api.listMatchRuns(10)])
    setSummary(s)
    setRuns(r.rows)
  }, [])

  useEffect(() => { load() }, [load])

  const runMatch = async () => {
    setRunning(true)
    try {
      const result = await api.createMatchRun()
      setLastResult(result)
      await load()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <button
          onClick={runMatch}
          disabled={running}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Matching'}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card label="Statement Rows" value={summary.statement_rows} accent="gray"
            onClick={() => navigate('/statements')} />
          <Card label="Bank Rows" value={summary.bank_rows} accent="gray"
            onClick={() => navigate('/transactions')} />
          <Card label="Auto-Matched" value={summary.status_breakdown?.auto_matched} accent="green"
            onClick={() => navigate('/results?status=auto_matched')} />
          <Card label="Needs Review" value={summary.status_breakdown?.needs_review} accent="yellow"
            onClick={() => navigate('/exceptions')} />
          <Card label="Unmatched" value={summary.status_breakdown?.unmatched} accent="red"
            onClick={() => navigate('/results?status=unmatched')} />
          <Card label="Case Rows" value={summary.case_rows} accent="blue" />
          {summary.clawback_count > 0 && (
            <Card
              label="Clawbacks"
              value={<span className="text-purple-700">{summary.clawback_count} <span className="text-sm font-normal">{fmt(summary.clawback_total)}</span></span>}
              accent="purple"
              onClick={() => navigate('/results?reason=clawback')}
            />
          )}
        </div>
      )}

      {/* Donut chart */}
      {runs.length > 0 && (() => {
        const latest = runs[0]
        const chartData = [
          { name: 'Auto-Matched', value: latest.auto_matched || 0, color: '#22c55e' },
          { name: 'Needs Review', value: latest.needs_review || 0, color: '#eab308' },
          { name: 'Unmatched', value: latest.unmatched || 0, color: '#ef4444' },
        ].filter(d => d.value > 0)
        const total = chartData.reduce((s, d) => s + d.value, 0)

        return chartData.length > 0 ? (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-3">Match Distribution (Latest Run)</h3>
            <div className="flex items-center gap-8">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      dataKey="value"
                      stroke="none"
                      onClick={(entry) => {
                        const statusMap = { 'Auto-Matched': 'auto_matched', 'Needs Review': 'needs_review', 'Unmatched': 'unmatched' }
                        const s = statusMap[entry.name]
                        if (s === 'needs_review') navigate('/exceptions')
                        else if (s) navigate(`/results?status=${s}`)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} lines`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {chartData.map((d) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-gray-700 flex-1">{d.name}</span>
                    <span className="text-sm font-medium">{d.value}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">{(d.value / total * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null
      })()}

      {lastResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
          Match run <span className="font-mono font-medium">{lastResult.run_id}</span> completed
          — {lastResult.totals.auto_matched} matched, {lastResult.totals.needs_review} review, {lastResult.totals.unmatched} unmatched.
        </div>
      )}

      <h3 className="text-lg font-medium mb-3">Recent Match Runs</h3>
      {runs.length === 0 ? (
        <p className="text-gray-500 text-sm">No match runs yet. Click "Run Matching" to start.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Run ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Created</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Matched</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Review</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Unmatched</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((r) => (
                <tr key={r.run_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.run_id}</td>
                  <td className="px-3 py-2">{r.created_at}</td>
                  <td className="px-3 py-2 text-right text-green-700">{r.auto_matched}</td>
                  <td className="px-3 py-2 text-right text-yellow-700">{r.needs_review}</td>
                  <td className="px-3 py-2 text-right text-red-700">{r.unmatched}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
