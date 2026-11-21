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
