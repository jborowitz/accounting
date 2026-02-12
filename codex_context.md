# Codex Context Snapshot

## Project objective
Build a Comulate-style commission reconciliation demo app that proves value quickly:
- ingest statement/cash/expected data
- auto-match with confidence scoring
- route exceptions for human resolution
- apply learned rules
- export auditable outputs
- deploy to `jeffborowitz.com` via GitHub Actions + Docker (remote only)

## What is already in place

### Data + spec artifacts
- `docs/comulate_demo_build_spec.md`: core product/build spec + demo storyboard + data strategy.
- `docs/setup_and_data_plan.md`: setup/deployment/data acquisition plan.
- `docs/implementation_plan.md`: phased implementation plan.
- `data/README.md`: canonical data contract and scenario coverage.
- Seed data generated in `data/`:
  - `data/raw/statements/statement_lines.csv`
  - `data/raw/bank/bank_feed.csv`
  - `data/expected/ams_expected.csv`
  - `data/demo_cases/case_manifest.csv`

### App scaffold
- FastAPI app: `app/main.py`
- Matcher logic: `app/matching.py`
- SQLite persistence layer: `app/persistence.py`
- Local run/test helpers:
  - `scripts/setup_local_env.sh`
  - `scripts/test_local.sh`
  - `scripts/run_match_demo.py`
  - `scripts/ops.sh`

### Deployment scaffold
- Containerization for remote deploy:
  - `Dockerfile`
  - `docker-compose.demo.yml`
- GitHub Actions workflow:
  - `.github/workflows/deploy.yml`
- Workflow includes:
  - SSH setup
  - rsync to VM deploy path
  - remote docker compose deploy
  - API smoke checks via `curl`
  - extra deploy diagnostics/log output added for first-run debugging

### Local dev constraints configured
- `.gitignore` includes `.venv` and common local artifacts.
- Local development is Python-only (no local Docker requirement).

## Implemented API endpoints

### Health + summary
- `GET /health`
- `GET /api/v1/health`
- `GET /api/v1/demo/summary`
- `GET /api/v1/demo/match-summary`

### Match runs + exceptions (persisted)
- `POST /api/v1/demo/match-runs`
  - executes matching and persists run/results/exceptions to SQLite
- `GET /api/v1/demo/exceptions?status=open|resolved&limit=...`
- `POST /api/v1/demo/exceptions/resolve`

### Learned policy rules
- `GET /api/v1/demo/rules/policy`
- `POST /api/v1/demo/rules/policy`
  - stores source->target policy override
  - matcher consumes overrides in subsequent runs

## Testing status
All current tests pass locally in this environment:
- `tests/test_matching.py`
- `tests/test_persistence.py`
- `tests/test_matching_rules.py`

Run with:
```bash
./scripts/ops.sh local-test
```

## Current operational friction

### Network from Codex sandbox
This execution sandbox cannot reliably reach external services (`api.github.com`, PyPI, deployed domain), so direct `gh`, `pip`, and external `curl` checks fail from here.

Important: this is an environment/runtime limitation, not a repo code issue.

### `gh` status observed from this sandbox
- `gh` binary exists.
- At one point auth output also showed invalid token for account `jborowitz`.
- Later attempts failed at network-connect level from this sandbox.

User indicated local `gh` works and showed an initial deployment failure in Actions.

## Most likely first deployment failure areas (already hardened)
- Remote deploy path quoting/expansion issues.
- `~` path default ambiguity in non-interactive SSH sessions.
- Missing `docker compose` plugin vs `docker-compose` binary mismatch.

Workflow has been updated to address these and print better diagnostics/logs.

## Helpful command workflow (`scripts/ops.sh`)

### Local
```bash
./scripts/ops.sh local-setup
./scripts/ops.sh local-run
./scripts/ops.sh local-smoke
./scripts/ops.sh local-test
```

### Deploy + verify
```bash
./scripts/ops.sh gh-login-check
./scripts/ops.sh deploy-push
./scripts/ops.sh deploy-runs
./scripts/ops.sh deploy-watch
./scripts/ops.sh deploy-failed
BASE_URL="https://jeffborowitz.com/accounting-demo" ./scripts/ops.sh deploy-check
```

## Strategic thoughts on demo data
- Best near-term path is synthetic canonical data + generated statement variants to avoid legal/compliance friction and ensure deterministic demos/tests.
- Public invoice/remittance PDFs are useful for parser hardening but weak for insurance-specific semantics.
- Redacted design-partner statements should be added later for credibility once core loop is stable.

## Product/delivery thoughts
- The app is already beyond static scaffolding: match, persist, resolve, and learn-rule loops are in place.
- Next biggest value unlocks are:
  1. accrual/GL export endpoints
  2. exception queue UI (or API-first queue tooling)
  3. run history + audit timeline endpoints
- Keep remote deployment containerized; keep local development Python-only for speed.

## Recommended next implementation steps
1. Add `GET /api/v1/demo/exports/accrual.csv` from persisted latest run + expected commissions.
2. Add explicit match run history endpoint (`GET /api/v1/demo/match-runs`).
3. Add “save rule while resolving exception” convenience option in resolve payload.
4. Add a minimal front-end queue screen (or simple server-rendered page) for demo flow.
5. After first successful deploy, lock in a repeatable release checklist in `README.md`.

## Open items for user verification
- Confirm GitHub secrets are correctly set for deploy workflow.
- Confirm VM reverse proxy path (`/accounting-demo/`) forwards to port `8002`.
- Confirm first successful Actions run after latest workflow hardening.

