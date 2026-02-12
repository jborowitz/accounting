# Feature Backlog — Commission Reconciliation Demo

_Prioritized against OneDigital PDF brief + Comulate's feature set. Updated 2026-02-12._

## Legend

- **Priority**: P0 (do now) → P1 (next session) → P2 (soon) → P3 (nice-to-have)
- **Effort**: S (small, <1hr) → M (medium, 1-3hr) → L (large, 3-8hr) → XL (multi-session)
- **Status**: `todo` | `in-progress` | `done`
- **PDF Ref**: Section of the OneDigital brief this maps to

---

## P0 — Immediate Fixes (user-reported issues)

### 0.1 Inline PDF Viewer
**Status**: `done` | **Effort**: S

Clicking "View PDF" on the Statements screen downloads the file instead of displaying it. Replace with an in-app viewer:
- Slide-out panel or modal with `<iframe>` or `<object>` embedding the PDF
- Keep download button as secondary action
- This is the core "source document" experience — analysts need to see the PDF alongside data

### 0.2 Bank Transactions / Cash Feed Screen
**Status**: `done` | **Effort**: M

There's no way to see incoming bank transactions. The bank_feed.csv data (300+ rows) is invisible to the user. Build `/transactions` screen:
- Table: bank_txn_id, posted_date, amount, counterparty, memo, reference
- Filter by counterparty (carrier), date range
- Show match status for each txn (matched to which line_id, or unmatched)
- This maps to Comulate's **Cash Application** feature — the bank side of reconciliation

### 0.3 Surface Clawbacks Properly
**Status**: `done` | **Effort**: M

Clawbacks exist in seed data (11 cases with negative commission, txn_type="clawback") but they're buried in the generic match results table with no special treatment. Need:
- Visual indicator on Match Results: red badge/row highlighting for clawback lines
- Filter option: add "clawback" as a reason filter alongside status filters
- Dashboard card: "Clawbacks" count + total negative amount
- Exception queue should flag clawbacks differently (they need different resolution — verify reversal was expected, check if it offsets a prior overpayment)

---

## P1 — Core Feature Parity + PDF-Critical Gaps

### 1.1 Statement Line Detail View (Side-by-Side Review)
**Status**: `done` | **Effort**: L

Comulate's "wow" moment: analyst sees PDF on left, structured data on right. Build `/review/:lineId`:
- Left panel: PDF viewer (iframe) scrolled to the relevant line
- Right panel: statement line data, matched bank txn, AMS expected data, confidence score breakdown
- Action buttons: Approve Match, Reassign, Write Off, Defer
- Score breakdown visual bar showing how each factor (policy_in_memo, exact_amount, etc.) contributed
- This is Comulate's **Triage** experience

### 1.2 Revenue vs Expected Screen
**Status**: `done` | **Effort**: L

Map to Comulate's **Revenue Intelligence**. Build `/revenue`:
- Summary cards: Total Expected, Total Received, Variance, Recovery Rate
- Table: carrier × LOB breakdown showing expected_commission vs actual matched commission
- Variance highlighting (red for underpaid, green for overpaid)
- Drill-down: click a carrier to see per-policy detail
- Needs `GET /api/v1/demo/revenue/summary` endpoint joining ams_expected + match_results

### 1.3 Statement Upload / Ingestion Simulation
**Status**: `todo` | **Effort**: M

Comulate's entry point is uploading a carrier statement. Simulate this:
- Upload area on Statements screen (drag-and-drop a PDF)
- Backend "parses" it (just demo — returns pre-loaded statement lines for that carrier)
- Show extraction progress animation
- Display extracted lines with confidence indicators
- This sells the "AI parsing" story even though our demo uses pre-generated data

### 1.4 Dashboard Drill-Down Navigation
**Status**: `done` | **Effort**: S

Dashboard cards are display-only. Clicking should navigate:
- "Auto-Matched" card → Match Results filtered to auto_matched
- "Needs Review" card → Exception Queue (open tab)
- "Unmatched" card → Match Results filtered to unmatched
- "Statement Rows" → Statements screen
- "Bank Rows" → Transactions screen (P0.2)

### 1.5 Audit Trail ⚠️ ADOPTION-CRITICAL
**Status**: `done` | **Effort**: L | **PDF Ref**: Flow A (final step), Section 5 (Controls/audit), Section 7

> "If Jeff nails the exception workflow and audit trail, Finance will adopt it." — Section 7

New `audit_events` DB table. Log every action:
- Match run created, exception resolved, rule created, export generated
- Who (demo user), when, what changed, previous value → new value
- Timeline component on review view showing event history for a line
- Recalculation snapshots: store point-in-time state for audit comparison
- Maps to Comulate's SOC compliance / immutable audit trail
- **This is the #1 gap Jason cares about** — the PDF explicitly calls this out as the adoption trigger

### 1.6 Accrual & True-Up Engine ⚠️ NEW
**Status**: `done` | **Effort**: L | **PDF Ref**: Flow A step 6, Section 5 (Accruals)

The calculation layer between exception resolution and journal output:
- For each statement line: calculate expected vs paid vs earned
- Generate period-end accrual entries (revenue recognized but cash not yet received)
- True-up workflow: when cash arrives, reverse accrual and book actual
- Show accrual status on review view: "Accrued $X on 2026-01-31, awaiting cash"
- `/accruals` screen showing open accruals by carrier, aging, and amount
- This is distinct from the CSV export (2.2) — it's the calculation engine that produces the data

### 1.7 Journal Output / GL Posting Simulation ⚠️ NEW
**Status**: `done` | **Effort**: M | **PDF Ref**: Flow A step 7

Generate journal entries from resolved matches + accruals:
- Revenue recognition entries (DR: AR/Cash, CR: Commission Revenue)
- Suspense entries for partial matches
- Accrual entries for period-end
- `/journal` screen showing generated entries with GL account mapping
- "Post to GL" button (simulated) with confirmation
- Maps to Comulate's **One-Click Posting**

---

## P2 — Analytical & Export Features

### 2.1 Variance / Aging Analysis
**Status**: `todo` | **Effort**: M

- Unmatched amounts broken down by carrier and reason
- Aging: how long has each exception been open (days since txn_date)
- Aging buckets: 0-7 days, 8-30, 31-60, 60+
- Maps to Comulate's **Revenue Integrity** rules

### 2.2 Export Endpoints & Screen
**Status**: `done` | **Effort**: M

Build `/exports` with downloadable reports:
- `accrual.csv` — all open items for period-end accrual (generated by 1.6)
- `journal.csv` — resolved items ready for ledger posting (generated by 1.7)
- `producer-payout.csv` — commission by producer for payout
- Preview modal before download
- Maps to Comulate's **One-Click Posting** (simplified version)

### 2.3 Dashboard Donut Chart
**Status**: `done` | **Effort**: S

Add recharts (~40KB) donut chart showing match distribution:
- auto_matched (green), needs_review (yellow), unmatched (red), resolved (blue)
- Clickable segments that filter the match results view

### 2.4 Carrier Summary / Scorecard
**Status**: `todo` | **Effort**: M

Per-carrier view showing:
- Total statements, lines, premium, commission
- Match rate (% auto-matched)
- Common exception types
- Average confidence score
- Trend over time (if we add multiple months of data)

### 2.5 Background Reconciliation Simulation
**Status**: `todo` | **Effort**: M

Comulate touts "background reconciliation" — items auto-resolve over time. Simulate this:
- After running matching, show a Triage counter that slowly ticks down
- Periodically auto-resolve the easiest exceptions (highest confidence needs_review items)
- Notification: "3 items auto-resolved by background reconciliation"
- Makes the product feel alive

---

## P3 — Producer Compensation & Advanced Features (Flow B)

### 3.1 Producer Compensation View
**Status**: `done` | **Effort**: M | **PDF Ref**: Flow B (Gross Commission Attribution)

Show commission attribution by producer:
- producer_id → total commission earned, by carrier and LOB
- Table with producer, office, total earned, matched %, pending %
- Drill-down to see individual lines per producer
- This is the simplified version of Flow B's attribution step

### 3.2 Deal/Split Rules & Fee Schedules ⚠️ NEW
**Status**: `todo` | **Effort**: L | **PDF Ref**: Flow B (Rules/Rate DB + Fee Engine)

Configure how commission splits work:
- Per-producer split percentages (e.g., 60/40 between producer and house)
- Override rules by carrier, LOB, or deal
- Fee schedules (flat fees, percentage-based)
- `/splits` screen to view and edit rules
- Powers the producer compensation calculations

### 3.3 Netting & Adjustments Layer ⚠️ NEW
**Status**: `todo` | **Effort**: M | **PDF Ref**: Flow B (Netting & Adjustments)

Net clawbacks and adjustments against producer payouts:
- Clawback offsets: if a producer earned $500 but has a $200 clawback, net payout is $300
- Chargeback handling: track deductions that carry forward
- Draw accounting: advances against future commission
- Show net position per producer on compensation view

### 3.4 Rules Engine Versioning ⚠️ NEW
**Status**: `todo` | **Effort**: M | **PDF Ref**: Section 5 (Commission logic)

The current rules screen is basic. Add:
- Version history: "Rule X was created on date, modified on date"
- Effective dating: rules apply from/to specific periods
- Test harness: "If I change this rule, how would last month's results change?"
- Audit: "Which rule set was active when line L-00042 was calculated?"

### 3.5 Batch Exception Resolution
**Status**: `todo` | **Effort**: M

Select multiple exceptions, apply same action (write-off, defer, approve). Checkbox column + bulk action toolbar.

### 3.6 Smart Rule Suggestions
**Status**: `todo` | **Effort**: M

When analyst resolves an exception, offer: "Create a rule so this auto-resolves next time?" Pre-fill source/target policy mapping. Comulate's "self-learning" system — the ML remembers analyst decisions.

### 3.7 AMS Data Quality Prompts
**Status**: `todo` | **Effort**: S

When statement data differs from AMS expected data, show inline prompt: "Carrier shows policy POL-000123 but AMS has POL-000124. Update AMS?" Maps to Comulate's **AMS Data Quality Correction**.

### 3.8 Multi-Period Data
**Status**: `todo` | **Effort**: L

Generate 3-6 months of statement data (not just current month). Enable time-based filtering across all screens. Required for trend charts and aging analysis.

### 3.9 Guided Demo Walkthrough
**Status**: `todo` | **Effort**: M

Overlay tour (like Shepherd.js) that walks a new visitor through:
1. Dashboard → see the problem scale
2. Statements → source documents
3. Run Matching → automation in action
4. Exceptions → the analyst's daily work
5. Review → the "wow" moment (side-by-side)
6. Revenue → the business impact

### 3.10 Carrier Payables Simulation
**Status**: `todo` | **Effort**: L

Comulate's "industry first." Show outbound payments owed to carriers alongside inbound commissions. Would need new data generation for payable amounts + separate reconciliation flow.

### 3.11 Notification System
**Status**: `todo` | **Effort**: S

Toast notifications for key events: match run complete, exceptions auto-resolved, new statement uploaded. Makes the app feel responsive and production-grade.

---

## PDF Data Flow Coverage Map

### Flow A: Statement + Cash → Revenue Recognition

| Step | Status | Backlog Item |
|---|---|---|
| Carrier/MGA Statement | ✅ Done | 36 PDFs, 3 carrier templates |
| Statement Ingestion/Parsing | Partial | 1.3 (upload simulation) |
| Bank Feed | ✅ Done | Transactions screen |
| Cash Ingestion/Normalization | ✅ Done | Bank feed loaded |
| Matching Engine | ✅ Done | Greedy best-match scoring |
| Variance & Exception Queue | ✅ Done | Exceptions + Match Results + Review |
| **Accrual & True-Up** | ✅ Done | **1.6** |
| **Journal Output / GL Posting** | ✅ Done | **1.7** |
| **Audit Trail + Recalc Log** | ✅ Done | **1.5** |

### Flow B: Revenue → Producer Compensation

| Step | Status | Backlog Item |
|---|---|---|
| AMS Policy/Commission Data | ✅ Partial | ams_expected.csv |
| **Deal/Split Rules + Fee Schedules** | ❌ Gap | **3.2 (new)** |
| **Gross Commission Attribution** | ✅ Done | **3.1** |
| **Netting & Adjustments** | ❌ Gap | **3.3 (new)** |
| **Payout File + Accrual File** | ✅ Done | **2.2** |

### Section 5: Where Systems Break

| Problem Area | Status | Backlog Item |
|---|---|---|
| Statement ingestion | Partial | 1.3 |
| Cash application | ✅ Done | Matching engine + human-in-the-loop |
| Commission logic | ❌ Gap | **3.4 (new)** — rules versioning + test harness |
| Accruals | ✅ Done | **1.6** |
| Controls/audit | ✅ Done | **1.5** |

---

## Mapping to Comulate's 5 Pillars

| Comulate Module | Our Equivalent | Status |
|---|---|---|
| **Direct Bill Automation** (statement parsing + auto-reconciliation) | Matching engine + Statements screen + Review view | ✅ Core done — no upload/parsing simulation yet (1.3) |
| **Cash Application** (bank-side matching) | Transactions screen + match status badges | ✅ Done |
| **Carrier Payables** (outbound payments) | Not implemented | Gap → 3.10 |
| **Revenue Intelligence** (variance + forecasting) | Revenue screen + carrier/LOB variance | ✅ Done |
| **Revenue Integrity** (missing commission detection) | Clawback surfacing + exception taxonomy (L1-L4) | ✅ Done — aging analysis pending (2.1) |

---

## What Makes a Compelling Demo (Updated Priority Stack)

Based on the PDF brief, the highest-impact remaining items are:

1. **1.5 Audit Trail** — the PDF literally says "if Jeff nails the exception workflow and audit trail, Finance will adopt it." Exception workflow is done. Audit trail is the #1 gap.
2. **1.6 Accrual & True-Up** — completes Flow A end-to-end. Shows we understand the full close cycle.
3. **1.7 Journal/GL Output** — makes the output tangible. "Here's what gets posted to your GL."
4. **2.2 Exports** — downloadable accrual, journal, and payout CSVs.
5. **2.3 Dashboard Donut** — instant visual impact for demos.
6. **3.1 Producer Compensation** — even simplified, shows Flow B awareness.
