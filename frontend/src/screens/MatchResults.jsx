import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'

const STATUS_OPTIONS = ['', 'auto_matched', 'needs_review', 'unmatched', 'resolved']

export default function MatchResults() {
  const [rows, setRows] = useState([])
  const [runId, setRunId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.listMatchResults(statusFilter || undefined).then((data) => {
      setRows(data.rows)
      setRunId(data.run_id)
      setLoading(false)
    })
  }, [statusFilter])

  const columns = useMemo(
    () => [
      { accessorKey: 'line_id', header: 'Line ID' },
      { accessorKey: 'policy_number', header: 'Policy #' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      },
      {
        accessorKey: 'confidence',
        header: 'Confidence',
        cell: ({ getValue }) => (getValue() * 100).toFixed(1) + '%',
      },
      { accessorKey: 'matched_bank_txn_id', header: 'Bank Txn ID' },
      { accessorKey: 'reason', header: 'Reason' },
    ],
    [],
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Match Results</h2>
        {runId && (
          <span className="text-xs text-gray-500 font-mono">{runId}</span>
        )}
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-600 mr-2">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || 'All'}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No results. Run matching from the Dashboard first.</p>
      ) : (
        <DataTable data={rows} columns={columns} />
      )}
    </div>
  )
}
