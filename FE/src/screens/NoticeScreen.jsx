import { Screen, Button, Card, ApplyButton } from '../components/UI.jsx'
import Nearby from '../components/Nearby.jsx'
import { Program } from './ChecklistScreen.jsx'
import { deadlineText, judge, koreanDate } from '../alerts.js'

export default function NoticeScreen({ data, profile, applied, onToggleApplied, onBack, onHome }) {
  const today = koreanDate()
  const items = data.programs.map((p) => ({ p, ...judge(p, profile) }))
  const oks = items.filter((i) => i.ok)
  const nos = items.filter((i) => !i.ok)
  const office = oks[0]?.p.office

  return (
    <Screen
      title="안내문을 쉽게 풀어봤어요."
      onBack={onBack}
      onHome={onHome}
      footer={
        <>
          <p className="ws-ui-muted">출처: {data.source}. 촬영한 사진은 저장하지 않아요.</p>
          <Button onClick={onBack}>내 혜택으로 돌아가기</Button>
        </>
      }
    >
      <p className="ws-ui-note">
        {data.kind && <><strong>{data.kind}</strong><br /></>}
        {data.easySummary}<br />만 {profile.age}세 기준으로 확인했어요.
      </p>

      {data.hasPersonalInfo && (
        <p className="ws-ui-note" role="status">
          <strong>개인정보가 보이는 안내문이에요.</strong><br />
          사진은 분석을 위해 외부 AI로 전송됐고 우리 서버에는 저장하지 않아요. 다음에는 이름·주민등록번호·전화번호·주소를 가리고 찍어 주세요.
        </p>
      )}

      {data.todos?.length > 0 && (
        <Card title="언제까지 무엇을 해야 하나요?">
          <ol className="wm-todos">
            {data.todos.map((t) => (
              <li key={t.text}>
                <span>{t.text}</span>
                {t.detail && <small className="ws-ui-muted">{t.detail}</small>}
                <strong>{deadlineText(t.deadline, today, t.periodText)}</strong>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {data.facts?.length > 0 && (
        <Card title="원문에서 읽은 핵심">
          {data.facts.map((f) => {
            const unsure = f.uncertain || !f.value
            return (
              <div key={f.label} className="wm-fact">
                <span className="wm-fact-label">
                  {f.label}
                  {unsure && <span className="wm-badge-check">확인 필요</span>}
                </span>
                <strong className="wm-fact-value">{unsure ? '원문에서 확인하세요.' : f.value}</strong>
                {f.evidence && f.evidence !== f.value ? (
                  <blockquote className="wm-fact-quote"><span>원문</span> {f.evidence}</blockquote>
                ) : (
                  unsure && <p className="ws-ui-muted">사진에서 잘 읽히지 않았어요. 안내문 원문에서 직접 확인해 주세요.</p>
                )}
              </div>
            )
          })}
        </Card>
      )}

      <section className="wm-notice-section" aria-label="준비할 서류">
        <h2 className="ws-ui-heading">내가 준비할 서류</h2>
        {oks.length ? (
          oks.map(({ p }) => (
            <Card key={p.name} title={p.name}>
              <p>{p.summary}</p>
              <p className="ws-ui-note">
                <strong>대상일 수 있어요</strong><br />
                나이·지역 조건은 맞아요. 소득·재산 조건은 제출처에서 확인하세요.
              </p>
              <Program program={p} today={today} />
              <ApplyButton applied={applied.some((a) => a.name === p.name)} onToggle={() => onToggleApplied(p)} />
            </Card>
          ))
        ) : (
          <p className="ws-ui-note">이 안내문에서 지금 조건으로 대상일 수 있는 제도를 찾지 못했어요.</p>
        )}
      </section>

      {oks.length > 0 && (
        <section className="wm-submit" aria-label="제출하기">
          <h2 className="ws-ui-heading">마지막으로 제출해요</h2>
          <p className="wm-submit-place">{office || '원문에서 제출처를 확인하세요.'}</p>
          <p>서류를 모두 준비해도 신청이 끝난 것은 아니에요. 제출처에 내야 신청이 완료돼요. 제출한 뒤에 ‘신청했어요 표시하기’를 눌러 기록해 두세요.</p>
        </section>
      )}

      {oks.length > 0 && <Nearby gu={profile.gu} dong={profile.dong} program={oks[0].p} />}

      {nos.length > 0 && (
        <details className="wm-disclosure">
          <summary>해당되지 않는 제도 {nos.length}개 보기</summary>
          {nos.map(({ p, reasons }) => (
            <Card key={p.name} title={p.name}>
              <p>{p.summary}</p>
              <div className="ws-ui-note">
                <strong>지금은 해당되지 않아요</strong>
                {reasons.map((r) => <p key={r}>· {r}</p>)}
              </div>
            </Card>
          ))}
        </details>
      )}
    </Screen>
  )
}
