from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from app.matching import run_matching


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


class MatchingRulesTests(unittest.TestCase):
    def test_policy_override_converts_unmatched_to_auto_match(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            _write_csv(
                data_dir / "raw/statements/statement_lines.csv",
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
                [
                    {
                        "carrier_name": "Summit National",
                        "statement_id": "S1",
                        "line_id": "L-1",
                        "policy_number": "POL-TYPO-1",
                        "insured_name": "John Smith",
                        "effective_date": "2026-01-01",
                        "txn_date": "2026-01-15",
                        "written_premium": "1000.00",
                        "gross_commission": "100.00",
                        "txn_type": "new",
                    }
                ],
            )
            _write_csv(
                data_dir / "raw/bank/bank_feed.csv",
                ["bank_txn_id", "posted_date", "amount", "counterparty", "memo", "reference"],
                [
                    {
                        "bank_txn_id": "BTX-1",
                        "posted_date": "2026-01-15",
                        "amount": "100.00",
                        "counterparty": "Summit National",
                        "memo": "commission remittance POL-000001",
                        "reference": "S1",
                    }
                ],
            )

            baseline = run_matching(data_dir)
            self.assertEqual(baseline["totals"]["auto_matched"], 0)
            self.assertEqual(baseline["totals"]["needs_review"], 0)
            self.assertEqual(baseline["totals"]["unmatched"], 1)

            with_rule = run_matching(data_dir, policy_overrides={"POL-TYPO-1": "POL-000001"})
            self.assertEqual(with_rule["totals"]["auto_matched"], 1)
            self.assertEqual(with_rule["totals"]["unmatched"], 0)
            self.assertIn("policy_rule_override", with_rule["results"][0]["reason"])


if __name__ == "__main__":
    unittest.main()
