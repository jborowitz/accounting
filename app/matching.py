from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


@dataclass
class MatchResult:
    line_id: str
    policy_number: str
    matched_bank_txn_id: str | None
    confidence: float
    status: str
    reason: str


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _days_between(left: str, right: str) -> int:
    dl = date.fromisoformat(left)
    dr = date.fromisoformat(right)
    return abs((dl - dr).days)


def _name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _score(statement: dict[str, str], cash: dict[str, str], policy_for_matching: str) -> tuple[float, str]:
    score = 0.0
    details: list[str] = []

    if policy_for_matching and policy_for_matching in cash.get("memo", ""):
        score += 0.55
        details.append("policy_in_memo")

    amt_stmt = float(statement["gross_commission"])
    amt_cash = float(cash["amount"])
    amt_diff = abs(amt_stmt - amt_cash)
    if amt_diff <= 0.01:
        score += 0.30
        details.append("exact_amount")
    elif amt_diff <= 25.0:
        score += 0.15
        details.append("near_amount")

    day_gap = _days_between(statement["txn_date"], cash["posted_date"])
    if day_gap <= 3:
        score += 0.10
        details.append("near_date")
    elif day_gap <= 30:
        score += 0.05
        details.append("soft_date")

    if statement["carrier_name"].lower() == cash.get("counterparty", "").lower():
        score += 0.05
        details.append("carrier_match")

    # This is a soft bonus for formatted-name differences.
    name_sim = _name_similarity(statement["insured_name"].replace(",", ""), cash.get("memo", ""))
    if name_sim >= 0.6:
        score += 0.05
        details.append("name_hint")

    return min(score, 1.0), ",".join(details)


def run_matching(data_dir: Path, policy_overrides: dict[str, str] | None = None) -> dict[str, Any]:
    policy_overrides = policy_overrides or {}
    statements = _read_csv(data_dir / "raw/statements/statement_lines.csv")
    cash = _read_csv(data_dir / "raw/bank/bank_feed.csv")

    unmatched_cash = set(range(len(cash)))
    results: list[MatchResult] = []

    for line in statements:
        policy_for_matching = policy_overrides.get(line["policy_number"], line["policy_number"])
        best_idx = None
        best_score = -1.0
        best_reason = ""
        for idx in unmatched_cash:
            c = cash[idx]
            score, reason = _score(line, c, policy_for_matching)
            if score > best_score:
                best_score = score
                best_idx = idx
                best_reason = reason

        matched_txn: str | None = None
        status = "unmatched"
        if best_idx is not None:
            if best_score >= 0.90:
                status = "auto_matched"
                matched_txn = cash[best_idx]["bank_txn_id"]
                unmatched_cash.remove(best_idx)
            elif best_score >= 0.60:
                status = "needs_review"
                matched_txn = cash[best_idx]["bank_txn_id"]

        results.append(
            MatchResult(
                line_id=line["line_id"],
                policy_number=line["policy_number"],
                matched_bank_txn_id=matched_txn,
                confidence=round(max(best_score, 0.0), 3),
                status=status,
                reason=best_reason
                + (",policy_rule_override" if line["policy_number"] in policy_overrides else ""),
            )
        )

    by_status = {"auto_matched": 0, "needs_review": 0, "unmatched": 0}
    for r in results:
        by_status[r.status] += 1

    return {
        "totals": {
            "statement_rows": len(statements),
            "bank_rows": len(cash),
            "auto_matched": by_status["auto_matched"],
            "needs_review": by_status["needs_review"],
            "unmatched": by_status["unmatched"],
        },
        "results": [r.__dict__ for r in results],
        "sample_results": [r.__dict__ for r in results[:20]],
    }
