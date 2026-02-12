# Accounting Reconciliation Demo

Comulate-style demo scaffold focused on:
- statement ingestion
- cash matching
- exception handling
- auditable close outputs

## Quick start

1. Generate demo data:
```bash
python3 scripts/generate_demo_data.py --seed 7 --statement-lines 320 --exception-rate 0.22
```

2. Setup local Python env (no local Docker):
```bash
./scripts/ops.sh local-setup
```

3. Run API locally:
```bash
./scripts/ops.sh local-run
```

4. In another terminal, run local smoke checks:
```bash
./scripts/ops.sh local-smoke
```

5. Run local tests:
```bash
./scripts/ops.sh local-test
```

6. Optional: run a persisted match + exception flow manually:
```bash
curl -s -X POST http://127.0.0.1:8002/api/v1/demo/match-runs | jq
curl -s "http://127.0.0.1:8002/api/v1/demo/exceptions?status=open&limit=5" | jq
curl -s -X POST http://127.0.0.1:8002/api/v1/demo/exceptions/resolve \
  -H "Content-Type: application/json" \
  -d '{"line_id":"L-00005","resolution_action":"manual_link","resolved_bank_txn_id":"BTX-000005","resolution_note":"demo resolve"}' | jq
```

## Deploy + verify

1. Verify `gh` login:
```bash
./scripts/ops.sh gh-login-check
```
If invalid, run:
```bash
gh auth login -h github.com
```

2. Deploy by pushing:
```bash
./scripts/ops.sh deploy-push
```

3. Watch deploy status/logs:
```bash
./scripts/ops.sh deploy-runs
./scripts/ops.sh deploy-watch
./scripts/ops.sh deploy-failed
```

4. Check deployed API:
```bash
BASE_URL="https://jeffborowitz.com/accounting-demo" ./scripts/ops.sh deploy-check
```

## Deploy workflow
- Workflow: `.github/workflows/deploy.yml`
- Setup details: `docs/setup_and_data_plan.md`
