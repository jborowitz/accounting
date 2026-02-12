# Feature Backlog — Commission Reconciliation Demo

_Prioritized against Comulate's feature set. Updated 2026-02-12._

## Legend

- **Priority**: P0 (do now) → P1 (next session) → P2 (soon) → P3 (nice-to-have)
- **Effort**: S (small, <1hr) → M (medium, 1-3hr) → L (large, 3-8hr) → XL (multi-session)
- **Status**: `todo` | `in-progress` | `done`

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

## P1 — Core Comulate Feature Parity

### 1.1 Statement Line Detail View (Side-by-Side Review)
**Status**: `todo` | **Effort**: L

Comulate's "wow" moment: analyst sees PDF on left, structured data on right. Build `/review/:lineId`:
- Left panel: PDF viewer (iframe) scrolled to the relevant line
- Right panel: statement line data, matched bank txn, AMS expected data, confidence score breakdown
- Action buttons: Approve Match, Reassign, Write Off, Defer
- Score breakdown visual bar showing how each factor (policy_in_memo, exact_amount, etc.) contributed
- This is Comulate's **Triage** experience

### 1.2 Revenue vs Expected Screen
**Status**: `todo` | **Effort**: L

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
**Status**: `todo` | **Effort**: S

Dashboard cards are display-only. Clicking should navigate:
- "Auto-Matched" card → Match Results filtered to auto_matched
- "Needs Review" card → Exception Queue (open tab)
- "Unmatched" card → Match Results filtered to unmatched
- "Statement Rows" → Statements screen
- "Bank Rows" → Transactions screen (P0.2)

### 1.5 Background Reconciliation Simulation
**Status**: `todo` | **Effort**: M

Comulate touts "background reconciliation" — items auto-resolve over time. Simulate this:
- After running matching, show a Triage counter that slowly ticks down
- Periodically auto-resolve the easiest exceptions (highest confidence needs_review items)
- Notification: "3 items auto-resolved by background reconciliation"
- Makes the product feel alive

---

## P2 — Analytical & Export Features

### 2.1 Variance / Aging Analysis
**Status**: `todo` | **Effort**: M

- Unmatched amounts broken down by carrier and reason
- Aging: how long has each exception been open (days since txn_date)
- Aging buckets: 0-7 days, 8-30, 31-60, 60+
- Maps to Comulate's **Revenue Integrity** rules

### 2.2 Export Endpoints & Screen
**Status**: `todo` | **Effort**: M

Build `/exports` with downloadable reports:
- `accrual.csv` — all open items for period-end accrual
- `journal.csv` — resolved items ready for ledger posting
- `producer-payout.csv` — commission by producer for payout
- Preview modal before download
- Maps to Comulate's **One-Click Posting** (simplified version)

### 2.3 Audit Trail
**Status**: `todo` | **Effort**: L

New `audit_events` DB table. Log every action:
- Match run created, exception resolved, rule created, export generated
- Who (demo user), when, what changed
- Timeline component on review view showing event history for a line
- Maps to Comulate's SOC compliance / immutable audit trail

### 2.4 Dashboard Donut Chart
**Status**: `todo` | **Effort**: S

Add recharts (~40KB) donut chart showing match distribution:
- auto_matched (green), needs_review (yellow), unmatched (red), resolved (blue)
- Clickable segments that filter the match results view

### 2.5 Carrier Summary / Scorecard
**Status**: `todo` | **Effort**: M

Per-carrier view showing:
- Total statements, lines, premium, commission
- Match rate (% auto-matched)
- Common exception types
- Average confidence score
- Trend over time (if we add multiple months of data)

---

## P3 — Polish & Advanced Features

### 3.1 Batch Exception Resolution
**Status**: `todo` | **Effort**: M

Select multiple exceptions, apply same action (write-off, defer, approve). Checkbox column + bulk action toolbar.

### 3.2 Smart Rule Suggestions
**Status**: `todo` | **Effort**: M

When analyst resolves an exception, offer: "Create a rule so this auto-resolves next time?" Pre-fill source/target policy mapping. Comulate's "self-learning" system — the ML remembers analyst decisions.

### 3.3 AMS Data Quality Prompts
**Status**: `todo` | **Effort**: S

When statement data differs from AMS expected data, show inline prompt: "Carrier shows policy POL-000123 but AMS has POL-000124. Update AMS?" Maps to Comulate's **AMS Data Quality Correction**.

### 3.4 Multi-Period Data
**Status**: `todo` | **Effort**: L

Generate 3-6 months of statement data (not just current month). Enable time-based filtering across all screens. Required for trend charts and aging analysis.

### 3.5 Guided Demo Walkthrough
**Status**: `todo` | **Effort**: M

Overlay tour (like Shepherd.js) that walks a new visitor through:
1. Dashboard → see the problem scale
2. Statements → source documents
3. Run Matching → automation in action
4. Exceptions → the analyst's daily work
5. Review → the "wow" moment (side-by-side)
6. Revenue → the business impact

### 3.6 Carrier Payables Simulation
**Status**: `todo` | **Effort**: L

Comulate's "industry first." Show outbound payments owed to carriers alongside inbound commissions. Would need new data generation for payable amounts + separate reconciliation flow.

### 3.7 Producer Compensation View
**Status**: `todo` | **Effort**: M

Show commission splits by producer. Comulate captures PEPM, rates, employee counts — we can show a simplified version: producer_id → total commission earned, by carrier and LOB.

### 3.8 Notification System
**Status**: `todo` | **Effort**: S

Toast notifications for key events: match run complete, exceptions auto-resolved, new statement uploaded. Makes the app feel responsive and production-grade.

---

## Mapping to Comulate's 5 Pillars

| Comulate Module | Our Equivalent | Status |
|---|---|---|
| **Direct Bill Automation** (statement parsing + auto-reconciliation) | Matching engine + Statements screen | Partial — no upload/parsing simulation |
| **Cash Application** (bank-side matching) | Bank feed data exists but invisible | **Gap** → P0.2 |
| **Carrier Payables** (outbound payments) | Not implemented | Gap → P3.6 |
| **Revenue Intelligence** (variance + forecasting) | Not implemented | Gap → P1.2 |
| **Revenue Integrity** (missing commission detection) | Clawbacks in data, not surfaced | **Gap** → P0.3, P2.1 |

---

## What Makes a Compelling Demo (Priority Stack)

If the goal is a demo that shows "we understand the problem space and can build this," the highest-impact items are:

1. **P0.1-0.3**: Fix PDF viewer, show bank transactions, surface clawbacks — these are table-stakes credibility
2. **P1.1**: Side-by-side review view — this is the "wow" moment that shows you understand the analyst workflow
3. **P1.2**: Revenue vs expected — this is the business value story (we found $X in missing commissions)
4. **P1.4**: Dashboard drill-down — makes the whole app feel connected
5. **P2.4**: Donut chart — instant visual impact on the landing page
