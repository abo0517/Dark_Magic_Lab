import hmac
import logging
import os
import time
from pathlib import Path

import anthropic
from fastapi import FastAPI, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.formparsers import MultiPartParser

import claude
from mask import mask
from validate import validate


def load_env():
    env = Path(__file__).resolve().parent.parent.parent / ".env"
    if env.is_file():
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.strip().partition("=")
            if sep and not key.startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_env()
SECRET = os.environ.get("SHARED_SECRET", "")
if not SECRET or not os.environ.get("ANTHROPIC_API_KEY"):
    raise RuntimeError("SHARED_SECRET과 ANTHROPIC_API_KEY가 없어 서버를 시작하지 않습니다.")

MAX_IMAGE = 5 * 1024 * 1024  # Claude API 이미지 한도
MAX_PDF = 10 * 1024 * 1024
CORE = ("deadline", "periodText", "minAge", "maxAge", "docs", "office", "applyMethod")
# 업로드를 임시 파일로 넘기지 않고 메모리에서만 처리한다
MultiPartParser.spool_max_size = MAX_PDF + 1024 * 1024

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("server")
app = FastAPI()


class ApiError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


@app.exception_handler(ApiError)
async def api_error(_, e: ApiError):
    return JSONResponse({"code": e.code}, status_code=e.status)


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


def empty(v):
    return v in ("", None, [])


def scrub(v):
    # 응답에 주민번호, 휴대전화번호 숫자가 섞여 나오지 않게 지운다
    if isinstance(v, str):
        return mask(v)
    if isinstance(v, list):
        return [scrub(x) for x in v]
    if isinstance(v, dict):
        return {k: scrub(x) for k, x in v.items()}
    return v


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(request: Request, file: UploadFile = File(...), x_shared_secret: str = Header(default="")):
    if not hmac.compare_digest(x_shared_secret.encode(), SECRET.encode()):
        raise ApiError(401, "UNAUTHORIZED")
    t0 = time.time()
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_PDF + 1024 * 1024:
        raise ApiError(413, "TOO_LARGE")
    data = await file.read(MAX_PDF + 1)
    k = kind(data)
    if k is None:
        raise ApiError(415, "UNSUPPORTED")
    if len(data) > (MAX_PDF if k == "pdf" else MAX_IMAGE):
        raise ApiError(413, "TOO_LARGE")
    try:
        result = scrub(await claude.analyze(data, k))
    except claude.Refused:
        raise ApiError(422, "UNREADABLE")
    except anthropic.BadRequestError:  # 깨진 이미지 등 Claude가 받을 수 없는 파일
        raise ApiError(422, "UNREADABLE")
    except anthropic.APITimeoutError:
        raise ApiError(504, "TIMEOUT")
    except anthropic.APIError:
        raise ApiError(502, "UPSTREAM_ERROR")
    fixed = validate(result)
    programs = result.get("programs") or []
    if not programs or all(all(empty(p.get(key)) for key in CORE) for p in programs):
        raise ApiError(422, "UNREADABLE")
    log.info("analyze file=%s size=%d sec=%.1f fixed=%d", file.filename, len(data), time.time() - t0, fixed)
    return result
