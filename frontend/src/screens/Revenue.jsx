import { useEffect, useState } from 'react'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  const neg = v < 0
  const display = `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  if (neg) return <span className="text-red-600">{`−${display}`}</span>
  return display
}

function VarianceCell({ value, pct }) {
  if (value == null) return '—'
  const v = Number(value)
  const p = Number(pct)
  const color = Math.abs(p) < 1 ? 'text-green-600' : v > 0 ? 'text-yellow-600' : 'text-red-600'
  return (
    <span className={`font-medium ${color}`}>
      {v > 0 ? '+' : ''}{fmt(value)}
      <span className="ml-1 text-xs font-normal">({p > 0 ? '+' : ''}{p}%)</span>
    </span>
  )
}

function SummaryCard({ label, value, sub, accent }) {
  const accents = {
    green: 'border-green-400 bg-green-50',
    yellow: 'border-yellow-400 bg-yellow-50',
    red: 'border-red-400 bg-red-50',
    blue: 'border-blue-400 bg-blue-50',
    purple: 'border-purple-400 bg-purple-50',
    gray: 'border-gray-300 bg-white',
  }
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${accents[accent] || accents.gray}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

function MatchRateBar({ rate }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{rate}%</span>
    </div>
  )
}

export default function Revenue() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('carrier')

  useEffect(() => {
    api.getRevenueSummary().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading revenue data...</p>
  if (!data) return null

  const { totals, by_carrier, by_lob } = data
  const tableData = view === 'carrier' ? by_carrier : by_lob

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Revenue vs Expected</h2>
        <span className="text-sm text-gray-500">{totals.lines} statement lines</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryCard label="Expected" value={fmt(totals.expected)} accent="gray" />
        <SummaryCard label="On Statements" value={fmt(totals.statement)} accent="blue" />
        <SummaryCard label="Matched" value={fmt(totals.matched)} accent="green"
          sub={`${totals.lines > 0 ? Math.round(totals.matched / totals.statement * 100) : 0}% of statement`} />
        <SummaryCard label="Unmatched" value={fmt(totals.unmatched)} accent="red"
          sub="Needs attention" />
        <SummaryCard
          label="Variance"
          value={<VarianceCell value={totals.variance} pct={totals.variance_pct} />}
          accent={Math.abs(totals.variance_pct) < 1 ? 'green' : totals.variance > 0 ? 'yellow' : 'red'}
          sub="Statement vs Expected"
        />
      </div>

      {totals.clawbacks !== 0 && (
        <div className="mb-6 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Clawbacks
          </span>
          <span className="text-purple-700 font-medium">{fmt(totals.clawbacks)}</span>
          <span className="text-purple-500 text-xs">in commission reversals this period</span>
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-1 mb-4">
        {[
          { key: 'carrier', label: 'By Carrier' },
          { key: 'lob', label: 'By Line of Business' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              view === t.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Breakdown table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {view === 'carrier' ? 'Carrier' : 'LOB'}
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Lines</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Expected</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">On Statement</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Variance</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Matched</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Unmatched</th>
              <th className="px-3 py-2 font-medium text-gray-600 w-36">Match Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tableData.map((r) => (
              <tr key={r.name} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-right">{r.lines}</td>
                <td className="px-3 py-2 text-right">{fmt(r.expected)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.statement)}</td>
                <td className="px-3 py-2 text-right">
                  <VarianceCell value={r.variance} pct={r.variance_pct} />
                </td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(r.matched)}</td>
                <td className="px-3 py-2 text-right text-red-700">{fmt(r.unmatched)}</td>
                <td className="px-3 py-2">
                  <MatchRateBar rate={r.match_rate} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-medium">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{totals.lines}</td>
              <td className="px-3 py-2 text-right">{fmt(totals.expected)}</td>
              <td className="px-3 py-2 text-right">{fmt(totals.statement)}</td>
              <td className="px-3 py-2 text-right">
                <VarianceCell value={totals.variance} pct={totals.variance_pct} />
              </td>
              <td className="px-3 py-2 text-right text-green-700">{fmt(totals.matched)}</td>
              <td className="px-3 py-2 text-right text-red-700">{fmt(totals.unmatched)}</td>
              <td className="px-3 py-2">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
