# 공공데이터포털 복지서비스 상세 텍스트에서 안내문 분석과 같은 19개 키로 조건을 뽑는다.
# 사용: python model/policy_extract.py  (중앙부처 3건, 서울 지자체 2건 샘플)
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import anthropic

MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 8000
CENTRAL = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001"
LOCAL = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations"
OUT = Path(__file__).resolve().parent / "policy_extract_result.json"

STR = {"type": "string"}
NUM = {"type": ["integer", "null"]}
KEYS = {
    "name": STR, "agency": STR, "summary": STR, "benefit": STR, "target": STR, "minAge": NUM, "maxAge": NUM,
    "gu": STR, "eligibilityText": STR, "incomeAssetText": STR,
    "periodType": {"type": "string", "enum": ["fixed", "always", "relative", "quota", "unknown"]},
    "deadline": STR, "periodText": STR, "applyMethod": STR, "office": STR,
    "docs": {"type": "array", "items": STR},
    "extraDocs": {"type": "array", "items": {"type": "object", "properties": {"name": STR, "condition": STR},
                                             "required": ["name", "condition"], "additionalProperties": False}},
    "exclusions": STR, "contact": STR, "notes": STR,
}
SCHEMA = {"type": "object", "properties": KEYS, "required": list(KEYS), "additionalProperties": False}

RULES = """글에 없는 값은 문자열은 "", 숫자는 null, 배열은 []로 두고 절대 지어내지 마세요. 대상 여부를 판단하지 말고 글에 적힌 것만 옮기세요.
name 제도명 / agency 주관·발행 기관 / summary 쉬운 말 요약 / benefit 지원 내용·금액 / target 지급 대상(실제로 받는 사람)
minAge, maxAge 만 나이 조건(글에 명시된 숫자만, 없으면 null) / gu 서울 25개 구 이름 하나만(그 외 지역과 설명은 eligibilityText에, 없으면 "")
eligibilityText 신청 자격 원문(가구 유형, 특수 신분 포함) / incomeAssetText 소득·재산 기준 원문(판정하지 말고 원문만, 표는 문장으로 줄여서)
periodType: 원문에 "상시"가 있으면 always, 시작~종료 날짜가 명시되면 fixed, 신청 사건 기준 기한(예: 격리 종료 다음 날부터 90일)이면 relative, 정원 마감이면 quota, 기간 언급이 없으면 unknown
deadline 종료일이 날짜로 명시된 경우만 YYYY-MM-DD, 아니면 "" (계산하지 않음) / periodText 신청 기간 원문
applyMethod 신청 방법(온라인, 방문, 우편, 이메일, 대리 등) / office 접수처(주소, 기관)
docs 신청 시 필수로 내는 서류 이름만 문자열 배열("안내문 참조" 같은 안내 문구와 동의서 설명 문장은 제외)
extraDocs 특정 경우에만 내는 서류 [{"name","condition"}], docs와 같은 서류를 중복해서 넣지 마세요
exclusions 지원 제외·중복 수급 불가 / contact 문의처 / notes 유의사항"""

PROMPT = """아래는 복지 정책의 상세 설명 텍스트입니다. 이 제도 1건에서 조건을 JSON으로 뽑으세요.
""" + RULES + "\n\n[정책 텍스트]\n"

CENTRAL_FIELDS = ["wlfareInfoOutlCn", "tgtrDtlCn", "slctCritCn", "alwServCn", "applmetList", "basfrmList", "inqplCtadrList"]
LOCAL_FIELDS = ["sprtTrgtCn", "slctCritCn", "alwServCn", "aplyMtdCn", "basfrmList", "inqplCtadrList",
                "bizChrDeptNm", "enfcBgngYmd", "enfcEndYmd"]


def load_env():
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and not key.startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def call_api(url, params):
    query = urllib.parse.urlencode({**params, "serviceKey": os.environ["DATA_GO_KR_KEY"]})
    with urllib.request.urlopen(f"{url}?{query}", timeout=30) as r:
        root = ET.fromstring(r.read())
    code = (root.findtext(".//resultCode") or "").strip()
    if code != "0":
        raise RuntimeError(f"공공데이터 API 실패: resultCode={code} {root.findtext('.//resultMessage')}")
    return root


def flat(el):
    return " ".join(t.strip() for t in el.itertext() if t.strip())


def policy_text(root, fields, title):
    lines = [f"제목: {title}"]
    for f in fields:
        for el in root.iter(f):
            if flat(el):
                lines.append(f"{f}: {flat(el)}")
    return "\n".join(lines)


def samples():
    out = []
    lst = call_api(CENTRAL + "/NationalWelfarelistV001",
                   {"callTp": "L", "pageNo": 1, "numOfRows": 3, "srchKeyCode": "003"})
    for s in lst.iter("servList"):
        sid = s.findtext("servId")
        d = call_api(CENTRAL + "/NationalWelfaredetailedV001", {"callTp": "D", "servId": sid})
        out.append(("central", sid, d.findtext(".//servNm") or s.findtext("servNm"), policy_text(d, CENTRAL_FIELDS, s.findtext("servNm"))))
    lst = call_api(LOCAL + "/LcgvWelfarelist",
                   {"pageNo": 1, "numOfRows": 2, "srchKeyCode": "003", "ctpvNm": "서울특별시"})
    for s in lst.iter("servList"):
        sid = s.findtext("servId")
        d = call_api(LOCAL + "/LcgvWelfaredetailed", {"servId": sid})
        out.append(("local", sid, s.findtext("servNm"), policy_text(d, LOCAL_FIELDS, s.findtext("servNm"))))
    return out


def extract(client, text):
    t0 = time.time()
    res = client.messages.create(
        model=MODEL, max_tokens=MAX_TOKENS,
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": PROMPT + text}],
    )
    if res.stop_reason == "refusal":
        raise RuntimeError("모델이 요청을 거절했습니다.")
    if res.stop_reason == "max_tokens":
        raise RuntimeError("응답이 길어서 잘렸습니다.")
    body = next((b.text for b in res.content if b.type == "text"), "")
    return json.loads(body), {"input_tokens": res.usage.input_tokens, "output_tokens": res.usage.output_tokens,
                              "sec": round(time.time() - t0, 1)}


def main():
    load_env()
    for k in ("DATA_GO_KR_KEY", "ANTHROPIC_API_KEY"):
        if not os.environ.get(k):
            sys.exit(f"{k}가 없습니다. 저장소 루트 .env 파일을 확인하세요.")
    client = anthropic.Anthropic()
    try:
        items = samples()
    except Exception as err:
        sys.exit(f"샘플 조회 실패: {err}")
    results = []
    for source, sid, name, text in items:
        print(f"\n== [{source}] {sid} {name}", flush=True)
        try:
            data, usage = extract(client, text)
            print(json.dumps(data, ensure_ascii=False)[:300], usage, flush=True)
            results.append({"source": source, "servId": sid, "name": name, "result": data, "usage": usage})
        except Exception as err:
            print(f"실패: {err}", file=sys.stderr, flush=True)
            results.append({"source": source, "servId": sid, "name": name, "error": str(err)})
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = [r["usage"] for r in results if "usage" in r]
    if ok:
        n = len(ok)
        print(f"\n성공 {n}건, 평균 입력 {sum(u['input_tokens'] for u in ok) / n:.0f}토큰, "
              f"출력 {sum(u['output_tokens'] for u in ok) / n:.0f}토큰, {sum(u['sec'] for u in ok) / n:.1f}초")
    print(f"결과 저장: {OUT}")


if __name__ == "__main__":
    main()
