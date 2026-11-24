// Port de framework/sounds.py (canal virtual con fundido cruzado)
import type { CustomSound } from './assets.ts'
import type { Channel } from '../pg/mixer.ts'

export class VirtualChannel {
  private curr: Channel | null = null
  private prev: Channel | null = null
  private cross = 0
  private stage: any
  constructor(stage: any) { this.stage = stage }

  play(sound: CustomSound, loops: number, cross_fade = 0, _offset = 0) {
    if (cross_fade <= 0) {
      if (this.cross !== 0) {
        if (this.prev) { this.prev.stop(); this.prev = null }
        this.stage.stop_timer(this)
        this.cross = 0
      }
      if (this.curr) this.curr.stop()
      this.curr = sound.get_length() === 0 ? null : sound.sound.play(loops)
    } else {
      if (this.prev) this.prev.stop()
      this.prev = this.curr
      this.cross = 50 / cross_fade
      this.curr = sound.get_length() === 0 ? null : sound.sound.play(loops)
      if (this.curr) this.curr.set_volume(0)
      if (!this.stage.is_timer_started(this)) this.stage.start_timer(this, Math.min(cross_fade, 50), (k: unknown) => this.tick(k))
    }
  }

  private tick(key: unknown) {
    let old_volume = 0
    if (this.prev) {
      old_volume = this.prev.get_volume() - this.cross
      if (old_volume <= 0) { old_volume = 0; this.prev.stop(); this.prev = null } else this.prev.set_volume(old_volume)
    }
    let new_volume = 1
    if (this.curr) { new_volume = Math.min(1, this.curr.get_volume() + this.cross); this.curr.set_volume(new_volume) }
    if (old_volume === 0 && new_volume === 1) { this.stage.stop_timer(key); this.cross = 0 }
  }
}
