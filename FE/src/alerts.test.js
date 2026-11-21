import test from 'node:test'
import assert from 'node:assert/strict'
import { daysLeft, ageMatches, buildAlerts, manAge, judge, deadlineText } from './alerts.js'
import { docGuide } from './docGuides.js'

test('daysLeft', () => {
  assert.equal(daysLeft('2026-11-20', '2026-11-17'), 3)
  assert.equal(daysLeft('', '2026-11-17'), null)
  assert.equal(daysLeft('2026-02-30', '2026-11-17'), null)
})

test('ageMatches', () => {
  assert.equal(ageMatches({ minAge: 19, maxAge: 34 }, 34), true)
  assert.equal(ageMatches({ minAge: 19, maxAge: 34 }, 35), false)
  assert.equal(ageMatches({ minAge: 65 }, 80), true)
  assert.equal(ageMatches({ minAge: 65 }, 64), false)
  assert.equal(ageMatches({ minAge: 19 }, null), false)
})

test('buildAlerts', () => {
  const A = { name: 'A', deadline: '2026-11-18', minAge: 19 }
  const B = { name: 'B', deadline: '2026-12-31' }
  const C = { name: 'C', deadline: '2026-11-10' }
  const Y = { name: 'Y', minAge: 19, maxAge: 34 }
  const S = { name: 'S', minAge: 65 }
  const r = buildAlerts({ today: '2026-11-17', age: 30, tracked: [A, B, C], catalog: [A, Y, S] })
  assert.deepEqual(r.map((x) => x.kind + x.name), ['dueA', 'fitY'])
})

test('manAge', () => {
  assert.equal(manAge(1990, 11, 17, '2026-11-17'), 36)
  assert.equal(manAge(1990, 11, 18, '2026-11-17'), 35)
  assert.equal(manAge(1990, 2, 30, '2026-11-17'), null)
  assert.equal(manAge(2030, 1, 1, '2026-11-17'), null)
  assert.equal(manAge(1955, 3, 2, '2026-11-18'), 71)
  assert.equal(manAge('', '', '', '2026-11-18'), null)
})

test('judge', () => {
  assert.deepEqual(judge({ minAge: 65 }, { age: 70, gu: '' }), { ok: true, reasons: [] })
  assert.equal(judge({ minAge: 65 }, { age: 40, gu: '' }).reasons.length, 1)
  assert.equal(judge({ maxAge: 34, gu: '마포구' }, { age: 40, gu: '종로구' }).reasons.length, 2)
  assert.equal(judge({ gu: '마포구' }, { age: 40, gu: '' }).ok, true)
})

test('deadlineText', () => {
  assert.equal(deadlineText('', '2026-11-21'), '원문에서 신청 기한을 확인하세요.')
  assert.equal(deadlineText('2026-11-21', '2026-11-21'), '2026년 11월 21일까지 · 오늘 마감')
})

test('docGuide', () => {
  assert.match(docGuide('소득·재산 신고서').note, /금융정보/)
  assert.equal(docGuide('신분증').online.length, 0)
  assert.equal(docGuide('월세 이체 확인증').offline, '거래 은행 앱 또는 지점')
  assert.equal(docGuide('').note, '필요한 서류인지 제출처에 먼저 확인하세요.')
})

test('toProgram', async () => {
  const { toProgram } = await import('./api.js')
  const p = toProgram({ name: 'X', minAge: 65, maxAge: null, gu: '마포구', deadline: null, docs: null, office: null, sourceUrl: 'u' })
  assert.deepEqual([p.minAge, p.maxAge, p.gu, p.deadline, p.docs, p.office, p.sourceUrl], [65, undefined, '마포구', '', [], '', 'u'])
  assert.equal(toProgram({ name: 'Y', gu: '서울특별시교육청' }).gu, undefined)
  assert.equal(toProgram({ name: 'Z', gu: null }).gu, undefined)
})

test('scan helpers', async () => {
  const { fitSize, withTimeout } = await import('./scan.js')
  assert.deepEqual(fitSize(4000, 3000), [1568, 1176])
  assert.deepEqual(fitSize(3000, 4000), [1176, 1568])
  assert.deepEqual(fitSize(800, 600), [800, 600])
  await assert.rejects(withTimeout(new Promise(() => {}), 20), { code: 'TIMEOUT' })
  assert.equal(await withTimeout(Promise.resolve(1), 20), 1)
})

test('deadlineText period fallback', () => {
  assert.equal(deadlineText('', '2026-11-21', '격리 종료 다음 날부터 90일'), '격리 종료 다음 날부터 90일 (원문)')
  assert.equal(deadlineText('2026-11-21', '2026-11-21', '무시됨'), '2026년 11월 21일까지 · 오늘 마감')
})

test('fromModel with real model output', async () => {
  const { fromModel } = await import('./api.js')
  const fs = await import('node:fs')
  const rows = JSON.parse(fs.readFileSync(new URL('../../model/ClaudeAPI/claudeVision_test.json', import.meta.url), 'utf8'))
  assert.ok(rows.length >= 1)
  for (const { result } of rows) {
    const d = fromModel(result)
    assert.ok(Array.isArray(d.programs) && Array.isArray(d.todos) && Array.isArray(d.facts))
    for (const p of d.programs) {
      assert.ok(p.name)
      assert.ok(p.gu === undefined || typeof p.gu === 'string')
      assert.ok(p.deadline === '' || /^\d{4}-\d{2}-\d{2}$/.test(p.deadline))
      assert.ok(Array.isArray(p.docs))
    }
    for (const p of d.programs) assert.ok(p.gu === undefined || ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'].includes(p.gu))
  }
  const ready = { facts: [], todos: [], programs: [] }
  assert.equal(fromModel(ready), ready)
  const r = fromModel({ easySummary: 'x', programs: [{ name: 'A', gu: '인천시', deadline: '2026-02-30', docs: ['신분증'], extraDocs: [{ name: '통장', condition: '필요 시' }] }] })
  assert.equal(r.programs[0].gu, undefined)
  assert.equal(r.programs[0].region, '인천시')
  assert.equal(r.programs[0].deadline, '2026-02-30')
  assert.deepEqual(r.programs[0].docs, ['신분증', '통장 (필요 시)'])
  assert.equal(r.facts.find((f) => f.label === '지원 금액').uncertain, true)
})

test('fromModel keeps hasPersonalInfo', async () => {
  const { fromModel } = await import('./api.js')
  assert.equal(fromModel({ easySummary: 'x', programs: [], hasPersonalInfo: true }).hasPersonalInfo, true)
  assert.equal(fromModel({ easySummary: 'x', programs: [] }).hasPersonalInfo, false)
})
