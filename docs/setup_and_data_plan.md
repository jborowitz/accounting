# Setup + Data Plan

## 1) What to build first
Build a demo that is reliable with synthetic data before plugging in any real brokerage files.

1. Generate deterministic seed data.
2. Render statement-style PDFs from that data.
3. Build matching and exception UX on top of known outcomes.
4. Add redacted real files later for credibility checks.

## 2) Data setup without proprietary access
Use a 3-lane strategy:

1. Lane A: Synthetic canonical dataset (already scripted)
- Run:
```bash
python3 scripts/generate_demo_data.py --seed 7 --statement-lines 320 --exception-rate 0.22
```
- Optional PDF rendering (if `reportlab` is installed):
```bash
python3 scripts/generate_demo_data.py --seed 7 --statement-lines 320 --exception-rate 0.22 --render-pdfs
```

2. Lane B: Public parser-hardening docs
- Use invoice/remittance-style PDFs only to stress extraction variance.
- Keep these separate from accounting logic validation.

3. Lane C: Redacted design-partner data
- Ask for 10-20 redacted statements + one bank export + one expected-commission extract.
- Require written permission and a clear retention policy.

## 3) Minimal architecture
- API/UI: FastAPI app (`app/main.py`).
- Demo data: `data/`.
- Container: `Dockerfile`, `docker-compose.demo.yml`.
- Deploy automation: `.github/workflows/deploy.yml`.
- Local development: Python only via `.venv` (`scripts/setup_local_env.sh`).

## 4) VM requirements
- Docker installed.
- Reverse proxy route to port `8000` for path `/accounting-demo/`.
- SSH key access from GitHub Actions runner.

### Example Nginx route snippet
```nginx
location /accounting-demo/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 5) GitHub secrets needed
- `SSH_PRIVATE_KEY`
- `VM_HOST`
- `VM_USERNAME`
- `VM_DEPLOY_PATH` (optional, defaults to `~/accounting-demo`)
- `HEALTHCHECK_URL` (optional base URL, defaults to `https://jeffborowitz.com/accounting-demo`)

## 6) Demo script for stakeholder calls
1. Open `/accounting-demo/` and show row counts loaded.
2. Hit `/accounting-demo/api/v1/demo/summary` to show exception mix.
3. Walk through 3 exception types: partial payment, policy typo, clawback.
4. Re-run with saved rule behavior (next increment for the app).
