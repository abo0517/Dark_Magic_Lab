# 샘플 안내문 이미지를 Claude Vision에 보내 핵심 항목을 뽑아 출력한다.
# 사용: python model/test_vision.py <이미지 폴더>
import base64
import json
import os
import sys
from pathlib import Path

import anthropic

MODEL = "claude-opus-5-5"
MAX_BYTES = 5 * 1024 * 1024
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
PROMPT = """이 안내문에서 아래 항목을 JSON 객체 하나로만 답하세요.
글에 없는 값은 문자열은 "", 숫자는 null, 배열은 []로 두고 절대 지어내지 마세요.
대상 여부를 판단하지 말고 글에 적힌 것만 옮기세요. 한 안내문에 제도가 여러 개면 programs에 제도마다 한 건씩 넣으세요.
신청 정보가 없는 홍보물이나 순서도는 대부분 빈 값이어도 됩니다.
형식: {"easySummary":"안내문 전체를 쉬운 말로 요약","programs":[제도1, 제도2]}
제도 1건의 키:
name 제도명 / agency 주관·발행 기관 / summary 쉬운 말 요약 / benefit 지원 내용·금액
target 지급 대상(실제로 받는 사람) / minAge, maxAge 만 나이 조건(숫자 또는 null) / gu 거주 지역
eligibilityText 신청 자격 원문(가구 유형, 특수 신분 포함)
incomeAssetText 소득·재산 기준 원문(판정하지 말고 원문만, 표는 문장으로 줄여서)
periodType fixed(고정 기간), always(상시), relative(예: 격리 종료 다음 날부터 90일), quota(정원 마감), unknown 중 하나
deadline YYYY-MM-DD 마감일(날짜로 못 정하면 "") / periodText 신청 기간 원문
applyMethod 신청 방법(온라인, 방문, 우편, 이메일, 대리 등) / office 접수처(주소, 기관)
docs 필수 서류 이름 문자열 배열 / extraDocs 조건부 서류 [{"name":"","condition":""}]
exclusions 지원 제외·중복 수급 불가 / contact 문의처 / notes 유의사항"""


def load_env():
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and not key.startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def parse(text):
    body = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return text


def analyze(client, file):
    data = file.read_bytes()
    if len(data) > MAX_BYTES:
        raise ValueError("이미지가 5MB를 넘습니다. 줄여서 다시 넣어주세요.")
    res = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": TYPES[file.suffix.lower()],
                                         "data": base64.b64encode(data).decode()}},
            {"type": "text", "text": PROMPT},
        ]}],
    )
    if res.stop_reason == "refusal":
        raise RuntimeError("모델이 요청을 거절했습니다.")
    if res.stop_reason == "max_tokens":
        raise RuntimeError("응답이 길어서 잘렸습니다.")
    return next((b.text for b in res.content if b.type == "text"), "")


def main():
    if len(sys.argv) < 2 or not Path(sys.argv[1]).is_dir():
        sys.exit("사용법: python model/test_vision.py <이미지 폴더>")
    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY가 없습니다. 저장소 루트 .env 파일을 확인하세요.")

    files = sorted(f for f in Path(sys.argv[1]).iterdir() if f.is_file() and f.suffix.lower() in TYPES)
    if not files:
        print("이미지(jpg, jpeg, png, webp)가 없습니다.", file=sys.stderr)

    client = anthropic.Anthropic()
    results = []
    for f in files:
        print(f"\n== {f.name}", flush=True)
        try:
            text = analyze(client, f)
            print(text, flush=True)
            results.append({"file": f.name, "result": parse(text)})
        except (anthropic.APIError, ValueError, RuntimeError) as err:
            print(f"실패: {err}", file=sys.stderr, flush=True)
            results.append({"file": f.name, "error": str(err)})

    out = Path(__file__).resolve().parent / "claudeVision_test.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n결과 저장: {out}")


if __name__ == "__main__":
    main()
