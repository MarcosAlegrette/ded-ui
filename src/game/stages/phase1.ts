// Port de game/stages/phase1.py: la ciudad (mapa del departamento con los testigos, minijuegos,
// guarida del ladrón con el mapache y conserje).
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import * as text from '../../framework/text.ts'
import * as web from '../../framework/web.ts'
import pygame from '../../pg/index.ts'
import { Layer, ItemImage, ItemText, ItemMask, ItemCell, ItemEvent, IsoState } from '../../framework/stage.ts'
import type { Image, CustomSound } from '../../framework/assets.ts'
import { choice, randint } from '../../pg/py.ts'
import * as datastore from '../data/datastore.ts'
import { Statement } from '../data/datamodel.ts'
import * as phase0 from './phase0.ts'
import * as witness from './witness.ts'
import * as janitor from './janitor.ts'
import * as endgame from './endgame.ts'
import * as minigameshoptender from './minigameshoptender.ts'
import * as minigamegardener from './minigamegardener.ts'
import * as minigamelibrarian from './minigamelibrarian.ts'
import * as minigamebricklayer from './minigamebricklayer.ts'
import * as lazy from '../lazy.ts'

/** phase2.ItemState.NORMAL (phase2 se carga aparte; si todavía no llegó se usa un estado equivalente) */
let normalStateFallback: IsoState | null = null
function phase2NormalState(): IsoState {
  if (lazy.isLoaded('phase2')) return (lazy.need('phase2') as any).ItemState.NORMAL
  return (normalStateFallback ??= new IsoState('Normal', ''))
}

export class Phase1Content extends phase0.PhaseContent {
  [k: string]: any
  game: any
  stage: any

  constructor() {
    super()
  }

  initialize(game: any, stage: any) {
    this.game = game
    this.stage = stage
    this.witness_dialog = new witness.Witness(this.stage)
    this.janitor_dialog = new janitor.Janitor(this.stage)
    this.minigames_resolved = 0
    this.load_hideout_raccoon_images()
    this.witness_popup_sound = assets.load_sound('p1_witness_pop_up.ogg')
    this.raccoon_fade_sound = assets.load_sound('p1_racoon_fade.ogg')
    this.music_intro = assets.load_music('p1_music_intro.ogg')
    this.music_loop = assets.load_music('p1_music_loop.ogg')
    this.music_minigame_1 = assets.load_music('p1_bricklayer_gardener_music_loop.ogg')
    this.music_minigame_2 = assets.load_music('p1_shoptender_librarian_music_loop.ogg')
  }

  get_music(): [CustomSound, CustomSound] { return [this.music_intro, this.music_loop] }

  final_stage_check() {
    const c = this.game.datastore.user_character_progress.case
    const last_dep = c.list_departments[c.list_departments.length - 1]
    if (c.last_department_lair === last_dep && c.last_department_visited === last_dep) {
      if (c.clues_identified) this.show_arrived_location_end_game()
      else this.stage.hide_clues(true, this.show_clues_found)
      return true
    }
    return false
  }

  show_clues_found = () => {
    if (this.stage.during_night) animations.wait(this.stage, 50, this.show_clues_found)
    else {
      this.clues_right_sound = assets.load_sound('p1_minigame_right.ogg')
      this.game.datastore.user_character_progress.case.clues_identified = true
      this.set_up_clues_found()
      this.stage.show_dialog(this.clues_found_layer, null)
      this.stage.blind_dialog(this.clues_found_layer, animations.BlindDirection.SHOW_DOWN)
      this.stage.render()
      animations.wait(this.stage, 50, () => this.play_show_clues_sound())
    }
  }

  play_show_clues_sound() {
    this.stage.render()
    this.clues_right_sound.play()
  }

  set_up_clues_found() {
    this.clues_found_layer = new Layer()
    this.clues_found_layer.add(new ItemImage(76, 29, assets.load_image('p0_cluesfound_backdrop_2.png')))
    const font = assets.load_font('evilgeniusbb_reg.ttf', 14)
    const font_bold = assets.load_font('evilgeniusbb_bld.ttf', 14)
    const x = 158
    let k = 1
    const c = this.game.datastore.user_character_progress.case
    for (const [, item_found] of this.stage.clue_items) {
      let y: number
      if (k === 1) y = 138
      else if (k === 2) y = 222
      else if (k === 3) y = 311
      else break
      const clue_image = item_found.get_image()
      const icon_item = new ItemImage(x - Math.floor(clue_image.get_width() / 2), y - Math.floor(clue_image.get_height() / 2), clue_image)
      this.clues_found_layer.add(icon_item)
      const message = item_found.stage_clue.build_right_department_message(c.last_department_visited)
      this.clues_found_layer.add(new ItemText(204, y - 30, font, 14, message, [0, 0, 0], null, 241, 60, 1, 2))
      k += 1
    }
    this.clues_found_layer.add(new ItemText(221, 365, font_bold, 13, '¡BUEN TRABAJO!', [153, 0, 0], null, 160, 22, 2, 1))
    const close_item = new ItemImage(281, 384, assets.load_image('p0_button_close.png'))
    close_item.set_rollover_image(assets.load_image('p0_button_close_rollover.png'), this.stage.rollover_sound)
    close_item.add_event_handler(ItemEvent.CLICK, this.close_cluesfound_click)
    this.clues_found_layer.add(close_item)
  }

  close_cluesfound_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.stage.click_sound.play()
    this.stage.blind_dialog(this.clues_found_layer, animations.BlindDirection.HIDE_DOWN, false, [], (l: Layer) => this.close_cluesfound_callback(l))
  }

  close_cluesfound_callback(_layer: Layer) {
    this.stage.close_dialog(this.clues_found_layer)
    this.show_arrived_location_end_game(false)
  }

  show_arrived_location_end_game = (blind_background = true) => {
    if (this.stage.during_night) animations.wait(this.stage, 50, () => this.show_arrived_location_end_game())
    else {
      const ending = new endgame.EndGame(this.stage, endgame.EndReason.ARRIVED_LOCATION)
      ending.show_opening_dialog(blind_background)
      this.stage.save_progress(false)
    }
  }

  add_content_layers() {
    this.map_layer = new Layer()
    const dep = this.game.datastore.user_character_progress.case.last_department_visited
    const dep_image = assets.load_image('p1_map_' + dep.image + '.jpg')
    this.dep_item = new ItemImage(dep.image_pos[0], dep.image_pos[1], dep_image)
    this.map_layer.add(this.dep_item)
    this.stage.add_layer(this.map_layer)
  }

  add_above_options_layers() {
    this.create_tags_layer()
    this.stage.add_layer(this.tags_layer)
    this.create_pins_layer()
    this.stage.add_layer(this.pins_layer)
    this.create_witness_layer()
  }

  add_above_info_layers() {
    this.stage.add_layer(this.witness_layer)
    this.raccoon_layer = new Layer()
    this.stage.add_layer(this.raccoon_layer)
    this.update_notes()
    this.load_progress()
  }

  load_progress() {
    const c = this.stage.game.datastore.user_character_progress.case
    if (c.last_department_lair === c.list_departments[0]) {
      for (const p of this.active_pins.slice()) {
        if (c.list_visited_witnesses.includes(p.witness)) {
          this.witness_pin = p
          this.minigame_solved(true, true)
        }
      }
    }
    const clues_found = c.clues_found.slice()
    if (clues_found.length > 0) {
      this.stage.prepare_items_set(this.stage, true)
      const clues = c.list_stage_clues.slice(0, 3)
      for (const clue_found of clues_found) {
        const stage_clue = this.stage.find_clue(clues, clue_found)
        if (!this.stage.has_item_found(stage_clue)) {
          const item: any = new ItemCell(this.stage, clue_found, phase2NormalState())
          item.is_clue = true
          item.stage_clue = stage_clue
          this.stage.add_item_found(item, false)
        }
      }
      if (c.clues_identified) this.stage.hide_clues(false, null)
    }
  }

  check_show_arrived_wrong_location() {
    const c = this.game.datastore.user_character_progress.case
    if (!c.list_departments.includes(c.last_department_visited)) this.stage.set_time_left(0, this.show_arrived_wrong_location)
  }

  show_arrived_wrong_location = () => {
    let wait = false
    for (const layer of this.stage.layers) {
      if (animations.is_applying_blind(this.stage, layer)) { wait = true; break }
    }
    if (wait && this.stage.during_night) animations.wait(this.stage, 50, this.show_arrived_wrong_location)
    else {
      const ending = new endgame.EndGame(this.stage, endgame.EndReason.ARRIVED_WRONG_LOCATION)
      ending.wrong_location_callback = this.wrong_location_callback
      ending.show_opening_dialog()
    }
  }

  wrong_location_callback = () => { this.stage.show_clues_with_fade(this.wrong_location_clues_callback) }
  wrong_location_clues_callback = (_item: unknown = null) => { this.stage.start_map_help_animation() }

  create_tags_layer() {
    this.tags_layer = new Layer()
    this.city_tag_images = [
      assets.load_image('p1_state_tag_size_1.png'),
      assets.load_image('p1_state_tag_size_2.png'),
      assets.load_image('p1_state_tag_size_3.png'),
    ]
    this.tag_font = assets.load_font('evilgeniusbb_reg.ttf', 12)
  }

  create_pins_layer() {
    const c = this.game.datastore.user_character_progress.case
    const dep = c.last_department_visited
    this.pins_layer = new Layer()
    this.pin_glow = new ItemImage(0, 0, assets.load_image('p1_map_pin_glow.png'))
    this.pin_glow.set_visible(false)
    this.pins_layer.add(this.pin_glow)
    this.pin_witnesses = []
    for (let i = 0; i < dep.city_pins.length; i++) this.pin_witnesses.push(c.list_witnesses[i])
    let index = 0
    this.active_pins = []
    if (dep === c.list_departments[0]) {
      for (const city of dep.city_pins) {
        const pin_image = this.load_pin_image(index)
        if (city.flipped) pin_image.flip_h()
        const pin: any = new ItemImage(city.x, city.y, pin_image)
        pin.city = city
        pin.department = dep
        let w: any = null
        for (const pw of this.pin_witnesses) {
          if (pw.city === city) { w = pw; break }
        }
        if (w == null) w = this.pin_witnesses[index]
        pin.witness = w
        this._pin_set_events(pin)
        pin.witness_image = assets.load_image(pin.witness.image)
        this.pins_layer.add(pin)
        this.active_pins.push(pin)
        index += 1
      }
      for (let k = 0; k < c.list_departments.length; k++) {
        if (c.list_departments[k] === dep) {
          this.target_pin = this.active_pins[c.list_target_cities[k]]
          break
        }
      }
    }
  }

  _pin_set_events(pin: any) {
    if (pin._has_events !== undefined) pin._has_events += 1
    else pin._has_events = 1
    if (pin._has_events > 1) return
    pin.add_event_handler(ItemEvent.MOUSE_ENTER, this.pin_enter)
    pin.add_event_handler(ItemEvent.MOUSE_LEAVE, this.pin_leave)
    pin.add_event_handler(ItemEvent.CLICK, this.pin_click)
  }

  _pin_clear_events(pin: any) {
    if (!pin._has_events) return
    pin._has_events -= 1
    if (pin._has_events) return
    pin.remove_event_handler(ItemEvent.MOUSE_ENTER, this.pin_enter)
    pin.remove_event_handler(ItemEvent.MOUSE_LEAVE, this.pin_leave)
    pin.remove_event_handler(ItemEvent.CLICK, this.pin_click)
  }

  create_witness_layer() {
    this.witness_layer = new Layer()
    this.witness_layer.set_visible(false)
    this.witness_box = new ItemImage(0, 0, assets.load_image('p1_map_rollover_base.png'))
    this.witness_layer.add(this.witness_box)
    this.witness_arrow_image = assets.load_image('p1_map_rollover_arrow.png')
    this.witness_arrow_image_flipped = this.witness_arrow_image.flip_v_copy()
    this.witness_arrow = new ItemImage(0, 0, this.witness_arrow_image)
    this.witness_layer.add(this.witness_arrow)
    this.witness_picholder = new ItemImage(0, 0, assets.load_image('pic_holder_testigo.png'))
    this.witness_layer.add(this.witness_picholder)
    let font = assets.load_font('powdrft_.ttf', 24)
    this.witness_name = new ItemText(0, 0, font, 0, '', [157, 21, 21])
    this.witness_layer.add(this.witness_name)
    font = assets.load_font('powdrft_.ttf', 20)
    this.witness_city = new ItemText(0, 0, font, 13, '', [102, 102, 102], null, 169, 30, 1, 3)
    this.witness_layer.add(this.witness_city)
  }

  load_pin_image(index: number): Image {
    const names = ['blue', 'green', 'lightblue', 'red', 'violet']
    if (index >= names.length) throw new Error('There is no image for pin index ' + index)
    return assets.load_image('p1_map_pin_' + names[index] + '.png')
  }

  load_hideout_raccoon_images() {
    this.raccoon_images = [
      assets.load_image('p1_thief_hideout_raccoon_tail.png'),
      assets.load_image('p1_thief_hideout_raccoon_body.png'),
      assets.load_image('p1_thief_hideout_raccoon_lids_001.png'),
      assets.load_image('p1_thief_hideout_raccoon_lids_002.png'),
      assets.load_image('p1_thief_hideout_raccoon_hands.png'),
    ]
    const r = this.raccoon_images
    this.raccoon_animation = [r[2], r[3], r[3], null, null, null, null, null, r[2], r[3], r[3], null]
  }

  pin_enter = (item: any, _args: unknown) => {
    this.stage.render()
    this.witness_popup_sound.play()
    this.show_pin_glow(item)
    this.show_witness(item)
  }

  pin_leave = (_item: unknown, _args: unknown) => {
    this.pin_glow.set_visible(false)
    this.witness_layer.set_visible(false)
  }

  check_thief_location_assignement() {
    if (this.minigames_resolved === 2 && !this.witness_pin.witness.witness_statement.location_statement) {
      this.witness_pin.witness.witness_statement.location_statement = new Statement(generate_thief_location_statement(this.target_pin.city))
    }
  }

  pin_click = (item: any, _args: unknown) => {
    this.stage.render()
    this.stage.click_sound.play()
    this.witness_pin = item
    this.set_witness_statement()
    if (this.minigames_resolved < 3) {
      this.check_thief_location_assignement()
      if (item.department === this.game.datastore.user_character_progress.case.last_department_lair) {
        this.start_minigame(item.witness.name, this.witness_pin)
      } else {
        const c = this.game.datastore.user_character_progress.case
        const w = this.witness_pin.witness
        let dialog: any = null
        if (item.witness.name === 'Almacenera') dialog = new minigameshoptender.MinigameShoptender(this.stage, this, w)
        else if (item.witness.name === 'Jardinero') dialog = new minigamegardener.MinigameGardener(this.stage, this, w)
        else if (item.witness.name === 'Bibliotecario') dialog = new minigamelibrarian.MinigameLibrarian(this.stage, this, w)
        else if (item.witness.name === 'Albañil') dialog = new minigamebricklayer.MinigameBricklayer(this.stage, this, w)
        if (dialog != null) {
          dialog.show_wrong_place_dialog()
          c.wrong_witness_visited = true
        }
      }
    } else this.target_tag_click('', '')
  }

  start_minigame(name: string, witness_pin: any = null) {
    if (witness_pin == null) {
      witness_pin = this.active_pins[0]
      const c = this.game.datastore.user_character_progress.case
      witness_pin.witness.witness_statement = c.list_witness_statements[this.minigames_resolved]
      this.witness_pin = null
    }
    if (name === 'Almacenera') new minigameshoptender.MinigameShoptender(this.stage, this, witness_pin.witness).show_opening_dialog()
    else if (name === 'Jardinero') new minigamegardener.MinigameGardener(this.stage, this, witness_pin.witness).show_opening_dialog()
    else if (name === 'Bibliotecario') new minigamelibrarian.MinigameLibrarian(this.stage, this, witness_pin.witness).show_opening_dialog()
    else if (name === 'Albañil') new minigamebricklayer.MinigameBricklayer(this.stage, this, witness_pin.witness).show_opening_dialog()
    else if (name === 'Vendedor') this.minigame_solved(true)
    else if (name === 'Verdulera') this.minigame_solved(true)
  }

  set_witness_statement() {
    const c = this.game.datastore.user_character_progress.case
    if (c.list_departments[0] === c.last_department_lair && c.list_departments[0] === c.last_department_visited) {
      this.witness_pin.witness.witness_statement = c.list_witness_statements[this.minigames_resolved]
    }
  }

  minigame_solved(solved: boolean, batch = false) {
    this.minigame_solved_data = [solved, batch]
    if (!batch) {
      // el original enviaba estadísticas a su servidor: en la web es un no-op
      web.send_data((datastore as any).STATS_URL, { current: (datastore as any).VERSION, stats: this.stage.game.stats.get_data() })
      animations.wait_locked(this.stage, 80, () => this.minigame_update_time())
    } else this.minigame_update_time()
  }

  minigame_update_time() {
    const batch = this.minigame_solved_data[1]
    if (batch) this.minigame_set_time_callback()
    else this.stage.set_time_left(1, () => this.minigame_set_time_callback())
  }

  minigame_set_time_callback() {
    const [solved, batch] = this.minigame_solved_data
    if (solved && this.witness_pin != null) {
      this.game.datastore.user_character_progress.case.update_visited_witnesses(this.witness_pin.witness)
      this.game.datastore.user_character_progress.show_folder = true
      this.minigames_resolved += 1
      this.disable_witnesses()
      if (batch) this.mark_city_solved(true)
      else {
        let show_help = false
        const cp = this.game.datastore.user_character_progress
        const c = cp.case
        if (c.time_spend < c.time_limit) {
          if (c.last_department_visited === c.list_departments[0] && cp.last_help_step_seen <= 1) {
            show_help = true
            cp.last_help_step_seen = 2
            animations.wait_locked(this.stage, 1500, () => this.show_help_dialog_after_minigame_solved())
          } else if (cp.last_help_step_seen <= 2) {
            show_help = true
            cp.last_help_step_seen = 3
            animations.wait_locked(this.stage, 1500, () => this.show_help_dialog_after_minigame_solved())
          }
        }
        if (show_help) animations.wait_locked(this.stage, 500, () => this.mark_city_solved_step1())
        else animations.wait_locked(this.stage, 500, () => this.mark_city_solved())
        this.stage.save_progress(false)
      }
    }
  }

  show_help_dialog_after_minigame_solved() {
    const cp = this.game.datastore.user_character_progress
    this.stage.show_help_dialog(cp.last_help_step_seen, 0, null, () => this.after_close_minigame_solved_help())
  }

  after_close_minigame_solved_help() { this.mark_city_solved_step2(false) }

  target_tag_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.stage.click_sound.play()
    const [option_texts, right_option] = this.build_option_texts()
    this.janitor_dialog.show_janitor(this.target_pin.city, option_texts, right_option)
  }

  update_notes() {
    const cp = this.game.datastore.user_character_progress
    const c = cp.case
    const dep = c.last_department_visited
    if (dep === c.last_department_lair && this.stage.items_found.length > 0) {
      for (const item of this.stage.items_found) {
        const note = item.note_item
        if (!cp.notes.includes(note)) {
          cp.notes.push(note)
          cp.new_notes.push(note)
          cp.show_notes_animation = true
        }
      }
      return true
    } else if (dep === c.list_departments[0] && cp.show_notes_animation) {
      this.stage.start_notes_help_animation(300)
      cp.show_notes_animation = false
    } else return false
    return undefined
  }

  build_option_texts(): [string[], string] {
    const c = this.game.datastore.user_character_progress.case
    const ds = this.game.datastore
    const type = c.list_witness_statements[0].janitor_statement.type
    let correct_option: string, incorrect_option_1: string, incorrect_option_2: string
    if (type === 1) {
      const ts = c.thief.sport
      correct_option = ts.name
      const possible: any[] = []
      for (const s of ds.list_sports) {
        if ((s.category === ts.category && s.team === ts.team && s.ball !== ts.ball) || (s.category === ts.category && s.ball === ts.ball && s.team !== ts.team) || (s.team === ts.team && s.ball === ts.ball && s.category !== ts.category)) possible.push(s)
      }
      const selected: any[] = []
      while (selected.length < 2) {
        let s: any
        if (possible.length > 0) s = possible.splice(possible.indexOf(choice(possible)), 1)[0]
        else s = choice(ds.list_sports)
        if (s !== ts) {
          let valid = true
          for (const ss of selected) {
            if (s.category === ss.category && s.ball === ss.ball && s.team === ss.team) { valid = false; break }
          }
          if (valid) selected.push(s)
        }
      }
      incorrect_option_1 = selected[0].name
      incorrect_option_2 = selected[1].name
    } else {
      const pet = c.thief.animal
      correct_option = pet.name
      const possible: any[] = []
      for (const a of ds.list_animals) {
        if ((a.diet === pet.diet && a.classification === pet.classification && a.movement !== pet.movement) || (a.diet === pet.diet && a.movement === pet.movement && a.classification !== pet.classification) || (a.classification === pet.classification && a.movement === pet.movement && a.diet !== pet.diet)) possible.push(a)
      }
      const selected: any[] = []
      while (selected.length < 2) {
        let a: any
        if (possible.length > 0) a = possible.splice(possible.indexOf(choice(possible)), 1)[0]
        else a = choice(ds.list_animals)
        if (a !== pet) {
          let valid = true
          for (const sa of selected) {
            if (a.diet === sa.diet && a.classification === sa.classification && a.movement === sa.movement) { valid = false; break }
          }
          if (valid) selected.push(a)
        }
      }
      incorrect_option_1 = selected[0].name
      incorrect_option_2 = selected[1].name
    }
    const options = [correct_option, incorrect_option_1, incorrect_option_2]
    const pick = () => options.splice(options.indexOf(choice(options)), 1)[0]
    const first_place = pick()
    const second_place = pick()
    const third_place = pick()
    return [[first_place, second_place, third_place], correct_option]
  }

  target_tag_enter = (_item: unknown, _args: unknown) => {
    if (this.raccoon_lids.get_alpha() > 125) {
      if (!this.raccoon_rollover.get_visible()) {
        this.raccoon_rollover.set_visible(true)
        const time_diff = Math.abs(this.raccoon_rollover_hide_timestamp - pygame.time.get_ticks())
        if (Math.abs(time_diff) > 10) {
          this.stage.render()
          this.stage.rollover_sound.stop()
          this.stage.rollover_sound.play()
        }
      }
    }
  }

  target_tag_leave = (_item: unknown, _args: unknown) => {
    this.raccoon_rollover.set_visible(false)
    this.raccoon_rollover_hide_timestamp = pygame.time.get_ticks()
  }

  on_prepare_dialog(animate: boolean) {
    const ls = [this.raccoon_layer, this.map_layer, this.pins_layer, this.tags_layer]
    if (animate) for (const l of ls) animations.blind_layer(l, animations.BlindDirection.HIDE_DOWN, null)
    else for (const l of ls) l.set_visible(false)
  }

  on_reset_dialog(animate: boolean) {
    const ls = [this.raccoon_layer, this.map_layer, this.pins_layer, this.tags_layer]
    for (const l of ls) l.set_visible(true)
    if (animate) for (const l of ls) animations.blind_layer(l, animations.BlindDirection.SHOW_UP, null)
  }

  mark_city_solved(batch = false) {
    this.mark_city_solved_step1(batch)
    this.mark_city_solved_step2(batch)
  }

  mark_city_solved_step1(batch = false) {
    const i = this.active_pins.indexOf(this.witness_pin)
    if (i >= 0) this.active_pins.splice(i, 1)
    if (batch) this.witness_pin.get_layer().remove(this.witness_pin)
    else animations.fade_out_item(this.witness_pin, true)
    if (this.pin_glow.get_visible()) {
      this.pin_glow.set_visible(false)
      this.witness_layer.set_visible(false)
    }
    this.add_city_tag(this.witness_pin, !batch)
    if (this.minigames_resolved < 3) this.enable_witnesses()
    if (!batch) {
      this.stage.render()
      this.stage.fade_sound.play()
    }
  }

  mark_city_solved_step2 = (batch = false) => {
    let wait: boolean
    if (batch) wait = false
    else if (this.stage.during_night) wait = true
    else {
      wait = false
      for (const layer of this.stage.layers) {
        if (animations.is_applying_blind(this.stage, layer)) { wait = true; break }
      }
    }
    if (wait) animations.wait(this.stage, 50, () => this.mark_city_solved_step2())
    else if (this.minigames_resolved < 3) {
      if (!batch) this.stage.start_folder_help_animation(0)
    } else {
      for (const pin of this.active_pins) {
        if (batch) pin.get_layer().remove(pin)
        else animations.fade_out_item(pin, true)
        this.add_city_tag(pin, !batch)
      }
      if (batch) this.show_target_city(batch)
      else animations.wait_locked(this.stage, 1000, () => this.show_target_city())
      if (!batch) {
        if (!this.stage.during_night) this.stage.set_music_volume(0.2, 200)
        this.stage.render()
        this.stage.fade_sound.play()
      }
    }
  }

  show_target_city(batch = false) {
    if (this.target_pin != null) {
      const help_shown = this.add_raccoon(this.target_pin, !batch)
      if (!batch && !help_shown) this.stage.start_folder_help_animation(2000)
    } else this.enable_witnesses()
  }

  add_raccoon(pin: any, fade = true) {
    const [tag_x, tag_y] = pin.city.tag_pos
    const size = pin.city.tag_size
    let x = 0, y = 0
    if (size === 1) { x = tag_x + 14; y = tag_y - 34 }
    else if (size === 2) { x = tag_x + 27; y = tag_y - 34 }
    else if (size === 3) { x = tag_x + 26; y = tag_y - 34 }
    let raccoon_mask: ItemMask
    if (size < 3) {
      const mask_image = assets.load_mask('p1_thief_hideout_raccoon_mask_1.gif')
      raccoon_mask = size === 1 ? new ItemMask(tag_x + 17, tag_y - 34, mask_image) : new ItemMask(tag_x + 30, tag_y - 34, mask_image)
    } else {
      const mask_image = assets.load_mask('p1_thief_hideout_raccoon_mask_2.gif')
      raccoon_mask = new ItemMask(tag_x + 31, tag_y - 34, mask_image)
    }
    // el original le pasa el ítem del brillo como "imagen" (usa su superficie)
    this.raccoon_rollover = new ItemImage(x - 11, y - 10, this.pin_glow.get_image())
    this.raccoon_rollover.set_visible(false)
    this.raccoon_rollover_hide_timestamp = 0
    const raccoon_tail = new ItemImage(x, y, this.raccoon_images[0])
    const raccoon_body = new ItemImage(x, y, this.raccoon_images[1])
    this.raccoon_lids = new ItemImage(x, y, null)
    const raccoon_hands = new ItemImage(x, y, this.raccoon_images[4])
    this.tags_layer.add(this.raccoon_rollover, 0)
    this.tags_layer.add(raccoon_mask, 1)
    this.raccoon_layer.add(raccoon_tail)
    this.raccoon_layer.add(raccoon_body)
    this.raccoon_layer.add(this.raccoon_lids)
    this.raccoon_layer.add(raccoon_hands)
    if (fade) {
      animations.fade_in_item(raccoon_tail, 500)
      animations.fade_in_item(raccoon_body, 500)
      animations.fade_in_item(this.raccoon_lids, 500)
      animations.fade_in_item(raccoon_hands, 500)
      animations.wait_locked(this.stage, 500, () => this.raccon_fade_in_callback())
    }
    const tag_item = pin.tag_items[0]
    tag_item.add_event_handler(ItemEvent.CLICK, this.target_tag_click)
    raccoon_mask.add_event_handler(ItemEvent.CLICK, this.target_tag_click)
    tag_item.add_event_handler(ItemEvent.MOUSE_ENTER, this.target_tag_enter)
    tag_item.add_event_handler(ItemEvent.MOUSE_LEAVE, this.target_tag_leave)
    raccoon_mask.add_event_handler(ItemEvent.MOUSE_ENTER, this.target_tag_enter)
    raccoon_mask.add_event_handler(ItemEvent.MOUSE_LEAVE, this.target_tag_leave)
    this.enable_witnesses()
    if (fade) animations.wait(this.stage, randint(2, 4) * 1000, this.show_raccoon_animation)
    const cp = this.stage.game.datastore.user_character_progress
    const c = cp.case
    let show_help = false
    if (c.time_spend < c.time_limit && cp.last_help_step_seen <= 3) {
      const help_delay = fade ? 2000 : 800
      animations.wait_locked(this.stage, help_delay, () => this.show_help_raccon())
      cp.last_help_step_seen = 4
      show_help = true
    }
    if (!this.stage.during_night && fade) {
      this.stage.render()
      this.raccoon_fade_sound.play()
      animations.wait(this.stage, this.raccoon_fade_sound.get_length() * 1000, () => this.raccoon_fade_sound_callback())
    }
    return show_help
  }

  raccon_fade_in_callback() {}

  raccoon_fade_sound_callback() { animations.wait(this.stage, 300, () => this.restore_music_after_raccoon()) }

  restore_music_after_raccoon() {
    if (!this.stage.during_night) this.stage.set_music_volume(1, 500)
  }

  show_help_raccon() {
    this.stage.show_help_dialog(4, 0, null, (...a: unknown[]) => this.stage.start_folder_help_animation(...a))
  }

  show_raccoon_animation = () => {
    animations.start_image_sequence(this.raccoon_lids, this.raccoon_animation, 25, 0)
    animations.wait(this.stage, randint(3, 7) * 1000, this.show_raccoon_animation)
  }

  add_city_tag(pin: any, fade = true) {
    const size = pin.city.tag_size
    const tag_image = this.city_tag_images[size - 1]
    const [x, y] = pin.city.tag_pos
    const tag = new ItemImage(x, y, tag_image)
    this.tags_layer.add(tag)
    const city_name = text.to_upper(pin.city.name)
    let text1: ItemText | null = null, text2: ItemText | null = null
    if (size === 1) {
      text1 = new ItemText(x + 5, y + 7, this.tag_font, 10, city_name, [0, 0, 0], null, 70, 10, 2, 2)
      this.tags_layer.add(text1)
    } else if (size === 2) {
      text1 = new ItemText(x + 6, y + 7, this.tag_font, 10, city_name, [0, 0, 0], null, 96, 10, 2, 2)
      this.tags_layer.add(text1)
    } else if (size === 3) {
      let break_index = -1
      for (let i = 0; i < pin.city.tag_separation; i++) break_index = city_name.indexOf(' ', break_index + 1)
      let name1: string, name2: string
      if (break_index === -1) { name1 = city_name; name2 = '' }
      else { name1 = city_name.slice(0, break_index); name2 = city_name.slice(break_index + 1) }
      text1 = new ItemText(x + 6, y + 6, this.tag_font, 10, name1, [0, 0, 0], null, 96, 10, 2, 2)
      this.tags_layer.add(text1)
      text2 = new ItemText(x + 6, y + 15, this.tag_font, 10, name2, [0, 0, 0], null, 96, 10, 2, 2)
      this.tags_layer.add(text2)
    }
    pin.tag_items = [tag, text1, text2]
    if (fade) {
      animations.fade_in_item(tag, 1000)
      if (text1) animations.fade_in_item(text1, 1000)
      if (text2 != null) animations.fade_in_item(text2, 1000)
    }
  }

  remove_city_tag(pin: any) {
    for (const tag_item of pin.tag_items) if (tag_item != null) animations.fade_out_item(tag_item, true)
  }

  show_pin_glow(item: any) {
    let left = item.get_left() - Math.floor((this.pin_glow.get_width() - item.get_width()) / 2) + 5
    const top = item.get_top() - Math.floor((this.pin_glow.get_height() - item.get_height()) / 2) + 5
    if (item.city.flipped) left -= 10
    this.pin_glow.set_left(left)
    this.pin_glow.set_top(top)
    this.pin_glow.set_visible(true)
  }

  show_witness(item: any) {
    const box_height = this.witness_box.get_height()
    const box_width = this.witness_box.get_width()
    let box_top = item.get_top() - box_height - 5
    let arrow_left = item.get_left() + 9 - 20
    if (item.city.flipped) arrow_left += 14
    let box_left = arrow_left - 105
    const window_width = this.game.get_window_size()[0]
    if (box_left + box_width + 5 > window_width) box_left -= box_left + box_width + 5 - window_width
    if (box_left < 5) box_left = 5
    let flipv: boolean, arrow_top: number
    if (box_top < 0) {
      flipv = true
      arrow_top = box_top + box_height + 47
      if (item.city.flipped) arrow_left -= 10
      else arrow_left += 5
      box_top = arrow_top + this.witness_arrow_image.get_height() - 9
    } else {
      flipv = false
      arrow_top = box_top + box_height - 10
    }
    this.witness_arrow.set_image(flipv ? this.witness_arrow_image_flipped : this.witness_arrow_image)
    this.witness_box.set_top(box_top)
    this.witness_box.set_left(box_left)
    this.witness_arrow.set_top(arrow_top)
    this.witness_arrow.set_left(arrow_left)
    this.witness_picholder.set_left(box_left + 13)
    this.witness_picholder.set_top(box_top + 13)
    this.witness_name.set_left(box_left + 80)
    this.witness_name.set_top(box_top + 10)
    this.witness_city.set_left(box_left + 80)
    this.witness_city.set_top(box_top + 35)
    this.witness_picholder.set_image(item.witness_image)
    this.witness_name.set_text(item.witness.name)
    this.witness_city.set_text(item.city.name)
    this.witness_layer.set_visible(true)
  }

  disable_witnesses() { for (const pin of this.active_pins) this._pin_clear_events(pin) }
  enable_witnesses() { for (const pin of this.active_pins) this._pin_set_events(pin) }
}

export function generate_thief_location_statement(city: any) {
  const city_name = city.name
  let article = city.article ?? ''
  if (article !== '') article += ' '
  return 'Mencionó que se estaba hospedando en\n' + article + '&#c144,22,22!&#f:bold!' + city_name + '&#f!&#c!.'
}
