import hmac
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.formparsers import MultiPartParser

import ocr
from mask import mask
from parse import parse

SECRET = os.environ.get("SHARED_SECRET", "")
if not SECRET:
    raise RuntimeError("SHARED_SECRET 환경변수가 없어 서버를 시작하지 않습니다.")

MAX_BYTES = 10 * 1024 * 1024
CORE = ("deadline", "periodText", "minAge", "maxAge", "docs", "office", "applyMethod")
# 업로드를 임시 파일로 넘기지 않고 메모리에서만 처리한다
MultiPartParser.spool_max_size = MAX_BYTES + 1024 * 1024

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("server")
lock = threading.Lock()


class ApiError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


@asynccontextmanager
async def lifespan(_):
    ocr.load()
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(ApiError)
async def api_error(_, e: ApiError):
    return JSONResponse({"code": e.code}, status_code=e.status)


def check_secret(value):
    if not hmac.compare_digest(value.encode(), SECRET.encode()):
        raise ApiError(401, "UNAUTHORIZED")


def kind(data: bytes):
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:4] == b"%PDF":
        return "pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


async def load_image(request: Request, file: UploadFile):
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES + 1024 * 1024:
        raise ApiError(413, "TOO_LARGE")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ApiError(413, "TOO_LARGE")
    if kind(data) is None:
        raise ApiError(415, "UNSUPPORTED")
    return data


def read(data: bytes) -> str:
    try:
        with lock:
            text = ocr.read_text(data)
    except ValueError:
        raise ApiError(422, "UNREADABLE")
    return text


def empty(v):
    return v in ("", None, [])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_only(request: Request, file: UploadFile = File(...), x_shared_secret: str = Header(default="")):
    check_secret(x_shared_secret)
    t0 = time.time()
    data = await load_image(request, file)
    text = read(data)
    log.info("ocr file=%s size=%d sec=%.1f", file.filename, len(data), time.time() - t0)
    return {"text": text}


@app.post("/analyze")
async def analyze(request: Request, file: UploadFile = File(...), x_shared_secret: str = Header(default="")):
    check_secret(x_shared_secret)
    t0 = time.time()
    data = await load_image(request, file)
    text = read(data)
    if not text.strip():
        raise ApiError(422, "UNREADABLE")
    result = parse(mask(text))
    programs = result.get("programs") or []
    if not programs or all(all(empty(p.get(k)) for k in CORE) for p in programs):
        raise ApiError(422, "UNREADABLE")
    log.info("analyze file=%s size=%d sec=%.1f", file.filename, len(data), time.time() - t0)
    return result
