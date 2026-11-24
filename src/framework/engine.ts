// Port de framework/engine.py: el "Game" con la ventana lógica de 600x450 a 40 cuadros por segundo,
// el cambio de escenas (_ChangeStageDummy) y la pantalla de carga con persiana.
import pygame, { Surface } from '../pg/index.ts'
import { setScreen } from '../pg/index.ts'
import { whenIdle } from '../pg/surface.ts'
import * as mixer from '../pg/mixer.ts'
import * as ev from '../pg/events.ts'
import * as assets from './assets.ts'
import * as animations from './animations.ts'
import { ItemImage, Layer, type Stage } from './stage.ts'
import { Stats } from './stats.ts'

export const SCREEN_FACTOR = 1
export const SCREEN_WIDTH = 600
export const SCREEN_HEIGHT = 450
const FPS = 40

export class Game {
  display: Surface
  window: Surface
  mixer_params: [number, number, number, number] = [44100, -16, 2, 1024]
  loading_layer: Layer | null = null
  hide_loading_callback: ((l: Layer | null) => void) | null = null
  datastore: any = null
  update_manager: any = null
  stats = new Stats()
  /** callbacks del shell (la web) */
  onQuit: (() => void) | null = null
  onStageChange: ((stage: any) => void) | null = null
  private _stage: any = null
  private _next_stage: any = null
  private _default_mouse_cursor: assets.Image | null
  private _loading_image: string | null
  private _frame_delay = 0
  private _quit = false
  private _quit_on_escape = true
  private _loading_start: number | null = null
  private _last = 0
  private _raf = 0
  private _empty_sound: assets.CustomSound

  constructor(canvas: HTMLCanvasElement, _title: string, default_mouse_cursor: string | null = null, loading_image: string | null = null) {
    mixer.set_reserved(1)
    this._empty_sound = assets.load_sound('Silence.ogg')
    canvas.width = SCREEN_WIDTH
    canvas.height = SCREEN_HEIGHT
    this.display = Surface.fromCanvas(canvas, false)
    this.display.isScreen = true
    this.window = this.display
    setScreen(this.display)
    this._default_mouse_cursor = default_mouse_cursor == null ? null : assets.load_image(default_mouse_cursor)
    this._loading_image = loading_image
  }

  run(initial_stage: Stage) {
    this.set_stage(initial_stage)
    this._last = performance.now()
    const loop = (t: number) => {
      if (this._quit) return
      this._raf = requestAnimationFrame(loop)
      const dt = t - this._last
      if (dt < 1000 / FPS - 2) return
      this._last = t
      this._frame_delay = Math.min(Math.round(dt), 250)
      try {
        this._stage.notify_tick()
      } catch (e) {
        console.error(e)
      }
    }
    this._raf = requestAnimationFrame(loop)
  }

  quit() {
    if (this._stage != null) {
      const h = this._stage.get_closed_handler?.()
      if (h != null) h(this._stage)
    }
    this.stats.save_if_pending()
    this.onQuit?.()
  }

  stop() { this._quit = true; cancelAnimationFrame(this._raf) }

  /** Procesa ya mismo los eventos pendientes (desde un gesto del usuario). */
  tickNow() {
    if (!this._stage || this._quit) return
    const fd = this._frame_delay
    this._frame_delay = 0
    try { this._stage.notify_tick() } catch (e) { console.error(e) }
    this._frame_delay = fd
  }
  get_stage() { return this._stage }
  get_show_fps() { return false }
  set_show_fps(_v: boolean) {}
  get_quit_on_escape() { return this._quit_on_escape }
  set_quit_on_escape(v: boolean) { this._quit_on_escape = v }
  get_default_mouse_cursor() { return this._default_mouse_cursor }
  get_design_stage() { return null }
  set_design_stage(_s: unknown) {}
  get_test_stage() { return null }
  set_test_stage(_s: unknown) {}
  get_development_mode() { return false }
  set_development_mode(_v: boolean) {}
  get_empty_sound() { return this._empty_sound }
  get_window_size(): [number, number] { return [SCREEN_WIDTH, SCREEN_HEIGHT] }
  get_frame_delay() { return this._frame_delay }

  set_stage(stage: Stage, show_loading = false, loading_image: string | null = null) {
    const next = new ChangeStageDummy(this, this._stage, stage)
    if (!show_loading) this._stage = next
    else {
      this._next_stage = next
      this.show_loading(() => { this._stage = this._next_stage; this._next_stage = null }, loading_image)
    }
  }

  show_loading(callback: (l: Layer) => void, loading_image: string | null = null) {
    this._stage.stop_music()
    if (this.loading_layer != null) {
      const stage = this.loading_layer.get_stage()
      if (stage != null) {
        animations.cancel_blind_layer(stage, this.loading_layer, false)
        stage.remove_layer(this.loading_layer)
      }
    }
    this.loading_layer = new Layer()
    const image = assets.load_image(loading_image ?? this._loading_image!)
    this.loading_layer.add(new ItemImage(0, 0, image))
    this.loading_layer.stage = this._stage
    this._stage.redraw_mouse()
    if (this._loading_start == null) this._loading_start = pygame.time.get_ticks()
    animations.blind_layer(this.loading_layer, animations.BlindDirection.SHOW_DOWN, null, 450, callback)
  }

  add_loading_to_stage() {
    const layer = this.loading_layer
    if (layer != null) {
      layer.stage = null
      this._stage.add_layer(layer)
    }
    this.loading_layer = null
    return layer
  }

  /** Oculta la pantalla de carga. Espera (como mínimo 1,5 s, igual que el original) a que
   *  terminen de descargarse las imágenes que pidió la escena nueva. */
  hide_loading(callback: ((l: Layer | null) => void) | null = null, blind = true) {
    if (this.loading_layer != null) {
      const layer = this.loading_layer
      const elapsed = this._loading_start != null ? pygame.time.get_ticks() - this._loading_start : 99999
      this._loading_start = null
      this.hide_loading_callback = callback
      const go = () => {
        if (this.loading_layer !== layer) return
        if (layer.get_stage() != null) {
          if (blind) animations.blind_layer(layer, animations.BlindDirection.HIDE_UP, null, 450, (l) => this._blind_hide_loading_callback(l))
          else this._blind_hide_loading_callback(layer)
        }
      }
      const minWait = new Promise((r) => setTimeout(r, Math.max(0, 1500 - elapsed)))
      const loads = Promise.race([whenIdle(), new Promise((r) => setTimeout(r, 20000))])
      void Promise.all([minWait, loads]).then(go)
    } else if (callback != null) callback(null)
  }

  private _blind_hide_loading_callback(layer: Layer) {
    this._stage.redraw_mouse()
    this.loading_layer = null
    const callback = this.hide_loading_callback
    this.hide_loading_callback = null
    if (callback != null) callback(layer)
  }

  /** usado por _ChangeStageDummy */
  _setStage(s: any) { this._stage = s; this.onStageChange?.(s) }
}

class ChangeStageDummy {
  private game: Game
  private old_stage: any
  private new_stage: any
  initialized = true
  constructor(game: Game, old_stage: any, new_stage: any) {
    this.game = game
    this.old_stage = old_stage
    this.new_stage = new_stage
  }
  notify_tick() {
    const old_stage = this.old_stage
    this.game._setStage(this.new_stage)
    if (old_stage != null) {
      old_stage.set_focus(null)
      const h = old_stage.get_closed_handler()
      if (h != null) h(old_stage)
      old_stage.close()
    }
    ev.set_grab(false)
    if (old_stage != null) {
      old_stage.stop_music()
      old_stage.stop_sounds()
    }
    if (this.game.loading_layer != null) this.game.loading_layer.stage = null
    this.old_stage = null
    this.new_stage.play_music()
    if (!this.new_stage.initialized) {
      this.new_stage.initialize()
      this.new_stage.initialized = true
    }
    if (this.game.loading_layer != null) this.game.loading_layer.stage = this.new_stage
    this.new_stage.redraw()
    this.new_stage.prepare()
    if (this.game.loading_layer != null) this.game.hide_loading(this.game.hide_loading_callback)
    this.new_stage.render(true)
  }
  set_focus() {}
  close() {}
  stop_music() {}
  stop_sounds() {}
  redraw_mouse() {}
  get_closed_handler() { return null }
}
