import { describe, expect, it } from 'vitest'
import type { HistoricalPhoto } from '../types/spot'
import { LICENSE_LABEL, LICENSE_SHORT, LICENSE_URL, creditLine, evidenceLink, formatYear } from './credit'

const photo: HistoricalPhoto = {
  id: 'p',
  title: { ko: '경성 전경' },
  year: 1925,
  year_precision: 'exact',
  media_type: 'photo',
  image: { file: 'x.jpg' },
  source: { org: '서울역사박물관', archive_id: 'H-TRNS-75528-812', url: 'https://museum.seoul.go.kr/a' },
  license: {
    type: 'KOGL-1',
    evidence: 'badge',
    evidence_url: 'https://museum.seoul.go.kr/a',
    attribution: '본 저작물은 …',
  },
}

describe('formatYear', () => {
  it('marks uncertainty the way the archive does', () => {
    expect(formatYear(1964, 'exact')).toBe('1964')
    expect(formatYear(1910, 'circa')).toBe('ca. 1910')
    expect(formatYear(1917, 'decade')).toBe('1910년대')
    expect(formatYear(1917, 'unknown')).toBe('연도 미상')
    expect(formatYear(null, 'exact')).toBe('연도 미상')
  })
})

describe('creditLine', () => {
  it('names the holder, the archive id and the licence', () => {
    expect(creditLine(photo)).toBe('서울역사박물관 · H-TRNS-75528-812 · 공공누리 1유형')
  })
})

describe('evidenceLink', () => {
  it('is omitted when it would repeat the source page', () => {
    expect(evidenceLink(photo)).toBeNull()
    expect(
      evidenceLink({ ...photo, license: { ...photo.license, evidence_url: 'https://example.org/license' } }),
    ).toBe('https://example.org/license')
  })
})

describe('licence tables', () => {
  it('cover every licence type the schema allows', () => {
    for (const type of ['KOGL-1', 'CC-BY-4.0', 'PUBLIC-DOMAIN'] as const) {
      expect(LICENSE_LABEL[type]).toBeTruthy()
      expect(LICENSE_SHORT[type]).toBeTruthy()
      expect(type in LICENSE_URL).toBe(true)
    }
  })
})
