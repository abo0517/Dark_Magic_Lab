# 모델 서버

안내문 이미지나 PDF를 받아 Claude(`claude-sonnet-5-5`)에 그대로 보내 `{easySummary, programs[]}`를 돌려준다. OCR 모델은 쓰지 않는다. 팀 컴퓨터에서 직접 실행한다(Docker 사용 안 함).

## 엔드포인트
| 경로 | 설명 |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `POST /analyze` | 필드 `file`. 성공 시 200과 `{"easySummary","programs":[...]}`. 모든 제도의 핵심 키(deadline, periodText, minAge, maxAge, docs, office, applyMethod)가 비었거나 제도가 없으면 422 `UNREADABLE` |

- 헤더 `X-Shared-Secret`이 필요하다(없거나 다르면 401 `UNAUTHORIZED`).
- jpeg, png, webp(5MB 이하), PDF(10MB 이하)만 받는다. 크기 초과 413 `TOO_LARGE`, 그 외 형식 415 `UNSUPPORTED`.
- Claude 호출이 실패하면 502 `UPSTREAM_ERROR`, 55초를 넘기면 504 `TIMEOUT`, 모델이 거절하면 422 `UNREADABLE`.
- 응답 값에서 주민등록번호, 휴대전화번호 형식은 `[삭제]`로 바꾼다(`mask.py`).

## 실행
```bash
pip install -r requirements.txt
set SHARED_SECRET=값
uvicorn app:app --host 0.0.0.0 --port 7860
```
- `SHARED_SECRET`과 `ANTHROPIC_API_KEY`(환경변수 또는 저장소 루트 `.env`)가 없으면 서버가 시작하지 않는다. 값은 저장소에 넣지 않는다.
- 백엔드(Supabase Edge Function)는 인터넷에서 부르므로 `localhost`로는 닿지 않는다. 공개 주소(터널이나 포트 포워딩)가 필요하고 컴퓨터가 켜져 있어야 한다.

## 개인정보
- 이미지는 Claude API(외부)로 전송된다. 이 사실을 화면에 알려야 한다. 이미지는 메모리에서만 처리하고 저장하지 않는다.
- 이미지 안의 숫자는 전송 전에 지울 수 없다. 프롬프트로 개인 번호를 결과에 넣지 않게 하고, 응답에서도 한 번 더 지운다.
- 로그에는 파일명, 크기, 소요 시간만 남긴다(이미지, 응답 내용, 헤더 값은 남기지 않는다).

## 파일
- `app.py`: 엔드포인트, 인증, 크기와 형식 검사, 오류 코드.
- `claude.py`: Claude 호출. 프롬프트 규칙과 제도 스키마는 `model/policy_extract.py`와 같은 것을 쓴다.
- `mask.py`, `test_mask.py`: 번호 형식 지우기와 테스트(`python test_mask.py`).
- `parse.py`: 배준서의 규칙 기반 파서. OCR을 쓰지 않게 되어 지금은 연결하지 않았다.
