import AnimatedBokgil from './AnimatedBokgil.jsx'

export function Button({ kind = 'primary', type = 'button', className = '', ...props }) {
  return <button type={type} className={`ws-ui-button ws-ui-${kind} ${className}`.trim()} {...props} />
}

export function Card({ title, children }) {
  return (
    <section className="ws-ui-card">
      <h2 className="ws-ui-heading">{title}</h2>
      {children}
    </section>
  )
}

export function Screen({ title, onBack, onHome, header, children, footer, variant }) {
  return (
    <main className={`ws-ui-page${variant ? ` ws-ui-page-${variant}` : ''}`}>
      <div className="ws-ui-shell">
        <header className="ws-ui-masthead">
          <button type="button" className="ws-ui-brand" onClick={() => onHome?.()} aria-label="복지메이트 홈으로">
            <span className="ws-ui-brand-avatar"><AnimatedBokgil still /></span>
            <span className="ws-ui-wordmark">
              <span className="ws-ui-wordmark-light">복지</span>
              <span className="ws-ui-wordmark-strong">메이트</span>
            </span>
            <span className="ws-ui-demo">시연용</span>
          </button>
          <span className="ws-ui-brand-caption">복잡한 복지를, 쉬운 일상으로</span>
        </header>
        <div className="ws-ui-column">
          {onBack && <Button kind="quiet" className="ws-ui-back" onClick={onBack}>← 뒤로</Button>}
          {header}
          <div className="ws-ui-heading-block">
            <span className="ws-ui-eyebrow">나를 위한 복지 안내</span>
            <h1 className="ws-ui-title">{title}</h1>
          </div>
          <div className="wm-screen-content">{children}</div>
          {footer && <div className="wm-screen-actions">{footer}</div>}
        </div>
        <footer className="ws-ui-footer">복지메이트 · 한 걸음씩, 함께 준비해요</footer>
      </div>
    </main>
  )
}

const STATUS = {
  loading: '안내문을 읽고 있어요.',
  error: '안내문을 읽는 중 문제가 생겼어요.',
  empty: '이 안내문에서 신청할 제도를 찾지 못했어요.',
  unreadable: '사진 속 글자를 읽기 어려워요. 밝은 곳에서 다시 촬영해 주세요.',
  camera: '카메라를 열 수 없어요. 저장된 사진을 올려주세요.',
}

export function StatusBox({ state, action, onAction }) {
  const alert = ['error', 'camera', 'unreadable'].includes(state)
  return (
    <div className="ws-ui-status" role={alert ? 'alert' : 'status'}>
      <p className={alert ? 'ws-ui-error' : undefined}>{STATUS[state]}</p>
      {action && onAction && <Button onClick={onAction}>{action}</Button>}
    </div>
  )
}

export function ApplyButton({ applied, onToggle }) {
  return (
    <Button kind={applied ? 'secondary' : 'primary'} aria-pressed={applied} onClick={onToggle}>
      {applied ? '✅ 신청했어요 (누르면 취소)' : '신청했어요 표시하기'}
    </Button>
  )
}

export function AlertBanner({ alerts }) {
  if (!alerts.length) return null
  return (
    <Card title={<>🔔 알림 <span className="ws-alert-badge" aria-label={`새 알림 ${alerts.length}개`}>{alerts.length}</span></>}>
      <ul className="ws-alert-list" role="status">
        {alerts.map((a) => (
          <li key={a.kind + a.name} className={`ws-alert-${a.kind}`}>
            <strong>{a.name}</strong>
            <br />
            {a.text}
          </li>
        ))}
      </ul>
    </Card>
  )
}
