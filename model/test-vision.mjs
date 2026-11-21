// 샘플 안내문 이미지를 Claude Vision에 보내 핵심 4개 항목을 뽑아 출력한다.
// 사용: node --env-file=.env model/test-vision.mjs samples
import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'

const MODEL = 'claude-opus-5-5'
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const PROMPT = `이 안내문에서 아래 항목을 JSON으로만 답하세요.
글에 없는 값은 빈 값으로 두고 지어내지 마세요. 날짜는 YYYY-MM-DD 형식이고 기한이 없으면 빈 문자열입니다.
대상 여부를 판단하지 말고 글에 적힌 조건만 옮기세요.
{"easySummary":"","deadline":"","minAge":null,"maxAge":null,"docs":[],"office":""}`

const dir = process.argv[2]
if (!dir || !fs.existsSync(dir)) {
  console.error('사용법: node --env-file=.env model/test-vision.mjs <이미지 폴더>')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY가 없습니다. .env 파일을 확인하세요.')
  process.exit(1)
}

const client = new Anthropic()

// 이미지 한 장을 보내 응답 텍스트를 받는다
async function analyze(file) {
  const data = fs.readFileSync(file)
  if (data.length > MAX_BYTES) throw new Error('이미지가 5MB를 넘습니다. 줄여서 다시 넣어주세요.')
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: TYPES[path.extname(file).toLowerCase()], data: data.toString('base64') } },
      { type: 'text', text: PROMPT },
    ] }],
  })
  if (res.stop_reason === 'refusal') throw new Error('모델이 요청을 거절했습니다.')
  return res.content.find(b => b.type === 'text')?.text ?? ''
}

const files = fs.readdirSync(dir).filter(f => TYPES[path.extname(f).toLowerCase()])
if (!files.length) console.error('이미지(jpg, png, webp)가 없습니다.')

for (const f of files) {
  console.log(`\n== ${f}`)
  try {
    console.log(await analyze(path.join(dir, f)))
  } catch (err) {
    console.error('실패:', err.message)
  }
}
