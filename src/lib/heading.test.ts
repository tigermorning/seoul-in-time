import { describe, expect, it } from 'vitest'
import {
  bearingDelta,
  magneticHeadingFromReading,
  magneticToTrue,
  normalizeBearing,
  trueHeadingFromReading,
} from './heading'

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

describe('magneticHeadingFromReading', () => {
  it('prefers webkitCompassHeading (iOS) and reads it as-is', () => {
    expect(magneticHeadingFromReading({ alpha: 123, webkitCompassHeading: 45 })).toBe(45)
  })
  it('inverts absolute alpha (Android): alpha=90 is 270° clockwise', () => {
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
