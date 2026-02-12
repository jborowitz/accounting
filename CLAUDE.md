# Project: Accounting Reconciliation Demo

## Workflow
- Always commit and push to main when a set of work is complete. Push triggers GitHub Actions deploy to jeffborowitz.com/accounting-demo.

## Stack
- Backend: Python 3.11, FastAPI, SQLite, uvicorn
- Frontend: Vite + React 18, Tailwind CSS, TanStack Table, React Router
- Deploy: 2-stage Docker build (Node builds frontend, Python serves everything), GitHub Actions

## Key paths
- Backend API: `app/main.py`, `app/persistence.py`, `app/matching.py`
- Frontend: `frontend/src/` (screens, components, api client)
- Tests: `tests/` (run with `.venv/bin/python -m pytest tests/ -v`)
- Docker: `Dockerfile` (2-stage), `docker-compose.demo.yml`
- Deploy: `.github/workflows/deploy.yml`

## Dev
- Backend: `.venv/bin/python -m uvicorn app.main:app --port 8002 --reload`
- Frontend: `cd frontend && npm run dev` (port 8001, proxies /api to 8002)
- Production base path: `/accounting-demo/`
