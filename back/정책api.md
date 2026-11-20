# 정책 API (공공데이터포털)

복지 정책 목록과 상세를 가져오는 외부 API 정리. 응답은 XML이다.

## 인증키

- 두 API 모두 같은 일반 인증키(`serviceKey`)를 쓴다.
- 키는 저장소에 넣지 않는다. 서버의 `.env`에 `DATA_GO_KR_KEY`로 두고 `.gitignore`에 `.env`를 등록한다.
- 키는 서버에서만 호출한다. 브라우저 코드에 넣지 않는다.

## 1. 중앙부처 복지서비스

- 제공: 한국사회보장정보원, 일 100회 제한
- 기본 주소: `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001`

| 기능 | 경로 | 확인한 요청 변수 |
|---|---|---|
| 목록 조회 | `/NationalWelfarelistV001` | `serviceKey`, `callTp=L`, `pageNo`, `numOfRows`, `srchKeyCode=003` |
| 상세 조회 | `/NationalWelfaredetailedV001` | `serviceKey`, `callTp=D`, `servId` |

- 목록 응답: `totalCount`, `servList[]` (`servId`, `servNm`, `servDgst`, `intrsThemaArray`, `jurMnofNm`, `onapPsbltYn`, `rprsCtadr`, `servDtlLink`, `sprtCycNm`, `srvPvsnNm`)
- 상세 응답: `servId`, `servNm`, `wlfareInfoOutlCn`(개요), `tgtrDtlCn`(대상), `slctCritCn`(선정 기준), `alwServCn`(지원 내용), `applmetList`(신청 방법), `basfrmList`(서식), `inqplCtadrList`(문의처), `inqplHmpgReldList`, `baslawList`(근거 법령), `jurMnofNm`

## 2. 지자체 복지서비스

- 제공: 한국사회보장정보원, 일 1000회 제한
- 기본 주소: `https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations`

| 기능 | 경로 | 확인한 요청 변수 |
|---|---|---|
| 목록 조회 | `/LcgvWelfarelist` | `serviceKey`, `pageNo`, `numOfRows`, `srchKeyCode=003`, `ctpvNm`(시도명) |
| 상세 조회 | `/LcgvWelfaredetailed` | `serviceKey`, `servId` |

- 목록 응답: `totalCount`, `servList[]` (`servId`, `servNm`, `servDgst`, `ctpvNm`, `sggNm`, `bizChrDeptNm`, `intrsThemaNmArray`, `lifeNmArray`, `aplyMtdNm`, `sprtCycNm`, `srvPvsnNm`, `lastModYmd`, `servDtlLink`)
- 상세 응답: `servId`, `servNm`, `servDgst`, `sprtTrgtCn`(지원 대상), `slctCritCn`(선정 기준), `alwServCn`(지원 내용), `aplyMtdCn`(신청 방법), `basfrmList`, `baslawList`, `inqplCtadrList`, `bizChrDeptNm`, `enfcBgngYmd`, `enfcEndYmd`, `lastModYmd`

## 사용 시 주의

- 하루 호출 제한(100회, 1000회)이 있어 목록과 상세는 서버에 캐시하고 사용자 요청마다 호출하지 않는다.
- `resultCode`가 `0`이 아니면 실패로 처리한다.
- 위 표의 변수는 실제 호출로 확인한 것만 적었다. 생애주기, 관심주제, 가구유형 등 추가 검색 변수는 공공데이터포털 명세에서 확인한 뒤 추가한다.
