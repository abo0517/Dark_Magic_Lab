# model/data 이미지를 서버와 같은 경로(claude.analyze, scrub, validate)로 분석해 model/answer.json과 비교한다.
# 사용: python model/eval_server.py   (API 호출 11번, 결과는 model/eval_server_result.json)
import asyncio
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "server"))
sys.path.insert(0, str(HERE))
from policy_extract import load_env  # noqa: E402

load_env()
import claude  # noqa: E402
from mask import mask  # noqa: E402
from validate import validate  # noqa: E402

KINDS = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp"}
CORE = ("deadline", "periodText", "minAge", "maxAge", "docs", "office", "applyMethod")
OUT = HERE / "eval_server_result.json"


def scrub(v):
    if isinstance(v, str):
        return mask(v)
    if isinstance(v, list):
        return [scrub(x) for x in v]
    if isinstance(v, dict):
        return {k: scrub(x) for k, x in v.items()}
    return v


def n(s):  # 공백, 가운뎃점, 괄호, 쉼표를 지워 비교한다
    return re.sub(r"[\s·,()（）\[\]]", "", str(s))


def names(p):
    return [n(x) for x in p["docs"]] + [n(x["name"]) for x in p["extraDocs"]]


def empty(v):
    return v in ("", None, [])


def docs_ok(a, r):
    # 정답이 비면 결과도 비어야 하고, 아니면 정답 서류 이름이 결과 서류 이름에 부분 일치로 모두 들어 있어야 한다
    an, rn = names(a), names(r)
    return not rn if not an else all(any(x in y or y in x for y in rn) for x in an)


def office_ok(a, r):
    # 정답 접수처의 3글자 이상 어구(한글, 숫자, URL) 중 하나라도 결과 접수처/신청방법에 있으면 일치
    if empty(a["office"]):
        return empty(r["office"])
    toks = re.findall(r"https?://\S+|www\.\S+|[가-힣A-Za-z0-9]{3,}", a["office"])
    text = n(r["office"] + r["applyMethod"])
    return any(n(t) in text for t in toks)


async def run(name, path, sem):
    async with sem:
        try:
            res = await claude.analyze(path.read_bytes(), KINDS[path.suffix.lower()])
            res = scrub(res)
            res["_fixed"] = validate(res)
            return name, res
        except Exception as e:
            return name, {"error": f"{type(e).__name__}: {e}"[:200]}


async def main():
    answer = {e["file"]: e["programs"] for e in json.loads((HERE / "answer.json").read_text(encoding="utf-8"))}
    files = [(f.name, f) for f in sorted((HERE / "data").iterdir()) if f.suffix.lower() in KINDS and f.name in answer]
    sem = asyncio.Semaphore(4)
    results = dict(await asyncio.gather(*(run(nm, f, sem) for nm, f in files)))
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    tot = {"기한": [0, 0], "나이": [0, 0], "서류": [0, 0], "접수처": [0, 0]}
    full, fills, names_bad = 0, [], []
    print(f'{"파일":26}{"제도":>7}{"기한":>5}{"나이":>5}{"서류":>5}{"접수처":>6}{"4개":>5}')
    for nm, _ in files:
        r = results[nm]
        ap = answer[nm]
        if "error" in r:
            print(f"{nm[:24]:26} 오류: {r['error']}")
            continue
        rp = r["programs"]
        pairs = list(zip(ap, rp))
        row, allok = [0, 0, 0, 0], True
        for a, p in pairs:
            ok = [a["deadline"] == p["deadline"] and a["periodType"] == p["periodType"],
                  a["minAge"] == p["minAge"] and a["maxAge"] == p["maxAge"], docs_ok(a, p), office_ok(a, p)]
            for i, k in enumerate(tot):
                tot[k][0] += ok[i]
                tot[k][1] += 1
                row[i] += ok[i]
            allok &= all(ok)
            if n(a["name"]) not in n(p["name"]) and n(p["name"]) not in n(a["name"]):
                names_bad.append((nm[:14], a["name"], p["name"]))
            for k, v in p.items():
                if k in a and k not in ("summary", "notes", "name") and empty(a[k]) and not empty(v):
                    fills.append((nm[:12], a["name"][:10], k, str(v)[:60]))
        allok &= len(ap) == len(rp)
        full += allok and bool(pairs)
        cnt = f"{len(ap)}/{len(rp)}" + ("" if len(ap) == len(rp) else "!")
        print(f"{nm[:24]:26}{cnt:>7}" + "".join(f"{x:>5}" for x in row[:3]) + f"{row[3]:>6}{'O' if allok else 'X':>5}")
    print()
    for k, (a, b) in tot.items():
        print(f"{k}: {a}/{b}")
    print(f"11장 중 4개 모두 일치한 파일: {full}장 (기준 8장 이상)")
    flags = {nm[:16]: r.get("hasPersonalInfo") for nm, r in results.items() if "error" not in r}
    print("\n개인정보 포함 표시(hasPersonalInfo):", {k: v for k, v in flags.items() if v} or "모두 false")
    print(f"\n제도 이름이 다른 경우: {len(names_bad)}")
    for x in names_bad:
        print("  ", x)
    print(f"\n정답은 비었는데 결과가 채운 값: {len(fills)}")
    for x in fills:
        print("  ", x)


asyncio.run(main())
