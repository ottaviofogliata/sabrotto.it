import { describe, expect, it } from 'vitest'
import { GalleryPool, type GalleryPhoto } from '../utils/galleryPool'

function photo(id: string): GalleryPhoto {
  return {
    id,
    imageUrl: `/api/photos/${id}/image`,
    width: 1200,
    height: 800,
    createdAt: '2026-09-12T20:00:00.000Z',
  }
}

describe('GalleryPool', () => {
  it('shows every photo once before starting a new cycle', () => {
    const pool = new GalleryPool()
    pool.update(Array.from({ length: 50 }, (_, index) => photo(String(index + 1))))

    const firstCycle = Array.from({ length: 50 }, () => pool.next(() => 0.37)?.id)
    expect(new Set(firstCycle).size).toBe(50)

    const next = pool.next(() => 0.37)
    expect(next).not.toBeNull()
    expect(firstCycle.at(-1)).not.toBe(next?.id)
  })

  it('adds new photos to the current remaining pool', () => {
    const pool = new GalleryPool()
    pool.update([photo('a'), photo('b')])
    expect(pool.next(() => 0)?.id).toBe('a')

    pool.update([photo('a'), photo('b'), photo('c')])
    const rest = [pool.next(() => 0)?.id, pool.next(() => 0)?.id]
    expect(new Set(rest)).toEqual(new Set(['b', 'c']))
  })

  it('does not reinsert already shown photos after a refresh', () => {
    const pool = new GalleryPool()
    pool.update([photo('a'), photo('b'), photo('c')])
    expect(pool.next(() => 0)?.id).toBe('a')
    pool.update([photo('a'), photo('b'), photo('c')])

    expect(pool.next(() => 0)?.id).toBe('b')
    expect(pool.next(() => 0)?.id).toBe('c')
  })

  it('removes deleted or unreadable photos from the pool', () => {
    const pool = new GalleryPool()
    pool.update([photo('a'), photo('b'), photo('c')])
    pool.remove('b')

    const ids = [pool.next(() => 0)?.id, pool.next(() => 0)?.id]
    expect(ids).toEqual(['a', 'c'])
    expect(ids).not.toContain('b')
  })

  it('handles empty, single-photo and two-photo galleries', () => {
    const pool = new GalleryPool()
    expect(pool.next()).toBeNull()

    pool.update([photo('a')])
    expect(pool.next(() => 0)?.id).toBe('a')
    expect(pool.next(() => 0)?.id).toBe('a')

    pool.update([photo('a'), photo('b')])
    const first = pool.next(() => 0)?.id
    const second = pool.next(() => 0)?.id
    expect(first).not.toBe(second)
  })
})
