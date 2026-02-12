from __future__ import annotations

import csv
import uuid
from datetime import UTC, datetime
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from app.matching import run_matching
from app.persistence import (
    init_db,
    list_exceptions,
    list_policy_rules,
    load_policy_overrides,
    resolve_exception,
    save_match_run,
    upsert_policy_rule,
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = BASE_DIR / "data/demo.db"

app = FastAPI(title="Accounting Reconciliation Demo", version="0.1.0")


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
def api_match_runs() -> JSONResponse:
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


@app.get("/", response_class=HTMLResponse)
def homepage() -> str:
    summary = demo_summary()
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Accounting Reconciliation Demo</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 2rem;
      background: linear-gradient(160deg, #f5f7fb 0%, #ecf2ff 100%);
      color: #18202a;
    }}
    .card {{
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.08);
      max-width: 860px;
      margin: 0 auto;
      padding: 1.5rem;
    }}
    h1 {{ margin-top: 0; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.8rem;
      margin-top: 1rem;
      margin-bottom: 1rem;
    }}
    .metric {{
      border: 1px solid #dde3ef;
      border-radius: 8px;
      padding: 0.7rem;
      background: #f9fbff;
    }}
    .k {{ font-size: 0.8rem; color: #526071; }}
    .v {{ font-weight: 700; font-size: 1.15rem; }}
    code {{ background: #eef3ff; padding: 0.1rem 0.3rem; border-radius: 4px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Commission Reconciliation Demo</h1>
    <p>Data-first MVP scaffold for carrier statement ingestion, cash matching, and exception workflows.</p>
    <div class="grid">
      <div class="metric"><div class="k">Statement Rows</div><div class="v">{summary["statement_rows"]}</div></div>
      <div class="metric"><div class="k">Bank Rows</div><div class="v">{summary["bank_rows"]}</div></div>
      <div class="metric"><div class="k">AMS Expected Rows</div><div class="v">{summary["expected_rows"]}</div></div>
      <div class="metric"><div class="k">Case Rows</div><div class="v">{summary["case_rows"]}</div></div>
    </div>
    <p>API:</p>
    <ul>
      <li><code>/health</code></li>
      <li><code>/api/v1/health</code></li>
      <li><code>/api/v1/demo/summary</code></li>
      <li><code>/api/v1/demo/match-summary</code></li>
      <li><code>POST /api/v1/demo/match-runs</code></li>
      <li><code>GET /api/v1/demo/exceptions</code></li>
      <li><code>POST /api/v1/demo/exceptions/resolve</code></li>
      <li><code>GET /api/v1/demo/rules/policy</code></li>
      <li><code>POST /api/v1/demo/rules/policy</code></li>
    </ul>
  </div>
</body>
</html>
"""


@app.on_event("startup")
def on_startup() -> None:
    init_db(DB_PATH)
