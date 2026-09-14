import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Spot } from '../types/spot'
import { shareOrCopy, sharePayload, shareText } from './share'

const spot = { name: { ko: '남산 회현동 조망점' } } as unknown as Spot

const payload = sharePayload(spot, 'https://example.org/seoul-in-time/')

function stubNavigator(nav: Partial<Navigator>) {
  vi.stubGlobal('navigator', nav)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sharePayload', () => {
  it('names the spot and links the app', () => {
    expect(payload).toEqual({
      title: '서울 인 타임 — 남산 회현동 조망점',
      text: '남산 회현동 조망점에서 지금 풍경에 옛 사진을 겹쳐 봤다.',
      url: 'https://example.org/seoul-in-time/',
    })
    expect(shareText(payload).split('\n')).toHaveLength(3)
  })
})

describe('shareOrCopy', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share })
    expect(await shareOrCopy(payload)).toBe('shared')
    expect(share).toHaveBeenCalledWith(payload)
  })

  it('does not copy when the user dismisses the sheet', async () => {
    const writeText = vi.fn()
    stubNavigator({
      share: vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError')),
      clipboard: { writeText } as unknown as Clipboard,
    })
    expect(await shareOrCopy(payload)).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies when sharing is refused or missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({
      share: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
      clipboard: { writeText } as unknown as Clipboard,
    })
    expect(await shareOrCopy(payload)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(shareText(payload))

    stubNavigator({ clipboard: { writeText } as unknown as Clipboard })
    expect(await shareOrCopy(payload)).toBe('copied')
  })

  it('reports blocked when the clipboard fails too', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard })
    expect(await shareOrCopy(payload)).toBe('blocked')
  })
})
