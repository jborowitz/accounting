#!/usr/bin/env python3
"""Generate synthetic commission reconciliation demo data.

Creates:
- data/raw/statements/statement_lines.csv
- data/raw/bank/bank_feed.csv
- data/expected/ams_expected.csv
- data/demo_cases/case_manifest.csv
- data/raw/statements/*.pdf (requires reportlab)
"""

from __future__ import annotations

import argparse
import csv
import random
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable


CARRIERS = ["Summit National", "Wilson Mutual", "Northfield Specialty"]
CARRIER_DATE_FMT = {
    "Summit National": "us",        # MM/DD/YYYY
    "Wilson Mutual": "euro",        # DD-Mon-YYYY
    "Northfield Specialty": "iso",  # YYYY-MM-DD
}
CARRIER_NAME_ABBREVS = {
    "Summit National": "Summit Nat'l",
    "Wilson Mutual": "Wilson Mut Ins",
    "Northfield Specialty": "Northfield Spec",
}
LOB_VALUES = ["P&C", "Benefits", "WC", "Cyber"]
FIRST_NAMES = [
    "John", "Maya", "Chris", "Taylor", "Avery",
    "Jordan", "Morgan", "Alex", "Riley", "Sam",
]
LAST_NAMES = [
    "Smith", "Johnson", "Davis", "Brown", "Garcia",
    "Wilson", "Moore", "Anderson", "Thomas", "Clark",
]

# Issue classification
ISSUE_LEVELS = {
    "exact_match":            ("L1", "low"),
    "timing_mismatch":        ("L2", "low"),
    "name_variation":         ("L2", "medium"),
    "policy_typo":            ("L3", "medium"),
    "partial_payment":        ("L3", "high"),
    "clawback":               ("L3", "high"),
    "cancellation":           ("L3", "high"),
    "endorsement_adj":        ("L2", "medium"),
    "reinstatement":          ("L3", "medium"),
    "override":               ("L2", "low"),
    "missing_from_bank":      ("L4", "critical"),
    "batch_payment":          ("L4", "high"),
    "rate_discrepancy":       ("L4", "high"),
    "carrier_name_mismatch":  ("L4", "medium"),
}


def random_name(rng: random.Random) -> str:
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def policy_number(idx: int) -> str:
    return f"POL-{idx:06d}"


def iso(d: date) -> str:
    return d.isoformat()


def write_csv(path: Path, rows: Iterable[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def generate(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    today = date.today()

    statement_rows: list[dict] = []
    expected_rows: list[dict] = []
    bank_rows: list[dict] = []
    case_rows: list[dict] = []

    n = args.statement_lines
    exception_every = max(1, int(round(1 / max(0.01, args.exception_rate))))
    split_cash_bucket: list[tuple[str, float]] = []
    missing_from_bank_ids: set[str] = set()
    batch_payment_groups: list[list[dict]] = []
    batch_current_group: list[dict] = []
    rate_discrepancy_ids: set[str] = set()
    carrier_name_mismatch_ids: set[str] = set()

    # Counters for Level 4 types (each gets ~5 cases)
    l4_budget = {
        "missing_from_bank": 5,
        "batch_payment": 5,
        "rate_discrepancy": 5,
        "carrier_name_mismatch": 5,
    }
    l4_assigned = {k: 0 for k in l4_budget}

    # Counters for new Section 3 txn types (each gets ~5 cases)
    s3_budget = {
        "cancellation": 5,
        "endorsement_adj": 5,
        "reinstatement": 4,
        "override": 4,
    }
    s3_assigned = {k: 0 for k in s3_budget}

    for i in range(1, n + 1):
        carrier = CARRIERS[i % len(CARRIERS)]
        st_id = f"STMT-{today:%Y%m}-{carrier.split()[0].upper()}-{(i - 1) // 27 + 1:02d}"
        line_id = f"L-{i:05d}"
        pol = policy_number(i)
        insured = random_name(rng)

        effective = today - timedelta(days=rng.randint(20, 380))
        txn_dt = effective + timedelta(days=rng.randint(0, 45))
        premium = round(rng.uniform(400.0, 25000.0), 2)
        commission = round(premium * rng.uniform(0.04, 0.22), 2)
        txn_type = rng.choice(["new", "renewal", "endorsement"])

        reason = "exact_match"
        status = "auto_matched"

        is_exception = (i % exception_every == 0)
        if is_exception:
            status = "needs_review"
            # Weighted choice: original 5 types + L4 types + Section 3 types
            available_kinds = ["policy_typo", "name_variation", "timing_mismatch",
                               "partial_payment", "clawback"]
            # Add L4 types if budget remains
            for k, budget in l4_budget.items():
                if l4_assigned[k] < budget:
                    available_kinds.append(k)
            # Add Section 3 types if budget remains
            for k, budget in s3_budget.items():
                if s3_assigned[k] < budget:
                    available_kinds.append(k)

            kind = rng.choice(available_kinds)
            reason = kind

            if kind == "policy_typo":
                pol = pol[:-1] + str((int(pol[-1]) + 3) % 10)
            elif kind == "name_variation":
                parts = insured.split(" ")
                insured = f"{parts[1]}, {parts[0]}"
            elif kind == "timing_mismatch":
                txn_dt = txn_dt + timedelta(days=rng.randint(25, 60))
            elif kind == "partial_payment":
                split_cash_bucket.append((line_id, commission))
            elif kind == "clawback":
                commission = -abs(round(commission * rng.uniform(0.5, 1.2), 2))
                txn_type = "clawback"
            elif kind == "missing_from_bank":
                missing_from_bank_ids.add(line_id)
                l4_assigned[kind] += 1
            elif kind == "batch_payment":
                batch_current_group.append({"line_id": line_id, "commission": commission})
                if len(batch_current_group) >= rng.randint(3, 5):
                    batch_payment_groups.append(batch_current_group)
                    batch_current_group = []
                l4_assigned[kind] += 1
            elif kind == "rate_discrepancy":
                rate_discrepancy_ids.add(line_id)
                l4_assigned[kind] += 1
            elif kind == "carrier_name_mismatch":
                carrier_name_mismatch_ids.add(line_id)
                l4_assigned[kind] += 1
            elif kind == "cancellation":
                # Policy cancelled mid-term: negative commission (return)
                commission = -abs(round(commission * rng.uniform(0.3, 0.8), 2))
                txn_type = "cancellation"
                s3_assigned[kind] += 1
            elif kind == "endorsement_adj":
                # Policy modified: small commission adjustment
                commission = round(commission * rng.uniform(-0.15, 0.25), 2)
                txn_type = "endorsement"
                s3_assigned[kind] += 1
            elif kind == "reinstatement":
                # Lapsed policy reinstated: new commission line
                txn_type = "reinstatement"
                s3_assigned[kind] += 1
            elif kind == "override":
                # Management override: extra commission layer
                commission = round(commission * rng.uniform(0.02, 0.08), 2)
                txn_type = "override"
                s3_assigned[kind] += 1

        statement_rows.append(
            {
                "carrier_name": carrier,
                "statement_id": st_id,
                "line_id": line_id,
                "policy_number": pol,
                "insured_name": insured,
                "effective_date": iso(effective),
                "txn_date": iso(txn_dt),
                "written_premium": f"{premium:.2f}",
                "gross_commission": f"{commission:.2f}",
                "txn_type": txn_type,
            }
        )

        expected_commission = abs(commission)
        if line_id in rate_discrepancy_ids:
            # AMS expected differs 10-30% from statement
            factor = rng.uniform(0.7, 0.9) if rng.random() < 0.5 else rng.uniform(1.1, 1.3)
            expected_commission = round(expected_commission * factor, 2)

        expected_rows.append(
            {
                "policy_number": policy_number(i),
                "producer_id": f"PRD-{rng.randint(1, 24):03d}",
                "office": f"OFF-{rng.randint(1, 8):02d}",
                "lob": rng.choice(LOB_VALUES),
                "expected_commission": f"{expected_commission:.2f}",
                "effective_date": iso(effective),
            }
        )

        level, severity = ISSUE_LEVELS.get(reason, ("L1", "low"))
        case_rows.append(
            {
                "line_id": line_id,
                "expected_status": status,
                "expected_reason": reason,
                "expected_cash_txn_id": "",
                "level": level,
                "severity": severity,
                "notes": "",
            }
        )

    # Flush any remaining batch group
    if batch_current_group:
        batch_payment_groups.append(batch_current_group)

    # Collect batch line IDs for bank row generation
    batch_line_ids: set[str] = set()
    for group in batch_payment_groups:
        for item in group:
            batch_line_ids.add(item["line_id"])

    # Generate bank rows
    cash_id = 1
    for row in statement_rows:
        amount = float(row["gross_commission"])
        line_id = row["line_id"]

        # Skip bank txn for missing_from_bank
        if line_id in missing_from_bank_ids:
            continue

        # Skip individual txn for batch_payment lines (handled below)
        if line_id in batch_line_ids:
            continue

        if any(item[0] == line_id for item in split_cash_bucket):
            amt_1 = round(amount * rng.uniform(0.35, 0.7), 2)
            amt_2 = round(amount - amt_1, 2)
            for amt in (amt_1, amt_2):
                bank_rows.append(
                    {
                        "bank_txn_id": f"BTX-{cash_id:06d}",
                        "posted_date": row["txn_date"],
                        "amount": f"{amt:.2f}",
                        "counterparty": row["carrier_name"],
                        "memo": f"partial remittance {row['policy_number']}",
                        "reference": row["statement_id"],
                    }
                )
                cash_id += 1
        else:
            delta = 0.0
            if rng.random() < 0.08:
                delta = rng.choice([-1.0, 1.0]) * round(rng.uniform(1.0, 35.0), 2)

            counterparty = row["carrier_name"]
            if line_id in carrier_name_mismatch_ids:
                counterparty = CARRIER_NAME_ABBREVS.get(counterparty, counterparty)

            bank_rows.append(
                {
                    "bank_txn_id": f"BTX-{cash_id:06d}",
                    "posted_date": row["txn_date"],
                    "amount": f"{(amount + delta):.2f}",
                    "counterparty": counterparty,
                    "memo": f"commission remittance {row['policy_number']}",
                    "reference": row["statement_id"],
                }
            )
            for c in case_rows:
                if c["line_id"] == line_id and c["expected_cash_txn_id"] == "":
                    c["expected_cash_txn_id"] = f"BTX-{cash_id:06d}"
                    break
            cash_id += 1

    # Generate batch bank transactions (one txn covers multiple statement lines)
    for group in batch_payment_groups:
        total = sum(item["commission"] for item in group)
        # Find carrier from first line
        carrier = "Unknown"
        first_stmt = None
        for item in group:
            for sr in statement_rows:
                if sr["line_id"] == item["line_id"]:
                    carrier = sr["carrier_name"]
                    first_stmt = sr
                    break
            if first_stmt:
                break

        policies = []
        for item in group:
            for sr in statement_rows:
                if sr["line_id"] == item["line_id"]:
                    policies.append(sr["policy_number"])
                    break

        bank_rows.append(
            {
                "bank_txn_id": f"BTX-{cash_id:06d}",
                "posted_date": first_stmt["txn_date"] if first_stmt else iso(date.today()),
                "amount": f"{total:.2f}",
                "counterparty": carrier,
                "memo": f"batch remittance {len(group)} policies: {', '.join(policies[:3])}",
                "reference": first_stmt["statement_id"] if first_stmt else "",
            }
        )
        batch_txn_id = f"BTX-{cash_id:06d}"
        for item in group:
            for c in case_rows:
                if c["line_id"] == item["line_id"] and c["expected_cash_txn_id"] == "":
                    c["expected_cash_txn_id"] = batch_txn_id
                    break
        cash_id += 1

    write_csv(
        args.output / "raw/statements/statement_lines.csv",
        statement_rows,
        [
            "carrier_name",
            "statement_id",
            "line_id",
            "policy_number",
            "insured_name",
            "effective_date",
            "txn_date",
            "written_premium",
            "gross_commission",
            "txn_type",
        ],
    )
    write_csv(
        args.output / "raw/bank/bank_feed.csv",
        bank_rows,
        ["bank_txn_id", "posted_date", "amount", "counterparty", "memo", "reference"],
    )
    write_csv(
        args.output / "expected/ams_expected.csv",
        expected_rows,
        ["policy_number", "producer_id", "office", "lob", "expected_commission", "effective_date"],
    )
    write_csv(
        args.output / "demo_cases/case_manifest.csv",
        case_rows,
        ["line_id", "expected_status", "expected_reason", "expected_cash_txn_id", "level", "severity", "notes"],
    )

    if args.render_pdfs:
        render_statement_pdfs(args.output / "raw/statements", statement_rows, rng)


def render_statement_pdfs(
    statements_dir: Path, statement_rows: list[dict], rng: random.Random
) -> None:
    from scripts.pdf_templates import render_statement_pdf

    # Group rows by statement_id
    grouped: dict[str, list[dict]] = {}
    for row in statement_rows:
        grouped.setdefault(row["statement_id"], []).append(row)

    # Track which lines get PDF discrepancies
    rounding_count = 0
    missing_from_pdf_count = 0

    for statement_id, rows in grouped.items():
        carrier = rows[0]["carrier_name"]
        date_fmt = CARRIER_DATE_FMT.get(carrier, "iso")

        # Create PDF-specific copies with deliberate discrepancies
        pdf_rows = []
        for row in rows:
            pdf_row = dict(row)

            # ~15 lines: round commission to nearest dollar
            if rounding_count < 15 and rng.random() < 0.06:
                orig = float(pdf_row["gross_commission"])
                pdf_row["gross_commission"] = f"{round(orig):.2f}"
                rounding_count += 1

            # Name formatting for name_variation cases: "Last, First" in PDF
            if ", " not in pdf_row["insured_name"] and rng.random() < 0.05:
                parts = pdf_row["insured_name"].split(" ", 1)
                if len(parts) == 2:
                    pdf_row["insured_name"] = f"{parts[1]}, {parts[0]}"

            pdf_rows.append(pdf_row)

        # 3 lines appear in PDF but are missing from CSV (simulates extra lines)
        if missing_from_pdf_count < 3 and len(rows) > 5 and rng.random() < 0.3:
            extra_line = {
                "carrier_name": carrier,
                "statement_id": statement_id,
                "line_id": f"L-X{rng.randint(9000, 9999)}",
                "policy_number": f"POL-X{rng.randint(100, 999)}",
                "insured_name": random_name(rng),
                "effective_date": rows[0]["effective_date"],
                "txn_date": rows[0]["txn_date"],
                "written_premium": f"{rng.uniform(500, 5000):.2f}",
                "gross_commission": f"{rng.uniform(50, 500):.2f}",
                "txn_type": "renewal",
            }
            pdf_rows.append(extra_line)
            missing_from_pdf_count += 1

        path = statements_dir / f"{statement_id}.pdf"
        render_statement_pdf(path, statement_id, carrier, pdf_rows, date_fmt)

    print(f"Generated {len(grouped)} statement PDFs in {statements_dir}")
    print(f"  Rounding discrepancies: {rounding_count}")
    print(f"  Extra PDF-only lines: {missing_from_pdf_count}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate synthetic demo data.")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--statement-lines", type=int, default=320)
    p.add_argument("--exception-rate", type=float, default=0.25, help="0-1 fraction")
    p.add_argument("--output", type=Path, default=Path("data"))
    p.add_argument("--render-pdfs", action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    generate(parse_args())
