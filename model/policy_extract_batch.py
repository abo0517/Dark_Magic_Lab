# 정책 serv_id 목록의 상세를 공공데이터포털에서 받아 Claude로 조건을 뽑고, policies 열 이름으로 저장한다.
# 사용: DATA_GO_KR_KEY=... python model/policy_extract_batch.py ids.json out.json   (ids.json: ["WLF000...", ...], 서울 지자체용)
# 키는 환경변수로만 받는다. 결과 out.json: [{"serv_id", "min_age", "max_age", "deadline", "docs", "office", ...}]
import asyncio
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import anthropic

from policy_extract import LOCAL_FIELDS, MODEL, PROMPT, SCHEMA, load_env, policy_text

LOCAL = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed"
WORKERS = 8


def fetch_detail(sid):
    q = urllib.parse.urlencode({"serviceKey": os.environ["DATA_GO_KR_KEY"], "servId": sid})
    with urllib.request.urlopen(f"{LOCAL}?{q}", timeout=30) as r:
        root = ET.fromstring(r.read())
    if (root.findtext(".//resultCode") or "").strip() not in ("0", "00"):
        raise RuntimeError(f"resultCode {root.findtext('.//resultCode')}")
    item = next((e for e in root.iter() if e.find("servId") is not None), root)
    flat = lambda e: " ".join(t.strip() for t in e.itertext() if t.strip())
    return {"name": item.findtext("servNm") or "", "fields": {c.tag: flat(c) for c in item if flat(c)}}


def row(sid, p):
    # DB 열 이름으로 바꾼다. 빈 값은 None으로 두어 기존 값을 덮어쓰지 않게 한다. 조건부 서류는 "이름 (조건)"으로 docs에 합친다.
    docs = list(p["docs"]) + [f"{x['name']} ({x['condition']})" if x["condition"] else x["name"] for x in p["extraDocs"]]
    return {"serv_id": sid, "source": "local", "min_age": p["minAge"], "max_age": p["maxAge"],
            "deadline": p["deadline"] or None, "docs": docs or None, "office": p["office"] or None,
            "apply_method": p["applyMethod"] or None, "period_type": p["periodType"]}


async def one(client, sem, sid, out, errors):
    async with sem:
        try:
            d = await asyncio.to_thread(fetch_detail, sid)
            res = await client.messages.create(
                model=MODEL, max_tokens=8000, output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
                messages=[{"role": "user", "content": PROMPT + policy_text({"source": "local", "name": d["name"], "fields": d["fields"]})}])
            if res.stop_reason in ("refusal", "max_tokens"):
                raise RuntimeError(res.stop_reason)
            out.append(row(sid, json.loads(next(b.text for b in res.content if b.type == "text"))))
        except Exception as e:
            errors.append({"serv_id": sid, "error": f"{type(e).__name__}: {e}"[:150]})
        if (len(out) + len(errors)) % 25 == 0:
            print(f"진행 {len(out) + len(errors)}  성공 {len(out)}  실패 {len(errors)}", flush=True)


async def main():
    load_env()
    for k in ("DATA_GO_KR_KEY", "ANTHROPIC_API_KEY"):
        if not os.environ.get(k):
            sys.exit(f"{k}가 없습니다.")
    if len(sys.argv) < 3:
        sys.exit("사용법: python model/policy_extract_batch.py ids.json out.json")
    ids = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out, errors = [], []
    client, sem = anthropic.AsyncAnthropic(max_retries=2, timeout=90), asyncio.Semaphore(WORKERS)
    await asyncio.gather(*(one(client, sem, s, out, errors) for s in ids))
    out.sort(key=lambda r: r["serv_id"])
    Path(sys.argv[2]).write_text(json.dumps({"rows": out, "errors": errors}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"완료: 성공 {len(out)}, 실패 {len(errors)} -> {sys.argv[2]}")


if __name__ == "__main__":
    asyncio.run(main())
