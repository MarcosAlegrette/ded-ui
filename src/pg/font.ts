// pygame.font.Font con las fuentes TTF originales. Las métricas (ascent, descent, alto, interlineado)
// se calculan igual que SDL_ttf 2.0 a partir de las tablas head/hhea (src/data/fonts.json), así los
// textos ocupan el mismo alto y cortan las líneas en los mismos lugares que en el juego original.
import METRICS from '../data/fonts.json'
import { Surface, SRCALPHA, css, type Color } from './surface.ts'

type M = { upm: number; yMax: number; yMin: number; asc: number; desc: number; gap: number }
const metrics = METRICS as Record<string, M>
const families = new Map<string, string>()
let fontsReady: Promise<void> | null = null

const family = (file: string) => {
  let f = families.get(file)
  if (!f) { f = 'ded_' + file.replace(/[^a-z0-9]/gi, '_'); families.set(file, f) }
  return f
}

/** Carga todas las fuentes originales (antes de crear cualquier texto). */
export function loadFonts(base = '/assets/fonts/'): Promise<void> {
  if (!fontsReady) {
    fontsReady = Promise.all(Object.keys(metrics).map(async (file) => {
      const ff = new FontFace(family(file), `url(${base}${file})`)
      try { await ff.load(); document.fonts.add(ff) } catch (e) { console.warn('No se pudo cargar la fuente', file, e) }
    })).then(() => undefined)
  }
  return fontsReady
}

let measureCtx: CanvasRenderingContext2D | null = null
const mctx = () => (measureCtx ??= document.createElement('canvas').getContext('2d')!)

export class Font {
  readonly file: string
  readonly px: number
  readonly ascent: number
  readonly descent: number
  readonly height: number
  readonly linesize: number
  readonly cssFont: string
  private widths = new Map<string, number>()

  constructor(file: string, size: number) {
    this.file = file
    this.px = size
    const m = metrics[file] ?? { upm: 1000, yMax: 900, yMin: -200, asc: 900, desc: -200, gap: 0 }
    const k = size / m.upm
    this.ascent = Math.ceil(m.yMax * k)
    this.descent = Math.ceil(m.yMin * k)
    this.height = this.ascent - this.descent + 1
    this.linesize = Math.ceil((m.asc - m.desc + m.gap) * k)
    this.cssFont = `${size}px "${family(file)}"`
  }

  get_linesize() { return this.linesize }
  get_height() { return this.height }
  get_ascent() { return this.ascent }
  get_descent() { return this.descent }

  private textWidth(text: string) {
    let w = this.widths.get(text)
    if (w === undefined) {
      const c = mctx()
      c.font = this.cssFont
      w = Math.ceil(c.measureText(text).width)
      if (this.widths.size > 4000) this.widths.clear()
      this.widths.set(text, w)
    }
    return w
  }

  /** font.size(text) de pygame: [ancho, alto] */
  size(text: string): [number, number] { return [this.textWidth(text), this.height] }

  render(text: string, _antialias: boolean, color: Color, background?: Color | null): Surface {
    const w = this.textWidth(text)
    const s = new Surface([Math.max(w, text.length ? 1 : 0), this.height], SRCALPHA)
    if (w === 0) return s
    s.draw([], (ctx) => {
      if (background) { ctx.fillStyle = css(background); ctx.fillRect(0, 0, w, this.height) }
      ctx.font = this.cssFont
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = css(color)
      ctx.fillText(text, 0, this.ascent)
    })
    return s
  }
}

