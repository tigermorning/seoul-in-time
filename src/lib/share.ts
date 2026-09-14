// Share step (F5), stub version: shares a link and a sentence, no image yet.
// The composite capture replaces the text later (BACKLOG.md §8); the call
// order below stays the same.
import type { Spot } from '../types/spot'

export interface SharePayload {
  title: string
  text: string
  url: string
}

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'blocked'

/** The link is the app root until spot deep links exist (BACKLOG.md §5).
 *  No years in the text: the alignment screens show one photo, not every era. */
export function sharePayload(spot: Spot, appUrl: string): SharePayload {
  return {
    title: `서울 인 타임 — ${spot.name.ko}`,
    text: `${spot.name.ko}에서 지금 풍경에 옛 사진을 겹쳐 봤다.`,
    url: appUrl,
  }
}

/** '제목\n본문\nURL' — what goes on the clipboard or into the fallback box. */
export function shareText(p: SharePayload): string {
  return `${p.title}\n${p.text}\n${p.url}`
}

/** Share sheet, then clipboard. A dismissed share sheet is not a failure and
 *  does not fall through to the clipboard. */
export async function shareOrCopy(p: SharePayload): Promise<ShareOutcome> {
  if (navigator.share) {
    try {
      await navigator.share(p)
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // NotAllowedError and friends: fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(shareText(p))
    return 'copied'
  } catch {
    return 'blocked'
  }
}
