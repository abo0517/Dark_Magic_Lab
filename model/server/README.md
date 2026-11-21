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
- 응답 값에서 주민등록번호, 휴대전화번호 형식은 `[삭제]`로 바꾼다(`mask.py`), 값 규칙에 어긋난 값(없는 날짜, 범위 밖 나이, 서울 구가 아닌 `gu`, 중복 서류)은 비운다(`validate.py`).
- 응답에는 `hasPersonalInfo`(이미지에 특정 개인을 알아볼 수 있는 정보가 보이면 true)가 포함된다. 외부 전송 공지를 이 값이 true일 때만 띄우는 데 쓴다. 판별은 Claude가 하므로 이미지가 전송된 뒤에 알 수 있다.

## 실행
```bash
pip install -r requirements.txt
set SHARED_SECRET=값
uvicorn app:app --host 127.0.0.1 --port 7860
```
- `SHARED_SECRET`과 `ANTHROPIC_API_KEY`(환경변수 또는 저장소 루트 `.env`)가 없으면 서버가 시작하지 않는다. 값은 저장소에 넣지 않는다.
- 백엔드(Supabase Edge Function)는 인터넷에서 부르므로 `localhost`로는 닿지 않는다. 공개 주소(터널이나 포트 포워딩)가 필요하고 컴퓨터가 켜져 있어야 한다.

## 개인정보
- 이미지는 Claude API(외부)로 전송된다. 이 사실을 화면에 알려야 한다. 이미지는 메모리에서만 처리하고 저장하지 않는다.
- 이미지 안의 숫자는 전송 전에 지울 수 없다. 프롬프트로 개인 번호를 결과에 넣지 않게 하고, 응답에서도 한 번 더 지운다.
- 로그에는 파일명, 크기, 소요 시간만 남긴다(이미지, 응답 내용, 헤더 값은 남기지 않는다).

## 시연 때 운영하는 방법 (팀 컴퓨터 + 터널)

서버는 팀 컴퓨터에서 돌리고, Cloudflare 임시 터널(Quick Tunnel)로 인터넷에 연다. 프론트는 Vercel, 백엔드는 Supabase에 있고, 이 서버만 컴퓨터에 있다.

```
브라우저(Vercel) -> Supabase Edge Function analyze -> https://xxxx.trycloudflare.com -> 팀 컴퓨터 localhost:7860
```

1. **비밀값 만들기.** 한 번만 만들고 저장소에 넣지 않는다.
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
2. **서버 실행.** 터널을 쓰면 컴퓨터 밖에서 직접 닿을 필요가 없으므로 `127.0.0.1`로 연다(`0.0.0.0`으로 열면 같은 네트워크의 다른 기기도 접근할 수 있다).
   ```bash
   cd model/server
   set SHARED_SECRET=위에서 만든 값
   python -m uvicorn app:app --host 127.0.0.1 --port 7860
   ```
3. **미리 확인.** 시연 전에 한 번 호출해 둔다.
   ```bash
   curl http://127.0.0.1:7860/health
   curl -H "X-Shared-Secret: 값" -F "file=@사진.jpg" http://127.0.0.1:7860/analyze
   ```
4. **터널 열기.** [cloudflared](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)를 설치하고 새 창에서 실행한다. 계정과 도메인이 필요 없다.
   ```bash
   cloudflared tunnel --url http://127.0.0.1:7860
   ```
   출력에 나오는 `https://무작위이름.trycloudflare.com` 주소가 서버의 공개 주소다.
5. **백엔드에 전달.** Supabase Edge Function의 비밀값(secrets)에 `OCR_SERVER_URL`(위 주소)과 `OCR_SHARED_SECRET`(1번 값)을 넣게 한다. 함수는 `POST {OCR_SERVER_URL}/analyze`에 `file`과 헤더 `X-Shared-Secret`을 보낸다.
6. **끝까지 같은 터널 유지.** 터널 주소는 실행할 때마다 바뀐다. 터널을 껐다 켜면 5번의 `OCR_SERVER_URL`을 다시 바꿔야 하므로 시연이 끝날 때까지 두 창(서버, 터널)을 닫지 않는다.

주의
- 터널 도구의 `--allowed-mail` 옵션은 켜지 않는다. 이메일 인증이 필요해져서 Supabase가 호출하지 못한다.
- 빠른 터널에는 가동 시간 보장이 없고, 동시에 처리 중인 요청은 200개까지다(공식 문서 기준). 시연 규모에는 충분하다.
- 시연하는 동안 컴퓨터를 절전 모드로 두지 않고 전원과 인터넷을 유지한다.
- 이 컴퓨터의 `SHARED_SECRET`과 백엔드의 `OCR_SHARED_SECRET`이 다르면 401 `UNAUTHORIZED`가 나온다.
- 설치: `pip install -r requirements.txt`(fastapi, uvicorn, python-multipart, anthropic).

## 로그
요청 로그에는 파일명, 크기, 소요 시간만 남기고 이미지, 응답 내용, 헤더 값은 남기지 않는다.

## 파일
- `app.py`: 엔드포인트, 인증, 크기와 형식 검사, 오류 코드.
- `claude.py`: Claude 호출. 프롬프트 규칙과 제도 스키마는 `model/policy_extract.py`와 같은 것을 쓴다.
- `mask.py`, `test_mask.py`: 번호 형식 지우기와 테스트(`python test_mask.py`).
- `parse.py`: 배준서의 규칙 기반 파서. OCR을 쓰지 않게 되어 지금은 연결하지 않았다.
