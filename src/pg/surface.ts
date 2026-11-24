// pygame.Surface sobre <canvas>. Las imágenes se cargan de forma diferida (WebP generados a partir
// de los PNG/JPG/GIF originales): su tamaño se conoce al instante gracias a src/data/images.json, y las
// operaciones que dependen de una imagen que todavía no llegó (blit a otra superficie, copias,
// espejados, escalados) se encolan y se ejecutan en orden apenas la imagen está lista.
import { Rect, type RectLike } from './rect.ts'
import SIZES from '../data/images.json'

export type Color = number[] | string

export function css(c: Color, alphaOverride?: number): string {
  if (typeof c === 'string') return c
  const a = alphaOverride ?? (c.length >= 4 ? c[3] / 255 : 1)
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
}

export function parseColor(c: Color): number[] {
  if (typeof c !== 'string') return [c[0], c[1], c[2], c.length >= 4 ? c[3] : 255]
  const m = c.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i)
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), m[4] ? parseInt(m[4], 16) : 255]
  return [0, 0, 0, 255]
}

/** Contador global de imágenes pendientes (la pantalla de carga espera a que llegue a 0). */
let pending = 0
const idleWaiters: (() => void)[] = []
export function pendingLoads() { return pending }
export function whenIdle(): Promise<void> {
  if (pending === 0) return Promise.resolve()
  return new Promise((r) => idleWaiters.push(r))
}
function loadDone() {
  pending--
  if (pending <= 0) { pending = 0; idleWaiters.splice(0).forEach((f) => f()) }
}

type Op = { deps: Surface[]; run: (ctx: CanvasRenderingContext2D) => void }

export const SRCALPHA = 0x10000

let assetBase = '/assets/images/'
/** Nombre del archivo WebP generado (misma regla que scripts/build-assets.mjs). */
export const webName = (f: string) => f.replace(/[^A-Za-z0-9_.]/g, (c) => '-' + c.charCodeAt(0).toString(16)) + '.webp'
export function setAssetBase(b: string) { assetBase = b }
const imageSizes = SIZES as unknown as Record<string, [number, number]>
export function imageSize(name: string): [number, number] | undefined { return imageSizes[name] }

export class Surface {
  width: number
  height: number
  /** true si tiene canal alfa por píxel (PNG/GIF con transparencia o SRCALPHA) */
  alpha: boolean
  /** alfa de superficie (pygame set_alpha), 0-255 o null */
  surfAlpha: number | null = null
  /** Pantalla principal: nunca encola operaciones (se redibuja en cada cuadro). */
  isScreen = false
  name = ''

  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null
  private _ctx: CanvasRenderingContext2D | null = null
  private img: HTMLImageElement | null = null
  private _ready = true
  private queue: Op[] = []
  private waiters: (() => void)[] = []
  private pixels: Uint8ClampedArray | null = null

  constructor(size: number[] = [0, 0], flags = 0, _depth?: unknown) {
    this.width = Math.max(0, Math.trunc(size[0]))
    this.height = Math.max(0, Math.trunc(size[1]))
    this.alpha = (flags & SRCALPHA) !== 0
    if (!this.alpha && this.width > 0 && this.height > 0) {
      const c = this.ctx
      c.fillStyle = '#000'
      c.fillRect(0, 0, this.width, this.height)
    }
  }

  /** Superficie respaldada por una imagen original (images/<file>). */
  static fromImage(file: string): Surface {
    const size = imageSizes[file]
    if (!size) console.warn('Imagen desconocida:', file)
    const s = new Surface([0, 0], SRCALPHA)
    s.width = size?.[0] ?? 0
    s.height = size?.[1] ?? 0
    s.name = file
    s.alpha = !/\.jpe?g$/i.test(file)
    if (!size) return s
    s._ready = false
    pending++
    const img = new Image()
    img.decoding = 'async'
    img.src = assetBase + webName(file)
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      if (img.naturalWidth > 0) s.img = img
      else console.warn('No se pudo cargar la imagen', file)
      s.markReady()
      loadDone()
    }
    img.decode().then(done, () => { img.onload = done; img.onerror = done; if (img.complete) done() })
    return s
  }

  static fromCanvas(canvas: HTMLCanvasElement, alpha = false): Surface {
    const s = new Surface([0, 0], alpha ? SRCALPHA : 0)
    s.canvas = canvas
    s.width = canvas.width
    s.height = canvas.height
    return s
  }

  get ready() { return this._ready }

  whenReady(cb: () => void) {
    if (this._ready) cb()
    else this.waiters.push(cb)
  }

  private markReady() {
    this._ready = true
    this.waiters.splice(0).forEach((f) => f())
  }

  get ctx(): CanvasRenderingContext2D {
    if (!this._ctx) {
      if (!this.canvas) {
        const c = document.createElement('canvas')
        c.width = Math.max(1, this.width)
        c.height = Math.max(1, this.height)
        this.canvas = c
        if (this.img) {
          const ctx = c.getContext('2d', { willReadFrequently: false })!
          ctx.drawImage(this.img, 0, 0)
          this.img = null
          this._ctx = ctx
        }
      }
      if (!this._ctx) this._ctx = (this.canvas as HTMLCanvasElement).getContext('2d')!
      this._ctx.imageSmoothingEnabled = true
    }
    return this._ctx
  }

  /** Lo que se puede pasar a drawImage, o null si todavía no cargó. */
  drawable(): CanvasImageSource | null {
    if (!this._ready) return null
    if (this.img) return this.img
    if (this.canvas) return this.canvas as CanvasImageSource
    return null
  }

  private touch() { this.pixels = null }

  /** Ejecuta (o encola si alguna dependencia no está lista) una operación de dibujo sobre esta superficie. */
  private op(deps: Surface[], run: (ctx: CanvasRenderingContext2D) => void) {
    if (this.isScreen) {
      for (const d of deps) if (!d.ready) return
      run(this.ctx)
      return
    }
    if (this.queue.length === 0 && deps.every((d) => d.ready)) {
      run(this.ctx)
      this.touch()
      return
    }
    this.queue.push({ deps, run })
    if (this._ready) this._ready = false
    this.flushSoon()
  }

  private flushSoon() {
    const head = this.queue[0]
    if (!head) return
    const waiting = head.deps.find((d) => !d.ready)
    if (waiting) waiting.whenReady(() => this.flushSoon())
    else {
      while (this.queue.length && this.queue[0].deps.every((d) => d.ready)) {
        this.queue.shift()!.run(this.ctx)
      }
      this.touch()
      if (this.queue.length) this.flushSoon()
      else this.markReady()
    }
  }

  get_width() { return this.width }
  get_height() { return this.height }
  get_size(): [number, number] { return [this.width, this.height] }
  get_rect(kw?: Record<string, unknown>) {
    const r = new Rect(0, 0, this.width, this.height)
    if (kw) for (const [k, v] of Object.entries(kw)) (r as any)[k] = v
    return r
  }
  get_bitsize() { return this.alpha ? 32 : 24 }
  convert() { return this }
  convert_alpha() { this.alpha = true; return this }
  set_colorkey(_c?: unknown) { /* las transparencias ya vienen en el WebP */ }
  get_alpha() { return this.surfAlpha }
  set_alpha(a: number | null) { this.surfAlpha = a == null ? null : Math.max(0, Math.min(255, a)) }

  /** blit(src, dest, area?) como pygame. dest puede ser [x,y] o Rect. */
  blit(src: Surface, dest: RectLike | number[], area?: RectLike | null) {
    if (!src || src.width === 0 || src.height === 0) return new Rect(0, 0, 0, 0)
    const dx = Math.trunc((dest as any)[0] ?? (dest as Rect).x), dy = Math.trunc((dest as any)[1] ?? (dest as Rect).y)
    let sx = 0, sy = 0, sw = src.width, sh = src.height
    if (area) {
      const a = Rect.from(area as RectLike)
      sx = a.x; sy = a.y; sw = a.w; sh = a.h
      // pygame recorta el área a la superficie de origen
      if (sx < 0) { sw += sx; sx = 0 }
      if (sy < 0) { sh += sy; sy = 0 }
      sw = Math.min(sw, src.width - sx)
      sh = Math.min(sh, src.height - sy)
    }
    if (sw <= 0 || sh <= 0) return new Rect(dx, dy, 0, 0)
    const sa = src.surfAlpha
    this.op([src], (ctx) => {
      const d = src.drawable()
      if (!d) return
      const prev = ctx.globalAlpha
      if (sa != null) ctx.globalAlpha = prev * (sa / 255)
      if (!src.alpha && !this.alpha) {
        ctx.drawImage(d, sx, sy, sw, sh, dx, dy, sw, sh)
      } else ctx.drawImage(d, sx, sy, sw, sh, dx, dy, sw, sh)
      ctx.globalAlpha = prev
    })
    return new Rect(dx, dy, sw, sh)
  }

  fill(color: Color, rect?: RectLike | null) {
    const c = parseColor(color)
    const r = rect ? Rect.from(rect as RectLike) : new Rect(0, 0, this.width, this.height)
    this.op([], (ctx) => {
      ctx.save()
      if (this.alpha) {
        ctx.clearRect(r.x, r.y, r.w, r.h)
        if (c[3] > 0) { ctx.fillStyle = css(c); ctx.fillRect(r.x, r.y, r.w, r.h) }
      } else {
        ctx.fillStyle = css(c, 1)
        ctx.fillRect(r.x, r.y, r.w, r.h)
      }
      ctx.restore()
    })
    return r
  }

  /** Operación de dibujo arbitraria (usada por draw.*, transform.* y el framework). */
  draw(deps: Surface[], fn: (ctx: CanvasRenderingContext2D) => void) { this.op(deps, fn) }

  copy(): Surface {
    const s = new Surface([this.width, this.height], this.alpha ? SRCALPHA : 0)
    s.name = this.name
    s.surfAlpha = this.surfAlpha
    if (!this.alpha) s.fill([0, 0, 0])
    const src = this
    s.op([src], (ctx) => { const d = src.drawable(); if (d) ctx.drawImage(d, 0, 0) })
    return s
  }

  subsurface(rect: RectLike): Surface {
    const r = Rect.from(rect)
    const s = new Surface([r.w, r.h], this.alpha ? SRCALPHA : 0)
    s.blit(this, [0, 0], r)
    return s
  }

  get_at(pos: number[]): [number, number, number, number] {
    const x = Math.trunc(pos[0]), y = Math.trunc(pos[1])
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) throw new RangeError('pixel index out of range')
    if (!this._ready) return [0, 0, 0, 0]
    if (!this.pixels) {
      try {
        const ctx = this.ctx
        this.pixels = ctx.getImageData(0, 0, this.width, this.height).data
      } catch { return [0, 0, 0, 255] }
    }
    const o = (y * this.width + x) * 4
    const p = this.pixels
    return [p[o], p[o + 1], p[o + 2], this.alpha ? p[o + 3] : 255]
  }

  set_at(pos: number[], color: Color) {
    const c = parseColor(color)
    this.op([], (ctx) => {
      ctx.clearRect(pos[0], pos[1], 1, 1)
      ctx.fillStyle = css(c)
      ctx.fillRect(pos[0], pos[1], 1, 1)
    })
  }

  set_clip(_r?: RectLike | null) { /* el framework maneja los recortes con ctx.clip */ }
  lock() {}
  unlock() {}
}
