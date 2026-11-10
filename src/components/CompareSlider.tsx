import { useState } from 'react'

// Then/now comparison: the present photo sits on top and is clipped from the
// left edge to the handle, so dragging right reveals more of "now".
export function CompareSlider({
  thenSrc,
  nowSrc,
  thenLabel,
  nowLabel,
  alt,
}: {
  thenSrc: string
  nowSrc: string | null
  thenLabel: string
  nowLabel: string
  alt: string
}) {
  const [pos, setPos] = useState(50)

  if (!nowSrc) {
    return (
      <div className="relative">
        <img src={thenSrc} alt={alt} className="block w-full" />
        <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs">{thenLabel}</span>
      </div>
    )
  }

  return (
    <div className="relative select-none">
      <img src={thenSrc} alt={alt} className="block w-full" draggable={false} />
      <img
        src={nowSrc}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-400" style={{ left: `${pos}%` }} />
      <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs">{thenLabel}</span>
      <span className="absolute top-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs">{nowLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${thenLabel} / ${nowLabel}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  )
}
