from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def get_conn(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    with get_conn(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS match_runs (
                run_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS match_results (
                run_id TEXT NOT NULL,
                line_id TEXT NOT NULL,
                policy_number TEXT NOT NULL,
                matched_bank_txn_id TEXT,
                confidence REAL NOT NULL,
                status TEXT NOT NULL,
                reason TEXT NOT NULL,
                PRIMARY KEY (run_id, line_id),
                FOREIGN KEY (run_id) REFERENCES match_runs(run_id)
            );

            CREATE TABLE IF NOT EXISTS exceptions (
                run_id TEXT NOT NULL,
                line_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                suggested_bank_txn_id TEXT,
                status TEXT NOT NULL,
                resolution_action TEXT,
                resolved_bank_txn_id TEXT,
                resolution_note TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (run_id, line_id),
                FOREIGN KEY (run_id, line_id) REFERENCES match_results(run_id, line_id)
            );

            CREATE TABLE IF NOT EXISTS policy_rules (
                source_policy_number TEXT PRIMARY KEY,
                target_policy_number TEXT NOT NULL,
                note TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS statement_metadata (
                statement_id TEXT PRIMARY KEY,
                carrier_name TEXT NOT NULL,
                line_count INTEGER NOT NULL,
                total_premium REAL NOT NULL,
                total_commission REAL NOT NULL,
                min_effective_date TEXT,
                max_effective_date TEXT,
                pdf_path TEXT
            );
            """
        )


def save_match_run(db_path: Path, run_id: str, results: list[dict[str, Any]]) -> dict[str, int]:
    with get_conn(db_path) as conn:
        conn.execute("INSERT INTO match_runs(run_id, created_at) VALUES (?, ?)", (run_id, utc_now()))
        for row in results:
            conn.execute(
                """
                INSERT INTO match_results(
                    run_id, line_id, policy_number, matched_bank_txn_id, confidence, status, reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    row["line_id"],
                    row["policy_number"],
                    row.get("matched_bank_txn_id"),
                    row["confidence"],
                    row["status"],
                    row["reason"],
                ),
            )
            if row["status"] == "needs_review":
                conn.execute(
                    """
                    INSERT INTO exceptions(
                        run_id, line_id, reason, suggested_bank_txn_id, status, updated_at
                    ) VALUES (?, ?, ?, ?, 'open', ?)
                    """,
                    (
                        run_id,
                        row["line_id"],
                        row["reason"],
                        row.get("matched_bank_txn_id"),
                        utc_now(),
                    ),
                )

        counts = conn.execute(
            """
            SELECT
                SUM(CASE WHEN status='auto_matched' THEN 1 ELSE 0 END) AS auto_matched,
                SUM(CASE WHEN status='needs_review' THEN 1 ELSE 0 END) AS needs_review,
                SUM(CASE WHEN status='unmatched' THEN 1 ELSE 0 END) AS unmatched
            FROM match_results
            WHERE run_id = ?
            """,
            (run_id,),
        ).fetchone()
        return {
            "auto_matched": int(counts["auto_matched"] or 0),
            "needs_review": int(counts["needs_review"] or 0),
            "unmatched": int(counts["unmatched"] or 0),
        }


def latest_run_id(db_path: Path) -> str | None:
    with get_conn(db_path) as conn:
        row = conn.execute(
            "SELECT run_id FROM match_runs ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        return None if row is None else str(row["run_id"])


def list_exceptions(db_path: Path, status: str = "open", limit: int = 100) -> list[dict[str, Any]]:
    run_id = latest_run_id(db_path)
    if run_id is None:
        return []
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                e.run_id,
                e.line_id,
                e.reason,
                e.suggested_bank_txn_id,
                e.status,
                e.resolution_action,
                e.resolved_bank_txn_id,
                e.resolution_note,
                e.updated_at,
                r.policy_number,
                r.confidence
            FROM exceptions e
            JOIN match_results r
              ON e.run_id = r.run_id AND e.line_id = r.line_id
            WHERE e.run_id = ?
              AND e.status = ?
            ORDER BY r.confidence DESC, e.line_id ASC
            LIMIT ?
            """,
            (run_id, status, limit),
        ).fetchall()
        return [dict(row) for row in rows]


def resolve_exception(
    db_path: Path,
    line_id: str,
    resolution_action: str,
    resolved_bank_txn_id: str | None = None,
    resolution_note: str | None = None,
) -> dict[str, Any] | None:
    run_id = latest_run_id(db_path)
    if run_id is None:
        return None

    with get_conn(db_path) as conn:
        exists = conn.execute(
            """
            SELECT line_id FROM exceptions
            WHERE run_id = ? AND line_id = ? AND status = 'open'
            """,
            (run_id, line_id),
        ).fetchone()
        if exists is None:
            return None

        conn.execute(
            """
            UPDATE exceptions
            SET status = 'resolved',
                resolution_action = ?,
                resolved_bank_txn_id = ?,
                resolution_note = ?,
                updated_at = ?
            WHERE run_id = ? AND line_id = ?
            """,
            (resolution_action, resolved_bank_txn_id, resolution_note, utc_now(), run_id, line_id),
        )

        conn.execute(
            """
            UPDATE match_results
            SET status = 'resolved',
                matched_bank_txn_id = COALESCE(?, matched_bank_txn_id),
                reason = reason || ',manual_resolution'
            WHERE run_id = ? AND line_id = ?
            """,
            (resolved_bank_txn_id, run_id, line_id),
        )

        row = conn.execute(
            """
            SELECT run_id, line_id, status, resolution_action, resolved_bank_txn_id, resolution_note, updated_at
            FROM exceptions
            WHERE run_id = ? AND line_id = ?
            """,
            (run_id, line_id),
        ).fetchone()
        return None if row is None else dict(row)


def upsert_policy_rule(
    db_path: Path,
    source_policy_number: str,
    target_policy_number: str,
    note: str | None = None,
) -> dict[str, Any]:
    with get_conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO policy_rules(source_policy_number, target_policy_number, note, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(source_policy_number) DO UPDATE SET
                target_policy_number=excluded.target_policy_number,
                note=excluded.note,
                updated_at=excluded.updated_at
            """,
            (source_policy_number, target_policy_number, note, utc_now()),
        )
        row = conn.execute(
            """
            SELECT source_policy_number, target_policy_number, note, updated_at
            FROM policy_rules
            WHERE source_policy_number = ?
            """,
            (source_policy_number,),
        ).fetchone()
        return {} if row is None else dict(row)


def list_policy_rules(db_path: Path, limit: int = 200) -> list[dict[str, Any]]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT source_policy_number, target_policy_number, note, updated_at
            FROM policy_rules
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def list_match_runs(db_path: Path, limit: int = 50) -> list[dict[str, Any]]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                mr.run_id,
                mr.created_at,
                SUM(CASE WHEN res.status='auto_matched' THEN 1 ELSE 0 END) AS auto_matched,
                SUM(CASE WHEN res.status='needs_review' THEN 1 ELSE 0 END) AS needs_review,
                SUM(CASE WHEN res.status='unmatched' THEN 1 ELSE 0 END) AS unmatched,
                COUNT(*) AS total
            FROM match_runs mr
            LEFT JOIN match_results res ON mr.run_id = res.run_id
            GROUP BY mr.run_id
            ORDER BY mr.created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def list_match_results(
    db_path: Path, status: str | None = None, limit: int = 500
) -> tuple[list[dict[str, Any]], str | None]:
    run_id = latest_run_id(db_path)
    if run_id is None:
        return [], None
    with get_conn(db_path) as conn:
        if status:
            rows = conn.execute(
                """
                SELECT run_id, line_id, policy_number, matched_bank_txn_id,
                       confidence, status, reason
                FROM match_results
                WHERE run_id = ? AND status = ?
                ORDER BY confidence DESC, line_id ASC
                LIMIT ?
                """,
                (run_id, status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT run_id, line_id, policy_number, matched_bank_txn_id,
                       confidence, status, reason
                FROM match_results
                WHERE run_id = ?
                ORDER BY confidence DESC, line_id ASC
                LIMIT ?
                """,
                (run_id, limit),
            ).fetchall()
        return [dict(row) for row in rows], run_id


def load_policy_overrides(db_path: Path) -> dict[str, str]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            "SELECT source_policy_number, target_policy_number FROM policy_rules"
        ).fetchall()
        return {str(r["source_policy_number"]): str(r["target_policy_number"]) for r in rows}


def upsert_statement_metadata(db_path: Path, meta: dict[str, Any]) -> None:
    with get_conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO statement_metadata(
                statement_id, carrier_name, line_count, total_premium,
                total_commission, min_effective_date, max_effective_date, pdf_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(statement_id) DO UPDATE SET
                carrier_name=excluded.carrier_name,
                line_count=excluded.line_count,
                total_premium=excluded.total_premium,
                total_commission=excluded.total_commission,
                min_effective_date=excluded.min_effective_date,
                max_effective_date=excluded.max_effective_date,
                pdf_path=excluded.pdf_path
            """,
            (
                meta["statement_id"],
                meta["carrier_name"],
                meta["line_count"],
                meta["total_premium"],
                meta["total_commission"],
                meta.get("min_effective_date"),
                meta.get("max_effective_date"),
                meta.get("pdf_path"),
            ),
        )


def list_statement_metadata(db_path: Path) -> list[dict[str, Any]]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT statement_id, carrier_name, line_count, total_premium,
                   total_commission, min_effective_date, max_effective_date, pdf_path
            FROM statement_metadata
            ORDER BY carrier_name, statement_id
            """
        ).fetchall()
        return [dict(row) for row in rows]
