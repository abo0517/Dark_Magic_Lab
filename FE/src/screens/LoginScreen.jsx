import { useEffect, useState } from 'react'
import { Screen, Button } from '../components/UI.jsx'
import AnimatedBokgil from '../components/AnimatedBokgil.jsx'

const STEPS = [
  ['01', '내 혜택 찾기', '나이와 지역을 바탕으로'],
  ['02', '안내문 이해하기', '어려운 말을 쉽게'],
  ['03', '서류 준비하기', '하나씩 확인하며 준비'],
]

export default function LoginScreen({ onLogin }) {
  const [motionOn, setMotionOn] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setMotionOn(!mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  return (
    <Screen
      variant="welcome"
      title={<>내게 필요한 복지,<br /><span className="ws-login-accent">복지메이트</span>와 함께.</>}
      footer={
        <div className="ws-login-actions">
          <p className="ws-login-lead">지금, 나를 위한 혜택을 찾아보세요</p>
          <Button className="ws-login-kakao" onClick={() => onLogin('kakao')}>💬 카카오로 시작하기</Button>
          <Button kind="secondary" className="ws-login-google" onClick={() => onLogin('google')}>
            <span className="ws-login-g" aria-hidden="true">G</span> 구글로 시작하기
          </Button>
          <p className="ws-ui-muted">실제 로그인 없이 체험해요.<br />시연용으로, 실제 계정 정보는 사용하지 않아요.</p>
        </div>
      }
    >
      <p className="ws-login-desc">어려운 안내문부터 준비 서류까지.<br />길잡이 복길이가 함께 걸어갈게요.</p>
      <div className={`ws-login-art${motionOn ? '' : ' ws-login-motion-paused'}`} aria-hidden="true">
        <span className="ws-login-halo ws-login-halo-a" />
        <span className="ws-login-halo ws-login-halo-b" />
        <svg className="ws-login-route" viewBox="0 0 400 340">
          <path d="M40 215C-5 100 140 40 258 62S410 214 315 275 125 320 90 256" />
          <circle cx="40" cy="215" r="7" />
          <circle cx="258" cy="62" r="7" />
        </svg>
        <span className="ws-login-star">✦</span>
        <span className="ws-login-star">✦</span>
        <div className="wm-bokgil-guide"><AnimatedBokgil /></div>
        <div className="wm-bokgil-path" />
        <div className="ws-login-float"><span>♡ 나에게 맞는<br />혜택 찾기</span></div>
        <div className="ws-login-float"><span>≡ 어려운 안내문도<br />쉽게 풀어요</span></div>
        <div className="ws-login-float"><span>✓ 준비도 차근차근</span></div>
      </div>
      <div className="ws-login-caption">
        <span>당신의 첫걸음에, 복지메이트</span>
        <Button kind="quiet" aria-pressed={motionOn} onClick={() => setMotionOn((v) => !v)}>
          {motionOn ? '모션 멈추기' : '모션 재생'}
        </Button>
      </div>
      <ol className="ws-login-steps" aria-label="이용 순서">
        {STEPS.map(([n, t, d]) => (
          <li key={n}><b>{n}</b> <strong>{t}</strong> <span>{d}</span></li>
        ))}
      </ol>
    </Screen>
  )
}
