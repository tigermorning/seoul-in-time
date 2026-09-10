import { useState } from 'react'
import { spots } from './lib/spots'
import type { Spot } from './types/spot'
import { SpotMap } from './components/SpotMap'
import { AlignScreen } from './components/AlignScreen'
import { WindowScreen } from './components/WindowScreen'
import { TrialPanel } from './components/TrialPanel'

// The four MVP screens (PLATFORM_COMPARISON.md §6), plus 'window': the same
// alignment step without a camera (안 C, BENCHMARK_CITY_IN_TIME.md §7.3).
// Both alignment screens record trials so the field test can compare them.
type Screen =
  | { name: 'home' }
  | { name: 'guide'; spot: Spot }
  | { name: 'align'; spot: Spot }
  | { name: 'window'; spot: Spot }
  | { name: 'share'; spot: Spot }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  switch (screen.name) {
    case 'home':
      return <Home onSelect={(spot) => setScreen({ name: 'guide', spot })} />
    case 'guide':
      return (
        <Guide
          spot={screen.spot}
          onBack={() => setScreen({ name: 'home' })}
          onAlign={() => setScreen({ name: 'align', spot: screen.spot })}
          onWindow={() => setScreen({ name: 'window', spot: screen.spot })}
        />
      )
    case 'align':
    case 'window': {
      // A successful trial continues to sharing; a failed one goes home so
      // the next participant starts clean.
      const props = {
        spot: screen.spot,
        onBack: () => setScreen({ name: 'guide', spot: screen.spot }),
        onDone: (trial: { result: string }) =>
          setScreen(trial.result === 'success' ? { name: 'share', spot: screen.spot } : { name: 'home' }),
      }
      return screen.name === 'align' ? <AlignScreen {...props} /> : <WindowScreen {...props} />
    }
    case 'share':
      return (
        <Placeholder
          title="공유"
          body="합성 이미지 + Web Share. 다음 단계에서 구현."
          onBack={() => setScreen({ name: 'home' })}
        />
      )
  }
}

function Home({ onSelect }: { onSelect: (spot: Spot) => void }) {
  return (
    <main className="flex h-full flex-col">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">서울 인 타임</h1>
        <p className="text-sm text-neutral-400">지금 서 있는 그 자리에서, 그때를 본다.</p>
      </header>
      <div className="h-64 shrink-0">
        <SpotMap spots={spots} onSelect={onSelect} />
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-neutral-800">
        {spots.map((spot) => (
          <li key={spot.id}>
            <button
              type="button"
              onClick={() => onSelect(spot)}
              className="flex w-full items-baseline justify-between px-4 py-3 text-left hover:bg-neutral-900"
            >
              <span>{spot.name.ko}</span>
              <span className="text-xs text-neutral-500">
                {spot.historical.map((h) => h.year ?? '?').join(' · ')} · {spot.status}
              </span>
            </button>
          </li>
        ))}
        {spots.length === 0 && (
          <li className="px-4 py-3 text-sm text-neutral-500">spots/ 폴더에 스팟이 없음</li>
        )}
      </ul>
      <TrialPanel />
    </main>
  )
}

function Guide({
  spot,
  onBack,
  onAlign,
  onWindow,
}: {
  spot: Spot
  onBack: () => void
  onAlign: () => void
  onWindow: () => void
}) {
  return (
    <main className="flex h-full flex-col p-4">
      <button type="button" onClick={onBack} className="self-start text-sm text-neutral-400">
        ← 뒤로
      </button>
      <h1 className="mt-4 text-xl font-semibold">{spot.name.ko}</h1>
      <p className="mt-2 text-neutral-300">{spot.guide.instruction.ko}</p>
      <div className="mt-auto space-y-2">
        <p className="text-xs text-neutral-500">
          현장 테스트는 두 방식을 번갈아 기록한다 (BENCHMARK_CITY_IN_TIME.md §7.3).
        </p>
        <button
          type="button"
          onClick={onWindow}
          className="w-full rounded-lg bg-amber-400 py-3 font-semibold text-black"
        >
          C · 창 모드 — 카메라 없이, 사진만 방위에 고정
        </button>
        <button
          type="button"
          onClick={onAlign}
          className="w-full rounded-lg bg-neutral-800 py-3 font-semibold"
        >
          A · 카메라 위 겹치기
        </button>
      </div>
    </main>
  )
}

function Placeholder({
  title,
  body,
  onBack,
}: {
  title: string
  body: string
  onBack: () => void
}) {
  return (
    <main className="flex h-full flex-col p-4">
      <button type="button" onClick={onBack} className="self-start text-sm text-neutral-400">
        ← 뒤로
      </button>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-neutral-300">{body}</p>
    </main>
  )
}
