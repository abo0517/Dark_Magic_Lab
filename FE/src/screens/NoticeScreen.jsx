import { Screen, Button, Card, ApplyButton } from '../components/UI.jsx'
import Nearby from '../components/Nearby.jsx'
import { Program } from './ChecklistScreen.jsx'
import { judge, koreanDate } from '../alerts.js'

export default function NoticeScreen({ data, profile, applied, onToggleApplied, onBack, onHome }) {
  const today = koreanDate()
  const items = data.programs.map((p) => ({ p, ...judge(p, profile) })).sort((a, b) => b.ok - a.ok)
  const firstOk = items.find((i) => i.ok)

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
      <p className="ws-ui-note">{data.easySummary}<br />만 {profile.age}세 기준으로 확인했어요.</p>
      {items.map(({ p, ok, reasons }) => (
        <Card key={p.name} title={p.name}>
          <p>{p.summary}</p>
          {ok ? (
            <>
              <p className="ws-ui-note">
                <strong>대상일 수 있어요</strong><br />
                나이·지역 조건은 맞아요. 소득·재산 조건은 제출처에서 확인하세요.
              </p>
              <Program program={p} today={today} />
              <ApplyButton applied={applied.some((a) => a.name === p.name)} onToggle={() => onToggleApplied(p)} />
            </>
          ) : (
            <div className="ws-ui-note">
              <strong>지금은 해당되지 않아요</strong>
              {reasons.map((r) => <p key={r}>· {r}</p>)}
            </div>
          )}
        </Card>
      ))}
      {firstOk && <Nearby gu={profile.gu} dong={profile.dong} program={firstOk.p} />}
    </Screen>
  )
}
