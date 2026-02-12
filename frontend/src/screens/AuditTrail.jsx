import { useEffect, useState } from 'react'
import { api } from '../api/client'

const typeColors = {
  match_run: 'bg-blue-100 text-blue-800',
  exception_resolved: 'bg-green-100 text-green-800',
  rule_created: 'bg-purple-100 text-purple-800',
  gl_posting: 'bg-indigo-100 text-indigo-800',
  export: 'bg-amber-100 text-amber-800',
}

const typeIcons = {
  match_run: '⚡',
  exception_resolved: '✓',
  rule_created: '📋',
  gl_posting: '📊',
  export: '📥',
}

function TimelineEvent({ event }) {
  const ts = event.timestamp?.replace('T', ' ').slice(0, 19)
  return (
    <div className="flex gap-3 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
        {typeIcons[event.event_type] || '●'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[event.event_type] || 'bg-gray-100 text-gray-700'}`}>
            {event.event_type}
          </span>
          <span className="text-sm font-medium">{event.action}</span>
          {event.entity_id && (
            <span className="text-xs font-mono text-gray-500">{event.entity_type}:{event.entity_id}</span>
          )}
        </div>
        {event.detail && <p className="text-sm text-gray-600 mt-0.5">{event.detail}</p>}
        {(event.old_value || event.new_value) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {event.old_value && <><span className="line-through">{event.old_value}</span> → </>}
            {event.new_value && <span className="font-medium text-gray-600">{event.new_value}</span>}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">{ts} · {event.actor}</p>
      </div>
    </div>
  )
}

export default function AuditTrail() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.listAuditEvents().then((data) => {
      setEvents(data.rows || [])
      setLoading(false)
    })
  }, [])

  const filtered = filter
    ? events.filter(e => e.event_type === filter)
    : events

  const types = [...new Set(events.map(e => e.event_type))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Audit Trail</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length} events</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded">
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No audit events yet.</p>
          <p className="text-gray-400 text-xs mt-1">Run matching, resolve exceptions, or create rules to generate events.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 px-4">
          {filtered.map((e) => (
            <TimelineEvent key={e.event_id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
