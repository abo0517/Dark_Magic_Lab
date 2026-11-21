import { useContext, useId, useState } from 'react'
import { Card } from '../components/UI.jsx'
import ProgressBokgil from '../components/ProgressBokgil.jsx'
import { JourneyContext } from '../journey.js'
import { deadlineText } from '../alerts.js'
import { docGuide } from '../docGuides.js'

function DocumentGuide({ name, open, onToggle, id }) {
  const g = docGuide(name)
  return (
    <div className="ws-checklist-guide">
      <button type="button" className="ws-checklist-guide-btn" aria-expanded={open} aria-controls={id} aria-label={`${name}: 어디서 받아요?`} onClick={onToggle}>
        어디서 받아요? {open ? '−' : '+'}
      </button>
      <div id={id} className="ws-checklist-guide-panel" hidden={!open}>
        {g.online.length ? (
          g.online.map((o) => (
            <p key={o.name}>
              인터넷으로 받기 · <a href={o.url} target="_blank" rel="noopener noreferrer">{o.name}</a> <span className="ws-ui-muted">새 창으로 열림 ↗</span>
            </p>
          ))
        ) : (
          <p>인터넷 발급이 안 돼요</p>
        )}
        <p>직접 가는 곳: {g.offline}</p>
        {g.note && <p className="ws-ui-note">{g.note}</p>}
      </div>
    </div>
  )
}

export function Program({ program, today }) {
  const ctx = useContext(JourneyContext)
  const uid = useId()
  const [local, setLocal] = useState({ checked: [], guide: null })
  const docs = program.docs ?? []
  const j = ctx ? ctx.journeys[program.name] : null
  const state = ctx ? { checked: j?.checked ?? [], guide: j?.guide ?? null } : local
  const checked = state.checked.filter((i) => i < docs.length)
  const patch = (p) => (ctx ? ctx.updateJourney(program, p) : setLocal((s) => ({ ...s, ...p })))
  const toggle = (i) => patch({ checked: checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i] })

  return (
    <Card title={program.name}>
      <div className="ws-checklist-deadline">
        신청 기한<br />
        <strong>{deadlineText(program.deadline, today)}</strong>
      </div>
      <fieldset className="ws-checklist-docs">
        <legend>필요한 서류</legend>
        {program.docsNote && <p className="ws-ui-note">{program.docsNote}</p>}
        {docs.length ? (
          <>
            <p role="status">준비한 서류 {checked.length}개 / 전체 {docs.length}개</p>
            <ProgressBokgil value={checked.length} max={docs.length} />
            {docs.map((name, i) => (
              <div key={name} className="ws-checklist-item">
                <label className="ws-checklist-row">
                  <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
                  <span>{name}</span>
                </label>
                <DocumentGuide name={name} id={`${uid}-guide-${i}`} open={state.guide === i} onToggle={() => patch({ guide: state.guide === i ? null : i })} />
              </div>
            ))}
          </>
        ) : (
          <p>필요한 서류를 제출처에 확인하세요.</p>
        )}
      </fieldset>
      <div className="ws-checklist-office">
        <strong>제출처</strong>
        <p>{program.office || '원문에서 제출처를 확인하세요.'}</p>
      </div>
    </Card>
  )
}
