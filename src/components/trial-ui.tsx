// Pieces shared by the two alignment screens (overlay = 안 A, window = 안 C)
// so a field test compares the alignment method, not two different UIs.
import { useState } from 'react'
import type { SensorStatus } from '../lib/sensors'
import type { Anchor, TrialResult } from '../lib/trials'

export const ANCHOR_OPTIONS: { key: Anchor; label: string }[] = [
  { key: 'ridge', label: '산 능선' },
  { key: 'road', label: '도로·길' },
  { key: 'building', label: '건물 윤곽' },
  { key: 'water', label: '물길·다리' },
  { key: 'other', label: '기타' },
  { key: 'unsure', label: '모르겠음' },
]

export function fmt(n: number | null | undefined, digits = 1): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—'
}

export function HeadingReadout({
  heading,
  delta,
  aligned,
  sensor,
  gotAnyReading,
}: {
  heading: number | null
  delta: number | null
  aligned: boolean
  sensor: SensorStatus
  gotAnyReading: boolean
}) {
  let text: string
  if (sensor === 'denied') text = '나침반 권한 거부됨 — 방위 보정 슬라이더로 수동 조정'
  else if (sensor === 'unsupported') text = '나침반 없음 — 수동 조정'
  else if (!gotAnyReading) text = '나침반 대기 중… 폰을 8자로 흔들어 보세요'
  else if (heading === null || delta === null) text = '나침반 값 없음'
  else if (aligned) text = `정렬됨 · ${Math.round(heading)}°`
  else text = `${delta > 0 ? '→ 오른쪽으로' : '← 왼쪽으로'} ${Math.abs(Math.round(delta))}°`

  return (
    <span className={`rounded-full px-4 py-1 text-sm ${aligned ? 'bg-amber-400 text-black' : 'bg-black/60'}`}>
      {text}
    </span>
  )
}

export function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-neutral-300">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400"
      />
    </label>
  )
}

/** The two verdict buttons shown while live. */
export function VerdictButtons({ onVerdict }: { onVerdict: (r: TrialResult) => void }) {
  return (
    <div className="mt-1 flex gap-2">
      <button
        type="button"
        onClick={() => onVerdict('fail')}
        className="flex-1 rounded-lg bg-neutral-700 py-3 text-base font-semibold"
      >
        못 맞췄다
      </button>
      <button
        type="button"
        onClick={() => onVerdict('success')}
        className="flex-1 rounded-lg bg-amber-400 py-3 text-base font-semibold text-black"
      >
        맞았다
      </button>
    </div>
  )
}

/** Full-screen anchor question asked after the verdict (TEST_PROTOCOL §2). */
export function AnchorSheet({
  result,
  onFinish,
}: {
  result: TrialResult
  onFinish: (anchors: Anchor[]) => void
}) {
  const [anchors, setAnchors] = useState<Anchor[]>([])
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-4 bg-black/90 p-6">
      <h2 className="text-lg font-semibold">
        {result === 'success' ? '무엇이 겹쳐 보였나요?' : '무엇을 맞추려고 했나요?'}
      </h2>
      <p className="text-sm text-neutral-400">해당하는 것 모두 선택</p>
      <div className="flex flex-wrap gap-2">
        {ANCHOR_OPTIONS.map((o) => {
          const on = anchors.includes(o.key)
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setAnchors((prev) => (on ? prev.filter((a) => a !== o.key) : [...prev, o.key]))}
              className={`rounded-full px-4 py-2 text-sm ${on ? 'bg-amber-400 text-black' : 'bg-neutral-800'}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onFinish(anchors)}
        disabled={anchors.length === 0}
        className="mt-4 rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40"
      >
        기록하고 계속
      </button>
    </div>
  )
}

/** A "success" backed only by "모르겠음" is not a success (TEST_PROTOCOL §2). */
export function settleResult(pending: TrialResult, anchors: Anchor[]): TrialResult {
  const onlyUnsure = anchors.length > 0 && anchors.every((a) => a === 'unsure')
  return pending === 'success' && (anchors.length === 0 || onlyUnsure) ? 'fail' : pending
}
