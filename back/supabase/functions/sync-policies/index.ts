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


// ===== Claude 조건 추출 (model/policy_extract.py와 같은 프롬프트, 스키마) =====
const CLAUDE_MODEL = 'claude-sonnet-5-5'
const EXTRACT_SCHEMA = {
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "agency": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    },
    "benefit": {
      "type": "string"
    },
    "target": {
      "type": "string"
    },
    "minAge": {
      "type": [
        "integer",
        "null"
      ]
    },
    "maxAge": {
      "type": [
        "integer",
        "null"
      ]
    },
    "gu": {
      "type": "string"
    },
    "eligibilityText": {
      "type": "string"
    },
    "incomeAssetText": {
      "type": "string"
    },
    "periodType": {
      "type": "string",
      "enum": [
        "fixed",
        "always",
        "relative",
        "quota",
        "unknown"
      ]
    },
    "deadline": {
      "type": "string"
    },
    "periodText": {
      "type": "string"
    },
    "applyMethod": {
      "type": "string"
    },
    "office": {
      "type": "string"
    },
    "docs": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "extraDocs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "condition": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "condition"
        ],
        "additionalProperties": false
      }
    },
    "exclusions": {
      "type": "string"
    },
    "contact": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "agency",
    "summary",
    "benefit",
    "target",
    "minAge",
    "maxAge",
    "gu",
    "eligibilityText",
    "incomeAssetText",
    "periodType",
    "deadline",
    "periodText",
    "applyMethod",
    "office",
    "docs",
    "extraDocs",
    "exclusions",
    "contact",
    "notes"
  ],
  "additionalProperties": false
}
const EXTRACT_PROMPT = "아래는 복지 정책의 상세 설명 텍스트입니다. 이 제도 1건에서 조건을 JSON으로 뽑으세요.\n글에 없는 값은 문자열은 \"\", 숫자는 null, 배열은 []로 두고 절대 지어내지 마세요. 대상 여부를 판단하지 말고 글에 적힌 것만 옮기세요.\nname 제도명 / agency 주관·발행 기관 / summary 쉬운 말 요약 / benefit 지원 내용·금액 / target 지급 대상(실제로 받는 사람)\nminAge, maxAge 만 나이 조건(글에 명시된 숫자만, 없으면 null) / gu 서울 25개 구 이름 하나만(그 외 지역과 설명은 eligibilityText에, 없으면 \"\")\neligibilityText 신청 자격 원문(가구 유형, 특수 신분 포함) / incomeAssetText 소득·재산 기준 원문(판정하지 말고 원문만, 표는 문장으로 줄여서)\nperiodType: 원문에 \"상시\"가 있으면 always, 시작~종료 날짜가 명시되면 fixed, 신청 사건 기준 기한(예: 격리 종료 다음 날부터 90일)이면 relative, 정원 마감이면 quota, 기간 언급이 없으면 unknown\n종료일 없이 \"N년간\"이나 \"생일이 속한 달의 1개월 전부터\"처럼 기준일에 상대적인 기간도 relative\ndeadline 종료일이 날짜로 명시된 경우만 YYYY-MM-DD, 아니면 \"\" (계산하지 않음) / periodText 신청 기간 원문\napplyMethod 신청 방법(온라인, 방문, 우편, 이메일, 대리 등) / office 접수처(주소, 기관)\ndocs 신청 시 필수로 내는 서류 이름만 문자열 배열(\"안내문 참조\" 같은 안내 문구와 동의서 설명 문장은 제외)\n서류는 한 개당 한 항목으로 나눕니다(\"신청서, 동의서\"는 \"신청서\"와 \"동의서\" 두 항목)\nextraDocs 특정 경우에만 내는 서류 [{\"name\",\"condition\"}], docs와 같은 서류를 중복해서 넣지 마세요\nexclusions 지원 제외·중복 수급 불가 / contact 문의처 / notes 유의사항\n\n[정책 텍스트]\n"
const FIELDS: Record<string, string[]> = {
  central: ['wlfareInfoOutlCn', 'tgtrDtlCn', 'slctCritCn', 'alwServCn', 'applmetList', 'basfrmList', 'inqplCtadrList', 'inqplHmpgReldList'],
  local: ['servDgst', 'aplyMtdNm', 'sprtTrgtCn', 'slctCritCn', 'alwServCn', 'aplyMtdCn', 'basfrmList', 'inqplCtadrList', 'bizChrDeptNm', 'enfcBgngYmd', 'enfcEndYmd'],
}
// 값이 문자열이면 그대로, 목록이면 안의 글자를 이어 붙인다
const textOf = (v: any): string =>
  v == null ? '' : typeof v === 'object' ? Object.values(v).map(textOf).filter(Boolean).join(' ') : String(v).trim()

async function extract(source: 'central' | 'local', title: string, d: any) {
  const lines = [`제목: ${title}`]
  for (const f of FIELDS[source]) {
    const t = decodeXml(textOf(find(d, f)))
    if (t) lines.push(`${f}: ${t}`)
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 4000,
      output_config: { format: { type: 'json_schema', schema: EXTRACT_SCHEMA } },
      messages: [{ role: 'user', content: EXTRACT_PROMPT + lines.join('
') }],
    }),
    signal: AbortSignal.timeout(40000),
  })
  if (!r.ok) throw new Error(`claude ${r.status}`)
  const j = await r.json()
  if (j.stop_reason === 'refusal' || j.stop_reason === 'max_tokens') throw new Error(j.stop_reason)
  return JSON.parse(j.content.find((b: any) => b.type === 'text').text)
}

// 추출 결과를 policies 열로 바꾼다. 빈 값은 넣지 않아 기존 값을 덮어쓰지 않는다. 조건부 서류는 "이름 (조건)"으로 docs에 합친다.
function toPatch(p: any) {
  const docs = [...p.docs, ...p.extraDocs.map((x: any) => (x.condition ? `${x.name} (${x.condition})` : x.name))]
  const patch: Record<string, unknown> = {}
  if (p.minAge != null) patch.min_age = p.minAge
  if (p.maxAge != null) patch.max_age = p.maxAge
  if (p.deadline) patch.deadline = p.deadline
  if (docs.length) patch.docs = docs
  if (p.office) patch.office = p.office
  return patch
}

// 동시에 n개씩 처리한다(Edge Function 제한 시간 안에 끝내려고)
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]) }))
}

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
  const details = Math.min(Number(p.get('details') ?? 0), Deno.env.get('ANTHROPIC_API_KEY') ? 40 : 100)
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
      const useClaude = !!Deno.env.get('ANTHROPIC_API_KEY') && p.get('extract') !== '0'
      await pool(data ?? [], useClaude ? 8 : 1, async (row: any) => {
        lastId = row.serv_id > lastId ? row.serv_id : lastId
        try {
          const d = await call(cfg.detail, { ...cfg.detailQ, servId: row.serv_id }); calls++
          const patch: Record<string, unknown> = {}
          const target = s(find(d, cfg.target)), apply = cfg.apply ? s(find(d, cfg.apply)) : null
          if (target) patch.eligibility = target
          if (apply) patch.office = apply
          if (useClaude) {
            try {
              Object.assign(patch, toPatch(await extract(source, s(find(d, 'servNm')) ?? '', d)))
            } catch { failed++ } // 추출이 실패해도 원문 저장은 계속한다
          }
          if (Object.keys(patch).length) await db.from('policies').update(patch).eq('source', source).eq('serv_id', row.serv_id)
          fetched++
        } catch { failed++ }
      })
    }
    return json({ source, page, totalCount: find(x, 'totalCount') ?? null, upserted: list.length, detailsFetched: fetched, detailsFailed: failed, lastId, apiCalls: calls })
  } catch (e) {
    return json({ error: (e as Error).message, apiCalls: calls }, 502)
  }
})
