export const MAX_SIDE = 1568
export const TIMEOUT_MS = 60000

const fail = (code) => Object.assign(new Error(code), { code })

export function fitSize(w, h, max = MAX_SIDE) {
  const s = Math.min(1, max / Math.max(w, h))
  return [Math.round(w * s), Math.round(h * s)]
}

export async function shrinkImage(file) {
  if (!file.type.startsWith('image/')) return file
  let bmp
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw fail('UNREADABLE')
  }
  const [w, h] = fitSize(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  g.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
  return blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file
}

export function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(fail('TIMEOUT')), ms)
  })
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer))
}
