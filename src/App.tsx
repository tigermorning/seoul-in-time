import { useState } from 'react'
import { spots } from './lib/spots'
import type { Spot } from './types/spot'
import { SpotMap } from './components/SpotMap'
import { AlignScreen } from './components/AlignScreen'

// The four MVP screens (PLATFORM_COMPARISON.md §6). Only Home is real yet;
// the others are placeholders that receive the selected spot so the
// navigation contract is fixed before the camera work starts.
type Screen =
  | { name: 'home' }
  | { name: 'guide'; spot: Spot }
  | { name: 'align'; spot: Spot }
  | { name: 'share'; spot: Spot }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  switch (screen.name) {
    case 'home':
      return <Home onSelect={(spot) => setScreen({ name: 'guide', spot })} />
    case 'guide':
      return (
        <Placeholder
          title={screen.spot.name.ko}
          body={screen.spot.guide.instruction.ko}
          onBack={() => setScreen({ name: 'home' })}
          onNext={() => setScreen({ name: 'align', spot: screen.spot })}
          nextLabel="시작하기"
        />
      )
    case 'align':
      return (
        <AlignScreen
          spot={screen.spot}
          onBack={() => setScreen({ name: 'guide', spot: screen.spot })}
          onNext={() => setScreen({ name: 'share', spot: screen.spot })}
        />
      )
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
    </main>
  )
}

function Placeholder({
  title,
  body,
  onBack,
  onNext,
  nextLabel,
}: {
  title: string
  body: string
  onBack: () => void
  onNext?: () => void
  nextLabel?: string
}) {
  return (
    <main className="flex h-full flex-col p-4">
      <button type="button" onClick={onBack} className="self-start text-sm text-neutral-400">
        ← 뒤로
      </button>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-neutral-300">{body}</p>
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="mt-auto rounded-lg bg-amber-400 py-3 font-semibold text-black"
        >
          {nextLabel}
        </button>
      )}
    </main>
  )
}
