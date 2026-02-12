import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

function Card({ label, value, accent }) {
  const colors = {
    green: 'border-green-400 bg-green-50',
    yellow: 'border-yellow-400 bg-yellow-50',
    red: 'border-red-400 bg-red-50',
    blue: 'border-blue-400 bg-blue-50',
    gray: 'border-gray-300 bg-white',
  }
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${colors[accent] || colors.gray}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value ?? '—'}</div>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [runs, setRuns] = useState([])
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(null)

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
          <Card label="Statement Rows" value={summary.statement_rows} accent="gray" />
          <Card label="Bank Rows" value={summary.bank_rows} accent="gray" />
          <Card label="Auto-Matched" value={summary.status_breakdown?.auto_matched} accent="green" />
          <Card label="Needs Review" value={summary.status_breakdown?.needs_review} accent="yellow" />
          <Card label="Unmatched" value={summary.status_breakdown?.unmatched} accent="red" />
          <Card label="Case Rows" value={summary.case_rows} accent="blue" />
        </div>
      )}

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
