// Cola de eventos, teclado y mouse estilo pygame. El "shell" React traduce los eventos del
// navegador (mouse, toque y teclado) a estos eventos en coordenadas lógicas de 600x450.
export const QUIT = 12
export const ACTIVEEVENT = 1
export const KEYDOWN = 2
export const KEYUP = 3
export const MOUSEMOTION = 4
export const MOUSEBUTTONDOWN = 5
export const MOUSEBUTTONUP = 6
export const USEREVENT = 24

export interface PgEvent {
  type: number
  key?: number
  unicode?: string
  mod?: number
  pos?: [number, number]
  rel?: [number, number]
  buttons?: [number, number, number]
  button?: number
  gain?: number
  state?: number
  [k: string]: unknown
}

const queue: PgEvent[] = []
export function post(e: PgEvent) { queue.push(e) }
export function get(): PgEvent[] { return queue.splice(0) }
export function clear(type?: number) {
  if (type == null) queue.length = 0
  else for (let i = queue.length - 1; i >= 0; i--) if (queue[i].type === type) queue.splice(i, 1)
}
export function Event(type: number, attrs: Record<string, unknown> = {}): PgEvent { return { type, ...attrs } }
let grab = false
export function set_grab(v: boolean) { grab = v }
export function get_grab() { return grab }

// ---- Teclas (valores de pygame 1.9 / SDL 1.2) ----
export const K = {
  K_BACKSPACE: 8, K_TAB: 9, K_RETURN: 13, K_ESCAPE: 27, K_SPACE: 32, K_DELETE: 127,
  K_0: 48, K_1: 49, K_2: 50, K_3: 51, K_4: 52, K_5: 53, K_6: 54, K_7: 55, K_8: 56, K_9: 57,
  K_a: 97, K_b: 98, K_c: 99, K_d: 100, K_e: 101, K_f: 102, K_g: 103, K_h: 104, K_i: 105, K_j: 106, K_k: 107,
  K_l: 108, K_m: 109, K_n: 110, K_o: 111, K_p: 112, K_q: 113, K_r: 114, K_s: 115, K_t: 116, K_u: 117,
  K_v: 118, K_w: 119, K_x: 120, K_y: 121, K_z: 122,
  K_KP0: 256, K_KP1: 257, K_KP2: 258, K_KP3: 259, K_KP4: 260, K_KP5: 261, K_KP6: 262, K_KP7: 263, K_KP8: 264, K_KP9: 265,
  K_KP_ENTER: 271,
  K_UP: 273, K_DOWN: 274, K_RIGHT: 275, K_LEFT: 276, K_INSERT: 277, K_HOME: 278, K_END: 279, K_PAGEUP: 280, K_PAGEDOWN: 281,
  K_F1: 282, K_F2: 283, K_F3: 284, K_F4: 285, K_F5: 286, K_F6: 287, K_F7: 288, K_F8: 289, K_F9: 290, K_F10: 291, K_F11: 292, K_F12: 293,
  K_RSHIFT: 303, K_LSHIFT: 304, K_RCTRL: 305, K_LCTRL: 306, K_RALT: 307, K_LALT: 308,
}
export const KMOD = {
  KMOD_NONE: 0, KMOD_LSHIFT: 1, KMOD_RSHIFT: 2, KMOD_LCTRL: 64, KMOD_RCTRL: 128, KMOD_LALT: 256, KMOD_RALT: 512,
  KMOD_SHIFT: 3, KMOD_CTRL: 192, KMOD_ALT: 768,
}

const CODE_MAP: Record<string, number> = {
  Backspace: 8, Tab: 9, Enter: 13, NumpadEnter: 271, Escape: 27, Space: 32, Delete: 127,
  ArrowUp: 273, ArrowDown: 274, ArrowRight: 275, ArrowLeft: 276, Insert: 277, Home: 278, End: 279, PageUp: 280, PageDown: 281,
  ShiftRight: 303, ShiftLeft: 304, ControlRight: 305, ControlLeft: 306, AltRight: 307, AltLeft: 308,
}
for (let i = 0; i <= 9; i++) { CODE_MAP['Digit' + i] = 48 + i; CODE_MAP['Numpad' + i] = 256 + i }
for (let i = 1; i <= 12; i++) CODE_MAP['F' + i] = 281 + i
for (let c = 0; c < 26; c++) CODE_MAP['Key' + String.fromCharCode(65 + c)] = 97 + c

export function keyFromDom(e: { code: string; key: string }): number {
  const k = CODE_MAP[e.code]
  if (k !== undefined) return k
  if (e.key.length === 1) return e.key.toLowerCase().charCodeAt(0)
  return 0
}

const pressed = new Set<number>()
let mods = 0
export function setKey(key: number, down: boolean) { if (down) pressed.add(key); else pressed.delete(key) }
export function setMods(m: number) { mods = m }
export function releaseAllKeys() { pressed.clear(); mods = 0 }
/** pygame.key.get_pressed(): indexable por código de tecla */
export function get_pressed(): Record<number, boolean> {
  return new Proxy({}, { get: (_t, p) => pressed.has(Number(p)) }) as Record<number, boolean>
}
export function get_mods() { return mods }
let repeat: [number, number] | null = null
export function set_repeat(delay?: number, interval?: number) { repeat = delay ? [delay, interval ?? delay] : null }
export function get_repeat() { return repeat }

// ---- Mouse ----
export const mouse = {
  x: -1000,
  y: -1000,
  buttons: [0, 0, 0] as [number, number, number],
  visible: true,
  /** "mouse" o "touch": con el dedo no se dibuja el cursor por defecto */
  pointer: 'mouse' as 'mouse' | 'touch',
}
export function get_pos(): [number, number] { return [mouse.x, mouse.y] }
export function set_pos(x: number | number[], y?: number) {
  if (typeof x !== 'number') { y = x[1]; x = x[0] }
  mouse.x = Math.trunc(x)
  mouse.y = Math.trunc(y!)
}
export function get_mouse_pressed(): [number, number, number] { return [...mouse.buttons] as [number, number, number] }
export function set_visible(v: boolean) { mouse.visible = v }
