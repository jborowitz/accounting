import { useEffect, useState } from 'react'
import { api } from '../api/client'

const statusBadge = {
  auto_matched: 'bg-green-100 text-green-800',
  needs_review: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-blue-100 text-blue-800',
  unmatched: 'bg-red-100 text-red-800',
}

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  const cls = v < 0 ? 'text-red-600' : ''
  return <span className={cls}>${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
}

export default function Transactions() {
  const [rows, setRows] = useState([])
  const [carriers, setCarriers] = useState([])
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (counterparty) => {
    setLoading(true)
    api.listBankTransactions(counterparty || undefined).then((data) => {
      setRows(data.rows || [])
      if (data.carriers) setCarriers(data.carriers)
      setLoading(false)
    })
  }

  useEffect(() => { load(filter) }, [filter])

  const filtered = statusFilter
    ? rows.filter((r) => r.match_status === statusFilter)
    : rows

  const matched = rows.filter((r) => r.match_status === 'auto_matched').length
  const review = rows.filter((r) => r.match_status === 'needs_review').length
  const unmatched = rows.filter((r) => r.match_status === 'unmatched').length
  const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Bank Transactions</h2>
        <span className="text-sm text-gray-500">{filtered.length} transactions</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border-l-4 border-gray-300 bg-white p-3 shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Total Received</div>
          <div className="mt-1 text-lg font-bold">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <button onClick={() => setStatusFilter(s => s === 'auto_matched' ? '' : 'auto_matched')}
          className={`rounded-lg border-l-4 border-green-400 p-3 shadow-sm text-left ${statusFilter === 'auto_matched' ? 'bg-green-100 ring-2 ring-green-400' : 'bg-green-50'}`}>
          <div className="text-xs text-gray-500 uppercase">Matched</div>
          <div className="mt-1 text-lg font-bold text-green-700">{matched}</div>
        </button>
        <button onClick={() => setStatusFilter(s => s === 'needs_review' ? '' : 'needs_review')}
          className={`rounded-lg border-l-4 border-yellow-400 p-3 shadow-sm text-left ${statusFilter === 'needs_review' ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-yellow-50'}`}>
          <div className="text-xs text-gray-500 uppercase">Review</div>
          <div className="mt-1 text-lg font-bold text-yellow-700">{review}</div>
        </button>
        <button onClick={() => setStatusFilter(s => s === 'unmatched' ? '' : 'unmatched')}
          className={`rounded-lg border-l-4 border-red-400 p-3 shadow-sm text-left ${statusFilter === 'unmatched' ? 'bg-red-100 ring-2 ring-red-400' : 'bg-red-50'}`}>
          <div className="text-xs text-gray-500 uppercase">Unmatched</div>
          <div className="mt-1 text-lg font-bold text-red-700">{unmatched}</div>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="">All Carriers</option>
          {carriers.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(filter || statusFilter) && (
          <button
            onClick={() => { setFilter(''); setStatusFilter('') }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Txn ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Posted</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Counterparty</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Memo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Match Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Matched Line</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.bank_txn_id} className={`hover:bg-gray-50 ${Number(r.amount) < 0 ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-2 font-mono text-xs">{r.bank_txn_id}</td>
                  <td className="px-3 py-2 text-xs">{r.posted_date}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(r.amount)}</td>
                  <td className="px-3 py-2 text-xs">{r.counterparty}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{r.memo}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge[r.match_status] || statusBadge.unmatched}`}>
                      {r.match_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {r.matched_line_id || '—'}
                    {r.confidence != null && (
                      <span className="ml-1 text-gray-400">({(r.confidence * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
