import { useEffect, useState } from 'react'
import { api } from '../api/client'

const carrierColors = {
  'Summit National': 'border-blue-300 bg-blue-50',
  'Wilson Mutual': 'border-teal-300 bg-teal-50',
  'Northfield Specialty': 'border-amber-300 bg-amber-50',
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 95 ? 'bg-green-500' : pct >= 90 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-8">{pct}%</span>
    </div>
  )
}

function MappingCard({ mapping, expanded, onToggle }) {
  return (
    <div className={`rounded-lg border-l-4 border ${carrierColors[mapping.carrier] || 'border-gray-200 bg-white'} overflow-hidden`}>
      <button onClick={onToggle} className="w-full text-left p-5 hover:bg-white/50 transition-colors">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-base font-semibold">{mapping.carrier}</h3>
            <p className="text-xs text-gray-500">{mapping.format}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{Math.round(mapping.avg_confidence * 100)}%</div>
            <div className="text-xs text-gray-500">avg confidence</div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span>Date: <span className="font-mono text-gray-700">{mapping.date_format}</span></span>
          <span>Names: <span className="text-gray-700">{mapping.name_format}</span></span>
          <span>{mapping.sample_count} lines processed</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-5 bg-white/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Field mappings */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Field Mappings</h4>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">Source Column</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">Target Field</th>
                      <th className="px-3 py-1.5 text-center font-medium text-gray-600">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mapping.field_mappings.map((f) => (
                      <tr key={f.target_field} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono">{f.source_column}</td>
                        <td className="px-3 py-1.5">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                            {f.target_field}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <ConfidenceBar value={f.confidence} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Known issues */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Known Issues & Variations</h4>
              {mapping.known_issues.length === 0 ? (
                <p className="text-xs text-gray-400">No known issues.</p>
              ) : (
                <div className="space-y-2">
                  {mapping.known_issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 bg-amber-50 rounded border border-amber-100">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">!</span>
                      <span className="text-xs text-amber-800">{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              <h4 className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">Format Details</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Document Format</span>
                  <span className="font-medium">{mapping.format}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Date Format</span>
                  <span className="font-mono">{mapping.date_format}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Name Convention</span>
                  <span className="font-medium">{mapping.name_format}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Lines Processed</span>
                  <span className="font-medium">{mapping.sample_count}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CarrierMappings() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.getCarrierMappings().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!data) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Carrier Field Mappings</h2>
          <p className="text-sm text-gray-500">How each carrier's statement format maps to our schema</p>
        </div>
        <span className="text-sm text-gray-500">{data.mappings.length} carriers configured</span>
      </div>

      <div className="space-y-4">
        {data.mappings.map((m) => (
          <MappingCard
            key={m.carrier}
            mapping={m}
            expanded={expanded === m.carrier}
            onToggle={() => setExpanded(expanded === m.carrier ? null : m.carrier)}
          />
        ))}
      </div>
    </div>
  )
}
