import { useCallback, useEffect, useRef, useState } from 'react'
import type { Spot } from '../types/spot'
import { bearingDelta, magneticToTrue, normalizeBearing, overlayPlacement } from '../lib/heading'
import {
  initialSensorStatus,
  requestOrientationPermission,
  type CameraPose,
  type HeadingSource,
  type SensorStatus,
} from '../lib/sensors'
import { startRearCamera, stopStream, type CameraError } from '../lib/camera'
import { spotImageUrl } from '../lib/spots'
import { newTrialId, saveTrial, type Anchor, type Trial, type TrialResult } from '../lib/trials'
import { AnchorSheet, HeadingReadout, Slider, VerdictButtons, fmt, settleResult } from './trial-ui'
import { usePose } from './usePose'

// Phones do not expose their camera FOV. 65° is a typical rear-camera value
// in portrait; the user can correct it with the scale slider.
const DEFAULT_CAMERA_HFOV = 65
// Within this many degrees we call it "aligned" and hide the turn arrow.
const ALIGNED_TOLERANCE_DEG = 4

type Phase = 'idle' | 'starting' | 'live' | 'verdict'

export function AlignScreen({
  spot,
  onBack,
  onDone,
}: {
  spot: Spot
  onBack: () => void
  /** Called once per trial after it is saved. */
  onDone: (trial: Trial) => void
}) {
  const photo = spot.historical[0]
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [cameraError, setCameraError] = useState<CameraError | null>(null)
  const [sensor, setSensor] = useState<SensorStatus>(() => initialSensorStatus())
  const pose = usePose(phase === 'live' && sensor === 'granted')
  const { heading, pitch, roll, gotAnyReading, source, last: lastPose } = pose

  // Field-test instrumentation (review #1). Whether iOS's compass value is
  // already true north is unknown; the tester flips this on site and reads
  // which setting puts a north-facing phone at 0°.
  const [showDebug, setShowDebug] = useState(false)
  const [applyDeclination, setApplyDeclination] = useState(true)

  // User-adjustable knobs. They are not written back to the spot file, but
  // they ARE captured on every trial so we learn how far off the sensors were.
  const [trimDeg, setTrimDeg] = useState(0) // manual compass correction, ±45
  const [cameraHfov, setCameraHfov] = useState(DEFAULT_CAMERA_HFOV)
  const [opacity, setOpacity] = useState(0.6)
  const [reveal, setReveal] = useState(50) // slider: % of width showing the old photo
  const [imageMissing, setImageMissing] = useState(false)

  // Trial timing. Starts on the "카메라 켜기" tap, ends on the verdict tap.
  const trialStart = useRef<{ id: string; at: number; iso: string } | null>(null)
  const [pendingResult, setPendingResult] = useState<TrialResult | null>(null)
  const savedRef = useRef(false)

  const target = spot.viewpoint.heading_deg
  const trueHeading = heading === null ? null : applyDeclination ? magneticToTrue(heading) : heading
  const effectiveHeading = trueHeading === null ? null : normalizeBearing(trueHeading + trimDeg)
  const delta = effectiveHeading === null ? null : bearingDelta(effectiveHeading, target)

  const buildTrial = useCallback(
    (result: TrialResult, chosen: Anchor[]): Trial | null => {
      const s = trialStart.current
      if (!s) return null
      return {
        id: s.id,
        spot_id: spot.id,
        photo_id: photo.id,
        started_at: s.iso,
        ms: Date.now() - s.at,
        result,
        mode: 'overlay',
        anchors: chosen,
        trim_deg: trimDeg,
        camera_hfov: cameraHfov,
        opacity,
        final_heading_deg: effectiveHeading,
        final_delta_deg: delta,
        sensor,
        ua: navigator.userAgent,
      }
    },
    [spot.id, photo.id, trimDeg, cameraHfov, opacity, effectiveHeading, delta, sensor],
  )

  const stopCamera = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setPhase('starting')
    trialStart.current = { id: newTrialId(), at: Date.now(), iso: new Date().toISOString() }
    savedRef.current = false
    // Order matters on iOS: both prompts must come from the same tap.
    const s = await requestOrientationPermission()
    setSensor(s)
    const v = videoRef.current
    if (!v) return
    const r = await startRearCamera(v)
    if (typeof r === 'string') {
      setCameraError(r)
      setPhase('idle')
      trialStart.current = null
      return
    }
    streamRef.current = r
    setCameraError(null)
    setPhase('live')
  }, [])

  /** Participant tapped 맞았다 / 못 맞췄다. Camera stops; anchors asked next. */
  const verdict = useCallback(
    (result: TrialResult) => {
      stopCamera()
      setPendingResult(result)
      setPhase('verdict')
    },
    [stopCamera],
  )

  /** Anchor question answered. Persist and hand off. */
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

  /** Leaving mid-trial (back button, tab hidden) is recorded as abandon. */
  const abandon = useCallback(() => {
    if (trialStart.current && !savedRef.current && phase !== 'verdict') {
      const t = buildTrial('abandon', [])
      if (t) {
        savedRef.current = true
        saveTrial(t)
      }
    }
    stopCamera()
  }, [phase, buildTrial, stopCamera])

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

  // Unmount: stop the camera. Abandon bookkeeping is handled by `back`.
  useEffect(() => stopCamera, [stopCamera])

  const frameW = frameRef.current?.clientWidth ?? 0
  // Without a heading the photo stays centred horizontally but still follows
  // pitch and roll, which is what the manual-trim fallback needs.
  const placement = overlayPlacement({
    headingDeg: effectiveHeading ?? target,
    pitchDeg: pitch,
    rollDeg: roll,
    targetHeadingDeg: target,
    targetPitchDeg: spot.viewpoint.pitch_deg ?? 0,
    cameraHfovDeg: cameraHfov,
    frameWidthPx: frameW,
  })
  // eye_height_m is deliberately unused: without a distance to the scene it
  // cannot be turned into a pixel shift. It stays in the data for surveys.
  const overlayScale = spot.viewpoint.hfov_deg / cameraHfov
  const aligned = delta !== null && Math.abs(delta) <= ALIGNED_TOLERANCE_DEG

  return (
    <main className="relative h-full overflow-hidden bg-black text-white">
      <div ref={frameRef} className="absolute inset-0">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

        {phase === 'live' && !imageMissing && (
          <img
            src={spotImageUrl(spot, photo.image.file)}
            alt={photo.title.ko}
            onError={() => setImageMissing(true)}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{
              // Centre, shift by heading/pitch error, counter-rotate the roll,
              // then scale the photo so its field of view matches the camera's.
              transform: `translate(calc(-50% + ${placement.dx}px), calc(-50% + ${placement.dy}px)) rotate(${placement.rotate}deg) scale(${overlayScale})`,
              width: '100%',
              opacity,
              clipPath: `inset(0 ${100 - reveal}% 0 0)`,
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
          {photo.title.ko} · {photo.year ?? '?'}
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
        <DebugPanel
          pose={lastPose}
          source={source}
          sensor={sensor}
          magnetic={heading}
          trueHeading={trueHeading}
          pitch={pitch}
          roll={roll}
          target={target}
          placement={placement}
          applyDeclination={applyDeclination}
          onToggleDeclination={() => setApplyDeclination((v) => !v)}
        />
      )}

      {phase === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center">
          <p className="text-neutral-300">{spot.guide.instruction.ko}</p>
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-black"
          >
            카메라 켜기
          </button>
          {cameraError && <p className="text-sm text-red-400">{describeCameraError(cameraError)}</p>}
          {sensor === 'unsupported' && (
            <p className="text-sm text-neutral-500">이 기기엔 나침반이 없음. 수동 조정만 가능.</p>
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
              heading={effectiveHeading}
              delta={delta}
              aligned={aligned}
              sensor={sensor}
              gotAnyReading={gotAnyReading}
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/90 to-black/0 p-3 pb-5 text-xs">
            <Slider label={`비교 ${reveal}%`} min={0} max={100} step={1} value={reveal} onChange={setReveal} />
            <Slider label={`투명도 ${Math.round(opacity * 100)}%`} min={0.1} max={1} step={0.05} value={opacity} onChange={setOpacity} />
            <Slider label={`방위 보정 ${trimDeg > 0 ? '+' : ''}${trimDeg}°`} min={-45} max={45} step={1} value={trimDeg} onChange={setTrimDeg} />
            <Slider label={`카메라 화각 ${cameraHfov}°`} min={40} max={100} step={1} value={cameraHfov} onChange={setCameraHfov} />
            <VerdictButtons onVerdict={verdict} />
          </div>
        </>
      )}

      {phase === 'verdict' && pendingResult && <AnchorSheet result={pendingResult} onFinish={finish} />}
    </main>
  )
}

/** Raw sensor values and every derived number, so a field test can see
 *  which assumption is wrong instead of guessing. Portrait, top-left. */
function DebugPanel({
  pose,
  source,
  sensor,
  magnetic,
  trueHeading,
  pitch,
  roll,
  target,
  placement,
  applyDeclination,
  onToggleDeclination,
}: {
  pose: CameraPose | null
  source: HeadingSource
  sensor: SensorStatus
  magnetic: number | null
  trueHeading: number | null
  pitch: number | null
  roll: number | null
  target: number
  placement: { dx: number; dy: number; rotate: number }
  applyDeclination: boolean
  onToggleDeclination: () => void
}) {
  const r = pose?.raw
  return (
    <div className="absolute top-14 left-3 z-10 w-56 space-y-1 rounded bg-black/80 p-2 font-mono text-[11px] leading-tight text-neutral-200">
      <div className="text-neutral-400">권한 {sensor} · 소스 {source}</div>
      <div>α {fmt(r?.alpha)} β {fmt(r?.beta)} γ {fmt(r?.gamma)}</div>
      <div>
        abs {String(r?.absolute ?? '—')} · webkit {fmt(r?.webkitCompassHeading)}
      </div>
      <div className="border-t border-neutral-700 pt-1">
        자북 {fmt(magnetic)}° → 진북 {fmt(trueHeading)}° (목표 {target}°)
      </div>
      <div>
        pitch {fmt(pitch)}° roll {fmt(roll)}°
      </div>
      <div>
        dx {fmt(placement.dx, 0)} dy {fmt(placement.dy, 0)} rot {fmt(placement.rotate)}
      </div>
      <button
        type="button"
        onClick={onToggleDeclination}
        className={`mt-1 w-full rounded px-2 py-1 ${applyDeclination ? 'bg-amber-400 text-black' : 'bg-neutral-700'}`}
      >
        편각 −8.5° {applyDeclination ? '적용 중' : '미적용'}
      </button>
      <div className="text-neutral-500">북쪽 보고 진북이 0°인 쪽이 정답</div>
    </div>
  )
}

function describeCameraError(e: CameraError): string {
  switch (e) {
    case 'insecure-context':
      return 'https가 아니라 카메라를 열 수 없음. npm run dev:https 또는 배포 URL로 접속.'
    case 'unsupported':
      return '이 브라우저는 카메라 API 미지원.'
    case 'denied':
      return '카메라 권한 거부됨. 브라우저 설정에서 허용 후 다시 시도.'
    case 'unavailable':
      return '카메라를 열 수 없음 (다른 앱이 사용 중일 수 있음).'
  }
}
