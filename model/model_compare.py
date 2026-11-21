# 같은 입력과 프롬프트로 Claude 3종의 품질(결과 저장), 속도, 비용을 잰다.
# 사용: python model/model_compare.py [--text] [--image]   (둘 다 안 주면 두 모드 모두)
# 이미 결과 파일에 있는 (model, mode, file)은 다시 호출하지 않는다.
import base64
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import anthropic

from policy_extract import KEYS, RULES, SCHEMA as PROGRAM, load_env

HERE = Path(__file__).resolve().parent
MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
PRICE = {"claude-opus-5-5": (4, 20), "claude-sonnet-5-5": (2, 10), "claude-haiku-5-5": (0.10, 0.50)}  # USD/1M 토큰 (입력, 출력)
MAX_TOKENS = 8000
MAX_BYTES = 5 * 1024 * 1024
SKIP = "KakaoTalk"  # 대화 캡처로 보이는 파일은 외부 AI로 보내지 않는다
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
OUT = HERE / "model_compare_result.json"
SCHEMA = {"type": "object", "properties": {"easySummary": {"type": "string"}, "programs": {"type": "array", "items": PROGRAM}},
          "required": ["easySummary", "programs"], "additionalProperties": False}

BASE = """이 안내문에서 아래 항목을 JSON 객체 하나로만 답하세요. 한 안내문에 제도가 여러 개면 programs에 제도마다 한 건씩 넣으세요.
신청 정보가 없는 홍보물이나 순서도는 대부분 빈 값이어도 됩니다. easySummary는 안내문 전체를 쉬운 말로 요약합니다.
제도 1건의 키는 programs 항목의 스키마를 따릅니다.
""" + RULES
PROMPTS = {"image": BASE,
           "text": BASE + "\n이 텍스트는 OCR 결과라 글자가 깨졌을 수 있습니다. 확실하지 않은 값은 비우세요.\n\n[OCR 텍스트]\n"}


def ocr_texts():
    md = (HERE / "ocr" / "ocr-results.md").read_text(encoding="utf-8")
    found = re.findall(r"^## (.+?)\s*\n+```text\n(.*?)\n```", md, re.S | re.M)
    return {n: t for n, t in found if not n.startswith(SKIP)}


def violations(d):
    # 스키마 위반: 최상위/제도 키 누락·추가, 타입, periodType enum
    bad = []
    if not isinstance(d, dict) or set(d) != {"easySummary", "programs"} or not isinstance(d.get("programs"), list):
        return ["top"]
    for p in d["programs"]:
        if not isinstance(p, dict) or set(p) != set(KEYS):
            bad.append("keys")
            continue
        if p["periodType"] not in KEYS["periodType"]["enum"]:
            bad.append("periodType")
        if not isinstance(p["docs"], list) or not isinstance(p["extraDocs"], list):
            bad.append("array")
        for k in ("minAge", "maxAge"):
            if p[k] is not None and not isinstance(p[k], int):
                bad.append(k)
    return bad


def call(client, model, mode, name, payload):
    rec = {"model": model, "mode": mode, "file": name}
    content = [{"type": "text", "text": PROMPTS["text"] + payload}] if mode == "text" else [
        {"type": "image", "source": {"type": "base64", "media_type": TYPES[Path(name).suffix.lower()], "data": payload}},
        {"type": "text", "text": PROMPTS["image"]}]
    t0 = time.time()
    try:
        res = client.messages.create(model=model, max_tokens=MAX_TOKENS,
                                     output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
                                     messages=[{"role": "user", "content": content}])
        rec.update(sec=round(time.time() - t0, 1), input_tokens=res.usage.input_tokens,
                   output_tokens=res.usage.output_tokens, stop_reason=res.stop_reason)
        text = next((b.text for b in res.content if b.type == "text"), "")
        try:
            rec["result"] = json.loads(text)
            rec["violations"] = violations(rec["result"])
        except json.JSONDecodeError:
            rec["result"], rec["violations"] = text, ["not_json"]
        if res.stop_reason in ("refusal", "max_tokens"):
            rec["error"] = res.stop_reason
    except Exception as err:
        rec.update(sec=round(time.time() - t0, 1), error=f"{type(err).__name__}: {err}")
    return rec


def build_jobs(modes, done):
    jobs = []
    for mode in modes:
        if mode == "text":
            items = list(ocr_texts().items())
        else:
            items = []
            for f in sorted((HERE / "data").iterdir()):
                if f.suffix.lower() not in TYPES or f.name.startswith(SKIP):
                    continue
                if f.stat().st_size > MAX_BYTES:
                    print(f"건너뜀(5MB 초과): {f.name}")
                    continue
                items.append((f.name, base64.b64encode(f.read_bytes()).decode()))
        for model in MODELS:
            jobs += [(model, mode, n, p) for n, p in items if (model, mode, n) not in done]
    return jobs


def summary(records):
    print(f'\n{"모델":20}{"모드":6}{"호출":>4}{"실패":>4}{"위반":>4}{"초":>7}{"입력":>8}{"출력":>7}{"호출당$":>9}{"총$":>8}')
    avg = {}
    for model in MODELS:
        for mode in ("text", "image"):
            rs = [r for r in records if r["model"] == model and r["mode"] == mode]
            if not rs:
                continue
            ok = [r for r in rs if "input_tokens" in r]
            fail = sum("error" in r for r in rs)
            viol = sum(bool(r.get("violations")) for r in rs)
            n = len(ok) or 1
            ai, ao = sum(r["input_tokens"] for r in ok) / n, sum(r["output_tokens"] for r in ok) / n
            cost = lambda i, o: (i * PRICE[model][0] + o * PRICE[model][1]) / 1e6
            total = sum(cost(r["input_tokens"], r["output_tokens"]) for r in ok)
            print(f'{model:20}{mode:6}{len(rs):>4}{fail:>4}{viol:>4}{sum(r["sec"] for r in rs) / len(rs):>7.1f}{ai:>8.0f}{ao:>7.0f}{cost(ai, ao):>9.4f}{total:>8.3f}')
            avg[(model, mode)] = (ai, ao, cost(ai, ao))
    print("\n정책 858건 비용 추정(텍스트 모드 평균 토큰 x 858 = 호출당 평균 비용 x 858)")
    for model in MODELS:
        if (model, "text") in avg:
            ai, ao, c = avg[(model, "text")]
            print(f"  {model}: ({ai:.0f} x {PRICE[model][0]} + {ao:.0f} x {PRICE[model][1]}) / 1e6 x 858 = ${c * 858:.2f}")


def main():
    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY가 없습니다. 저장소 루트 .env 파일을 확인하세요.")
    modes = [m for m in ("text", "image") if f"--{m}" in sys.argv] or ["text", "image"]
    records = json.loads(OUT.read_text(encoding="utf-8")) if OUT.is_file() else []
    done = {(r["model"], r["mode"], r["file"]) for r in records if "input_tokens" in r}
    jobs = build_jobs(modes, done)
    print(f"호출 {len(jobs)}번 시작", flush=True)
    client = anthropic.Anthropic(max_retries=2)
    # 모델별로 한 스레드씩 순서대로 호출한다(모델 안에서는 순차라 호출 시간이 섞이지 않는다)
    def run(model):
        out = []
        for m, mode, n, p in (j for j in jobs if j[0] == model):
            rec = call(client, m, mode, n, p)
            out.append(rec)
            print(f'{m} {mode} {n[:20]} {rec["sec"]}s {rec.get("error", "ok")}', flush=True)
        return out
    with ThreadPoolExecutor(len(MODELS)) as ex:
        for part in ex.map(run, MODELS):
            records = [r for r in records if (r["model"], r["mode"], r["file"]) not in {(x["model"], x["mode"], x["file"]) for x in part}] + part
    OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    summary(records)
    print(f"결과 저장: {OUT}")


if __name__ == "__main__":
    main()
