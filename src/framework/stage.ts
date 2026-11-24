// Port de framework/stage.py (motor de escenas del juego original).
// Se mantienen los nombres y la semántica de Python (Stage, Layer, ItemImage, ItemText, timers,
// diálogos, rollovers, foco, StageIso...). La diferencia es que en lugar de "dirty rects" se
// redibuja la escena completa en cada cuadro (600x450 en canvas es barato).
import pygame, { Rect, Surface, SRCALPHA, type Color } from '../pg/index.ts'
import { Font } from '../pg/font.ts'
import * as ev from '../pg/events.ts'
import { mouse } from '../pg/events.ts'
import { ChannelN } from '../pg/mixer.ts'
import { css } from '../pg/surface.ts'
import * as assets from './assets.ts'
import type { CustomSound, Image } from './assets.ts'

export { Rect, Surface, SRCALPHA, pygame }
export const MUSIC_ENDSOUND_EVENT = ev.USEREVENT
export const STREAM_MUSIC = false
export const DBLCLICK_DELAY = 500
export const { KEYDOWN, KEYUP, MOUSEMOTION, MOUSEBUTTONDOWN, MOUSEBUTTONUP, QUIT, ACTIVEEVENT } = ev
export const K = ev.K
export const KMOD = ev.KMOD

/** Igualdad de claves de timers: las tuplas de Python se comparan elemento a elemento. */
export function keyEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => keyEq(x, b[i]))
  return false
}

type Handler = (item: any, args: any) => unknown
export type TimerFunc = (key: any, data: any) => void

export class TimerData {
  key: unknown
  tick: number
  milliseconds: number
  func: TimerFunc
  data: any
  drop_ticks: boolean
  render_first: boolean
  constructor(key: unknown, milliseconds: number, func: TimerFunc, data: any, drop_ticks: boolean, render_first: boolean) {
    this.key = key
    this.tick = pygame.time.get_ticks() + milliseconds
    this.milliseconds = milliseconds
    this.func = func
    this.data = data
    this.drop_ticks = drop_ticks
    this.render_first = render_first
  }
}

type Dialog = [Layer, ((e: ev.PgEvent) => unknown) | null, Layer | null, Layer | null, (() => void) | null]

export class Stage {
  game: any
  layers: Layer[] = []
  initialized = false
  target_surface: Surface | null
  protected _dialogs: Dialog[] = []
  private _changed_handler: ((s: Stage) => void) | null = null
  private _closed_handler: ((s: Stage) => void) | null = null
  private _last_click: number | null = null
  private _locks = 0
  private _background: Image | null = null
  private _background_color: Color = [0, 0, 0]
  private _timers: TimerData[] = []
  private _music: [CustomSound | null, CustomSound | null] | null = null
  private _music_data: [CustomSound | null, CustomSound | null] | null = null
  private _over_item: Item | null = null
  private _focused_item: [Item, any] | null = null
  private _prerender_to_layer: Layer | null = null
  private _mouse_layer: Layer | null = null
  private _mouse_cursor: Item | null = null
  private _mouse_snap_to_cursor = false
  private _mouse_update = false
  private _mouse_real_pos: [number, number] | null = null
  private _use_mouse_layer = false
  private _mouse_pointer: number[] = [0, 0]
  private _mouse_move_area: any = null
  private _leftmousedown_handlers: [Item, (args: ItemEventArgsMouse, released: boolean) => void][] = []
  private _default_mouse_cursor: ItemImage | null = null
  private _previous_active = true

  constructor(game: any, background_image: Image | null = null, target_surface: Surface | null = null) {
    this.game = game
    this.target_surface = target_surface
    this._load_background(background_image)
    if (target_surface != null) this._default_mouse_cursor = null
    else {
      const default_mouse_cursor = game.get_default_mouse_cursor()
      if (default_mouse_cursor != null) {
        this._default_mouse_cursor = new ItemImage(0, 0, default_mouse_cursor)
        this._default_mouse_cursor.is_default_cursor = true
        this.set_mouse_cursor(this._default_mouse_cursor)
      } else this._default_mouse_cursor = null
    }
  }

  initialize() {}
  close() {}

  set_prerender_buffer(to_layer: Layer | null) { this._prerender_to_layer = to_layer }

  add_layer(layer: Layer, index = -1) {
    layer.set_stage(this)
    if (index === -1) this.layers.push(layer)
    else this.layers.splice(index, 0, layer)
    layer.set_dirty()
    this._mouse_update = true
  }

  remove_layer(layer: Layer) {
    const i = this.layers.indexOf(layer)
    if (i >= 0) {
      if (this._focused_item != null && this._focused_item[0].get_layer() === layer) this.set_focus(null)
      layer.set_stage(null)
      this.layers.splice(i, 1)
      this.redraw()
      if (this._prerender_to_layer === layer) this.set_prerender_buffer(null)
      for (let k = 0; k < this._dialogs.length; k++) {
        if (this._dialogs[k][0] === layer) { this._dialogs.splice(k, 1); break }
      }
      this._mouse_update = true
    }
  }

  empty_layers(except_layers: Layer[] | null = null) {
    if (except_layers == null) {
      for (const l of this.layers) l.set_stage(null)
      this.layers.length = 0
    } else {
      for (let k = this.layers.length - 1; k >= 0; k--) {
        const l = this.layers[k]
        if (!except_layers.includes(l)) { l.set_stage(null); this.layers.splice(k, 1) }
      }
    }
    this._dialogs.length = 0
    this.set_prerender_buffer(null)
    this.redraw()
  }

  contains_layer(layer: Layer) { return this.layers.includes(layer) }

  show_dialog(layer: Layer, event_handler: ((e: ev.PgEvent) => unknown) | null, background_color: Color | null = [0, 0, 0, 180], prerender_below = true, callback: (() => void) | null = null) {
    if (this.layers.includes(layer)) throw new Error('The layer must be a layer of the stage if you want to use it as a dialog')
    let previous_prerender_layer: Layer | null = null
    if (prerender_below) {
      previous_prerender_layer = this._prerender_to_layer
      if (this.layers.length > 0) this.set_prerender_buffer(this.layers[this.layers.length - 1])
    }
    let background_layer: Layer | null = null
    if (background_color != null) {
      const [window_width, window_height] = this.game.get_window_size()
      const background_surface = new Surface([window_width, window_height], SRCALPHA)
      background_surface.fill(background_color)
      const background_image = new assets.Image(background_surface)
      background_layer = new Layer()
      background_layer.add(new ItemImage(0, 0, background_image))
      this.add_layer(background_layer)
    }
    if (ev.get_grab()) ev.set_grab(false)
    this.add_layer(layer)
    this._dialogs.push([layer, event_handler, background_layer, previous_prerender_layer, callback])
    this.set_mouse_cursor(null)
  }

  close_dialog(layer: Layer) {
    let callback: (() => void) | null = null
    for (const dialog of this._dialogs.slice()) {
      if (dialog[0] === layer) {
        callback = dialog[4]
        const di = this._dialogs.indexOf(dialog)
        if (di >= 0) this._dialogs.splice(di, 1)
        let k = 0
        while (k < this.layers.length) {
          if (this.layers[k] === layer) {
            this.remove_layer(layer)
            while (k < this.layers.length) this.remove_layer(this.layers[k])
          }
          k += 1
        }
        const background_layer = dialog[2]
        if (background_layer != null) this.remove_layer(background_layer)
        const previous_prerender_layer = dialog[3]
        if (previous_prerender_layer != null) {
          if (this.layers.includes(previous_prerender_layer)) this.set_prerender_buffer(previous_prerender_layer)
          else this.set_prerender_buffer(null)
        }
      }
    }
    if (callback != null) callback()
  }

  has_dialog_opened() { return this._dialogs.length > 0 }

  blind_dialog(layer: Layer, direction: number, background = true, ignore_layers: Layer[] = [], callback: ((l: Layer) => void) | null = null) {
    const layers_to_blind: Layer[] = []
    const duration = 450
    for (const dialog of this._dialogs) {
      if (dialog[0] === layer) {
        const count = this.layers.length
        if (dialog[2] != null && background) layers_to_blind.push(dialog[2])
        if (!ignore_layers.includes(layer)) layers_to_blind.push(layer)
        if (this.layers.includes(layer)) {
          let k = this.layers.indexOf(layer) + 1
          while (k < count) {
            const above_layer = this.layers[k]
            if (!ignore_layers.includes(above_layer)) layers_to_blind.push(above_layer)
            k += 1
          }
        }
        break
      }
    }
    let callback_assigned = false
    for (let i = 0; i < layers_to_blind.length; i++) {
      let blind_callback: ((l: Layer) => void) | null = null
      if (i === layers_to_blind.length - 1) { blind_callback = callback; callback_assigned = true }
      blindLayerHook!(layers_to_blind[i], direction, null, duration, blind_callback)
    }
    if (!callback_assigned && callback != null) callback(layer)
  }

  lock_ui() { this._locks += 1; this._mouse_update = true }
  unlock_ui() { this._locks -= 1; this._mouse_update = true }
  get_locks() { return this._locks }
  update_mouse() { this._mouse_update = true }

  hit_test(x: number, y: number): Item | null {
    if (this._locks === 0) {
      const dialog_layer = this._dialogs.length ? this._dialogs[this._dialogs.length - 1][0] : null
      for (let i = this.layers.length - 1; i >= 0; i--) {
        const layer = this.layers[i]
        if (layer.get_visible() && layer.is_inside_clip(x, y)) {
          for (let k = layer.items.length - 1; k >= 0; k--) {
            const item = layer.items[k]
            if (item.get_visible() && item.is_over(x, y)) return item
          }
        }
        if (dialog_layer != null && layer === dialog_layer) break
      }
    }
    return null
  }

  hit_test_stack(x: number, y: number, ignore_clip = false): Item[] {
    const stack: Item[] = []
    const l = this.layers.length
    let i: number
    if (this._locks > 0) i = l
    else if (this._dialogs.length === 0) i = 0
    else {
      const dialog_layer = this._dialogs[this._dialogs.length - 1][0]
      i = l - 1
      while (i > 0) {
        if (this.layers[i] === dialog_layer) break
        i -= 1
      }
    }
    while (i < l) {
      const layer = this.layers[i]
      if (layer.get_visible() && (ignore_clip || layer.is_inside_clip(x, y))) {
        for (let k = layer.items.length - 1; k >= 0; k--) {
          const item = layer.items[k]
          if (item.get_visible() && item.is_over(x, y, ignore_clip)) stack.push(item)
        }
      }
      i += 1
    }
    return stack
  }

  set_music(intro: CustomSound | null, loop: CustomSound | null) {
    this._music = intro == null && loop == null ? null : [intro, loop]
  }
  get_music() { return this._music }
  same_music(stage: Stage) {
    const a = this._music, b = stage._music
    if (a == null || b == null) return a === b
    return a[0]?.sound === b[0]?.sound && a[1]?.sound === b[1]?.sound
  }

  play_music(intro: CustomSound | null = null, loop: CustomSound | null = null) {
    this.stop_music()
    if (intro == null && loop == null && this._music != null) { intro = this._music[0]; loop = this._music[1] }
    if (intro != null || loop != null) {
      this._music_data = [intro, loop]
      const music_channel = ChannelN(0)
      music_channel.set_volume(1)
      if (intro != null) {
        music_channel.play(intro.sound, 0, 0)
        if (loop) music_channel.queue(loop.sound)
        music_channel.set_endevent(MUSIC_ENDSOUND_EVENT)
      } else music_channel.play(loop!.sound, -1)
    }
  }

  set_music_volume(volume: number, fadems = 200, pause = false) {
    this.stop_timer('set_music_volume')
    const current_volume = ChannelN(0).get_volume()
    this.start_timer('set_music_volume', 1, (k, d) => this._on_set_music_volume(k, d), [current_volume, volume, fadems, pygame.time.get_ticks(), pause], true, false)
  }
  pause_music(fadems = 450) { this.set_music_volume(0, fadems, true) }
  unpause_music(fadems = 450) { ChannelN(0).unpause(); this.set_music_volume(1, fadems) }

  stop_music() {
    this.stop_timer('set_music_volume')
    if (this._music_data != null) {
      this._music_data = null
      const music_channel = ChannelN(0)
      music_channel.set_endevent()
      music_channel.fadeout(200)
    }
  }

  stop_sounds() {
    const total = pygame.mixer.get_num_channels()
    for (let i = 1; i < total; i++) ChannelN(i).stop()
  }

  get_mouse_cursor() { return this._mouse_cursor }

  set_mouse_cursor(cursor: Item | null, pointer: number[] = [0, 0], use_mouse_layer = true, update_item_pos = true, move_area: any = null) {
    if (this._mouse_cursor !== cursor) {
      if (use_mouse_layer) {
        if (this._mouse_layer == null) { this._mouse_layer = new Layer(); this._mouse_layer.set_stage(this) }
        if (cursor == null) this._mouse_layer.empty()
        else if (!this._mouse_layer.contains(cursor)) { this._mouse_layer.empty(); this._mouse_layer.add(cursor) }
      } else if (this._mouse_layer != null) this._mouse_layer.empty()
      if (update_item_pos) {
        if (cursor != null && this._mouse_snap_to_cursor) {
          if (this._mouse_cursor != null) {
            const x = this._mouse_cursor.get_left() + this._mouse_pointer[0]
            const y = this._mouse_cursor.get_top() + this._mouse_pointer[1]
            cursor.set_lefttop(x - pointer[0], y - pointer[1])
          }
        } else if (cursor != null) {
          const [x, y] = pygame.mouse.get_pos()
          cursor.set_lefttop(x - pointer[0], y - pointer[1])
        }
      }
      this._mouse_cursor = cursor
      this._use_mouse_layer = use_mouse_layer
      this._mouse_move_area = move_area
      this._mouse_pointer = pointer
      this._mouse_update = true
      if (cursor != null && !update_item_pos) this._mouse_snap_to_cursor = true
      if (cursor == null) {
        if (this._default_mouse_cursor != null) {
          this.set_mouse_cursor(this._default_mouse_cursor)
          pygame.mouse.set_visible(false)
          this._mouse_snap_to_cursor = false
        } else pygame.mouse.set_visible(true)
      } else pygame.mouse.set_visible(false)
    }
  }

  set_mouse_pos(x: number, y: number) {
    if (this._mouse_cursor != null) {
      this._mouse_cursor.set_lefttop(x - this._mouse_pointer[0], y - this._mouse_pointer[1])
      this._mouse_snap_to_cursor = true
    }
  }

  redraw_mouse() { this._mouse_layer?.set_dirty() }

  capture_leftmousedown(item: Item, handler: (args: ItemEventArgsMouse, released: boolean) => void) {
    const button1 = pygame.mouse.get_pressed()[0]
    if (!button1) {
      const [x, y] = pygame.mouse.get_pos()
      handler(new ItemEventArgsMouse(x, y), true)
    } else {
      let handler_defined = false
      for (const hd of this._leftmousedown_handlers) if (hd[0] === item && hd[1] === handler) { handler_defined = true; break }
      if (!handler_defined) this._leftmousedown_handlers.push([item, handler])
    }
  }

  start_timer(key: unknown, milliseconds: number, func: TimerFunc, data: any = null, drop_ticks = false, render_first = false) {
    for (let i = 0; i < this._timers.length; i++) {
      if (keyEq(this._timers[i].key, key)) { this.stop_timer(key); break }
    }
    milliseconds = Math.max(1, milliseconds)
    this._timers.push(new TimerData(key, milliseconds, func, data, drop_ticks, render_first))
  }

  stop_timer(key: unknown) {
    for (let i = 0; i < this._timers.length; i++) {
      if (keyEq(this._timers[i].key, key)) {
        const data = this._timers[i].data
        this._timers.splice(i, 1)
        return data
      }
    }
    return null
  }

  stop_timers() {
    // Si se cortan animaciones que bloqueaban la interfaz (persianas, esperas bloqueantes) se
    // libera su bloqueo, si no la escena quedaría sin responder a los clics.
    for (const t of this._timers) {
      const k = t.key as any
      if (Array.isArray(k) && ((k[1] === 'blind' && t.data?.[9]) || k[0] === 'wait_locked')) this.unlock_ui()
    }
    this._timers.length = 0
  }
  is_timer_started(key: unknown) { return this._timers.some((t) => keyEq(t.key, key)) }
  get_timer_data(key: unknown) { return this._timers.find((t) => keyEq(t.key, key))?.data ?? null }
  get_key_repeat(): [number, number] | null { return null }
  get_changed_handler() { return this._changed_handler }
  set_changed_handler(h: ((s: Stage) => void) | null) { this._changed_handler = h }
  get_closed_handler() { return this._closed_handler }
  set_closed_handler(h: ((s: Stage) => void) | null) { this._closed_handler = h }

  set_focus(item: Item | null, set_focus_data: any = null) {
    const old = this._focused_item
    const old_item = old ? old[0] : null
    const old_data = old ? old[1] : null
    if (old_item !== item) {
      this._focused_item = null
      if (old_item != null) {
        old_item.on_lost_focus(this, old_data)
        old_item.fire_event(ItemEvent.LOST_FOCUS, new ItemEventArgs())
      }
      if (item == null) this._focused_item = null
      else {
        const data = item.on_got_focus(set_focus_data)
        this._focused_item = [item, data]
        item.fire_event(ItemEvent.GOT_FOCUS, new ItemEventArgs())
      }
      focusHook?.(this._focused_item ? this._focused_item[0] : null)
    }
  }

  get_focus() { return this._focused_item ? this._focused_item[0] : null }
  get_focus_data() { return this._focused_item ? this._focused_item[1] : null }
  get_over_item() { return this._over_item }

  notify_tick() {
    let event_handler: ((e: ev.PgEvent) => unknown) | null
    if (this._locks > 0) event_handler = null
    else if (this._dialogs.length === 0) event_handler = (e) => this.handle_event(e)
    else event_handler = this._dialogs[this._dialogs.length - 1][1]
    const mouse_rel = [0, 0]
    let mouse_motion_args: [number, number, number[], number, number] | null = null
    for (const event of ev.get()) {
      let processed = false
      if (event.type === ev.MOUSEMOTION) {
        mouse_rel[0] += event.rel![0]
        mouse_rel[1] += event.rel![1]
        mouse_motion_args = [event.pos![0], event.pos![1], event.buttons!, mouse_rel[0], mouse_rel[1]]
      } else if (event.type === ev.QUIT) {
        this.game.quit()
        processed = true
      } else if (event.type === ev.KEYDOWN) {
        if (event.key === ev.K.K_ESCAPE && this.game.get_quit_on_escape()) { this.game.quit(); processed = true }
      } else if (event.type === ev.MOUSEBUTTONDOWN) {
        if (mouse_motion_args) { this._on_mouse_move(...mouse_motion_args); mouse_motion_args = null; mouse_rel[0] = mouse_rel[1] = 0 }
        this._on_mouse_button_down(event.pos![0], event.pos![1], event.button!)
      } else if (event.type === ev.MOUSEBUTTONUP) {
        if (mouse_motion_args) { this._on_mouse_move(...mouse_motion_args); mouse_motion_args = null; mouse_rel[0] = mouse_rel[1] = 0 }
        this._on_mouse_button_up(event.pos![0], event.pos![1], event.button!)
      } else if (event.type === ev.ACTIVEEVENT) {
        if (event.gain) {
          if (!this._previous_active) {
            if (this._use_mouse_layer && this._mouse_layer != null && this._mouse_cursor && !this._mouse_layer.contains(this._mouse_cursor)) this._mouse_layer.add(this._mouse_cursor)
            this._previous_active = true
          }
        } else if (this._previous_active) {
          this._mouse_layer?.empty()
          this._previous_active = false
        }
      } else if (event.type === MUSIC_ENDSOUND_EVENT) {
        if (this._music_data != null && this._music_data[1]) ChannelN(0).queue(this._music_data[1].sound)
      }
      if (!processed) {
        if (this._focused_item != null && this._focused_item[0].handle_event_focused(event, this._focused_item[1])) processed = true
        if (!processed && event_handler != null) event_handler(event)
      }
    }
    if (mouse_motion_args) this._on_mouse_move(...mouse_motion_args)
    if (this._mouse_update) { this._mouse_update = false; this.render(true) }
    else this.render(false)
  }

  private _on_set_music_volume(key: unknown, data: any[]) {
    const [start_volume, target_volume, fadems, start_time, pause] = data
    const elapsed_time = pygame.time.get_ticks() - start_time
    let end_of_set = false
    let volume: number
    if (elapsed_time >= fadems) { volume = target_volume; this.stop_timer(key); end_of_set = true }
    else volume = start_volume + ((target_volume - start_volume) / fadems) * elapsed_time
    const music_channel = ChannelN(0)
    music_channel.set_volume(volume)
    if (end_of_set && pause) music_channel.pause()
  }

  private _on_mouse_move(x: number, y: number, buttons: number[], _rel_x: number, _rel_y: number) {
    if (this._use_mouse_layer && this._mouse_layer != null && this._mouse_cursor && !this._mouse_layer.contains(this._mouse_cursor)) this._mouse_layer.add(this._mouse_cursor)
    this._previous_active = true
    const item_stack = this._update_over_item(x, y)
    this._fire_routed_event(item_stack, ItemEvent.MOUSE_MOVE, new ItemEventArgsMouse(x, y))
    if (buttons[0] === 1 && this._leftmousedown_handlers.length > 0) {
      const args = new ItemEventArgsMouse(x, y)
      for (const hd of this._leftmousedown_handlers.slice()) hd[1](args, false)
    }
  }

  private _on_mouse_button_down(x: number, y: number, button: number) {
    if (button === 1) {
      let item_stack: Item[] | null = null
      if (this._mouse_cursor != null && this.target_surface == null) {
        // en la web el clic puede llegar en el mismo instante que el movimiento (o sin movimiento previo,
        // con el dedo): se lleva el cursor a la posición real antes de usarlo
        const pos = pygame.mouse.get_pos()
        if (this._mouse_real_pos == null || pos[0] !== this._mouse_real_pos[0] || pos[1] !== this._mouse_real_pos[1]) {
          this._mouse_real_pos = pos
          this._update_over_item(pos[0], pos[1])
          this._update_mouse_cursor_position(pos[0], pos[1])
        }
      }
      if (this._mouse_cursor != null) {
        x = this._mouse_cursor.get_left() + this._mouse_pointer[0]
        y = this._mouse_cursor.get_top() + this._mouse_pointer[1]
        if (ev.get_grab()) item_stack = [this._mouse_cursor]
      }
      if (item_stack == null) item_stack = this.hit_test_stack(x, y)
      if (this._focused_item != null && !item_stack.includes(this._focused_item[0])) this.set_focus(null)
      let dblclick = false
      if (this._last_click != null && pygame.time.get_ticks() - this._last_click < DBLCLICK_DELAY) dblclick = true
      this._last_click = dblclick ? null : pygame.time.get_ticks()
      if (item_stack.length > 0) {
        this._fire_routed_event(item_stack, ItemEvent.CLICK, new ItemEventArgsMouse(x, y))
        if (dblclick) this._fire_routed_event(item_stack, ItemEvent.DBLCLICK, new ItemEventArgsMouse(x, y))
      }
    }
  }

  private _on_mouse_button_up(x: number, y: number, button: number) {
    if (button === 1 && this._leftmousedown_handlers.length > 0) {
      const args = new ItemEventArgsMouse(x, y)
      for (const hd of this._leftmousedown_handlers.slice()) hd[1](args, true)
      this._leftmousedown_handlers = []
      this._update_over_item(x, y)
    }
  }

  private _fire_routed_event(item_stack: Item[], click_type: number, args: ItemEventArgs) {
    for (let k = item_stack.length - 1; k >= 0; k--) if (item_stack[k].fire_event(click_type, args)) break
  }

  private _update_over_item(x: number, y: number): Item[] {
    const item_stack = this.hit_test_stack(x, y)
    let new_over_item: Item | null = null
    if (this.target_surface == null && this.game.loading_layer != null) new_over_item = null
    else if (this._mouse_cursor != null && !this._use_mouse_layer) new_over_item = this._mouse_cursor
    else {
      for (let k = item_stack.length - 1; k >= 0; k--) {
        const item = item_stack[k]
        if (item.has_event_handler(ItemEvent.MOUSE_ENTER) || item.has_event_handler(ItemEvent.MOUSE_LEAVE)) { new_over_item = item; break }
      }
    }
    if (this._over_item !== new_over_item) {
      if (this._leftmousedown_handlers.length > 0) {
        let over_captured_item = false
        for (const hd of this._leftmousedown_handlers) if (hd[0] === new_over_item) over_captured_item = true
        if (!over_captured_item) new_over_item = null
      }
      const old_over_item = this._over_item
      this._over_item = new_over_item
      if (old_over_item != null) old_over_item.fire_event(ItemEvent.MOUSE_LEAVE, new ItemEventArgsMouse(x, y))
      if (this._over_item != null) this._over_item.fire_event(ItemEvent.MOUSE_ENTER, new ItemEventArgsMouse(x, y))
    }
    return item_stack
  }

  prepare() {}

  /** Cuadro completo: timers, actualización de ítems y dibujo de todas las capas. */
  render(update_mouse = false) {
    if (this.target_surface == null) {
      const pos = pygame.mouse.get_pos()
      if (this._mouse_real_pos == null || pos[0] !== this._mouse_real_pos[0] || pos[1] !== this._mouse_real_pos[1] || update_mouse) {
        this._mouse_real_pos = pos
        this._update_over_item(pos[0], pos[1])
        if (this._mouse_cursor != null) this._update_mouse_cursor_position(pos[0], pos[1])
      }
    }
    const timers = this._timers
    if (timers.length > 0) {
      const ticks = pygame.time.get_ticks()
      let i = 0
      while (i < timers.length) {
        const timer = timers[i]
        if (timer.render_first) timer.render_first = false
        else {
          let guard = 0
          while (ticks >= timer.tick) {
            timer.func(timer.key, timer.data)
            if (!timers.includes(timer)) { i -= 1; break }
            if (timer.drop_ticks) {
              while (ticks >= timer.tick) timer.tick += timer.milliseconds
              break
            } else timer.tick += timer.milliseconds
            if (++guard > 200) { timer.tick = ticks + timer.milliseconds; break }
          }
        }
        i += 1
      }
    }
    const frame_delay = this.game.get_frame_delay()
    for (const l of this.layers) l.update(frame_delay)
    const loading_layer = this.target_surface == null ? this.game.loading_layer : null
    loading_layer?.update(frame_delay)
    this._mouse_layer?.update(frame_delay)
    this.draw_all()
  }

  /** Dibuja la escena completa en su superficie destino. */
  draw_all() {
    const target = this.target_surface ?? this.game.window
    const ctx: CanvasRenderingContext2D = target.ctx
    ctx.save()
    ctx.globalAlpha = 1
    if (this._background == null) {
      ctx.fillStyle = css(this._background_color)
      ctx.fillRect(0, 0, target.width, target.height)
    } else {
      const d = this._background.surface.drawable()
      if (d) ctx.drawImage(d, 0, 0)
      else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, target.width, target.height) }
    }
    ctx.restore()
    for (const l of this.layers) if (l.get_visible()) l.draw(target)
    if (this.target_surface == null) {
      const loading_layer = this.game.loading_layer
      if (loading_layer != null) loading_layer.draw(target)
      else if (this._mouse_layer != null) {
        // con el dedo no se dibuja la flecha por defecto, pero sí los cursores especiales (lupa, etc.)
        const isDefault = !!(this._mouse_cursor as ItemImage | null)?.is_default_cursor
        if (mouse.pointer === 'mouse' || !isDefault) this._mouse_layer.draw(target)
      }
    }
  }

  private _load_background(image: Image | null) {
    if (image == null) { this._background = null; this._background_color = [0, 0, 0] }
    else {
      const rect = image.get_real_rect()
      const [sw, sh] = this.target_surface == null ? this.game.get_window_size() : this.target_surface.get_size()
      if (rect.width >= sw && rect.height >= sh) this._background = image
      else {
        const surface = new Surface([sw, sh])
        for (let y = 0; y < sh; y += Math.max(1, rect.height)) for (let x = 0; x < sw; x += Math.max(1, rect.width)) surface.blit(image.surface, [x, y], rect)
        this._background = new assets.Image(surface)
      }
    }
  }

  private _update_mouse_cursor_position(x: number | null, y: number | null) {
    const cursor = this._mouse_cursor!
    if (this._mouse_snap_to_cursor) {
      pygame.mouse.set_pos(cursor.get_left() + this._mouse_pointer[0], cursor.get_top() + this._mouse_pointer[1])
      this._mouse_snap_to_cursor = false
      return
    } else if (this._mouse_move_area != null) {
      if (typeof this._mouse_move_area === 'function') [x, y] = this._mouse_move_area(x, y)
      else {
        const a = this._mouse_move_area as Rect
        const cw = cursor.get_width(), ch = cursor.get_height()
        if (x! < a.left) x = a.left
        else if (x! + cw > a.right) x = a.right - cw
        if (y! < a.top) y = a.top
        else if (y! + ch > a.bottom) y = a.bottom - ch
      }
    }
    if (x != null && y != null) cursor.set_lefttop(x - this._mouse_pointer[0], y - this._mouse_pointer[1])
  }

  handle_event(_e: ev.PgEvent): unknown { return 0 }

  redraw() {
    if (this._changed_handler != null) this._changed_handler(this)
    this._mouse_update = true
  }
}

/** Se inyecta desde animations.ts (evita dependencia circular). */
let blindLayerHook: ((layer: Layer, direction: number, area: Rect | null, duration: number, cb: ((l: Layer) => void) | null) => void) | null = null
export function setBlindLayerHook(f: typeof blindLayerHook) { blindLayerHook = f }
/** El shell lo usa para mostrar el teclado en pantalla cuando un texto editable toma el foco. */
let focusHook: ((item: Item | null) => void) | null = null
export function setFocusHook(f: typeof focusHook) { focusHook = f }

// ------------------------------------------------------------------------------------------------
// StageIso: grilla isométrica (oficina y casa del ladrón)
// ------------------------------------------------------------------------------------------------
export class IsoDefinition {
  center: number[]
  size: number[]
  place_holders: IsoPlaceHolder[]
  tag: string
  states: IsoDefState[]
  private _flip_h: IsoDefinition | null = null
  constructor(center: number[], size: number[], place_holders: IsoPlaceHolder[], tag: string, states: IsoDefState[]) {
    this.center = center; this.size = size; this.place_holders = place_holders; this.tag = tag; this.states = states
  }
  has_state(state: IsoState) { return this.states.some((s) => s.name === state.name) }
  flip_h(_item?: unknown): IsoDefinition {
    if (this._flip_h == null) {
      const fp = this.place_holders.map((p) => new IsoPlaceHolder(p.tag, -p.x, p.y))
      const fs = this.states.map((s) => new IsoDefState(s.name, s.center, s.clip))
      this._flip_h = new IsoDefinition(this.center, [this.size[1], this.size[0]], fp, this.tag, fs)
      this._flip_h._flip_h = this
    }
    return this._flip_h
  }
}
export class IsoDefState { constructor(public name: string, public center: number[], public clip: boolean) {} }
export class IsoPlaceHolder { constructor(public tag: string, public x: number, public y: number) {} }
export class IsoState { constructor(public name: string, public suffix: string) {} }

export class StageIso extends Stage {
  private _origin: number[] = [300, 200]
  private _cell_width = 80
  private _cell_height = 40
  private _multiplier = 1
  private _item_definitions: Record<string, IsoDefinition> = {}
  private _item_images_cache: Record<string, Image> = {}
  private _item_masks_cache: Record<string, Surface> = {}
  private _set_name = ''
  private _image_suffix = ''
  private _tags: any

  constructor(game: any, tags: any, background_image: Image | null = null, target_surface: Surface | null = null) {
    super(game, background_image, target_surface)
    this._tags = tags
  }

  get_rowcol(x: number, y: number): [number, number] {
    x -= this._origin[0] * this._multiplier
    y -= this._origin[1] * this._multiplier
    const m = -this._cell_height / this._cell_width
    const t1 = y / (2 * m)
    const t2 = x / 2
    const t3 = (this._cell_width * this._multiplier) / 2
    return [Math.floor((-t1 - t2) / t3), Math.floor((-t1 + t2) / t3)]
  }

  get_xy(row: number, col: number): [number, number] {
    const x = this._origin[0] * this._multiplier + (this._cell_width / 2) * this._multiplier * (col - row)
    const y = this._origin[1] * this._multiplier + (this._cell_height / 2) * this._multiplier * (row + col + 1)
    return [Math.trunc(x), Math.trunc(y)]
  }

  get_grid_origin() { return this._origin }
  get_grid_cell_size(): [number, number] { return [this._cell_width, this._cell_height] }
  get_grid_multiplier() { return this._multiplier }
  get_grid_definition(): [number[], number, number, number] { return [this._origin, this._cell_width, this._cell_height, this._multiplier] }
  set_grid_definition(origin: number[], cell_width: number, cell_height: number, multiplier: number) {
    this._origin = origin; this._cell_width = cell_width; this._cell_height = cell_height; this._multiplier = multiplier
  }
  get_tags() { return this._tags }
  set_tags(t: any) { this._tags = t }
  get_set_name() { return this._set_name }

  set_items(set_name: string, image_suffix = '', item_definitions: Record<string, IsoDefinition> | null = null) {
    this._set_name = set_name
    this._image_suffix = image_suffix
    this._item_images_cache = {}
    this._item_masks_cache = {}
    if (item_definitions != null) this._item_definitions = item_definitions
    else if (set_name !== '') {
      const file_name = this._set_name + '.tcs'
      this._item_definitions = {}
      for (const fields of assets.load_data(file_name)) {
        if (fields.length > 1) {
          const type = fields[0]
          const center = [parseInt(fields[1]), parseInt(fields[2])]
          const size = [parseInt(fields[3]), parseInt(fields[4])]
          const place_holders: IsoPlaceHolder[] = []
          for (let ph of fields[5].split('|')) {
            if (ph.length >= 3) { const p = ph.split(','); place_holders.push(new IsoPlaceHolder(p[0], parseInt(p[1]), parseInt(p[2]))) }
          }
          const tag = fields[6].trim()
          const states: IsoDefState[] = []
          for (const st of fields[7].split('|')) {
            const s = st.split(',')
            if (s.length >= 3) states.push(new IsoDefState(s[0], [parseInt(s[1]), parseInt(s[2])], s.length >= 4 ? s[3].trim() === '1' : false))
          }
          this._item_definitions[type] = new IsoDefinition(center, size, place_holders, tag, states)
        }
      }
    }
  }

  get_item_definition(item_type: string, _flipped_h = false) {
    const d = this._item_definitions[item_type]
    if (!d) throw new Error("Missing definition for item '" + item_type + "'.")
    return d
  }
  get_item_definitions() { return this._item_definitions }
  get_item_types_with_tag(tag: string) { return Object.entries(this._item_definitions).filter(([, d]) => d.tag === tag).map(([t]) => t) }

  load_item_image(type: string, state: IsoState, flip_h = false, suffix: string | null = null): Image {
    let key = type
    let state_suffix = ''
    if (state.suffix !== '') { state_suffix = '_' + state.suffix; key += state_suffix }
    if (suffix != null) { key += suffix; state_suffix += suffix }
    if (flip_h) key += '?H'
    let image = this._item_images_cache[key]
    if (!image) {
      let base: Image | null = null
      if (flip_h) base = this.load_item_image(type, state, false, suffix)
      if (base == null) image = assets.load_image(this._set_name + type + this._image_suffix + state_suffix + '.png')
      else image = new assets.Image(pygame.transform.flip(base.surface, true, false), key)
      this._item_images_cache[key] = image
    }
    return image
  }

  load_item_mask(type: string, state: IsoState, flip_h: boolean, mask_suffix: string): Surface {
    let key = type
    let suffix = ''
    if (state.suffix !== '') { suffix = '_' + state.suffix; key += suffix }
    suffix += '$' + mask_suffix
    if (flip_h) key += '?H'
    let mask = this._item_masks_cache[key]
    if (!mask) {
      let base: Surface | null = null
      if (flip_h) base = this.load_item_mask(type, state, false, mask_suffix)
      mask = base == null ? assets.load_mask(this._set_name + type + this._image_suffix + suffix + '.gif') : pygame.transform.flip(base, true, false)
      this._item_masks_cache[key] = mask
    }
    return mask
  }

  load_level(level_name: string, layer: Layer, states: IsoState[], prepare_item: ((i: ItemCell) => void) | null = null): ItemCell[] {
    const file_name = this._set_name + level_name + '.tcl'
    const items: ItemCell[] = []
    for (const fields of assets.load_data(file_name)) {
      if (fields.length > 1) {
        let type = fields[0]
        let flip_h = false
        if (type.endsWith('?H')) { type = type.slice(0, -2); flip_h = true }
        const row = parseFloat(fields[1]), col = parseFloat(fields[2])
        const state_suffix = fields[3].trim()
        const item_state = states.find((s) => s.suffix === state_suffix)
        if (!item_state) throw new Error("State suffix '" + state_suffix + "' is not defined, and item '" + type + "' has this state.")
        const item = new ItemCell(this, type, item_state, flip_h, row, col)
        if (prepare_item != null) prepare_item(item)
        layer.add(item)
        items.push(item)
      }
    }
    return items
  }

  load_place_holders(layer: Layer, list: [ItemCell, IsoPlaceHolder, number][]) {
    for (const item of layer.items) {
      if (item instanceof ItemCell) {
        const phs = item.get_definition().place_holders
        for (let i = 0; i < phs.length; i++) list.push([item, phs[i], i])
      }
    }
  }

  find_item(layer: Layer, position: number[], type: string) {
    for (const item of layer.items) {
      if (item instanceof ItemCell && item.get_type() === type) {
        const p = item.get_position()
        if (p[0] === position[0] && p[1] === position[1]) return item
      }
    }
    return null
  }
}

// ------------------------------------------------------------------------------------------------
// Ítems
// ------------------------------------------------------------------------------------------------
export const ItemEvent = { CLICK: 0, DBLCLICK: 1, MOUSE_ENTER: 2, MOUSE_LEAVE: 3, MOUSE_MOVE: 4, GOT_FOCUS: 5, LOST_FOCUS: 6, STATE_CHANGED: 7 }
export class ItemEventArgs {}
export class ItemEventArgsMouse extends ItemEventArgs { constructor(public x: number, public y: number) { super() } }
export class ItemEventArgsStateChanged extends ItemEventArgs { constructor(public previous_state: IsoState) { super() } }

export interface CustomDrawTarget {
  surface: Surface | null
  blit_surface(surface: Surface, pos: number[], area?: Rect | number[] | null, alpha?: number): void
  blit_image(image: Image, pos: number[], area?: Rect | number[] | null): void
  blit_stage(stage: Stage, pos: number[], area?: Rect | number[] | null): void
  clear(color: Color): void
  fill(color: Color, rect: Rect | number[]): void
  draw_line(color: Color, start: number[], end: number[], width?: number): void
  draw_rect(color: Color, rect: Rect | number[], width?: number): void
}

export class Item {
  private _layer: Layer | null = null
  private _left: number
  private _top: number
  private _width: number
  private _height: number
  visible = true
  rect: Rect
  image: Image | null = null
  draw_function: ((item: any, target: CustomDrawTarget) => void) | null = null
  surface: Surface | null = null
  area: Rect | number[] | null = null
  private _events: Map<number, Handler[]> = new Map()
  private _rollover: [ItemImage, CustomSound | null, number | null, number | null] | null = null;
  /** propiedades dinámicas que el juego agrega a los ítems (como en Python) */
  [k: string]: any

  constructor(left: number, top: number, width: number, height: number) {
    this._left = left
    this._top = top
    this._width = width
    this._height = height
    this.rect = new Rect(left, top, width, height)
  }

  get_visible() { return this.visible }
  set_visible(visible: boolean) { if (this.visible !== visible) { this.visible = visible; this.set_dirty() } }
  get_left() { return this._left }
  set_left(v: number) { if (this._left !== v) { this._left = v; this.set_dirty() } }
  get_top() { return this._top }
  set_top(v: number) { if (this._top !== v) { this._top = v; this.set_dirty() } }
  set_lefttop(left: number, top: number) { if (this._left !== left || this._top !== top) { this._left = left; this._top = top; this.set_dirty() } }
  get_width() { return this._width }
  set_width(v: number) { if (this._width !== v) { this._width = v; this.set_dirty() } }
  get_height() { return this._height }
  set_height(v: number) { if (this._height !== v) { this._height = v; this.set_dirty() } }
  get_bounds() { return new Rect(this._left, this._top, this._width, this._height) }
  get_size(): [number, number] { return [this._width, this._height] }

  set_dirty() {
    if (this._layer != null) this._layer.add_dirty_item(this)
    if (this._rollover != null) this._update_rollover_position()
  }

  get_layer() { return this._layer }
  set_layer(layer: Layer | null) {
    if (layer == null) this._layer = null
    else if (this._layer != null) throw new Error('The item is already part of a layer')
    else this._layer = layer
  }
  get_stage(): Stage | null { return this._layer == null ? null : this._layer.get_stage() }

  update(_frame_delay: number): Rect {
    const w = this.visible ? this._width : 0
    const h = this.visible ? this._height : 0
    this.rect = new Rect(this._left, this._top, w, h)
    return this.rect
  }

  is_over(x: number, y: number, _ignore_clip = false) {
    return this._left <= x && x < this._left + this._width && this._top <= y && y < this._top + this._height
  }

  add_event_handler(event: number, handler: Handler) {
    const l = this._events.get(event)
    if (l) l.push(handler)
    else this._events.set(event, [handler])
  }

  remove_event_handler(event: number, handler: Handler) {
    const l = this._events.get(event)
    if (l) {
      const i = l.indexOf(handler)
      if (i >= 0) { l.splice(i, 1); if (l.length === 0) this._events.delete(event) }
    }
  }

  fire_event(event: number, args: ItemEventArgs): boolean {
    const handlers = this._events.get(event)
    if (!handlers) return false
    let handled = false
    for (const handler of handlers.slice()) {
      const ret = handler(this, args)
      if (ret || ret == null) handled = true
    }
    return handled
  }

  has_event_handler(event: number) { return (this._events.get(event)?.length ?? 0) > 0 }

  set_rollover(image: Image | null, sound: CustomSound | null, x: number | null = null, y: number | null = null) {
    this.remove_event_handler(ItemEvent.MOUSE_ENTER, this._ro_enter)
    this.remove_event_handler(ItemEvent.MOUSE_LEAVE, this._ro_leave)
    if (image == null) this._rollover = null
    else {
      this._rollover = [new ItemImage(0, 0, image), sound, x, y]
      this.add_event_handler(ItemEvent.MOUSE_ENTER, this._ro_enter)
      this.add_event_handler(ItemEvent.MOUSE_LEAVE, this._ro_leave)
    }
  }

  show_rollover(play_sound: boolean) {
    if (this._rollover != null) {
      const layer = this.get_layer()
      if (layer != null) {
        const stage = layer.get_stage()
        if (stage != null && !stage.is_timer_started([this, 'fade'])) {
          const item_image = this._update_rollover_position()
          layer.add(item_image, layer.index_of(this))
          const s = this._rollover[1]
          if (play_sound && s != null) { s.stop(); s.play() }
        }
      }
    }
  }

  hide_rollover() {
    if (this._rollover != null) {
      const image = this._rollover[0]
      image.get_layer()?.remove(image)
    }
  }

  private _ro_enter = (_i: Item, _a: unknown) => { this.show_rollover(true) }
  private _ro_leave = (_i: Item, _a: unknown) => { this.hide_rollover() }

  private _update_rollover_position() {
    const [item_image, , x, y] = this._rollover!
    const dx = x == null ? Math.floor((this.get_width() - item_image.get_width()) / 2) : x
    const dy = y == null ? Math.floor((this.get_height() - item_image.get_height()) / 2) : y
    item_image.set_left(this._left + dx)
    item_image.set_top(this._top + dy)
    return item_image
  }

  // foco (sólo ItemText los usa de verdad)
  on_got_focus(data: any): any { return data }
  on_lost_focus(_stage: Stage, _data: any) {}
  handle_event_focused(_event: ev.PgEvent, _data: any) { return false }
}

export class ItemImage extends Item {
  private _alpha = 255
  private _hit_over_transparent: boolean
  private _image: Image | null = null
  private _source_surface: Surface | null = null
  private _surface_noclip: Surface | null = null
  private _ro_img: [Image, Image | null, CustomSound | null] | null = null
  private _pressed: [Image, Image | null] | null = null
  is_default_cursor = false

  constructor(left: number, top: number, image: Image | null, area: Rect | number[] | null = null, hit_over_transparent = false) {
    super(left, top, 0, 0)
    this._hit_over_transparent = hit_over_transparent
    this.set_image(image, area)
  }

  get_alpha() { return this._alpha }
  set_alpha(alpha: number) {
    this._alpha = Math.max(0, Math.min(255, alpha))
    this.set_dirty()
  }

  is_over(x: number, y: number, ignore_clip = false) {
    if (this.get_bounds().collidepoint(x, y)) {
      if (this._hit_over_transparent) return true
      const test = ignore_clip ? this._source_surface : this.surface
      if (!test) return false
      let c: number[]
      try { c = test.get_at([Math.trunc(x - this.get_left()), Math.trunc(y - this.get_top())]) } catch { return false }
      const a = test.alpha && !ignore_clip ? c[3] * (this._alpha / 255) : c[3]
      if (a > 40) return true
    }
    return false
  }

  get_image() { return this._image }

  set_image(image: Image | null, area: Rect | number[] | null = null) {
    if (this._ro_img != null && this._ro_img[1] != null) this._ro_img[1] = image
    else if (this._pressed != null && this._pressed[1] != null) this._pressed[1] = image
    else this._set_image_internal(image, area)
  }

  set_clip_mask(image_mask: Image | null, image_pos: number[] | null) {
    if (image_mask == null) {
      this._source_surface = this._surface_noclip
      if (this.surface !== this._surface_noclip) { this.surface = this._surface_noclip; this.set_dirty() }
    } else {
      const left = this.get_left(), top = this.get_top()
      let x: number, area_x: number, y: number, area_y: number
      if (image_pos![0] < left) { x = 0; area_x = left - image_pos![0] } else { x = image_pos![0] - left; area_x = 0 }
      if (image_pos![1] < top) { y = 0; area_y = top - image_pos![1] } else { y = image_pos![1] - top; area_y = 0 }
      const area_width = Math.min(image_mask.get_width() - area_x, this.get_width())
      const area_height = Math.min(image_mask.get_height() - area_y, this.get_height())
      const src = this._source_surface!
      const out = src.copy()
      const m = image_mask.surface
      out.draw([m], (ctx) => {
        const d = m.drawable()
        if (!d) return
        // alfa &= alfa de la máscara dentro del área; fuera del área queda igual
        const w = out.width, h = out.height
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h
        const t = tmp.getContext('2d')!
        t.fillStyle = '#fff'
        t.fillRect(0, 0, w, h)
        t.clearRect(x, y, area_width, area_height)
        t.drawImage(d, area_x, area_y, area_width, area_height, x, y, area_width, area_height)
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(tmp, 0, 0)
        ctx.globalCompositeOperation = 'source-over'
      })
      this.surface = out
      this._source_surface = out
      this.set_dirty()
    }
  }

  set_rollover_image(image: Image | null, sound: CustomSound | null) {
    if (this._ro_img != null) {
      const old_image = this._ro_img[1]
      this._ro_img = null
      if (old_image != null) this.set_image(old_image)
      this.remove_event_handler(ItemEvent.MOUSE_ENTER, this._roi_enter)
      this.remove_event_handler(ItemEvent.MOUSE_LEAVE, this._roi_leave)
    }
    if (image != null) {
      this._ro_img = [image, null, sound]
      this.add_event_handler(ItemEvent.MOUSE_ENTER, this._roi_enter)
      this.add_event_handler(ItemEvent.MOUSE_LEAVE, this._roi_leave)
    }
  }

  set_pressed_image(image: Image | null) {
    if (this._pressed != null) {
      const old_image = this._pressed[1]
      this._pressed = null
      if (old_image != null) this.set_image(old_image)
      this.remove_event_handler(ItemEvent.CLICK, this._pressed_click)
    }
    if (image != null) {
      this._pressed = [image, null]
      this.add_event_handler(ItemEvent.CLICK, this._pressed_click)
    }
  }

  private _set_image_internal(image: Image | null, area: Rect | number[] | null = null) {
    this._image = image
    if (image == null) {
      this.area = [0, 0, 0, 0]
      this.surface = new Surface([0, 0], SRCALPHA)
      this._source_surface = this.surface
      this._surface_noclip = this.surface
      this.set_width(0)
      this.set_height(0)
    } else {
      this.set_width(image.get_width())
      this.set_height(image.get_height())
      this.surface = image.surface
      this._source_surface = this.surface
      this._surface_noclip = this.surface
      this.area = area
      this.set_dirty()
    }
  }

  private _roi_enter = (_item: Item, _args: unknown) => {
    if (this._ro_img != null) {
      if (this._pressed != null && this._pressed[1] != null) {
        this._ro_img[1] = this._pressed[1]
        this._pressed[1] = this._ro_img[0]
      } else {
        const current_image = this.get_image()
        this._set_image_internal(this._ro_img[0])
        this._ro_img[1] = current_image
      }
      const s = this._ro_img[2]
      if (s != null && this.get_stage() != null) { s.stop(); s.play() }
    }
  }

  private _roi_leave = (_item: Item, _args: unknown) => {
    if (this._ro_img != null) {
      if (this._pressed != null && this._pressed[1] != null) {
        this._pressed[1] = this._ro_img[1]
        this._ro_img[1] = null
      } else {
        const old_image = this._ro_img[1]
        if (old_image != null) { this._ro_img[1] = null; this._set_image_internal(old_image) }
      }
    }
  }

  private _pressed_click = (_item: Item, _args: unknown) => {
    if (this._pressed != null) {
      const stage = this.get_stage()
      if (stage != null) {
        const current_image = this.get_image()
        this._set_image_internal(this._pressed[0])
        this._pressed[1] = current_image
        stage.capture_leftmousedown(this, this._pressed_mousecapture)
      }
    }
  }

  private _pressed_mousecapture = (_a: ItemEventArgsMouse, released: boolean) => {
    if (released && this._pressed != null) {
      const old_image = this._pressed[1]
      if (old_image != null) { this._pressed[1] = null; this._set_image_internal(old_image) }
    }
  }
}

export class ItemCustomDraw extends Item {
  mask: any
  constructor(left: number, top: number, width: number, height: number, draw_function: (item: any, target: CustomDrawTarget) => void, mask: any = null) {
    super(left, top, width, height)
    this.draw_function = draw_function
    this.mask = mask
  }
  is_over(x: number, y: number, _ignore_clip = false) {
    if (this.get_bounds().collidepoint(x, y)) {
      if (this.mask == null) return true
      if (typeof this.mask === 'function') return this.mask(this, x, y)
      try {
        const c = this.mask.get_at([x - this.get_left(), y - this.get_top()])
        if (c[0] !== 255 || c[1] !== 255 || c[2] !== 255) return true
      } catch { return false }
    }
    return false
  }
}

export class ItemCell extends ItemImage {
  private _stage: StageIso
  private _state: IsoState
  private _center: number[] | null = null
  private _flip_h: boolean
  private _type: string | null = null
  private _definition: IsoDefinition | null = null
  private _position: number[] = [0, 0]
  _visible_in_states: [ItemCell, IsoState[]] | null | undefined = undefined
  placeholder_items: ItemCell[] | undefined
  placeholder_container: ItemCell | undefined

  constructor(stage: StageIso, type: string, state: IsoState, flip_h = false, row = -999, col = -999) {
    super(0, 0, null)
    this._stage = stage
    this._state = state
    this._flip_h = flip_h
    this.set_type(type)
    this._position = [0, 0]
    if (row !== -999) this.set_position(row, col)
  }

  clone(stage: StageIso) {
    const [row, col] = this.get_position()
    const n = new ItemCell(stage, this._type!, this._state, this._flip_h, -999, -999)
    n._center = this._center
    n.set_position(row, col)
    n.set_visible(this.get_visible())
    if (this._visible_in_states != null) n._visible_in_states = [this._visible_in_states[0], this._visible_in_states[1].slice()]
    if (this.placeholder_items != null) n.placeholder_items = this.placeholder_items.slice()
    return n
  }

  get_type() { return this._type! }
  set_type(type: string) {
    if (this._type !== type) {
      const position = this._type == null ? null : this.get_position()
      this._type = type
      this.set_image(this._stage.load_item_image(type, this._state, this._flip_h), null)
      this._definition = this._stage.get_item_definition(type)
      if (this._flip_h) this._definition = this._definition.flip_h(this)
      this._load_center()
      if (position != null) this.set_position(position[0], position[1])
    }
  }

  get_state() { return this._state }
  set_state(state: IsoState) {
    if (this._state !== state) {
      const position = this.get_position()
      const previous_state = this._state
      this._state = state
      this.set_image(this._stage.load_item_image(this._type!, this._state, this._flip_h), null)
      this._load_center()
      this.set_position(position[0], position[1])
      if (this.placeholder_items) {
        for (const item_over of this.placeholder_items) {
          const vis = item_over._visible_in_states
          if (vis != null && vis[0].get_type() === this._type) {
            let clip_mask: Image | null = null
            let clip_pos: number[] | null = null
            if (vis[1].includes(state)) {
              item_over.set_visible(true)
              let clip = false
              for (const ds of this._definition!.states) { if (ds.name === state.name) { if (ds.clip) clip = true; break } }
              if (clip) {
                clip_mask = this._stage.load_item_image(this._type!, this._state, this._flip_h, '$x')
                clip_pos = [this.get_left(), this.get_top()]
                item_over.set_clip_mask(clip_mask, clip_pos)
              } else item_over.set_clip_mask(null, null)
            } else item_over.set_visible(false)
          }
        }
      }
      this.fire_event(ItemEvent.STATE_CHANGED, new ItemEventArgsStateChanged(previous_state))
    }
  }

  get_position() { return this._position }
  set_position(row: number, col: number) {
    const [left, top] = this._from_grid_position(row, col)
    this.set_lefttop(left, top)
    this._position = [row, col]
  }

  get_mask(mask_suffix: string) { return this._stage.load_item_mask(this._type!, this._state, this._flip_h, mask_suffix) }

  get_at_mask(x: number, y: number, mask_suffix: string): number[] {
    const mask = this._stage.load_item_mask(this._type!, this._state, false, mask_suffix)
    if (mask == null) return [255, 255, 255, 255]
    const mask_x = this._flip_h ? this.get_width() - (x - this.get_left()) : x - this.get_left()
    const mask_y = y - this.get_top()
    if (mask_x < 0 || mask_y < 0 || mask_x >= mask.get_width() || mask_y >= mask.get_height()) return [255, 255, 255, 255]
    if (!mask.ready) return [255, 255, 255, 255]
    return mask.get_at([mask_x, mask_y])
  }

  get_center() { return this._center }

  set_to_place_holder(container_item: ItemCell, place_holder: IsoPlaceHolder, _below = false, only_visible_in_states: IsoState[] | null = null) {
    const [row, col] = container_item.get_position()
    const [ph_row, ph_col] = container_item.get_place_holder_rowcol(place_holder)
    const drow = ph_row - row, dcol = ph_col - col
    this._load_center()
    const [cw, ch] = this._stage.get_grid_cell_size()
    this._center = [this._center![0] - place_holder.x + ((dcol - drow) * cw) / 2, this._center![1] - place_holder.y + ((dcol + drow) * ch) / 2]
    this.set_position(ph_row, ph_col)
    if (container_item._flip_h) {
      this.set_image(this._stage.load_item_image(this._type!, this._state, true), null)
      this._flip_h = true
    }
    if (only_visible_in_states != null) {
      this._visible_in_states = [container_item, only_visible_in_states]
      this.set_visible(only_visible_in_states.includes(this.get_state()))
    } else if (this._visible_in_states !== undefined) this._visible_in_states = null
    this.placeholder_container = container_item
    container_item.register_placeholder_item(this)
  }

  get_place_holder_rowcol(ph: IsoPlaceHolder) {
    const m = this._stage.get_grid_multiplier()
    return this._stage.get_rowcol(this.get_left() + (this._center![0] + ph.x) * m, this.get_top() + (this._center![1] + ph.y) * m)
  }
  get_place_holder_xy(ph: IsoPlaceHolder): [number, number] {
    const m = this._stage.get_grid_multiplier()
    return [this.get_left() + (this._center![0] + ph.x) * m, this.get_top() + (this._center![1] + ph.y) * m]
  }
  get_flip_h() { return this._flip_h }
  set_flip_h(value: boolean) {
    if (this._flip_h !== value) {
      const position = this.get_position()
      this.set_image(this._stage.load_item_image(this._type!, this._state, value), null)
      this._definition = this._definition!.flip_h(this)
      this._flip_h = value
      this._load_center()
      if (position != null) this.set_position(position[0], position[1])
    }
  }
  get_definition() { return this._definition! }
  reload_definition() { const t = this._type!; this._type = '???'; this.set_type(t) }

  register_placeholder_item(item: ItemCell) {
    if (!this.placeholder_items) this.placeholder_items = [item]
    else this.placeholder_items.push(item)
  }
  unregister_placeholder_item(item: ItemCell) {
    if (this.placeholder_items) { const i = this.placeholder_items.indexOf(item); if (i >= 0) this.placeholder_items.splice(i, 1) }
  }

  private _load_center() {
    if (this._state.suffix === '') this._center = this._definition!.center
    else {
      let sc: number[] | null = null
      for (const s of this._definition!.states) if (s.name === this._state.name) sc = s.center
      if (sc == null) throw new Error("State '" + this._state.name + "' is not defined for item '" + this._type + "'")
      this._center = sc
    }
    if (this._flip_h) this._center = [this.get_width() / this._stage.get_grid_multiplier() - this._center[0], this._center[1]]
  }

  private _from_grid_position(row: number, col: number): [number, number] {
    if (this._definition == null) return [row, col]
    const [origin, cw, ch, m] = this._stage.get_grid_definition()
    const c = this._center!
    const left = Math.trunc((origin[0] + ((col - row) * cw) / 2 - c[0]) * m)
    const top = Math.trunc((origin[1] + ((col + row) * ch) / 2 - c[1] + ch / 2) * m)
    return [left, top]
  }
}

export class ItemMask extends Item {
  mask: Surface | null
  constructor(left: number, top: number, mask: Surface | Image | number[]) {
    let width: number, height: number, m: Surface | null
    if (mask instanceof Surface) { width = mask.get_width(); height = mask.get_height(); m = mask }
    else if (mask instanceof assets.Image) { width = mask.get_width(); height = mask.get_height(); m = mask.surface }
    else { width = mask[0]; height = mask[1]; m = null }
    super(left, top, width, height)
    this.mask = m
    this.draw_function = () => {}
  }
  is_over(x: number, y: number, _ignore_clip = false) {
    if (this.get_bounds().collidepoint(x, y)) {
      if (this.mask == null) return true
      try {
        const c = this.mask.get_at([x - this.get_left(), y - this.get_top()])
        if (c[0] !== 255 || c[1] !== 255 || c[2] !== 255) return true
      } catch { return false }
    }
    return false
  }
  update(_fd: number) { return this.rect }
  get_at(x: number, y: number) { return this.mask!.get_at([x, y]) }
}

// Fuentes adicionales para el marcado &#f:nombre! -> [fuente, alto de línea, ajuste y]
export type FontSpec = [Font, number, number?]
type CurFont = [Font, number, number, string | null]
type LinePart = [number[], CurFont, string]

export class ItemText extends Item {
  static VALID_UNICODE_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'Á', 'É', 'Í', 'Ó', 'Ú', 'ñ', 'Ñ', 'ü', 'Ü', '¿', '¡']
  private _w: number
  private _h: number
  private _h_align: number
  private _v_align: number
  private _font: Font
  private _additional_fonts: Record<string, FontSpec>
  private _line_height: number
  private _color: number[]
  private _background: Color | null
  private _alpha = 255
  private _break_text_into: ItemText | null = null
  private _rollover_color: [number[], number[] | null, CustomSound | null] | null = null
  private _edit_mode: boolean | null = null
  private _max_chars = -1
  private _text: string
  private _text_surface: Surface | null = null
  private _dx = 0
  private _dy = 0
  private _edit_key_pressed: ((key: number) => void) | null = null
  private _edit_click_callback: Handler | null = null
  private _watermark_text: [string, number[]] | null = null

  constructor(left: number, top: number, font: Font, line_height: number, text: string, color: Color = [255, 255, 255], background: Color | null = null, width = -1, height = -1, h_align = 1, v_align = 1, additional_fonts: Record<string, FontSpec> = {}) {
    super(left, top, 0, 0)
    this._w = width
    this._h = height
    this._h_align = h_align
    this._v_align = v_align
    this._font = font
    this._additional_fonts = additional_fonts
    this._line_height = line_height === 0 ? Math.max(1, font.get_linesize()) : line_height
    this._color = toRgb(color)
    this._background = background
    this._text = text ?? ''
    this.area = null
    this._update_text()
    if (this._w !== -1) this.set_width(this._w)
    else this._dx = 0
    if (this._h !== -1) this.set_height(this._h)
    else this._dy = 0
    this.draw_function = (_item, target) => {
      if (this._text_surface) target.blit_surface(this._text_surface, [this.get_left() + this._dx, this.get_top() + this._dy], null, this._alpha)
    }
  }

  get_font() { return this._font }
  set_editable(editable: boolean, key_pressed: ((key: number) => void) | null = null) {
    if (editable) {
      if (this._edit_mode == null) { this._edit_mode = false; this._edit_key_pressed = key_pressed; this._update_text() }
    } else this._edit_mode = null
  }
  is_editable() { return this._edit_mode != null }
  get_alpha() { return this._alpha }
  set_alpha(alpha: number) { this._alpha = Math.max(0, Math.min(255, alpha)); this.set_dirty() }
  get_color() { return this._color }
  set_color(color: Color) {
    const c = toRgb(color)
    if (this._rollover_color != null && this._rollover_color[1] != null) this._rollover_color[1] = c
    else if (!sameColor(this._color, c)) { this._color = c; this._mark_text_to_update() }
  }
  set_rollover_color(rollover_color: Color | null, sound: CustomSound | null) {
    if (this._rollover_color != null) {
      const old_color = this._rollover_color[1]
      this._rollover_color = null
      if (old_color != null) { this._color = old_color; this._mark_text_to_update() }
      this.remove_event_handler(ItemEvent.MOUSE_ENTER, this._rc_enter)
      this.remove_event_handler(ItemEvent.MOUSE_LEAVE, this._rc_leave)
    }
    if (rollover_color != null) {
      this._rollover_color = [toRgb(rollover_color), null, sound]
      this.add_event_handler(ItemEvent.MOUSE_ENTER, this._rc_enter)
      this.add_event_handler(ItemEvent.MOUSE_LEAVE, this._rc_leave)
    }
  }
  get_background() { return this._background }
  set_background(b: Color | null) { if (this._background !== b) { this._background = b; this._mark_text_to_update() } }
  set_dimensions(width: number, height: number) {
    this._w = width
    this._h = height
    if (this._w !== -1) this.set_width(this._w)
    else this._dx = 0
    if (this._h !== -1) this.set_height(this._h)
    else this._dy = 0
    this._update_text()
  }
  get_text() { return this._text }
  set_text(text: string) { if (this._text !== text) { this._text = text; this._update_text() } }
  break_text_into(item_text: ItemText | null) { this._break_text_into = item_text }

  update(frame_delay: number) {
    if (this._text_surface == null) this._render_text()
    return super.update(frame_delay)
  }

  hit_test(x: number, y: number) {
    const adjust = this._font.get_linesize() / 4
    return hittest_text(this._text, x - this.get_left() + adjust, y - this.get_top(), this._font, this._additional_fonts, this._line_height, this.get_width(), this.get_height(), true, this._h_align, this._edit_mode != null, this._break_text_into)
  }

  set_edit_on_click(item: Item | null = null, click_callback: Handler | null = null) {
    if (item == null) item = this
    this._edit_click_callback = click_callback
    item.add_event_handler(ItemEvent.CLICK, this._begin_edit_on_click)
  }
  set_watermark_text(text: string, color: Color = [155, 125, 112]) { this._watermark_text = [text, toRgb(color)] }
  set_max_chars(n: number) { this._max_chars = n }

  begin_edit(x = 1000, y = 1000) {
    if (this._edit_mode == null) throw new Error('The ItemText is not editable.')
    const index = this.hit_test(x, y)
    const stage = this.get_stage()
    if (stage != null) {
      if (stage.get_focus() === this) {
        stage.get_focus_data()[0] = index
        stage.get_focus_data()[1] = true
        this._start_cursor_timer()
      } else stage.set_focus(this, index)
      this._update_text()
    }
  }

  end_edit() {
    const stage = this.get_stage()
    if (stage != null && stage.get_focus() === this) { stage.set_focus(null); this._update_text() }
  }

  on_got_focus(index: number) {
    this._edit_mode = true
    this._start_cursor_timer()
    return [index, true]
  }

  on_lost_focus(stage: Stage, _data: unknown) {
    stage.stop_timer([this, 'key_repeat'])
    this._edit_mode = false
    this._update_text()
  }

  handle_event_focused(event: ev.PgEvent, data: any[]) {
    if (event.type === ev.KEYDOWN) {
      // la repetición de teclas la hace el navegador
      if (this._handle_key(event.key!, event.unicode ?? '', data)) return true
    }
    return false
  }

  private _handle_key(key: number, unicode: string, data: any[]) {
    let updated = false, handled = false
    const old_cursor = data[0]
    const old_text = this._text
    if (key === ev.K.K_RETURN || key === ev.K.K_KP_ENTER) { this.end_edit(); handled = true }
    else if (key === ev.K.K_BACKSPACE) {
      if (data[0] > 0) { this._text = this._text.slice(0, data[0] - 1) + this._text.slice(data[0]); data[0] -= 1; updated = true }
      handled = true
    } else if (key === ev.K.K_DELETE) {
      if (data[0] < this._text.length) { this._text = this._text.slice(0, data[0]) + this._text.slice(data[0] + 1); updated = true }
      handled = true
    } else if (key === ev.K.K_RIGHT) { if (data[0] < this._text.length) { data[0] += 1; updated = true } handled = true }
    else if (key === ev.K.K_LEFT) { if (data[0] > 0) { data[0] -= 1; updated = true } handled = true }
    else if (key === ev.K.K_HOME || key === ev.K.K_UP) { if (data[0] > 0) { data[0] = 0; updated = true } handled = true }
    else if (key === ev.K.K_END || key === ev.K.K_DOWN) { if (data[0] < this._text.length) { data[0] = this._text.length; updated = true } handled = true }
    else if (unicode !== '' && unicode.length === 1 && ((unicode.charCodeAt(0) > 31 && unicode.charCodeAt(0) < 126) || ItemText.VALID_UNICODE_CHARS.includes(unicode)) && (this._text.length < this._max_chars || this._max_chars === -1)) {
      this._text = this._text.slice(0, data[0]) + unicode + this._text.slice(data[0])
      data[0] += 1
      updated = true
      handled = true
    }
    if (updated) {
      data[1] = true
      if (!this._update_text()) { this._text = old_text; data[0] = old_cursor; this._update_text() }
      else this._start_cursor_timer()
    }
    if (this._edit_key_pressed != null) this._edit_key_pressed(key)
    return handled
  }

  private _start_cursor_timer() {
    const stage = this.get_stage()
    if (stage != null) stage.start_timer([this, 'text_cursor'], 500, (k, d) => this._update_cursor_timer(k, d), stage)
  }

  private _begin_edit_on_click = (item: Item, args: ItemEventArgsMouse) => {
    const stage = item.get_stage()
    const focused = stage != null ? stage.get_focus() : null
    if (focused === this) this.begin_edit(args.x, args.y)
    else this.begin_edit()
    if (this._edit_click_callback != null) this._edit_click_callback(item, args)
  }

  private _update_text() {
    const fit = this._render_text()
    this.set_dirty()
    return fit
  }

  private _render_text() {
    let cursor_index = -1
    let editable = false
    if (this._edit_mode != null) {
      editable = true
      const stage = this.get_stage()
      if (stage != null && this._edit_mode) {
        const fd = stage.get_focus_data()
        if (fd && fd[1]) cursor_index = fd[0]
      }
    }
    let text = this._text
    let color = this._color
    if (text === '' && this._watermark_text) [text, color] = this._watermark_text
    const [surf, fit] = render_text(text, this._font, this._additional_fonts, this._line_height, this._w, this._h, true, color, this._background, this._h_align, this._break_text_into, cursor_index, editable)
    this._text_surface = surf
    const tw = surf.get_width(), th = surf.get_height()
    if (this._w === -1) this.set_width(tw)
    else if (this._h_align === 1) this._dx = 0
    else if (this._h_align === 2) this._dx = Math.floor((this._w - tw) / 2)
    else if (this._h_align === 3) this._dx = this._w - tw
    if (this._h === -1) this.set_height(th)
    else if (this._v_align === 1) this._dy = 0
    else if (this._v_align === 2) this._dy = Math.floor((this._h - th) / 2)
    else if (this._v_align === 3) this._dy = this._h - th
    return fit
  }

  private _mark_text_to_update() { this._text_surface = null; this.set_dirty() }

  private _rc_enter = (_i: Item, _a: unknown) => {
    if (this._rollover_color != null) {
      this._rollover_color[1] = this._color
      this._color = this._rollover_color[0]
      this._mark_text_to_update()
      const s = this._rollover_color[2]
      if (s != null && this.get_stage() != null) { s.stop(); s.play() }
    }
  }
  private _rc_leave = (_i: Item, _a: unknown) => {
    if (this._rollover_color != null) {
      const old = this._rollover_color[1]
      if (old != null) { this._color = old; this._mark_text_to_update(); this._rollover_color[1] = null }
    }
  }

  private _update_cursor_timer(key: unknown, stage: Stage) {
    if (stage.get_focus() !== this) stage.stop_timer(key)
    else {
      const fd = stage.get_focus_data()
      fd[1] = !fd[1]
      this._update_text()
    }
  }
}

export class ItemRect extends Item {
  private _font: Font | null
  private _additional_fonts: Record<string, FontSpec>
  private _line_height: number
  private _color: Color
  private _background: Color | null
  private _border: Color | null
  private _text_h_align: number
  private _text: string
  private _text_surface: Surface | null = null
  private _text_width = 0
  private _text_height = 0

  constructor(left: number, top: number, width: number, height: number, font: Font | null = null, line_height = 0, text = '', color: Color = [0, 0, 0], background: Color | null = [0, 0, 0], border: Color | null = null, text_h_align = 1, additional_fonts: Record<string, FontSpec> = {}) {
    super(left, top, width, height)
    this._font = font
    this._additional_fonts = additional_fonts
    this._line_height = line_height === 0 && font != null ? font.get_linesize() : line_height
    this._color = color
    this._background = background
    this._border = border
    this._text_h_align = text_h_align
    this._text = text
    this._update_text()
    this.draw_function = (item, target) => {
      const r = item.get_bounds()
      if (this._text_width !== r.w || this._text_height !== r.h) this._update_text()
      if (this._background != null) target.fill(this._background, r)
      if (this._text_surface != null) {
        target.blit_surface(this._text_surface, [r.left + Math.floor((r.width - this._text_surface.get_width()) / 2), r.top + Math.floor((r.height - this._text_surface.get_height()) / 2)])
      }
      if (this._border != null) target.draw_rect(this._border, r)
    }
  }
  get_color() { return this._color }
  set_color(c: Color) { if (this._color !== c) { this._color = c; this._mark() } }
  get_background() { return this._background }
  set_background(b: Color | null) { if (this._background !== b) { this._background = b; this._mark() } }
  get_font() { return this._font }
  set_font(f: Font | null) { if (this._font !== f) { this._font = f; this._update_text() } }
  get_text() { return this._text }
  set_text(t: string) { if (this._text !== t) { this._text = t; this._update_text() } }
  update(fd: number) {
    if (this._text_surface == null && this._text !== '') this._render_text()
    return super.update(fd)
  }
  private _update_text() { this._render_text(); this.set_dirty() }
  is_over(x: number, y: number, _ic = false) {
    const b = this.get_bounds()
    if (this._background != null) return b.x <= x && x < b.x + b.w && b.y <= y && y < b.y + b.h
    return b.x === x || (x === b.x + b.w - 1 && b.y === y) || y === b.y + b.h - 1
  }
  private _render_text() {
    const width = this.get_width(), height = this.get_height()
    if (this._text === '' || this._font == null) { this._text_surface = null; this._text_width = width; this._text_height = height; return true }
    const bg = this._background
    const tb = bg == null || (Array.isArray(bg) && bg.length >= 4 && bg[3] !== 255) ? null : bg
    const [s, fit] = render_text(this._text, this._font, this._additional_fonts, this._line_height, width, height, true, toRgb(this._color), tb, this._text_h_align, null)
    this._text_surface = s
    this._text_width = width
    this._text_height = height
    this.set_dirty()
    return fit
  }
  private _mark() { this._text_surface = null; this.set_dirty() }
}

export class ItemObject extends ItemImage {
  private _prev_velocity: [number, number] = [0, 0]
  private _normal_deceleration: number[] | null
  private _test_collision: ((item: ItemObject, l: number, t: number) => boolean) | null
  private _nokey_move: any[] | null = null
  private _key_moves: [number, any[]][] = []
  constructor(left: number, top: number, image: Image, test_collision: ((item: ItemObject, l: number, t: number) => boolean) | null, normal_deceleration: number[] | null = null, area: Rect | null = null) {
    super(left, top, image, area)
    this._normal_deceleration = normal_deceleration
    this._test_collision = test_collision
  }
  start_move_vel(vx: number, vy: number, key_event: ev.PgEvent | null = null) { this._start_move([0, vx, vy], key_event) }
  start_move_accel(ax: number, ay: number, mx = 9999, my = 9999, key_event: ev.PgEvent | null = null) { this._start_move([1, ax, ay, mx, my], key_event) }
  start_move_dynvel(f: (fd: number) => [number, number], key_event: ev.PgEvent | null = null) { this._start_move([2, f], key_event) }
  stop_move(key_event: ev.PgEvent | null = null) {
    if (key_event == null) this._nokey_move = null
    else this._key_moves = this._key_moves.filter((k) => k[0] !== key_event.key)
    this.set_dirty()
  }
  update(fd: number) {
    let vx = 0, vy = 0, n = 0
    if (this._nokey_move != null) { [vx, vy] = this._do_move(this._nokey_move, fd); n++ }
    for (const km of this._key_moves) { const [mx, my] = this._do_move(km[1], fd); vx += mx; vy += my; n++ }
    if (n === 0) {
      if (this._normal_deceleration != null) {
        const d = this._normal_deceleration
        vx = this._prev_velocity[0] >= 0 ? Math.max(0, this._prev_velocity[0] + (d[0] * fd) / 1000) : Math.min(0, this._prev_velocity[0] - (d[0] * fd) / 1000)
        vy = this._prev_velocity[1] >= 0 ? Math.max(0, this._prev_velocity[1] + (d[1] * fd) / 1000) : Math.min(0, this._prev_velocity[1] - (d[1] * fd) / 1000)
      }
    } else { vx /= n; vy /= n }
    const nl = this.get_left() + vx * fd, nt = this.get_top() + vy * fd
    if (this._test_collision == null || !this._test_collision(this, nl, nt)) this.set_lefttop(nl, nt)
    else { vx = 0; vy = 0; this._nokey_move = null; this._key_moves = [] }
    const rect = super.update(fd)
    if (vx !== 0 || vy !== 0 || this._nokey_move != null || this._key_moves.length > 0) this.set_dirty()
    this._prev_velocity = [vx, vy]
    return rect
  }
  private _start_move(t: any[], key_event: ev.PgEvent | null) {
    if (key_event == null) this._nokey_move = t
    else { this._key_moves = this._key_moves.filter((k) => k[0] !== key_event.key); this._key_moves.push([key_event.key!, t]) }
    this.set_dirty()
  }
  private _do_move(m: any[], fd: number): [number, number] {
    if (m[0] === 0) return [m[1], m[2]]
    if (m[0] === 1) {
      let vx = this._prev_velocity[0] + (m[1] * fd) / 1000
      let vy = this._prev_velocity[1] + (m[2] * fd) / 1000
      if (m[1] >= 0) { if (vx > m[3]) vx = m[3] } else if (vx < m[3]) vx = m[3]
      if (m[2] >= 0) { if (vy > m[4]) vy = m[4] } else if (vy < m[4]) vy = m[4]
      return [vx, vy]
    }
    return m[1](fd)
  }
}

// ------------------------------------------------------------------------------------------------
// Texto con marcado: &#c<r>,<g>,<b>! cambia el color, &#c! vuelve al color base,
// &#f:<nombre>! cambia de fuente (additional_fonts) y &#f! vuelve a la fuente base.
// ------------------------------------------------------------------------------------------------
function toRgb(c: Color): number[] {
  if (typeof c === 'string') { const m = c.match(/^#?(..)(..)(..)/); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0] }
  return c.slice()
}
const sameColor = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])
const splitlines = (t: string) => {
  const parts = t.split(/\r\n|\r|\n/)
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts
}

export function render_text(text: string, font: Font, additional_fonts: Record<string, FontSpec>, line_height: number, max_width: number, max_height: number, antialias: boolean, color: number[], background: Color | null, h_align: number, break_text_into: ItemText | null, cursor_index = -1, editable = false): [Surface, boolean] {
  let max_line_width = max_width === -1 ? Number.MAX_SAFE_INTEGER : max_width
  if (max_width !== -1 && editable) max_line_width -= 2
  let [lines, remaining_lines, break_color, break_font] = wrap_text_in_lines(text, false, color, font, line_height, additional_fonts, max_line_width, max_height, break_text_into)
  const text_background = background == null || (Array.isArray(background) && background.length >= 4 && background[3] !== 255) ? null : background
  const line_surfs: [number, number, [Surface, CurFont][]][] = []
  let width = 0, height = 0
  const line_count = lines.length
  for (let i = 0; i < line_count; i++) {
    const part_surfs: [Surface, CurFont][] = []
    let lw = 0, lh = 0
    for (const part of lines[i]) {
      const pf = part[1]
      const ps = pf[0].render(part[2], antialias, part[0], text_background)
      lw += ps.get_width()
      part_surfs.push([ps, pf])
      const ph = i < line_count - 1 ? pf[1] : Math.max(font.get_linesize(), pf[1])
      if (ph > lh) lh = ph
    }
    line_surfs.push([lw, lh, part_surfs])
    if (lw > width) width = lw
    height += lh
  }
  let extra_width = 0
  if (cursor_index !== -1) {
    if (height === 0) height = line_height
    const cursor_lines = wrap_text_in_lines(text, true, color, font, line_height, additional_fonts, max_line_width, max_height, break_text_into)[0]
    draw_cursor(cursor_index, cursor_lines, line_surfs, line_height, font)
    extra_width = 2
  } else if (editable) extra_width = 2
  const surface = new Surface([width + extra_width, height], SRCALPHA)
  if (background != null) surface.fill(background)
  let line_y = 0
  for (const [lw, parts_height, parts] of line_surfs) {
    let line_x = h_align === 2 ? Math.max(0, Math.floor((width - lw) / 2)) : h_align === 3 ? Math.max(0, width - lw) : 0
    let max_ascent = -1
    for (const [ps, pf] of parts) {
      const part_height = pf[1]
      const y_adjust = pf[2] ?? 0
      if (part_height >= parts_height) surface.blit(ps, [line_x, line_y + y_adjust])
      else {
        if (max_ascent === -1) for (const [, pf2] of parts) { const a = pf2[0].get_ascent(); if (a > max_ascent) max_ascent = a }
        const margin = max_ascent - pf[0].get_ascent()
        surface.blit(ps, [line_x, line_y + margin + y_adjust])
      }
      line_x += ps.get_width()
    }
    line_y += parts_height
  }
  if (break_text_into != null) {
    let k = 0
    while (k < remaining_lines.length && /^[ \r\t]*$/.test(remaining_lines[k])) k++
    if (k > 0) remaining_lines = remaining_lines.slice(k)
    let remaining_text = remaining_lines.join('\n')
    if (break_font[0] !== font && break_font[1] != null) remaining_text = '&#f:' + break_font[1] + '!' + remaining_text
    if (!sameColor(break_color, color)) remaining_text = '&#c' + break_color.join(',') + '!' + remaining_text
    break_text_into.set_text(remaining_text)
  }
  return [surface, remaining_lines.length === 0]
}

function draw_cursor(cursor_index: number, lines: LinePart[][], line_surfs: [number, number, [Surface, CurFont][]][], line_height: number, font: Font) {
  let text_index = 0
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    for (let pi = 0; pi < line.length; pi++) {
      const pt = line[pi][2]
      if (cursor_index >= text_index && cursor_index < text_index + pt.length) {
        const ps = line_surfs[li][2][pi][0]
        const x = line[pi][1][0].size(pt.slice(0, cursor_index - text_index))[0]
        ps.fill([0, 0, 0], [x, 1, 2, ps.get_height() - 2])
        return
      }
      text_index += pt.length
    }
  }
  const li = lines.length - 1
  if (li < 0) {
    const ns = new Surface([2, line_height], SRCALPHA)
    ns.fill([0, 0, 0], [0, 1, 2, line_height - 2])
    line_surfs.push([2, line_height, [[ns, [font, line_height, 0, null]]]])
  } else {
    const pi = lines[li].length - 1
    if (pi >= 0) {
      const lps = line_surfs[li][2]
      const [ps, pf] = lps[pi]
      const [w, h] = ps.get_size()
      const ns = new Surface([w + 2, h], SRCALPHA)
      ns.blit(ps, [0, 0])
      lps[pi] = [ns, pf]
      ns.fill([0, 0, 0], [w, 1, 2, h - 2])
    }
  }
}

function hittest_text(text: string, x: number, y: number, font: Font, additional_fonts: Record<string, FontSpec>, line_height: number, width: number, height: number, _aa: boolean, h_align: number, editable = false, break_text_into: ItemText | null = null) {
  let max_line_width = width
  if (editable) max_line_width -= 2
  const lines = wrap_text_in_lines(text, false, [0, 0, 0], font, line_height, additional_fonts, max_line_width, height, break_text_into)[0]
  let line_y = 0, line_index = 0, index = 0
  while (line_index < lines.length - 1 && line_y + line_height < y) {
    for (const p of lines[line_index]) index += p[2].length
    if (index < text.length && text[index] === '\n') index += 1
    line_y += line_height
    line_index += 1
  }
  if (line_index < lines.length) {
    const line = lines[line_index]
    let line_x = 0
    if (h_align !== 1) {
      let lw = 0
      for (const p of line) lw += p[1][0].size(p[2])[0]
      if (h_align === 2) line_x = Math.floor((width - lw) / 2)
      else if (h_align === 3) line_x = width - lw
    }
    let found = false
    for (let pi = 0; pi < line.length && !found; pi++) {
      const pf = line[pi][1][0], pt = line[pi][2]
      let ci = 0, cw = 0
      while (ci < pt.length) {
        ci += 1
        cw = pf.size(pt.slice(0, ci))[0]
        if (line_x + cw < x) index += 1
        else { found = true; break }
      }
      line_x += cw
    }
    if (!found && index > 0 && line_index + 1 < lines.length) index -= 1
  }
  return index
}

function wrap_text_in_lines(text: string, hit_test: boolean, color: number[], font: Font, line_height: number, additional_fonts: Record<string, FontSpec>, max_line_width: number, max_height: number, break_text_into: ItemText | null): [LinePart[][], string[], number[], [Font, string | null]] {
  const lines: LinePart[][] = []
  const remaining_lines: string[] = []
  const current_height = [0]
  const current_color = [color]
  const current_font: CurFont = [font, line_height, 0, null]
  for (const line of splitlines(text)) wrap_line(line, hit_test, font, line_height, additional_fonts, lines, current_height, max_line_width, max_height, remaining_lines, color, current_color, current_font, false, break_text_into)
  return [lines, remaining_lines, current_color[0], [current_font[0], current_font[3]]]
}

function wrap_line(line: string, hit_test: boolean, font: Font, line_height: number, additional_fonts: Record<string, FontSpec>, lines: LinePart[][], current_height: number[], max_width: number, max_height: number, remaining_lines: string[], default_color: number[], current_color: number[][], current_font: CurFont, add_ellipsis: boolean, break_text_into: ItemText | null) {
  if (max_height !== -1 && current_height[0] + line_height > max_height) { remaining_lines.push(line); return }
  let line_width = current_font[0].size(line)[0]
  if (line_width <= max_width && line.indexOf('&#') === -1) {
    lines.push([[current_color[0], [...current_font] as CurFont, line]])
    current_height[0] += current_font[1]
    return
  }
  let start = 0
  let new_line = ''
  let empty_line = true
  line_width = 0
  const space_width = current_font[0].size(' ')[0]
  let line_parts: LinePart[] = []
  let line_parts_height = 0
  while (start < line.length) {
    const next_control = line.indexOf('&#', start)
    let line_part: string, next_word: string
    let next_control_end = -1
    if (next_control === -1) { line_part = line.slice(start); next_word = '' }
    else {
      line_part = line.slice(start, next_control)
      next_control_end = line.indexOf('!', next_control)
      if (next_control_end === -1) next_control_end = line.length
      const k = line.indexOf(' ', next_control_end + 1)
      next_word = k === -1 ? line.slice(next_control_end + 1) : line.slice(next_control_end + 1, k)
    }
    while (next_word.startsWith('&#')) {
      const ce = next_word.indexOf('!')
      if (ce === -1) break
      next_word = next_word.slice(ce + 1)
    }
    if (line_part !== '') {
      const words = line_part.split(' ')
      new_line = ''
      for (let i = 0; i < words.length; i++) {
        let add_word: string | null = words[i]
        let add_space = true
        while (add_word != null) {
          let word: string = add_word
          add_word = null
          let word_width = current_font[0].size(word)[0]
          let extra_width = 0
          if (i === words.length - 1) {
            const kk = next_word.indexOf('&#')
            const nwt = kk === -1 ? next_word : next_word.slice(0, kk)
            extra_width = current_font[0].size(nwt)[0]
          }
          if (word_width > max_width) {
            if (add_ellipsis) {
              const end_width = current_font[0].size('...')[0]
              if (end_width > max_width) { word = ''; word_width = 0 }
              else {
                let k = word.length
                while (k >= 0 && word_width + end_width > max_width) { k -= 1; word_width = current_font[0].size(word.slice(0, k))[0] }
                word = hit_test ? word.slice(0, k) : word.slice(0, k) + '...'
                word_width += end_width
              }
            } else {
              const is_last_line = current_height[0] + current_font[1] * 2 >= max_height
              if (!is_last_line || break_text_into != null) {
                const end_width = current_font[0].size('-')[0]
                if (end_width > max_width) { word = ''; word_width = 0 }
                else {
                  let k = word.length
                  while (k >= 0 && word_width + end_width > max_width) { k -= 1; word_width = current_font[0].size(word.slice(0, k))[0] }
                  add_word = word.slice(k)
                  word = hit_test ? word.slice(0, k) : word.slice(0, k) + '-'
                  word_width += end_width
                }
              } else {
                let k = word.length
                while (k >= 0 && word_width > max_width) { k -= 1; word_width = current_font[0].size(word.slice(0, k))[0] }
                word = word.slice(0, k)
              }
            }
          }
          if (empty_line && line_width + word_width + extra_width <= max_width) {
            new_line = word
            line_width += word_width
            empty_line = false
          } else if (line_width + word_width + space_width + extra_width <= max_width) {
            new_line += ' ' + word
            line_width += word_width + space_width
          } else {
            if (new_line !== '') {
              if (word !== '' && add_space) new_line += ' '
              line_parts.push([current_color[0], [...current_font] as CurFont, new_line])
              line_parts_height = Math.max(line_parts_height, current_font[1])
            }
            if (line_parts.length > 0) {
              lines.push(line_parts)
              current_height[0] += line_parts_height
            }
            line_parts = []
            line_parts_height = 0
            if (word === '') { new_line = ''; line_width = 0; empty_line = true }
            else { new_line = word; line_width = word_width }
            if (max_height !== -1 && current_height[0] + line_height >= max_height) {
              let rest = words.slice(i).join(' ')
              if (next_control !== -1) rest += line.slice(next_control)
              remaining_lines.push(rest)
              return
            }
          }
          add_space = false
        }
      }
    }
    if (next_control === -1) start = line.length
    else {
      if (next_control_end >= next_control + 3) {
        const c = line[next_control + 2]
        if (c === 'c' || c === 'f') {
          if (new_line !== '') {
            line_parts.push([current_color[0], [...current_font] as CurFont, new_line])
            line_parts_height = Math.max(line_parts_height, current_font[1])
            new_line = ''
            empty_line = true
          }
          if (next_control + 3 === next_control_end) {
            if (c === 'c') current_color[0] = default_color
            else { current_font[0] = font; current_font[1] = line_height; current_font[2] = 0; current_font[3] = null }
          } else if (c === 'c') {
            const rgb = line.slice(next_control + 3, next_control_end).split(',')
            current_color[0] = [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])]
          } else {
            const font_name = line.slice(next_control + 4, next_control_end)
            const fs = additional_fonts[font_name]
            if (!fs) console.warn('Fuente adicional desconocida', font_name)
            else {
              current_font[0] = fs[0]; current_font[1] = fs[1]; current_font[2] = fs.length >= 3 ? fs[2] ?? 0 : 0; current_font[3] = font_name
              if (current_font[1] === 0) current_font[1] = current_font[0].get_linesize()
            }
          }
        }
      }
      start = next_control_end + 1
    }
  }
  if (new_line !== '') {
    line_parts.push([current_color[0], [...current_font] as CurFont, new_line])
    line_parts_height = Math.max(line_parts_height, current_font[1])
  }
  if (line_parts.length > 0) {
    lines.push(line_parts)
    current_height[0] += line_parts_height
  }
}

// ------------------------------------------------------------------------------------------------
// Capas
// ------------------------------------------------------------------------------------------------
let layerBuffer: HTMLCanvasElement | null = null

export class Layer {
  items: Item[] = []
  stage: Stage | null = null
  private _visible = true
  private _changed_handler: ((s: Stage) => void) | null = null
  custom_draw: CustomDraw = new CustomDraw()
  private _alpha = 255
  private _clip: Rect | null = null
  dirty_items: Item[] = []
  dirty_layer = false

  contains(item: Item) { return this.items.includes(item) }
  empty() { while (this.items.length > 0) this.remove(this.items[0]) }

  add(item: Item, index = -1) {
    const layer = item.get_layer()
    if (layer != null) layer.remove(item)
    item.set_layer(this)
    if (index === -1 || index >= this.items.length) this.items.push(item)
    else this.items.splice(Math.max(0, index), 0, item)
    item.set_dirty()
    this.stage?.update_mouse()
  }

  remove(item: Item) {
    const focused_item = this.stage != null ? this.stage.get_focus() : null
    const i = this.items.indexOf(item)
    if (i >= 0) {
      if (focused_item === item) this.stage!.set_focus(null)
      this.items.splice(i, 1)
      item.set_layer(null)
      if (this._changed_handler != null) this._changed_handler(this.stage!)
    }
    this.stage?.update_mouse()
  }

  index_of(item: Item) { return this.items.indexOf(item) }
  get_count() { return this.items.length }
  get_visible() { return this._visible }
  set_visible(v: boolean) { if (this._visible !== v) { this._visible = v; if (this.stage != null) this.dirty_layer = true } }

  update(frame_delay: number) {
    const dirty = this.dirty_items
    this.dirty_items = []
    if (this.dirty_layer) {
      this.dirty_layer = false
      for (const item of this.items.slice()) item.update(frame_delay)
    } else for (const item of dirty) item.update(frame_delay)
  }

  draw(surface: Surface) {
    if (this._clip != null && (this._clip.width === 0 || this._clip.height === 0)) return
    const ctx = surface.ctx
    ctx.save()
    if (this._clip != null) {
      ctx.beginPath()
      ctx.rect(this._clip.x, this._clip.y, this._clip.w, this._clip.h)
      ctx.clip()
    }
    if (this._alpha !== 255) {
      // Como en pygame: la capa se compone entera y luego se mezcla con su alfa
      if (this._alpha <= 0) { ctx.restore(); return }
      if (!layerBuffer) layerBuffer = document.createElement('canvas')
      if (layerBuffer.width !== surface.width || layerBuffer.height !== surface.height) { layerBuffer.width = surface.width; layerBuffer.height = surface.height }
      const bctx = layerBuffer.getContext('2d')!
      bctx.clearRect(0, 0, layerBuffer.width, layerBuffer.height)
      const tmp = Surface.fromCanvas(layerBuffer, true)
      tmp.isScreen = true
      this._draw_items(tmp)
      ctx.globalAlpha = this._alpha / 255
      ctx.drawImage(layerBuffer, 0, 0)
    } else this._draw_items(surface)
    ctx.restore()
  }

  private _draw_items(surface: Surface) {
    const ctx = surface.ctx
    this.custom_draw.surface = surface
    for (const item of this.items) {
      if (!item.visible) continue
      const rect = item.rect
      if (item.draw_function == null) {
        const s = item.surface
        if (!s) continue
        const d = s.drawable()
        if (!d) continue
        const a = (item as ItemImage).get_alpha?.() ?? 255
        if (a <= 0) continue
        const prev = ctx.globalAlpha
        ctx.globalAlpha = prev * (a / 255) * (s.surfAlpha != null ? s.surfAlpha / 255 : 1)
        if (item.area == null) ctx.drawImage(d, Math.trunc(rect.x), Math.trunc(rect.y))
        else {
          const ar = Rect.from(item.area as any)
          const sw = Math.min(ar.w, s.width - ar.x), sh = Math.min(ar.h, s.height - ar.y)
          if (sw > 0 && sh > 0) ctx.drawImage(d, ar.x, ar.y, sw, sh, Math.trunc(rect.x), Math.trunc(rect.y), sw, sh)
        }
        ctx.globalAlpha = prev
      } else item.draw_function(item, this.custom_draw)
    }
  }

  add_dirty_item(item: Item) {
    if (!this.dirty_items.includes(item)) this.dirty_items.push(item)
    if (this._changed_handler != null && this.stage) this._changed_handler(this.stage)
  }

  get_alpha() { return this._alpha }
  set_alpha(alpha: number) { if (this._alpha !== alpha) { this._alpha = Math.max(0, Math.min(255, alpha)); this.set_dirty() } }
  get_stage() { return this.stage }
  set_stage(stage: Stage | null) {
    if (stage == null) { this.stage = null; this._changed_handler = null }
    else if (this.stage != null) throw new Error('The layer is already part of a stage')
    else { this.stage = stage; this._changed_handler = stage.get_changed_handler() }
  }

  get_bounds() {
    let b: Rect | null = null
    for (const item of this.items) if (item.get_visible()) { const ib = item.get_bounds(); if (b == null) b = ib; else b.union_ip(ib) }
    return b ?? new Rect(0, 0, 0, 0)
  }
  set_dirty() { this.dirty_layer = true }
  get_clip() { return this._clip }
  set_clip(clip: Rect | null) {
    if (clip != null && clip.height === 0 && this._clip != null && this.items.length > 0) clip = new Rect(this._clip.x, this._clip.y, clip.width, 0)
    this._clip = clip
    this.dirty_layer = true
  }
  is_inside_clip(x: number, y: number) { return this._clip == null || this._clip.collidepoint(x, y) }
}

export class LayerBuffered extends Layer {
  constructor(_w: number, _h: number, _alpha = false) { super() }
}

export class CustomDraw implements CustomDrawTarget {
  surface: Surface | null = null
  constructor(width = 0, height = 0) { if (width) this.surface = new Surface([width, height], SRCALPHA) }
  blit_surface(surface: Surface, pos: number[], area: Rect | number[] | null = null, alpha = 255) {
    if (alpha >= 255) this.surface!.blit(surface, pos, area)
    else if (alpha > 0) {
      const ctx = this.surface!.ctx
      const prev = ctx.globalAlpha
      ctx.globalAlpha = prev * (alpha / 255)
      this.surface!.blit(surface, pos, area)
      ctx.globalAlpha = prev
    }
  }
  blit_image(image: Image, pos: number[], area: Rect | number[] | null = null) { this.surface!.blit(image.surface, pos, area) }
  blit_stage(stage: Stage, pos: number[], area: Rect | number[] | null = null) {
    const s = stage.target_surface ?? stage.game.window
    this.surface!.blit(s, pos, area)
  }
  clear(color: Color) { this.surface!.fill(color) }
  fill(color: Color, rect: Rect | number[]) { this.surface!.fill(color, rect) }
  draw_line(color: Color, a: number[], b: number[], width = 1) { pygame.draw.line(this.surface!, color, a, b, width) }
  draw_rect(color: Color, rect: Rect | number[], width = 1) { pygame.draw.rect(this.surface!, color, rect, width) }
}
