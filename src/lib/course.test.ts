import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { spots } from './spots'
import { COURSE_STOPS, LANGS, UI, buildCourse, t } from './course'

describe('course', () => {
  const course = buildCourse(spots)

  it('has the four Jegi-dong stops in walking order', () => {
    expect(course.map((e) => e.spot.id)).toEqual([
      'cheongnyangni-station',
      'cheongnyangni-market',
      'jegi-hanok-alley',
      'jegi-road-korea-univ',
    ])
  })

  it('uses only KOGL type 1 photos whose files exist', () => {
    for (const { spot } of course) {
      expect(spot.historical.length).toBeGreaterThan(0)
      for (const photo of spot.historical) {
        expect(photo.license.type).toBe('KOGL-1')
        expect(existsSync(`public/spots/${spot.id}/${photo.image.file}`)).toBe(true)
      }
    }
  })

  it('points audio at files that exist', () => {
    for (const stop of COURSE_STOPS) {
      for (const file of Object.values(stop.audio)) {
        if (file) expect(existsSync(`public/audio/${file}`)).toBe(true)
      }
    }
  })

  it('throws when a stop has no spot file', () => {
    expect(() => buildCourse(spots, [{ spotId: 'nope', nameZh: '', story: {}, audio: {} }])).toThrow(/nope/)
  })

  it('has every UI key in every language', () => {
    const keys = Object.keys(UI.en).sort()
    for (const lang of LANGS) expect(Object.keys(UI[lang]).sort()).toEqual(keys)
  })

  it('fills template variables', () => {
    expect(t('en', 'walk', { km: 2.87, min: 38 })).toBe('2.87 km · about 38 min on foot')
  })
})
