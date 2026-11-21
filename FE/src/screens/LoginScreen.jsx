import { Screen, Button } from '../components/UI.jsx'
import AnimatedBokgil from '../components/AnimatedBokgil.jsx'

const STEPS = [
  ['01', '내 혜택 찾기', '나이와 지역을 바탕으로'],
  ['02', '안내문 이해하기', '어려운 말을 쉽게'],
  ['03', '서류 준비하기', '하나씩 확인하며 준비'],
]

export default function LoginScreen({ onLogin, error }) {
  return (
    <Screen
      variant="welcome"
      title={<>내게 필요한 복지,<br /><span className="ws-login-accent">복지메이트</span>와 함께.</>}
      footer={
        <div className="ws-login-actions">
          <p className="ws-login-lead">지금, 나를 위한 혜택을 찾아보세요</p>
          <Button className="ws-login-kakao" onClick={() => onLogin('kakao')}>💬 카카오로 시작하기</Button>
          <Button className="ws-login-naver" onClick={() => onLogin('naver')}>
            <span className="ws-login-n" aria-hidden="true">N</span> 네이버로 시작하기
          </Button>
          <Button kind="secondary" className="ws-login-google" onClick={() => onLogin('google')}>
            <span className="ws-login-g" aria-hidden="true">G</span> 구글로 시작하기
          </Button>
          {error && <p className="ws-ui-muted" role="alert">{error}</p>}
        </div>
      }
    >
      <p className="ws-login-desc">어려운 안내문부터 준비 서류까지.<br />길잡이 <strong>복길이</strong>가 함께 걸어갈게요.</p>
      <div className="ws-login-art" aria-hidden="true">
        <span className="ws-login-halo ws-login-halo-a" />
        <span className="ws-login-halo ws-login-halo-b" />
        <svg className="ws-login-route" viewBox="0 0 400 340">
          <path d="M40 215C-5 100 140 40 258 62S410 214 315 275 125 320 90 256" />
          <circle cx="40" cy="215" r="7" />
          <circle cx="258" cy="62" r="7" />
        </svg>
        <div className="wm-bokgil-guide"><AnimatedBokgil /></div>
        {STEPS.map(([n, t, d]) => (
          <div key={n} className={`ws-login-float ws-login-float-${n}`}>
            <span><strong>{t}</strong>{d}</span>
          </div>
        ))}
      </div>
    </Screen>
  )
}
