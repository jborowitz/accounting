const colors = {
  auto_matched: 'bg-green-100 text-green-800',
  needs_review: 'bg-yellow-100 text-yellow-800',
  unmatched: 'bg-red-100 text-red-800',
  resolved: 'bg-blue-100 text-blue-800',
  open: 'bg-yellow-100 text-yellow-800',
}

const labels = {
  auto_matched: 'Matched',
  needs_review: 'Pending Review',
  unmatched: 'Unmatched',
  resolved: 'Resolved',
  open: 'Open',
}

export default function StatusBadge({ status }) {
  const cls = colors[status] || 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {labels[status] || status}
    </span>
  )
}
