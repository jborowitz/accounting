# Demo Data Pack

## Goal
Create a repeatable dataset for commission reconciliation demos with realistic exceptions.

## Required Files
- `data/raw/statements/*.pdf` carrier statement PDFs (2-3 layout styles)
- `data/raw/statements/*.xlsx` carrier statement spreadsheets
- `data/raw/bank/bank_feed.csv` synthetic bank transactions
- `data/expected/ams_expected.csv` expected commission extract from AMS
- `data/demo_cases/case_manifest.csv` expected matching outcomes for verification

## Minimum Seed Volume
- 300 statement lines total
- 200 bank transactions
- 220 AMS expected rows
- At least 60 exception rows across these types:
  - cancellation
  - reinstatement
  - clawback (negative commission)
  - partial payment
  - timing mismatch (statement date vs bank date)
  - key mismatch (policy typo/name variation)

## Canonical Columns
### statement lines
`carrier_name,statement_id,line_id,policy_number,insured_name,effective_date,txn_date,written_premium,gross_commission,txn_type`

### bank feed
`bank_txn_id,posted_date,amount,counterparty,memo,reference`

### ams expected
`policy_number,producer_id,office,lob,expected_commission,effective_date`

### case manifest
`line_id,expected_status,expected_reason,expected_cash_txn_id,notes`

## Data Quality Rules
- Dates in ISO `YYYY-MM-DD`.
- Monetary fields as decimal with 2 dp.
- Negative amounts allowed only for reversals/clawbacks.
- Every line must have deterministic `line_id` for traceability.

## Demo Scenarios to Include
1. Happy path exact match.
2. Same amount, ambiguous policy, resolved by date window.
3. Fuzzy insured name match (`Smith, John` vs `John Smith`).
4. Split cash payment across two policies.
5. Cancellation and later reinstatement.
6. Clawback after prior payout.
7. Manual resolution saved as reusable rule.

## Suggested Next Step
Implement a generator script that creates all files from one canonical table, then renders PDF/XLS variants from that same source so expected outcomes stay deterministic.
