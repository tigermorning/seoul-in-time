import { useCallback, useEffect, useRef, useState } from 'react'
import type { Spot } from '../types/spot'
import { bearingDelta, normalizeBearing, overlayPlacement, smoothBearing, smoothLinear } from '../lib/heading'
import { initialSensorStatus, requestOrientationPermission, subscribeCameraPose, type SensorStatus } from '../lib/sensors'
import { startRearCamera, stopStream, type CameraError } from '../lib/camera'
import { spotImageUrl } from '../lib/spots'
import { newTrialId, saveTrial, type Anchor, type Trial, type TrialResult } from '../lib/trials'

// Phones do not expose their camera FOV. 65° is a typical rear-camera value
// in portrait; the user can correct it with the scale slider.
const DEFAULT_CAMERA_HFOV = 65
// Within this many degrees we call it "aligned" and hide the turn arrow.
const ALIGNED_TOLERANCE_DEG = 4

type Phase = 'idle' | 'starting' | 'live' | 'verdict'

const ANCHOR_OPTIONS: { key: Anchor; label: string }[] = [
  { key: 'ridge', label: '산 능선' },
  { key: 'road', label: '도로·길' },
  { key: 'building', label: '건물 윤곽' },
  { key: 'water', label: '물길·다리' },
  { key: 'other', label: '기타' },
  { key: 'unsure', label: '모르겠음' },
]

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
  const [heading, setHeading] = useState<number | null>(null) // smoothed true heading
  const [pitch, setPitch] = useState<number | null>(null) // smoothed, deg above horizon
  const [roll, setRoll] = useState<number | null>(null) // smoothed, deg
  const [gotAnyReading, setGotAnyReading] = useState(false)

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
  const [anchors, setAnchors] = useState<Anchor[]>([])
  const savedRef = useRef(false)

  const target = spot.viewpoint.heading_deg
  const effectiveHeading = heading === null ? null : normalizeBearing(heading + trimDeg)
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
      setAnchors([])
      setPhase('verdict')
    },
    [stopCamera],
  )

  /** Anchor question answered. Persist and hand off. */
  const finish = useCallback(() => {
    if (!pendingResult || savedRef.current) return
    // A "success" backed only by "모르겠음" is not a success (TEST_PROTOCOL §2).
    const onlyUnsure = anchors.length > 0 && anchors.every((a) => a === 'unsure')
    const result: TrialResult = pendingResult === 'success' && (anchors.length === 0 || onlyUnsure) ? 'fail' : pendingResult
    const t = buildTrial(result, anchors)
    if (!t) return
    savedRef.current = true
    saveTrial(t)
    onDone(t)
  }, [pendingResult, anchors, buildTrial, onDone])

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
    if (phase !== 'live' || sensor !== 'granted') return
    let sHeading: number | null = null
    let sPitch: number | null = null
    let sRoll: number | null = null
    const unsub = subscribeCameraPose((pose) => {
      // Pitch/roll arrive even when the heading is untrustworthy (iOS relative
      // alpha, or camera pointing at the sky), so update them independently.
      if (pose.pitch !== null) {
        sPitch = smoothLinear(sPitch, pose.pitch)
        setPitch(sPitch)
      }
      if (pose.roll !== null) {
        sRoll = smoothLinear(sRoll, pose.roll)
        setRoll(sRoll)
      }
      if (pose.heading === null) return
      setGotAnyReading(true)
      sHeading = smoothBearing(sHeading, pose.heading)
      setHeading(sHeading)
    })
    return unsub
  }, [phase, sensor])

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
      </header>

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
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => verdict('fail')}
                className="flex-1 rounded-lg bg-neutral-700 py-3 text-base font-semibold"
              >
                못 맞췄다
              </button>
              <button
                type="button"
                onClick={() => verdict('success')}
                className="flex-1 rounded-lg bg-amber-400 py-3 text-base font-semibold text-black"
              >
                맞았다
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'verdict' && (
        <div className="absolute inset-0 flex flex-col justify-center gap-4 bg-black/90 p-6">
          <h2 className="text-lg font-semibold">
            {pendingResult === 'success' ? '무엇이 겹쳐 보였나요?' : '무엇을 맞추려고 했나요?'}
          </h2>
          <p className="text-sm text-neutral-400">해당하는 것 모두 선택</p>
          <div className="flex flex-wrap gap-2">
            {ANCHOR_OPTIONS.map((o) => {
              const on = anchors.includes(o.key)
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() =>
                    setAnchors((prev) => (on ? prev.filter((a) => a !== o.key) : [...prev, o.key]))
                  }
                  className={`rounded-full px-4 py-2 text-sm ${on ? 'bg-amber-400 text-black' : 'bg-neutral-800'}`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={finish}
            disabled={anchors.length === 0}
            className="mt-4 rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40"
          >
            기록하고 계속
          </button>
        </div>
      )}
    </main>
  )
}

function HeadingReadout({
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

function Slider({
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
