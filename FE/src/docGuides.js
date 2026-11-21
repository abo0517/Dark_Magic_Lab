const HOME = '가까운 주민센터(동 행정복지센터)'
const BANK = '거래 은행 앱 또는 지점'

const ORG = {
  정부24: 'https://www.gov.kr',
  복지로: 'https://www.bokjiro.go.kr',
  국민건강보험공단: 'https://www.nhis.or.kr',
  홈택스: 'https://www.hometax.go.kr',
  전자가족관계등록시스템: 'https://efamily.scourt.go.kr',
  노인장기요양보험: 'https://www.longtermcare.or.kr',
  고용24: 'https://www.work24.go.kr',
}

const RULES = [
  [(n) => n.includes('소득') && n.includes('재산'), ['복지로'], HOME, '대부분 직접 발급하지 않아도 돼요. 주민센터에서 "금융정보 등 제공 동의서"를 쓰면 담당 공무원이 확인해요.'],
  [(n) => /소득 증빙|소득금액|소득확인/.test(n), ['홈택스', '국민건강보험공단'], HOME, '홈택스에서 소득금액증명, 건강보험공단에서 보험료 납부확인서를 받을 수 있어요.'],
  [(n) => n.includes('장기요양'), ['노인장기요양보험'], '국민건강보험공단 지사', '신청서는 공단 지사·주민센터에 비치돼 있어요.'],
  [(n) => n.includes('구직'), ['고용24'], '가까운 고용센터', ''],
  [(n) => /등본|주민등록/.test(n), ['정부24'], HOME, ''],
  [(n) => n.includes('가족관계'), ['전자가족관계등록시스템', '정부24'], HOME, ''],
  [(n) => n.includes('신분증'), [], HOME, '실물(주민등록증·운전면허증)을 가져가세요. 온라인 발급 서류가 아니에요.'],
  [(n) => n.includes('통장'), [], BANK, '은행 앱에서 "통장 사본(계좌 확인서)"을 받거나 통장 앞면을 복사·촬영해요.'],
  [(n) => /이체|월세/.test(n), [], BANK, '은행 앱에서 이체 내역·확인증을 받을 수 있어요.'],
  [(n) => n.includes('임대차'), [], '본인이 보관 중인 계약서', '집주인과 쓴 계약서 원본·사본이에요. 없으면 공인중개사에 문의하세요.'],
  [(n) => /소견서|건강 상태/.test(n), [], '다니는 병·의원', '병원에서 발급해요. 온라인 발급은 병원마다 달라요.'],
  [(n) => /신청서|신고서/.test(n), ['복지로'], HOME, '신청서는 주민센터에 비치돼 있고 복지로에서 내려받을 수 있어요.'],
]

export function docGuide(name = '') {
  const hit = RULES.find(([test]) => test(name))
  if (!hit) return { online: [], offline: HOME, note: '필요한 서류인지 제출처에 먼저 확인하세요.' }
  const [, orgs, offline, note] = hit
  return { online: orgs.map((o) => ({ name: o, url: ORG[o] })), offline, note }
}
