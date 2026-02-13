import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

const bucketColors = { '0-7d': '#22c55e', '8-30d': '#eab308', '31-60d': '#f97316', '60+d': '#ef4444' }
const severityBadge = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function Aging() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bucketFilter, setBucketFilter] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')

  useEffect(() => {
    api.getAging().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  const chartData = Object.entries(data.buckets).map(([k, v]) => ({
    name: k, count: v.count, amount: v.amount, fill: bucketColors[k],
  }))

  let items = data.items
  if (bucketFilter) items = items.filter(i => i.bucket === bucketFilter)
  if (carrierFilter) items = items.filter(i => i.carrier_name === carrierFilter)
  const carriers = [...new Set(data.items.map(i => i.carrier_name))].sort()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Variance & Aging</h2>
        <div className="text-sm text-gray-500">{data.total_open} open items · {fmt(data.total_amount)}</div>
      </div>

      {/* Aging buckets chart + summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Aging Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, 'Items']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}
                  onClick={(entry) => setBucketFilter(bucketFilter === entry.name ? '' : entry.name)}
                  style={{ cursor: 'pointer' }}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} opacity={bucketFilter && bucketFilter !== entry.name ? 0.3 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-3">
            {chartData.map((d) => (
              <button key={d.name}
                onClick={() => setBucketFilter(bucketFilter === d.name ? '' : d.name)}
                className={`text-xs px-2 py-1 rounded ${bucketFilter === d.name ? 'ring-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: d.fill + '20', color: d.fill }}>
                <span className="font-medium">{d.name}</span>: {d.count} ({fmt(d.amount)})
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* By carrier */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-2">By Carrier</h3>
            <div className="space-y-2">
              {data.by_carrier.map((c) => (
                <div key={c.carrier} className="flex items-center justify-between">
                  <button onClick={() => setCarrierFilter(carrierFilter === c.carrier ? '' : c.carrier)}
                    className={`text-sm ${carrierFilter === c.carrier ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
                    {c.carrier}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{c.count} items</span>
                    <span className="text-sm font-medium">{fmt(c.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By reason */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-2">By Reason</h3>
            <div className="space-y-1.5">
              {data.by_reason.slice(0, 8).map((r) => (
                <div key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{r.reason}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{r.count}</span>
                    <span className="font-medium">{fmt(r.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold">Open Items</h3>
        {(bucketFilter || carrierFilter) && (
          <button onClick={() => { setBucketFilter(''); setCarrierFilter('') }}
            className="text-xs text-blue-600 hover:underline">Clear filters</button>
        )}
        <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded ml-auto">
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
              <th className="px-3 py-2 text-left font-medium text-gray-600">Insured</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Txn Date</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Age</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Bucket</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.slice(0, 200).map((i) => (
              <tr key={i.line_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to={`/review/${i.line_id}`} className="text-blue-600 hover:underline">{i.line_id}</Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{i.policy_number}</td>
                <td className="px-3 py-2 text-xs">{i.carrier_name}</td>
                <td className="px-3 py-2 text-xs truncate max-w-[120px]">{i.insured_name}</td>
                <td className="px-3 py-2 text-right font-medium">{fmt(i.commission)}</td>
                <td className="px-3 py-2 text-xs">{i.txn_date}</td>
                <td className="px-3 py-2 text-right text-xs">{i.age_days}d</td>
                <td className="px-3 py-2 text-center">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                    backgroundColor: (bucketColors[i.bucket] || '#999') + '20',
                    color: bucketColors[i.bucket] || '#999',
                  }}>{i.bucket}</span>
                </td>
                <td className="px-3 py-2 text-xs">{i.reason}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge[i.severity] || 'bg-gray-100'}`}>
                    {i.severity}
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
