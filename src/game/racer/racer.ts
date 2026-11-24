import SOUND_FILES from '../../data/sounds.json'
// =====================================================================================================
// PERSECUCIÓN EN AUTO — RECONSTRUCCIÓN
// En el juego original esta parte era un módulo nativo C++ (game.stages.racer.pyd) que no se puede
// decompilar. Este archivo NO es código original: es una reimplementación (pseudo-3D por líneas,
// estilo "OutRun") hecha a partir de los DATOS y el ARTE originales:
//   - data/camera.yaml, car.yaml, gui.yaml, thief.yaml, traffic.yaml, p3_map_field.yaml / p3_map_beach.yaml
//     (src/data/yaml.json): física del auto (cambios, potencia, arrastre, resistencia por terreno,
//     doblado, frenado, choques), sprites según el giro, ruedas, sirena, humo, trompos, maniobra de
//     captura, HUD (combustible = tiempo, distancia al ladrón, cuentakilómetros, carteles), tránsito,
//     tramos de ruta con curvas, objetos fijos y aleatorios, fondos según la hora del día y música.
//   - imágenes p3_* y sonidos p3_* originales.
// Las constantes de escala marcadas con "ajuste" son nuestras (el yaml no las define).
// =====================================================================================================
import pygame from '../../pg/index.ts'
import * as ev from '../../pg/events.ts'
import { mouse } from '../../pg/events.ts'
import { whenIdle, type Surface } from '../../pg/surface.ts'
import * as assets from '../../framework/assets.ts'
import { Layer, ItemImage, type Stage } from '../../framework/stage.ts'
import { useShell } from '../../ui/shell.ts'
import YAML from '../../data/yaml.json'
import { LoopSound, OneShot, strip } from './audio.ts'

type Y = any
const Ydata = YAML as Record<string, Y>

// ---- proyección (ajuste) ----
const SW = 600, SH = 450
const CAM = Ydata['camera.yaml'] ?? { y_translation: 50, z_near: 7 }
const Z_NEAR: number = CAM.z_near // el auto del jugador está a esta distancia de la cámara
const HORIZON = 160 + CAM.y_translation // línea del horizonte en pantalla
const FH = (SH - HORIZON) * Z_NEAR // foco * altura de la cámara: la última línea de pantalla está en z_near
const F = 450 // píxeles por unidad a profundidad 1 (ajuste)
const MAX_D = 1000
const XO_STEP = 5
const CURVE_VIEW = 2.5 // exageración visual de las curvas (ajuste)

// ---- física (ajuste de escalas; los parámetros vienen del yaml) ----
const RPM_K = 0.714 // rpm = velocidad * relación * RPM_K
const POWER_K = 0.65
const DRAG_K = 3.5e-4
const ROLL_K = 0.04
const BRAKE_K = 0.25
const STEER_K = 0.25
const CENTRIFUGAL_K = 0.12
const HARD_CRASH_SPEED = 50
const THIEF_START = 450

const imgCache = new Map<string, assets.Image>()
function img(path: string) {
  const n = strip(path)
  let i = imgCache.get(n)
  if (!i) { i = assets.load_image(n); imgCache.set(n, i) }
  return i
}
const drw = (i: assets.Image | null | undefined) => (i ? i.surface.drawable() : null)

interface Frame { img: assets.Image; dur: number; dy: number; py: number }
class Anim {
  frames: Frame[]
  total: number
  constructor(list: Y[]) {
    this.frames = (list ?? []).map((f: Y) => {
      const t = typeof f.texture === 'string' ? { image: f.texture } : f.texture ?? {}
      return { img: img(t.image), dur: f.duration ?? 50, dy: t.y_translation ?? 0, py: f.pixel_translation?.y ?? 0 }
    })
    this.total = this.frames.reduce((s, f) => s + f.dur, 0) || 1
  }
  at(t: number, loop = true): Frame {
    let m = loop ? ((t % this.total) + this.total) % this.total : Math.min(t, this.total - 1)
    for (const f of this.frames) { if (m < f.dur) return f; m -= f.dur }
    return this.frames[this.frames.length - 1]
  }
}

interface AngleTex { to: number; both?: Tex; left?: Tex; right?: Tex }
interface Tex { img: assets.Image; w: number; h: number }
const angleTextures = (list: Y[]): AngleTex[] =>
  list.map((e: Y) => {
    const t = (o: Y): Tex | undefined => (o ? { img: img(o.texture), w: o.width, h: o.height } : undefined)
    return { to: e.to, both: t(e.both), left: t(e.left), right: t(e.right) }
  })
function pickAngle(list: AngleTex[], relX: number, d: number): Tex {
  const ang = Math.abs(Math.atan2(relX, Math.max(0.1, d)) * 180 / Math.PI)
  const e = list.find((a) => ang <= a.to) ?? list[list.length - 1]
  return e.both ?? (relX < 0 ? e.left! : e.right!)
}

interface Blink { img: assets.Image; x: number; y: number; avail: number; unavail: number; times?: number; wait?: number }
const blinkOf = (o: Y): Blink => ({ img: img(o.texture), x: o.x, y: o.y, avail: o.available, unavail: o.unavailable, times: o.times, wait: o.wait })
function blinkVisible(b: Blink, t: number) {
  if (t < 0) return false
  if (!b.unavail) return true
  const c = b.avail + b.unavail
  if (b.times != null && Math.floor(t / c) >= b.times) return false
  return t % c < b.avail
}

interface ObjSpec { x: number; z0: number; z1: number; dz: number; w: number; h: number; body: { w: number; x: number } | null; img: assets.Image }
interface Seg { z0: number; z1: number; curv: number }
interface Traffic { x: number; z: number; v: number; def: { width: number; tex: AngleTex[]; engine: LoopSound } }

export type RacerResult = boolean

export class RacerLayer extends Layer {
  private stageRef: Stage
  private done: (r: RacerResult) => void
  private ready = false
  private finished = false
  private t = 0 // ms de juego
  // datos
  private car: Y = Ydata['car.yaml']
  private gui: Y = Ydata['gui.yaml']
  private thiefY: Y = Ydata['thief.yaml']
  private trafficY: Y = Ydata['traffic.yaml']
  private map: Y
  // imágenes
  private sprites: { to: number; mat: number; both?: Y; left?: Y; right?: Y }[]
  private spinL: Anim
  private spinR: Anim
  private catchL: Anim
  private catchR: Anim
  private smoke: Anim
  private siren: Anim
  private arrow: Anim
  private thiefTex: AngleTex[]
  private materials: { left: { from: number; to: number; anim: Anim; rr: number; snd: LoopSound }[]; right: { from: number; to: number; anim: Anim; rr: number; snd: LoopSound }[] }
  private floor: assets.Image
  private floorW: number
  private floorH: number
  private leftFill: string
  private rightFill: string
  private skyColor: string
  private skyBack: { img: assets.Image; speed: number } | null
  private skyLayers: { img: assets.Image; speed: number }[]
  private avatarImg: assets.Image
  private thiefAvatarImg: assets.Image
  private statics: { img: assets.Image; z: number; x: number; y: number }[]
  private digits: assets.Image[]
  private fuelEnd: assets.Image
  private distFill: assets.Image
  private distEnd: assets.Image
  private lowFuel: Blink
  private noFuel: Blink
  private winSign: Blink
  private thiefNear: Blink
  private exitBack: assets.Image
  private exitYes: assets.Image
  private exitNo: assets.Image
  // pista
  private pieces: Y[]
  private segs: Seg[] = []
  private objs: ObjSpec[] = []
  private trackEnd = 0
  private randomChoice = new Map<string, number>()
  private xo = new Float64Array(Math.ceil(MAX_D / XO_STEP) + 2)
  // estado del jugador
  private x = 0
  private z = 0
  private v = 0
  private steer = 0
  private gear = 0
  private heading = 0
  private crash: { t: number; dir: number } | null = null
  private shake = 0
  private smokeT = -1
  private onMaterial: { anim: Anim; mat: number } | null = null
  private finishing: { t: number; side: number; fromX: number; fromZ: number } | null = null
  private won = false
  private lostT = -1
  private winT = -1
  private nearT = -1
  private nearArmed = true
  private lowFuelT = -1
  private lowFuelBeeps = 0
  private exitDialog = false
  // ladrón y tránsito
  private thief = { x: 3.5, z: THIEF_START, v: 0, target: 3.5 }
  private traffic: Traffic[] = []
  private trafficDefs: Traffic['def'][]
  // sonido
  private engine: LoopSound
  private sirenSnd: LoopSound
  private music: LoopSound | null = null
  private musicStart: OneShot | null = null
  private sBreak: OneShot
  private sLight: OneShot
  private sHard: OneShot
  private sWarn: OneShot
  private sWin: OneShot | null
  private sLose: OneShot | null
  private braking = false
  private roughPlaying: LoopSound | null = null
  private drawList: { d: number; draw: (ctx: CanvasRenderingContext2D) => void }[] = []

  constructor(stage: Stage, thief_img: string, avatar_img: string, time_of_day: string, map_name: string, color: string, done: (r: RacerResult) => void) {
    super()
    this.stageRef = stage
    this.done = done
    this.map = Ydata[map_name] ?? Ydata['p3_map_field.yaml']
    const car = this.car, gui = this.gui, map = this.map
    this.sprites = car.sprites.map((s: Y) => ({ to: s.to, mat: s.material_translation ?? 0, both: s.both, left: s.left, right: s.right }))
    for (const s of this.sprites) for (const k of ['both', 'left', 'right'] as const) {
      const o = s[k]
      if (o) { o._car = img(o.car.image); o._wheels = new Anim(o.wheels) }
    }
    this.spinL = new Anim(car.hard_crash.left.animation)
    this.spinR = new Anim(car.hard_crash.right.animation)
    this.catchL = new Anim(car.caught_thief.left.animation)
    this.catchR = new Anim(car.caught_thief.right.animation)
    this.smoke = new Anim(car.smoke.animation)
    this.siren = new Anim(car.siren.animation)
    this.arrow = new Anim(this.thiefY.arrow.animation)
    this.thiefTex = angleTextures(this.thiefY.textures[color] ?? this.thiefY.textures.violet)
    const terr = map.terrain[0]
    this.floor = img(terr.texture.image)
    this.floorW = terr.texture.w
    this.floorH = terr.texture.h
    const mats = (l: Y[]) => (l ?? []).map((m: Y) => ({ from: m.from, to: m.to, anim: new Anim(m.animation), rr: m.rolling_resistance ?? car.rolling_resistance, snd: new LoopSound(m.sound_effect, 1) }))
    this.materials = { left: mats(terr.materials?.left), right: mats(terr.materials?.right) }
    this.leftFill = '#' + String(terr.left_fill)
    this.rightFill = '#' + String(terr.right_fill)
    this.skyColor = '#' + String(map.sky.color)
    const bg = map.sky.backgrounds?.[time_of_day] ?? map.sky.backgrounds?.noon
    this.skyBack = bg ? { img: img(bg.texture), speed: bg.speed } : null
    this.skyLayers = (map.sky.layers ?? []).map((l: Y) => ({ img: img(l.texture), speed: l.speed }))
    this.avatarImg = assets.load_image(avatar_img)
    this.thiefAvatarImg = assets.load_image(thief_img)
    this.statics = gui.statics.map((s: Y) => ({ img: img(s.texture), z: s.z, x: s.pos.x, y: s.pos.y }))
    this.digits = gui.mileometer.numbers.map((n: string) => img(n))
    this.fuelEnd = img(gui.fuel_bar.end)
    this.distFill = img(gui.distance_bar.filler)
    this.distEnd = img(gui.distance_bar.end.texture)
    this.lowFuel = blinkOf(gui.low_fuel_warning)
    this.noFuel = blinkOf(gui.no_fuel_sign)
    this.winSign = blinkOf(gui.win_sign)
    this.thiefNear = blinkOf(gui.thief_near_sign)
    this.exitBack = img(gui.exit_dialog.background.src)
    this.exitYes = img(gui.exit_dialog.yes.src)
    this.exitNo = img(gui.exit_dialog.no.src)
    this.pieces = map.pieces
    this.trafficDefs = this.trafficY.cars.map((c: Y) => ({ width: c.width, tex: angleTextures(c.textures), engine: new LoopSound(c.engine.sound, c.engine.volume ?? 1) }))
    // sonidos
    const S = car.sounds
    this.engine = new LoopSound(S.engine.sound, S.engine.volume ?? 1)
    this.sirenSnd = new LoopSound(S.siren.sound, S.siren.volume ?? 1)
    this.sBreak = new OneShot(S.break.sound)
    this.sLight = new OneShot(S.light_crash.sound)
    this.sHard = new OneShot(typeof S.hard_crash === 'string' ? S.hard_crash : S.hard_crash.sound)
    this.sWarn = new OneShot(gui.low_fuel_sound.sound)
    const M = map.music ?? {}
    if (M.loop) this.music = new LoopSound(M.loop.sound, M.loop.volume ?? 1, true, M.loop.loop_start ?? 0)
    // el yaml de la playa nombra p3_music_intro.ogg, que no viene con el juego original: se ignora si falta
    if (M.start && (SOUND_FILES as Record<string, number>)[String(M.start.sound).replace(/^sounds\//, '')] !== undefined) this.musicStart = new OneShot(M.start.sound, M.start.volume ?? 1, true)
    this.sWin = M.win ? new OneShot(M.win.sound, M.win.volume ?? 1, true) : null
    this.sLose = M.lose ? new OneShot(M.lose.sound, M.lose.volume ?? 1, true) : null
    // la pista arranca con una recta
    this.addPiece(this.pieces[0])
    this.extendTrack(2000)
    void Promise.race([whenIdle(), new Promise((r) => setTimeout(r, 15000))]).then(() => this.begin())
  }

  private begin() {
    if (this.finished) return
    this.ready = true
    this.engine.play()
    if (this.musicStart) this.musicStart.play(() => { if (!this.finished) this.music?.play() })
    else this.music?.play()
  }

  // ---------------------------------------------------------------- pista
  private addPiece(p: Y) {
    const start = this.trackEnd
    let z = start
    for (const part of p.road) {
      const s = part.segment ?? part.corner
      const curv = part.corner ? (part.corner.direction === 'right' ? 1 : -1) / part.corner.radius : 0
      this.segs.push({ z0: z, z1: z + s.length, curv })
      z += s.length
    }
    for (const o of p.objects ?? []) this.objs.push(this.objSpec(o, start + o.from, start + o.to))
    this.trackEnd = z
  }
  private objSpec(o: Y, z0: number, z1: number): ObjSpec {
    return { x: o.x, z0, z1, dz: o.dz, w: o.w, h: o.h, body: o.body ? { w: o.body.w, x: o.body.x ?? 0 } : null, img: img(o.texture) }
  }
  private extendTrack(upTo: number) {
    while (this.trackEnd < upTo) this.addPiece(this.pieces[Math.floor(Math.random() * this.pieces.length)])
    // descartar tramos viejos
    while (this.segs.length > 2 && this.segs[1].z1 < this.z - 100) this.segs.shift()
    if (this.objs.length > 60) this.objs = this.objs.filter((o) => o.z1 > this.z - 100)
  }
  private curvAt(z: number) {
    for (const s of this.segs) if (z >= s.z0 && z < s.z1) return s.curv
    return 0
  }
  /** Objetos visibles: tramos + fijos + aleatorios por bloques a cada lado. */
  private forObjects(zFrom: number, zTo: number, fn: (o: ObjSpec, z: number) => void) {
    const each = (o: ObjSpec) => {
      if (o.z1 < zFrom || o.z0 > zTo) return
      const k0 = Math.max(0, Math.ceil((zFrom - o.z0) / o.dz))
      for (let z = o.z0 + k0 * o.dz; z <= Math.min(zTo, o.z1); z += o.dz) fn(o, z)
    }
    for (const o of this.objs) each(o)
    for (const o of this.map.objects ?? []) each(this.cachedSpec(o, 'fixed', o.from, o.to))
    const ro = this.map.random_objects ?? {}
    for (const side of ['left', 'right']) {
      const blocks: Y[] = ro[side] ?? []
      if (!blocks.length) continue
      const len = blocks[0].length ?? 500
      for (let b = Math.floor(zFrom / len); b * len <= zTo; b++) {
        if (b < 1) continue // al arrancar, sin objetos aleatorios
        const key = side + b
        let c = this.randomChoice.get(key)
        if (c === undefined) { c = Math.floor(Math.random() * blocks.length); this.randomChoice.set(key, c) }
        const blk = blocks[c]
        for (const o of blk.objects) each(this.cachedSpec(o, key, b * len, b * len + (blk.length ?? len)))
      }
    }
  }
  private specCache = new Map<Y, Map<string, ObjSpec>>()
  private cachedSpec(o: Y, key: string, z0: number, z1: number) {
    let m = this.specCache.get(o)
    if (!m) { m = new Map(); this.specCache.set(o, m) }
    let s = m.get(key)
    if (!s) { s = this.objSpec(o, z0, z1); m.set(key, s) }
    if (m.size > 40) m.clear()
    return s
  }

  // ---------------------------------------------------------------- entrada
  handle_event = (e: ev.PgEvent) => {
    if (!this.ready || this.finished) return
    if (e.type === ev.KEYDOWN && e.key === ev.K.K_ESCAPE) { this.exitDialog = !this.exitDialog; return }
    if (this.exitDialog && e.type === ev.MOUSEBUTTONDOWN) {
      const [mx, my] = e.pos!
      const Y = this.gui.exit_dialog
      const inside = (p: Y, i: assets.Image) => mx >= p.x && mx < p.x + i.get_width() && my >= p.y && my < p.y + i.get_height()
      if (inside(Y.yes.pos, this.exitYes)) this.end(false)
      else if (inside(Y.no.pos, this.exitNo)) this.exitDialog = false
    }
  }

  private keys() {
    const p = pygame.key.get_pressed()
    const K = ev.K
    return {
      up: p[K.K_UP] || p[K.K_w], down: p[K.K_DOWN] || p[K.K_s],
      left: p[K.K_LEFT] || p[K.K_a], right: p[K.K_RIGHT] || p[K.K_d],
    }
  }

  // ---------------------------------------------------------------- simulación
  update(frame_delay: number) {
    super.update(frame_delay)
    if (!this.ready || this.finished || this.exitDialog) return
    let ms = Math.min(frame_delay, 100)
    while (ms > 0) { const s = Math.min(ms, 25); this.step(s / 1000); ms -= s }
  }

  private step(dt: number) {
    const car = this.car
    this.t += dt * 1000
    const remaining = this.map.time - this.t
    const fuelOut = remaining <= 0
    const k = fuelOut || this.finishing || this.won ? { up: false, down: false, left: false, right: false } : this.keys()
    if (this.crash) { k.up = k.down = k.left = k.right = false }

    // giro
    const target = k.left ? -1 : k.right ? 1 : 0
    const rate = target === 0 ? 6 : 4
    if (this.steer < target) this.steer = Math.min(target, this.steer + rate * dt)
    else if (this.steer > target) this.steer = Math.max(target, this.steer - rate * dt)

    // material bajo cada rueda (tyres.left/right)
    let rr = car.rolling_resistance
    this.onMaterial = null
    const tyres = [this.x - car.tyres.left, this.x + car.tyres.right]
    let rrSum = 0
    let roughSnd: LoopSound | null = null
    for (const tx of tyres) {
      const side = tx < 0 ? this.materials.left : this.materials.right
      const m = side.find((mm) => Math.abs(tx) >= mm.from && Math.abs(tx) < mm.to)
      rrSum += m ? m.rr : car.rolling_resistance
      if (m && this.v > car.min_material_effect_speed) {
        roughSnd = m.snd
        const spr = this.currentSprite()
        this.onMaterial = { anim: m.anim, mat: spr.mat * Math.sign(this.steer || 1) }
      }
    }
    if (this.v > car.min_material_effect_speed) rr = rrSum / 2
    if (roughSnd !== this.roughPlaying) { this.roughPlaying?.stop(); roughSnd?.play(); this.roughPlaying = roughSnd }

    // motor y cambios
    const gears: number[] = car.acceleration.gears
    let rpm = this.v * gears[this.gear] * RPM_K
    if (rpm > car.max_rpm * 0.92 && this.gear < gears.length - 1) { this.gear++; this.smokeT = 0 }
    else if (rpm < car.max_rpm * 0.35 && this.gear > 0) this.gear--
    rpm = this.v * gears[this.gear] * RPM_K
    let a = 0
    if (k.up) {
      if (this.v < 5 && this.smokeT < 0) this.smokeT = 0
      if (rpm < car.max_rpm) a += car.acceleration.power * gears[this.gear] * POWER_K
    }
    if (k.down && this.v > 0) {
      a -= car.break * BRAKE_K
      if (!this.braking && this.v > 30) this.sBreak.play()
      this.braking = true
    } else this.braking = false
    a -= car.drag * this.v * this.v * DRAG_K
    a -= rr * ROLL_K + (car.extra_resistance * ROLL_K * Math.abs(this.steer))
    if (this.finishing) a = 0
    if (this.won && !this.finishing) a = -car.finishing.deacceleration
    if (fuelOut && !this.won) a = Math.min(a, -car.break * BRAKE_K * 0.3)
    if (this.crash) a = -car.break * BRAKE_K * 2
    this.v = Math.max(0, this.v + a * dt)
    if (!k.up && this.v < 0.5 && a <= 0) this.v = 0

    // movimiento lateral: dirección + fuerza centrífuga en curvas
    const curv = this.curvAt(this.z + Z_NEAR)
    if (!this.finishing) {
      const vc = Math.min(this.v, car.max_cornering_speed)
      const corner = this.v < car.cornering.speed * 10 ? car.cornering.slow : car.cornering.fast
      this.x += this.steer * corner * vc * STEER_K * dt
      this.x -= curv * this.v * this.v * CENTRIFUGAL_K * dt
      const lim = this.map.width
      this.x = Math.max(-lim, Math.min(lim, this.x))
    }
    this.z += this.v * dt
    this.heading += curv * this.v * dt
    this.extendTrack(this.z + 1500)

    // humo
    if (this.smokeT >= 0) { this.smokeT += dt * 1000; if (this.smokeT > this.smoke.total) this.smokeT = -1 }
    if (this.crash) { this.crash.t += dt * 1000; if (this.crash.t > car.hard_crash.duration * 1000) this.crash = null }
    if (this.shake > 0) this.shake -= dt * 1000

    this.stepThief(dt)
    this.stepTraffic(dt)
    this.collisions()

    // sonidos continuos
    this.engine.set(undefined, 0.55 + Math.min(1.4, rpm / car.max_rpm * 1.3))
    const dist = this.thief.z - (this.z + Z_NEAR + car.length)
    if (dist < car.siren.start_distance && !fuelOut) { if (!this.sirenSnd.playing) this.sirenSnd.play() }
    else if (this.sirenSnd.playing && !this.won) this.sirenSnd.stop()

    // carteles
    if (dist < this.gui.thief_warning_distance && this.nearArmed && !this.won) { this.nearT = this.t; this.nearArmed = false }
    if (dist > this.gui.thief_warning_distance * 1.5) this.nearArmed = true
    if (remaining <= this.gui.fuel_warning_time * 1000 && this.lowFuelT < 0) this.lowFuelT = this.t
    if (this.lowFuelT >= 0 && !fuelOut) {
      const lf = this.gui.low_fuel_sound, c = lf.available + lf.unavailable
      const n = Math.floor((this.t - this.lowFuelT) / c)
      if (n < lf.times && n >= this.lowFuelBeeps) { this.lowFuelBeeps = n + 1; this.sWarn.play() }
    }

    // captura
    if (!this.finishing && !this.won && !fuelOut && dist <= car.finishing.close_distance && Math.abs(this.thief.x - this.x) < car.width + 1.5) {
      const side = this.x >= this.thief.x ? 1 : -1
      this.finishing = { t: 0, side, fromX: this.x, fromZ: this.z }
      this.v = car.finishing.maneuver_speed + this.thief.v * 0
    }
    if (this.finishing) {
      const f = this.finishing, fin = car.finishing
      f.t += dt * 1000
      const p = Math.min(1, f.t / (fin.maneuver_time * 1000))
      const tx = this.thief.x + f.side * fin.maneuver_side_distance
      const tz = this.thief.z - car.length + fin.maneuver_front_distance - Z_NEAR
      this.x = f.fromX + (tx - f.fromX) * p
      this.z = Math.max(this.z, f.fromZ + (tz - f.fromZ) * p)
      this.v = this.thief.v
      if (p >= 1) { this.won = true; this.winT = this.t; this.finishing = null; this.engine.set(0.25); this.music?.stop(); this.musicStart?.stop(); this.sWin?.play() }
    }
    if (this.won) {
      this.thief.v = Math.max(0, this.thief.v - car.finishing.deacceleration * dt)
      this.v = this.thief.v
      if (this.t - this.winT > (this.winSign.wait ?? 0) + this.map.exit_time) this.end(true)
    }
    if (fuelOut && !this.won && this.lostT < 0) { this.lostT = this.t; this.music?.stop(); this.musicStart?.stop(); this.sirenSnd.stop(); this.sLose?.play() }
    if (this.lostT >= 0 && this.t - this.lostT > this.map.exit_time) this.end(false)
  }

  private stepThief(dt: number) {
    const th = this.thief, T = this.thiefY
    if (this.won) { th.z += th.v * dt; return }
    let speed = T.speed
    // esquiva el tránsito cambiando de carril (sideways_speed)
    const lanes: number[] = this.map.lanes ?? [3.5, -3.5]
    const ahead = this.traffic.find((c) => Math.abs(c.x - th.target) < 3 && c.z - th.z > 0 && c.z - th.z < 60)
    if (ahead) {
      const other = lanes.find((l) => l !== th.target)
      const blocked = other == null || this.traffic.some((c) => Math.abs(c.x - other) < 3 && Math.abs(c.z - th.z) < 30)
      if (!blocked) th.target = other!
      else if (ahead.z - th.z < 25) speed = Math.min(speed, ahead.v)
    }
    th.v += Math.max(-80 * dt, Math.min(40 * dt, speed - th.v))
    const dx = th.target - th.x
    th.x += Math.sign(dx) * Math.min(Math.abs(dx), T.sideways_speed * dt)
    th.z += th.v * dt
    // (ajuste) la barra de distancia del HUD sólo representa hasta max_distance: el ladrón nunca se
    // aleja más que eso, así un choque no deja la persecución perdida de antemano
    const maxGap = this.gui.distance_bar.max_distance
    const gap = th.z - (this.z + Z_NEAR + this.car.length)
    if (gap > maxGap) th.z -= gap - maxGap
  }

  private stepTraffic(dt: number) {
    const T = this.trafficY, lanes: number[] = this.map.lanes ?? [3.5, -3.5]
    for (const c of this.traffic) {
      const front = this.traffic.find((o) => o !== c && Math.abs(o.x - c.x) < 1 && o.z > c.z && o.z - c.z < 20)
      if (front) c.v = Math.min(c.v, front.v)
      c.z += c.v * dt
    }
    this.traffic = this.traffic.filter((c) => { const keep = c.z > this.z - 80 && c.z < this.z + 800; if (!keep) c.def.engine.stop(); return keep })
    if (this.traffic.length < 4 && Math.random() < dt * 0.8 && !this.won) {
      const z = this.z + T.max_distance - Math.random() * (T.max_distance - T.min_distance) * 0.25
      const x = lanes[Math.floor(Math.random() * lanes.length)]
      const clear = this.traffic.every((c) => Math.abs(c.z - z) > T.min_distance || Math.abs(c.x - x) > 1) && (Math.abs(this.thief.z - z) > 40 || Math.abs(this.thief.x - x) > 1)
      if (clear) {
        const def = this.trafficDefs[Math.floor(Math.random() * this.trafficDefs.length)]
        this.traffic.push({ x, z, v: T.min_speed + Math.random() * 25, def })
      }
    }
    // motor del tránsito cercano
    for (const c of this.traffic) {
      const d = Math.abs(c.z - this.z)
      if (d < 60) { c.def.engine.play(); c.def.engine.set(undefined, 1) } else if (!this.traffic.some((o) => o.def === c.def && Math.abs(o.z - this.z) < 60)) c.def.engine.stop()
    }
  }

  private collisions() {
    if (this.finishing || this.won) return
    const car = this.car
    const z0 = this.z + Z_NEAR, z1 = z0 + car.length
    const half = car.width / 2
    // tránsito
    for (const c of this.traffic) {
      if (c.z < z1 && c.z + car.length > z0 && Math.abs(c.x - this.x) < half + c.def.width / 2) {
        const rel = this.v - c.v
        if (rel > HARD_CRASH_SPEED) this.hardCrash(c.x)
        else { this.sLight.play(); this.shake = 200 }
        this.v = Math.max(0, c.v - Math.abs(rel) * car.restitution)
        this.z = c.z - car.length - Z_NEAR - 0.5
        return
      }
    }
    // objetos con cuerpo
    let hit: number | null = null
    let hitZ = 0
    this.forObjects(z0, z1, (o, z) => {
      if (hit != null || !o.body) return
      if (z >= z0 && z <= z1 && Math.abs(o.x + o.body.x - this.x) < half + o.body.w / 2) { hit = o.x; hitZ = z }
    })
    if (hit != null) {
      if (this.v > HARD_CRASH_SPEED) this.hardCrash(hit)
      else if (this.v > 5) { this.sLight.play(); this.shake = 200 }
      this.v = 0
      this.z = hitZ - car.length - Z_NEAR - 0.5
    }
  }

  private hardCrash(objX: number) {
    if (this.crash) return
    this.crash = { t: 0, dir: objX < this.x ? 1 : -1 }
    this.sHard.play()
    this.shake = 300
  }

  private end(result: RacerResult) {
    if (this.finished) return
    this.finished = true
    this.engine.stop(); this.sirenSnd.stop(); this.music?.stop(); this.musicStart?.stop(); this.roughPlaying?.stop()
    for (const d of this.trafficDefs) d.engine.stop()
    for (const s of [...this.materials.left, ...this.materials.right]) s.snd.stop()
    this.done(result)
  }

  stopAll() { this.end(false) }

  private currentSprite() {
    const a = Math.abs(this.steer)
    return this.sprites.find((s) => a <= s.to) ?? this.sprites[this.sprites.length - 1]
  }

  // ---------------------------------------------------------------- dibujo
  draw(surface: Surface) {
    if (!this.ready) return // mientras tanto se ve la pantalla de carga
    const ctx = surface.ctx
    ctx.save()
    ctx.imageSmoothingEnabled = true
    const shx = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 4 : 0
    ctx.translate(shx, shy)
    this.drawSky(ctx)
    this.computeXo()
    this.drawFloor(ctx)
    this.drawSprites(ctx)
    this.drawPlayer(ctx)
    ctx.restore()
    this.drawHud(ctx)
  }

  private computeXo() {
    // desplazamiento lateral del centro de la ruta a cada profundidad (integra la curvatura)
    let x = 0, slope = 0
    const camZ = this.z
    this.xo[0] = 0
    for (let i = 1; i < this.xo.length; i++) {
      const c = this.curvAt(camZ + i * XO_STEP) * CURVE_VIEW
      x += slope * XO_STEP + 0.5 * c * XO_STEP * XO_STEP
      slope += c * XO_STEP
      this.xo[i] = x
    }
  }
  private xoAt(d: number) {
    const f = Math.max(0, Math.min(this.xo.length - 1.001, d / XO_STEP))
    const i = Math.floor(f)
    return this.xo[i] + (this.xo[i + 1] - this.xo[i]) * (f - i)
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.skyColor
    ctx.fillRect(-10, -10, SW + 20, HORIZON + 12)
    const layer = (im: assets.Image, speed: number, bottom: number) => {
      const d = drw(im)
      if (!d) return
      const w = im.get_width(), h = im.get_height()
      let x0 = -((this.heading * speed * 2) % w)
      if (x0 > 0) x0 -= w
      for (let x = x0; x < SW; x += w) ctx.drawImage(d, Math.round(x), bottom - h)
    }
    if (this.skyBack) layer(this.skyBack.img, this.skyBack.speed, HORIZON + 2)
    for (const l of this.skyLayers) layer(l.img, l.speed, HORIZON + 2)
  }

  private drawFloor(ctx: CanvasRenderingContext2D) {
    const tex = drw(this.floor)
    const TW = this.floor.get_width(), TH = this.floor.get_height()
    const half = this.floorW / 2
    for (let y = SH + 8; y > HORIZON + 1; y--) {
      const d = FH / (y - HORIZON)
      if (d > MAX_D) break
      const ppu = F / d
      const cx = SW / 2 + (this.xoAt(d) - this.x) * ppu
      const L = cx - half * ppu, R = cx + half * ppu
      if (L > 0) { ctx.fillStyle = this.leftFill; ctx.fillRect(0, y, Math.ceil(L) + 1, 1) }
      if (R < SW) { ctx.fillStyle = this.rightFill; ctx.fillRect(Math.floor(R) - 1, y, SW - R + 2, 1) }
      if (!tex) continue
      const dx0 = Math.max(0, L), dx1 = Math.min(SW, R)
      if (dx1 <= dx0) continue
      const sx0 = ((dx0 - L) / (R - L)) * TW, sx1 = ((dx1 - L) / (R - L)) * TW
      const zz = this.z + d
      let ty = Math.floor((1 - (((zz % this.floorH) + this.floorH) % this.floorH) / this.floorH) * TH)
      if (ty >= TH) ty = TH - 1
      ctx.drawImage(tex, sx0, ty, Math.max(1, sx1 - sx0), 1, dx0, y, dx1 - dx0, 1.5)
    }
  }

  private project(x: number, d: number) {
    const ppu = F / d
    return { sx: SW / 2 + (x + this.xoAt(d) - this.x) * ppu, sy: HORIZON + FH / d, ppu }
  }

  private billboard(ctx: CanvasRenderingContext2D, im: assets.Image, x: number, d: number, w: number, h: number, py = 0, yUnits = 0) {
    const di = drw(im)
    if (!di || d < 2 || d > MAX_D) return
    const { sx, sy, ppu } = this.project(x, d)
    const pw = w * ppu, ph = h * ppu
    if (sx + pw / 2 < 0 || sx - pw / 2 > SW) return
    ctx.drawImage(di, sx - pw / 2, sy - ph - yUnits * ppu + py, pw, ph)
  }

  private drawSprites(ctx: CanvasRenderingContext2D) {
    const items = this.drawList
    items.length = 0
    const camZ = this.z
    this.forObjects(camZ + 2, camZ + MAX_D, (o, z) => {
      const d = z - camZ
      items.push({ d, draw: (c) => this.billboard(c, o.img, o.x, d, o.w, o.h) })
    })
    for (const t of this.traffic) {
      const d = t.z - camZ
      if (d < 2 || d > MAX_D) continue
      items.push({ d, draw: (c) => { const tx = pickAngle(t.def.tex, t.x + this.xoAt(d) - this.x, d); this.billboard(c, tx.img, t.x, d, tx.w, tx.h) } })
    }
    const th = this.thief
    const td = th.z - camZ
    if (td >= 2 && td <= MAX_D) {
      items.push({ d: td, draw: (c) => {
        const tx = pickAngle(this.thiefTex, th.x + this.xoAt(td) - this.x, td)
        this.billboard(c, tx.img, th.x, td, tx.w, tx.h)
        const dist = th.z - (this.z + Z_NEAR + this.car.length)
        if (dist < this.gui.thief_warning_distance && !this.won) {
          const f = this.arrow.at(this.t)
          const di = drw(f.img)
          if (di) {
            const { sx, sy, ppu } = this.project(th.x, td)
            const s = Math.min(1, ppu / 25)
            const w = f.img.get_width() * s, h = f.img.get_height() * s
            c.drawImage(di, sx - w / 2, sy - (tx.h + this.thiefY.arrow.y) * ppu - h + f.py * s, w, h)
          }
        }
      } })
    }
    items.sort((a, b) => b.d - a.d)
    for (const it of items) it.draw(ctx)
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const bx = SW / 2, by = SH
    const put = (im: assets.Image, x: number, y: number) => { const d = drw(im); if (d) ctx.drawImage(d, Math.round(x), Math.round(y)) }
    if (this.crash) {
      const f = (this.crash.dir < 0 ? this.spinL : this.spinR).at(this.crash.t)
      put(f.img, bx - f.img.get_width() / 2, by + f.dy - f.img.get_height())
      return
    }
    if (this.finishing || this.won) {
      const side = this.finishing ? this.finishing.side : this.x >= this.thief.x ? 1 : -1
      const an = side > 0 ? this.catchR : this.catchL
      const f = an.at(this.won ? 99999 : this.finishing!.t, false)
      put(f.img, bx - f.img.get_width() / 2 + side * 40, by - f.img.get_height())
      return
    }
    const spr = this.currentSprite()
    const o = spr.both ?? (this.steer < 0 ? spr.left : spr.right)
    const carImg: assets.Image = o._car
    const ty = o.car.y_translation ?? 0
    put(carImg, bx - carImg.get_width() / 2, by + ty - carImg.get_height())
    const wf: Frame = o._wheels.at(this.v > 0.5 ? this.t * Math.min(1, this.v / this.car.max_wheels_speed) * 2 : 0)
    put(wf.img, bx - wf.img.get_width() / 2, by + wf.dy - wf.img.get_height())
    // sirena: posición relativa al centro inferior de la pantalla
    const dist = this.thief.z - (this.z + Z_NEAR + this.car.length)
    if (dist < this.car.siren.start_distance) {
      const sf = this.siren.at(this.t)
      put(sf.img, bx + o.siren.x, by + o.siren.y - sf.img.get_height())
    }
    if (this.onMaterial) {
      const mf = this.onMaterial.anim.at(this.t)
      put(mf.img, bx - mf.img.get_width() / 2 + this.onMaterial.mat, by - mf.img.get_height())
    }
    if (this.smokeT >= 0) {
      const f = this.smoke.at(this.smokeT, false)
      put(f.img, bx - f.img.get_width() / 2, by - f.img.get_height())
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    const gui = this.gui
    const put = (im: assets.Image, x: number, y: number) => { const d = drw(im); if (d) ctx.drawImage(d, Math.round(x), Math.round(y)) }
    type L = { z: number; draw: () => void }
    const layers: L[] = []
    layers.push({ z: gui.player_avatar.z, draw: () => put(this.avatarImg, gui.player_avatar.pos.x, gui.player_avatar.pos.y) })
    layers.push({ z: gui.thief_avatar.z, draw: () => put(this.thiefAvatarImg, gui.thief_avatar.pos.x, gui.thief_avatar.pos.y) })
    for (const s of this.statics) layers.push({ z: s.z, draw: () => put(s.img, s.x, s.y) })
    const fb = gui.fuel_bar
    layers.push({ z: fb.z, draw: () => {
      const frac = Math.max(0, Math.min(1, (this.map.time - this.t) / this.map.time))
      const w = Math.round(fb.w * frac)
      ctx.fillStyle = '#' + String(fb.color)
      ctx.fillRect(fb.pos.x, fb.pos.y, w, fb.h)
      if (w > 0) put(this.fuelEnd, fb.pos.x + w, fb.pos.y)
    } })
    const db = gui.distance_bar
    const dist = Math.max(0, this.thief.z - (this.z + Z_NEAR + this.car.length))
    const fillW = Math.round(this.distFill.get_width() * Math.min(dist, db.max_distance) / db.max_distance)
    layers.push({ z: db.z, draw: () => {
      const d = drw(this.distFill)
      if (d && fillW > 0) ctx.drawImage(d, 0, 0, fillW, this.distFill.get_height(), db.pos.x, db.pos.y, fillW, this.distFill.get_height())
    } })
    layers.push({ z: db.end.z, draw: () => put(this.distEnd, db.pos.x + fillW + db.end.diff_x, db.end.pos.y) })
    layers.push({ z: 1, draw: () => {
      let n = Math.floor(this.v * gui.mileometer.speed_ratio)
      gui.mileometer.pos.forEach((p: Y) => { put(this.digits[n % 10], p.x, p.y); n = Math.floor(n / 10) })
    } })
    layers.sort((a, b) => b.z - a.z)
    for (const l of layers) l.draw()

    // carteles
    const remaining = this.map.time - this.t
    const sign = (b: Blink, t: number) => { if (blinkVisible(b, t)) put(b.img, b.x, b.y) }
    if (this.won) sign(this.winSign, this.t - this.winT - (this.winSign.wait ?? 0))
    else if (remaining <= 0) sign(this.noFuel, this.t - this.lostT)
    else if (this.nearT >= 0 && blinkVisible(this.thiefNear, this.t - this.nearT)) sign(this.thiefNear, this.t - this.nearT)
    else if (this.lowFuelT >= 0) sign(this.lowFuel, this.t - this.lowFuelT)

    if (this.exitDialog) {
      const E = gui.exit_dialog
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, 0, SW, SH)
      put(this.exitBack, E.background.pos.x, E.background.pos.y)
      const over = (p: Y, i: assets.Image) => mouse.x >= p.x && mouse.x < p.x + i.get_width() && mouse.y >= p.y && mouse.y < p.y + i.get_height()
      if (over(E.yes.pos, this.exitYes)) put(this.exitYes, E.yes.pos.x, E.yes.pos.y)
      if (over(E.no.pos, this.exitNo)) put(this.exitNo, E.no.pos.x, E.no.pos.y)
    }
  }
}

/**
 * Equivalente de racer.start(screen, overlay, thief_img, avatar_img, time_of_day, map, color, ...)
 * del módulo nativo original. Muestra la persecución como diálogo sobre la escena actual y llama a
 * `done(caught)` al terminar (true = ladrón atrapado, false = sin combustible o abandono).
 */
export function start(stage: Stage, thief_img: string, avatar_img: string, time_of_day: string, map_yaml: string, color: string, done: (r: RacerResult) => void) {
  const map_name = map_yaml.replace(/^data\//, '')
  useShell.getState().setTouchControls(true)
  stage.stop_music()
  ev.releaseAllKeys()
  let layer: RacerLayer
  layer = new RacerLayer(stage, thief_img, avatar_img, time_of_day, map_name, color, (r) => {
    useShell.getState().setTouchControls(false)
    ev.releaseAllKeys()
    stage.close_dialog(layer)
    stage.set_mouse_cursor(null)
    done(r)
  })
  stage.show_dialog(layer, layer.handle_event, null, false)
  // durante la persecución no se dibuja el cursor del juego (se maneja con el teclado o los botones)
  stage.set_mouse_cursor(new ItemImage(0, 0, null))
  return layer
}

// Sólo en desarrollo: window.__startRacer({map:'beach', color:'green', tod:'night'}) arranca la
// persecución sobre una escena vacía (útil para probarla sin jugar un caso entero).
if (import.meta.env.DEV) {
  ;(window as any).__startRacer = async (o: { map?: string; color?: string; tod?: string } = {}) => {
    const { Stage } = await import('../../framework/stage.ts')
    const game = (window as any).__ded?.game
    if (!game) throw new Error('El juego no arrancó')
    const s = new Stage(game)
    game.set_stage(s)
    setTimeout(() => start(s, 'p0_thief_big_tomas_3.jpg', 'p0_detective_male_001_carchase.jpg', o.tod ?? 'noon', `p3_map_${o.map ?? 'field'}.yaml`, o.color ?? 'violet', (r) => console.log('persecución terminada, atrapado =', r)), 100)
  }
}
