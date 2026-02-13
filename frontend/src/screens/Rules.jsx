import { useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function Rules() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.listRules()
    setRows(data.rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addRule = async (e) => {
    e.preventDefault()
    if (!source.trim() || !target.trim()) return
    setSaving(true)
    try {
      await api.createRule({
        source_policy_number: source.trim(),
        target_policy_number: target.trim(),
        note: note.trim() || null,
      })
      setSource('')
      setTarget('')
      setNote('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo(
    () => [
      { accessorKey: 'source_policy_number', header: 'Source Policy #' },
      { accessorKey: 'target_policy_number', header: 'Target Policy #' },
      { accessorKey: 'note', header: 'Note' },
      { accessorKey: 'updated_at', header: 'Updated' },
    ],
    [],
  )

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Policy Corrections</h2>

      <form onSubmit={addRule} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium mb-3">Add Rule</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Source Policy #</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              className="px-2 py-1.5 border border-gray-300 rounded text-sm w-44"
              placeholder="POL-TYPO-1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target Policy #</label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              className="px-2 py-1.5 border border-gray-300 rounded text-sm w-44"
              placeholder="POL-000001"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm w-52"
              placeholder="Optional note..."
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Rule'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No policy corrections yet. Add one above.</p>
      ) : (
        <DataTable data={rows} columns={columns} />
      )}
    </div>
  )
}
