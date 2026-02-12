"""Three distinct PDF templates for carrier commission statements.

- Summit National: formal corporate style (blue header, bordered table, totals)
- Wilson Mutual: warm personal style (teal header, Jason's photo, alternating rows)
- Northfield Specialty: legacy/scanned look (Courier, dashed separators, rotation)
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


TEMPLATES = {
    "Summit National": "summit_national",
    "Wilson Mutual": "wilson_mutual",
    "Northfield Specialty": "northfield_specialty",
}

JASON_IMG = Path(__file__).resolve().parent / "jason.png"


def render_statement_pdf(
    path: Path,
    statement_id: str,
    carrier: str,
    rows: list[dict],
    date_format: str = "iso",
) -> None:
    """Dispatch to the right template based on carrier name."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tpl = TEMPLATES.get(carrier, "summit_national")
    if tpl == "summit_national":
        _render_summit(path, statement_id, rows, date_format)
    elif tpl == "wilson_mutual":
        _render_wilson(path, statement_id, rows, date_format)
    elif tpl == "northfield_specialty":
        _render_northfield(path, statement_id, rows, date_format)


def _fmt_date(iso_str: str, fmt: str) -> str:
    """Convert ISO date to carrier-specific format."""
    if not iso_str or len(iso_str) < 10:
        return iso_str
    parts = iso_str[:10].split("-")
    if len(parts) != 3:
        return iso_str
    y, m, d = parts
    if fmt == "us":
        return f"{m}/{d}/{y}"
    if fmt == "euro":
        months = [
            "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]
        return f"{d}-{months[int(m)]}-{y}"
    return iso_str  # iso


# ---------------------------------------------------------------------------
# Summit National — formal corporate
# ---------------------------------------------------------------------------

def _render_summit(path: Path, statement_id: str, rows: list[dict], date_fmt: str) -> None:
    w, h = letter
    c = canvas.Canvas(str(path), pagesize=letter)
    carrier = rows[0]["carrier_name"] if rows else "Summit National"

    def draw_header(page_num: int = 1):
        nonlocal y
        # Blue header bar
        c.setFillColor(colors.HexColor("#1e3a5f"))
        c.rect(0, h - 70, w, 70, fill=True, stroke=False)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(40, h - 35, carrier)
        c.setFont("Helvetica", 9)
        c.drawString(40, h - 52, f"Commission Statement  |  {statement_id}")
        c.drawRightString(w - 40, h - 35, f"Page {page_num}")

        # Statement info line
        y = h - 95
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 8)
        total_comm = sum(float(r.get("gross_commission", 0)) for r in rows)
        c.drawString(40, y, f"Lines: {len(rows)}    Total Commission: ${total_comm:,.2f}")
        y -= 20

        # Table header
        c.setFillColor(colors.HexColor("#e8edf2"))
        c.rect(30, y - 4, w - 60, 16, fill=True, stroke=False)
        c.setFillColor(colors.HexColor("#1e3a5f"))
        c.setFont("Helvetica-Bold", 7.5)
        cols = [35, 100, 185, 310, 380, 445, 510]
        headers = ["Line ID", "Policy", "Insured", "Eff. Date", "Txn Date", "Premium", "Commission"]
        for x, hdr in zip(cols, headers):
            c.drawString(x, y, hdr)
        y -= 16
        # Border under header
        c.setStrokeColor(colors.HexColor("#1e3a5f"))
        c.setLineWidth(0.5)
        c.line(30, y + 12, w - 30, y + 12)

    page = 1
    y = 0
    draw_header(page)

    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.black)
    cols = [35, 100, 185, 310, 380, 445, 510]

    for row in rows:
        if y < 60:
            # Totals row at bottom before page break
            c.setStrokeColor(colors.HexColor("#1e3a5f"))
            c.line(30, y + 14, w - 30, y + 14)
            c.showPage()
            page += 1
            y = 0
            draw_header(page)
            c.setFont("Helvetica", 7.5)
            c.setFillColor(colors.black)

        c.drawString(cols[0], y, row.get("line_id", ""))
        c.drawString(cols[1], y, row.get("policy_number", ""))
        c.drawString(cols[2], y, row.get("insured_name", "")[:22])
        c.drawString(cols[3], y, _fmt_date(row.get("effective_date", ""), date_fmt))
        c.drawString(cols[4], y, _fmt_date(row.get("txn_date", ""), date_fmt))
        c.drawRightString(cols[5] + 50, y, f"${float(row.get('written_premium', 0)):,.2f}")
        c.drawRightString(cols[6] + 55, y, f"${float(row.get('gross_commission', 0)):,.2f}")
        y -= 13

    # Totals row
    y -= 5
    c.setStrokeColor(colors.HexColor("#1e3a5f"))
    c.setLineWidth(0.8)
    c.line(30, y + 12, w - 30, y + 12)
    c.setFont("Helvetica-Bold", 8)
    total_premium = sum(float(r.get("written_premium", 0)) for r in rows)
    total_comm = sum(float(r.get("gross_commission", 0)) for r in rows)
    c.drawString(cols[2], y, "TOTAL")
    c.drawRightString(cols[5] + 50, y, f"${total_premium:,.2f}")
    c.drawRightString(cols[6] + 55, y, f"${total_comm:,.2f}")

    # Remittance reference
    y -= 25
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.gray)
    c.drawString(35, y, f"Remittance Ref: REM-{statement_id.replace('STMT-', '')}")

    c.save()


# ---------------------------------------------------------------------------
# Wilson Mutual — warm personal style with Jason's photo
# ---------------------------------------------------------------------------

def _render_wilson(path: Path, statement_id: str, rows: list[dict], date_fmt: str) -> None:
    w, h = letter
    c = canvas.Canvas(str(path), pagesize=letter)

    def draw_header(page_num: int = 1):
        nonlocal y
        # Teal header bar
        c.setFillColor(colors.HexColor("#0d9488"))
        c.rect(0, h - 65, w, 65, fill=True, stroke=False)

        # Jason's photo in header (circular clip via save/restore + clip)
        if JASON_IMG.exists():
            c.saveState()
            # Draw circular clip path
            cx, cy, r = 52, h - 32, 18
            p = c.beginPath()
            p.circle(cx, cy, r)
            c.clipPath(p, stroke=0)
            c.drawImage(str(JASON_IMG), cx - r, cy - r, 2 * r, 2 * r,
                         preserveAspectRatio=True, anchor='c')
            c.restoreState()
            # Circle border
            c.setStrokeColor(colors.white)
            c.setLineWidth(2)
            c.circle(52, h - 32, 18, stroke=True, fill=False)

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(80, h - 28, "Wilson Mutual Insurance")
        c.setFont("Helvetica", 8)
        c.drawString(80, h - 42, f"Statement {statement_id}  |  Jason Wilson, President")
        c.drawRightString(w - 30, h - 28, f"Page {page_num}")

        # Thin accent line
        c.setStrokeColor(colors.HexColor("#5eead4"))
        c.setLineWidth(2)
        c.line(0, h - 65, w, h - 65)

        y = h - 85

        # Column headers on light teal
        c.setFillColor(colors.HexColor("#f0fdfa"))
        c.rect(20, y - 3, w - 40, 14, fill=True, stroke=False)
        c.setFillColor(colors.HexColor("#134e4a"))
        c.setFont("Helvetica-Bold", 7)
        for x, hdr in zip(col_x, col_headers):
            c.drawString(x, y, hdr)
        y -= 14

    col_x = [25, 80, 155, 280, 340, 400, 460, 525]
    col_headers = ["Line", "Policy", "Insured", "Type", "Eff Date", "Txn Date", "Premium", "Comm"]

    page = 1
    y = 0
    draw_header(page)

    for idx, row in enumerate(rows):
        if y < 50:
            c.showPage()
            page += 1
            y = 0
            draw_header(page)

        # Alternating row shading (warm teal tint)
        if idx % 2 == 0:
            c.setFillColor(colors.HexColor("#f0fdfa"))
            c.rect(20, y - 3, w - 40, 13, fill=True, stroke=False)

        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica", 7)
        c.drawString(col_x[0], y, row.get("line_id", ""))
        c.drawString(col_x[1], y, row.get("policy_number", ""))
        c.drawString(col_x[2], y, row.get("insured_name", "")[:20])
        c.drawString(col_x[3], y, row.get("txn_type", ""))
        c.drawString(col_x[4], y, _fmt_date(row.get("effective_date", ""), date_fmt))
        c.drawString(col_x[5], y, _fmt_date(row.get("txn_date", ""), date_fmt))
        c.drawRightString(col_x[6] + 45, y, f"{float(row.get('written_premium', 0)):,.2f}")
        c.drawRightString(col_x[7] + 45, y, f"{float(row.get('gross_commission', 0)):,.2f}")
        y -= 13

    # Footer
    y -= 10
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.HexColor("#6b7280"))
    c.drawString(25, y, "Wilson Mutual Insurance  |  Questions? Contact jason@wilsonmutual.com")

    c.save()


# ---------------------------------------------------------------------------
# Northfield Specialty — legacy / scanned look
# ---------------------------------------------------------------------------

def _render_northfield(path: Path, statement_id: str, rows: list[dict], date_fmt: str) -> None:
    w, h = letter
    c = canvas.Canvas(str(path), pagesize=letter)

    # Slight rotation for "scanned" feel
    c.translate(3, -2)
    c.rotate(0.3)

    def draw_header(page_num: int = 1):
        nonlocal y
        y = h - 50
        c.setFont("Courier-Bold", 14)
        c.drawString(40, y, "NORTHFIELD SPECIALTY INSURANCE")
        y -= 16
        c.setFont("Courier", 9)
        c.drawString(40, y, f"COMMISSION STATEMENT  {statement_id}")
        c.drawRightString(w - 50, y, f"PAGE {page_num}")
        y -= 6
        # Dashed separator
        c.setDash(3, 3)
        c.setStrokeColor(colors.black)
        c.line(40, y, w - 50, y)
        c.setDash()
        y -= 16

        # Column headers
        c.setFont("Courier-Bold", 7.5)
        c.drawString(40, y, "LINE-ID")
        c.drawString(105, y, "POLICY-NO")
        c.drawString(195, y, "INSURED-NAME")
        c.drawString(340, y, "EFF-DATE")
        c.drawString(415, y, "TXN-DATE")
        c.drawString(480, y, "PREMIUM")
        c.drawString(540, y, "COMM")
        y -= 4
        c.setDash(1, 2)
        c.line(40, y, w - 50, y)
        c.setDash()
        y -= 12

    page = 1
    y = 0
    draw_header(page)

    c.setFont("Courier", 7.5)
    for idx, row in enumerate(rows):
        if y < 60:
            c.showPage()
            c.translate(3, -2)
            c.rotate(0.3)
            page += 1
            y = 0
            draw_header(page)
            c.setFont("Courier", 7.5)

        c.drawString(40, y, row.get("line_id", ""))
        c.drawString(105, y, row.get("policy_number", ""))
        c.drawString(195, y, row.get("insured_name", "")[:24])
        c.drawString(340, y, _fmt_date(row.get("effective_date", ""), date_fmt))
        c.drawString(415, y, _fmt_date(row.get("txn_date", ""), date_fmt))
        c.drawRightString(535, y, f"{float(row.get('written_premium', 0)):,.2f}")
        c.drawRightString(580, y, f"{float(row.get('gross_commission', 0)):,.2f}")

        y -= 12

        # Occasional dashed separator for legacy feel
        if (idx + 1) % 10 == 0:
            c.setDash(1, 3)
            c.setStrokeColor(colors.HexColor("#999999"))
            c.line(40, y + 8, w - 50, y + 8)
            c.setDash()
            c.setStrokeColor(colors.black)

    # End dashed line
    y -= 4
    c.setDash(3, 3)
    c.line(40, y + 8, w - 50, y + 8)
    c.setDash()

    c.save()
