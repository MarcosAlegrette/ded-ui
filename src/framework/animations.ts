// Port de framework/animations.py: fundidos, secuencias de imágenes, movimientos, cambios de
// tamaño, esperas y "persianas" (blind) con los mismos tiempos del original.
import pygame, { Rect } from '../pg/index.ts'
import { ItemImage, setBlindLayerHook, type Item, type Layer, type Stage } from './stage.ts'
import * as assets from './assets.ts'
import type { Image } from './assets.ts'

let WAIT_ORDINAL = 1

export const BlindDirection = { SHOW_UP: 0, SHOW_DOWN: 1, HIDE_UP: 2, HIDE_DOWN: 3 }

export class MoveMarks {
  constructor(public mark_image: Image, public separation: number) {}
}

function itemStage(item: Item): Stage {
  const layer = item.get_layer()
  if (layer == null) throw new Error('The item must be part of a layer')
  const stage = layer.get_stage()
  if (stage == null) throw new Error("The item's layer must be part of a stage")
  return stage
}
function layerStage(layer: Layer): Stage {
  const stage = layer.get_stage()
  if (stage == null) throw new Error('The layer must be part of a stage')
  return stage
}

export function fade_in_item(item: any, duration = 500, callback: ((i: any) => void) | null = null, to_alpha = 255) {
  const stage = itemStage(item)
  const key = [item, 'fade']
  if (item.get_alpha() === 255) item.set_alpha(0)
  stage.stop_timer(key)
  stage.start_timer(key, 20, timer_fade_in_item, [pygame.time.get_ticks(), null, duration, to_alpha, callback, stage], true, true)
  return key
}

export function fade_out_item(item: any, remove: boolean, duration = 500, callback: ((i: any) => void) | null = null) {
  const stage = itemStage(item)
  const key = [item, 'fade']
  stage.stop_timer(key)
  item.hide_rollover()
  stage.start_timer(key, 20, timer_fade_out_item, [pygame.time.get_ticks(), null, duration, remove, callback, stage], true, true)
  return key
}

export function cancel_item_fade(key: any[]) { itemStage(key[0]).stop_timer(key) }

export function fade_in_layer(layer: Layer, duration = 500, callback: ((l: Layer) => void) | null = null) {
  const stage = layerStage(layer)
  if (layer.get_alpha() === 255) layer.set_alpha(0)
  const key = [layer, 'fade']
  stage.stop_timer(key)
  stage.start_timer(key, 20, timer_fade_in_layer, [pygame.time.get_ticks(), null, duration, callback, stage], true, true)
}

export function fade_out_layer(layer: Layer, duration = 500, callback: ((l: Layer) => void) | null = null) {
  const stage = layerStage(layer)
  const key = [layer, 'fade']
  stage.stop_timer(key)
  stage.start_timer(key, 20, timer_fade_out_layer, [pygame.time.get_ticks(), null, duration, callback, stage], true, true)
}

export function start_image_sequence(item_image: ItemImage, images: Image[], fps: number, loops = 0, callback: ((i: any) => void) | null = null) {
  const stage = itemStage(item_image)
  const key = [item_image, 'image_sequence']
  stage.stop_timer(key)
  stage.start_timer(key, Math.floor(1000 / fps), timer_image_sequence, [3, images, loops, callback, stage])
}

export function stop_image_sequence(item_image: ItemImage) {
  const stage = itemStage(item_image)
  const data = stage.stop_timer([item_image, 'image_sequence'])
  return data == null ? 0 : data[0]
}

export function start_move(item: Item, left: number, top: number, duration: number, acceleration: number[] | null = null, move_marks: MoveMarks | null = null, callback: ((i: any) => void) | null = null) {
  const stage = itemStage(item)
  const key = [item, 'move']
  stage.stop_timer(key)
  const item_left = item.get_left(), item_top = item.get_top()
  let move_marks_data: number[] | null = null
  if (move_marks != null) {
    const angle = Math.atan2(top - item_top, left - item_left)
    const dx = Math.cos(angle) * move_marks.separation
    const dy = Math.sin(angle) * move_marks.separation
    if (!(Math.abs(dx) < 1 && Math.abs(dy) < 1)) {
      const mdx = Math.floor(item.get_width() / 2) - Math.floor(move_marks.mark_image.get_width() / 2)
      const mdy = Math.floor(item.get_height() / 2) - Math.floor(move_marks.mark_image.get_height() / 2)
      move_marks_data = [item_left - dx, item_top - dy, dx, dy, mdx, mdy]
    }
  }
  stage.start_timer(key, 20, timer_move, [null, duration, item_left, item_top, left, top, acceleration, move_marks, move_marks_data, callback, stage], true, true)
}

export function remove_move_marks(item: Item) {
  const layer = item.get_layer()
  if (layer != null) for (const i of layer.items.slice()) if (i instanceof ItemImage && (i as any).move_mark_item === item) layer.remove(i)
}

export function stop_move(item: Item) { itemStage(item).stop_timer([item, 'move']) }

export function start_resize(item_image: ItemImage, image: Image, from_size: number[], to_size: number[], duration: number, origin_type = 1, callback: ((i: any) => void) | null = null) {
  const stage = itemStage(item_image)
  const key = [item_image, 'resize']
  stage.stop_timer(key)
  item_image.set_image(new assets.Image(pygame.transform.smoothscale(image.surface, [Math.trunc(from_size[0]), Math.trunc(from_size[1])])))
  const origin_pos = origin_type === 1 ? [item_image.get_left() + Math.floor(item_image.get_width() / 2), item_image.get_top() + Math.floor(item_image.get_height() / 2)] : null
  stage.start_timer(key, 20, timer_resize, [null, image, duration, origin_type, origin_pos, from_size, to_size, callback, stage], true, true)
}

export function stop_resize(item_image: ItemImage) { itemStage(item_image).stop_timer([item_image, 'resize']) }

export function wait(stage: Stage, milliseconds: number, callback: () => void) {
  const key = ['wait', WAIT_ORDINAL]
  stage.start_timer(key, milliseconds, timer_wait, [stage, callback])
  WAIT_ORDINAL += 1
  if (WAIT_ORDINAL === 99999) WAIT_ORDINAL = 1
  return key
}

export function wait_locked(stage: Stage, milliseconds: number, callback: ((d?: any) => void) | null, data: any = null) {
  stage.lock_ui()
  const key = ['wait_locked', WAIT_ORDINAL]
  stage.start_timer(key, milliseconds, timer_wait_locked, [stage, callback, data])
  WAIT_ORDINAL += 1
  if (WAIT_ORDINAL === 99999) WAIT_ORDINAL = 1
  return key
}

export function cancel_wait(stage: Stage, key: unknown) { stage.stop_timer(key) }

export function stop_blind_layer(layer: Layer) {
  const stage = layerStage(layer)
  const data = stage.stop_timer([layer, 'blind'])
  if (data != null) {
    if (data[9]) stage.unlock_ui()
    const direction = data[1]
    if (direction === BlindDirection.SHOW_UP || direction === BlindDirection.SHOW_DOWN) layer.set_clip(null)
    else layer.set_clip(new Rect(0, data[5], data[3], data[6]))
  }
}

export function blind_layer(layer: Layer, direction: number, area: Rect | null, duration = 450, callback: ((l: Layer) => void) | null = null, lock_ui = true) {
  const stage = layerStage(layer)
  const key = [layer, 'blind']
  let data = stage.stop_timer(key)
  const [ww, wh] = stage.game.get_window_size()
  const dy_factor = wh / duration
  if (data != null && data[9]) stage.unlock_ui()
  if (data != null && data[1] === direction && data[0] != null) data[7] = callback
  else {
    let current_top = 0, current_height = 0
    if (direction === BlindDirection.SHOW_UP || direction === BlindDirection.SHOW_DOWN) {
      if (direction === BlindDirection.SHOW_DOWN) current_top = area == null ? 0 : area.top
      else current_top = area == null ? wh : area.top + area.height
      current_height = 0
      layer.set_clip(new Rect(0, current_top, ww, 0))
    } else {
      let hidden = false
      if (!layer.get_visible()) hidden = true
      else {
        const clip = layer.get_clip()
        if (clip != null && (clip.width === 0 || clip.height === 0)) hidden = true
      }
      if (hidden) { if (callback != null) callback(layer); return }
      if (area == null) { current_top = 0; current_height = wh } else { current_top = area.top; current_height = area.height }
      layer.set_clip(null)
    }
    data = [null, direction, dy_factor, ww, wh, current_top, current_height, callback, stage, lock_ui]
  }
  if (lock_ui) stage.lock_ui()
  stage.start_timer(key, 20, timer_blind_layer, data, true, true)
}
setBlindLayerHook(blind_layer)

export function cancel_blind_layer(stage: Stage, layer: Layer, show: boolean) {
  const data = stage.stop_timer([layer, 'blind'])
  if (data != null && data[9]) stage.unlock_ui()
  layer.set_clip(show ? null : new Rect(0, 0, 0, 0))
}

export function is_applying_blind(stage: Stage, layer: Layer) { return stage.is_timer_started([layer, 'blind']) }

// ---- timers ----
function timer_fade_in_item(key: any[], data: any[]) {
  const item = key[0]
  const now = pygame.time.get_ticks()
  const elapsed = data[1] == null ? Math.min(0, now - data[0]) : now - data[1]
  data[1] = now
  const to_alpha = data[3]
  const alpha = item.get_alpha() + to_alpha * (elapsed / data[2])
  if (alpha < to_alpha) item.set_alpha(alpha)
  else {
    item.set_alpha(to_alpha)
    data[5].stop_timer(key)
    if (data[4] != null) data[4](item)
  }
}

function timer_fade_out_item(key: any[], data: any[]) {
  const item = key[0]
  const now = pygame.time.get_ticks()
  const elapsed = data[1] == null ? Math.min(0, now - data[0]) : now - data[1]
  data[1] = now
  const alpha = item.get_alpha() - 255 * (elapsed / data[2])
  if (alpha >= 0) item.set_alpha(alpha)
  else {
    item.set_alpha(0)
    const layer = item.get_layer()
    if (data[3] && layer != null) layer.remove(item)
    data[5].stop_timer(key)
    if (data[4] != null) data[4](item)
  }
}

function timer_fade_in_layer(key: any[], data: any[]) {
  const layer = key[0]
  const now = pygame.time.get_ticks()
  const elapsed = data[1] == null ? Math.min(0, now - data[0]) : now - data[1]
  data[1] = now
  const alpha = layer.get_alpha() + 255 * (elapsed / data[2])
  if (alpha < 255) layer.set_alpha(alpha)
  else {
    layer.set_alpha(255)
    data[4].stop_timer(key)
    if (data[3] != null) data[3](layer)
  }
}

function timer_fade_out_layer(key: any[], data: any[]) {
  const layer = key[0]
  const now = pygame.time.get_ticks()
  const elapsed = data[1] == null ? Math.min(0, now - data[0]) : now - data[1]
  data[1] = now
  const alpha = layer.get_alpha() - 255 * (elapsed / data[2])
  if (alpha >= 0) layer.set_alpha(alpha)
  else {
    layer.set_alpha(0)
    data[4].stop_timer(key)
    if (data[3] != null) data[3](layer)
  }
}

function timer_image_sequence(key: any[], data: any[]) {
  const item = key[0]
  const images = data[1]
  if (images.length > 0) item.set_image(images[data[0] % images.length])
  data[0] += 1
  if (data[0] >= images.length) {
    data[0] = 0
    if (data[2] !== -1) {
      data[2] -= 1
      if (data[2] < 0) {
        data[4].stop_timer(key)
        if (data[3] != null) data[3](item)
      }
    }
  }
}

function timer_move(key: any[], data: any[]) {
  const item = key[0]
  const now = pygame.time.get_ticks()
  let elapsed = 0
  if (data[0] == null) data[0] = now
  else elapsed = now - data[0]
  const [, duration, left_from, top_from, left_to, top_to, acceleration] = data
  const p = Math.min(1, duration > 0 ? elapsed / duration : 1)
  let dx: number, dy: number
  if (acceleration == null) { dx = (left_to - left_from) * p; dy = (top_to - top_from) * p }
  else {
    const [maxvel_t, maxvel_dist, tension] = acceleration
    let f: number
    if (p <= maxvel_t) f = Math.pow(Math.cos((p / maxvel_t) * Math.PI / 2 - Math.PI) + 1, tension) * maxvel_dist
    else f = Math.pow(Math.cos(((p - maxvel_t) / (1 - maxvel_t)) * Math.PI / 2 - Math.PI / 2) + 1 - 1, tension) * (1 - maxvel_dist) + maxvel_dist
    dx = (left_to - left_from) * f
    dy = (top_to - top_from) * f
  }
  const nl = left_from + dx, nt = top_from + dy
  item.set_left(nl)
  item.set_top(nt)
  const mm: MoveMarks | null = data[7]
  if (mm != null && data[8] != null) {
    const md = data[8]
    let guard = 0
    while (((md[2] > 0 && md[0] + md[2] < nl) || (md[2] < 0 && md[0] + md[2] > nl)) && ((md[3] > 0 && md[1] + md[3] < nt) || (md[3] < 0 && md[1] + md[3] > nt) || md[3] === 0) && guard++ < 500) {
      const mx = md[0] + md[2], my = md[1] + md[3]
      const mark: any = new ItemImage(mx + md[4], my + md[5], mm.mark_image)
      mark.move_mark_item = item
      const layer = item.get_layer()
      if (layer != null) layer.add(mark, layer.items.indexOf(item))
      md[0] = mx
      md[1] = my
    }
  }
  if (p >= 1) {
    data[10].stop_timer(key)
    if (data[9] != null) data[9](item)
  }
}

function timer_resize(key: any[], data: any[]) {
  const item = key[0]
  const now = pygame.time.get_ticks()
  let elapsed = 0
  if (data[0] == null) data[0] = now
  else elapsed = now - data[0]
  const [, image, duration, origin_type, origin_pos, from_size, to_size] = data
  const p = Math.min(1, elapsed / duration)
  const ns = [Math.trunc(from_size[0] + (to_size[0] - from_size[0]) * p), Math.trunc(from_size[1] + (to_size[1] - from_size[1]) * p)]
  let nl: number, nt: number
  if (origin_type === 1) { nl = origin_pos[0] - Math.floor(ns[0] / 2); nt = origin_pos[1] - Math.floor(ns[1] / 2) }
  else { nl = item.get_left(); nt = item.get_top() }
  item.set_image(new assets.Image(pygame.transform.smoothscale(image.surface, ns)))
  item.set_left(nl)
  item.set_top(nt)
  if (p >= 1) {
    data[8].stop_timer(key)
    if (data[7] != null) data[7](item)
  }
}

function timer_wait(key: unknown, data: any[]) {
  data[0].stop_timer(key)
  data[1]()
}

function timer_wait_locked(key: unknown, data: any[]) {
  const [stage, callback, cb_data] = data
  stage.stop_timer(key)
  stage.unlock_ui()
  if (callback != null) { if (cb_data == null) callback(); else callback(cb_data) }
}

function timer_blind_layer(key: any[], data: any[]) {
  const layer: Layer = key[0]
  const now = pygame.time.get_ticks()
  const elapsed = data[0] == null ? 0 : now - data[0]
  data[0] = now
  const dy = elapsed * data[2]
  let end = false
  let show = false
  const d = data[1]
  if (d === BlindDirection.SHOW_UP) {
    show = true
    if (data[6] >= data[4]) end = true
    else if (data[6] + dy >= data[4]) { data[5] = 0; data[6] = data[4] }
    else { data[5] -= dy; data[6] += dy }
  } else if (d === BlindDirection.SHOW_DOWN) {
    show = true
    if (data[6] >= data[4]) end = true
    else if (data[6] + dy >= data[4]) data[6] = data[4]
    else data[6] += dy
  } else if (d === BlindDirection.HIDE_UP) {
    if (data[6] <= 0) end = true
    else if (data[6] - dy <= 0) { data[6] = 0; end = true }
    else data[6] -= dy
  } else if (d === BlindDirection.HIDE_DOWN) {
    if (data[6] <= 0) end = true
    else if (data[6] - dy <= 0) { data[5] = 0; data[6] = 0; end = true }
    else { data[5] += dy; data[6] -= dy }
  }
  if (end && show) layer.set_clip(null)
  else layer.set_clip(new Rect(0, data[5], data[3], data[6]))
  if (end) {
    const stage = data[8]
    stage.stop_timer(key)
    stage.update_mouse()
    if (data[9]) stage.unlock_ui()
    if (data[7] != null) data[7](layer)
  }
}
