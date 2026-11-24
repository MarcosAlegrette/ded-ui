// Port de framework/assets.py: imágenes, sonidos, fuentes y archivos de datos.
// Los archivos de datos del juego (niveles .tcs/.tcl) vienen de src/data/files.json; los que el juego
// guarda (personajes, progreso, récords) van a localStorage con el mismo formato de filas ';'.
import { Surface } from '../pg/surface.ts'
import { Font } from '../pg/font.ts'
import { Sound } from '../pg/mixer.ts'
import pygame from '../pg/index.ts'
import FILES from '../data/files.json'

export let SOUND_VOLUME = 1
export function setSoundVolume(v: number) { SOUND_VOLUME = v }

const files = FILES as Record<string, string[][]>
const extraFiles: Record<string, string[][]> = {}
/** Registra archivos de datos grandes que se cargan con su módulo (p. ej. diccionarios). */
export function register_data(name: string, rows: string[][]) { extraFiles[name] = rows }

const STORE = 'ded.data.'
export let onSave: ((file: string) => void) | null = null
export function setOnSave(f: ((file: string) => void) | null) { onSave = f }

export function load_data(file_name: string, field_sep = ';', throw_exception = true, _compressed = true, from_dynamic_path = false): string[][] {
  if (from_dynamic_path) {
    try {
      const s = localStorage.getItem(STORE + file_name)
      if (s != null) return JSON.parse(s)
    } catch { /* modo privado */ }
    if (throw_exception) throw new Error('Cannot load data file: ' + file_name)
    return []
  }
  const rows = files[file_name] ?? extraFiles[file_name]
  if (!rows) {
    if (throw_exception) throw new Error('Cannot load data file: ' + file_name)
    return []
  }
  void field_sep
  return rows.map((r) => r.slice())
}

export function save_data(file_name: string, data: (string | number)[][], _field_sep = ';', _compress = true) {
  const rows = data.map((r) => r.map((x) => String(x)))
  try { localStorage.setItem(STORE + file_name, JSON.stringify(rows)) } catch (e) { console.warn('No se pudo guardar', file_name, e) }
  onSave?.(file_name)
}

export function delete_data(file_name: string) {
  try { localStorage.removeItem(STORE + file_name) } catch { /* nada */ }
  onSave?.(file_name)
}

/** Todos los archivos guardados (para la nube). */
export function export_saved(): Record<string, string[][]> {
  const out: Record<string, string[][]> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.startsWith(STORE)) out[k.slice(STORE.length)] = JSON.parse(localStorage.getItem(k)!)
    }
  } catch { /* nada */ }
  return out
}
export function import_saved(data: Record<string, string[][]>) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)!
      if (k.startsWith(STORE)) localStorage.removeItem(k)
    }
    for (const [k, v] of Object.entries(data)) localStorage.setItem(STORE + k, JSON.stringify(v))
  } catch { /* nada */ }
}

export class CustomSound {
  sound: Sound
  constructor(sound: Sound) { this.sound = sound }
  play(loops = 0, maxtime = 0) {
    const channel = this.sound.play(loops, maxtime)
    if (channel != null) channel.set_volume(SOUND_VOLUME)
    return channel
  }
  stop() { this.sound.stop() }
  get_length() { return this.sound.get_length() }
  fade_out() { this.sound.fadeout(200) }
  fadeout(ms = 200) { this.sound.fadeout(ms) }
  set_volume(v: number) { this.sound.set_volume(v) }
  get_volume() { return this.sound.get_volume() }
  get_num_channel() { return this.sound.get_num_channels() }
  get_buffer() { return this.sound.get_buffer() }
}

const sounds = new Map<string, Sound>()
export function load_sound(file_name: string) {
  let s = sounds.get(file_name)
  if (!s) { s = new Sound(file_name); sounds.set(file_name, s); void s.load() }
  return new CustomSound(s)
}
export const load_music = load_sound

export class Image {
  surface: Surface
  private file_name: string
  constructor(surface: Surface, file_name = '') {
    this.surface = surface
    this.file_name = file_name
  }
  get_file_name() { return this.file_name }
  get_width() { return this.surface.get_width() }
  get_height() { return this.surface.get_height() }
  get_size(): [number, number] { return [this.get_width(), this.get_height()] }
  get_at(x: number | number[], y?: number) { return typeof x === 'number' ? this.surface.get_at([x, y!]) : this.surface.get_at(x) }
  flip_h() { this.surface = pygame.transform.flip(this.surface, true, false) }
  flip_h_copy() { return new Image(pygame.transform.flip(this.surface, true, false), this.file_name) }
  flip_v() { this.surface = pygame.transform.flip(this.surface, false, true) }
  flip_v_copy() { return new Image(pygame.transform.flip(this.surface, false, true), this.file_name) }
  flip_hv() { this.surface = pygame.transform.flip(this.surface, true, true) }
  flip_hv_copy() { return new Image(pygame.transform.flip(this.surface, true, true), this.file_name) }
  get_real_rect() { return this.surface.get_rect() }
  blit_over(target: Surface, pos: number[], area?: unknown) { target.blit(this.surface, pos, area as any) }
}

const surfaces = new Map<string, Surface>()
export function load_surface(file_name: string): Surface {
  let s = surfaces.get(file_name)
  if (!s) { s = Surface.fromImage(file_name); surfaces.set(file_name, s) }
  return s
}
export function load_image(file_name: string) { return new Image(load_surface(file_name), file_name) }
export function load_mask(file_name: string) { return load_surface(file_name) }
/** Carga anticipada (para que la pantalla de carga espere estas imágenes). */
export function preload_images(names: string[]) { for (const n of names) load_surface(n) }

export function load_image_alpha(file_name_rgb: string, file_name_alpha: string | null) {
  const rgb = load_surface(file_name_rgb)
  if (file_name_alpha == null) return new Image(rgb, file_name_rgb)
  const a = load_surface(file_name_alpha)
  const out = new Surface([rgb.width, rgb.height], pygame.SRCALPHA)
  out.draw([rgb, a], (ctx) => {
    // canal alfa = canal rojo de la imagen de máscara
    const w = rgb.width, h = rgb.height
    const c1 = document.createElement('canvas'); c1.width = w; c1.height = h
    const x1 = c1.getContext('2d')!; x1.drawImage(rgb.drawable()!, 0, 0)
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h
    const x2 = c2.getContext('2d')!; x2.drawImage(a.drawable()!, 0, 0)
    const d1 = x1.getImageData(0, 0, w, h), d2 = x2.getImageData(0, 0, w, h).data
    for (let i = 0; i < d1.data.length; i += 4) d1.data[i + 3] = d2[i]
    ctx.putImageData(d1, 0, 0)
  })
  return new Image(out, file_name_rgb)
}

const fonts = new Map<string, Font>()
export function load_font(file_name: string, size: number) {
  const k = file_name + ':' + size
  let f = fonts.get(k)
  if (!f) { f = new Font(file_name, size); fonts.set(k, f) }
  return f
}
