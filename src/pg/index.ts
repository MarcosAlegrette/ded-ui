// Fachada "pygame" para que el código portado se lea igual que el original:
//   pygame.time.get_ticks(), pygame.transform.flip(...), pygame.draw.rect(...), pygame.K_ESCAPE, etc.
import { Rect } from './rect.ts'
import { Surface, SRCALPHA, css, parseColor, type Color } from './surface.ts'
import { Font } from './font.ts'
import * as ev from './events.ts'
import * as mixer from './mixer.ts'

export { Rect, Surface, SRCALPHA, Font, type Color }

const t0 = performance.now()
let screen: Surface | null = null
export function setScreen(s: Surface) { screen = s }

function flip(s: Surface, xflip: boolean, yflip: boolean) {
  const out = new Surface([s.width, s.height], s.alpha ? SRCALPHA : 0)
  out.name = s.name
  out.surfAlpha = s.surfAlpha
  out.draw([s], (ctx) => {
    const d = s.drawable()
    if (!d) return
    ctx.save()
    ctx.translate(xflip ? s.width : 0, yflip ? s.height : 0)
    ctx.scale(xflip ? -1 : 1, yflip ? -1 : 1)
    if (!s.alpha) ctx.clearRect(0, 0, s.width, s.height)
    ctx.drawImage(d, 0, 0)
    ctx.restore()
  })
  return out
}

function scale(s: Surface, size: number[], smooth = false) {
  const w = Math.max(0, Math.trunc(size[0])), h = Math.max(0, Math.trunc(size[1]))
  const out = new Surface([w, h], s.alpha ? SRCALPHA : 0)
  out.surfAlpha = s.surfAlpha
  if (w === 0 || h === 0) return out
  out.draw([s], (ctx) => {
    const d = s.drawable()
    if (!d) return
    ctx.imageSmoothingEnabled = smooth
    if (!s.alpha) ctx.clearRect(0, 0, w, h)
    ctx.drawImage(d, 0, 0, s.width, s.height, 0, 0, w, h)
    ctx.imageSmoothingEnabled = true
  })
  return out
}

function rotate(s: Surface, angle: number) {
  const a = (angle * Math.PI) / 180
  const w = Math.ceil(Math.abs(s.width * Math.cos(a)) + Math.abs(s.height * Math.sin(a)))
  const h = Math.ceil(Math.abs(s.width * Math.sin(a)) + Math.abs(s.height * Math.cos(a)))
  const out = new Surface([w, h], SRCALPHA)
  out.draw([s], (ctx) => {
    const d = s.drawable()
    if (!d) return
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-a)
    ctx.drawImage(d, -s.width / 2, -s.height / 2)
    ctx.restore()
  })
  return out
}

const shape = (surf: Surface, color: Color, width: number, path: (ctx: CanvasRenderingContext2D) => void) => {
  surf.draw([], (ctx) => {
    ctx.save()
    ctx.beginPath()
    path(ctx)
    if (width === 0) { ctx.fillStyle = css(parseColor(color)); ctx.fill() }
    else { ctx.strokeStyle = css(parseColor(color)); ctx.lineWidth = width; ctx.stroke() }
    ctx.restore()
  })
}

export const draw = {
  rect(surf: Surface, color: Color, rect: Rect | number[], width = 0) {
    const r = Rect.from(rect)
    if (width === 0) { surf.fill(color, r); return r }
    shape(surf, color, width, (ctx) => ctx.rect(r.x + width / 2, r.y + width / 2, r.w - width, r.h - width))
    return r
  },
  line(surf: Surface, color: Color, a: number[], b: number[], width = 1) {
    shape(surf, color, width, (ctx) => { ctx.moveTo(a[0] + 0.5, a[1] + 0.5); ctx.lineTo(b[0] + 0.5, b[1] + 0.5) })
  },
  lines(surf: Surface, color: Color, closed: boolean, pts: number[][], width = 1) {
    shape(surf, color, width, (ctx) => { pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + 0.5, p[1] + 0.5) : ctx.moveTo(p[0] + 0.5, p[1] + 0.5))); if (closed) ctx.closePath() })
  },
  polygon(surf: Surface, color: Color, pts: number[][], width = 0) {
    shape(surf, color, width, (ctx) => { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath() })
  },
  circle(surf: Surface, color: Color, c: number[], r: number, width = 0) {
    shape(surf, color, width, (ctx) => ctx.arc(c[0], c[1], r, 0, Math.PI * 2))
  },
  ellipse(surf: Surface, color: Color, rect: Rect | number[], width = 0) {
    const r = Rect.from(rect)
    shape(surf, color, width, (ctx) => ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2))
  },
}

export const pygame = {
  Rect,
  Surface,
  SRCALPHA,
  Color: (c: string) => parseColor(c),
  time: {
    get_ticks: () => Math.floor(performance.now() - t0),
    /** pygame.time.wait/delay bloqueaban el juego; en la web no se puede bloquear: no hacen nada. */
    wait: (_ms: number) => 0,
    delay: (_ms: number) => 0,
  },
  transform: {
    flip,
    scale: (s: Surface, size: number[]) => scale(s, size, false),
    smoothscale: (s: Surface, size: number[]) => scale(s, size, true),
    rotate,
  },
  draw,
  mouse: {
    get_pos: ev.get_pos,
    set_pos: ev.set_pos,
    get_pressed: ev.get_mouse_pressed,
    set_visible: ev.set_visible,
  },
  key: { get_pressed: ev.get_pressed, get_mods: ev.get_mods, set_repeat: ev.set_repeat },
  event: { get: ev.get, post: ev.post, Event: ev.Event, clear: ev.clear, set_grab: ev.set_grab, get_grab: ev.get_grab },
  mixer: {
    Sound: mixer.Sound,
    Channel: mixer.ChannelN,
    find_channel: mixer.find_channel,
    set_reserved: mixer.set_reserved,
    get_num_channels: mixer.get_num_channels,
    stop: mixer.stop,
  },
  display: { get_surface: () => screen! },
  font: { Font },
  QUIT: ev.QUIT, ACTIVEEVENT: ev.ACTIVEEVENT, KEYDOWN: ev.KEYDOWN, KEYUP: ev.KEYUP, MOUSEMOTION: ev.MOUSEMOTION,
  MOUSEBUTTONDOWN: ev.MOUSEBUTTONDOWN, MOUSEBUTTONUP: ev.MOUSEBUTTONUP, USEREVENT: ev.USEREVENT,
  ...ev.K,
  ...ev.KMOD,
}

export const { QUIT, ACTIVEEVENT, KEYDOWN, KEYUP, MOUSEMOTION, MOUSEBUTTONDOWN, MOUSEBUTTONUP, USEREVENT } = ev
export const K = ev.K
export const KMOD = ev.KMOD
export default pygame
