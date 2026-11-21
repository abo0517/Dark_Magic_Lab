import AnimatedBokgil from './AnimatedBokgil.jsx'

export default function ProgressBokgil({ value, max }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const percent = Math.round(ratio * 100)
  return (
    <div className="ws-progress-bokgil">
      <div
        className="ws-progress-bokgil-track"
        role="progressbar"
        aria-label="서류 준비 진행률"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value}개 / ${max}개 준비`}
      >
        <div className="ws-progress-bokgil-fill" style={{ width: `${percent}%` }} />
        <div className="ws-progress-bokgil-walker" style={{ left: `${percent}%` }} aria-hidden="true">
          <AnimatedBokgil still={percent === 100} />
        </div>
      </div>
      <span className="ws-progress-bokgil-label">{percent}%</span>
    </div>
  )
}
