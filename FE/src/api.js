import { GU } from './seoul.js'
import { deadlineText, koreanDate } from './alerts.js'
import { supabase } from './supabaseClient.js'

const URL = import.meta.env?.VITE_SUPABASE_URL
const KEY = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY
const ANALYZE_URL = import.meta.env?.VITE_ANALYZE_URL

export const hasBackend = Boolean(URL && KEY)
export const hasAnalyze = Boolean(ANALYZE_URL)

const authHeaders = async () => {
  const headers = KEY ? { apikey: KEY } : {}
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export const toProgram = (r) => ({
  name: r.name,
  summary: r.summary ?? '',
  eligibility: r.eligibility ?? '',
  minAge: r.min_age ?? undefined,
  maxAge: r.max_age ?? undefined,
  gu: r.source === 'local' ? r.sgg || undefined : undefined,
  deadline: r.deadline ?? '',
  office: r.office ?? '',
  docs: r.docs ?? [],
  source: '공공데이터포털 · 복지서비스',
  sourceUrl: r.detail_link ?? '',
})

export async function fetchPolicies({ age }) {
  const filter = `(or(min_age.is.null,min_age.lte.${age}),or(max_age.is.null,max_age.gte.${age}),or(source.eq.central,ctpv.eq.서울특별시))`
  const res = await fetch(`${URL}/rest/v1/policies?select=*&limit=500&and=${encodeURIComponent(filter)}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`policies ${res.status}`)
  return (await res.json()).map(toProgram)
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

// 모델 응답({ easySummary, programs[19개 키] })을 화면이 쓰는 형식으로 바꾼다. 이미 화면 형식이면 그대로 둔다.
export function fromModel(raw) {
  if (raw.facts || raw.todos) return raw
  const programs = (raw.programs ?? []).map((p) => {
    const extra = (p.extraDocs ?? []).filter((d) => d?.name)
    const seoul = GU.includes(p.gu)
    return {
      name: p.name || '제도 이름을 읽지 못했어요',
      summary: p.summary ?? '',
      eligibility: [p.eligibilityText, p.incomeAssetText].filter(Boolean).join(' / '),
      incomeAssetText: p.incomeAssetText ?? '',
      region: p.gu && !seoul ? p.gu : '',
      minAge: p.minAge ?? undefined,
      maxAge: p.maxAge ?? undefined,
      gu: seoul ? p.gu : undefined,
      deadline: DATE.test(p.deadline) ? p.deadline : '',
      periodText: p.periodText ?? '',
      benefit: p.benefit ?? '',
      applyMethod: p.applyMethod ?? '',
      office: p.office ?? '',
      docs: [...(p.docs ?? []), ...extra.map((d) => (d.condition ? `${d.name} (${d.condition})` : d.name))],
      docsNote: extra.length ? '괄호 안에 조건이 적힌 서류는 해당하는 경우에만 필요해요.' : '',
    }
  })
  const first = programs[0]
  const fact = (label, value, evidence = '') => ({ label, value: value || '', evidence, uncertain: !value })
  const facts = first
    ? [
        fact('신청 기한', first.deadline ? deadlineText(first.deadline, koreanDate()) : first.periodText, first.periodText),
        fact('지원 금액', first.benefit),
        fact('제출처', first.office),
        ...(first.region ? [fact('거주 지역', first.region)] : []),
        ...(first.incomeAssetText ? [fact('소득·재산 기준', '제출처에서 확인하세요.', first.incomeAssetText)] : []),
      ]
    : []
  const todos = first
    ? [
        first.docs.length && { text: '필요한 서류를 준비해요', deadline: '' },
        first.applyMethod && { text: '신청해요', detail: first.applyMethod, deadline: first.deadline, periodText: first.periodText },
      ].filter(Boolean)
    : []
  return {
    kind: first ? `${first.name} 안내문` : '',
    easySummary: raw.easySummary ?? '',
    source: '업로드한 안내문 (AI가 읽은 내용)',
    todos,
    facts,
    programs,
  }
}

export async function analyzeRemote({ file, signal }) {
  const body = new FormData()
  body.append('file', file)
  const sameProject = URL && new URL(ANALYZE_URL, window.location.origin).origin === new URL(URL).origin
  const res = await fetch(ANALYZE_URL, { method: 'POST', body, signal, headers: sameProject ? await authHeaders() : {} })
  if (!res.ok) {
    const code = await res.json().then((j) => j.code, () => undefined)
    throw Object.assign(new Error(code || `analyze ${res.status}`), { code })
  }
  return fromModel(await res.json())
}
