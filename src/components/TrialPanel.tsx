import { useState } from 'react'
import { clearTrials, exportJson, loadTrials, summarize, type Trial } from '../lib/trials'

/** Field-test bookkeeping on the home screen: the running Phase 0 numbers
 *  and a way to get the JSON off the phone. See TEST_PROTOCOL.md §4. */
export function TrialPanel() {
  const [trials, setTrials] = useState<Trial[]>(() => loadTrials())
  const [status, setStatus] = useState<string | null>(null)
  const [rawJson, setRawJson] = useState<string | null>(null)
  const s = summarize(trials)

  async function exportAll() {
    const json = exportJson(trials)
    const name = `sit-trials-${new Date().toISOString().slice(0, 10)}.json`
    try {
      // Phones: share sheet with a real file (AirDrop, KakaoTalk, Drive…).
      const file = new File([json], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name })
        setStatus('공유 시트로 내보냄')
        return
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(json)
      setStatus('클립보드에 복사됨')
    } catch {
      // Last resort: show it. The tester selects all and copies by hand.
      setRawJson(json)
      setStatus('공유·클립보드 모두 막힘 — 아래 내용을 길게 눌러 복사')
    }
  }

  function reset() {
    if (!window.confirm(`실험 기록 ${trials.length}건을 지울까요? 내보내기 먼저 했는지 확인.`)) return
    clearTrials()
    setTrials([])
    setStatus('지움')
  }

  return (
    <section className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-400">
      <div className="flex items-baseline justify-between">
        <span>
          실험 기록 <b className="text-neutral-200">{s.n}</b>건
          {s.successRate !== null && (
            <>
              {' '}· 성공률 <b className="text-neutral-200">{Math.round(s.successRate * 100)}%</b>
              {' '}· 성공 중앙값{' '}
              <b className="text-neutral-200">{s.medianSuccessMs === null ? '—' : `${Math.round(s.medianSuccessMs / 1000)}초`}</b>
            </>
          )}
        </span>
        <span className="flex gap-3">
          <button type="button" onClick={exportAll} disabled={s.n === 0} className="underline disabled:opacity-40">
            내보내기
          </button>
          <button type="button" onClick={reset} disabled={s.n === 0} className="underline disabled:opacity-40">
            지우기
          </button>
        </span>
      </div>
      {status && <p className="mt-1">{status}</p>}
      {rawJson && (
        <textarea
          readOnly
          value={rawJson}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 h-32 w-full rounded bg-neutral-900 p-2 font-mono text-[10px] text-neutral-300"
        />
      )}
    </section>
  )
}
