const SHEET = import.meta.env.BASE_URL + 'codex-images/bokgil-retriever-walk-v002.png'

export default function AnimatedBokgil({ className = '', still = false }) {
  return (
    <span
      className={`wm-bokgil-sprite${still ? ' wm-bokgil-still' : ''} ${className}`.trim()}
      style={{ backgroundImage: `url(${SHEET})` }}
      aria-hidden="true"
    />
  )
}
