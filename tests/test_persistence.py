from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.persistence import (
    init_db,
    list_exceptions,
    list_policy_rules,
    load_policy_overrides,
    resolve_exception,
    save_match_run,
    upsert_policy_rule,
)


class PersistenceTests(unittest.TestCase):
    def test_save_and_resolve_exceptions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "demo.db"
            init_db(db)
            results = [
                {
                    "line_id": "L-1",
                    "policy_number": "POL-000001",
                    "matched_bank_txn_id": "BTX-1",
                    "confidence": 0.95,
                    "status": "auto_matched",
                    "reason": "exact_amount",
                },
                {
                    "line_id": "L-2",
                    "policy_number": "POL-000002",
                    "matched_bank_txn_id": "BTX-2",
                    "confidence": 0.72,
                    "status": "needs_review",
                    "reason": "near_amount",
                },
            ]
            counts = save_match_run(db, "run-1", results)
            self.assertEqual(counts["auto_matched"], 1)
            self.assertEqual(counts["needs_review"], 1)

            open_rows = list_exceptions(db, status="open")
            self.assertEqual(len(open_rows), 1)
            self.assertEqual(open_rows[0]["line_id"], "L-2")

            resolved = resolve_exception(
                db,
                line_id="L-2",
                resolution_action="manual_link",
                resolved_bank_txn_id="BTX-9",
                resolution_note="approved in test",
            )
            self.assertIsNotNone(resolved)
            resolved_rows = list_exceptions(db, status="resolved")
            self.assertEqual(len(resolved_rows), 1)
            self.assertEqual(resolved_rows[0]["line_id"], "L-2")

    def test_policy_rule_upsert_and_load(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "demo.db"
            init_db(db)
            upsert_policy_rule(db, "POL-TYPO-1", "POL-000001", "test mapping")
            upsert_policy_rule(db, "POL-TYPO-1", "POL-000009", "updated")
            rows = list_policy_rules(db)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["target_policy_number"], "POL-000009")
            overrides = load_policy_overrides(db)
            self.assertEqual(overrides["POL-TYPO-1"], "POL-000009")


if __name__ == "__main__":
    unittest.main()
