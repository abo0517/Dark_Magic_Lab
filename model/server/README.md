# OCR 서버

안내문 이미지나 PDF를 받아 PP-OCRv5(korean, CPU)로 글자를 읽고, 주민번호와 휴대전화번호를 `[삭제]`로 바꾼 뒤 파싱 결과를 돌려준다. 팀 컴퓨터에서 직접 실행한다(Docker 사용 안 함).

## 엔드포인트
| 경로 | 설명 |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `POST /ocr` | 필드 `file`. `{"text"}` (마스킹 전 원문, 파싱 개발용) |
| `POST /analyze` | 필드 `file`. `{"easySummary","programs":[...]}`, 읽을 수 없으면 422 `UNREADABLE` |

POST에는 헤더 `X-Shared-Secret`이 필요하다(없거나 다르면 401 `UNAUTHORIZED`). 파일은 10MB 이하(초과 413 `TOO_LARGE`), jpeg, png, webp, PDF만 받는다(그 외 415 `UNSUPPORTED`). PDF는 앞 5쪽까지 읽는다.

## 실행
- Python 3.10 권장. 3.15에는 paddlepaddle 설치 파일이 없다.
- Windows는 설치 경로가 길면 설치가 실패하므로(Long Path) 가상환경을 짧은 경로(예: `C:\ocrvenv`)에 만든다.

```bash
py -3.10 -m venv C:\ocrvenv
C:\ocrvenv\Scripts\python.exe -m pip install -r requirements.txt
set SHARED_SECRET=값
C:\ocrvenv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 7860
```

- `SHARED_SECRET`이 없으면 서버가 시작하지 않는다. 값은 저장소에 넣지 않고 백엔드에만 전달한다.
- 첫 실행 때 모델 가중치를 내려받아 시간이 걸린다. 시연 전에 서버를 한 번 띄워 `/health`와 `/ocr` 한 번을 호출해 둔다.
- 백엔드(Supabase Edge Function)는 인터넷에서 부르므로 `localhost`로는 닿지 않는다. 공개 주소(터널이나 포트 포워딩)가 필요하고, 컴퓨터가 켜져 있어야 한다.

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
   C:\ocrvenv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 7860
   ```
3. **미리 데워 두기.** 첫 실행은 모델을 내려받아 오래 걸린다. 시연 전에 한 번 호출한다.
   ```bash
   curl http://127.0.0.1:7860/health
   curl -H "X-Shared-Secret: 값" -F "file=@사진.jpg" http://127.0.0.1:7860/ocr
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
- `requirements.txt`가 저장소에 없다. 서버가 동작하는 가상환경에서 `pip freeze > requirements.txt`로 만들어 올리면 다른 팀원도 같은 환경을 만들 수 있다.

## 로그
요청 로그에는 파일명, 크기, 소요 시간만 남기고 이미지, OCR 텍스트, 헤더 값은 남기지 않는다.

## 파일
- `ocr.py`: PaddleOCR 로드와 읽기. 이미지와 PDF는 메모리에서 디코드한다.
- `mask.py`, `test_mask.py`: 개인정보 숫자 지우기와 테스트(`python test_mask.py`).
- `parse.py`: 파싱(배준서가 구현, 지금은 자리표시).
