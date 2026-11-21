"""Extract explicitly labelled fields from OCR text without network access."""

import re
import unicodedata
from datetime import date


TEXT_FIELDS = (
    "name", "agency", "summary", "benefit", "target", "gu", "eligibilityText",
    "incomeAssetText", "periodText", "applyMethod", "office", "exclusions",
    "contact", "notes",
)
SEOUL_DISTRICTS = frozenset(
    "종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 "
    "노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 "
    "관악구 서초구 강남구 송파구 강동구".split()
)
LABELS = {
    "사업명": "name", "제도명": "name", "주관기관": "agency", "발행기관": "agency",
    "지원내용": "benefit", "지원금액": "benefit", "지원대상": "target", "지급대상": "target",
    "신청자격": "eligibilityText", "대상조건": "eligibilityText", "소득기준": "incomeAssetText",
    "신청기간": "periodText", "접수기간": "periodText", "신청기한": "periodText",
    "신청마감": "periodText", "마감일": "periodText", "신청방법": "applyMethod",
    "신청장소": "office", "접수처": "office", "제출처": "office",
    "문의": "contact", "문의처": "contact", "유의사항": "notes", "사용기한": "notes",
    "지급시기": "notes", "지원제외대상": "exclusions", "중복지원불가": "exclusions",
    "필수서류": "docs", "신청시제출서류": "docs", "신청인별필수제출서류": "docs",
    "제출서류": "docs", "해당하는경우제출서류": "extraDocs", "추가서류": "extraDocs",
}
LABEL_PATTERN = re.compile(
    r"^\s*(?:[•※√]\s*)?(?:\d+차\s*)?(?P<label>"
    + "|".join(r"\s*".join(label) for label in sorted(LABELS, key=len, reverse=True))
    + r")(?:\s*[:：|]\s*|\s+|(?=$))(?P<value>.*)$"
)
FULL_DATE = r"(?<!\d)(20\d{2})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})(?!\d)"
OFFICE_LINE = re.compile(
    r"복지로.{0,12}신청|(?:읍|면|동|행정복지).{0,8}(?:주민센터|복지센터).{0,5}방문"
)
DOCUMENT = re.compile(r"(?:신청서|동의서|등본|초본|증명서|확인서|위임장|신분증|사본|증빙서류|^공문$)")


class UnreadableError(ValueError):
    """The server should translate this to HTTP 422."""

    code = "UNREADABLE"


def _compact(value):
    return re.sub(r"\s+", "", value)


def _period(text):
    compact = _compact(text)
    if not compact:
        return "unknown", ""
    if re.search(r"예산소진|정원|인원.{0,8}배수", compact):
        return "quota", ""
    if "상시" in compact:
        return "always", ""
    if re.search(r"(?:\d+[일개월년](?:이내|간)|다음날|익일|생일)", compact):
        return "relative", ""
    limits = re.split(r"[~〜–]", compact)
    start = re.search(FULL_DATE, limits[0])
    end = re.search(FULL_DATE, limits[-1])
    if len(limits) > 1 and not end and start:
        short = re.match(r"(\d{1,2})[.월/-](\d{1,2})(?!\d)", limits[-1])
        parts = (start[1], *short.groups()) if short else None
    else:
        parts = end.groups() if end and (len(limits) > 1 or re.search(r"까지|마감|종료", compact)) else None
    if parts:
        try:
            return "fixed", date(*map(int, parts)).isoformat()
        except ValueError:
            pass
    return "unknown", ""


def _age(text):
    compact = _compact(text)
    span = re.search(r"(?<!\d)(\d{1,3})(?:세)?[~〜–-](\d{1,3})세", compact)
    minimum = re.search(r"(?<!\d)(\d{1,3})세이상", compact)
    maximum = re.search(r"(?<!\d)(\d{1,3})세이하", compact)
    low = int(span[1]) if span else int(minimum[1]) if minimum else None
    high = int(span[2]) if span else int(maximum[1]) if maximum else None
    low = low if low is not None and 0 <= low <= 120 else None
    high = high if high is not None and 0 <= high <= 120 else None
    return (None, None) if low is not None and high is not None and low > high else (low, high)


def _add_document(program, line, conditional):
    item = re.sub(r"^\s*(?:\d+[.)]?\s*|[-•]\s*)", "", line)
    condition = re.match(r"^\(([^)]+)\)\s*(.+)", item)
    if condition:
        item = condition[2]
    item = re.split(r"※|\s+및\s+해당\s*서류", item, maxsplit=1)[0].strip()
    if not DOCUMENT.search(item) or len(item) > 90:
        return False
    if conditional or condition:
        if condition and item not in program["docs"]:
            entry = {"name": item, "condition": condition[1]}
            if entry not in program["extraDocs"]:
                program["extraDocs"].append(entry)
    elif item not in program["docs"]:
        program["docs"].append(item)
    return True


def _program(lines):
    program = dict.fromkeys(TEXT_FIELDS, "")
    program.update(minAge=None, maxAge=None, periodType="unknown", deadline="", docs=[], extraDocs=[])
    pending = ""
    office_lines = []
    age_context = ""
    for index, line in enumerate(lines):
        if (
            _compact(line) == "신청" and index + 2 < len(lines)
            and _compact(lines[index + 2]) == "기간"
            and re.match(FULL_DATE, lines[index + 1])
        ):
            program["periodText"] = lines[index + 1]
        match = LABEL_PATTERN.match(line)
        inline_value = ""
        if match:
            pending = LABELS[_compact(match["label"])]
            inline_value = match["value"].strip()
            if not inline_value:
                continue
        value = inline_value if match else line
        if pending in {"docs", "extraDocs"}:
            if not _add_document(program, value, pending == "extraDocs") and not match:
                pending = ""
            continue
        if pending:
            if re.search(r"[가-힣]{2,}|\d{2,}", value):
                program[pending] = "; ".join(filter(None, (program[pending], value)))
                pending = ""
            continue
        if OFFICE_LINE.search(_compact(line)) or re.match(
            r"^\((?:온라인|오프라인|전국)\)", line.lstrip(":：")
        ):
            office_lines.append(line)
        if re.search(r"대상조건|신청자격|지원대상", _compact(line)):
            age_context = line

    if not program["name"]:
        program["name"] = next((line for line in lines[:5] if re.search(r"[가-힣]{2,}", line)), "")
    eligibility = " ".join((program["target"], program["eligibilityText"], age_context))
    has_type_table = any("이용권유형" in _compact(line) for line in lines)
    if age_context and not has_type_table and _age(eligibility) == (None, None):
        index = lines.index(age_context)
        eligibility += " " + " ".join(lines[index + 1:index + 8])
    program["minAge"], program["maxAge"] = _age(eligibility)
    for district in re.findall(r"[가-힣]+구(?=\s*거주)", eligibility):
        if district in SEOUL_DISTRICTS:
            program["gu"] = district
            break
    program["periodType"], program["deadline"] = _period(program["periodText"])
    if office_lines:
        program["office"] = "; ".join(dict.fromkeys(filter(None, (program["office"], *office_lines))))
    if not program["office"] and re.search(r"홈페이지|주민센터|복지로|행정복지센터|이메일.*@", program["applyMethod"]):
        program["office"] = program["applyMethod"]
    return program


def parse(text):
    """Return the analyze payload for locally processed OCR text."""
    if not isinstance(text, str):
        raise UnreadableError("UNREADABLE")
    lines = [line.strip() for line in unicodedata.normalize("NFKC", text).splitlines() if line.strip()]
    starts = [index for index, line in enumerate(lines) if re.match(r"^(?:사업명|제도명)\s*[:：]", line)]
    if len(starts) > 1:
        groups = [lines[start:end] for start, end in zip(starts, starts[1:] + [len(lines)])]
    else:
        groups = [lines]
    programs = [_program(group) for group in groups]
    readable = [
        p for p in programs if p["name"] and (
            p["periodText"] or p["minAge"] is not None or p["maxAge"] is not None
            or p["docs"] or p["office"]
        )
    ]
    if not readable:
        raise UnreadableError("UNREADABLE")
    return {"easySummary": " ".join(p["name"] + " 안내입니다." for p in readable[:3]), "programs": readable}

