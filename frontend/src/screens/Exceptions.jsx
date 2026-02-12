import { useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '../api/client'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'

function ResolveModal({ exception, onClose, onResolved }) {
  const isClawback = exception.txn_type === 'clawback'
  const [action, setAction] = useState(isClawback ? 'confirm_reversal' : 'manual_link')
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
          {isClawback && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              clawback
            </span>
          )}
        </h3>
        <p className="text-sm text-gray-600 mb-1">
          Policy: <span className="font-mono">{exception.policy_number}</span>
        </p>
        <p className="text-sm text-gray-600 mb-1">
          Confidence: {(exception.confidence * 100).toFixed(1)}% — {exception.reason}
        </p>
        {exception.gross_commission && (
          <p className={`text-sm mb-1 ${isClawback ? 'text-purple-700 font-medium' : 'text-gray-600'}`}>
            Commission: ${Number(exception.gross_commission).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            {isClawback && ' (reversal)'}
          </p>
        )}
        {exception.insured_name && (
          <p className="text-sm text-gray-600 mb-4">
            Insured: {exception.insured_name}
          </p>
        )}

        <label className="block text-sm font-medium mb-1">Action</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-full mb-3 px-2 py-1.5 border border-gray-300 rounded text-sm"
        >
          {isClawback ? (
            <>
              <option value="confirm_reversal">Confirm Reversal</option>
              <option value="dispute_clawback">Dispute Clawback</option>
              <option value="offset_overpayment">Offset Prior Overpayment</option>
              <option value="write_off">Write Off</option>
              <option value="defer">Defer for Review</option>
            </>
          ) : (
            <>
              <option value="manual_link">Manual Link</option>
              <option value="write_off">Write Off</option>
              <option value="defer">Defer</option>
            </>
          )}
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
          placeholder={isClawback ? 'Reason for clawback, offset details...' : 'Optional resolution note...'}
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
            className={`px-3 py-1.5 text-sm text-white rounded disabled:opacity-50 ${
              isClawback ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
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
  const [reasonFilter, setReasonFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.listExceptions(tab)
    setRows(data.rows)
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  const filtered = reasonFilter
    ? rows.filter((r) => r.txn_type === reasonFilter || r.reason?.includes(reasonFilter))
    : rows

  const clawbackCount = rows.filter((r) => r.txn_type === 'clawback').length

  const columns = useMemo(
    () => [
      { accessorKey: 'line_id', header: 'Line ID' },
      { accessorKey: 'policy_number', header: 'Policy #' },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (row) => row.txn_type || 'standard',
        cell: ({ getValue }) => {
          const v = getValue()
          if (v === 'clawback') return (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              clawback
            </span>
          )
          return <span className="text-gray-400 text-xs">{v}</span>
        },
      },
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
                  className={`px-2 py-1 text-xs text-white rounded ${
                    row.original.txn_type === 'clawback'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
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

      <div className="flex gap-1 mb-4 items-center">
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

        {clawbackCount > 0 && (
          <>
            <span className="mx-2 text-gray-300">|</span>
            <button
              onClick={() => setReasonFilter(f => f === 'clawback' ? '' : 'clawback')}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                reasonFilter === 'clawback'
                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-purple-50'
              }`}
            >
              Clawbacks ({clawbackCount})
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {tab === 'open'
            ? 'No open exceptions. Run matching from the Dashboard first.'
            : 'No resolved exceptions yet.'}
        </p>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowClassName={(row) => row.txn_type === 'clawback' ? 'bg-purple-50/60' : ''}
        />
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
