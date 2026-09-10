// Compass math. Pure functions so they can be unit-tested without a device.
//
// Conventions used throughout the app:
//   - Bearings are degrees clockwise from north, in [0, 360).
//   - Spot data stores TRUE-north bearings (see SPOT_SCHEMA.md).
//   - Device sensors report MAGNETIC north; we convert with a declination.

/** Magnetic declination for Seoul, degrees. Negative = magnetic north lies
 *  west of true north. ~8.5° W as of the mid-2020s; drifts ~0.1°/yr.
 *  Good enough for MVP given ±15° compass noise. */
export const SEOUL_DECLINATION_DEG = -8.5

/** Wrap any angle into [0, 360). */
export function normalizeBearing(deg: number): number {
  const r = deg % 360
  return r < 0 ? r + 360 : r
}

/** Signed shortest rotation from `from` to `to`, in (-180, 180].
 *  Positive = turn clockwise (right). */
export function bearingDelta(from: number, to: number): number {
  let d = normalizeBearing(to) - normalizeBearing(from)
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/** Convert a magnetic bearing to a true bearing. */
export function magneticToTrue(
  magneticDeg: number,
  declinationDeg = SEOUL_DECLINATION_DEG,
): number {
  return normalizeBearing(magneticDeg + declinationDeg)
}

/** Minimal shape of the orientation event fields we read. iOS Safari adds
 *  webkitCompassHeading (clockwise from magnetic north). Android Chrome
 *  gives `alpha` on `deviceorientationabsolute`, which rotates the other
 *  way: alpha=0 is north and alpha increases counter-clockwise. */
export interface OrientationReading {
  alpha: number | null
  beta?: number | null
  gamma?: number | null
  absolute?: boolean
  webkitCompassHeading?: number
}

const DEG = Math.PI / 180

/** Where the rear camera points and how the phone is rolled, derived from
 *  the full W3C Euler triple (Z-X'-Y'' intrinsic: alpha about Z, then beta
 *  about X', then gamma about Y''). Working from the rotation matrix instead
 *  of `alpha` alone matters because the phone is held upright for this app
 *  (beta ≈ 90°), which is exactly where alpha and gamma stop being separable
 *  and `360 - alpha` turns to noise.
 *
 *  Earth frame per the spec: X east, Y north, Z up. The rear camera looks
 *  along the device's -Z axis.
 *
 *  Returns heading in [0, 360) clockwise from (magnetic) north, or null when
 *  the camera points nearly straight up/down so no heading exists; pitch in
 *  degrees above (+) / below (-) the horizon; roll in degrees, positive when
 *  the top of the phone leans right. Roll is relative to the device's own
 *  X axis, so add the screen rotation angle for a landscape UI (this app
 *  locks portrait). */
export function cameraOrientationFromEuler(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): { heading: number | null; pitch: number; roll: number } {
  const cA = Math.cos(alphaDeg * DEG)
  const sA = Math.sin(alphaDeg * DEG)
  const cB = Math.cos(betaDeg * DEG)
  const sB = Math.sin(betaDeg * DEG)
  const cG = Math.cos(gammaDeg * DEG)
  const sG = Math.sin(gammaDeg * DEG)

  // Third column of R = Rz(alpha)·Rx(beta)·Ry(gamma): the device +Z axis in
  // Earth coordinates. The camera axis is its negation.
  const vx = -(cA * sG + sA * sB * cG)
  const vy = -(sA * sG - cA * sB * cG)
  const vz = -(cB * cG)

  const horizontal = Math.hypot(vx, vy)
  const heading = horizontal < 0.1 ? null : normalizeBearing(Math.atan2(vx, vy) / DEG)
  const pitch = Math.atan2(vz, horizontal) / DEG

  // First column of R: the device +X axis in Earth coordinates. Its rise
  // above the horizon is the roll of the screen.
  const xz = -cB * sG
  const roll = Math.asin(Math.max(-1, Math.min(1, xz))) / DEG

  return { heading, pitch, roll }
}

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Magnetic compass heading from a device orientation reading, or null if
 *  the reading cannot yield an absolute heading (relative alpha on Android,
 *  or camera pointing straight up/down). */
export function magneticHeadingFromReading(r: OrientationReading): number | null {
  if (finite(r.webkitCompassHeading)) {
    return normalizeBearing(r.webkitCompassHeading)
  }
  if (!finite(r.alpha)) return null
  // Only trust alpha when the platform says it is absolute; a relative alpha
  // starts at 0 wherever the phone happened to point when the page loaded.
  if (r.absolute === false) return null
  if (finite(r.beta) && finite(r.gamma)) {
    return cameraOrientationFromEuler(r.alpha, r.beta, r.gamma).heading
  }
  // No beta/gamma: fall back to the flat-phone approximation.
  return normalizeBearing(360 - r.alpha)
}

/** Pitch and roll of the camera axis, or null when beta/gamma are missing.
 *  Independent of alpha, so this works on iOS too (where alpha is relative). */
export function pitchRollFromReading(r: OrientationReading): { pitch: number; roll: number } | null {
  if (!finite(r.beta) || !finite(r.gamma)) return null
  const { pitch, roll } = cameraOrientationFromEuler(0, r.beta, r.gamma)
  return { pitch, roll }
}

/** Exponential smoothing that respects the 359→0 wrap. `alpha` in (0, 1]:
 *  1 = no smoothing. Returns the new smoothed bearing. */
export function smoothBearing(prev: number | null, next: number, alpha = 0.25): number {
  if (prev === null) return normalizeBearing(next)
  return normalizeBearing(prev + alpha * bearingDelta(prev, next))
}

/** Horizontal pixel offset to draw an overlay whose centre should sit at
 *  `targetDeg` when the camera currently points at `currentDeg`, given the
 *  camera's horizontal field of view across `frameWidthPx`. Positive = the
 *  target is to the right of centre. */
export function overlayOffsetPx(
  currentDeg: number,
  targetDeg: number,
  cameraHfovDeg: number,
  frameWidthPx: number,
): number {
  const pxPerDeg = frameWidthPx / cameraHfovDeg
  return bearingDelta(currentDeg, targetDeg) * pxPerDeg
}

/** Full pipeline: sensor reading → true-north bearing, or null. */
export function trueHeadingFromReading(
  r: OrientationReading,
  declinationDeg = SEOUL_DECLINATION_DEG,
): number | null {
  const m = magneticHeadingFromReading(r)
  return m === null ? null : magneticToTrue(m, declinationDeg)
}
