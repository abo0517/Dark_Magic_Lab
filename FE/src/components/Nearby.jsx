import { useState } from 'react'
import { Button, Card } from './UI.jsx'

const TAX = /근로장려금|자녀장려금/

function onlineApply(name) {
  if (TAX.test(name))
    return { label: '홈택스에서 신청하기', url: 'https://www.hometax.go.kr/', text: '로그인 후 장려금 → 근로·자녀장려금 정기 신청 메뉴에서 신청하고 필요한 서류를 제출하세요.' }
  if (name.includes('서울시 청년월세지원'))
    return { label: '서울주거포털 신청 안내 보기', url: 'https://housing.seoul.go.kr/site/main/content/sh01_060513', text: '사업 공고와 접수 기간을 확인한 뒤 온라인 신청으로 이동하세요.' }
  if (name.includes('기초연금'))
    return { label: '복지로에서 신청하기', url: 'https://www.bokjiro.go.kr', text: '로그인 후 서비스 신청 → 복지급여 신청 → 기초연금에서 신청하세요.' }
  return { label: '복지로에서 온라인 신청 가능 여부 확인', url: 'https://www.bokjiro.go.kr', text: '혜택 이름을 검색해 신청 방법을 확인하세요. 제도에 따라 방문 신청만 가능할 수 있어요.' }
}

export default function Nearby({ gu, dong, program }) {
  const [state, setState] = useState({ kind: 'idle' })
  const org = TAX.test(program.name) ? '세무서' : '주민센터'
  const apply = onlineApply(program.name)
  const q = [gu, dong].filter(Boolean).join(' ')

  function locate() {
    if (!navigator.geolocation) return setState({ kind: 'unsupported' })
    setState({ kind: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ kind: 'ok', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setState({ kind: 'fail' }),
      { timeout: 10000 },
    )
  }

  return (
    <Card title="서류 내는 곳 찾기">
      <p>가까운 {org}에서 신청과 서류 제출 방법을 안내받을 수 있어요.</p>
      <Button kind="secondary" onClick={locate}>내 위치로 주변 {org} 찾기</Button>
      {state.kind === 'loading' && <p role="status">위치를 찾는 중이에요.</p>}
      {state.kind === 'unsupported' && <p className="ws-ui-error" role="alert">이 기기에서는 위치를 쓸 수 없어요. 아래 주소 검색을 이용하세요.</p>}
      {state.kind === 'fail' && <p className="ws-ui-error" role="alert">위치를 가져오지 못했어요. 위치 권한을 허용하거나 아래 주소 검색을 이용하세요.</p>}
      {state.kind === 'ok' && (
        <>
          <iframe
            className="ws-nearby-map"
            loading="lazy"
            title={`현재 위치 주변 ${org} 지도`}
            src={`https://www.google.com/maps?q=${state.lat},${state.lng}+${encodeURIComponent(org)}&z=15&output=embed`}
          />
          <p>지도에서 주변 {org}를 확인해 주세요.</p>
        </>
      )}
      {gu ? (
        <a href={`https://www.google.com/maps/search/${encodeURIComponent(`서울 ${q} ${org}`)}`} target="_blank" rel="noopener noreferrer">
          {q} {org} 지도에서 보기 ↗
        </a>
      ) : (
        <p className="ws-ui-muted">주소를 입력하면 그 동네 {org}도 찾아드려요.</p>
      )}
      <section className="wm-online-apply" aria-label="인터넷으로 신청 및 서류 제출">
        <h3>인터넷으로 신청·제출하기</h3>
        <p>{apply.text}</p>
        <a href={apply.url} target="_blank" rel="noopener noreferrer">{apply.label} ↗ (새 창)</a>
        <p className="ws-ui-muted">공식 사이트에서 본인인증 후 진행해 주세요. 접수 기간과 제출 서류는 해당 사이트에서 확인할 수 있어요.</p>
      </section>
    </Card>
  )
}
