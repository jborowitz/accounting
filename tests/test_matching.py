from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.matching import run_matching


class MatchingTests(unittest.TestCase):
    def test_run_matching_with_seed_data(self) -> None:
        result = run_matching(Path("data"))
        totals = result["totals"]
        self.assertGreater(totals["statement_rows"], 0)
        self.assertGreater(totals["bank_rows"], 0)
        self.assertEqual(
            totals["statement_rows"],
            totals["auto_matched"] + totals["needs_review"] + totals["unmatched"],
        )

    def test_run_matching_handles_missing_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = run_matching(Path(tmp))
            self.assertEqual(result["totals"]["statement_rows"], 0)
            self.assertEqual(result["totals"]["bank_rows"], 0)
            self.assertEqual(result["totals"]["auto_matched"], 0)
            self.assertEqual(result["totals"]["needs_review"], 0)
            self.assertEqual(result["totals"]["unmatched"], 0)


if __name__ == "__main__":
    unittest.main()
