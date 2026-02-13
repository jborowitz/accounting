import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const statusColors = {
  complete: 'bg-green-500',
  in_progress: 'bg-amber-500',
  pending: 'bg-gray-300',
}

const statusLabels = {
  complete: 'Complete',
  in_progress: 'In Progress',
  pending: 'Pending',
}

const statusTextColors = {
  complete: 'text-green-700 bg-green-50',
  in_progress: 'text-amber-700 bg-amber-50',
  pending: 'text-gray-500 bg-gray-50',
}

const stepLinks = {
  statements: '/statements',
  matching: '/',
  cash: '/transactions',
  exceptions: '/exceptions',
  accruals: '/accruals',
  journal: '/journal',
}

function ProgressRing({ pct }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{pct}%</span>
        <span className="text-xs text-gray-500">Ready</span>
      </div>
    </div>
  )
}

export default function Close() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const d = await api.getCloseStatus()
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Month-End Close</h2>
          <p className="text-sm text-gray-500">Period: {data.period}</p>
        </div>
        <button onClick={load}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Top section: progress ring + summary cards */}
      <div className="flex items-start gap-8 mb-8">
        <ProgressRing pct={data.overall_pct} />

        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-xs text-gray-500 uppercase">Statements</div>
            <div className="mt-1 text-2xl font-bold">{data.summary.statements}</div>
            <div className="text-xs text-gray-400">{data.summary.statement_lines} lines</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-xs text-gray-500 uppercase">Match Rate</div>
            <div className="mt-1 text-2xl font-bold">{data.summary.match_pct}%</div>
            <div className="text-xs text-gray-400">{data.summary.bank_transactions} bank txns</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-xs text-gray-500 uppercase">Open Exceptions</div>
            <div className={`mt-1 text-2xl font-bold ${data.summary.open_exceptions > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {data.summary.open_exceptions}
            </div>
            <div className="text-xs text-gray-400">
              {data.summary.open_exceptions === 0 ? 'All resolved' : 'Need resolution'}
            </div>
          </div>
        </div>
      </div>

      {/* Blockers */}
      {data.blockers.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 mb-2">Blocking Items</h3>
          <ul className="space-y-1">
            {data.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checklist */}
      <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Close Checklist</h3>
      <div className="space-y-3">
        {data.checklist.map((item) => (
          <div key={item.id}
            className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
              item.status === 'complete' ? 'border-green-200 bg-green-50/50' :
              item.status === 'in_progress' ? 'border-amber-200 bg-amber-50/30' :
              'border-gray-200 bg-white'
            }`}
            onClick={() => stepLinks[item.id] && navigate(stepLinks[item.id])}>
            {/* Status icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.status === 'complete' ? 'bg-green-500 text-white' :
              item.status === 'in_progress' ? 'bg-amber-500 text-white' :
              'bg-gray-200 text-gray-400'
            }`}>
              {item.status === 'complete' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : item.status === 'in_progress' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <span className="w-3 h-3 rounded-full bg-gray-300" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusTextColors[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>
            </div>

            {/* Progress bar */}
            <div className="w-32 flex-shrink-0">
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${statusColors[item.status]}`}
                  style={{ width: `${item.pct}%` }} />
              </div>
              <div className="text-xs text-gray-400 text-right mt-0.5">{item.pct}%</div>
            </div>

            {/* Arrow */}
            {stepLinks[item.id] && (
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Overall status */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        {data.overall_pct >= 100 ? (
          <div>
            <div className="text-lg font-semibold text-green-700">Ready to Close</div>
            <p className="text-sm text-gray-500 mt-1">All steps complete. Period {data.period} is ready for final sign-off.</p>
          </div>
        ) : (
          <div>
            <div className="text-lg font-semibold text-amber-700">{data.completed_steps}/{data.total_steps} Steps Complete</div>
            <p className="text-sm text-gray-500 mt-1">Resolve blocking items above to complete the close process.</p>
          </div>
        )}
      </div>
    </div>
  )
}
