import { useState } from 'react'
import { Screen, Button, Card } from '../components/UI.jsx'
import { GU, DONG } from '../seoul.js'
import { koreanDate, manAge } from '../alerts.js'

export function DraftForm({ onDone, submitText = '확인하고 혜택 보기', initial = {} }) {
  const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(initial.birthDate ?? '')
  const [f, setF] = useState({
    nickname: initial.nickname ?? '',
    gender: initial.gender ?? '',
    y: birth?.[1] ?? '', m: birth?.[2] ? String(+birth[2]) : '', d: birth?.[3] ? String(+birth[3]) : '',
    gu: initial.gu ?? '',
    dong: initial.dong ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const today = koreanDate()
  const thisYear = +today.slice(0, 4)
  const years = Array.from({ length: 111 }, (_, i) => thisYear - i)
  const lastDay = (y, m) => (y && m ? new Date(+y, +m, 0).getDate() : 31)

  const set = (patch) =>
    setF((s) => {
      const n = { ...s, ...patch }
      if (n.d && +n.d > lastDay(n.y, n.m)) n.d = ''
      return n
    })

  const age = manAge(+f.y, +f.m, +f.d, today)
  const dongs = DONG[f.gu]

  async function submit(e) {
    e.preventDefault()
    if (age === null || saving) return
    setSaving(true)
    setError('')
    try {
      await onDone({
        nickname: f.nickname.trim(),
        birthDate: `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`,
        age,
        gender: f.gender,
        gu: f.gu,
        dong: f.dong,
      })
    } catch {
      setError('정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="wm-draft-form" onSubmit={submit}>
      <Card title="나를 알려주세요">
        <label className="ws-ui-field">
          닉네임
          <input className="ws-ui-input" type="text" autoComplete="nickname" value={f.nickname} onChange={(e) => set({ nickname: e.target.value })} />
        </label>
        <fieldset className="ws-ui-fieldset">
          <legend>생년월일</legend>
          <div className="wm-grid wm-grid-date">
            <select className="ws-ui-input" aria-label="년" value={f.y} onChange={(e) => set({ y: e.target.value })}>
              <option value="">년</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="ws-ui-input" aria-label="월" value={f.m} onChange={(e) => set({ m: e.target.value })}>
              <option value="">월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="ws-ui-input" aria-label="일" value={f.d} onChange={(e) => set({ d: e.target.value })}>
              <option value="">일</option>
              {Array.from({ length: lastDay(f.y, f.m) }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </fieldset>
        <fieldset className="ws-ui-fieldset">
          <legend>성별 (선택)</legend>
          <div className="wm-gender">
            {['남', '여'].map((g) => (
              <label key={g} className="wm-gender-option">
                <input type="radio" name="gender" checked={f.gender === g} onChange={() => set({ gender: g })} /> {g}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="ws-ui-fieldset">
          <legend>주소 (서울특별시)</legend>
          <div className="wm-grid wm-grid-2">
            <select className="ws-ui-input" aria-label="구 선택" value={f.gu} onChange={(e) => set({ gu: e.target.value, dong: '' })}>
              <option value="">구 선택</option>
              {GU.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="ws-ui-input" aria-label="동 선택" value={f.dong} disabled={!dongs} onChange={(e) => set({ dong: e.target.value })}>
              <option value="">{f.gu && !dongs ? '동 목록 준비 중' : '동 선택'}</option>
              {(dongs ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </fieldset>
        <p className="ws-ui-muted">닉네임, 생년월일, 성별, 선택한 구·동을 내 계정에 저장해요.</p>
      </Card>
      {error && <p className="ws-ui-muted" role="alert">{error}</p>}
      <Button type="submit" className="wm-draft-submit" disabled={age === null || saving}>
        {saving ? '저장 중이에요...' : age === null ? '생년월일을 선택하세요' : submitText}
      </Button>
    </form>
  )
}

export default function DraftScreen({ onBack, onDone, onHome, error }) {
  return (
    <Screen variant="draft" title={<>내게 맞는 혜택,<br />몇 가지만 알려주세요.</>} onBack={onBack} onHome={onHome}>
      <p className="ws-draft-lead">몇 가지 정보로 나에게 필요한 복지에 한 걸음 더 가까이.</p>
      {error && <p className="ws-ui-muted" role="alert">{error}</p>}
      <DraftForm onDone={onDone} />
    </Screen>
  )
}
