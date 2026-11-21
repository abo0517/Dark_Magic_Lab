import cv2
import numpy as np
from paddleocr import PaddleOCR

_engine = None
MAX_PAGES = 5  # PDF는 앞 5쪽까지만 읽는다(요청 제한 시간 60초)


def load():
    global _engine
    _engine = PaddleOCR(lang="korean", ocr_version="PP-OCRv5", use_doc_orientation_classify=False,
                        use_doc_unwarping=False, use_textline_orientation=False,
                        enable_mkldnn=False)  # oneDNN 사용 시 CPU 추론 오류(ConvertPirAttribute2RuntimeAttribute)가 나서 끈다


def pages(data: bytes):
    if data[:4] == b"%PDF":
        import pypdfium2 as pdfium
        try:
            pdf = pdfium.PdfDocument(data)
            for i in range(min(len(pdf), MAX_PAGES)):
                rgb = np.array(pdf[i].render(scale=2).to_pil().convert("RGB"))
                yield cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        except pdfium.PdfiumError:
            raise ValueError("pdf decode failed")
        return
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("decode failed")
    yield img


def read_text(data: bytes) -> str:
    lines = []
    for img in pages(data):
        for r in _engine.predict(img):
            lines += r["rec_texts"]
    return "\n".join(l for l in lines if l.strip())
