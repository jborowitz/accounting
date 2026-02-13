import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const statusBadge = {
  auto_matched: 'bg-green-100 text-green-800',
  needs_review: 'bg-amber-100 text-amber-800',
  unmatched: 'bg-red-100 text-red-800',
  resolved: 'bg-blue-100 text-blue-800',
}

export default function RunComparison() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | improved | regressed
  const navigate = useNavigate()

  useEffect(() => {
    api.getRunComparison().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  if (!data.available) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Run Comparison</h2>
        <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-600 mb-2">{data.message}</p>
          <button onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const filteredChanges = data.changes.filter((c) => {
    if (filter === 'improved') return c.old_status && ['needs_review', 'unmatched'].includes(c.old_status) && ['auto_matched', 'resolved'].includes(c.new_status)
    if (filter === 'regressed') return c.old_status && ['auto_matched', 'resolved'].includes(c.old_status) && ['needs_review', 'unmatched'].includes(c.new_status)
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Recalculation Comparison</h2>
          <p className="text-sm text-gray-500">Comparing two most recent match runs</p>
        </div>
      </div>

      {/* Run headers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="text-xs text-gray-500 uppercase mb-1">Previous Run (A)</div>
          <div className="font-mono text-sm font-medium">{data.run_a.run_id}</div>
          <div className="text-xs text-gray-400 mt-1">{data.run_a.created_at}</div>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-green-700">{data.run_a.auto_matched} matched</span>
            <span className="text-amber-700">{data.run_a.needs_review} review</span>
            <span className="text-red-700">{data.run_a.unmatched} unmatched</span>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
          <div className="text-xs text-blue-600 uppercase mb-1">Current Run (B)</div>
          <div className="font-mono text-sm font-medium">{data.run_b.run_id}</div>
          <div className="text-xs text-gray-400 mt-1">{data.run_b.created_at}</div>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-green-700">{data.run_b.auto_matched} matched</span>
            <span className="text-amber-700">{data.run_b.needs_review} review</span>
            <span className="text-red-700">{data.run_b.unmatched} unmatched</span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border-l-4 border-blue-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Total Changes</div>
          <div className="mt-1 text-2xl font-bold">{data.total_changes}</div>
        </div>
        <div className="rounded-lg border-l-4 border-green-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Improved</div>
          <div className="mt-1 text-2xl font-bold text-green-700">{data.improved}</div>
        </div>
        <div className="rounded-lg border-l-4 border-red-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Regressed</div>
          <div className="mt-1 text-2xl font-bold text-red-700">{data.regressed}</div>
        </div>
        <div className="rounded-lg border-l-4 border-purple-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Avg Confidence Δ</div>
          <div className={`mt-1 text-2xl font-bold ${data.avg_confidence_delta > 0 ? 'text-green-700' : data.avg_confidence_delta < 0 ? 'text-red-700' : ''}`}>
            {data.avg_confidence_delta > 0 ? '+' : ''}{(data.avg_confidence_delta * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Status transitions */}
      {data.status_transitions.length > 0 && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold mb-2">Status Transitions</h3>
          <div className="flex flex-wrap gap-2">
            {data.status_transitions.map((t) => (
              <div key={t.transition} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-xs">
                <span className="font-medium">{t.transition}</span>
                <span className="px-1.5 py-0.5 bg-gray-200 rounded-full font-bold">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'all', label: `All Changes (${data.total_changes})` },
          { key: 'improved', label: `Improved (${data.improved})` },
          { key: 'regressed', label: `Regressed (${data.regressed})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              filter === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Changes table */}
      {filteredChanges.length === 0 ? (
        <p className="text-gray-500 text-sm">No changes match this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Line ID</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Previous Status</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">New Status</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Confidence Δ</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredChanges.map((c) => (
                <tr key={c.line_id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/review/${c.line_id}`)}>
                  <td className="px-3 py-2 font-mono text-xs">{c.line_id}</td>
                  <td className="px-3 py-2 text-center">
                    {c.old_status ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[c.old_status] || 'bg-gray-100'}`}>
                        {c.old_status}
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-300">→</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[c.new_status] || 'bg-gray-100'}`}>
                      {c.new_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.confidence_delta != null ? (
                      <span className={`text-xs font-medium ${c.confidence_delta > 0 ? 'text-green-600' : c.confidence_delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {c.confidence_delta > 0 ? '+' : ''}{(c.confidence_delta * 100).toFixed(1)}%
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[300px]">{c.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
