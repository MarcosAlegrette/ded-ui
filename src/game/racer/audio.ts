// RECONSTRUCCIÓN (no es código original): sonidos en loop con volumen y tono variables para la
// persecución (motor, sirena, terreno, tránsito) y música con punto de loop (loop_start del yaml).
// Usa los sonidos originales (OGG/MP3 generados a partir de los WAV/OGG del juego).
import * as assets from '../../framework/assets.ts'
import { audioContext, volumes } from '../../pg/mixer.ts'

export const strip = (p: string) => p.replace(/^(images|sounds)\//, '')

export class LoopSound {
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private buf: AudioBuffer | null = null
  private wanted = false
  private vol: number
  private rate = 1
  private music: boolean
  private loopStart: number

  constructor(file: string, volume = 1, music = false, loopStart = 0) {
    this.vol = volume
    this.music = music
    this.loopStart = loopStart
    const cs = assets.load_sound(strip(file))
    void cs.sound.load().then((b) => { this.buf = b; if (this.wanted) this.start() })
  }

  private level() { return this.vol * (this.music ? volumes.music : volumes.sfx) }

  play() {
    this.wanted = true
    if (!this.src) this.start()
  }

  private start() {
    const ctx = audioContext()
    if (!ctx || !this.buf || this.src) return
    const src = ctx.createBufferSource()
    src.buffer = this.buf
    src.loop = true
    if (this.loopStart > 0 && this.loopStart < this.buf.duration) { src.loopStart = this.loopStart; src.loopEnd = this.buf.duration }
    src.playbackRate.value = this.rate
    const g = ctx.createGain()
    g.gain.value = this.level()
    src.connect(g).connect(ctx.destination)
    src.start()
    this.src = src
    this.gain = g
  }

  stop() {
    this.wanted = false
    if (this.src) { try { this.src.stop() } catch { /* nada */ } this.src.disconnect() }
    this.src = null
    this.gain = null
  }

  set(volume?: number, rate?: number) {
    const ctx = audioContext()
    if (volume !== undefined) this.vol = volume
    if (rate !== undefined) this.rate = rate
    if (ctx && this.gain) this.gain.gain.setTargetAtTime(this.level(), ctx.currentTime, 0.03)
    if (ctx && this.src) this.src.playbackRate.setTargetAtTime(this.rate, ctx.currentTime, 0.05)
  }

  get playing() { return this.wanted }
}

/** Sonido de una sola vez (choques, frenada, advertencias, música de ganar/perder). */
export class OneShot {
  private buf: AudioBuffer | null = null
  private vol: number
  private music: boolean
  private node: AudioBufferSourceNode | null = null
  constructor(file: string, volume = 1, music = false) {
    this.vol = volume
    this.music = music
    void assets.load_sound(strip(file)).sound.load().then((b) => (this.buf = b))
  }
  play(onEnd?: () => void) {
    const ctx = audioContext()
    if (!ctx || !this.buf) { onEnd?.(); return }
    const src = ctx.createBufferSource()
    src.buffer = this.buf
    const g = ctx.createGain()
    g.gain.value = this.vol * (this.music ? volumes.music : volumes.sfx)
    src.connect(g).connect(ctx.destination)
    src.onended = () => onEnd?.()
    src.start()
    this.node = src
  }
  stop() { if (this.node) { this.node.onended = null; try { this.node.stop() } catch { /* nada */ } } this.node = null }
}
