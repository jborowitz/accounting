from __future__ import annotations

import csv
import uuid
from datetime import UTC, datetime
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from pydantic import BaseModel

from app.matching import run_matching
from app.persistence import (
    init_db,
    list_exceptions,
    list_match_results,
    list_match_runs,
    list_policy_rules,
    load_policy_overrides,
    resolve_exception,
    save_match_run,
    upsert_policy_rule,
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = BASE_DIR / "data/demo.db"
STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Accounting Reconciliation Demo", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResolveExceptionRequest(BaseModel):
    line_id: str
    resolution_action: str
    resolved_bank_txn_id: str | None = None
    resolution_note: str | None = None


class UpsertPolicyRuleRequest(BaseModel):
    source_policy_number: str
    target_policy_number: str
    note: str | None = None


def count_rows(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open(newline="", encoding="utf-8") as f:
        return max(0, sum(1 for _ in f) - 1)


def read_case_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def demo_summary() -> dict[str, Any]:
    statement_path = DATA_DIR / "raw/statements/statement_lines.csv"
    bank_path = DATA_DIR / "raw/bank/bank_feed.csv"
    expected_path = DATA_DIR / "expected/ams_expected.csv"
    cases_path = DATA_DIR / "demo_cases/case_manifest.csv"

    cases = read_case_manifest(cases_path)
    reasons = Counter(row.get("expected_reason", "unknown") for row in cases)
    statuses = Counter(row.get("expected_status", "unknown") for row in cases)

    return {
        "statement_rows": count_rows(statement_path),
        "bank_rows": count_rows(bank_path),
        "expected_rows": count_rows(expected_path),
        "case_rows": len(cases),
        "status_breakdown": dict(statuses),
        "exception_reasons": dict(reasons),
    }


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"ok": True, "service": "accounting-demo"})


@app.get("/api/v1/health")
def api_health() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/api/v1/demo/summary")
def api_demo_summary() -> JSONResponse:
    return JSONResponse(demo_summary())


@app.get("/api/v1/demo/match-summary")
def api_match_summary() -> JSONResponse:
    return JSONResponse(run_matching(DATA_DIR, policy_overrides=load_policy_overrides(DB_PATH)))


@app.post("/api/v1/demo/match-runs")
def api_create_match_run() -> JSONResponse:
    run_id = f"{datetime.now(UTC).strftime('run-%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
    result = run_matching(DATA_DIR, policy_overrides=load_policy_overrides(DB_PATH))
    save_counts = save_match_run(DB_PATH, run_id, result["results"])
    return JSONResponse(
        {
            "ok": True,
            "run_id": run_id,
            "totals": result["totals"],
            "stored_counts": save_counts,
        }
    )


@app.get("/api/v1/demo/match-runs")
def api_list_match_runs(limit: int = 50) -> JSONResponse:
    rows = list_match_runs(DB_PATH, limit=limit)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.get("/api/v1/demo/match-results")
def api_match_results(status: str | None = None, limit: int = 500) -> JSONResponse:
    if status and status not in {"auto_matched", "needs_review", "unmatched", "resolved"}:
        raise HTTPException(status_code=400, detail="invalid status filter")
    rows, run_id = list_match_results(DB_PATH, status=status, limit=limit)
    return JSONResponse({"rows": rows, "count": len(rows), "run_id": run_id})


@app.get("/api/v1/demo/exceptions")
def api_exceptions(status: str = "open", limit: int = 100) -> JSONResponse:
    if status not in {"open", "resolved"}:
        raise HTTPException(status_code=400, detail="status must be open or resolved")
    rows = list_exceptions(DB_PATH, status=status, limit=limit)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.post("/api/v1/demo/exceptions/resolve")
def api_exceptions_resolve(payload: ResolveExceptionRequest) -> JSONResponse:
    row = resolve_exception(
        DB_PATH,
        line_id=payload.line_id,
        resolution_action=payload.resolution_action,
        resolved_bank_txn_id=payload.resolved_bank_txn_id,
        resolution_note=payload.resolution_note,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="open exception not found for latest run")
    return JSONResponse({"ok": True, "resolved": row})


@app.get("/api/v1/demo/rules/policy")
def api_policy_rules(limit: int = 200) -> JSONResponse:
    rows = list_policy_rules(DB_PATH, limit=limit)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.post("/api/v1/demo/rules/policy")
def api_policy_rules_upsert(payload: UpsertPolicyRuleRequest) -> JSONResponse:
    source = payload.source_policy_number.strip()
    target = payload.target_policy_number.strip()
    if not source or not target:
        raise HTTPException(status_code=400, detail="source_policy_number and target_policy_number are required")
    row = upsert_policy_rule(DB_PATH, source, target, payload.note)
    return JSONResponse({"ok": True, "rule": row})


# SPA catch-all: serve React app for non-API routes
if STATIC_DIR.is_dir():
    @app.get("/{full_path:path}")
    def spa_catch_all(full_path: str) -> FileResponse:
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    from fastapi.responses import HTMLResponse

    @app.get("/", response_class=HTMLResponse)
    def homepage() -> str:
        return """<!doctype html>
<html><body>
<h1>Accounting Reconciliation Demo</h1>
<p>Frontend not built yet. Run <code>cd frontend && npm run build</code> to build.</p>
<p>API is live at <code>/api/v1/</code></p>
</body></html>"""


@app.on_event("startup")
def on_startup() -> None:
    init_db(DB_PATH)
