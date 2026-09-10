// Browser sensor plumbing for the compass. Everything that touches window /
// DeviceOrientationEvent lives here; the math lives in heading.ts.
import { pitchRollFromReading, trueHeadingFromReading, type OrientationReading } from './heading'

export type SensorStatus =
  | 'unsupported' // no DeviceOrientationEvent at all
  | 'needs-permission' // iOS 13+: must call requestPermission from a user gesture
  | 'denied'
  | 'granted'

interface IOSOrientationEventCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function orientationCtor(): IOSOrientationEventCtor | null {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return null
  return window.DeviceOrientationEvent as unknown as IOSOrientationEventCtor
}

/** What we know before asking. iOS reports 'needs-permission'; everything
 *  else that has the API is treated as granted (Android prompts nothing). */
export function initialSensorStatus(): SensorStatus {
  const ctor = orientationCtor()
  if (!ctor) return 'unsupported'
  return typeof ctor.requestPermission === 'function' ? 'needs-permission' : 'granted'
}

/** Must be called inside a click/tap handler on iOS or it silently fails. */
export async function requestOrientationPermission(): Promise<SensorStatus> {
  const ctor = orientationCtor()
  if (!ctor) return 'unsupported'
  if (typeof ctor.requestPermission !== 'function') return 'granted'
  try {
    const r = await ctor.requestPermission()
    return r === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

export interface CameraPose {
  /** True-north heading of the camera axis, or null when untrustworthy. */
  heading: number | null
  /** Degrees above (+) / below (-) the horizon, or null without beta/gamma. */
  pitch: number | null
  /** Screen roll in degrees, positive = top of phone leans right. */
  roll: number | null
}

/** Subscribe to the camera's pose. Returns an unsubscribe function. */
export function subscribeCameraPose(onPose: (pose: CameraPose) => void): () => void {
  const handler = (e: DeviceOrientationEvent) => {
    const r: OrientationReading = {
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute: e.absolute,
      webkitCompassHeading: (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading,
    }
    const pr = pitchRollFromReading(r)
    onPose({ heading: trueHeadingFromReading(r), pitch: pr?.pitch ?? null, roll: pr?.roll ?? null })
  }
  // Android Chrome fires 'deviceorientationabsolute' with absolute=true and
  // plain 'deviceorientation' with relative alpha. iOS only has the latter but
  // carries webkitCompassHeading on it. Listening to both is safe: the reading
  // converter refuses relative alpha, so Android's relative events yield null
  // and the absolute ones win.
  window.addEventListener('deviceorientationabsolute', handler as EventListener)
  window.addEventListener('deviceorientation', handler)
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler as EventListener)
    window.removeEventListener('deviceorientation', handler)
  }
}
