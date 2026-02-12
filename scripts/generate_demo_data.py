#!/usr/bin/env python3
"""Generate synthetic commission reconciliation demo data.

Creates:
- data/raw/statements/statement_lines.csv
- data/raw/bank/bank_feed.csv
- data/expected/ams_expected.csv
- data/demo_cases/case_manifest.csv
- data/raw/statements/*.pdf (optional, requires reportlab)
"""

from __future__ import annotations

import argparse
import csv
import random
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable


CARRIERS = ["Summit National", "Harbor Mutual", "Northfield Specialty"]
LOB_VALUES = ["P&C", "Benefits", "WC", "Cyber"]
TXN_TYPES = ["new", "renewal", "endorsement", "cancellation", "reinstatement", "clawback"]
FIRST_NAMES = [
    "John",
    "Maya",
    "Chris",
    "Taylor",
    "Avery",
    "Jordan",
    "Morgan",
    "Alex",
    "Riley",
    "Sam",
]
LAST_NAMES = [
    "Smith",
    "Johnson",
    "Davis",
    "Brown",
    "Garcia",
    "Wilson",
    "Moore",
    "Anderson",
    "Thomas",
    "Clark",
]


@dataclass
class StatementLine:
    carrier_name: str
    statement_id: str
    line_id: str
    policy_number: str
    insured_name: str
    effective_date: str
    txn_date: str
    written_premium: str
    gross_commission: str
    txn_type: str


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

    for i in range(1, n + 1):
        carrier = CARRIERS[i % len(CARRIERS)]
        st_id = f"STMT-{today:%Y%m}-{carrier.split()[0].upper()}-{(i - 1) // 100 + 1:02d}"
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
            kind = rng.choice(["policy_typo", "name_variation", "timing_mismatch", "partial_payment", "clawback"])
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

        expected_rows.append(
            {
                "policy_number": policy_number(i),
                "producer_id": f"PRD-{rng.randint(1, 24):03d}",
                "office": f"OFF-{rng.randint(1, 8):02d}",
                "lob": rng.choice(LOB_VALUES),
                "expected_commission": f"{abs(commission):.2f}",
                "effective_date": iso(effective),
            }
        )

        case_rows.append(
            {
                "line_id": line_id,
                "expected_status": status,
                "expected_reason": reason,
                "expected_cash_txn_id": "",
                "notes": "",
            }
        )

    cash_id = 1
    for row in statement_rows:
        amount = float(row["gross_commission"])
        line_id = row["line_id"]
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
            bank_rows.append(
                {
                    "bank_txn_id": f"BTX-{cash_id:06d}",
                    "posted_date": row["txn_date"],
                    "amount": f"{(amount + delta):.2f}",
                    "counterparty": row["carrier_name"],
                    "memo": f"commission remittance {row['policy_number']}",
                    "reference": row["statement_id"],
                }
            )
            for c in case_rows:
                if c["line_id"] == line_id and c["expected_cash_txn_id"] == "":
                    c["expected_cash_txn_id"] = f"BTX-{cash_id:06d}"
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
        ["line_id", "expected_status", "expected_reason", "expected_cash_txn_id", "notes"],
    )

    if args.render_pdfs:
        render_statement_pdfs(args.output / "raw/statements", statement_rows)


def render_statement_pdfs(statements_dir: Path, statement_rows: list[dict]) -> None:
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except Exception:
        print("reportlab not installed; skipping PDF rendering")
        return

    grouped: dict[str, list[dict]] = {}
    for row in statement_rows:
        grouped.setdefault(row["statement_id"], []).append(row)

    for statement_id, rows in grouped.items():
        path = statements_dir / f"{statement_id}.pdf"
        c = canvas.Canvas(str(path), pagesize=letter)
        width, height = letter
        y = height - 40
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, f"Carrier Statement: {statement_id}")
        y -= 20
        c.setFont("Helvetica", 8)
        c.drawString(40, y, "line_id")
        c.drawString(95, y, "policy")
        c.drawString(180, y, "insured")
        c.drawString(320, y, "txn_date")
        c.drawString(390, y, "premium")
        c.drawString(455, y, "commission")
        y -= 14

        for row in rows[:90]:
            if y < 50:
                c.showPage()
                y = height - 40
            c.drawString(40, y, row["line_id"])
            c.drawString(95, y, row["policy_number"])
            c.drawString(180, y, row["insured_name"][:24])
            c.drawString(320, y, row["txn_date"])
            c.drawRightString(440, y, row["written_premium"])
            c.drawRightString(530, y, row["gross_commission"])
            y -= 12

        c.save()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate synthetic demo data.")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--statement-lines", type=int, default=300)
    p.add_argument("--exception-rate", type=float, default=0.2, help="0-1 fraction")
    p.add_argument("--output", type=Path, default=Path("data"))
    p.add_argument("--render-pdfs", action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    generate(parse_args())
