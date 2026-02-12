import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600">−${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function SummaryCard({ label, value, sub, accent }) {
  const colors = { green: 'border-green-400', blue: 'border-blue-400', amber: 'border-amber-400', red: 'border-red-400', gray: 'border-gray-300' }
  return (
    <div className={`rounded-lg border-l-4 p-4 bg-white shadow-sm ${colors[accent] || colors.gray}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold">{fmt(value)}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

const statusBadge = {
  settled: 'bg-green-100 text-green-800',
  accrued: 'bg-amber-100 text-amber-800',
  clawback: 'bg-purple-100 text-purple-800',
}

export default function Accruals() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')

  useEffect(() => {
    api.getAccruals().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  const carriers = [...new Set(data.entries.map(e => e.carrier_name))].sort()
  let entries = data.entries
  if (statusFilter) entries = entries.filter(e => e.status === statusFilter)
  if (carrierFilter) entries = entries.filter(e => e.carrier_name === carrierFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Accruals & True-Up</h2>
        <span className="text-sm text-gray-500">{entries.length} lines</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <SummaryCard label="Expected" value={data.totals.expected} accent="gray" />
        <SummaryCard label="On Statement" value={data.totals.on_statement} accent="blue" />
        <SummaryCard label="Cash Received" value={data.totals.cash_received} accent="green" />
        <SummaryCard label="Open Accrual" value={data.totals.accrued} accent="amber" sub="Revenue recognized, cash pending" />
        <SummaryCard label="True-Up Variance" value={data.totals.true_up} accent="red" sub="Cash vs expected" />
      </div>

      {/* Carrier breakdown */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-2">By Carrier</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Carrier</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Expected</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">On Statement</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Cash Received</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Open Accrual</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Lines</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Settled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.by_carrier.map((c) => (
                <tr key={c.carrier} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{c.carrier}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.expected)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.on_statement)}</td>
                  <td className="px-3 py-2 text-right text-green-700">{fmt(c.cash_received)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{fmt(c.accrued)}</td>
                  <td className="px-3 py-2 text-right">{c.lines}</td>
                  <td className="px-3 py-2 text-right">{c.settled}/{c.lines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold">Line Detail</h3>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded">
          <option value="">All statuses</option>
          <option value="settled">Settled</option>
          <option value="accrued">Accrued</option>
          <option value="clawback">Clawback</option>
        </select>
        <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded">
          <option value="">All carriers</option>
          {carriers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Line ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Policy</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Carrier</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Expected</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Statement</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Cash</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Accrued</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">True-Up</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.slice(0, 200).map((e) => (
              <tr key={e.line_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to={`/review/${e.line_id}`} className="text-blue-600 hover:underline">{e.line_id}</Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{e.policy_number}</td>
                <td className="px-3 py-2 text-xs">{e.carrier_name}</td>
                <td className="px-3 py-2 text-right">{fmt(e.expected)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.on_statement)}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(e.cash_received)}</td>
                <td className="px-3 py-2 text-right text-amber-700">{fmt(e.accrued)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.true_up_variance)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[e.status] || 'bg-gray-100'}`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
