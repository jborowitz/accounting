import { useEffect, useState, useRef } from 'react'
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-3xl bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="font-semibold text-sm">{statementId}</h3>
            <p className="text-xs text-gray-500">Carrier Commission Statement</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} download
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
              Download
            </a>
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <iframe src={url} title={statementId} className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  )
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500">{pct}%</span>
    </div>
  )
}

function UploadSimulation({ onClose }) {
  const [phase, setPhase] = useState('idle') // idle, uploading, parsing, done
  const [carrier, setCarrier] = useState('')
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(0)
  const dropRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const startUpload = async (selectedCarrier) => {
    setPhase('uploading')
    setProgress(0)

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(r => setTimeout(r, 200))
      setProgress(i)
    }

    setPhase('parsing')
    setProgress(0)

    // Simulate parsing progress
    const data = await api.uploadStatement(selectedCarrier || undefined)
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 50))
      setProgress(i)
    }

    setResult(data)
    setPhase('done')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    // We don't actually parse the file — just trigger the simulation
    startUpload(carrier)
  }

  if (phase === 'done' && result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Extraction Complete</h3>
            <p className="text-xs text-gray-500">
              {result.carrier} · {result.statement_id} · {result.lines_extracted} lines · Avg confidence: {(result.avg_confidence * 100).toFixed(0)}%
            </p>
          </div>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
        </div>
        <div className="overflow-x-auto rounded border border-gray-200 max-h-72 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-gray-600">Line</th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-600">Policy</th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-600">Insured</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">Premium</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">Commission</th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-600">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.extracted_lines.map((l) => (
                <tr key={l.line_id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-mono">{l.line_id}</td>
                  <td className="px-2 py-1.5 font-mono">{l.policy_number}</td>
                  <td className="px-2 py-1.5 truncate max-w-[140px]">{l.insured_name}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(l.written_premium)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{fmt(l.gross_commission)}</td>
                  <td className="px-2 py-1.5">
                    <ConfidenceBar value={l.extraction_confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="text-xs text-gray-500">
            Field confidence: {result.extracted_lines[0] && Object.entries(result.extracted_lines[0].field_confidences || {}).map(([k, v]) => (
              <span key={k} className={`ml-2 ${v < 0.85 ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                {k}: {(v * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'uploading' || phase === 'parsing') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold mb-2">
          {phase === 'uploading' ? 'Uploading Statement...' : 'AI Parsing in Progress...'}
        </h3>
        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all duration-200 ${phase === 'uploading' ? 'bg-blue-500' : 'bg-green-500'}`}
            style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gray-500">
          {phase === 'uploading'
            ? 'Transferring document to processing pipeline...'
            : 'Extracting fields: policy numbers, amounts, dates, insured names...'}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={dropRef}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-8 mb-6 text-center transition-colors ${
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50/50'
      }`}
    >
      <div className="text-3xl mb-2">📄</div>
      <h3 className="text-sm font-semibold mb-1">Upload Carrier Statement</h3>
      <p className="text-xs text-gray-500 mb-4">Drag & drop a PDF here, or click to simulate upload</p>
      <div className="flex items-center justify-center gap-3">
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded">
          <option value="">Any carrier</option>
          <option value="Summit National">Summit National</option>
          <option value="Wilson Mutual">Wilson Mutual</option>
          <option value="Northfield Specialty">Northfield Specialty</option>
        </select>
        <button onClick={() => startUpload(carrier)}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
          Simulate Upload
        </button>
      </div>
    </div>
  )
}

export default function Statements() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingPdf, setViewingPdf] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    api.listStatements().then((data) => {
      setRows(data.rows || [])
      setLoading(false)
    })
  }, [])

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
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{rows.length} statements</span>
          <button onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
            {showUpload ? 'Hide Upload' : 'Upload Statement'}
          </button>
        </div>
      </div>

      {showUpload && <UploadSimulation onClose={() => setShowUpload(false)} />}

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
