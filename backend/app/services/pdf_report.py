from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas import ReportPdfRequest


FONT_NAME = "DejaVuSans"
FONT_BOLD_NAME = "DejaVuSans-Bold"
FONT_PATHS = (
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/local/share/fonts/DejaVuSans.ttf"),
)
FONT_BOLD_PATHS = (
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/local/share/fonts/DejaVuSans-Bold.ttf"),
)


def _register_fonts() -> tuple[str, str]:
    regular = next((path for path in FONT_PATHS if path.exists()), None)
    bold = next((path for path in FONT_BOLD_PATHS if path.exists()), None)
    if regular and FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_NAME, str(regular)))
    if bold and FONT_BOLD_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_BOLD_NAME, str(bold)))
    return (FONT_NAME if regular else "Helvetica", FONT_BOLD_NAME if bold else "Helvetica-Bold")


def _paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def _metadata_rows(payload: ReportPdfRequest) -> list[list[str]]:
    rows = [
        ["Hasta / İnceleme", payload.patient_label],
        ["Accession", payload.accession_number],
        ["Modalite", payload.modality],
        ["Tarih", payload.study_date],
        ["Açıklama", payload.study_description],
    ]
    return [[label, value] for label, value in rows if value]


def build_report_pdf(payload: ReportPdfRequest, generated_by: str | None = None) -> bytes:
    font_name, bold_font_name = _register_fonts()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Medarix Raporu",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName=bold_font_name,
        fontSize=16,
        leading=20,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#111827"),
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["BodyText"],
        fontName=font_name,
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#111827"),
        spaceAfter=6,
    )
    heading_style = ParagraphStyle(
        "ReportHeading",
        parent=body_style,
        fontName=bold_font_name,
        fontSize=11,
        leading=15,
        spaceBefore=6,
        spaceAfter=4,
    )
    meta_style = ParagraphStyle("ReportMeta", parent=body_style, fontSize=9, leading=12)

    story = [_paragraph("Medarix Raporu", title_style)]
    metadata = _metadata_rows(payload)
    if generated_by:
        metadata.append(["Raporu oluşturan", generated_by])
    if metadata:
        table = Table(
            [[_paragraph(label, meta_style), _paragraph(str(value), meta_style)] for label, value in metadata],
            colWidths=[36 * mm, 120 * mm],
        )
        table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), font_name),
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D1D5DB")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.extend([table, Spacer(1, 8 * mm)])

    for block in payload.content.strip().split("\n"):
        line = block.strip()
        if not line:
            story.append(Spacer(1, 3 * mm))
            continue
        style = heading_style if line.endswith(":") and len(line) <= 48 else body_style
        story.append(_paragraph(line, style))

    document.build(story)
    return buffer.getvalue()
