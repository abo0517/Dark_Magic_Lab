import { useEffect, useRef, useState } from 'react'
import { Button } from './UI.jsx'

const UNREADABLE = '사진 속 글자를 읽기 어려워요. 밝은 곳에서 다시 촬영해 주세요.'

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const [fatal, setFatal] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFatal('이 브라우저는 카메라 촬영을 지원하지 않아요. 휴대전화의 기본 브라우저에서 열어주세요.')
      return
    }
    let stream
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        videoRef.current.srcObject = s
      })
      .catch(() => setFatal('카메라를 열 수 없어요. 브라우저의 카메라 권한을 확인해 주세요.'))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function shoot() {
    const v = videoRef.current
    if (!v.videoWidth) return setMsg('카메라 화면을 준비하고 있어요. 잠시 후 다시 눌러주세요.')
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))
    if (!blob) return setMsg('사진을 만들지 못했어요. 다시 촬영해 주세요.')
    setMsg('')
    setBusy(true)
    try {
      await onCapture(new File([blob], 'welfare-notice.jpg', { type: 'image/jpeg' }))
    } catch (e) {
      setMsg(e?.code === 'UNREADABLE' ? UNREADABLE : '사진을 읽는 중 문제가 생겼어요.')
      setBusy(false)
    }
  }

  const error = fatal || msg
  return (
    <div className="ws-camera-overlay">
      <div className="ws-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="ws-camera-title">
        <div className="ws-camera-head">
          <h2 id="ws-camera-title" className="ws-ui-heading">안내문 촬영</h2>
          <Button kind="quiet" onClick={onClose}>닫기</Button>
        </div>
        <p>안내문이 화면 안에 들어오도록 맞춰주세요.</p>
        <video ref={videoRef} className="ws-camera-video" autoPlay playsInline muted />
        {error && <p className="ws-ui-error" role="alert">{error}</p>}
        <Button onClick={shoot} disabled={!!fatal || busy}>{busy ? '안내문을 읽고 있어요.' : '사진 촬영하기'}</Button>
      </div>
    </div>
  )
}
