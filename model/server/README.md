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

## 로그
요청 로그에는 파일명, 크기, 소요 시간만 남기고 이미지, OCR 텍스트, 헤더 값은 남기지 않는다.

## 파일
- `ocr.py`: PaddleOCR 로드와 읽기. 이미지와 PDF는 메모리에서 디코드한다.
- `mask.py`, `test_mask.py`: 개인정보 숫자 지우기와 테스트(`python test_mask.py`).
- `parse.py`: 파싱(배준서가 구현, 지금은 자리표시).
