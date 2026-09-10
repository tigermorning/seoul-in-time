import { describe, expect, it } from 'vitest'
import { median, summarize, summarizeByMode, type Trial } from './trials'

function trial(result: Trial['result'], ms: number, mode?: Trial['mode']): Trial {
  return {
    id: 't',
    spot_id: 's',
    photo_id: 'p',
    started_at: '2026-09-10T00:00:00Z',
    ms,
    result,
    mode,
    anchors: [],
    trim_deg: 0,
    camera_hfov: 65,
    opacity: 0.6,
    final_heading_deg: null,
    final_delta_deg: null,
    sensor: 'granted',
    ua: '',
  }
}

describe('median', () => {
  it('handles empty, odd and even lengths', () => {
    expect(median([])).toBeNull()
    expect(median([5])).toBe(5)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('summarize', () => {
  it('returns nulls for no trials', () => {
    expect(summarize([])).toEqual({ n: 0, successes: 0, successRate: null, medianSuccessMs: null })
  })
  it('counts abandons as failures and takes the median over successes only', () => {
    const s = summarize([
      trial('success', 10_000),
      trial('success', 40_000),
      trial('fail', 90_000),
      trial('abandon', 5_000),
      trial('success', 20_000),
    ])
    expect(s.n).toBe(5)
    expect(s.successes).toBe(3)
    expect(s.successRate).toBeCloseTo(0.6)
    expect(s.medianSuccessMs).toBe(20_000)
  })
})

describe('summarizeByMode', () => {
  it('treats trials without a mode as overlay and splits the rest', () => {
    const by = summarizeByMode([
      trial('success', 10_000), // legacy record, no mode
      trial('fail', 20_000, 'overlay'),
      trial('success', 5_000, 'window'),
      trial('success', 15_000, 'window'),
    ])
    expect(by.overlay.n).toBe(2)
    expect(by.overlay.successRate).toBeCloseTo(0.5)
    expect(by.window.n).toBe(2)
    expect(by.window.successRate).toBe(1)
    expect(by.window.medianSuccessMs).toBe(10_000)
  })
})
