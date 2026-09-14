// F5 stub: the last step exists end to end (link + sentence through the share
// sheet) so the flow can be walked on a phone. The composite image comes in
// BACKLOG.md §8 and must carry the photo credits when it does.
import { useState } from 'react'
import { shareOrCopy, sharePayload, shareText, type ShareOutcome } from '../lib/share'
import type { Spot } from '../types/spot'

const STATUS: Record<ShareOutcome, string> = {
  shared: '공유함',
  cancelled: '공유 취소',
  copied: '클립보드에 복사됨',
  blocked: '공유·클립보드 모두 막힘 — 아래 내용을 길게 눌러 복사',
}

export function ShareScreen({ spot, onHome }: { spot: Spot; onHome: () => void }) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const payload = sharePayload(spot, window.location.origin + window.location.pathname)

  return (
    <main className="flex h-full flex-col p-4">
      <button type="button" onClick={onHome} className="self-start text-sm text-neutral-400">
        ← 홈
      </button>
      <h1 className="mt-4 text-xl font-semibold">맞췄다</h1>
      <p className="mt-2 text-neutral-300">{payload.text}</p>
      <p className="mt-4 text-xs text-neutral-500">
        지금은 링크와 문장만 보낸다. 옛 사진과 겹친 이미지는 다음 단계.
      </p>
      {outcome && <p className="mt-4 text-sm text-neutral-300">{STATUS[outcome]}</p>}
      {outcome === 'blocked' && (
        <textarea
          readOnly
          value={shareText(payload)}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 h-24 w-full rounded bg-neutral-900 p-2 text-xs text-neutral-300"
        />
      )}
      <div className="mt-auto space-y-2">
        <button
          type="button"
          onClick={async () => setOutcome(await shareOrCopy(payload))}
          className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-black"
        >
          공유하기
        </button>
        <button type="button" onClick={onHome} className="w-full rounded-lg bg-neutral-800 px-4 py-3">
          다른 스팟 보기
        </button>
      </div>
    </main>
  )
}
