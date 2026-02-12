import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'

function fmt(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (v < 0) return <span className="text-red-600 font-medium">−${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function Field({ label, value, mono }) {
  return (
    <div className="py-1.5">
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className={`text-sm ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

function ScoreBar({ factors, total }) {
  const maxScore = 1.0
  const colors = {
    policy_in_memo: 'bg-blue-500',
    exact_amount: 'bg-green-500',
    near_amount: 'bg-green-300',
    near_date: 'bg-indigo-400',
    soft_date: 'bg-indigo-300',
    carrier_match: 'bg-amber-400',
    name_hint: 'bg-purple-400',
    policy_rule_override: 'bg-teal-400',
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">Confidence Score</span>
        <span className="text-lg font-bold">{(total * 100).toFixed(1)}%</span>
      </div>
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 mb-3">
        {factors.map((f) => (
          <div
            key={f.key}
            className={`${colors[f.key] || 'bg-gray-400'} transition-all`}
            style={{ width: `${(f.weight / maxScore) * 100}%` }}
            title={`${f.label}: +${(f.weight * 100).toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {factors.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2.5 h-2.5 rounded-sm ${colors[f.key] || 'bg-gray-400'}`} />
            <span>{f.label}</span>
            <span className="text-gray-400">+{(f.weight * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionPanel({ lineId, exception, isClawback, onAction }) {
  const [action, setAction] = useState(isClawback ? 'confirm_reversal' : 'manual_link')
  const [bankTxnId, setBankTxnId] = useState(exception?.suggested_bank_txn_id || '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!exception || exception.status !== 'open') {
    if (exception?.status === 'resolved') {
      return (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-800 mb-1">Resolved</div>
          <div className="text-xs text-blue-600">
            Action: {exception.resolution_action}
            {exception.resolution_note && <> — {exception.resolution_note}</>}
          </div>
        </div>
      )
    }
    return null
  }

  const submit = async () => {
    setSaving(true)
    try {
      await api.resolveException({
        line_id: lineId,
        resolution_action: action,
        resolved_bank_txn_id: bankTxnId || null,
        resolution_note: note || null,
      })
      onAction()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${isClawback ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
      <h4 className="text-sm font-semibold mb-3">Resolve Exception</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded">
            {isClawback ? (
              <>
                <option value="confirm_reversal">Confirm Reversal</option>
                <option value="dispute_clawback">Dispute Clawback</option>
                <option value="offset_overpayment">Offset Prior Overpayment</option>
                <option value="write_off">Write Off</option>
                <option value="defer">Defer</option>
              </>
            ) : (
              <>
                <option value="manual_link">Manual Link</option>
                <option value="write_off">Write Off</option>
                <option value="defer">Defer</option>
              </>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Txn ID</label>
          <input type="text" value={bankTxnId} onChange={(e) => setBankTxnId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" placeholder="BTX-000001" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
        </div>
        <button onClick={submit} disabled={saving}
          className={`w-full py-2 text-sm font-medium text-white rounded disabled:opacity-50 ${
            isClawback ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          {saving ? 'Resolving...' : 'Resolve'}
        </button>
      </div>
    </div>
  )
}

export default function Review() {
  const { lineId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    api.getLineDetail(lineId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [lineId])

  if (loading) return <p className="text-gray-500 text-sm p-6">Loading...</p>
  if (error) return <p className="text-red-500 text-sm p-6">Error: {error}</p>
  if (!data) return null

  const { statement: stmt, ams_expected: ams, match_result: mr, exception: ex, bank_transaction: btx, score_factors, audit_events: auditEvents } = data
  const isClawback = stmt?.txn_type === 'clawback'
  const pdfUrl = stmt?.statement_id ? api.getStatementPdfUrl(stmt.statement_id) : null

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header bar */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${isClawback ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold">{lineId}</h2>
          {mr && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            mr.status === 'auto_matched' ? 'bg-green-100 text-green-800' :
            mr.status === 'needs_review' ? 'bg-yellow-100 text-yellow-800' :
            mr.status === 'resolved' ? 'bg-blue-100 text-blue-800' :
            'bg-red-100 text-red-800'
          }`}>{mr.status?.replace('_', ' ')}</span>}
          {isClawback && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">clawback</span>
          )}
        </div>
        <span className="text-xs text-gray-500 font-mono">{stmt?.statement_id}</span>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: PDF */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Source Document</span>
            {pdfUrl && (
              <a href={pdfUrl} download className="text-xs text-blue-600 hover:text-blue-800">Download</a>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {pdfUrl ? (
              <iframe src={pdfUrl} title="Statement PDF" className="w-full h-full border-0" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No PDF available
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Data */}
        <div className="w-1/2 overflow-y-auto">
          <div className="p-5 space-y-6">
            {/* Score breakdown */}
            {mr && score_factors.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <ScoreBar factors={score_factors} total={mr.confidence} />
              </div>
            )}

            {/* Statement line */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Statement Line</h3>
              <div className="grid grid-cols-2 gap-x-6 bg-white p-4 rounded-lg border border-gray-200">
                <Field label="Line ID" value={stmt?.line_id} mono />
                <Field label="Policy" value={stmt?.policy_number} mono />
                <Field label="Insured" value={stmt?.insured_name} />
                <Field label="Carrier" value={stmt?.carrier_name} />
                <Field label="Txn Type" value={stmt?.txn_type} />
                <Field label="Txn Date" value={stmt?.txn_date} />
                <Field label="Effective Date" value={stmt?.effective_date} />
                <Field label="Written Premium" value={fmt(stmt?.written_premium)} />
                <Field label="Gross Commission" value={fmt(stmt?.gross_commission)} />
              </div>
            </div>

            {/* Bank transaction */}
            {btx && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Matched Bank Transaction</h3>
                <div className="grid grid-cols-2 gap-x-6 bg-white p-4 rounded-lg border border-gray-200">
                  <Field label="Txn ID" value={btx.bank_txn_id} mono />
                  <Field label="Posted" value={btx.posted_date} />
                  <Field label="Amount" value={fmt(btx.amount)} />
                  <Field label="Counterparty" value={btx.counterparty} />
                  <Field label="Memo" value={btx.memo} />
                  <Field label="Reference" value={btx.reference} mono />
                </div>
                {/* Amount comparison */}
                {stmt?.gross_commission && btx.amount && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs">
                    <span className="text-gray-500">Commission vs Bank: </span>
                    <span className="font-mono">{fmt(stmt.gross_commission)}</span>
                    <span className="text-gray-400 mx-1">vs</span>
                    <span className="font-mono">{fmt(btx.amount)}</span>
                    {(() => {
                      const diff = Math.abs(Number(stmt.gross_commission) - Number(btx.amount))
                      if (diff < 0.01) return <span className="ml-2 text-green-600 font-medium">Exact match</span>
                      return <span className="ml-2 text-yellow-600 font-medium">Diff: ${diff.toFixed(2)}</span>
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* AMS Expected */}
            {ams && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">AMS Expected</h3>
                <div className="grid grid-cols-2 gap-x-6 bg-white p-4 rounded-lg border border-gray-200">
                  <Field label="Policy" value={ams.policy_number} mono />
                  <Field label="Producer" value={ams.producer_id} mono />
                  <Field label="Office" value={ams.office} />
                  <Field label="LOB" value={ams.lob} />
                  <Field label="Expected Commission" value={fmt(ams.expected_commission)} />
                  <Field label="Effective Date" value={ams.effective_date} />
                </div>
                {/* Variance indicator */}
                {stmt?.gross_commission && ams.expected_commission && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs">
                    <span className="text-gray-500">Statement vs Expected: </span>
                    <span className="font-mono">{fmt(stmt.gross_commission)}</span>
                    <span className="text-gray-400 mx-1">vs</span>
                    <span className="font-mono">{fmt(ams.expected_commission)}</span>
                    {(() => {
                      const actual = Math.abs(Number(stmt.gross_commission))
                      const expected = Number(ams.expected_commission)
                      const pct = expected ? ((actual - expected) / expected * 100).toFixed(1) : 0
                      if (Math.abs(pct) < 1) return <span className="ml-2 text-green-600 font-medium">Match</span>
                      return <span className={`ml-2 font-medium ${Number(pct) < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {Number(pct) > 0 ? '+' : ''}{pct}%
                      </span>
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Action panel */}
            <ActionPanel
              lineId={lineId}
              exception={ex}
              isClawback={isClawback}
              onAction={load}
            />

            {/* Audit timeline */}
            {auditEvents && auditEvents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Audit Trail</h3>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    {auditEvents.map((evt) => (
                      <div key={evt.event_id} className="flex gap-2 text-xs">
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                        <div>
                          <span className="font-medium">{evt.action}</span>
                          {evt.detail && <span className="text-gray-500"> — {evt.detail}</span>}
                          {evt.old_value && evt.new_value && (
                            <span className="text-gray-400"> ({evt.old_value} → {evt.new_value})</span>
                          )}
                          <div className="text-gray-400 mt-0.5">
                            {evt.timestamp?.replace('T', ' ').slice(0, 19)} · {evt.actor}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
