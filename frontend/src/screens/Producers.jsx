import { useEffect, useState } from 'react'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600">−${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function MatchBar({ rate }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{rate}%</span>
    </div>
  )
}

export default function Producers() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.getProducers().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  const { producers, totals } = data

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Producer Compensation</h2>
        <span className="text-sm text-gray-500">{totals.producers} producers</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="rounded-lg border-l-4 border-blue-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Gross Commission</div>
          <div className="mt-1 text-xl font-bold">{fmt(totals.total_commission)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-green-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Matched</div>
          <div className="mt-1 text-xl font-bold">{fmt(totals.matched_commission)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-amber-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Pending</div>
          <div className="mt-1 text-xl font-bold">{fmt(totals.pending_commission)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-purple-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Clawbacks</div>
          <div className="mt-1 text-xl font-bold">{fmt(totals.clawbacks)}</div>
        </div>
        <div className="rounded-lg border-l-4 border-teal-400 p-4 bg-white shadow-sm">
          <div className="text-xs text-gray-500 uppercase">Net Payout</div>
          <div className="mt-1 text-xl font-bold">{fmt(totals.net_payout)}</div>
        </div>
      </div>

      {/* Producer table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Producer</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Office</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Lines</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Gross Commission</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Matched</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Pending</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Clawbacks</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Net Payout</th>
              <th className="px-3 py-2 font-medium text-gray-600 w-32">Match Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {producers.map((p) => (
              <tr key={p.producer_id}
                className={`hover:bg-gray-50 cursor-pointer ${expanded === p.producer_id ? 'bg-blue-50' : ''}`}
                onClick={() => setExpanded(expanded === p.producer_id ? null : p.producer_id)}>
                <td className="px-3 py-2 font-mono text-xs font-medium">{p.producer_id}</td>
                <td className="px-3 py-2 text-xs">{p.office}</td>
                <td className="px-3 py-2 text-right">{p.lines}</td>
                <td className="px-3 py-2 text-right">{fmt(p.total_commission)}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(p.matched_commission)}</td>
                <td className="px-3 py-2 text-right text-amber-700">{fmt(p.pending_commission)}</td>
                <td className="px-3 py-2 text-right">{fmt(p.clawbacks)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmt(p.net_payout)}</td>
                <td className="px-3 py-2"><MatchBar rate={p.match_rate} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-medium">
            <tr>
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{producers.reduce((s, p) => s + p.lines, 0)}</td>
              <td className="px-3 py-2 text-right">{fmt(totals.total_commission)}</td>
              <td className="px-3 py-2 text-right text-green-700">{fmt(totals.matched_commission)}</td>
              <td className="px-3 py-2 text-right text-amber-700">{fmt(totals.pending_commission)}</td>
              <td className="px-3 py-2 text-right">{fmt(totals.clawbacks)}</td>
              <td className="px-3 py-2 text-right">{fmt(totals.net_payout)}</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Expanded detail */}
      {expanded && (() => {
        const p = producers.find(x => x.producer_id === expanded)
        if (!p) return null
        return (
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold mb-2">{p.producer_id} Detail</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Carriers:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.carriers.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-gray-500">LOBs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.lobs.map(l => (
                    <span key={l} className="px-2 py-0.5 bg-blue-50 rounded text-xs">{l}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Expected:</span>
                <div className="font-medium mt-1">{fmt(p.total_expected)}</div>
              </div>
              <div>
                <span className="text-gray-500">Variance (Gross - Expected):</span>
                <div className="font-medium mt-1">{fmt(p.total_commission - p.total_expected)}</div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
