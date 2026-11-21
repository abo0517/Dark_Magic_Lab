import re
from datetime import date

SEOUL = set("종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 "
            "구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구".split())
PERIOD = {"fixed", "always", "relative", "quota", "unknown"}


def norm(s):
    return re.sub(r"\s+", "", s)


def valid_date(s):
    try:
        date.fromisoformat(s)
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", s))
    except ValueError:
        return False


def validate(result: dict) -> int:
    """값 규칙에 어긋난 값을 비운다. 바꾼 값의 개수를 돌려준다(내용은 기록하지 않는다)."""
    fixed = 0
    for p in result.get("programs", []):
        if p.get("deadline") and not valid_date(p["deadline"]):
            p["deadline"], fixed = "", fixed + 1
        for k in ("minAge", "maxAge"):
            v = p.get(k)
            if v is not None and (isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= 120):
                p[k], fixed = None, fixed + 1
        if p.get("minAge") is not None and p.get("maxAge") is not None and p["minAge"] > p["maxAge"]:
            p["minAge"] = p["maxAge"] = None
            fixed += 1
        if p.get("periodType") not in PERIOD:
            p["periodType"], fixed = "unknown", fixed + 1
        if p.get("gu") and p["gu"] not in SEOUL:
            p["gu"], fixed = "", fixed + 1
        docs, seen = [], set()
        for d in p.get("docs", []):
            if d.strip() and norm(d) not in seen:
                seen.add(norm(d))
                docs.append(d)
        if docs != p.get("docs"):
            fixed += 1
        p["docs"] = docs
        extra = [x for x in p.get("extraDocs", []) if norm(x.get("name", "")) not in seen]
        if len(extra) != len(p.get("extraDocs", [])):
            fixed += 1
        p["extraDocs"] = extra
    return fixed
