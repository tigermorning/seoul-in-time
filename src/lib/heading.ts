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
  absolute?: boolean
  webkitCompassHeading?: number
}

/** Magnetic compass heading from a device orientation reading, or null if
 *  the reading cannot yield an absolute heading (relative alpha on Android). */
export function magneticHeadingFromReading(r: OrientationReading): number | null {
  if (typeof r.webkitCompassHeading === 'number' && Number.isFinite(r.webkitCompassHeading)) {
    return normalizeBearing(r.webkitCompassHeading)
  }
  if (r.alpha === null || !Number.isFinite(r.alpha)) return null
  // Only trust alpha when the platform says it is absolute; a relative alpha
  // starts at 0 wherever the phone happened to point when the page loaded.
  if (r.absolute === false) return null
  return normalizeBearing(360 - r.alpha)
}

/** Full pipeline: sensor reading → true-north bearing, or null. */
export function trueHeadingFromReading(
  r: OrientationReading,
  declinationDeg = SEOUL_DECLINATION_DEG,
): number | null {
  const m = magneticHeadingFromReading(r)
  return m === null ? null : magneticToTrue(m, declinationDeg)
}
