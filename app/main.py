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
    list_statement_metadata,
    load_policy_overrides,
    resolve_exception,
    save_match_run,
    upsert_policy_rule,
    upsert_statement_metadata,
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

    # Clawback stats from statement lines
    stmt_rows = _read_csv(statement_path)
    clawback_lines = [r for r in stmt_rows if r.get("txn_type") == "clawback"]
    clawback_total = sum(float(r.get("gross_commission", 0)) for r in clawback_lines)

    return {
        "statement_rows": count_rows(statement_path),
        "bank_rows": count_rows(bank_path),
        "expected_rows": count_rows(expected_path),
        "case_rows": len(cases),
        "status_breakdown": dict(statuses),
        "exception_reasons": dict(reasons),
        "clawback_count": len(clawback_lines),
        "clawback_total": round(clawback_total, 2),
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

    # Enrich with statement-level data (txn_type, commission)
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    stmt_lookup = {r["line_id"]: r for r in stmt_rows}
    for row in rows:
        sl = stmt_lookup.get(row["line_id"], {})
        row["txn_type"] = sl.get("txn_type", "")
        row["gross_commission"] = sl.get("gross_commission", "")
        row["insured_name"] = sl.get("insured_name", "")
        row["carrier_name"] = sl.get("carrier_name", "")
        row["statement_id"] = sl.get("statement_id", "")

    return JSONResponse({"rows": rows, "count": len(rows), "run_id": run_id})


@app.get("/api/v1/demo/exceptions")
def api_exceptions(status: str = "open", limit: int = 100) -> JSONResponse:
    if status not in {"open", "resolved"}:
        raise HTTPException(status_code=400, detail="status must be open or resolved")
    rows = list_exceptions(DB_PATH, status=status, limit=limit)

    # Enrich with statement-level data
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    stmt_lookup = {r["line_id"]: r for r in stmt_rows}
    for row in rows:
        sl = stmt_lookup.get(row["line_id"], {})
        row["txn_type"] = sl.get("txn_type", "")
        row["gross_commission"] = sl.get("gross_commission", "")
        row["insured_name"] = sl.get("insured_name", "")
        row["carrier_name"] = sl.get("carrier_name", "")
        row["statement_id"] = sl.get("statement_id", "")

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


@app.get("/api/v1/demo/line-detail/{line_id}")
def api_line_detail(line_id: str) -> JSONResponse:
    """Full detail for a single statement line: statement + match + bank + AMS expected."""
    # Statement data
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    stmt = next((r for r in stmt_rows if r["line_id"] == line_id), None)
    if stmt is None:
        raise HTTPException(status_code=404, detail="line_id not found")

    # AMS expected data (keyed by original policy number from index)
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")
    # Statement uses potentially-mutated policy; expected uses original. Match by line index.
    line_idx = next((i for i, r in enumerate(stmt_rows) if r["line_id"] == line_id), None)
    ams = expected_rows[line_idx] if line_idx is not None and line_idx < len(expected_rows) else None

    # Match result from DB
    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_result = None
    exception_data = None
    if run_id:
        with get_conn(DB_PATH) as conn:
            mr = conn.execute(
                """SELECT line_id, policy_number, matched_bank_txn_id, confidence, status, reason
                   FROM match_results WHERE run_id = ? AND line_id = ?""",
                (run_id, line_id),
            ).fetchone()
            if mr:
                match_result = dict(mr)
            ex = conn.execute(
                """SELECT * FROM exceptions WHERE run_id = ? AND line_id = ?""",
                (run_id, line_id),
            ).fetchone()
            if ex:
                exception_data = dict(ex)

    # Bank transaction
    bank_txn = None
    if match_result and match_result.get("matched_bank_txn_id"):
        bank_rows = _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")
        bank_txn = next((r for r in bank_rows if r["bank_txn_id"] == match_result["matched_bank_txn_id"]), None)

    # Score breakdown (reconstruct from reason string)
    score_factors = []
    if match_result and match_result.get("reason"):
        factor_labels = {
            "policy_in_memo": ("Policy in Memo", 0.55),
            "exact_amount": ("Exact Amount", 0.30),
            "near_amount": ("Near Amount", 0.15),
            "near_date": ("Near Date", 0.10),
            "soft_date": ("Soft Date", 0.05),
            "carrier_match": ("Carrier Match", 0.05),
            "name_hint": ("Name Hint", 0.05),
            "policy_rule_override": ("Policy Rule", 0.00),
        }
        for part in match_result["reason"].split(","):
            part = part.strip()
            if part in factor_labels:
                label, weight = factor_labels[part]
                score_factors.append({"key": part, "label": label, "weight": weight})

    return JSONResponse({
        "statement": stmt,
        "ams_expected": ams,
        "match_result": match_result,
        "exception": exception_data,
        "bank_transaction": bank_txn,
        "score_factors": score_factors,
    })


@app.get("/api/v1/demo/revenue/summary")
def api_revenue_summary() -> JSONResponse:
    """Revenue vs expected analysis: expected, received, variance by carrier and LOB."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")
    bank_rows = _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")

    # Build lookup: line index → statement data + expected data
    # AMS expected is keyed by position (same order as statement lines)
    line_data: list[dict] = []
    for i, stmt in enumerate(stmt_rows):
        ams = expected_rows[i] if i < len(expected_rows) else {}
        line_data.append({
            "line_id": stmt["line_id"],
            "carrier": stmt["carrier_name"],
            "lob": ams.get("lob", "Unknown"),
            "producer_id": ams.get("producer_id", ""),
            "expected": float(ams.get("expected_commission", 0)),
            "statement": float(stmt.get("gross_commission", 0)),
            "txn_type": stmt.get("txn_type", ""),
        })

    # Match result lookup for actual received amounts
    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_status: dict[str, str] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT line_id, status FROM match_results WHERE run_id = ?",
                (run_id,),
            ).fetchall()
            match_status = {r["line_id"]: r["status"] for r in rows}

    # Bank amounts indexed by txn_id
    bank_total = sum(float(r.get("amount", 0)) for r in bank_rows)

    # Aggregate by carrier
    carrier_agg: dict[str, dict] = {}
    lob_agg: dict[str, dict] = {}
    totals = {"expected": 0.0, "statement": 0.0, "matched": 0.0, "unmatched": 0.0, "clawbacks": 0.0}

    for ld in line_data:
        carrier = ld["carrier"]
        lob = ld["lob"]
        status = match_status.get(ld["line_id"], "unknown")

        for key, agg in [("carrier", carrier_agg), ("lob", lob_agg)]:
            bucket_key = carrier if key == "carrier" else lob
            if bucket_key not in agg:
                agg[bucket_key] = {"expected": 0.0, "statement": 0.0, "matched": 0.0,
                                   "unmatched": 0.0, "clawbacks": 0.0, "lines": 0, "matched_lines": 0}
            b = agg[bucket_key]
            b["expected"] += ld["expected"]
            b["statement"] += abs(ld["statement"])
            b["lines"] += 1
            if ld["txn_type"] == "clawback":
                b["clawbacks"] += ld["statement"]
            if status in ("auto_matched", "resolved"):
                b["matched"] += abs(ld["statement"])
                b["matched_lines"] += 1
            elif status in ("needs_review", "unmatched", "unknown"):
                b["unmatched"] += abs(ld["statement"])

        totals["expected"] += ld["expected"]
        totals["statement"] += abs(ld["statement"])
        if ld["txn_type"] == "clawback":
            totals["clawbacks"] += ld["statement"]
        if status in ("auto_matched", "resolved"):
            totals["matched"] += abs(ld["statement"])
        else:
            totals["unmatched"] += abs(ld["statement"])

    def round_agg(agg: dict) -> list[dict]:
        result = []
        for name, vals in sorted(agg.items()):
            variance = vals["statement"] - vals["expected"]
            pct = (variance / vals["expected"] * 100) if vals["expected"] else 0
            result.append({
                "name": name,
                "expected": round(vals["expected"], 2),
                "statement": round(vals["statement"], 2),
                "matched": round(vals["matched"], 2),
                "unmatched": round(vals["unmatched"], 2),
                "clawbacks": round(vals["clawbacks"], 2),
                "variance": round(variance, 2),
                "variance_pct": round(pct, 1),
                "lines": vals["lines"],
                "matched_lines": vals["matched_lines"],
                "match_rate": round(vals["matched_lines"] / vals["lines"] * 100, 1) if vals["lines"] else 0,
            })
        return result

    totals_variance = totals["statement"] - totals["expected"]
    return JSONResponse({
        "totals": {
            "expected": round(totals["expected"], 2),
            "statement": round(totals["statement"], 2),
            "matched": round(totals["matched"], 2),
            "unmatched": round(totals["unmatched"], 2),
            "clawbacks": round(totals["clawbacks"], 2),
            "variance": round(totals_variance, 2),
            "variance_pct": round(totals_variance / totals["expected"] * 100, 1) if totals["expected"] else 0,
            "bank_total": round(bank_total, 2),
            "lines": len(line_data),
        },
        "by_carrier": round_agg(carrier_agg),
        "by_lob": round_agg(lob_agg),
    })


def _read_csv(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


@app.get("/api/v1/demo/bank-transactions")
def api_bank_transactions(
    counterparty: str | None = None,
    limit: int = 500,
) -> JSONResponse:
    bank_rows = _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")

    if counterparty:
        bank_rows = [r for r in bank_rows if counterparty.lower() in r.get("counterparty", "").lower()]

    # Build match lookup from latest run
    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    matched_by_txn: dict[str, dict] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                """SELECT line_id, policy_number, matched_bank_txn_id, status, confidence
                   FROM match_results WHERE run_id = ? AND matched_bank_txn_id IS NOT NULL""",
                (run_id,),
            ).fetchall()
            for r in rows:
                txn_id = r["matched_bank_txn_id"]
                if txn_id not in matched_by_txn:
                    matched_by_txn[txn_id] = {
                        "line_id": r["line_id"],
                        "policy_number": r["policy_number"],
                        "match_status": r["status"],
                        "confidence": r["confidence"],
                    }

    result = []
    for row in bank_rows[:limit]:
        txn_id = row.get("bank_txn_id", "")
        match_info = matched_by_txn.get(txn_id)
        result.append({
            **row,
            "matched_line_id": match_info["line_id"] if match_info else None,
            "matched_policy": match_info["policy_number"] if match_info else None,
            "match_status": match_info["match_status"] if match_info else "unmatched",
            "confidence": match_info["confidence"] if match_info else None,
        })

    # Carrier list for filter dropdown
    carriers = sorted(set(r.get("counterparty", "") for r in _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")))

    return JSONResponse({"rows": result, "count": len(result), "carriers": carriers})


STATEMENTS_DIR = DATA_DIR / "raw/statements"


@app.get("/api/v1/demo/statements")
def api_list_statements() -> JSONResponse:
    rows = list_statement_metadata(DB_PATH)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.get("/api/v1/demo/statements/{statement_id}.pdf")
def api_get_statement_pdf(statement_id: str) -> FileResponse:
    pdf_path = STATEMENTS_DIR / f"{statement_id}.pdf"
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{statement_id}.pdf"'},
    )


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
    _load_statement_metadata()


def _load_statement_metadata() -> None:
    """Scan statement CSVs and PDFs to populate statement_metadata table."""
    csv_path = DATA_DIR / "raw/statements/statement_lines.csv"
    if not csv_path.exists():
        return

    rows = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["statement_id"], []).append(row)

    for statement_id, lines in grouped.items():
        carrier = lines[0]["carrier_name"]
        total_premium = sum(float(r["written_premium"]) for r in lines)
        total_commission = sum(float(r["gross_commission"]) for r in lines)
        eff_dates = [r["effective_date"] for r in lines if r.get("effective_date")]
        pdf_path = DATA_DIR / "raw/statements" / f"{statement_id}.pdf"
        upsert_statement_metadata(
            DB_PATH,
            {
                "statement_id": statement_id,
                "carrier_name": carrier,
                "line_count": len(lines),
                "total_premium": round(total_premium, 2),
                "total_commission": round(total_commission, 2),
                "min_effective_date": min(eff_dates) if eff_dates else None,
                "max_effective_date": max(eff_dates) if eff_dates else None,
                "pdf_path": str(pdf_path) if pdf_path.exists() else None,
            },
        )
