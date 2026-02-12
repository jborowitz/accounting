import { useEffect, useState } from 'react'
import { api } from '../api/client'

const carrierColors = {
  'Summit National': 'bg-blue-100 text-blue-800',
  'Harbor Mutual': 'bg-gray-100 text-gray-800',
  'Northfield Specialty': 'bg-amber-100 text-amber-800',
}

function fmt(n) {
  return n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'
}

export default function Statements() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listStatements().then((data) => {
      setRows(data.rows || [])
      setLoading(false)
    })
  }, [])

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
                      <a
                        href={api.getStatementPdfUrl(r.statement_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        View PDF
                      </a>
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
    </div>
  )
}
