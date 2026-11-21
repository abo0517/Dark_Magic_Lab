import { useEffect, useRef, useState } from 'react'
import { Screen, Button, Card, StatusBox, AlertBanner, statusFor } from '../components/UI.jsx'
import CameraCapture from '../components/CameraCapture.jsx'
import { mockCatalog, mockResult } from '../mock.js'
import { ageText, buildAlerts, daysLeft, judge, koreanDate } from '../alerts.js'
import { fetchPolicies, hasBackend } from '../api.js'

const CATEGORIES = ['연금', '지원금', '대출', '돌봄/서비스']

export function categoryOf(p) {
  if (p.name.includes('연금')) return '연금'
  if (/대출|융자/.test(p.name)) return '대출'
  if (/돌봄|서비스|요양/.test(p.name)) return '돌봄/서비스'
  return '지원금'
}

function Slider({ items, idx, setIdx, favorites, onFavorite, onOpen }) {
  const n = items.length
  const touch = useRef(null)
  const go = (i) => setIdx(Math.min(n - 1, Math.max(0, i)))
  return (
    <section aria-label="대상일 수 있는 혜택">
      <div className="wm-slider-head">
        <h2 className="ws-ui-heading">나에게 맞을 수 있는 제도 <span className="ws-alert-badge">{n}개</span></h2>
        {n > 1 && (
          <div className="wm-slider-nav">
            <button type="button" aria-label="이전 혜택" disabled={idx === 0} onClick={() => go(idx - 1)}>‹</button>
            <span aria-live="polite">{idx + 1} / {n}</span>
            <button type="button" aria-label="다음 혜택" disabled={idx === n - 1} onClick={() => go(idx + 1)}>›</button>
          </div>
        )}
      </div>
      <div
        className="wm-slider-view"
        aria-roledescription="carousel"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (Math.abs(dx) > 45) go(dx < 0 ? idx + 1 : idx - 1)
        }}
      >
        <ul className="wm-slider-track" style={{ width: `${n * 100}%`, transform: `translateX(-${(idx * 100) / n}%)` }}>
          {items.map((p, i) => {
            const fav = favorites.some((f) => f.name === p.name)
            const hidden = i !== idx
            return (
              <li key={p.name} className="wm-slide" style={{ flexBasis: `${100 / n}%` }} aria-hidden={hidden || undefined} inert={hidden ? '' : undefined}>
                <div className="wm-benefit">
                  <button type="button" className={`wm-favorite${fav ? ' is-on' : ''}`} aria-pressed={fav} aria-label={`${p.name} 즐겨찾기 ${fav ? '해제' : '추가'}`} onClick={() => onFavorite(p)}>
                    {fav ? '★' : '☆'}
                  </button>
                  <button type="button" className="wm-benefit-body" aria-label={`${p.name} 서류 확인하기`} onClick={() => onOpen(p)}>
                    <strong>{p.name}</strong>
                    <span>{p.summary || p.description || '제도 상세 내용은 안내문과 제출처에서 확인해 주세요.'}</span>
                    <span className="ws-ui-muted">{ageText(p)}</span>
                    <span className="wm-benefit-chips">
                      <span>필요 서류 {(p.docs ?? []).length}개</span>
                      <span className="wm-benefit-cta">눌러서 서류 보기 ›</span>
                    </span>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default function BenefitsScreen({ profile, category, setCategory, alertOn, applied, favorites, onFavorite, onOpen, onScan, onBack, onHome }) {
  const today = koreanDate()
  const [idx, setIdx] = useState(0)
  const [status, setStatus] = useState('')
  const [camera, setCamera] = useState(false)
  const [slow, setSlow] = useState(false)
  const abortRef = useRef(null)
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)
  const fileRef = useRef(null)

  const [cat, setCat] = useState({ rows: hasBackend ? null : mockCatalog, error: false })

  useEffect(() => {
    if (!hasBackend) return
    let off = false
    fetchPolicies(profile)
      .then((rows) => !off && setCat({ rows, error: false }))
      .catch(() => !off && setCat({ rows: [], error: true }))
    return () => { off = true }
  }, [])

  const loading = cat.rows === null
  const isOpen = (p) => p.closed !== true && (daysLeft(p.deadline, today) === null || daysLeft(p.deadline, today) >= 0)
  const mine = (p) => judge(p, profile).ok && isOpen(p)
  const real = (cat.rows ?? []).filter(mine)
  const sample = !loading && real.length === 0
  const list = sample ? mockResult.programs.filter(mine).map((p) => ({ ...p, isSample: true })) : real
  const shown = list.filter((p) => category === '전체' || categoryOf(p) === category)
  const current = Math.min(idx, Math.max(0, shown.length - 1))

  useEffect(() => {
    if (category === null && !dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  const alerts = alertOn ? buildAlerts({ tracked: list.filter((p) => !applied.some((a) => a.name === p.name)), age: profile.age, today }) : []

  function closeCategories() {
    if (category === null) return onBack()
    dialogRef.current.close()
    triggerRef.current?.focus()
  }

  function pick(label) {
    setCategory(label)
    setIdx(0)
    dialogRef.current.close()
  }

  async function scan(selection) {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus('loading')
    try {
      await onScan({ ...selection, signal: ctrl.signal })
    } catch (e) {
      if (!ctrl.signal.aborted) setStatus(statusFor(e))
    }
  }

  function cancelScan() {
    abortRef.current?.abort()
    setStatus('')
  }

  useEffect(() => {
    setSlow(false)
    if (status !== 'loading') return
    const t = setTimeout(() => setSlow(true), 10000)
    return () => clearTimeout(t)
  }, [status])

  const count = (label) => list.filter((p) => label === '전체' || categoryOf(p) === label).length

  return (
    <Screen
      variant="benefits"
      title={<>{profile.nickname || '회원'}님,<br />이런 혜택을 살펴보세요.</>}
      onHome={onHome}
      footer={
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            aria-label="안내문 사진 또는 PDF 선택"
            hidden
            onChange={(e) => {
              const file = e.target.files[0]
              e.target.value = ''
              if (file) scan({ kind: 'file', file })
            }}
          />
          {status === 'loading' ? (
            <>
              <StatusBox state="loading" action="취소" onAction={cancelScan} />
              {slow && <p className="ws-ui-muted">조금만 기다려 주세요. 사진이 크거나 서버가 바쁠 때는 오래 걸릴 수 있어요.</p>}
            </>
          ) : status ? (
            <StatusBox state={status} action="다시 촬영하기" onAction={() => { setStatus(''); setCamera(true) }} />
          ) : (
            <Button onClick={() => setCamera(true)}>📷 안내문 촬영하기</Button>
          )}
          <Button kind="quiet" disabled={status === 'loading'} onClick={() => fileRef.current.click()}>사진·PDF 파일로 올리기</Button>
          <p className="ws-ui-muted wm-privacy">사진은 외부 AI로 전송되며 서버에는 저장하지 않아요.</p>
        </>
      }
    >
      {alerts.length > 0 && (
        <details className="wm-disclosure">
          <summary>🔔 확인할 알림 {alerts.length}개</summary>
          <AlertBanner alerts={alerts} />
        </details>
      )}
      {sample && <p className="ws-ui-note" role="note">현재 신청 가능한 실제 혜택이 없어 이해를 돕기 위한 가데이터 예시를 보여드려요.</p>}
      <div className="wm-category-row">
        <strong>{category ?? '카테고리를 선택해 주세요'}</strong>
        <button ref={triggerRef} type="button" className="ws-ui-button ws-ui-secondary" onClick={() => dialogRef.current.showModal()}>다른 카테고리 살펴보기</button>
      </div>
      {cat.error && <p className="ws-ui-error" role="alert">혜택 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      {loading ? (
        <p role="status">혜택을 불러오고 있어요.</p>
      ) : shown.length ? (
        <Slider items={shown} idx={current} setIdx={setIdx} favorites={favorites} onFavorite={onFavorite} onOpen={onOpen} />
      ) : (
        <Card title={category ? `${category} 혜택이 아직 없어요` : '관심 있는 혜택을 선택해 주세요'}>
          <p>다른 카테고리를 선택하거나 안내문을 촬영해 주세요.</p>
        </Card>
      )}
      <p className="ws-ui-muted wm-privacy">소득·거주 조건에 따라 실제 대상은 다를 수 있어요.</p>

      <dialog ref={dialogRef} className="wm-dialog" aria-labelledby="wm-cat-title" onCancel={(e) => { e.preventDefault(); closeCategories() }}>
        <div className="wm-dialog-head">
          <h2 id="wm-cat-title" className="ws-ui-heading">어떤 혜택을 찾으세요?</h2>
          <button type="button" className="wm-dialog-close" aria-label="카테고리 선택 닫기" onClick={closeCategories}>×</button>
        </div>
        <p>관심 있는 카테고리를 골라주세요.<br />나중에 다른 혜택도 살펴볼 수 있어요.</p>
        <div className="wm-categories wm-categories-modal">
          {['전체', ...CATEGORIES].map((label) => (
            <button key={label} type="button" className={label === '전체' ? 'wm-cat-all' : undefined} onClick={() => pick(label)}>
              <strong>{label}</strong>
              <span>{count(label)}개 혜택</span>
            </button>
          ))}
        </div>
        <p className="ws-ui-muted">즐겨찾기한 혜택은 마이페이지에서 확인하세요.</p>
      </dialog>

      {camera && <CameraCapture onClose={() => setCamera(false)} onCapture={(file) => onScan({ kind: 'file', file })} />}
    </Screen>
  )
}
