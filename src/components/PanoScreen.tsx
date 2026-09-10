// 안 B — panorama mode. Same trial flow and controls as WindowScreen; the
// difference is what is on screen: every photo of the spot, hung in a 3D
// world at its own bearing, so turning around shows the past in every
// direction that has a photo (or everywhere, for an equirect panorama).
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Spot } from '../types/spot'
import { bearingDelta, magneticToTrue, normalizeBearing } from '../lib/heading'
import { PanoScene } from '../lib/panoScene'
import { initialSensorStatus, requestOrientationPermission, type SensorStatus } from '../lib/sensors'
import { spotImageUrl } from '../lib/spots'
import { newTrialId, saveTrial, type Anchor, type Trial, type TrialResult } from '../lib/trials'
import { AnchorSheet, HeadingReadout, Slider, VerdictButtons, fmt, settleResult } from './trial-ui'
import { usePose } from './usePose'

const DEFAULT_HFOV = 60
const ALIGNED_TOLERANCE_DEG = 10

type Phase = 'idle' | 'starting' | 'live' | 'verdict'

export function PanoScreen({
  spot,
  onBack,
  onDone,
}: {
  spot: Spot
  onBack: () => void
  onDone: (trial: Trial) => void
}) {
  const photo = spot.historical[0]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<PanoScene | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [sensor, setSensor] = useState<SensorStatus>(() => initialSensorStatus())
  const pose = usePose(phase === 'live' && sensor === 'granted')
  const [applyDeclination, setApplyDeclination] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [hfov, setHfov] = useState(DEFAULT_HFOV)
  const [trimDeg, setTrimDeg] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const trialStart = useRef<{ id: string; at: number; iso: string } | null>(null)
  const [pendingResult, setPendingResult] = useState<TrialResult | null>(null)
  const savedRef = useRef(false)

  const target = spot.viewpoint.heading_deg
  const trueHeading = pose.heading === null ? null : applyDeclination ? magneticToTrue(pose.heading) : pose.heading
  const effectiveHeading = normalizeBearing((trueHeading ?? target) + trimDeg)
  const delta = bearingDelta(effectiveHeading, target)
  const hasHeading = trueHeading !== null
  const aligned = hasHeading && Math.abs(delta) <= ALIGNED_TOLERANCE_DEG

  // Scene lifetime = component lifetime. Photos are added once.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new PanoScene(canvas)
    sceneRef.current = scene
    for (const h of spot.historical) {
      scene.addPhoto(
        {
          url: spotImageUrl(spot, h.image.file),
          projection: h.image.projection ?? 'flat',
          headingDeg: h.view?.heading_deg ?? spot.viewpoint.heading_deg,
          pitchDeg: h.view?.pitch_deg ?? spot.viewpoint.pitch_deg ?? 0,
          hfovDeg: h.view?.hfov_deg ?? spot.viewpoint.hfov_deg,
        },
        () => setLoadError(`public/spots/${spot.id}/${h.image.file}`),
      )
    }
    const parent = canvas.parentElement as HTMLElement
    const fit = () => scene.resize(parent.clientWidth, parent.clientHeight)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(parent)
    return () => {
      ro.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
  }, [spot])

  useEffect(() => {
    sceneRef.current?.setView({
      headingDeg: effectiveHeading,
      pitchDeg: pose.pitch ?? 0,
      rollDeg: pose.roll ?? 0,
      hfovDeg: hfov,
    })
  }, [effectiveHeading, pose.pitch, pose.roll, hfov])

  const buildTrial = useCallback(
    (result: TrialResult, anchors: Anchor[]): Trial | null => {
      const s = trialStart.current
      if (!s) return null
      return {
        id: s.id,
        spot_id: spot.id,
        photo_id: photo.id,
        started_at: s.iso,
        ms: Date.now() - s.at,
        result,
        mode: 'pano',
        anchors,
        trim_deg: trimDeg,
        camera_hfov: hfov,
        opacity: 1,
        final_heading_deg: hasHeading ? effectiveHeading : null,
        final_delta_deg: hasHeading ? delta : null,
        sensor,
        ua: navigator.userAgent,
      }
    },
    [spot.id, photo.id, trimDeg, hfov, hasHeading, effectiveHeading, delta, sensor],
  )

  const start = useCallback(async () => {
    setPhase('starting')
    trialStart.current = { id: newTrialId(), at: Date.now(), iso: new Date().toISOString() }
    savedRef.current = false
    setSensor(await requestOrientationPermission())
    setPhase('live')
  }, [])

  const verdict = useCallback((result: TrialResult) => {
    setPendingResult(result)
    setPhase('verdict')
  }, [])

  const finish = useCallback(
    (anchors: Anchor[]) => {
      if (!pendingResult || savedRef.current) return
      const t = buildTrial(settleResult(pendingResult, anchors), anchors)
      if (!t) return
      savedRef.current = true
      saveTrial(t)
      onDone(t)
    },
    [pendingResult, buildTrial, onDone],
  )

  const abandon = useCallback(() => {
    if (trialStart.current && !savedRef.current && phase !== 'verdict') {
      const t = buildTrial('abandon', [])
      if (t) {
        savedRef.current = true
        saveTrial(t)
      }
    }
  }, [phase, buildTrial])

  const back = useCallback(() => {
    abandon()
    onBack()
  }, [abandon, onBack])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === 'live') {
        abandon()
        setPhase('idle')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase, abandon])

  // Drag to look around (no compass, or to trim the compass).
  const drag = useRef<{ x: number; trim: number; w: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== 'live') return
    drag.current = { x: e.clientX, trim: trimDeg, w: e.currentTarget.clientWidth }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const pxPerDeg = d.w / hfov
    setTrimDeg(Math.round(d.trim - (e.clientX - d.x) / pxPerDeg))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <main className="relative h-full overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {/* Centre crosshair: where the phone points. */}
        {phase === 'live' && (
          <span className="pointer-events-none absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
        )}
      </div>

      <header className="absolute inset-x-0 top-0 flex items-center justify-between p-3 text-sm">
        <button type="button" onClick={back} className="rounded bg-black/50 px-3 py-1">← 뒤로</button>
        <span className="rounded bg-black/50 px-3 py-1">
          {photo.title.ko} · {photo.year_precision === 'circa' ? 'ca.' : ''}{photo.year ?? '?'}
        </span>
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          aria-label="센서 디버그"
          className={`rounded px-3 py-1 ${showDebug ? 'bg-amber-400 text-black' : 'bg-black/50'}`}
        >
          ⚙
        </button>
      </header>

      {showDebug && (
        <div className="absolute top-14 left-3 z-10 w-56 space-y-1 rounded bg-black/80 p-2 font-mono text-[11px] leading-tight text-neutral-200">
          <div className="text-neutral-400">파노라마 · 권한 {sensor} · 소스 {pose.source}</div>
          <div>α {fmt(pose.last?.raw.alpha)} β {fmt(pose.last?.raw.beta)} γ {fmt(pose.last?.raw.gamma)}</div>
          <div>자북 {fmt(pose.heading)}° → 진북 {fmt(trueHeading)}° (목표 {target}°)</div>
          <div>pitch {fmt(pose.pitch)}° roll {fmt(pose.roll)}° · 보정 {trimDeg}°</div>
          <button
            type="button"
            onClick={() => setApplyDeclination((v) => !v)}
            className={`mt-1 w-full rounded px-2 py-1 ${applyDeclination ? 'bg-amber-400 text-black' : 'bg-neutral-700'}`}
          >
            편각 −8.5° {applyDeclination ? '적용 중' : '미적용'}
          </button>
        </div>
      )}

      {phase === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center">
          <p className="text-neutral-300">{spot.guide.instruction.ko}</p>
          <p className="text-sm text-neutral-500">
            카메라를 켜지 않습니다. 폰을 창처럼 들고 돌리면 그 방향의 옛 모습이 보입니다.
            사진이 없는 방향은 어둡게 비어 있습니다.
          </p>
          <button type="button" onClick={start} className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-black">
            시작
          </button>
          {sensor === 'unsupported' && (
            <p className="text-sm text-neutral-500">이 기기엔 나침반이 없음. 드래그로 둘러보기만 가능.</p>
          )}
        </div>
      )}

      {phase === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">권한 요청 중…</div>
      )}

      {phase === 'live' && (
        <>
          <div className="absolute inset-x-0 top-14 flex justify-center">
            <HeadingReadout
              heading={hasHeading ? effectiveHeading : null}
              delta={hasHeading ? delta : null}
              aligned={aligned}
              sensor={sensor}
              gotAnyReading={pose.gotAnyReading}
            />
          </div>
          {loadError && (
            <div className="absolute inset-x-4 top-24 rounded bg-black/70 p-3 text-center text-sm">
              사진 파일 없음: <code>{loadError}</code>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/90 to-black/0 p-3 pb-5 text-xs">
            <p className="truncate text-[10px] text-neutral-500">
              {photo.source.org} · {photo.source.archive_id} · {photo.license.type}
            </p>
            <Slider label={`방위 보정 ${trimDeg > 0 ? '+' : ''}${trimDeg}°`} min={-180} max={180} step={1} value={trimDeg} onChange={setTrimDeg} />
            <Slider label={`화각 ${hfov}°`} min={30} max={120} step={1} value={hfov} onChange={setHfov} />
            <VerdictButtons onVerdict={verdict} />
          </div>
        </>
      )}

      {phase === 'verdict' && pendingResult && <AnchorSheet result={pendingResult} onFinish={finish} />}
    </main>
  )
}
