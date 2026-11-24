// pygame.Rect con la misma semántica (coordenadas enteras, right/bottom exclusivos).
export type RectLike = Rect | number[]

export class Rect {
  x: number
  y: number
  w: number
  h: number

  constructor(x: number | RectLike = 0, y = 0, w = 0, h = 0) {
    if (typeof x !== 'number') {
      const r = x instanceof Rect ? [x.x, x.y, x.w, x.h] : x.length === 2 ? [(x as any)[0][0], (x as any)[0][1], (x as any)[1][0], (x as any)[1][1]] : x
      ;[x, y, w, h] = r as number[]
    }
    this.x = Math.trunc(x as number)
    this.y = Math.trunc(y)
    this.w = Math.trunc(w)
    this.h = Math.trunc(h)
  }

  static from(r: RectLike): Rect {
    return r instanceof Rect ? r : new Rect(r)
  }

  get left() { return this.x }
  set left(v) { this.x = Math.trunc(v) }
  get top() { return this.y }
  set top(v) { this.y = Math.trunc(v) }
  get width() { return this.w }
  set width(v) { this.w = Math.trunc(v) }
  get height() { return this.h }
  set height(v) { this.h = Math.trunc(v) }
  get right() { return this.x + this.w }
  set right(v) { this.x = Math.trunc(v) - this.w }
  get bottom() { return this.y + this.h }
  set bottom(v) { this.y = Math.trunc(v) - this.h }
  get centerx() { return this.x + Math.floor(this.w / 2) }
  set centerx(v) { this.x = Math.trunc(v) - Math.floor(this.w / 2) }
  get centery() { return this.y + Math.floor(this.h / 2) }
  set centery(v) { this.y = Math.trunc(v) - Math.floor(this.h / 2) }
  get center(): [number, number] { return [this.centerx, this.centery] }
  set center(v: number[]) { this.centerx = v[0]; this.centery = v[1] }
  get topleft(): [number, number] { return [this.x, this.y] }
  set topleft(v: number[]) { this.x = Math.trunc(v[0]); this.y = Math.trunc(v[1]) }
  get size(): [number, number] { return [this.w, this.h] }
  set size(v: number[]) { this.w = Math.trunc(v[0]); this.h = Math.trunc(v[1]) }

  /** Acceso tipo tupla: r[0..3] */
  get 0() { return this.x }
  get 1() { return this.y }
  get 2() { return this.w }
  get 3() { return this.h }
  get length() { return 4 }

  copy() { return new Rect(this.x, this.y, this.w, this.h) }
  move(dx: number, dy: number) { return new Rect(this.x + dx, this.y + dy, this.w, this.h) }
  move_ip(dx: number, dy: number) { this.x += Math.trunc(dx); this.y += Math.trunc(dy) }
  inflate(dx: number, dy: number) { return new Rect(this.x - Math.trunc(dx / 2), this.y - Math.trunc(dy / 2), this.w + dx, this.h + dy) }

  collidepoint(x: number | number[], y?: number) {
    if (typeof x !== 'number') { y = x[1]; x = x[0] }
    return x >= this.x && x < this.x + this.w && y! >= this.y && y! < this.y + this.h
  }

  colliderect(o: RectLike) {
    const r = Rect.from(o)
    return this.x < r.x + r.w && r.x < this.x + this.w && this.y < r.y + r.h && r.y < this.y + this.h && this.w > 0 && this.h > 0 && r.w > 0 && r.h > 0
  }

  collidelist(list: RectLike[]) {
    for (let i = 0; i < list.length; i++) if (this.colliderect(list[i])) return i
    return -1
  }

  contains(o: RectLike) {
    const r = Rect.from(o)
    return r.x >= this.x && r.y >= this.y && r.x + r.w <= this.x + this.w && r.y + r.h <= this.y + this.h
  }

  clip(o: RectLike) {
    const r = Rect.from(o)
    const x0 = Math.max(this.x, r.x), y0 = Math.max(this.y, r.y)
    const x1 = Math.min(this.x + this.w, r.x + r.w), y1 = Math.min(this.y + this.h, r.y + r.h)
    if (x1 <= x0 || y1 <= y0) return new Rect(this.x, this.y, 0, 0)
    return new Rect(x0, y0, x1 - x0, y1 - y0)
  }

  union(o: RectLike) {
    const r = Rect.from(o)
    const x0 = Math.min(this.x, r.x), y0 = Math.min(this.y, r.y)
    const x1 = Math.max(this.x + this.w, r.x + r.w), y1 = Math.max(this.y + this.h, r.y + r.h)
    return new Rect(x0, y0, x1 - x0, y1 - y0)
  }

  union_ip(o: RectLike) { const u = this.union(o); this.x = u.x; this.y = u.y; this.w = u.w; this.h = u.h }

  equals(o: RectLike | null | undefined) {
    if (o == null) return false
    const r = Rect.from(o)
    return r.x === this.x && r.y === this.y && r.w === this.w && r.h === this.h
  }

  toArray() { return [this.x, this.y, this.w, this.h] }
}
