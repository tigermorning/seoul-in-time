// Field-test measurement. This is what turns "정렬 성공률 70% · 중앙값 30초"
// (PRD §6, MVP §5.4) from a sentence into numbers.
//
// A Trial is one attempt by one person at one spot: from the tap that opens
// the camera to the tap that says whether the photo lined up. Trials live in
// localStorage on the tester's phone and are exported as JSON afterwards.
// No backend, no analytics SDK — the MVP excludes both on purpose.
import type { SensorStatus } from './sensors'

export type TrialResult = 'success' | 'fail' | 'abandon'

/** Which alignment method the trial used (BENCHMARK_CITY_IN_TIME.md §7.3).
 *  'overlay' = live camera with the photo on top (안 A).
 *  'pano'    = no camera; photos on a sphere you look around in (안 B).
 *  'window'  = no camera; only the photo, glued to the compass (안 C).
 *  Missing on trials recorded before this field existed → overlay. */
export type TrialMode = 'overlay' | 'pano' | 'window'

/** What the participant says lined up. Tells us which anchors work. */
export type Anchor = 'ridge' | 'road' | 'building' | 'water' | 'other' | 'unsure'

export interface Trial {
  id: string
  spot_id: string
  photo_id: string
  started_at: string // ISO
  ms: number // start → verdict
  result: TrialResult
  mode?: TrialMode
  anchors: Anchor[]
  trim_deg: number
  camera_hfov: number
  opacity: number
  final_heading_deg: number | null
  final_delta_deg: number | null
  sensor: SensorStatus
  ua: string
  note?: string
}

export const TRIALS_KEY = 'sit.trials.v1'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadTrials(): Trial[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(TRIALS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as Trial[]) : []
  } catch {
    return []
  }
}

export function saveTrial(trial: Trial): Trial[] {
  const all = [...loadTrials(), trial]
  storage()?.setItem(TRIALS_KEY, JSON.stringify(all))
  return all
}

export function clearTrials() {
  storage()?.removeItem(TRIALS_KEY)
}

export function newTrialId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface TrialSummary {
  n: number
  successes: number
  /** successes / n, or null when n is 0. Abandons count as failures. */
  successRate: number | null
  /** Median time to verdict over successful trials only, ms. */
  medianSuccessMs: number | null
}

/** Pure. The Phase 0 gate is successRate ≥ 0.7 and medianSuccessMs ≤ 30000. */
export function summarize(trials: Trial[]): TrialSummary {
  const n = trials.length
  const ok = trials.filter((t) => t.result === 'success')
  return {
    n,
    successes: ok.length,
    successRate: n === 0 ? null : ok.length / n,
    medianSuccessMs: median(ok.map((t) => t.ms)),
  }
}

export function modeOf(t: Trial): TrialMode {
  return t.mode ?? 'overlay'
}

/** Summary per alignment method, so the two can be compared side by side. */
export function summarizeByMode(trials: Trial[]): Record<TrialMode, TrialSummary> {
  return {
    overlay: summarize(trials.filter((t) => modeOf(t) === 'overlay')),
    pano: summarize(trials.filter((t) => modeOf(t) === 'pano')),
    window: summarize(trials.filter((t) => modeOf(t) === 'window')),
  }
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function exportJson(trials: Trial[]): string {
  return JSON.stringify({ exported_at: new Date().toISOString(), trials }, null, 2)
}
