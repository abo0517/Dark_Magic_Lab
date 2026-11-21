# PDF 공통 부분: 한글 폰트, 문단 스타일, 표, 푸터
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle

FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
pdfmetrics.registerFont(TTFont("KR", FONT, subfontIndex=0))

BLUE = colors.HexColor("#2448A5")
LIGHT = colors.HexColor("#EAF0FB")
GRAY = colors.HexColor("#788496")
base = dict(fontName="KR", fontSize=9, leading=13.4, alignment=TA_LEFT, wordWrap="CJK")
S = {
    "body": ParagraphStyle("body", **base),
    "small": ParagraphStyle("small", **{**base, "fontSize": 8, "leading": 11.5, "textColor": GRAY}),
    "cell": ParagraphStyle("cell", **{**base, "fontSize": 8.4, "leading": 12}),
    "head": ParagraphStyle("head", **{**base, "fontSize": 8.6, "leading": 12.4, "textColor": colors.white}),
    "h1": ParagraphStyle("h1", **{**base, "fontSize": 13.5, "leading": 18, "textColor": BLUE, "spaceBefore": 10, "spaceAfter": 5, "keepWithNext": 1}),
    "h2": ParagraphStyle("h2", **{**base, "fontSize": 10.5, "leading": 15, "textColor": colors.HexColor("#203D83"), "spaceBefore": 6, "spaceAfter": 3, "keepWithNext": 1}),
    "title": ParagraphStyle("title", **{**base, "fontSize": 20, "leading": 27, "textColor": colors.HexColor("#203D83")}),
    "sub": ParagraphStyle("sub", **{**base, "fontSize": 10.5, "leading": 15, "textColor": GRAY}),
}
P = lambda t, s="body": Paragraph(t, S[s])
B = lambda items: [P("· " + t) for t in items]


def table(rows, widths, header=True):
    data = [[P(c, "head" if header and i == 0 else "cell") if isinstance(c, str) else c for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#C8CFDA")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), BLUE))
    else:
        style.append(("BACKGROUND", (0, 0), (0, -1), LIGHT))
    t.setStyle(TableStyle(style))
    return t


def footer_for(text):
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("KR", 8)
        canvas.setFillColor(GRAY)
        canvas.drawString(18 * mm, 10 * mm, text)
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"{doc.page}")
        canvas.restoreState()
    return footer
