# Comulate-Style Demo Build Spec

## 1) Objective
Build a finance-side automation demo for brokerage accounting that proves value in one flow:

1. Ingest carrier statements (PDF/XLS) and bank cash files (CSV).
2. Match payments to expected commissions.
3. Route mismatches to an exception queue.
4. Apply split rules for producer attribution.
5. Export accrual/journal outputs with full audit traceability.

This is explicitly not an AMS replacement.

## 2) MVP Scope
### In scope
- Statement ingestion and normalization.
- Cash ingestion and normalization.
- Matching engine (deterministic + fuzzy scoring).
- Exception queue with manual resolution.
- Rule versioning for split attribution.
- Accrual + GL export files.
- Immutable audit/event log.

### Out of scope
- Carrier portal integrations requiring non-approved access patterns.
- Payroll/AP disbursement execution.
- Full policy administration.

## 3) Demo Storyboard (What the demo looks like)
### Screen 1: Ingestion Console
- Upload `carrier_statement_A.pdf`, `carrier_statement_B.xlsx`, `bank_feed.csv`, and `ams_expected.csv`.
- Show parse confidence by file and rows extracted.
- Show "schema health" checks (missing policy number, bad dates, negative amount, etc.).

### Screen 2: Auto-Match Results
- Buckets: `Auto-Matched`, `Needs Review`, `Unmatched`.
- Each row shows score breakdown:
  - policy exact match points
  - amount tolerance points
  - date proximity points
  - fuzzy name similarity points

### Screen 3: Exception Queue
- Analyst resolves 3 common issues live:
  - partial payment split across two policies
  - cancellation clawback causing negative line
  - policy number typo with strong fuzzy name match
- Analyst clicks "Save as rule" for a recurring pattern.

### Screen 4: Attribution + Close Outputs
- Apply split rule set `v2026-02`.
- Generate outputs:
  - producer payout preview
  - month-end accrual CSV
  - GL journal CSV
- Open audit timeline for one line and show every transformation and user action.

## 4) Architecture (Simple and Buildable)
- Backend: Python + FastAPI.
- Data processing: Pandas + RapidFuzz.
- Storage: SQLite for demo (Postgres-ready schema).
- Frontend: lightweight React/Next table UI.
- Extraction:
  - pass 1: template/parser for known layouts
  - pass 2: OCR/LLM structured extraction fallback

## 5) Data Contracts
### Inputs
- `statement_lines`:
  - carrier_name, statement_id, policy_number, insured_name, effective_date, written_premium, gross_commission, txn_type
- `cash_txns`:
  - bank_txn_id, posted_date, amount, counterparty, memo
- `ams_expected`:
  - policy_number, producer_id, expected_commission, lob, office

### Core generated entities
- `match_results`: statement_line_id, cash_txn_id, confidence, status
- `exceptions`: reason_code, owner, resolution_action
- `split_rules`: versioned rule definitions + effective dates
- `audit_events`: actor, action, before_json, after_json, timestamp

## 6) Matching Approach
1. Deterministic pass:
- exact policy + amount +/- tolerance + date window.

2. Probabilistic pass:
- weighted score from fuzzy insured name, near amount, near date, carrier memo clues.

3. Thresholds:
- `>= 0.90` auto-match
- `0.60 - 0.89` review queue
- `< 0.60` unmatched

4. Learning loop:
- user-reviewed links create reusable mapping hints for future runs.

## 7) Acceptance Criteria
- At least 70% of lines auto-matched on seeded demo pack.
- All remaining lines resolvable in exception queue.
- Re-run after saved rules increases auto-match rate by >= 10 points.
- Every exported row traces back to source row + rule version + reviewer action.

## 8) Delivery Plan (1 week)
1. Day 1: schemas, file upload, parsers, normalized tables.
2. Day 2: deterministic and fuzzy matcher with score explanations.
3. Day 3: exception queue + save-as-rule behavior.
4. Day 4: split rules + attribution outputs.
5. Day 5: audit timeline + export files + scripted demo walkthrough.

## 9) Demo Data Strategy (high priority)
Use a 3-tier strategy so we get realistic behavior quickly without legal risk.

### Tier 1 (recommended): Synthetic but realistic statements
- Generate our own carrier-like PDFs and XLS files with controlled edge cases:
  - cancellations
  - reinstatements
  - clawbacks
  - partial payments
  - policy number typos
- Pair with synthetic bank feed and AMS expected extract.
- Best for repeatable demos and regression tests.

### Tier 2: Public sample docs for parser hardening
- Use public invoice/remittance-like PDFs to stress OCR and table extraction.
- Good for layout variety; weaker for insurance semantics.

### Tier 3: Redacted real statements (when available)
- Ask design partners for 10-20 fully redacted carrier statements.
- Highest credibility for buyer demos.
- Require explicit written permission and data handling controls.

## 10) Where to get PDFs now
1. Generate them in-repo (best):
- Build a statement generator that emits 3-5 carrier layout styles as PDF + XLS from the same canonical CSV.
- Add controlled noise (rotations, scanned copy artifacts, broken table rows).

2. Public sample invoice PDFs (good parser stress tests):
- `invoice-x/invoice2data` (MIT, parser ecosystem): https://github.com/invoice-x/invoice2data
- `codebywiam/invoice-ocr` (includes sample invoice PDFs generated for OCR testing): https://github.com/codebywiam/invoice-ocr

3. Public template PDFs (good for edge-format variety):
- Jotform commission statement template: https://www.jotform.com/form-templates/commission-statement
- eForms real-estate commission invoice template: https://eforms.com/invoice-template/real-estate-agent-commission/

## 11) Compliance/Integration Guardrails
- Ingest only agency-owned exports, approved APIs, and user-uploaded files.
- No scraping or reverse-engineering carrier/AMS portals.
- Keep immutable audit trails for booking decisions and rule changes.
