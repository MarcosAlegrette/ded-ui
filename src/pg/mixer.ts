// pygame.mixer sobre Web Audio: Sound, Channel (con queue y endevent, que el juego usa para
// encadenar la intro de cada música con su loop), canales reservados y volúmenes.
// Se usa el OGG original y, si el navegador no lo decodifica, el MP3 de respaldo.
import DURATIONS from '../data/sounds.json'
import { post } from './events.ts'

const durations = DURATIONS as Record<string, number>
let ctx: AudioContext | null = null
let master: GainNode | null = null
const probe = typeof Audio !== 'undefined' ? new Audio() : null
const EXT = probe && probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'
let base = '/assets/sounds/'
export const volumes = { music: 0.8, sfx: 1 }
const NUM_CHANNELS = 8
let reserved = 0

export function audioContext() { return ctx }

/** Crea/reanuda el AudioContext (los navegadores exigen un gesto del usuario). */
export function unlock() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      master = ctx.createGain()
      master.connect(ctx.destination)
    } catch { ctx = null }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  for (const c of channels) c.applyVolume()
}

const buffers = new Map<string, Promise<AudioBuffer | null>>()
function loadBuffer(file: string): Promise<AudioBuffer | null> {
  const key = file.replace(/\.(ogg|wav)$/i, '')
  let p = buffers.get(key)
  if (!p) {
    p = (async () => {
      if (!ctx) unlock()
      if (!ctx) return null
      for (const ext of EXT === 'ogg' ? ['ogg', 'mp3'] : ['mp3']) {
        try {
          const r = await fetch(base + encodeURIComponent(key) + '.' + ext)
          if (!r.ok) continue
          return await ctx.decodeAudioData(await r.arrayBuffer())
        } catch { /* probar el siguiente formato */ }
      }
      console.warn('No se pudo cargar el sonido', file)
      return null
    })()
    buffers.set(key, p)
  }
  return p
}

export class Sound {
  readonly file: string
  buffer: AudioBuffer | null = null
  volume = 1
  private loading: Promise<AudioBuffer | null> | null = null

  constructor(file: string) {
    this.file = file
  }

  load() {
    if (!this.loading) this.loading = loadBuffer(this.file).then((b) => (this.buffer = b))
    return this.loading
  }

  /** Duración en segundos (conocida de antemano gracias a src/data/sounds.json). */
  get_length() { return this.buffer?.duration ?? durations[this.file] ?? 0 }

  play(loops = 0, maxtime = 0, fade_ms = 0): Channel | null {
    const ch = find_channel()
    if (!ch) return null
    ch.play(this, loops, maxtime, fade_ms)
    return ch
  }

  stop() { for (const c of channels) if (c.sound === this) c.stop() }
  fadeout(ms: number) { for (const c of channels) if (c.sound === this) c.fadeout(ms) }
  set_volume(v: number) { this.volume = Math.max(0, Math.min(1, v)); for (const c of channels) if (c.sound === this) c.applyVolume() }
  get_volume() { return this.volume }
  get_num_channels() { return channels.filter((c) => c.sound === this && c.get_busy()).length }
  get_buffer() { return this.buffer }
}

export class Channel {
  readonly id: number
  sound: Sound | null = null
  private queued: Sound | null = null
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private volume = 1
  private endevent: number | null = null
  private token = 0
  private startedAt = 0
  private offset = 0
  private paused = false
  private loops = 0
  private busyUntil = 0

  constructor(id: number) { this.id = id }

  private category() { return this.id < reserved ? volumes.music : volumes.sfx }

  applyVolume() {
    if (this.gain && ctx) this.gain.gain.setValueAtTime(this.volume * (this.sound?.volume ?? 1) * this.category(), ctx.currentTime)
  }

  play(sound: Sound, loops = 0, maxtime = 0, fade_ms = 0) {
    this.stopSource()
    this.sound = sound
    this.loops = loops
    this.offset = 0
    this.paused = false
    const token = ++this.token
    const len = sound.get_length()
    this.busyUntil = loops === -1 ? Infinity : performance.now() + len * 1000 * (loops + 1)
    if (maxtime > 0) this.busyUntil = Math.min(this.busyUntil, performance.now() + maxtime)
    void sound.load().then((buf) => {
      if (token !== this.token || !buf || !ctx) {
        if (token === this.token && (!buf || !ctx)) this.scheduleEnd(token, len * 1000 * (loops === -1 ? 1 : loops + 1))
        return
      }
      this.startSource(buf, 0, maxtime, fade_ms, token)
    })
  }

  private startSource(buf: AudioBuffer, offset: number, maxtime: number, fade_ms: number, token: number) {
    if (!ctx || !master) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    src.connect(g).connect(master)
    this.src = src
    this.gain = g
    const target = this.volume * (this.sound?.volume ?? 1) * this.category()
    if (fade_ms > 0) {
      g.gain.setValueAtTime(0, ctx.currentTime)
      g.gain.linearRampToValueAtTime(target, ctx.currentTime + fade_ms / 1000)
    } else g.gain.setValueAtTime(target, ctx.currentTime)
    let total: number | undefined
    if (this.loops !== 0) {
      src.loop = true
      if (this.loops > 0) total = buf.duration * (this.loops + 1) - offset
    }
    if (maxtime > 0) total = Math.min(total ?? Infinity, maxtime / 1000)
    src.start(0, offset % buf.duration)
    if (total !== undefined && isFinite(total)) src.stop(ctx.currentTime + total)
    this.startedAt = ctx.currentTime - offset
    src.onended = () => { if (token === this.token && this.src === src && !this.paused) this.finished() }
  }

  private scheduleEnd(token: number, ms: number) {
    setTimeout(() => { if (token === this.token && !this.paused) this.finished() }, Math.max(0, ms))
  }

  private finished() {
    this.src = null
    this.gain = null
    const q = this.queued
    this.queued = null
    this.sound = null
    this.busyUntil = 0
    if (this.endevent != null) post({ type: this.endevent })
    if (q) this.play(q, 0)
  }

  private stopSource() {
    this.token++
    const s = this.src
    this.src = null
    this.gain = null
    if (s) { s.onended = null; try { s.stop() } catch { /* ya terminó */ } }
  }

  stop() {
    this.stopSource()
    this.sound = null
    this.queued = null
    this.paused = false
    this.busyUntil = 0
  }

  fadeout(ms: number) {
    if (!this.gain || !ctx || !this.src) { this.stop(); return }
    const g = this.gain, s = this.src, token = this.token
    g.gain.cancelScheduledValues(ctx.currentTime)
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000)
    try { s.stop(ctx.currentTime + ms / 1000) } catch { /* nada */ }
    void token
  }

  pause() {
    if (this.paused || !this.src || !ctx) { this.paused = true; return }
    this.paused = true
    this.offset = ctx.currentTime - this.startedAt
    const s = this.src
    this.src = null
    s.onended = null
    try { s.stop() } catch { /* nada */ }
  }

  unpause() {
    if (!this.paused) return
    this.paused = false
    const snd = this.sound
    if (snd?.buffer && ctx) this.startSource(snd.buffer, this.offset, 0, 0, this.token)
  }

  queue(sound: Sound) {
    if (!this.get_busy()) this.play(sound, 0)
    else { this.queued = sound; void sound.load() }
  }

  set_volume(v: number) { this.volume = Math.max(0, Math.min(1, v)); this.applyVolume() }
  get_volume() { return this.volume }
  get_busy() { return this.sound != null && (this.src != null || this.paused || performance.now() < this.busyUntil) }
  get_sound() { return this.sound }
  get_queue() { return this.queued }
  set_endevent(type?: number) { this.endevent = type ?? null }
  get_endevent() { return this.endevent ?? 0 }
}

const channels: Channel[] = Array.from({ length: NUM_CHANNELS }, (_, i) => new Channel(i))

export function ChannelN(id: number) { return channels[id] }
export function find_channel(force = false): Channel | null {
  for (let i = reserved; i < channels.length; i++) if (!channels[i].get_busy()) return channels[i]
  return force ? channels[reserved] : null
}
export function set_reserved(n: number) { reserved = n }
export function get_num_channels() { return channels.length }
export function stop() { for (const c of channels) c.stop() }
export function setBase(b: string) { base = b }
export function setVolumes(v: { music?: number; sfx?: number }) {
  Object.assign(volumes, v)
  for (const c of channels) c.applyVolume()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else void ctx.resume()
  })
}
