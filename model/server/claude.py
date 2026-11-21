import base64
import json
import sys
from pathlib import Path

import anthropic

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from policy_extract import RULES, SCHEMA as PROGRAM  # 제도 1건 스키마와 값 규칙은 한 곳에서 관리한다

MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 8000
SCHEMA = {"type": "object", "properties": {"easySummary": {"type": "string"}, "programs": {"type": "array", "items": PROGRAM},
                                           "hasPersonalInfo": {"type": "boolean"}},
          "required": ["easySummary", "programs", "hasPersonalInfo"], "additionalProperties": False}
PROMPT = """이 안내문에서 아래 항목을 JSON 객체 하나로만 답하세요. 한 안내문에 제도가 여러 개이거나 이용권, 대상 종류별로 나뉘면(종류마다 대상, 나이, 신청 방법이 다른 경우) programs에 제도마다 한 건씩 넣으세요.
신청 정보가 없는 홍보물이나 순서도는 대부분 빈 값이어도 됩니다. easySummary는 안내문 전체를 쉬운 말로 2~3문장으로 요약합니다.
글자가 흐려 읽기 어려운 값은 비우고 짐작해서 채우지 마세요. 주민등록번호, 휴대전화번호 같은 개인 번호는 결과에 넣지 마세요.
제도 1건의 키는 programs 항목의 스키마를 따릅니다.
hasPersonalInfo는 이미지에 특정 개인을 알아볼 수 있는 정보(이름, 주민번호, 전화번호, 집 주소, 계좌번호 등)가 보이면 true, 공개된 안내문이면 false입니다.
""" + RULES
MEDIA = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
_client = None


def client():
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(timeout=55, max_retries=0)  # 요청 제한 60초 안에 끝내려고 재시도 없이 55초
    return _client


class Refused(Exception):
    pass


async def analyze(data: bytes, kind: str) -> dict:
    b64 = base64.b64encode(data).decode()
    if kind == "pdf":
        block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        block = {"type": "image", "source": {"type": "base64", "media_type": MEDIA[kind], "data": b64}}
    res = await client().messages.create(
        model=MODEL, max_tokens=MAX_TOKENS,
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": [block, {"type": "text", "text": PROMPT}]}],
    )
    if res.stop_reason in ("refusal", "max_tokens"):
        raise Refused(res.stop_reason)
    return json.loads(next(b.text for b in res.content if b.type == "text"))
