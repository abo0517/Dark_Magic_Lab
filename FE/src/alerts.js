export const WARN_DAYS = 7

const iso = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function parse(s) {
  const m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const t = Date.UTC(y, mo - 1, d)
  const dt = new Date(t)
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? t : null
}

export const koreanDate = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10)

export function daysLeft(deadline, today) {
  const a = parse(deadline)
  const b = parse(today)
  return a === null || b === null ? null : Math.round((a - b) / 864e5)
}

export const ageMatches = (p, age) =>
  Number.isInteger(age) && (p.minAge == null || age >= p.minAge) && (p.maxAge == null || age <= p.maxAge)

export function ageText({ minAge, maxAge }) {
  if (minAge != null && maxAge != null) return `만 ${minAge}~${maxAge}세`
  if (minAge != null) return `만 ${minAge}세 이상`
  if (maxAge != null) return `만 ${maxAge}세 이하`
  return '전 연령'
}

export function buildAlerts({ tracked = [], catalog = [], age, today }) {
  const due = tracked
    .map((p) => ({ p, n: daysLeft(p.deadline, today) }))
    .filter(({ n }) => n !== null && n >= 0 && n <= WARN_DAYS)
    .sort((a, b) => a.n - b.n)
    .map(({ p, n }) => ({
      kind: n === 0 ? 'due-day' : 'due',
      name: p.name,
      text: n === 0 ? '오늘 신청 마감이에요. 마지막으로 확인해 주세요.' : n === WARN_DAYS ? '신청 마감 7일 전이에요.' : `마감 ${n}일 전이에요.`,
    }))
  const fit = catalog
    .filter((p) => ageMatches(p, age) && !tracked.some((t) => t.name === p.name))
    .map((p) => ({ kind: 'fit', name: p.name, text: `${ageText(p)} 대상일 수 있어요` }))
  return [...due, ...fit]
}

export function manAge(y, m, d, today) {
  if (parse(iso(y, m, d)) === null || parse(today) === null) return null
  const [ty, tm, td] = today.split('-').map(Number)
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
  return age < 0 ? null : age
}

export function judge(p, { age, gu }) {
  const reasons = []
  if (p.minAge != null && age < p.minAge) reasons.push(`만 ${p.minAge}세 이상만 신청할 수 있어요. (지금은 만 ${age}세)`)
  if (p.maxAge != null && age > p.maxAge) reasons.push(`만 ${p.maxAge}세 이하만 신청할 수 있어요. (지금은 만 ${age}세)`)
  if (p.gu && gu && p.gu !== gu) reasons.push(`${p.gu}에 사는 분만 신청할 수 있어요. (입력한 주소는 ${gu})`)
  return { ok: reasons.length === 0, reasons }
}

export function deadlineText(value, today, periodText = '') {
  const n = daysLeft(value, today)
  if (n === null) return periodText ? `${periodText} (원문)` : '원문에서 신청 기한을 확인하세요.'
  const [y, m, d] = value.split('-').map(Number)
  const tail = n < 0 ? '마감 지남' : n === 0 ? '오늘 마감' : `${n}일 남음`
  return `${y}년 ${m}월 ${d}일까지 · ${tail}`
}
