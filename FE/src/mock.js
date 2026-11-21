import modelSample from './fixtures/model-sample.json'
import { fromModel } from './api.js'

export const mockResult = {
  easySummary: '65세 이상 어르신께 매달 일정 금액을 드리는 제도 안내문입니다. (샘플)',
  source: '공공데이터포털 · 복지서비스 목록 (샘플)',
  kind: '기초연금 안내문 (샘플)',
  todos: [
    { text: '신분증과 통장 사본을 챙겨요', deadline: '' },
    { text: '소득·재산 신고서를 작성해 주민센터에 내요', deadline: '2026-12-31' },
  ],
  facts: [
    { label: '신청 기한', value: '2026년 12월 31일까지', evidence: '신청 기간: 2026. 1. 1. ~ 2026. 12. 31. (샘플)', uncertain: false },
    { label: '지원 금액', value: '', evidence: '', uncertain: true },
    { label: '제출처', value: '가까운 주민센터', evidence: '신청 장소: 주소지 읍·면·동 행정복지센터 (샘플)', uncertain: false },
  ],
  programs: [
    { name: '기초연금(샘플)', summary: '어르신께 매달 일정 금액을 드려요.', minAge: 65, deadline: '2026-12-31', office: '가까운 주민센터', docs: ['신분증', '통장 사본', '소득·재산 신고서'] },
    { name: '청년 월세 지원(샘플)', summary: '청년의 월세 부담을 덜어줘요.', minAge: 19, maxAge: 34, deadline: '2026-11-23', office: '가까운 주민센터 또는 복지로 온라인', docs: ['신분증', '임대차계약서', '통장 사본', '소득·재산 확인 서류'] },
    { name: '마포구 어르신 맞춤돌봄(샘플)', summary: '혼자 사는 어르신께 돌봄과 안부 확인을 해줘요.', minAge: 65, gu: '마포구', deadline: '', office: '마포구 주민센터', docs: ['신분증', '서비스 신청서', '소득·재산 확인 서류'] },
    { name: '에너지(난방비) 바우처(샘플)', summary: '난방비를 지원해요.', deadline: '', office: '가까운 주민센터', docs: ['신분증', '통장 사본', '신청서'] },
  ],
}

export const mockCatalog = [
  {
    name: '서울시 청년월세지원',
    summary: '월세를 매달 최대 20만 원씩, 최대 12개월 지원해요. 1989년생은 연령 기준(19~39세)에 들어요.',
    eligibility: '서울 거주·무주택·소득 및 임차보증금/월세 기준을 함께 충족해야 해요. 2026년 신청은 5월 19일 마감됐어요.',
    minAge: 19,
    maxAge: 39,
    deadline: '2026-05-19',
    office: '서울주거포털 온라인 신청 · 문의 1833-2030',
    source: '서울주거포털 · 2026 사업개요',
    sourceUrl: 'https://housing.seoul.go.kr/site/main/content/sh01_060513',
    docs: ['임대차계약서', '월세 이체 확인증', '가족관계증명서'],
  },
  {
    name: '근로장려금',
    summary: '일은 하지만 소득이 적은 가구에 현금을 지원해요. 2025년 소득 기준 최대 165만~330만 원까지 받을 수 있어요.',
    eligibility: '2025년 소득과 가구 유형에 따라 기준이 달라요: 단독 2,200만 원 미만, 홑벌이 3,200만 원 미만, 맞벌이 4,400만 원 미만. 가구 재산 합계 2억 4천만 원 미만이어야 해요.',
    deadline: '2026-12-01',
    office: '홈택스·손택스 또는 주소지 관할 세무서 · 문의 1544-9944',
    source: '국세청 · 2025년 귀속 근로·자녀장려금 기한 후 신청',
    sourceUrl: 'https://nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=&nttSn=1350768',
    docsNote: '아래 증빙은 모든 신청자에게 필요한 서류가 아니에요. 해당하는 경우에만 체크하세요. 안내문을 받은 경우 QR·손택스·ARS로 간편 신청할 수 있어요.',
    docs: ['소득 증빙자료 (안내문을 못 받았거나 소득자료가 누락된 경우)', '임대차계약서 사본 (실제 전세금이 간주전세금보다 낮아 실제 금액을 적용받을 경우)'],
  },
]

// 목업. 서버 호출로 바꿀 때 이 함수만 교체한다. 실패는 err.code(UNREADABLE|BLURRY|CROPPED|TIMEOUT)로 reject.
// 파일 이름으로 상황을 흉내 낸다: blur, crop, fail, slow(15초), hang(무응답), model-1~4(모델 팀 샘플 결과)
export const analyze = async ({ file } = {}) => {
  const name = file?.name ?? ''
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const reject = (code) => Promise.reject(Object.assign(new Error(code), { code }))
  if (name.includes('hang')) return new Promise(() => {})
  await wait(name.includes('slow') ? 15000 : 600)
  if (name.includes('blur')) return reject('BLURRY')
  if (name.includes('crop')) return reject('CROPPED')
  if (name.includes('fail')) return reject('ERROR')
  const m = /model-?(\d+)/.exec(name)
  if (m) return fromModel(modelSample[(+m[1] - 1) % modelSample.length])
  return mockResult
}
