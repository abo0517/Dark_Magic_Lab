import { Screen, Button, Card } from '../components/UI.jsx'
import { DraftForm } from './DraftScreen.jsx'

const TABS = ['즐겨찾기', '진행 중', '신청 완료', '내 정보']
const SIZES = [['normal', '보통'], ['large', '크게'], ['xlarge', '아주 크게']]

export default function SettingsScreen({
  tab, setTab, profile, font, setFont, alertOn, setAlertOn,
  journeys, favorites, applied, onResume, onFavorite, onRemoveApplied, onSaveProfile, onLogout, onBack, onHome,
}) {
  const isApplied = (name) => applied.some((a) => a.name === name)
  const saved = favorites.filter((p) => !journeys[p.name] && !isApplied(p.name))
  const progress = Object.values(journeys).filter((j) => !isApplied(j.program.name))

  return (
    <Screen
      variant="mypage"
      title="마이페이지"
      onBack={onBack}
      onHome={onHome}
    >
      <p>{profile.nickname || '회원'}님의 복지 준비 현황이에요.<br />항목을 누르면 준비하던 과정으로 돌아가요.</p>
      <p className="ws-ui-muted">진행 내역은 이 브라우저에 저장되며 로그아웃하면 삭제돼요. 체크 완료는 실제 신청 완료와 달라요.</p>
      <nav className="wm-categories wm-tabs" aria-label="내 복지 상태">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === '즐겨찾기' && (
        <Card title={`즐겨찾기 · ${saved.length}개`}>
          <p className="ws-ui-muted">서류 준비를 시작한 혜택은 ‘진행 중’에서, 신청한 혜택은 ‘신청 완료’에서 볼 수 있어요.</p>
          {saved.length ? saved.map((p) => (
            <div key={p.name} className="wm-saved">
              <button type="button" className="wm-saved-body" onClick={() => { setTab('진행 중'); onResume(p.name) }}>
                <strong>{p.name}</strong>
                <span>{p.summary}</span>
                <span className="wm-saved-go">서류 준비 시작하기 →</span>
              </button>
              <Button kind="quiet" onClick={() => onFavorite(p)}>즐겨찾기 해제</Button>
            </div>
          )) : <p>아직 준비 전인 즐겨찾기가 없어요. 혜택 이름 옆의 별을 눌러 저장해 주세요.</p>}
        </Card>
      )}

      {tab === '진행 중' && (
        <Card title={`진행 중 · ${progress.length}개`}>
          {progress.length ? progress.map(({ program, checked }) => (
            <button key={program.name} type="button" className="wm-saved-body" onClick={() => onResume(program.name)}>
              <strong>{program.name}</strong>
              <span>서류 {checked.length}/{(program.docs ?? []).length}개 준비</span>
              <span className="wm-saved-go">이어서 준비하기 →</span>
            </button>
          )) : <p>혜택 목록에서 서류 확인하기를 누르면 여기에 모여요.</p>}
        </Card>
      )}

      {tab === '신청 완료' && (
        <Card title={`신청 완료 · ${applied.length}개`}>
          {applied.length ? applied.map((p) => (
            <div key={p.name} className="wm-saved">
              <button type="button" className="wm-saved-body" onClick={() => onResume(p.name)}>
                <strong>{p.name}</strong>
                <span>신청 완료</span>
                <span className="wm-saved-go">제도 내용 다시 보기 →</span>
              </button>
              <Button kind="quiet" onClick={() => onRemoveApplied(p.name)}>신청 완료 표시 취소</Button>
            </div>
          )) : <p>직접 ‘신청했어요’를 표시한 혜택이 여기에 모여요.</p>}
        </Card>
      )}

      {tab === '내 정보' && (
        <>
          <Card title="글자 크기">
            <div className="wm-sizes">
              {SIZES.map(([k, label]) => (
                <Button key={k} kind={font === k ? 'primary' : 'secondary'} aria-pressed={font === k} onClick={() => setFont(k)}>{label}</Button>
              ))}
            </div>
          </Card>
          <Card title="복지 알림 받기">
            <p>마감 7일 전부터 혜택 화면에 표시하고, 신청 당일에도 다시 알려드려요.</p>
            <Button kind="secondary" role="switch" aria-checked={alertOn} onClick={() => setAlertOn(!alertOn)}>
              {alertOn ? '🔔 알림 켜짐' : '🔕 알림 꺼짐'}
            </Button>
          </Card>
          <Card title="내 정보 변경">
            <p>지금은 {profile.nickname || '닉네임 없음'} · 만 {profile.age}세예요. 저장한 생년월일과 주소도 아래에서 변경할 수 있어요.</p>
            <DraftForm initial={profile} submitText="변경 저장하기" onDone={onSaveProfile} />
          </Card>
          <Button kind="secondary" onClick={onLogout}>로그아웃</Button>
        </>
      )}
    </Screen>
  )
}
