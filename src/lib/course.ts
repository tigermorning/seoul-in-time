import type { Spot } from '../types/spot'

export type Lang = 'en' | 'zh' | 'ko'
export const LANGS: Lang[] = ['en', 'zh', 'ko']
export const LANG_LABEL: Record<Lang, string> = { en: 'EN', zh: '中文', ko: '한국어' }

export interface CourseStop {
  spotId: string
  /** Chinese display name; spot JSON only carries ko/en. */
  nameZh: string
  /** Narration text per language. Empty until the script is written and
   *  checked against the colonial-era wording rule (REVIEW-PR2 §3-3). */
  story: Partial<Record<Lang, string>>
  /** Recorded narration under public/audio/. Null until recorded. */
  audio: Partial<Record<'en' | 'zh', string>>
}

// Walking order from REVIEW-PR2-2026-11-10.md §1-5 (plan C): 2.87 km, about
// 38 minutes on foot according to the OSRM foot profile.
export const COURSE_STOPS: CourseStop[] = [
  { spotId: 'sungnyemun', nameZh: '崇礼门', story: {}, audio: {} },
  { spotId: 'shinsegae-main', nameZh: '新世界百货总店', story: {}, audio: {} },
  { spotId: 'bok-money-museum', nameZh: '韩国银行货币博物馆', story: {}, audio: {} },
  { spotId: 'gwangtonggwan', nameZh: '广通馆', story: {}, audio: {} },
  { spotId: 'myeongdong-theater', nameZh: '明洞艺术剧场', story: {}, audio: {} },
  { spotId: 'myeongdong-cathedral', nameZh: '明洞圣堂', story: {}, audio: {} },
]

export const COURSE_WALK = { km: 2.87, minutes: 38 }

export interface CourseEntry {
  index: number
  stop: CourseStop
  spot: Spot
}

/** Joins the course order with the spot files. Throws on a missing spot so
 *  a renamed file fails the test instead of silently dropping a stop. */
export function buildCourse(spots: Spot[], stops: CourseStop[] = COURSE_STOPS): CourseEntry[] {
  return stops.map((stop, index) => {
    const spot = spots.find((s) => s.id === stop.spotId)
    if (!spot) throw new Error(`course stop ${stop.spotId} has no spots/${stop.spotId}.json`)
    return { index, stop, spot }
  })
}

export function stopName(entry: CourseEntry, lang: Lang): string {
  if (lang === 'zh') return entry.stop.nameZh
  if (lang === 'en') return entry.spot.name.en ?? entry.spot.name.ko
  return entry.spot.name.ko
}

/** UI words. Chinese and English strings need a native check before the event. */
export const UI: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Seoul in Time',
    tagline: 'Same corner, different century — a walk through old Seoul in central Jung-gu.',
    walk: '{km} km · about {min} min on foot',
    back: '← Course',
    next: 'Next stop →',
    prev: '← Previous',
    then: 'Then',
    now: 'Now',
    nowSoon: 'Present-day photo coming soon',
    storySoon: 'Story coming soon',
    listen: 'Listen',
    credits: 'Photo credits',
    lab: 'AR experiment (old version)',
  },
  zh: {
    title: 'Seoul in Time',
    tagline: '同一个街角，不同的时代——漫步首尔中区的旧时光。',
    walk: '{km} 公里 · 步行约 {min} 分钟',
    back: '← 路线',
    next: '下一站 →',
    prev: '← 上一站',
    then: '过去',
    now: '现在',
    nowSoon: '现在的照片即将上线',
    storySoon: '介绍即将上线',
    listen: '收听',
    credits: '照片出处',
    lab: 'AR 实验（旧版）',
  },
  ko: {
    title: '서울 인 타임',
    tagline: '같은 자리, 다른 시간 — 서울 중구 옛길 걷기.',
    walk: '{km}km · 걸어서 약 {min}분',
    back: '← 코스',
    next: '다음 장소 →',
    prev: '← 이전',
    then: '그때',
    now: '지금',
    nowSoon: '지금 사진은 준비 중',
    storySoon: '설명은 준비 중',
    listen: '듣기',
    credits: '사진 출처',
    lab: 'AR 실험 (이전 버전)',
  },
}

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  let s = UI[lang][key] ?? UI.en[key] ?? key
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}
