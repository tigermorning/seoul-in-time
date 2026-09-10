// Mirrors schema/spot.schema.json v1. The schema is the source of truth;
// keep this file in sync when schema_version changes.

export type LocalizedText = { ko: string; en?: string }

export type Confidence = 'rough' | 'estimated' | 'surveyed'
export type SpotStatus = 'draft' | 'surveyed' | 'published'
export type YearPrecision = 'exact' | 'circa' | 'decade' | 'unknown'
export type MediaType = 'photo' | 'tinted_postcard' | 'drawing' | 'aerial'
export type LicenseType = 'KOGL-1' | 'CC-BY-4.0' | 'PUBLIC-DOMAIN'
export type LicenseEvidence = 'badge' | 'metadata' | 'statement'
export type SourceOrg = '서울역사박물관' | '서울기록원' | '서울연구원' | '국가기록원' | '기타'

export interface Viewpoint {
  lat: number
  lng: number
  /** Degrees clockwise from TRUE north. Declination is applied at runtime. */
  heading_deg: number
  pitch_deg?: number
  hfov_deg: number
  eye_height_m?: number
  confidence: Confidence
  surveyed_at?: string | null
  notes?: string
}

export interface Landmark {
  label: LocalizedText
  bearing_deg?: number
}

export interface Guide {
  instruction: LocalizedText
  stand_here_image?: string | null
  landmarks?: Landmark[]
}

export interface PresentPhoto {
  file: string
  taken_at: string
}

export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

export type Projection = 'flat' | 'equirect'

export interface HistoricalImage {
  file: string
  /** Defaults to 'flat'. */
  projection?: Projection
  original_ref?: string
  original_px?: { w: number; h: number }
  crop?: NormalizedRect | null
}

export interface Source {
  org: SourceOrg
  archive_id: string
  url: string
  producer?: string
}

export interface License {
  type: LicenseType
  evidence: LicenseEvidence
  evidence_url: string
  evidence_quote?: string
  attribution: string
  checked_at?: string
}

export interface AlignmentHint {
  label: LocalizedText
  point?: { x: number; y: number } | null
  still_exists?: boolean
}

export interface HistoricalPhoto {
  id: string
  title: LocalizedText
  year: number | null
  year_precision: YearPrecision
  date?: string | null
  media_type: MediaType
  description?: LocalizedText
  /** Per-photo bearing/pitch/fov; missing fields fall back to viewpoint. */
  view?: { heading_deg?: number; pitch_deg?: number; hfov_deg?: number }
  image: HistoricalImage
  source: Source
  license: License
  alignment?: { hints?: AlignmentHint[] }
}

export interface Spot {
  schema_version: 1
  id: string
  status: SpotStatus
  name: LocalizedText
  viewpoint: Viewpoint
  guide: Guide
  present?: PresentPhoto | null
  historical: HistoricalPhoto[]
}
