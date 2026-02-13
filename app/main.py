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
    create_adjustment,
    delete_split_rule,
    init_db,
    list_adjustments,
    list_audit_events,
    list_exceptions,
    list_match_results,
    list_match_runs,
    list_policy_rules,
    list_rule_versions,
    list_split_rules,
    list_statement_metadata,
    load_policy_overrides,
    log_audit_event,
    resolve_exception,
    save_match_run,
    upsert_policy_rule,
    upsert_split_rule,
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


class UpsertSplitRuleRequest(BaseModel):
    producer_id: str
    split_pct: float = 100.0
    house_pct: float = 0.0
    carrier: str | None = None
    lob: str | None = None
    fee_type: str = "percentage"
    fee_amount: float = 0.0
    effective_from: str | None = None
    effective_to: str | None = None
    note: str | None = None


class CreateAdjustmentRequest(BaseModel):
    producer_id: str
    adj_type: str
    amount: float
    description: str | None = None
    period: str | None = None


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
    log_audit_event(
        DB_PATH, event_type="match_run", action="created",
        entity_type="match_run", entity_id=run_id,
        detail=f"auto={save_counts['auto_matched']} review={save_counts['needs_review']} unmatched={save_counts['unmatched']}",
    )
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
    log_audit_event(
        DB_PATH, event_type="exception_resolved", action=payload.resolution_action,
        entity_type="line", entity_id=payload.line_id, actor="analyst",
        detail=payload.resolution_note,
        old_value="open", new_value="resolved",
    )
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
    log_audit_event(
        DB_PATH, event_type="rule_created", action="upsert",
        entity_type="policy_rule", entity_id=source, actor="analyst",
        detail=f"Map {source} → {target}",
        new_value=target,
    )
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

    # Audit events for this line
    audit = list_audit_events(DB_PATH, entity_type="line", entity_id=line_id, limit=50)

    return JSONResponse({
        "statement": stmt,
        "ams_expected": ams,
        "match_result": match_result,
        "exception": exception_data,
        "bank_transaction": bank_txn,
        "score_factors": score_factors,
        "audit_events": audit,
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


# ---------------------------------------------------------------------------
# Audit trail endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/audit")
def api_audit_events(
    entity_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 200,
) -> JSONResponse:
    rows = list_audit_events(DB_PATH, entity_type=entity_type, entity_id=entity_id, limit=limit)
    return JSONResponse({"rows": rows, "count": len(rows)})


# ---------------------------------------------------------------------------
# Accrual engine endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/accruals")
def api_accruals() -> JSONResponse:
    """Generate accrual entries: expected vs paid vs earned per line."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")
    bank_rows = _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, dict] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                """SELECT line_id, matched_bank_txn_id, status, confidence
                   FROM match_results WHERE run_id = ?""",
                (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: dict(r) for r in rows}

    bank_lookup = {r["bank_txn_id"]: float(r.get("amount", 0)) for r in bank_rows}

    accrual_entries = []
    totals = {"expected": 0.0, "on_statement": 0.0, "cash_received": 0.0, "accrued": 0.0, "true_up": 0.0}

    for i, stmt in enumerate(stmt_rows):
        ams = expected_rows[i] if i < len(expected_rows) else {}
        expected = float(ams.get("expected_commission", 0))
        on_statement = float(stmt.get("gross_commission", 0))
        mr = match_map.get(stmt["line_id"], {})
        cash_received = 0.0
        if mr.get("matched_bank_txn_id"):
            cash_received = bank_lookup.get(mr["matched_bank_txn_id"], 0.0)

        accrued = on_statement - cash_received if on_statement > 0 else 0.0
        true_up = cash_received - expected if cash_received else 0.0
        status = "settled" if abs(accrued) < 0.01 else "accrued"
        if on_statement < 0:
            status = "clawback"

        totals["expected"] += expected
        totals["on_statement"] += on_statement
        totals["cash_received"] += cash_received
        totals["accrued"] += max(accrued, 0)
        totals["true_up"] += true_up

        accrual_entries.append({
            "line_id": stmt["line_id"],
            "policy_number": stmt["policy_number"],
            "carrier_name": stmt["carrier_name"],
            "expected": round(expected, 2),
            "on_statement": round(on_statement, 2),
            "cash_received": round(cash_received, 2),
            "accrued": round(accrued, 2),
            "true_up_variance": round(true_up, 2),
            "status": status,
            "match_status": mr.get("status", "unknown"),
        })

    # Carrier summary
    carrier_agg: dict[str, dict] = {}
    for e in accrual_entries:
        c = e["carrier_name"]
        if c not in carrier_agg:
            carrier_agg[c] = {"expected": 0, "on_statement": 0, "cash_received": 0, "accrued": 0, "lines": 0, "settled": 0}
        b = carrier_agg[c]
        b["expected"] += e["expected"]
        b["on_statement"] += e["on_statement"]
        b["cash_received"] += e["cash_received"]
        b["accrued"] += max(e["accrued"], 0)
        b["lines"] += 1
        if e["status"] == "settled":
            b["settled"] += 1

    by_carrier = [
        {"carrier": k, **{kk: round(vv, 2) if isinstance(vv, float) else vv for kk, vv in v.items()}}
        for k, v in sorted(carrier_agg.items())
    ]

    return JSONResponse({
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "entries": accrual_entries,
        "by_carrier": by_carrier,
    })


# ---------------------------------------------------------------------------
# Journal / GL posting endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/journal")
def api_journal() -> JSONResponse:
    """Generate journal entries from resolved matches + accruals."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    bank_rows = _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")
    bank_lookup = {r["bank_txn_id"]: float(r.get("amount", 0)) for r in bank_rows}

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, dict] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                """SELECT line_id, matched_bank_txn_id, status
                   FROM match_results WHERE run_id = ?""",
                (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: dict(r) for r in rows}

    stmt_lookup = {r["line_id"]: r for r in stmt_rows}
    journal_entries = []
    je_id = 1

    for stmt in stmt_rows:
        mr = match_map.get(stmt["line_id"], {})
        commission = float(stmt.get("gross_commission", 0))
        cash = 0.0
        if mr.get("matched_bank_txn_id"):
            cash = bank_lookup.get(mr["matched_bank_txn_id"], 0.0)

        is_settled = mr.get("status") in ("auto_matched", "resolved") and abs(cash) > 0.01

        if is_settled:
            # Cash receipt + revenue recognition
            journal_entries.append({
                "je_id": f"JE-{je_id:05d}",
                "line_id": stmt["line_id"],
                "carrier": stmt["carrier_name"],
                "type": "cash_receipt",
                "debit_account": "1010 — Cash",
                "credit_account": "4010 — Commission Revenue",
                "amount": round(abs(cash), 2),
                "status": "posted",
                "description": f"Cash receipt {stmt['policy_number']}",
            })
            je_id += 1

            # If there's a difference, book to suspense
            diff = round(abs(commission) - abs(cash), 2)
            if abs(diff) > 0.01:
                journal_entries.append({
                    "je_id": f"JE-{je_id:05d}",
                    "line_id": stmt["line_id"],
                    "carrier": stmt["carrier_name"],
                    "type": "variance",
                    "debit_account": "1310 — Commission Suspense" if diff > 0 else "4010 — Commission Revenue",
                    "credit_account": "4010 — Commission Revenue" if diff > 0 else "1310 — Commission Suspense",
                    "amount": round(abs(diff), 2),
                    "status": "posted",
                    "description": f"Variance adjustment {stmt['policy_number']}",
                })
                je_id += 1
        elif commission < 0:
            # Clawback reversal
            journal_entries.append({
                "je_id": f"JE-{je_id:05d}",
                "line_id": stmt["line_id"],
                "carrier": stmt["carrier_name"],
                "type": "clawback",
                "debit_account": "4010 — Commission Revenue",
                "credit_account": "1200 — Accounts Receivable",
                "amount": round(abs(commission), 2),
                "status": "pending_review",
                "description": f"Clawback {stmt['policy_number']}",
            })
            je_id += 1
        else:
            # Accrual for unmatched/pending
            journal_entries.append({
                "je_id": f"JE-{je_id:05d}",
                "line_id": stmt["line_id"],
                "carrier": stmt["carrier_name"],
                "type": "accrual",
                "debit_account": "1200 — Accounts Receivable",
                "credit_account": "4010 — Commission Revenue",
                "amount": round(abs(commission), 2),
                "status": "accrued",
                "description": f"Accrual {stmt['policy_number']}",
            })
            je_id += 1

    # Summarize
    type_counts = Counter(e["type"] for e in journal_entries)
    total_posted = sum(e["amount"] for e in journal_entries if e["status"] == "posted")
    total_accrued = sum(e["amount"] for e in journal_entries if e["status"] == "accrued")
    total_pending = sum(e["amount"] for e in journal_entries if e["status"] == "pending_review")

    return JSONResponse({
        "entries": journal_entries,
        "count": len(journal_entries),
        "type_counts": dict(type_counts),
        "totals": {
            "posted": round(total_posted, 2),
            "accrued": round(total_accrued, 2),
            "pending_review": round(total_pending, 2),
        },
    })


@app.post("/api/v1/demo/journal/post")
def api_journal_post() -> JSONResponse:
    """Simulate posting journal entries to GL."""
    log_audit_event(
        DB_PATH, event_type="gl_posting", action="posted",
        entity_type="journal", entity_id="batch",
        actor="analyst", detail="Batch GL posting simulated",
    )
    return JSONResponse({"ok": True, "message": "Journal entries posted to GL (simulated)"})


# ---------------------------------------------------------------------------
# Export endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/exports/accrual.csv")
def api_export_accrual():
    """Export accrual entries as CSV."""
    import io
    accrual_data = api_accruals().body
    import json
    data = json.loads(accrual_data)
    entries = data["entries"]

    output = io.StringIO()
    if entries:
        fieldnames = list(entries[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for e in entries:
            writer.writerow(e)

    log_audit_event(DB_PATH, event_type="export", action="downloaded",
                    entity_type="export", entity_id="accrual.csv", actor="analyst")

    from starlette.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="accrual.csv"'},
    )


@app.get("/api/v1/demo/exports/journal.csv")
def api_export_journal():
    """Export journal entries as CSV."""
    import io, json
    journal_data = json.loads(api_journal().body)
    entries = journal_data["entries"]

    output = io.StringIO()
    if entries:
        fieldnames = list(entries[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for e in entries:
            writer.writerow(e)

    log_audit_event(DB_PATH, event_type="export", action="downloaded",
                    entity_type="export", entity_id="journal.csv", actor="analyst")

    from starlette.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="journal.csv"'},
    )


@app.get("/api/v1/demo/exports/producer-payout.csv")
def api_export_producer_payout():
    """Export producer payout summary as CSV."""
    import io, json
    producer_data = json.loads(api_producers().body)
    entries = producer_data["producers"]

    output = io.StringIO()
    if entries:
        fieldnames = list(entries[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for e in entries:
            writer.writerow(e)

    log_audit_event(DB_PATH, event_type="export", action="downloaded",
                    entity_type="export", entity_id="producer-payout.csv", actor="analyst")

    from starlette.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="producer-payout.csv"'},
    )


# ---------------------------------------------------------------------------
# Producer compensation endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/producers")
def api_producers() -> JSONResponse:
    """Producer compensation summary: commission by producer, carrier, LOB."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, str] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT line_id, status FROM match_results WHERE run_id = ?",
                (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: r["status"] for r in rows}

    producer_agg: dict[str, dict] = {}
    for i, stmt in enumerate(stmt_rows):
        ams = expected_rows[i] if i < len(expected_rows) else {}
        producer_id = ams.get("producer_id", "Unknown")
        office = ams.get("office", "")
        lob = ams.get("lob", "Unknown")
        commission = float(stmt.get("gross_commission", 0))
        expected = float(ams.get("expected_commission", 0))
        status = match_map.get(stmt["line_id"], "unknown")

        if producer_id not in producer_agg:
            producer_agg[producer_id] = {
                "producer_id": producer_id,
                "office": office,
                "total_commission": 0.0,
                "total_expected": 0.0,
                "matched_commission": 0.0,
                "pending_commission": 0.0,
                "clawbacks": 0.0,
                "lines": 0,
                "matched_lines": 0,
                "carriers": set(),
                "lobs": set(),
            }
        p = producer_agg[producer_id]
        p["total_commission"] += commission
        p["total_expected"] += expected
        p["lines"] += 1
        p["carriers"].add(stmt["carrier_name"])
        p["lobs"].add(lob)
        if stmt.get("txn_type") == "clawback":
            p["clawbacks"] += commission
        if status in ("auto_matched", "resolved"):
            p["matched_commission"] += commission
            p["matched_lines"] += 1
        else:
            p["pending_commission"] += commission

    producers = []
    for p in sorted(producer_agg.values(), key=lambda x: x["total_commission"], reverse=True):
        producers.append({
            "producer_id": p["producer_id"],
            "office": p["office"],
            "total_commission": round(p["total_commission"], 2),
            "total_expected": round(p["total_expected"], 2),
            "matched_commission": round(p["matched_commission"], 2),
            "pending_commission": round(p["pending_commission"], 2),
            "clawbacks": round(p["clawbacks"], 2),
            "net_payout": round(p["matched_commission"] + p["clawbacks"], 2),
            "lines": p["lines"],
            "matched_lines": p["matched_lines"],
            "match_rate": round(p["matched_lines"] / p["lines"] * 100, 1) if p["lines"] else 0,
            "carriers": sorted(p["carriers"]),
            "lobs": sorted(p["lobs"]),
        })

    totals = {
        "total_commission": round(sum(p["total_commission"] for p in producers), 2),
        "matched_commission": round(sum(p["matched_commission"] for p in producers), 2),
        "pending_commission": round(sum(p["pending_commission"] for p in producers), 2),
        "clawbacks": round(sum(p["clawbacks"] for p in producers), 2),
        "net_payout": round(sum(p["net_payout"] for p in producers), 2),
        "producers": len(producers),
    }

    return JSONResponse({"producers": producers, "totals": totals})


# ---------------------------------------------------------------------------
# Deal/Split rules (3.2)
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/splits")
def api_list_splits(producer_id: str | None = None) -> JSONResponse:
    rows = list_split_rules(DB_PATH, producer_id=producer_id)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.post("/api/v1/demo/splits")
def api_upsert_split(payload: UpsertSplitRuleRequest) -> JSONResponse:
    row = upsert_split_rule(
        DB_PATH,
        producer_id=payload.producer_id,
        split_pct=payload.split_pct,
        house_pct=payload.house_pct,
        carrier=payload.carrier,
        lob=payload.lob,
        fee_type=payload.fee_type,
        fee_amount=payload.fee_amount,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        note=payload.note,
    )
    log_audit_event(
        DB_PATH, event_type="split_rule", action="upsert",
        entity_type="split_rule", entity_id=payload.producer_id, actor="analyst",
        detail=f"{payload.producer_id}: {payload.split_pct}% producer / {payload.house_pct}% house",
        new_value=f"{payload.split_pct}/{payload.house_pct}",
    )
    return JSONResponse({"ok": True, "rule": row})


@app.delete("/api/v1/demo/splits/{rule_id}")
def api_delete_split(rule_id: int) -> JSONResponse:
    ok = delete_split_rule(DB_PATH, rule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Rule not found")
    log_audit_event(
        DB_PATH, event_type="split_rule", action="deleted",
        entity_type="split_rule", entity_id=str(rule_id), actor="analyst",
    )
    return JSONResponse({"ok": True})


@app.post("/api/v1/demo/splits/seed")
def api_seed_splits() -> JSONResponse:
    """Seed demo split rules for all producers."""
    import random
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")
    producers = sorted(set(r.get("producer_id", "") for r in expected_rows if r.get("producer_id")))

    seeded = 0
    for pid in producers:
        # Default split: producer gets 60-85%, house gets the rest
        split = random.choice([60, 65, 70, 75, 80, 85])
        upsert_split_rule(DB_PATH, producer_id=pid, split_pct=float(split), house_pct=float(100 - split),
                          note="Default split (seeded)")
        seeded += 1

        # Some producers get carrier-specific overrides
        if random.random() < 0.4:
            carrier = random.choice(["Summit National", "Wilson Mutual", "Northfield Specialty"])
            override_split = random.choice([55, 60, 65, 70, 90])
            upsert_split_rule(DB_PATH, producer_id=pid, split_pct=float(override_split),
                              house_pct=float(100 - override_split), carrier=carrier,
                              note=f"Carrier override for {carrier} (seeded)")
            seeded += 1

    return JSONResponse({"ok": True, "seeded": seeded})


# ---------------------------------------------------------------------------
# Netting & Adjustments (3.3)
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/adjustments")
def api_list_adjustments(producer_id: str | None = None) -> JSONResponse:
    rows = list_adjustments(DB_PATH, producer_id=producer_id)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.post("/api/v1/demo/adjustments")
def api_create_adjustment(payload: CreateAdjustmentRequest) -> JSONResponse:
    row = create_adjustment(
        DB_PATH,
        producer_id=payload.producer_id,
        adj_type=payload.adj_type,
        amount=payload.amount,
        description=payload.description,
        period=payload.period,
    )
    log_audit_event(
        DB_PATH, event_type="adjustment", action="created",
        entity_type="adjustment", entity_id=payload.producer_id, actor="analyst",
        detail=f"{payload.adj_type}: ${payload.amount:.2f} for {payload.producer_id}",
    )
    return JSONResponse({"ok": True, "adjustment": row})


@app.post("/api/v1/demo/adjustments/seed")
def api_seed_adjustments() -> JSONResponse:
    """Seed demo adjustments: clawback offsets, chargebacks, draws."""
    import random
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")
    producers = sorted(set(r.get("producer_id", "") for r in expected_rows if r.get("producer_id")))

    seeded = 0
    adj_types = [
        ("clawback_offset", -200, -50, "Clawback offset from carrier reversal"),
        ("chargeback", -500, -100, "E&O chargeback"),
        ("draw_advance", -1000, -300, "Monthly draw advance"),
        ("draw_repayment", 200, 800, "Draw repayment from commissions"),
        ("bonus", 500, 2000, "Quarterly production bonus"),
    ]

    for pid in producers:
        # Each producer gets 1-3 adjustments
        for _ in range(random.randint(1, 3)):
            adj_type, lo, hi, desc = random.choice(adj_types)
            amount = round(random.uniform(lo, hi), 2)
            create_adjustment(DB_PATH, producer_id=pid, adj_type=adj_type,
                              amount=amount, description=desc, period="2026-01")
            seeded += 1

    return JSONResponse({"ok": True, "seeded": seeded})


@app.get("/api/v1/demo/netting")
def api_netting() -> JSONResponse:
    """Net position per producer: gross commission - clawbacks - adjustments = net payout."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")
    adjustments = list_adjustments(DB_PATH)
    splits = list_split_rules(DB_PATH)

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, str] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT line_id, status FROM match_results WHERE run_id = ?", (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: r["status"] for r in rows}

    # Build split lookup: (producer, carrier) → split_pct, default (producer, None) → split_pct
    split_lookup: dict[tuple[str, str | None], float] = {}
    for s in splits:
        key = (s["producer_id"], s.get("carrier"))
        split_lookup[key] = s["split_pct"]

    # Aggregate by producer
    producer_agg: dict[str, dict] = {}
    for i, stmt in enumerate(stmt_rows):
        ams = expected_rows[i] if i < len(expected_rows) else {}
        pid = ams.get("producer_id", "Unknown")
        commission = float(stmt.get("gross_commission", 0))
        status = match_map.get(stmt["line_id"], "unknown")
        carrier = stmt.get("carrier_name", "")

        if pid not in producer_agg:
            producer_agg[pid] = {
                "producer_id": pid,
                "gross_commission": 0.0,
                "clawbacks": 0.0,
                "matched_commission": 0.0,
                "producer_share": 0.0,
                "house_share": 0.0,
                "adjustments_total": 0.0,
                "net_payout": 0.0,
                "lines": 0,
            }
        p = producer_agg[pid]
        p["gross_commission"] += commission
        p["lines"] += 1

        if stmt.get("txn_type") == "clawback":
            p["clawbacks"] += commission

        if status in ("auto_matched", "resolved"):
            p["matched_commission"] += commission
            # Apply split
            split_pct = split_lookup.get((pid, carrier), split_lookup.get((pid, None), 100.0))
            p["producer_share"] += commission * split_pct / 100.0
            p["house_share"] += commission * (100.0 - split_pct) / 100.0

    # Apply adjustments
    adj_by_producer: dict[str, list] = {}
    for adj in adjustments:
        adj_by_producer.setdefault(adj["producer_id"], []).append(adj)

    for pid, p in producer_agg.items():
        adjs = adj_by_producer.get(pid, [])
        adj_total = sum(a["amount"] for a in adjs)
        p["adjustments_total"] = round(adj_total, 2)
        p["net_payout"] = round(p["producer_share"] + adj_total, 2)
        p["producer_share"] = round(p["producer_share"], 2)
        p["house_share"] = round(p["house_share"], 2)
        p["gross_commission"] = round(p["gross_commission"], 2)
        p["clawbacks"] = round(p["clawbacks"], 2)
        p["matched_commission"] = round(p["matched_commission"], 2)
        p["adjustment_details"] = adjs

    producers = sorted(producer_agg.values(), key=lambda x: x["gross_commission"], reverse=True)

    totals = {
        "gross_commission": round(sum(p["gross_commission"] for p in producers), 2),
        "clawbacks": round(sum(p["clawbacks"] for p in producers), 2),
        "producer_share": round(sum(p["producer_share"] for p in producers), 2),
        "house_share": round(sum(p["house_share"] for p in producers), 2),
        "adjustments": round(sum(p["adjustments_total"] for p in producers), 2),
        "net_payout": round(sum(p["net_payout"] for p in producers), 2),
    }

    return JSONResponse({"producers": producers, "totals": totals})


# ---------------------------------------------------------------------------
# Rule versions / versioning (3.4)
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/rule-versions")
def api_rule_versions(rule_type: str | None = None, rule_id: str | None = None) -> JSONResponse:
    rows = list_rule_versions(DB_PATH, rule_type=rule_type, rule_id=rule_id)
    return JSONResponse({"rows": rows, "count": len(rows)})


@app.post("/api/v1/demo/rules/test")
def api_test_rule_change(payload: UpsertSplitRuleRequest) -> JSONResponse:
    """Test harness: simulate what would change if this split rule were applied to last month's results."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, str] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT line_id, status FROM match_results WHERE run_id = ?", (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: r["status"] for r in rows}

    # Current splits
    current_splits = list_split_rules(DB_PATH, producer_id=payload.producer_id)
    current_default = next((s["split_pct"] for s in current_splits
                            if not s.get("carrier") and not s.get("lob")), 100.0)

    # Calculate current vs proposed
    affected_lines = []
    total_current = 0.0
    total_proposed = 0.0

    for i, stmt in enumerate(stmt_rows):
        ams = expected_rows[i] if i < len(expected_rows) else {}
        if ams.get("producer_id") != payload.producer_id:
            continue
        status = match_map.get(stmt["line_id"], "unknown")
        if status not in ("auto_matched", "resolved"):
            continue

        commission = float(stmt.get("gross_commission", 0))
        carrier = stmt.get("carrier_name", "")

        # Should this line be affected by the proposed rule?
        matches_carrier = not payload.carrier or payload.carrier == carrier
        matches_lob = not payload.lob or payload.lob == ams.get("lob", "")

        current_pct = current_default
        for s in current_splits:
            if s.get("carrier") == carrier:
                current_pct = s["split_pct"]
                break

        if matches_carrier and matches_lob:
            proposed_pct = payload.split_pct
        else:
            proposed_pct = current_pct

        current_share = commission * current_pct / 100.0
        proposed_share = commission * proposed_pct / 100.0
        total_current += current_share
        total_proposed += proposed_share

        if abs(current_share - proposed_share) > 0.01:
            affected_lines.append({
                "line_id": stmt["line_id"],
                "policy_number": stmt["policy_number"],
                "carrier": carrier,
                "commission": round(commission, 2),
                "current_pct": current_pct,
                "proposed_pct": proposed_pct,
                "current_share": round(current_share, 2),
                "proposed_share": round(proposed_share, 2),
                "delta": round(proposed_share - current_share, 2),
            })

    return JSONResponse({
        "producer_id": payload.producer_id,
        "affected_lines": len(affected_lines),
        "current_total": round(total_current, 2),
        "proposed_total": round(total_proposed, 2),
        "delta": round(total_proposed - total_current, 2),
        "lines": affected_lines[:50],
    })


# ---------------------------------------------------------------------------
# Statement upload simulation
# ---------------------------------------------------------------------------

@app.post("/api/v1/demo/statements/upload")
def api_upload_statement(carrier: str | None = None) -> JSONResponse:
    """Simulate statement upload + AI parsing. Returns pre-loaded lines for the carrier."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")

    # Pick a carrier to simulate (default to first available or specified)
    carriers = sorted(set(r["carrier_name"] for r in stmt_rows))
    if carrier and carrier in carriers:
        target_carrier = carrier
    else:
        import random
        target_carrier = random.choice(carriers) if carriers else "Summit National"

    # Get lines for one statement from this carrier
    carrier_lines = [r for r in stmt_rows if r["carrier_name"] == target_carrier]
    # Group by statement_id and pick one
    grouped: dict[str, list] = {}
    for r in carrier_lines:
        grouped.setdefault(r["statement_id"], []).append(r)

    import random as rng
    stmt_id = rng.choice(list(grouped.keys())) if grouped else ""
    lines = grouped.get(stmt_id, [])

    # Simulate extraction with confidence scores
    extracted = []
    for row in lines:
        conf = rng.uniform(0.82, 0.99)
        # Occasionally lower confidence for "hard to parse" fields
        field_confs = {
            "policy_number": round(rng.uniform(0.85, 1.0), 2),
            "insured_name": round(rng.uniform(0.70, 0.99), 2),
            "written_premium": round(rng.uniform(0.90, 1.0), 2),
            "gross_commission": round(rng.uniform(0.88, 1.0), 2),
            "effective_date": round(rng.uniform(0.80, 1.0), 2),
        }
        extracted.append({
            **row,
            "extraction_confidence": round(conf, 2),
            "field_confidences": field_confs,
        })

    log_audit_event(
        DB_PATH, event_type="statement_upload", action="parsed",
        entity_type="statement", entity_id=stmt_id, actor="analyst",
        detail=f"Uploaded {target_carrier} statement, extracted {len(extracted)} lines",
    )

    return JSONResponse({
        "ok": True,
        "carrier": target_carrier,
        "statement_id": stmt_id,
        "lines_extracted": len(extracted),
        "avg_confidence": round(sum(e["extraction_confidence"] for e in extracted) / len(extracted), 2) if extracted else 0,
        "extracted_lines": extracted,
    })


# ---------------------------------------------------------------------------
# Variance / Aging analysis
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/aging")
def api_aging() -> JSONResponse:
    """Variance and aging analysis: unmatched by carrier, reason, and age buckets."""
    from datetime import date

    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    cases = read_case_manifest(DATA_DIR / "demo_cases/case_manifest.csv")
    case_lookup = {c["line_id"]: c for c in cases}

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, dict] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                """SELECT line_id, status, reason, confidence
                   FROM match_results WHERE run_id = ?""",
                (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: dict(r) for r in rows}

    today = date.today()
    buckets = {"0-7d": 0, "8-30d": 0, "31-60d": 0, "60+d": 0}
    bucket_amounts = {"0-7d": 0.0, "8-30d": 0.0, "31-60d": 0.0, "60+d": 0.0}
    by_carrier: dict[str, dict] = {}
    by_reason: dict[str, dict] = {}
    open_items = []

    for stmt in stmt_rows:
        mr = match_map.get(stmt["line_id"], {})
        status = mr.get("status", "unknown")
        if status in ("auto_matched", "resolved"):
            continue

        commission = abs(float(stmt.get("gross_commission", 0)))
        carrier = stmt["carrier_name"]
        case = case_lookup.get(stmt["line_id"], {})
        reason = mr.get("reason", case.get("expected_reason", "unknown"))
        level = case.get("level", "L1")
        severity = case.get("severity", "low")

        # Calculate age from txn_date
        try:
            txn_date = date.fromisoformat(stmt.get("txn_date", "")[:10])
            age_days = (today - txn_date).days
        except (ValueError, TypeError):
            age_days = 0

        if age_days <= 7:
            bucket = "0-7d"
        elif age_days <= 30:
            bucket = "8-30d"
        elif age_days <= 60:
            bucket = "31-60d"
        else:
            bucket = "60+d"

        buckets[bucket] += 1
        bucket_amounts[bucket] += commission

        # By carrier
        if carrier not in by_carrier:
            by_carrier[carrier] = {"count": 0, "amount": 0.0}
        by_carrier[carrier]["count"] += 1
        by_carrier[carrier]["amount"] += commission

        # By reason
        base_reason = reason.split(",")[0] if reason else "unknown"
        if base_reason not in by_reason:
            by_reason[base_reason] = {"count": 0, "amount": 0.0}
        by_reason[base_reason]["count"] += 1
        by_reason[base_reason]["amount"] += commission

        open_items.append({
            "line_id": stmt["line_id"],
            "policy_number": stmt["policy_number"],
            "carrier_name": carrier,
            "insured_name": stmt.get("insured_name", ""),
            "commission": round(commission, 2),
            "txn_date": stmt.get("txn_date", ""),
            "age_days": age_days,
            "bucket": bucket,
            "reason": base_reason,
            "level": level,
            "severity": severity,
            "status": status,
            "confidence": mr.get("confidence", 0),
        })

    # Sort by age descending
    open_items.sort(key=lambda x: x["age_days"], reverse=True)

    return JSONResponse({
        "total_open": len(open_items),
        "total_amount": round(sum(i["commission"] for i in open_items), 2),
        "buckets": {k: {"count": buckets[k], "amount": round(bucket_amounts[k], 2)} for k in buckets},
        "by_carrier": [
            {"carrier": k, "count": v["count"], "amount": round(v["amount"], 2)}
            for k, v in sorted(by_carrier.items())
        ],
        "by_reason": [
            {"reason": k, "count": v["count"], "amount": round(v["amount"], 2)}
            for k, v in sorted(by_reason.items(), key=lambda x: x[1]["amount"], reverse=True)
        ],
        "items": open_items,
    })


# ---------------------------------------------------------------------------
# Carrier scorecard
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/carriers")
def api_carrier_scorecard() -> JSONResponse:
    """Per-carrier summary: statements, lines, premium, commission, match rate, exceptions."""
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    cases = read_case_manifest(DATA_DIR / "demo_cases/case_manifest.csv")
    case_lookup = {c["line_id"]: c for c in cases}

    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    match_map: dict[str, dict] = {}
    if run_id:
        with get_conn(DB_PATH) as conn:
            rows = conn.execute(
                """SELECT line_id, status, reason, confidence
                   FROM match_results WHERE run_id = ?""",
                (run_id,),
            ).fetchall()
            match_map = {r["line_id"]: dict(r) for r in rows}

    carrier_data: dict[str, dict] = {}
    for stmt in stmt_rows:
        c = stmt["carrier_name"]
        if c not in carrier_data:
            carrier_data[c] = {
                "carrier": c,
                "statements": set(),
                "lines": 0,
                "total_premium": 0.0,
                "total_commission": 0.0,
                "auto_matched": 0,
                "needs_review": 0,
                "unmatched": 0,
                "resolved": 0,
                "clawbacks": 0,
                "clawback_amount": 0.0,
                "confidence_sum": 0.0,
                "confidence_count": 0,
                "exception_reasons": Counter(),
            }
        cd = carrier_data[c]
        cd["statements"].add(stmt["statement_id"])
        cd["lines"] += 1
        cd["total_premium"] += float(stmt.get("written_premium", 0))
        cd["total_commission"] += float(stmt.get("gross_commission", 0))

        if stmt.get("txn_type") == "clawback":
            cd["clawbacks"] += 1
            cd["clawback_amount"] += float(stmt.get("gross_commission", 0))

        mr = match_map.get(stmt["line_id"], {})
        status = mr.get("status", "unknown")
        if status == "auto_matched":
            cd["auto_matched"] += 1
        elif status == "needs_review":
            cd["needs_review"] += 1
        elif status == "resolved":
            cd["resolved"] += 1
        elif status == "unmatched":
            cd["unmatched"] += 1

        if mr.get("confidence"):
            cd["confidence_sum"] += mr["confidence"]
            cd["confidence_count"] += 1

        if status in ("needs_review", "unmatched"):
            case = case_lookup.get(stmt["line_id"], {})
            reason = mr.get("reason", case.get("expected_reason", "unknown")).split(",")[0]
            cd["exception_reasons"][reason] += 1

    carriers = []
    for cd in sorted(carrier_data.values(), key=lambda x: x["total_commission"], reverse=True):
        total = cd["auto_matched"] + cd["needs_review"] + cd["unmatched"] + cd["resolved"]
        matched = cd["auto_matched"] + cd["resolved"]
        carriers.append({
            "carrier": cd["carrier"],
            "statements": len(cd["statements"]),
            "lines": cd["lines"],
            "total_premium": round(cd["total_premium"], 2),
            "total_commission": round(cd["total_commission"], 2),
            "auto_matched": cd["auto_matched"],
            "needs_review": cd["needs_review"],
            "unmatched": cd["unmatched"],
            "resolved": cd["resolved"],
            "match_rate": round(matched / total * 100, 1) if total else 0,
            "avg_confidence": round(cd["confidence_sum"] / cd["confidence_count"], 3) if cd["confidence_count"] else 0,
            "clawbacks": cd["clawbacks"],
            "clawback_amount": round(cd["clawback_amount"], 2),
            "top_exceptions": [
                {"reason": r, "count": c}
                for r, c in cd["exception_reasons"].most_common(5)
            ],
        })

    return JSONResponse({"carriers": carriers})


# ---------------------------------------------------------------------------
# Background reconciliation simulation
# ---------------------------------------------------------------------------

@app.post("/api/v1/demo/background-resolve")
def api_background_resolve(count: int = 3) -> JSONResponse:
    """Auto-resolve the highest-confidence open exceptions (simulating background recon)."""
    from app.persistence import latest_run_id, get_conn
    run_id = latest_run_id(DB_PATH)
    if not run_id:
        return JSONResponse({"ok": False, "resolved": 0, "message": "No match run found"})

    with get_conn(DB_PATH) as conn:
        # Find highest-confidence open exceptions
        candidates = conn.execute(
            """SELECT e.line_id, r.confidence, r.matched_bank_txn_id
               FROM exceptions e
               JOIN match_results r ON e.run_id = r.run_id AND e.line_id = r.line_id
               WHERE e.run_id = ? AND e.status = 'open'
               ORDER BY r.confidence DESC
               LIMIT ?""",
            (run_id, count),
        ).fetchall()

    resolved_lines = []
    for c in candidates:
        row = resolve_exception(
            DB_PATH,
            line_id=c["line_id"],
            resolution_action="auto_resolved",
            resolved_bank_txn_id=c["matched_bank_txn_id"],
            resolution_note=f"Background reconciliation (confidence: {c['confidence']:.1%})",
        )
        if row:
            resolved_lines.append(c["line_id"])
            log_audit_event(
                DB_PATH, event_type="background_recon", action="auto_resolved",
                entity_type="line", entity_id=c["line_id"], actor="system",
                detail=f"Auto-resolved at {c['confidence']:.1%} confidence",
                old_value="open", new_value="resolved",
            )

    return JSONResponse({
        "ok": True,
        "resolved": len(resolved_lines),
        "lines": resolved_lines,
        "message": f"{len(resolved_lines)} exceptions auto-resolved by background reconciliation",
    })


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


# ---------------------------------------------------------------------------
# Month-End Close Dashboard (3.10)
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/close-status")
def api_close_status() -> JSONResponse:
    """Month-end close readiness: statements, matching, exceptions, accruals, journal."""
    from datetime import date
    from app.persistence import latest_run_id, get_conn

    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    bank_rows = _read_csv(DATA_DIR / "raw/bank/bank_feed.csv")
    expected_rows = _read_csv(DATA_DIR / "expected/ams_expected.csv")

    # Statement coverage: unique statements received vs expected (3 carriers × ~4 statements each)
    statements = list_statement_metadata(DB_PATH)
    carriers = sorted(set(r["carrier_name"] for r in stmt_rows))
    expected_statement_count = len(set(r["statement_id"] for r in stmt_rows))
    received_statement_count = len(statements)

    # Match run status
    run_id = latest_run_id(DB_PATH)
    match_stats = {"auto_matched": 0, "needs_review": 0, "unmatched": 0, "resolved": 0, "total": 0}
    open_exceptions = 0
    if run_id:
        with get_conn(DB_PATH) as conn:
            row = conn.execute(
                """SELECT
                    SUM(CASE WHEN status='auto_matched' THEN 1 ELSE 0 END) AS auto_matched,
                    SUM(CASE WHEN status='needs_review' THEN 1 ELSE 0 END) AS needs_review,
                    SUM(CASE WHEN status='unmatched' THEN 1 ELSE 0 END) AS unmatched,
                    SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) AS resolved,
                    COUNT(*) AS total
                FROM match_results WHERE run_id = ?""",
                (run_id,),
            ).fetchone()
            if row:
                match_stats = {k: int(row[k] or 0) for k in match_stats}
            ex_row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM exceptions WHERE run_id = ? AND status = 'open'",
                (run_id,),
            ).fetchone()
            open_exceptions = int(ex_row["cnt"]) if ex_row else 0

    matched_total = match_stats["auto_matched"] + match_stats["resolved"]
    match_pct = round(matched_total / match_stats["total"] * 100, 1) if match_stats["total"] else 0

    # Cash coverage
    total_statement_amount = sum(abs(float(r.get("gross_commission", 0))) for r in stmt_rows)
    total_bank_amount = sum(abs(float(r.get("amount", 0))) for r in bank_rows)
    cash_coverage_pct = round(total_bank_amount / total_statement_amount * 100, 1) if total_statement_amount else 0

    # Accrual & journal status (check if audit events exist for these)
    audit_rows = list_audit_events(DB_PATH, entity_type="journal", limit=1)
    journal_posted = len(audit_rows) > 0

    # Build checklist items
    checklist = [
        {
            "id": "statements",
            "label": "Carrier Statements Received",
            "status": "complete" if received_statement_count >= expected_statement_count else "in_progress",
            "detail": f"{received_statement_count}/{expected_statement_count} statements",
            "pct": round(received_statement_count / expected_statement_count * 100) if expected_statement_count else 0,
        },
        {
            "id": "matching",
            "label": "Matching Engine Run",
            "status": "complete" if run_id else "pending",
            "detail": f"{matched_total} matched of {match_stats['total']}" if run_id else "No match run yet",
            "pct": match_pct if run_id else 0,
        },
        {
            "id": "cash",
            "label": "Cash Application",
            "status": "complete" if cash_coverage_pct >= 95 else "in_progress" if cash_coverage_pct > 0 else "pending",
            "detail": f"{cash_coverage_pct}% cash coverage",
            "pct": min(cash_coverage_pct, 100),
        },
        {
            "id": "exceptions",
            "label": "Exception Resolution",
            "status": "complete" if open_exceptions == 0 and run_id else "in_progress" if run_id else "pending",
            "detail": f"{open_exceptions} exceptions remaining" if run_id else "Waiting for match run",
            "pct": round((1 - open_exceptions / max(match_stats["needs_review"] + match_stats["unmatched"], 1)) * 100) if run_id else 0,
        },
        {
            "id": "accruals",
            "label": "Accruals Calculated",
            "status": "complete" if run_id else "pending",
            "detail": "Accruals auto-calculated from match results" if run_id else "Waiting for match run",
            "pct": 100 if run_id else 0,
        },
        {
            "id": "journal",
            "label": "Journal Posted to GL",
            "status": "complete" if journal_posted else "pending",
            "detail": "GL posting confirmed" if journal_posted else "Awaiting GL posting",
            "pct": 100 if journal_posted else 0,
        },
    ]

    completed = sum(1 for c in checklist if c["status"] == "complete")
    overall_pct = round(completed / len(checklist) * 100)

    # Blocking items
    blockers = []
    if open_exceptions > 0:
        blockers.append(f"{open_exceptions} open exceptions need resolution")
    if not run_id:
        blockers.append("No match run executed yet — run matching first")
    if not journal_posted:
        blockers.append("Journal entries not yet posted to GL")
    for carrier in carriers:
        carrier_stmts = [s for s in statements if s["carrier_name"] == carrier]
        expected_for_carrier = len(set(r["statement_id"] for r in stmt_rows if r["carrier_name"] == carrier))
        if len(carrier_stmts) < expected_for_carrier:
            blockers.append(f"{carrier}: {len(carrier_stmts)}/{expected_for_carrier} statements received")

    return JSONResponse({
        "period": "2026-01",
        "overall_pct": overall_pct,
        "completed_steps": completed,
        "total_steps": len(checklist),
        "checklist": checklist,
        "blockers": blockers,
        "summary": {
            "statements": received_statement_count,
            "statement_lines": len(stmt_rows),
            "bank_transactions": len(bank_rows),
            "match_pct": match_pct,
            "open_exceptions": open_exceptions,
            "cash_coverage_pct": cash_coverage_pct,
            "journal_posted": journal_posted,
        },
    })


# ---------------------------------------------------------------------------
# Carrier Field Mapping Templates (3.11)
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/carrier-mappings")
def api_carrier_mappings() -> JSONResponse:
    """Per-carrier field mapping configuration showing how statement fields map to schema."""
    mappings = [
        {
            "carrier": "Summit National",
            "format": "PDF — Formal corporate layout",
            "date_format": "MM/DD/YYYY",
            "name_format": "First Last",
            "field_mappings": [
                {"source_column": "Policy No.", "target_field": "policy_number", "confidence": 0.98},
                {"source_column": "Named Insured", "target_field": "insured_name", "confidence": 0.92},
                {"source_column": "Eff. Date", "target_field": "effective_date", "confidence": 0.95},
                {"source_column": "Written Prem", "target_field": "written_premium", "confidence": 0.99},
                {"source_column": "Comm Amt", "target_field": "gross_commission", "confidence": 0.97},
                {"source_column": "Trans Type", "target_field": "txn_type", "confidence": 0.94},
            ],
            "avg_confidence": 0.96,
            "known_issues": ["Commission sometimes rounded to nearest dollar", "Date column occasionally blank for endorsements"],
            "sample_count": 0,
        },
        {
            "carrier": "Wilson Mutual",
            "format": "PDF — Compact spreadsheet style",
            "date_format": "DD-Mon-YYYY",
            "name_format": "First Last",
            "field_mappings": [
                {"source_column": "POL#", "target_field": "policy_number", "confidence": 0.97},
                {"source_column": "INSURED", "target_field": "insured_name", "confidence": 0.88},
                {"source_column": "EFF DT", "target_field": "effective_date", "confidence": 0.93},
                {"source_column": "PREM", "target_field": "written_premium", "confidence": 0.98},
                {"source_column": "COMM", "target_field": "gross_commission", "confidence": 0.96},
                {"source_column": "TYPE", "target_field": "txn_type", "confidence": 0.91},
            ],
            "avg_confidence": 0.94,
            "known_issues": ["Insured name sometimes uses 'Last, First' format", "Abbreviates carrier name in bank remittance"],
            "sample_count": 0,
        },
        {
            "carrier": "Northfield Specialty",
            "format": "PDF — Legacy/monospace layout",
            "date_format": "YYYY-MM-DD",
            "name_format": "Last, First (legacy)",
            "field_mappings": [
                {"source_column": "POLICY", "target_field": "policy_number", "confidence": 0.95},
                {"source_column": "NAME", "target_field": "insured_name", "confidence": 0.82},
                {"source_column": "DATE", "target_field": "effective_date", "confidence": 0.90},
                {"source_column": "PREMIUM", "target_field": "written_premium", "confidence": 0.96},
                {"source_column": "COMMISSION", "target_field": "gross_commission", "confidence": 0.93},
                {"source_column": "TXN", "target_field": "txn_type", "confidence": 0.88},
            ],
            "avg_confidence": 0.91,
            "known_issues": [
                "Legacy Courier font causes OCR issues on scanned documents",
                "Name always in 'Last, First' format — needs normalization",
                "Slight page rotation on scanned PDFs reduces confidence",
            ],
            "sample_count": 0,
        },
    ]

    # Enrich with actual line counts
    stmt_rows = _read_csv(DATA_DIR / "raw/statements/statement_lines.csv")
    for m in mappings:
        m["sample_count"] = len([r for r in stmt_rows if r["carrier_name"] == m["carrier"]])

    return JSONResponse({"mappings": mappings})


# ---------------------------------------------------------------------------
# Recalculation Snapshots (3.13)
# ---------------------------------------------------------------------------

@app.get("/api/v1/demo/run-comparison")
def api_run_comparison() -> JSONResponse:
    """Compare two most recent match runs to show what changed."""
    from app.persistence import get_conn

    runs = list_match_runs(DB_PATH, limit=10)
    if len(runs) < 2:
        return JSONResponse({
            "available": False,
            "message": "Need at least 2 match runs to compare. Run matching multiple times.",
            "runs": runs,
        })

    run_a = runs[1]  # older
    run_b = runs[0]  # newer

    with get_conn(DB_PATH) as conn:
        rows_a = conn.execute(
            "SELECT line_id, status, confidence, reason, matched_bank_txn_id FROM match_results WHERE run_id = ?",
            (run_a["run_id"],),
        ).fetchall()
        rows_b = conn.execute(
            "SELECT line_id, status, confidence, reason, matched_bank_txn_id FROM match_results WHERE run_id = ?",
            (run_b["run_id"],),
        ).fetchall()

    map_a = {r["line_id"]: dict(r) for r in rows_a}
    map_b = {r["line_id"]: dict(r) for r in rows_b}

    # Compute deltas
    changes = []
    status_transitions = Counter()
    confidence_deltas = []

    all_lines = set(map_a.keys()) | set(map_b.keys())
    for line_id in sorted(all_lines):
        a = map_a.get(line_id)
        b = map_b.get(line_id)

        if a and b:
            if a["status"] != b["status"] or abs((a["confidence"] or 0) - (b["confidence"] or 0)) > 0.001:
                transition = f"{a['status']} → {b['status']}"
                status_transitions[transition] += 1
                conf_delta = (b["confidence"] or 0) - (a["confidence"] or 0)
                confidence_deltas.append(conf_delta)

                explanation = []
                if a["status"] != b["status"]:
                    explanation.append(f"Status: {a['status']} → {b['status']}")
                if a["reason"] != b["reason"]:
                    explanation.append(f"Reason: {a['reason']} → {b['reason']}")
                if abs(conf_delta) > 0.001:
                    explanation.append(f"Confidence: {a['confidence']:.1%} → {b['confidence']:.1%}")
                if a.get("matched_bank_txn_id") != b.get("matched_bank_txn_id"):
                    explanation.append(f"Bank txn: {a.get('matched_bank_txn_id', 'none')} → {b.get('matched_bank_txn_id', 'none')}")

                changes.append({
                    "line_id": line_id,
                    "old_status": a["status"],
                    "new_status": b["status"],
                    "old_confidence": a["confidence"],
                    "new_confidence": b["confidence"],
                    "confidence_delta": round(conf_delta, 4),
                    "old_reason": a["reason"],
                    "new_reason": b["reason"],
                    "explanation": "; ".join(explanation),
                })
        elif b and not a:
            changes.append({
                "line_id": line_id,
                "old_status": None,
                "new_status": b["status"],
                "old_confidence": None,
                "new_confidence": b["confidence"],
                "confidence_delta": None,
                "old_reason": None,
                "new_reason": b["reason"],
                "explanation": f"New line in run B: {b['status']}",
            })

    # Summary stats
    improved = len([c for c in changes if c["old_status"] in ("needs_review", "unmatched") and c["new_status"] in ("auto_matched", "resolved")])
    regressed = len([c for c in changes if c["old_status"] in ("auto_matched", "resolved") and c["new_status"] in ("needs_review", "unmatched")])
    avg_conf_delta = round(sum(confidence_deltas) / len(confidence_deltas), 4) if confidence_deltas else 0

    return JSONResponse({
        "available": True,
        "run_a": {"run_id": run_a["run_id"], "created_at": run_a["created_at"],
                  "auto_matched": run_a["auto_matched"], "needs_review": run_a["needs_review"], "unmatched": run_a["unmatched"]},
        "run_b": {"run_id": run_b["run_id"], "created_at": run_b["created_at"],
                  "auto_matched": run_b["auto_matched"], "needs_review": run_b["needs_review"], "unmatched": run_b["unmatched"]},
        "total_changes": len(changes),
        "improved": improved,
        "regressed": regressed,
        "avg_confidence_delta": avg_conf_delta,
        "status_transitions": [{"transition": k, "count": v} for k, v in status_transitions.most_common()],
        "changes": changes[:100],
    })


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
