import { useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '../api/client'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'

function ResolveModal({ exception, onClose, onResolved }) {
  const [action, setAction] = useState('manual_link')
  const [bankTxnId, setBankTxnId] = useState(exception.suggested_bank_txn_id || '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.resolveException({
        line_id: exception.line_id,
        resolution_action: action,
        resolved_bank_txn_id: bankTxnId || null,
        resolution_note: note || null,
      })
      onResolved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          Resolve {exception.line_id}
        </h3>
        <p className="text-sm text-gray-600 mb-1">
          Policy: <span className="font-mono">{exception.policy_number}</span>
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Confidence: {(exception.confidence * 100).toFixed(1)}% — {exception.reason}
        </p>

        <label className="block text-sm font-medium mb-1">Action</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-full mb-3 px-2 py-1.5 border border-gray-300 rounded text-sm"
        >
          <option value="manual_link">Manual Link</option>
          <option value="write_off">Write Off</option>
          <option value="defer">Defer</option>
        </select>

        <label className="block text-sm font-medium mb-1">Bank Transaction ID</label>
        <input
          type="text"
          value={bankTxnId}
          onChange={(e) => setBankTxnId(e.target.value)}
          className="w-full mb-3 px-2 py-1.5 border border-gray-300 rounded text-sm"
          placeholder="BTX-000001"
        />

        <label className="block text-sm font-medium mb-1">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full mb-4 px-2 py-1.5 border border-gray-300 rounded text-sm"
          placeholder="Optional resolution note..."
        />

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Resolve'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Exceptions() {
  const [tab, setTab] = useState('open')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.listExceptions(tab)
    setRows(data.rows)
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  const columns = useMemo(
    () => [
      { accessorKey: 'line_id', header: 'Line ID' },
      { accessorKey: 'policy_number', header: 'Policy #' },
      {
        accessorKey: 'confidence',
        header: 'Confidence',
        cell: ({ getValue }) => (getValue() * 100).toFixed(1) + '%',
      },
      { accessorKey: 'reason', header: 'Reason' },
      { accessorKey: 'suggested_bank_txn_id', header: 'Suggested Txn' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      },
      ...(tab === 'open'
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => (
                <button
                  onClick={() => setResolving(row.original)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Resolve
                </button>
              ),
            },
          ]
        : [
            { accessorKey: 'resolution_action', header: 'Resolution' },
            { accessorKey: 'resolution_note', header: 'Note' },
          ]),
    ],
    [tab],
  )

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Exception Queue</h2>

      <div className="flex gap-1 mb-4">
        {['open', 'resolved'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              tab === t
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {tab === 'open'
            ? 'No open exceptions. Run matching from the Dashboard first.'
            : 'No resolved exceptions yet.'}
        </p>
      ) : (
        <DataTable data={rows} columns={columns} />
      )}

      {resolving && (
        <ResolveModal
          exception={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null)
            load()
          }}
        />
      )}
    </div>
  )
}
