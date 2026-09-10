// 안 C — "창" 모드 (BENCHMARK_CITY_IN_TIME.md §7.3).
//
// No camera. The screen is a window into the past: the historical photo is
// pinned to its true-north bearing and slides across the screen as the phone
// turns, exactly like City in Time's DeviceOrientationCamera but with one
// photo instead of a 360° panorama. The comparison with the present happens
// when the user looks up from the phone, not on the screen.
//
// What this removes versus AlignScreen: getUserMedia, the camera-FOV guess,
// object-cover cropping, and the iOS two-permission tap. What it keeps: the
// same compass math, the same trial recording, the same verdict questions.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Spot } from '../types/spot'
import { bearingDelta, magneticToTrue, normalizeBearing, overlayPlacement } from '../lib/heading'
import { initialSensorStatus, requestOrientationPermission, type SensorStatus } from '../lib/sensors'
import { spotImageUrl } from '../lib/spots'
import { newTrialId, saveTrial, type Anchor, type Trial, type TrialResult } from '../lib/trials'
import { AnchorSheet, HeadingReadout, Slider, VerdictButtons, fmt, settleResult } from './trial-ui'
import { usePose } from './usePose'

// How many degrees of the world the screen width represents. Not a camera
// property — it is a zoom the viewer picks. 60° ≈ a phone's own camera, so
// the photo appears at roughly the size the scene has to the naked eye.
const DEFAULT_WINDOW_HFOV = 60
// Looser than AlignScreen's 4°: there is no live image to check against, so
// the badge only says "you are facing the right way", within compass noise.
const ALIGNED_TOLERANCE_DEG = 10

type Phase = 'idle' | 'starting' | 'live' | 'verdict'

const CARDINALS: { deg: number; label: string }[] = [
  { deg: 0, label: 'N' },
  { deg: 90, label: 'E' },
  { deg: 180, label: 'S' },
  { deg: 270, label: 'W' },
]

export function WindowScreen({
  spot,
  onBack,
  onDone,
}: {
  spot: Spot
  onBack: () => void
  onDone: (trial: Trial) => void
}) {
  const photo = spot.historical[0]
  const frameRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [sensor, setSensor] = useState<SensorStatus>(() => initialSensorStatus())
  const pose = usePose(phase === 'live' && sensor === 'granted')
  const [applyDeclination, setApplyDeclination] = useState(true)
  const [showDebug, setShowDebug] = useState(false)

  const [windowHfov, setWindowHfov] = useState(DEFAULT_WINDOW_HFOV)
  // Manual heading correction. With a compass it trims the sensor; without
  // one it IS the heading (drag to look around, City in Time's FreeCamera).
  const [trimDeg, setTrimDeg] = useState(0)
  const [imageMissing, setImageMissing] = useState(false)
  const [frameW, setFrameW] = useState(0)

  const trialStart = useRef<{ id: string; at: number; iso: string } | null>(null)
  const [pendingResult, setPendingResult] = useState<TrialResult | null>(null)
  const savedRef = useRef(false)

  const target = spot.viewpoint.heading_deg
  const trueHeading = pose.heading === null ? null : applyDeclination ? magneticToTrue(pose.heading) : pose.heading
  // No compass → start facing the target so the photo is on screen, and let
  // the drag/slider move the view from there.
  const effectiveHeading = normalizeBearing((trueHeading ?? target) + trimDeg)
  const delta = bearingDelta(effectiveHeading, target)
  const hasHeading = trueHeading !== null

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => setFrameW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pxPerDeg = frameW / windowHfov
  const placement = overlayPlacement({
    headingDeg: effectiveHeading,
    pitchDeg: pose.pitch,
    rollDeg: pose.roll,
    targetHeadingDeg: target,
    targetPitchDeg: spot.viewpoint.pitch_deg ?? 0,
    cameraHfovDeg: windowHfov,
    frameWidthPx: frameW,
  })
  const photoWidthPx = spot.viewpoint.hfov_deg * pxPerDeg
  // Where pitch 0° sits on screen: the horizon of the virtual world.
  const horizonDy = pose.pitch === null ? 0 : pose.pitch * pxPerDeg
  const aligned = hasHeading && Math.abs(delta) <= ALIGNED_TOLERANCE_DEG

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
        mode: 'window',
        anchors,
        trim_deg: trimDeg,
        camera_hfov: windowHfov,
        opacity: 1,
        final_heading_deg: hasHeading ? effectiveHeading : null,
        final_delta_deg: hasHeading ? delta : null,
        sensor,
        ua: navigator.userAgent,
      }
    },
    [spot.id, photo.id, trimDeg, windowHfov, hasHeading, effectiveHeading, delta, sensor],
  )

  const start = useCallback(async () => {
    setPhase('starting')
    trialStart.current = { id: newTrialId(), at: Date.now(), iso: new Date().toISOString() }
    savedRef.current = false
    // One permission, one tap. Nothing else to wait for.
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

  // Drag to look around. Dragging the photo right means the world moved
  // right, i.e. the viewer turned left, so the heading decreases.
  const drag = useRef<{ x: number; trim: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== 'live') return
    drag.current = { x: e.clientX, trim: trimDeg }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || pxPerDeg === 0) return
    setTrimDeg(Math.round(drag.current.trim - (e.clientX - drag.current.x) / pxPerDeg))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <main className="relative h-full overflow-hidden bg-black text-white">
      <div
        ref={frameRef}
        className="absolute inset-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Sky / ground so the phone's tilt reads as a world, not a blank. */}
        <div
          className="absolute inset-x-0 h-[200%]"
          style={{
            top: `calc(50% - 100% + ${horizonDy}px)`,
            background: 'linear-gradient(to bottom, #1a2233 0%, #2b3548 50%, #14110d 50%, #0a0a0a 100%)',
            transform: `rotate(${placement.rotate}deg)`,
            transition: 'transform 80ms linear, top 80ms linear',
          }}
        />

        {phase === 'live' && <CompassStrip heading={effectiveHeading} target={target} pxPerDeg={pxPerDeg} />}

        {phase === 'live' && !imageMissing && frameW > 0 && (
          <img
            src={spotImageUrl(spot, photo.image.file)}
            alt={photo.title.ko}
            draggable={false}
            onError={() => setImageMissing(true)}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none shadow-2xl"
            style={{
              width: `${photoWidthPx}px`,
              transform: `translate(calc(-50% + ${placement.dx}px), calc(-50% + ${placement.dy}px)) rotate(${placement.rotate}deg)`,
              transition: 'transform 80ms linear',
            }}
          />
        )}

        {phase === 'live' && imageMissing && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded bg-black/70 p-3 text-center text-sm">
            사진 파일 없음: <code>public/spots/{spot.id}/{photo.image.file}</code>
          </div>
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
          <div className="text-neutral-400">창 모드 · 권한 {sensor} · 소스 {pose.source}</div>
          <div>α {fmt(pose.last?.raw.alpha)} β {fmt(pose.last?.raw.beta)} γ {fmt(pose.last?.raw.gamma)}</div>
          <div>자북 {fmt(pose.heading)}° → 진북 {fmt(trueHeading)}° (목표 {target}°)</div>
          <div>pitch {fmt(pose.pitch)}° roll {fmt(pose.roll)}°</div>
          <div>dx {fmt(placement.dx, 0)} dy {fmt(placement.dy, 0)} · {fmt(pxPerDeg, 1)} px/°</div>
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
            카메라를 켜지 않습니다. 화면에는 옛 사진만 뜨고, 폰을 돌리면 사진이 그 방향에 머뭅니다.
            사진이 가운데 오면 폰에서 눈을 떼고 실제 풍경과 비교하세요.
          </p>
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-black"
          >
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

          <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/90 to-black/0 p-3 pb-5 text-xs">
            <p className="truncate text-[10px] text-neutral-500">
              {photo.source.org} · {photo.source.archive_id} · {photo.license.type}
            </p>
            <Slider label={`방위 보정 ${trimDeg > 0 ? '+' : ''}${trimDeg}°`} min={-180} max={180} step={1} value={trimDeg} onChange={setTrimDeg} />
            <Slider label={`창 화각 ${windowHfov}°`} min={30} max={120} step={1} value={windowHfov} onChange={setWindowHfov} />
            <VerdictButtons onVerdict={verdict} />
          </div>
        </>
      )}

      {phase === 'verdict' && pendingResult && <AnchorSheet result={pendingResult} onFinish={finish} />}
    </main>
  )
}

/** Cardinal letters and the target tick, sliding with the heading so the
 *  user sees which way to turn even when the photo is off screen. */
function CompassStrip({ heading, target, pxPerDeg }: { heading: number; target: number; pxPerDeg: number }) {
  const ticks = [...CARDINALS.map((c) => ({ ...c, isTarget: false })), { deg: target, label: '◆', isTarget: true }]
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 h-6">
      {ticks.map((t) => {
        const dx = bearingDelta(heading, t.deg) * pxPerDeg
        return (
          <span
            key={`${t.label}-${t.deg}`}
            className={`absolute top-0 -translate-x-1/2 text-xs ${t.isTarget ? 'text-amber-400' : 'text-neutral-400'}`}
            style={{ left: `calc(50% + ${dx}px)` }}
          >
            {t.label}
          </span>
        )
      })}
      <span className="absolute top-0 left-1/2 h-full w-px bg-white/40" />
    </div>
  )
}
