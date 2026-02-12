import { api } from '../api/client'

const exports = [
  {
    name: 'accrual.csv',
    title: 'Accrual Report',
    description: 'All open items for period-end accrual. Includes expected, on-statement, cash received, and open accrual amounts per line.',
    icon: '📊',
    accent: 'amber',
  },
  {
    name: 'journal.csv',
    title: 'Journal Entries',
    description: 'Resolved items formatted as journal entries ready for GL posting. Includes debit/credit accounts, amounts, and posting status.',
    icon: '📒',
    accent: 'indigo',
  },
  {
    name: 'producer-payout.csv',
    title: 'Producer Payout',
    description: 'Commission summary by producer for payout processing. Includes matched, pending, clawback, and net payout amounts.',
    icon: '💰',
    accent: 'green',
  },
]

const accentStyles = {
  amber: 'border-amber-200 hover:border-amber-400 bg-amber-50/30',
  indigo: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/30',
  green: 'border-green-200 hover:border-green-400 bg-green-50/30',
}

export default function Exports() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Exports</h2>
        <span className="text-sm text-gray-500">{exports.length} reports available</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {exports.map((exp) => (
          <div key={exp.name} className={`rounded-lg border-2 p-5 transition-colors ${accentStyles[exp.accent]}`}>
            <div className="text-2xl mb-3">{exp.icon}</div>
            <h3 className="text-sm font-semibold mb-1">{exp.title}</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">{exp.description}</p>
            <div className="flex items-center gap-2">
              <a
                href={api.getExportUrl(exp.name)}
                download
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded hover:bg-gray-700"
              >
                Download CSV
              </a>
              <span className="text-xs text-gray-400">{exp.name}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold mb-2">Export Notes</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>Exports are generated in real-time from the latest match run and current data.</li>
          <li>Accrual and journal exports reflect the current reconciliation state.</li>
          <li>Producer payout includes netting of clawbacks against earned commissions.</li>
          <li>All exports are logged in the Audit Trail for compliance tracking.</li>
        </ul>
      </div>
    </div>
  )
}
