import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'

const STATUS_OPTIONS = ['', 'auto_matched', 'needs_review', 'unmatched', 'resolved']

function fmt(n) {
  if (!n) return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600 font-medium">−${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export default function MatchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [runId, setRunId] = useState(null)
  const [loading, setLoading] = useState(true)

  const statusFilter = searchParams.get('status') || ''
  const reasonFilter = searchParams.get('reason') || ''

  useEffect(() => {
    setLoading(true)
    api.listMatchResults(statusFilter || undefined).then((data) => {
      setRows(data.rows)
      setRunId(data.run_id)
      setLoading(false)
    })
  }, [statusFilter])

  const filtered = reasonFilter
    ? rows.filter((r) => r.reason?.includes(reasonFilter) || r.txn_type === reasonFilter)
    : rows

  const clawbackCount = rows.filter((r) => r.txn_type === 'clawback').length

  const columns = useMemo(
    () => [
      {
        accessorKey: 'line_id',
        header: 'Line ID',
        cell: ({ getValue }) => (
          <Link to={`/review/${getValue()}`} className="text-blue-600 hover:text-blue-800 hover:underline font-mono">
            {getValue()}
          </Link>
        ),
      },
      { accessorKey: 'policy_number', header: 'Policy #' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      },
      {
        accessorKey: 'txn_type',
        header: 'Type',
        cell: ({ getValue }) => {
          const v = getValue()
          if (v === 'clawback') return (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              clawback
            </span>
          )
          return <span className="text-gray-500 text-xs">{v}</span>
        },
      },
      {
        accessorKey: 'gross_commission',
        header: 'Commission',
        cell: ({ getValue }) => fmt(getValue()),
      },
      {
        accessorKey: 'confidence',
        header: 'Confidence',
        cell: ({ getValue }) => (getValue() * 100).toFixed(1) + '%',
      },
      { accessorKey: 'matched_bank_txn_id', header: 'Bank Txn ID' },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ getValue }) => <span className="text-xs">{getValue()}</span>,
      },
    ],
    [],
  )

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Match Results</h2>
        {runId && (
          <span className="text-xs text-gray-500 font-mono">{runId}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div>
          <label className="text-sm text-gray-600 mr-2">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setFilter('status', e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </div>

        {clawbackCount > 0 && (
          <button
            onClick={() => setFilter('reason', reasonFilter === 'clawback' ? '' : 'clawback')}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              reasonFilter === 'clawback'
                ? 'bg-purple-100 text-purple-800 border-purple-300'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-purple-50'
            }`}
          >
            Clawbacks ({clawbackCount})
          </button>
        )}

        {(statusFilter || reasonFilter) && (
          <button
            onClick={() => setSearchParams({})}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No results. Run matching from the Dashboard first.</p>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowClassName={(row) => row.txn_type === 'clawback' ? 'bg-purple-50/60' : ''}
        />
      )}
    </div>
  )
}
