import { createClient } from 'npm:@supabase/supabase-js@2'
import { XMLParser } from 'npm:fast-xml-parser@4'

const parser = new XMLParser({ processEntities: false, parseTagValue: false })
const API = {
  central: {
    list: 'https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001',
    detail: 'https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfaredetailedV001',
    listQ: { callTp: 'L', srchKeyCode: '003' }, detailQ: { callTp: 'D' }, target: 'tgtrDtlCn', apply: '',
  },
  local: {
    list: 'https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist',
    detail: 'https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed',
    listQ: { srchKeyCode: '003' }, detailQ: {}, target: 'sprtTrgtCn', apply: 'aplyMtdCn',
  },
}

const find = (o: any, k: string): any => {
  if (o == null || typeof o !== 'object') return undefined
  if (k in o) return o[k]
  for (const v of Object.values(o)) { const r = find(v, k); if (r !== undefined) return r }
}
const arr = (v: any) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v])
// processEntities:false라 표준 5개 엔티티를 직접 풀어준다. &amp;는 이중 변환을 피하려고 마지막에 처리한다.
const decodeXml = (t: string) =>
  t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const s = (v: any) => (typeof v === 'string' && v.trim() ? decodeXml(v.trim()) : null)
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })

async function call(url: string, q: Record<string, string>) {
  const u = new URL(url)
  u.searchParams.set('serviceKey', Deno.env.get('DATA_GO_KR_KEY')!)
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v)
  const r = await fetch(u)
  if (!r.ok) throw new Error(`upstream ${r.status}`)
  const x = parser.parse(await r.text())
  const code = find(x, 'resultCode')
  if (code != null && Number(code) !== 0) throw new Error(`resultCode ${code}`)
  return x
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_SECRET')) return json({ error: 'forbidden' }, 403)
  const p = new URL(req.url).searchParams
  const source = p.get('source') as 'central' | 'local'
  const cfg = API[source]
  if (!cfg) return json({ error: 'source must be central or local' }, 400)
  const page = p.get('page') ?? '1'
  const rows = p.get('rows') ?? '100'
  const ctpv = p.get('ctpv')
  const details = Math.min(Number(p.get('details') ?? 0), 100)
  const after = p.get('after') ?? ''

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let calls = 0
  try {
    const x = await call(cfg.list, { ...cfg.listQ, pageNo: page, numOfRows: rows, ...(source === 'local' && ctpv ? { ctpvNm: ctpv } : {}) }); calls++
    const items = arr(find(x, 'servList'))
    const list = items.map((i: any) => ({
      serv_id: s(i.servId), source, name: s(i.servNm), summary: s(i.servDgst),
      category: s(i.intrsThemaArray ?? i.intrsThemaNmArray),
      ctpv: s(i.ctpvNm), sgg: s(i.sggNm), detail_link: s(i.servDtlLink),
      updated_at: new Date().toISOString(),
    })).filter((r: any) => r.serv_id && r.name)
    if (list.length) {
      const { error } = await db.from('policies').upsert(list, { onConflict: 'source,serv_id' })
      if (error) throw new Error('db upsert failed')
    }

    let fetched = 0, failed = 0, lastId = after
    if (details > 0) {
      // shortcut: 지자체는 신청 방법 원문을 office에 임시 저장, 모델 추출이 정확한 제출처로 덮어쓸 때까지. after로 이어 받아 빈 상세를 반복 조회하지 않는다
      const need = cfg.apply ? 'office' : 'eligibility'
      const { data } = await db.from('policies').select('serv_id')
        .eq('source', source).is(need, null).gt('serv_id', after).order('serv_id').limit(details)
      for (const row of data ?? []) {
        lastId = row.serv_id
        try {
          const d = await call(cfg.detail, { ...cfg.detailQ, servId: row.serv_id }); calls++
          const patch: Record<string, string> = {}
          const target = s(find(d, cfg.target)), apply = cfg.apply ? s(find(d, cfg.apply)) : null
          if (target) patch.eligibility = target
          if (apply) patch.office = apply
          if (Object.keys(patch).length) await db.from('policies').update(patch).eq('source', source).eq('serv_id', row.serv_id)
          fetched++
        } catch { failed++ }
      }
    }
    return json({ source, page, totalCount: find(x, 'totalCount') ?? null, upserted: list.length, detailsFetched: fetched, detailsFailed: failed, lastId, apiCalls: calls })
  } catch (e) {
    return json({ error: (e as Error).message, apiCalls: calls }, 502)
  }
})
