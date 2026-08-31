export interface GalleryPhoto {
  id: string
  imageUrl: string
  width: number
  height: number
  createdAt: string
}

type RandomSource = () => number

export class GalleryPool {
  private photos = new Map<string, GalleryPhoto>()
  private remaining: string[] = []
  private shown = new Set<string>()
  private lastShownId: string | null = null

  update(nextPhotos: GalleryPhoto[]) {
    const next = new Map(nextPhotos.map(photo => [photo.id, photo]))

    this.remaining = this.remaining.filter(id => next.has(id))
    for (const id of [...this.shown]) {
      if (!next.has(id)) this.shown.delete(id)
    }

    for (const [id] of next) {
      if (!this.photos.has(id) && !this.shown.has(id) && !this.remaining.includes(id)) {
        this.remaining.push(id)
      }
    }

    this.photos = next
    if (this.photos.size === 0) {
      this.remaining = []
      this.shown.clear()
      this.lastShownId = null
    }
  }

  next(random: RandomSource = Math.random): GalleryPhoto | null {
    if (this.photos.size === 0) return null

    let startedNewCycle = false
    if (this.remaining.length === 0) {
      this.shown.clear()
      this.remaining = [...this.photos.keys()]
      startedNewCycle = true
    }

    let index = Math.min(
      this.remaining.length - 1,
      Math.max(0, Math.floor(random() * this.remaining.length)),
    )

    if (
      startedNewCycle &&
      this.remaining.length > 1 &&
      this.remaining[index] === this.lastShownId
    ) {
      index = (index + 1) % this.remaining.length
    }

    const [id] = this.remaining.splice(index, 1)
    if (!id) return null
    const photo = this.photos.get(id)
    if (!photo) return this.next(random)

    this.shown.add(id)
    this.lastShownId = id
    return photo
  }

  remove(id: string) {
    this.photos.delete(id)
    this.shown.delete(id)
    this.remaining = this.remaining.filter(candidate => candidate !== id)
    if (this.lastShownId === id) this.lastShownId = null
  }

  get size() {
    return this.photos.size
  }

  get remainingCount() {
    return this.remaining.length
  }

  get shownCount() {
    return this.shown.size
  }
}
