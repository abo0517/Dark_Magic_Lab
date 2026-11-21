const URL = import.meta.env?.VITE_SUPABASE_URL
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY

export const hasBackend = Boolean(URL && KEY)

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
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`policies ${res.status}`)
  return (await res.json()).map(toProgram)
}
