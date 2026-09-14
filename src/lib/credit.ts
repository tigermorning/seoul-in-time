// Attribution text for a historical photo. KOGL-1 (공공누리 제1유형) has one
// obligation: name the source. Every screen that shows a photo shows this.
import type { HistoricalPhoto, LicenseType, YearPrecision } from '../types/spot'

export const LICENSE_LABEL: Record<LicenseType, string> = {
  'KOGL-1': '공공누리 제1유형 (출처표시)',
  'CC-BY-4.0': 'CC BY 4.0',
  'PUBLIC-DOMAIN': '퍼블릭 도메인',
}

export const LICENSE_SHORT: Record<LicenseType, string> = {
  'KOGL-1': '공공누리 1유형',
  'CC-BY-4.0': 'CC BY 4.0',
  'PUBLIC-DOMAIN': '퍼블릭 도메인',
}

export const LICENSE_URL: Record<LicenseType, string | null> = {
  'KOGL-1': 'https://www.kogl.or.kr/info/license.do',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/deed.ko',
  'PUBLIC-DOMAIN': null,
}

/** '1964', 'ca. 1910', '1910년대', '연도 미상'. */
export function formatYear(year: number | null, precision: YearPrecision): string {
  if (year === null || precision === 'unknown') return '연도 미상'
  if (precision === 'circa') return `ca. ${year}`
  if (precision === 'decade') return `${Math.floor(year / 10) * 10}년대`
  return String(year)
}

/** One line for a crowded screen: '서울역사박물관 · H-TRNS-103288-812 · 공공누리 1유형'. */
export function creditLine(photo: HistoricalPhoto): string {
  return [photo.source.org, photo.source.archive_id, LICENSE_SHORT[photo.license.type]].join(' · ')
}

/** The licence evidence page, when it is not simply the source page again. */
export function evidenceLink(photo: HistoricalPhoto): string | null {
  const url = photo.license.evidence_url
  return url && url !== photo.source.url ? url : null
}
