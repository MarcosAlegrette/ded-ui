// Traduce mouse, toque y teclado del navegador a eventos pygame en coordenadas lógicas 600x450.
import * as ev from '../pg/events.ts'
import { mouse } from '../pg/events.ts'
import { unlock } from '../pg/mixer.ts'

export interface InputTarget {
  /** procesa la cola de eventos ya mismo (para que el teclado del celular se abra dentro del gesto) */
  tickNow(): void
}

let keyboardEnabled = true
/** Mientras hay un formulario React abierto (cuenta), el teclado no va al juego. */
export function setGameKeyboard(v: boolean) { keyboardEnabled = v }

export function attachInput(canvas: HTMLCanvasElement, target: InputTarget, textInput: HTMLInputElement) {
  let last: [number, number] = [mouse.x, mouse.y]
  const toLogical = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * 600)
    const y = Math.floor(((e.clientY - r.top) / r.height) * 450)
    return [Math.max(0, Math.min(599, x)), Math.max(0, Math.min(449, y))]
  }
  const motion = (pos: [number, number]) => {
    const rel: [number, number] = [pos[0] - last[0], pos[1] - last[1]]
    last = pos
    mouse.x = pos[0]
    mouse.y = pos[1]
    ev.post({ type: ev.MOUSEMOTION, pos, rel, buttons: [...mouse.buttons] as [number, number, number] })
  }

  const onMove = (e: PointerEvent) => {
    mouse.pointer = e.pointerType === 'mouse' ? 'mouse' : 'touch'
    motion(toLogical(e))
  }
  const onDown = (e: PointerEvent) => {
    unlock()
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    mouse.pointer = e.pointerType === 'mouse' ? 'mouse' : 'touch'
    try { canvas.setPointerCapture(e.pointerId) } catch { /* nada */ }
    const pos = toLogical(e)
    if (pos[0] !== mouse.x || pos[1] !== mouse.y) motion(pos)
    mouse.buttons = [1, 0, 0]
    ev.post({ type: ev.MOUSEBUTTONDOWN, pos, button: 1 })
    target.tickNow()
  }
  const onUp = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const pos = toLogical(e)
    if (pos[0] !== mouse.x || pos[1] !== mouse.y) motion(pos)
    mouse.buttons = [0, 0, 0]
    ev.post({ type: ev.MOUSEBUTTONUP, pos, button: 1 })
    target.tickNow()
    if (e.pointerType !== 'mouse') {
      // al levantar el dedo el "mouse" se va de la pantalla, para que no queden rollovers pegados
      setTimeout(() => { if (mouse.buttons[0] === 0 && mouse.pointer === 'touch') motion([-1000, -1000]) }, 350)
    }
  }
  const onLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse' && mouse.buttons[0] === 0) motion([-1000, -1000]) }

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  const mods = (e: KeyboardEvent) =>
    (e.shiftKey ? ev.KMOD.KMOD_LSHIFT : 0) | (e.ctrlKey ? ev.KMOD.KMOD_LCTRL : 0) | (e.altKey ? ev.KMOD.KMOD_LALT : 0)
  const onKeyDown = (e: KeyboardEvent) => {
    if (!keyboardEnabled) return
    if (e.target instanceof HTMLInputElement && e.target !== textInput) return
    unlock()
    const key = ev.keyFromDom(e)
    ev.setKey(key, true)
    ev.setMods(mods(e))
    if (e.target === textInput) return // lo maneja el evento "input"/"keydown" del campo oculto
    if ([ev.K.K_UP, ev.K.K_DOWN, ev.K.K_LEFT, ev.K.K_RIGHT, ev.K.K_SPACE, ev.K.K_BACKSPACE, ev.K.K_TAB].includes(key)) e.preventDefault()
    ev.post({ type: ev.KEYDOWN, key, unicode: e.key.length === 1 ? e.key : '', mod: mods(e) })
  }
  const onKeyUp = (e: KeyboardEvent) => {
    const key = ev.keyFromDom(e)
    ev.setKey(key, false)
    ev.setMods(mods(e))
    if (!keyboardEnabled) return
    ev.post({ type: ev.KEYUP, key, mod: mods(e) })
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', () => ev.releaseAllKeys())

  // Campo de texto oculto: en celulares abre el teclado cuando un texto editable del juego toma el foco
  textInput.addEventListener('keydown', (e) => {
    const key = ev.keyFromDom(e)
    if ([ev.K.K_BACKSPACE, ev.K.K_RETURN, ev.K.K_KP_ENTER, ev.K.K_LEFT, ev.K.K_RIGHT, ev.K.K_DELETE, ev.K.K_HOME, ev.K.K_END, ev.K.K_ESCAPE].includes(key)) {
      e.preventDefault()
      ev.post({ type: ev.KEYDOWN, key, unicode: '', mod: 0 })
      if (key === ev.K.K_RETURN || key === ev.K.K_KP_ENTER) textInput.blur()
    }
  })
  textInput.addEventListener('input', () => {
    const v = textInput.value
    textInput.value = ''
    for (const ch of v) ev.post({ type: ev.KEYDOWN, key: ch.toLowerCase().charCodeAt(0), unicode: ch, mod: 0 })
  })
}
