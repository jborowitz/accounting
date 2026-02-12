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
./scripts/setup_local_env.sh
```

3. Run locally:
```bash
source .venv/bin/activate
uvicorn app.main:app --reload
```

4. Open:
- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/api/v1/demo/summary`

## Deploy
- Workflow: `.github/workflows/deploy.yml`
- See: `docs/setup_and_data_plan.md` for VM and secret requirements.
