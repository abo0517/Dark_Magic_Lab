const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const MAX = 10 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return reply({ code: 'METHOD_NOT_ALLOWED' }, 405)

  // shortcut: publishable key는 공개 값이라 무작위 호출만 막는다, 로그인 사용자만 허용하려면 withSupabase(user)로 교체
  const keys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'))
  if (!keys.includes(req.headers.get('apikey'))) return reply({ code: 'UNAUTHORIZED' }, 401)

  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX + 1024 * 1024) return reply({ code: 'TOO_LARGE' }, 413)

  let file: FormDataEntryValue | null
  try { file = (await req.formData()).get('file') } catch { return reply({ code: 'UNSUPPORTED' }, 415) }
  if (!(file instanceof File)) return reply({ code: 'UNSUPPORTED' }, 415)
  if (file.size > MAX) return reply({ code: 'TOO_LARGE' }, 413)

  const body = new FormData()
  body.append('file', file, file.name)
  try {
    const r = await fetch(`${Deno.env.get('OCR_SERVER_URL')!.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: { 'X-Shared-Secret': Deno.env.get('OCR_SHARED_SECRET')! },
      body,
      signal: AbortSignal.timeout(58000),
    })
    // 서버의 비밀 불일치(401)는 사용자 잘못이 아니므로 502로 바꿔 전달
    return new Response(await r.text(), {
      status: r.status === 401 ? 502 : r.status,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError'
    return reply({ code: timeout ? 'TIMEOUT' : 'UPSTREAM_ERROR' }, timeout ? 504 : 502)
  }
})
