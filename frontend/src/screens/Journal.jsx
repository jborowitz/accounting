import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

const typeBadge = {
  cash_receipt: 'bg-green-100 text-green-800',
  variance: 'bg-yellow-100 text-yellow-800',
  clawback: 'bg-purple-100 text-purple-800',
  accrual: 'bg-amber-100 text-amber-800',
}

const statusBadge = {
  posted: 'bg-green-100 text-green-800',
  accrued: 'bg-amber-100 text-amber-800',
  pending_review: 'bg-red-100 text-red-800',
}

export default function Journal() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => {
    api.getJournal().then((d) => { setData(d); setLoading(false) })
  }, [])

  const handlePost = async () => {
    setPosting(true)
    await api.postJournal()
    setPosted(true)
    setPosting(false)
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  let entries = data.entries
  if (typeFilter) entries = entries.filter(e => e.type === typeFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Journal Entries</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{data.count} entries</span>
          <button onClick={handlePost} disabled={posting || posted}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white ${posted ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
            {posted ? 'Posted to GL' : posting ? 'Posting...' : 'Post to GL'}
          </button>
        </div>
      </div>

      {posted && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          Journal entries posted to GL (simulated). See Audit Trail for event log.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border-l-4 border-green-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Posted</div>
          <div className="mt-1 text-xl font-bold">{fmt(data.totals.posted)}</div>
          <div className="text-xs text-gray-400">{data.type_counts.cash_receipt || 0} cash + {data.type_counts.variance || 0} variance</div>
        </div>
        <div className="rounded-lg border-l-4 border-amber-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Accrued</div>
          <div className="mt-1 text-xl font-bold">{fmt(data.totals.accrued)}</div>
          <div className="text-xs text-gray-400">{data.type_counts.accrual || 0} entries</div>
        </div>
        <div className="rounded-lg border-l-4 border-red-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Pending Review</div>
          <div className="mt-1 text-xl font-bold">{fmt(data.totals.pending_review)}</div>
          <div className="text-xs text-gray-400">{data.type_counts.clawback || 0} clawbacks</div>
        </div>
        <div className="rounded-lg border-l-4 border-blue-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Total Entries</div>
          <div className="mt-1 text-xl font-bold">{data.count}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-300 rounded">
          <option value="">All types</option>
          <option value="cash_receipt">Cash Receipt</option>
          <option value="variance">Variance</option>
          <option value="accrual">Accrual</option>
          <option value="clawback">Clawback</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">JE ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Line</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Debit</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Credit</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.slice(0, 300).map((e) => (
              <tr key={e.je_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{e.je_id}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to={`/review/${e.line_id}`} className="text-blue-600 hover:underline">{e.line_id}</Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge[e.type] || 'bg-gray-100'}`}>
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{e.debit_account}</td>
                <td className="px-3 py-2 text-xs">{e.credit_account}</td>
                <td className="px-3 py-2 text-right font-medium">{fmt(e.amount)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[e.status] || 'bg-gray-100'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate">{e.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
