import { useEffect, useState } from 'react'
import { api } from '../api/client'

const carrierColors = {
  'Summit National': 'bg-blue-100 text-blue-800',
  'Wilson Mutual': 'bg-teal-100 text-teal-800',
  'Northfield Specialty': 'bg-amber-100 text-amber-800',
}

function fmt(n) {
  return n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'
}

function PdfViewer({ statementId, onClose }) {
  const url = api.getStatementPdfUrl(statementId)
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Slide-out panel */}
      <div className="relative ml-auto w-full max-w-3xl bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="font-semibold text-sm">{statementId}</h3>
            <p className="text-xs text-gray-500">Carrier Commission Statement</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <iframe
            src={url}
            title={statementId}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  )
}

export default function Statements() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingPdf, setViewingPdf] = useState(null)

  useEffect(() => {
    api.listStatements().then((data) => {
      setRows(data.rows || [])
      setLoading(false)
    })
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!viewingPdf) return
    const handler = (e) => { if (e.key === 'Escape') setViewingPdf(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [viewingPdf])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Carrier Statements</h2>
        <span className="text-sm text-gray-500">{rows.length} statements</span>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No statements found. Run the data generator first.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Statement ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Carrier</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Lines</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total Premium</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total Commission</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Date Range</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.statement_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.statement_id}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${carrierColors[r.carrier_name] || 'bg-gray-100 text-gray-700'}`}>
                      {r.carrier_name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.line_count}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.total_premium)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(r.total_commission)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {r.min_effective_date} — {r.max_effective_date}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.pdf_path ? (
                      <button
                        onClick={() => setViewingPdf(r.statement_id)}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        View PDF
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingPdf && (
        <PdfViewer statementId={viewingPdf} onClose={() => setViewingPdf(null)} />
      )}
    </div>
  )
}
