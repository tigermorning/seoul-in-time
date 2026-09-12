// Source and licence display. KOGL-1 requires the source to be shown wherever
// the photo is used, so every screen that draws a historical photo mounts one
// of these. `license.attribution` is the exact sentence the archive asks for
// and is shown verbatim.
import { useState } from 'react'
import { LICENSE_LABEL, LICENSE_URL, creditLine, evidenceLink, formatYear } from '../lib/credit'
import type { HistoricalPhoto } from '../types/spot'

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="whitespace-nowrap text-amber-400 underline decoration-amber-400/40 underline-offset-2"
    >
      {children} ↗
    </a>
  )
}

/** Compact credit for the alignment screens. One line; tap for the full
 *  attribution sentence and the link to the original. */
export function CreditBar({ photo }: { photo: HistoricalPhoto }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-[11px] leading-snug text-neutral-400">
      <div className="flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 truncate text-left"
        >
          {open ? '▾' : '▸'} {creditLine(photo)}
        </button>
        <ExternalLink href={photo.source.url}>원본</ExternalLink>
      </div>
      {open && <p className="mt-1 whitespace-pre-line break-words text-neutral-300">{photo.license.attribution}</p>}
    </div>
  )
}

/** Full credit cards for the guide screen: every photo the spot uses, with
 *  the licence spelled out and the links the licence asks for. */
export function PhotoCredits({ photos }: { photos: HistoricalPhoto[] }) {
  return (
    <section aria-label="사진 출처">
      <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">사진 출처</h2>
      <ul className="mt-2 space-y-3">
        {photos.map((photo) => {
          const evidence = evidenceLink(photo)
          const licenseUrl = LICENSE_URL[photo.license.type]
          return (
            <li key={photo.id} className="rounded-lg bg-neutral-900 p-3 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-neutral-200">{photo.title.ko}</span>
                <span className="shrink-0 text-neutral-400">{formatYear(photo.year, photo.year_precision)}</span>
              </div>
              <div className="mt-1 text-neutral-400">
                {photo.source.org} · {photo.source.archive_id}
                {photo.source.producer && ` · ${photo.source.producer}`}
              </div>
              <div className="mt-1 text-neutral-400">
                {licenseUrl ? (
                  <ExternalLink href={licenseUrl}>{LICENSE_LABEL[photo.license.type]}</ExternalLink>
                ) : (
                  LICENSE_LABEL[photo.license.type]
                )}
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-neutral-300">{photo.license.attribution}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <ExternalLink href={photo.source.url}>원본 보기</ExternalLink>
                {evidence && <ExternalLink href={evidence}>라이선스 근거</ExternalLink>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
