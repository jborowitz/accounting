import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const STEPS = [
  {
    route: '/',
    title: 'Welcome to Commission Reconciliation',
    body: 'This platform automates the end-to-end commission accounting workflow — from carrier statement ingestion through cash matching, exception resolution, and month-end close. It addresses the structural challenges that make brokerage accounting hard: fragmented sources, timing mismatches, manual reconciliation, and exceptions everywhere.',
    ref: 'Section 0 & 3',
  },
  {
    route: '/',
    title: 'Close Readiness at a Glance',
    body: 'The close readiness banner is the first thing you see — answering the EVP Finance\'s #1 question: "Are we ready to close this month?" Below it, summary cards show match status across all statement lines and bank deposits. Click "Reconcile" to run the matching engine.',
    ref: 'Section 0: Predictable close outcomes',
  },
  {
    route: '/statements',
    title: 'Carrier Statements (The Input Problem)',
    body: 'Carrier statements arrive as PDFs in wildly different formats — Summit National uses formal bordered tables, Wilson Mutual uses compact spreadsheets, Northfield Specialty uses legacy courier-font layouts. Each has different date formats, naming conventions, and column structures. The system parses them all and maps fields with confidence scores.',
    ref: 'Section 5: Statement ingestion — "PDFs/variant formats; inconsistent fields"',
  },
  {
    route: '/results',
    title: 'Matching Engine (Flow A Core)',
    body: 'The matching engine pairs each statement line with bank deposits using probabilistic scoring: exact amount match, policy number in memo, date proximity, carrier name alignment. Lines scoring above threshold match automatically — typically 75%+. The rest flow to the exception queue for human review.',
    ref: 'Flow A: Statement + Cash → Matching Engine',
  },
  {
    route: '/exceptions',
    title: 'Exception Queue (Where Value Lives)',
    body: 'What can\'t auto-match lands here: policy number typos, name variations ("Smith, John" vs "John Smith"), timing mismatches, partial payments, clawbacks, cancellations, endorsements, and reinstatements. Analysts resolve each one — approve, reassign, write off, or defer. Every action is logged in the audit trail.',
    ref: 'Section 3: "Exceptions everywhere" + Section 5: Cash application',
  },
  {
    route: '/revenue',
    title: 'Revenue vs Expected (Variance Analysis)',
    body: 'Expected commission (from AMS/policy data) is compared against what carriers actually reported on statements and what cash has been received. Variance analysis catches underpayments, overpayments, and missing commissions by carrier and line of business — before they compound into real money risk.',
    ref: 'Flow A: Revenue Recognition + Section 5: Accruals',
  },
  {
    route: '/splits',
    title: 'Producer Compensation (Flow B)',
    body: 'Revenue flows through to producers via compensation plans: split percentages, carrier/LOB overrides, fee schedules, and effective dating. Clawbacks, chargebacks, draws, and bonuses are netted against gross commission to calculate payouts. A what-if test harness lets you model rule changes before committing.',
    ref: 'Flow B: Revenue → Producer Compensation (entire flow)',
  },
  {
    route: '/close',
    title: 'Month-End Close (Tying It Together)',
    body: 'The close checklist tracks every step: statements received, matching complete, cash coverage verified, exceptions resolved, accruals posted, journal entries ready. Blocking items surface automatically. When everything is green, the period is ready for sign-off — turning a chaotic multi-day close into a predictable, auditable process.',
    ref: 'Section 0: "Predictable close outcomes" + Section 5: Controls/audit',
  },
]

export default function Walkthrough({ step, onStep, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const current = STEPS[step]
  const total = STEPS.length

  // Navigate to the step's route when step changes
  useEffect(() => {
    if (current && location.pathname !== current.route) {
      navigate(current.route)
    }
  }, [step, current, location.pathname, navigate])

  // Keyboard navigation
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowRight' && step < total - 1) onStep(step + 1)
    if (e.key === 'ArrowLeft' && step > 0) onStep(step - 1)
  }, [step, total, onStep, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!current) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Card */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Step indicator + ref */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-600">
                Step {step + 1} of {total}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {current.ref}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {current.title}
            </h3>

            {/* Body */}
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {current.body}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Skip tour (Esc)
              </button>

              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => onStep(step - 1)}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Previous
                  </button>
                )}
                {step < total - 1 ? (
                  <button
                    onClick={() => onStep(step + 1)}
                    className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Finish Tour
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
