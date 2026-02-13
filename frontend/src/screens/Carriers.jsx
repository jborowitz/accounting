import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600">−${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function MatchRateBar({ rate }) {
  const color = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-12 text-right">{rate}%</span>
    </div>
  )
}

function CarrierCard({ carrier, expanded, onToggle }) {
  const navigate = useNavigate()
  const donutData = [
    { name: 'Auto-Matched', value: carrier.auto_matched, color: '#22c55e' },
    { name: 'Needs Review', value: carrier.needs_review, color: '#eab308' },
    { name: 'Unmatched', value: carrier.unmatched, color: '#ef4444' },
    { name: 'Resolved', value: carrier.resolved, color: '#3b82f6' },
  ].filter(d => d.value > 0)

  return (
    <div className={`bg-white rounded-lg border ${expanded ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'} overflow-hidden`}>
      <button onClick={onToggle} className="w-full text-left p-5 hover:bg-gray-50/50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">{carrier.carrier}</h3>
            <p className="text-xs text-gray-500">{carrier.statements} statements · {carrier.lines} lines</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{fmt(carrier.total_commission)}</div>
            <div className="text-xs text-gray-500">commission</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Match Rate</div>
          <MatchRateBar rate={carrier.match_rate} />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Premium: {fmt(carrier.total_premium)}</span>
          <span>Avg Confidence: {(carrier.avg_confidence * 100).toFixed(1)}%</span>
          {carrier.clawbacks > 0 && (
            <span className="text-purple-600">{carrier.clawbacks} clawbacks ({fmt(carrier.clawback_amount)})</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-5 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Match distribution donut */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Match Distribution</h4>
              <div className="flex items-center gap-4">
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                        dataKey="value" stroke="none">
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} lines`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-600">{d.name}</span>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top exceptions */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Common Exceptions</h4>
              {carrier.top_exceptions.length === 0 ? (
                <p className="text-xs text-gray-400">No exceptions</p>
              ) : (
                <div className="space-y-2">
                  {carrier.top_exceptions.map((e) => (
                    <div key={e.reason} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{e.reason}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
            <button onClick={() => navigate(`/results?carrier=${encodeURIComponent(carrier.carrier)}`)}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100">
              View Match Results
            </button>
            <button onClick={() => navigate('/aging')}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded hover:bg-amber-100">
              View Aging
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Carriers() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.getCarriers().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Carrier Scorecard</h2>
        <span className="text-sm text-gray-500">{data.carriers.length} carriers</span>
      </div>

      <div className="space-y-4">
        {data.carriers.map((c) => (
          <CarrierCard
            key={c.carrier}
            carrier={c}
            expanded={expanded === c.carrier}
            onToggle={() => setExpanded(expanded === c.carrier ? null : c.carrier)}
          />
        ))}
      </div>
    </div>
  )
}
