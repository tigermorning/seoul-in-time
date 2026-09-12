import { useState } from 'react'
import { spots } from './lib/spots'
import type { Spot } from './types/spot'
import { SpotMap } from './components/SpotMap'
import { AlignScreen } from './components/AlignScreen'
import { WindowScreen } from './components/WindowScreen'
import { PanoScreen } from './components/PanoScreen'
import { TrialPanel } from './components/TrialPanel'
import { PhotoCredits } from './components/PhotoCredit'

// The four MVP screens (PLATFORM_COMPARISON.md §6), plus 'window': the same
// alignment step without a camera (안 C, BENCHMARK_CITY_IN_TIME.md §7.3).
// Both alignment screens record trials so the field test can compare them.
type Screen =
  | { name: 'home' }
  | { name: 'guide'; spot: Spot }
  | { name: 'align'; spot: Spot }
  | { name: 'pano'; spot: Spot }
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
          onPano={() => setScreen({ name: 'pano', spot: screen.spot })}
          onWindow={() => setScreen({ name: 'window', spot: screen.spot })}
        />
      )
    case 'align':
    case 'pano':
    case 'window': {
      // A successful trial continues to sharing; a failed one goes home so
      // the next participant starts clean.
      const props = {
        spot: screen.spot,
        onBack: () => setScreen({ name: 'guide', spot: screen.spot }),
        onDone: (trial: { result: string }) =>
          setScreen(trial.result === 'success' ? { name: 'share', spot: screen.spot } : { name: 'home' }),
      }
      if (screen.name === 'align') return <AlignScreen {...props} />
      if (screen.name === 'pano') return <PanoScreen {...props} />
      return <WindowScreen {...props} />
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
      <ol className="mx-4 mb-2 flex gap-2 text-xs text-neutral-400">
        <li className="flex-1 rounded bg-neutral-900 px-2 py-1.5"><b className="text-amber-400">1</b> 아래에서 스팟을 고른다</li>
        <li className="flex-1 rounded bg-neutral-900 px-2 py-1.5"><b className="text-amber-400">2</b> 안내대로 그 자리에 선다</li>
        <li className="flex-1 rounded bg-neutral-900 px-2 py-1.5"><b className="text-amber-400">3</b> 방식을 골라 시작</li>
      </ol>
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
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                {spot.historical.map((h) => h.year ?? '?').join(' · ')} · {spot.status}
                <span className="text-base text-neutral-400">›</span>
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
  onPano,
  onWindow,
}: {
  spot: Spot
  onBack: () => void
  onAlign: () => void
  onPano: () => void
  onWindow: () => void
}) {
  return (
    <main className="flex h-full flex-col p-4">
      <button type="button" onClick={onBack} className="self-start text-sm text-neutral-400">
        ← 뒤로
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h1 className="mt-4 text-xl font-semibold">{spot.name.ko}</h1>
        <p className="mt-2 text-neutral-300">{spot.guide.instruction.ko}</p>
        <ol className="mt-4 space-y-1 text-sm text-neutral-400">
          <li>① 위 안내대로 자리를 잡고 그 방향을 본다.</li>
          <li>② 아래에서 방식을 고른다. 시작한 순간부터 시간이 잰다.</li>
          <li>③ 화면의 화살표대로 폰을 돌려 옛 사진을 가운데로.</li>
          <li>④ 실제 풍경과 겹쳐 보이면 <b className="text-amber-400">맞았다</b>, 아니면 <b>못 맞췄다</b>.</li>
        </ol>
        <div className="mt-6 mb-4">
          <PhotoCredits photos={spot.historical} />
        </div>
      </div>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-neutral-500">
          현장 테스트는 두 방식을 번갈아 써서 기록한다. 둘 다 해 보는 게 좋다.
        </p>
        <button
          type="button"
          onClick={onPano}
          className="w-full rounded-lg bg-amber-400 px-4 py-3 text-left text-black"
        >
          <span className="block font-semibold">B · 파노라마</span>
          <span className="block text-xs">카메라 안 켬. 폰을 돌리면 그 방향의 옛 모습. City in Time 방식</span>
        </button>
        <button
          type="button"
          onClick={onWindow}
          className="w-full rounded-lg bg-neutral-800 px-4 py-3 text-left"
        >
          <span className="block font-semibold">C · 창 모드</span>
          <span className="block text-xs text-neutral-400">카메라 안 켬. 화면엔 옛 사진 1장만, 방위에 고정</span>
        </button>
        <button
          type="button"
          onClick={onAlign}
          className="w-full rounded-lg bg-neutral-800 px-4 py-3 text-left"
        >
          <span className="block font-semibold">A · 카메라 위 겹치기</span>
          <span className="block text-xs text-neutral-400">카메라 켬. 실시간 영상 위에 옛 사진을 반투명으로 겹침</span>
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
