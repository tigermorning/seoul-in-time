import { describe, expect, it } from 'vitest'
import {
  bearingDelta,
  cameraOrientationFromEuler,
  magneticHeadingFromReading,
  magneticToTrue,
  normalizeBearing,
  overlayOffsetPx,
  overlayPlacement,
  pitchRollFromReading,
  smoothBearing,
  smoothLinear,
  trueHeadingFromReading,
} from './heading'

describe('smoothBearing', () => {
  it('starts at the first sample', () => {
    expect(smoothBearing(null, 42)).toBe(42)
  })
  it('moves a fraction of the way toward the next sample', () => {
    expect(smoothBearing(0, 40, 0.25)).toBe(10)
  })
  it('does not spin the long way around the wrap', () => {
    // 350 → 10 is a 20° clockwise turn, so one step at 0.5 lands on 0, not 180.
    expect(smoothBearing(350, 10, 0.5)).toBe(0)
  })
})

describe('overlayPlacement', () => {
  const base = { targetHeadingDeg: 0, targetPitchDeg: 0, cameraHfovDeg: 60, frameWidthPx: 600 }
  it('is identity when the camera matches the photo', () => {
    expect(overlayPlacement({ ...base, headingDeg: 0, pitchDeg: 0, rollDeg: 0 })).toEqual({ dx: 0, dy: 0, rotate: 0 })
  })
  it('moves the photo down when the camera tilts up past the photo pitch', () => {
    // 10 px/deg; camera 5° above a photo taken level → 50 px down.
    expect(overlayPlacement({ ...base, headingDeg: 0, pitchDeg: 5, rollDeg: 0 }).dy).toBe(50)
    // Photo taken looking 5° down (pitch -5) with a level camera → photo sits 50 px down too.
    expect(overlayPlacement({ ...base, targetPitchDeg: -5, headingDeg: 0, pitchDeg: 0, rollDeg: 0 }).dy).toBe(50)
  })
  it('counter-rotates the phone roll', () => {
    expect(overlayPlacement({ ...base, headingDeg: 0, pitchDeg: 0, rollDeg: 7 }).rotate).toBe(-7)
  })
  it('leaves dy and rotate at 0 when pitch/roll are unknown', () => {
    const p = overlayPlacement({ ...base, headingDeg: 10, pitchDeg: null, rollDeg: null })
    expect(p).toEqual({ dx: -100, dy: 0, rotate: 0 })
  })
})

describe('smoothLinear', () => {
  it('starts at the first sample and moves a fraction toward the next', () => {
    expect(smoothLinear(null, 8)).toBe(8)
    expect(smoothLinear(0, 8, 0.25)).toBe(2)
  })
})

describe('overlayOffsetPx', () => {
  it('is zero when aligned', () => {
    expect(overlayOffsetPx(90, 90, 60, 600)).toBe(0)
  })
  it('shifts the overlay right when the target is to the right', () => {
    // 10° right of centre at 10 px/deg
    expect(overlayOffsetPx(90, 100, 60, 600)).toBe(100)
    expect(overlayOffsetPx(355, 5, 60, 600)).toBe(100)
  })
})

describe('normalizeBearing', () => {
  it('wraps into [0, 360)', () => {
    expect(normalizeBearing(0)).toBe(0)
    expect(normalizeBearing(360)).toBe(0)
    expect(normalizeBearing(-1)).toBe(359)
    expect(normalizeBearing(725)).toBe(5)
  })
})

describe('bearingDelta', () => {
  it('returns the shortest signed turn', () => {
    expect(bearingDelta(10, 20)).toBe(10)
    expect(bearingDelta(20, 10)).toBe(-10)
    expect(bearingDelta(350, 10)).toBe(20)
    expect(bearingDelta(10, 350)).toBe(-20)
  })
  it('treats a 180° turn as +180', () => {
    expect(bearingDelta(0, 180)).toBe(180)
    expect(bearingDelta(90, 270)).toBe(180)
  })
})

describe('magneticToTrue', () => {
  it('applies a westerly declination by subtracting', () => {
    // Magnetic north is 8.5° west of true north, so a phone pointing at
    // magnetic north is actually pointing 8.5° west of true north.
    expect(magneticToTrue(0, -8.5)).toBeCloseTo(351.5)
    expect(magneticToTrue(90, -8.5)).toBeCloseTo(81.5)
  })
})

describe('cameraOrientationFromEuler', () => {
  // Phone upright in portrait, screen toward the user, camera looking north.
  it('upright, facing north: heading 0, pitch 0, roll 0', () => {
    const o = cameraOrientationFromEuler(0, 90, 0)
    expect(o.heading).toBeCloseTo(0)
    expect(o.pitch).toBeCloseTo(0)
    expect(o.roll).toBeCloseTo(0)
  })
  it('upright, alpha=90 (device turned counter-clockwise): camera looks west (270)', () => {
    expect(cameraOrientationFromEuler(90, 90, 0).heading).toBeCloseTo(270)
  })
  it('upright, gamma turns the camera too — the degenerate case 360-alpha gets wrong', () => {
    // At beta=90 a gamma rotation is a yaw. gamma=+30 swings the camera
    // 30° to the left (west of north).
    expect(cameraOrientationFromEuler(0, 90, 30).heading).toBeCloseTo(330)
    // alpha and gamma combine: alpha=90 then gamma=30 → 240.
    expect(cameraOrientationFromEuler(90, 90, 30).heading).toBeCloseTo(240)
  })
  it('tilting the phone back (beta > 90) points the camera up', () => {
    expect(cameraOrientationFromEuler(0, 100, 0).pitch).toBeCloseTo(10)
    expect(cameraOrientationFromEuler(0, 80, 0).pitch).toBeCloseTo(-10)
  })
  it('flat on a table: camera looks straight down, no heading', () => {
    const o = cameraOrientationFromEuler(0, 0, 0)
    expect(o.heading).toBeNull()
    expect(o.pitch).toBeCloseTo(-90)
  })
  it('flat, gamma=30 rolls the device X axis 30° below the horizon', () => {
    // With beta=0 the device X axis is horizontal and gamma rotates it about
    // Y; the X axis dips by gamma.
    expect(cameraOrientationFromEuler(0, 0, 30).roll).toBeCloseTo(-30)
  })
  it('heading is periodic in alpha and unaffected by full-turn wraps', () => {
    expect(cameraOrientationFromEuler(360, 90, 0).heading).toBeCloseTo(0)
    expect(cameraOrientationFromEuler(-90, 90, 0).heading).toBeCloseTo(90)
  })
})

describe('pitchRollFromReading', () => {
  it('works without alpha (iOS gives a relative alpha)', () => {
    expect(pitchRollFromReading({ alpha: null, beta: 100, gamma: 0 })?.pitch).toBeCloseTo(10)
  })
  it('returns null when beta/gamma are missing', () => {
    expect(pitchRollFromReading({ alpha: 10 })).toBeNull()
  })
})

describe('magneticHeadingFromReading', () => {
  it('prefers webkitCompassHeading (iOS) and reads it as-is', () => {
    expect(magneticHeadingFromReading({ alpha: 123, webkitCompassHeading: 45 })).toBe(45)
  })
  it('uses the full rotation when beta/gamma are present', () => {
    expect(magneticHeadingFromReading({ alpha: 0, beta: 90, gamma: 30, absolute: true })).toBeCloseTo(330)
  })
  it('falls back to 360-alpha without beta/gamma (Android, flat approximation)', () => {
    expect(magneticHeadingFromReading({ alpha: 90, absolute: true })).toBe(270)
    expect(magneticHeadingFromReading({ alpha: 0, absolute: true })).toBe(0)
  })
  it('refuses a relative alpha', () => {
    expect(magneticHeadingFromReading({ alpha: 90, absolute: false })).toBeNull()
  })
  it('refuses a null alpha without iOS heading', () => {
    expect(magneticHeadingFromReading({ alpha: null })).toBeNull()
  })
})

describe('trueHeadingFromReading', () => {
  it('chains sensor → magnetic → true', () => {
    expect(trueHeadingFromReading({ alpha: null, webkitCompassHeading: 10 }, -8.5)).toBeCloseTo(1.5)
    expect(trueHeadingFromReading({ alpha: 350, absolute: true }, -8.5)).toBeCloseTo(1.5)
  })
})
