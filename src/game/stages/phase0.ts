// Port de game/stages/phase0.py: la "oficina" común a todas las fases (barra inferior con mapa,
// carpeta y notas; localizador; reloj con día/hora; noche; pistas encontradas; ayudas animadas).
// Las fases 1/2/3 se cargan de forma diferida (src/game/lazy.ts).
import * as statcodes from '../data/statcodes.ts'
import * as notes from './notes.ts'
import * as folder from './folder.ts'
import * as map from './map.ts'
import * as merits from './merits.ts'
import * as help from './help.ts'
import * as endgame from './endgame.ts'
import * as mainmenu from './mainmenu.ts'
import * as lazy from '../lazy.ts'
import * as animations from '../../framework/animations.ts'
import * as text from '../../framework/text.ts'
import * as assets from '../../framework/assets.ts'
import { StageIso, Layer, ItemImage, ItemText, ItemMask, ItemEvent, KEYDOWN, K, type Item } from '../../framework/stage.ts'
import type { Image, CustomSound } from '../../framework/assets.ts'
import type { Font } from '../../pg/font.ts'
import type { PgEvent } from '../../pg/events.ts'
import { idiv, str } from '../../pg/py.ts'

export const GRID_ORIGIN = [300, 105]
export const GRID_CELL_WIDTH = 24
export const GRID_CELL_HEIGHT = 12
export const GRID_SIZE = [22, 22]

export class PhaseContent {
  initialize(_game: any, _stage: any) {}
  add_content_layers() {}
  get_music(): [CustomSound | null, CustomSound | null] | null { return null }
  add_above_options_layers() {}
  add_above_info_layers() {}
  on_prepare_dialog(_animate: boolean) {}
  on_reset_dialog(_animate: boolean) {}
  [k: string]: any
}

export class Phase0Stage extends StageIso {
  seting_timer = false
  checking_ending = false
  phase_number: number
  load_phase_number: number
  phase: any = null
  loading_phase = false
  during_night = false
  minigame: string | null = null
  minigame_started = false
  showing_help = false
  showing_mainmenu = false
  update_time_callbacks: (() => void)[] = []
  arrest_order_warning_shown = false
  save_state_on_next_load_phase: boolean
  folder_animation_locks = 0
  pending_folder_animation = false
  private _ending_visible = false
  private _stage_initialized = false
  // creados en initialize_stage
  items_found: any[] = []
  clue_items: [ItemMask, ItemImage][] = []
  bar_7_rounds = 72
  options_layer!: Layer
  info_layer!: Layer
  night_layer!: Layer
  background_layer!: Layer
  click_sound!: CustomSound
  rollover_sound!: CustomSound
  popup_sound!: CustomSound
  witness_popup_sound!: CustomSound
  open_map_sound!: CustomSound
  case_open_sound!: CustomSound
  notes_open_sound!: CustomSound
  bounce_sound!: CustomSound
  night_sound!: CustomSound
  clock_sound!: CustomSound
  fade_sound!: CustomSound
  warning_sound!: CustomSound
  font!: Font
  locator_font!: Font
  info_items: Item[] = []
  map!: map.Map
  folder: any
  folder_default_tab = 1
  notes: any
  locator_bar!: ItemImage
  locator_back!: ItemImage
  locator_sel!: ItemImage
  locator_text!: ItemText
  timer_items: Item[] = []
  timer_backbar!: ItemImage
  timer_big_hands: Image[] = []
  timer_short_hands: Image[] = []
  timer_snoore_animation: Image[] = []
  timer_snore!: ItemImage
  timer_big_hand!: ItemImage
  timer_short_hand!: ItemImage
  timer_text!: ItemText
  timer_days = 99999
  timer_hour = 99999
  timer_minute_pos = 0
  timer_to_days = 0
  timer_to_hour = 0
  time_limit = 0
  night_character_layer: Layer | null = null
  backbar_image!: Image
  backbar_item!: ItemImage
  glow_image!: Image
  map_image!: Image
  map_icon!: ItemImage
  folder_image!: Image
  folder_icon!: ItemImage
  notes_image!: Image
  notes_icon!: ItemImage
  character_icon!: ItemImage
  character_asleep_icon!: ItemImage
  warning_dialog!: Layer
  help_call_after_close: (() => void) | null = null
  clue_dialog: Layer | null = null
  clue_dialog_close_callback: (() => void) | null = null
  map_animation_times = 0
  map_animation_dy = 30
  notes_animation_times = 0
  notes_animation_dy = 30
  folder_animation_times = 0
  folder_animation_dy = 30
  animation_times = 0

  constructor(game: any, initial_phase: number, save_state = true) {
    super(game, null, null, null)
    this.phase_number = initial_phase
    this.load_phase_number = initial_phase
    this.initialized = false
    this.save_state_on_next_load_phase = save_state
  }

  initialize() {
    // descarga en segundo plano las fases (ciudad, casa, persecución)
    void lazy.prefetch()
    this._load_phase(this.load_phase_number)
  }

  close() {
    this.game.stats.end_time_event(statcodes.PHASE_PREFIX + str(this.phase_number))
  }

  initialize_stage() {
    this.items_found = []
    this.clue_items = []
    this.bar_7_rounds = 72
    this.options_layer = new Layer()
    this.info_layer = new Layer()
    this.night_layer = new Layer()
    this.background_layer = new Layer()
    this.background_layer.add(new ItemImage(0, 0, assets.load_image('p0_stage_background.jpg')))
    this.click_sound = assets.load_sound('GUI_Click.ogg')
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.popup_sound = assets.load_sound('GUI_Pop_Up.ogg')
    this.witness_popup_sound = assets.load_sound('GUI_Witness_Popup.ogg')
    this.open_map_sound = assets.load_sound('GUI_Map.ogg')
    this.case_open_sound = assets.load_sound('GUI_Turn_Page.ogg')
    this.notes_open_sound = assets.load_sound('GUI_Notes_Open.ogg')
    this.bounce_sound = assets.load_sound('GUI_bounce.ogg')
    this.night_sound = assets.load_sound('Night.ogg')
    this.clock_sound = assets.load_sound('GUI_Clock.ogg')
    this.fade_sound = assets.load_sound('fade.ogg')
    this.font = assets.load_font('freesansbold.ttf', 13)
    this.set_up_options()
    this.set_up_locator()
    this.set_up_timer()
    this.set_up_character()
    this.info_items = this.info_layer.items.slice()
    this.map = new map.Map(this, true, false)
    this.folder = new folder.Folder(this)
    this.folder_default_tab = folder.CASE
  }

  set_phase(phase: number, force_reload = false) {
    if (this.load_phase_number !== phase || force_reload) {
      this.loading_phase = true
      this.game.stats.end_time_event(statcodes.PHASE_PREFIX + str(this.phase_number))
      this.load_phase_number = phase
      this.save_state_on_next_load_phase = true
      this.stop_music()
      this.set_music(null, null)
      this.stop_timer('load_phase')
      if (this.initialized) {
        const loading_image = 'p0_loading_slides_00' + str(phase) + '.jpg'
        this.game.show_loading(this._show_loading_callback, loading_image)
      }
    }
  }

  prepare_items_set(stage: StageIso, large: boolean, item_definitions: any = null) {
    const set_name = 'p2s01'
    if (large) {
      stage.set_grid_definition(GRID_ORIGIN, GRID_CELL_WIDTH, GRID_CELL_HEIGHT, 2)
      stage.set_items(set_name, 'l', item_definitions)
    } else {
      stage.set_grid_definition(GRID_ORIGIN, GRID_CELL_WIDTH, GRID_CELL_HEIGHT, 1)
      stage.set_items(set_name)
    }
  }

  start_minigame(name: string) { this.minigame = name }

  set_up_locator() {
    const dep = this.game.datastore.user_character_progress.case.last_department_visited
    this.locator_bar = new ItemImage(10, 19, assets.load_image('p0_locator_backbar.png'))
    this.info_layer.add(this.locator_bar)
    this.locator_back = new ItemImage(18, 10, assets.load_image('p0_locator_backmap.png'))
    this.info_layer.add(this.locator_back)
    const image = assets.load_image('p0_locator_dept_' + dep.image + '.png')
    const locator_pos = dep.locator_pos
    this.locator_sel = new ItemImage(locator_pos[0], locator_pos[1], image)
    this.info_layer.add(this.locator_sel)
    this.locator_font = assets.load_font('evilgeniusbb_reg.ttf', 14)
    this.locator_text = new ItemText(75, 22, this.locator_font, 0, text.to_upper(dep.name), [255, 255, 255])
    this.info_layer.add(this.locator_text)
  }

  set_up_timer() {
    this.timer_items = []
    this.timer_backbar = new ItemImage(401, 19, assets.load_image('p0_timer_backbar.png'))
    this.info_layer.add(this.timer_backbar)
    this.timer_items.push(this.timer_backbar)
    const timer_backclock = new ItemImage(531, 5, assets.load_image('p0_timer_backclock.png'))
    this.info_layer.add(timer_backclock)
    this.timer_items.push(timer_backclock)
    this.timer_big_hands = []
    for (let i = 1; i <= 8; i++) this.timer_big_hands.push(assets.load_image('p0_timer_bighand_00' + i + '.png'))
    this.timer_short_hands = []
    for (let i = 1; i <= 12; i++) this.timer_short_hands.push(assets.load_image('p0_timer_shorthand_' + String(i).padStart(3, '0') + '.png'))
    const last_snore = assets.load_image('p0_timer_snore_006.png')
    this.timer_snoore_animation = [
      assets.load_image('p0_timer_snore_001.png'),
      assets.load_image('p0_timer_snore_002.png'),
      assets.load_image('p0_timer_snore_003.png'),
      assets.load_image('p0_timer_snore_004.png'),
      assets.load_image('p0_timer_snore_005.png'),
      last_snore, last_snore, last_snore, last_snore,
    ]
    this.timer_snore = new ItemImage(52, 213, this.timer_snoore_animation[0])
    this.timer_big_hand = new ItemImage(538, 16, this.timer_big_hands[0])
    this.info_layer.add(this.timer_big_hand)
    this.timer_items.push(this.timer_big_hand)
    this.timer_short_hand = new ItemImage(538, 17, this.timer_short_hands[0])
    this.info_layer.add(this.timer_short_hand)
    this.timer_items.push(this.timer_short_hand)
    const timer_handcenter = new ItemImage(550, 29, assets.load_image('p0_timer_handcenter.png'))
    this.info_layer.add(timer_handcenter)
    this.timer_items.push(timer_handcenter)
    this.timer_text = new ItemText(402, 22, this.locator_font, 0, '', [255, 255, 255], null, 128, 18, 3, 1)
    this.info_layer.add(this.timer_text)
    this.timer_items.push(this.timer_text)
    this.timer_days = 99999
    this.timer_hour = 99999
    this.timer_minute_pos = 0
  }

  fade_out_timer(callback: ((i: any) => void) | null = null) {
    for (const item of this.timer_items) {
      animations.fade_out_item(item, false, 450, callback)
      callback = null
    }
  }

  fade_in_timer(callback: ((i: any) => void) | null = null) {
    for (const item of this.timer_items) {
      animations.fade_in_item(item, 450, callback)
      callback = null
    }
  }

  _set_timer_position(pos: number[]) {
    const x_base = this.timer_backbar.get_left(), y_base = this.timer_backbar.get_top()
    for (const item of this.timer_items) {
      const x_rel = item.get_left() - x_base, y_rel = item.get_top() - y_base
      item.set_lefttop(pos[0] + x_rel, pos[1] + y_rel)
    }
  }

  _animate_timer(end: number[], time: number, callback: (() => void) | null) {
    const x_base = this.timer_backbar.get_left(), y_base = this.timer_backbar.get_top()
    let animate_callback: ((i: any) => void) | null = () => { if (callback) callback() }
    for (const item of this.timer_items) {
      const x_rel = item.get_left() - x_base, y_rel = item.get_top() - y_base
      animations.start_move(item, end[0] + x_rel, end[1] + y_rel, time, [0.2, 0.2, 1], null, animate_callback)
      animate_callback = null
    }
  }

  update_timer_clock = (_item: unknown, _data: unknown) => {
    this.stop_timer('timer_clock')
    let update_text: boolean
    if (this.timer_days > this.timer_to_days || (this.timer_days === this.timer_to_days && this.timer_hour > this.timer_to_hour)) {
      this.timer_days = this.timer_to_days
      this.timer_hour = this.timer_to_hour
      this.timer_minute_pos = 0
      update_text = true
    } else {
      this.timer_minute_pos += 1
      if (this.timer_minute_pos < 8) update_text = false
      else {
        update_text = true
        this.timer_minute_pos = 0
        this.timer_hour += 1
        if (this.timer_hour >= 24) {
          this.timer_hour = 0
          this.timer_days += 1
        }
      }
    }
    if (this.timer_hour >= 12 && this.timer_hour < 20) {
      const turns = this.game.datastore.user_character_progress.case.get_turns(this.timer_days, this.timer_hour)
      const turns_left = this.time_limit - turns
      if (turns_left <= 4) this.timer_text.set_color([104, 0, 0])
      else if (turns_left <= 8) this.timer_text.set_color([247, 207, 69])
      else this.timer_text.set_color([255, 255, 255])
    }
    this.timer_big_hand.set_image(this.timer_big_hands[this.timer_minute_pos])
    this.timer_short_hand.set_image(this.get_short_hand_image(this.timer_hour, this.timer_minute_pos, this.timer_short_hands))
    if (update_text) {
      let t = 'DÍA ' + str(this.timer_days) + ' - '
      if (this.timer_hour < 10) t += '0' + str(this.timer_hour)
      else t += str(this.timer_hour)
      t += ':00 HS.'
      this.timer_text.set_text(t)
    }
    if (this.timer_minute_pos === 0) {
      if (this.timer_hour === 20) {
        if (!this.contains_layer(this.night_layer)) {
          this.render()
          this.start_night()
        }
      } else if (this.timer_hour === 8) {
        if (this.contains_layer(this.night_layer)) {
          this.render()
          this.end_night()
        }
      }
    }
    if (this.timer_hour === this.timer_to_hour && this.timer_days === this.timer_to_days) {
      this.release_folder_help()
      this.unlock_ui()
      this.invoke_update_timer_callbacks()
      this.check_ending()
    } else {
      this.start_timer('timer_clock', 32, this.update_timer_clock, null)
      if (this.timer_minute_pos === 0 && this.timer_hour >= 12 && this.timer_hour < 20) this.clock_sound.play()
    }
  }

  get_short_hand_image(day_hour: number, minute_pos: number, timer_short_hands: Image[]): Image {
    if (day_hour >= 12) day_hour -= 12
    const short_pos = day_hour * 4 + idiv(minute_pos, 2)
    if (short_pos < 12) return timer_short_hands[short_pos]
    else if (short_pos < 24) return timer_short_hands[11 - (short_pos - 12)].flip_v_copy()
    else if (short_pos < 36) return timer_short_hands[short_pos - 24].flip_hv_copy()
    return timer_short_hands[11 - (short_pos - 36)].flip_h_copy()
  }

  start_night() {
    if (!this._ending_visible) {
      this.during_night = true
      this.render()
      this.night_sound.play()
      this.set_music_volume(0.2, 500)
      this.night_character_layer = this.character_icon.get_layer()
      if (this.night_character_layer != null) this.night_character_layer.remove(this.character_icon)
      this.update_character_rollover()
      this.night_layer.add(this.character_icon)
      this.night_layer.add(this.character_asleep_icon)
      this.show_dialog(this.night_layer, null, [1, 35, 84, 178])
      this.blind_dialog(this.night_layer, animations.BlindDirection.SHOW_DOWN, true, [this.night_layer], this.start_night_callback)
      animations.fade_in_item(this.character_asleep_icon, 350)
      animations.wait(this, 50, this.night_hide_character)
    }
  }

  night_hide_character = () => {
    // original: fade_out_item(self.character_icon, 130) -> remove=130 (verdadero), duración por defecto
    animations.fade_out_item(this.character_icon, true)
  }

  start_night_callback = (_layer: Layer) => {
    this.timer_snore.set_image(this.timer_snoore_animation[0])
    this.night_layer.add(this.timer_snore)
    animations.fade_in_item(this.timer_snore, 235)
    animations.start_image_sequence(this.timer_snore, this.timer_snoore_animation, 7, -1)
    const [x, y] = this.game.datastore.user_character.avatar_asleep_pos
    this.timer_snore.set_left(this.character_asleep_icon.get_left() + x - idiv(this.timer_snore.get_width(), 2))
    this.timer_snore.set_top(this.character_asleep_icon.get_top() + y - 2 - this.timer_snoore_animation[0].get_height())
    animations.start_move(this.timer_snore, this.timer_snore.get_left(), this.timer_snore.get_top() - 15, 235)
  }

  end_night() {
    animations.fade_out_item(this.timer_snore, true, 235, this.end_night_snoore_callback)
    animations.start_move(this.timer_snore, this.timer_snore.get_left(), this.timer_snore.get_top() + 15, 235)
  }

  end_night_snoore_callback = (_item: unknown) => {
    this.night_layer.remove(this.character_icon)
    this.night_layer.add(this.character_icon)
    animations.fade_in_item(this.character_icon, 350)
    animations.fade_out_item(this.character_asleep_icon, true, 175)
    this.blind_dialog(this.night_layer, animations.BlindDirection.HIDE_UP, true, [this.night_layer], this.end_night_callback)
  }

  end_night_callback = (_layer: Layer) => {
    this.night_layer.remove(this.character_asleep_icon)
    if (this.night_character_layer != null) this.night_character_layer.add(this.character_icon)
    this.close_dialog(this.night_layer)
    this.during_night = false
    this.update_character_rollover()
    this.set_music_volume(1, 500)
  }

  update_locator() {
    const dep = this.game.datastore.user_character_progress.case.last_department_visited
    this.locator_text.set_text(text.to_upper(dep.name))
    const image = assets.load_image('p0_locator_dept_' + dep.image + '.png')
    const locator_pos = dep.locator_pos
    this.locator_sel.set_lefttop(locator_pos[0], locator_pos[1])
    this.locator_sel.set_image(image)
  }

  set_time_left(time = 0, callback: (() => void) | null = null) {
    this.game.datastore.user_character_progress.case.time_spend += time
    this.stop_timer('update_time_left')
    if (callback != null) this.update_time_callbacks.push(callback)
    this.start_timer('update_time_left', 10, this.update_time_left, null, true, false)
  }

  update_time_left = (key: unknown, _data: unknown) => {
    this.stop_timer(key)
    let appling_blind = false
    for (const layer of this.layers) {
      if (animations.is_applying_blind(this, layer)) { appling_blind = true; break }
    }
    if (appling_blind) this.start_timer(key, 50, this.update_time_left, null, true, false)
    else {
      const [days, hour] = this.game.datastore.user_character_progress.case.actual_days()
      if (this.timer_hour !== hour || this.timer_days !== days) {
        this.timer_to_hour = hour
        this.timer_to_days = days
        if (!this.is_timer_started('timer_clock')) {
          this.lock_folder_help()
          this.lock_ui()
          this.start_timer_clock()
        }
      } else this.invoke_update_timer_callbacks()
    }
  }

  invoke_update_timer_callbacks() {
    const callbacks = this.update_time_callbacks.slice()
    this.update_time_callbacks = []
    for (const callback of callbacks) callback()
  }

  start_timer_clock() {
    this.time_limit = this.game.datastore.user_character_progress.case.time_limit
    this.start_timer('timer_clock', 32, this.update_timer_clock, null)
    if (this.timer_hour !== 99999) {
      this.render()
      this.clock_sound.play()
    }
  }

  set_up_options() {
    this.backbar_image = assets.load_image('p0_bottomgui_backbar.png')
    this.backbar_item = new ItemImage(0, 361, this.backbar_image)
    this.options_layer.add(this.backbar_item)
    this.glow_image = assets.load_image('p0_bottomgui_icon_glow.png')
    this.map_image = assets.load_image('p0_bottomgui_map_icon.png')
    this.map_icon = new ItemImage(375, 397, this.map_image)
    this.options_layer.add(this.map_icon)
    this.map_icon.add_event_handler(ItemEvent.CLICK, this.map_click)
    this.map_icon.set_rollover(this.glow_image, this.rollover_sound, -5, -15)
    this.folder_image = assets.load_image('p0_bottomgui_case_icon.png')
    this.folder_icon = new ItemImage(445, 398, this.folder_image)
    this.options_layer.add(this.folder_icon)
    this.folder_icon.select_witnesses = false
    this.folder_icon.add_event_handler(ItemEvent.CLICK, this.folder_click)
    this.folder_icon.set_rollover(this.glow_image, this.rollover_sound, -10, -15)
    this.notes_image = assets.load_image('p0_bottomgui_notes_icon.png')
    this.notes_icon = new ItemImage(520, 394, this.notes_image)
    this.options_layer.add(this.notes_icon)
    this.notes_icon.add_event_handler(ItemEvent.CLICK, this.notes_click)
    this.notes_icon.set_rollover(this.glow_image, this.rollover_sound, -15, -11)
  }

  set_up_character() {
    this.character_icon = this.create_character_item()
    this.character_asleep_icon = this.create_character_asleep_item()
    this.info_layer.add(this.character_icon)
    this.update_character_rollover()
  }

  prepare_dialog(layer: Layer, only_character = false, animate = false) {
    this.phase.on_prepare_dialog(animate)
    if (only_character) {
      const item = this.character_icon
      const item_layer = item.get_layer()
      if (item_layer != null) item_layer.remove(item)
      layer.add(item)
    } else {
      for (const item of this.info_items) {
        const item_layer = item.get_layer()
        if (item_layer != null) item_layer.remove(item)
      }
    }
    for (const item of this.info_items) layer.add(item)
    this.update_character_rollover()
  }

  reset_dialog(restore_info_items = true, animate = false) {
    this.phase.on_reset_dialog(animate)
    if (restore_info_items) {
      for (const item of this.info_items) {
        const item_layer = item.get_layer()
        if (item_layer != null) item_layer.remove(item)
      }
      for (const item of this.info_items) this.info_layer.add(item)
    }
    this.update_character_rollover()
  }

  create_character_item() {
    const avatar_image = this.game.datastore.user_character.avatar_image
    const item = new ItemImage(0, 450 - avatar_image.get_height(), avatar_image)
    item.add_event_handler(ItemEvent.CLICK, this.character_click)
    return item
  }

  create_character_asleep_item() {
    const img = this.game.datastore.user_character.avatar_asleep_image
    return new ItemImage(7, 450 - img.get_height(), img)
  }

  update_character_rollover() {
    if (this.character_icon.get_layer() === this.info_layer && !this.during_night) this.character_icon.set_rollover_image(this.game.datastore.user_character.avatar_rollover_image, this.rollover_sound)
    else this.character_icon.set_rollover_image(null, null)
  }

  add_content_layers() {}
  add_above_options_layers() {}
  add_above_info_layers() {}

  character_click = (_item: unknown, _args: unknown) => {
    if (this.character_icon.get_layer() === this.info_layer && !this.during_night) {
      this.render()
      this.click_sound.play()
      const merits_dialog = new merits.Merits(this)
      merits_dialog.show_merits()
    }
  }

  notes_click = (_item: unknown, _args: unknown) => {
    this.notes = new notes.Notes(this)
    this.show_dialog(this.notes.layer, this.notes_handle_event)
    this.notes.select_first_page()
    this.render()
    this.notes_open_sound.play()
  }

  notes_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.render()
      this.click_sound.play()
      this.notes.close_notes()
    }
  }

  folder_click = (item: any, _args: unknown) => {
    if (this.game.datastore.user_character_progress.show_folder) item.select_witnesses = true
    this.show_dialog(this.folder.base_layer, this.folder_handle_event)
    if (item.select_witnesses) {
      this.folder.add_start_layer(folder.WITNESS)
      if (this.game.datastore.user_character_progress.show_folder) this.game.datastore.user_character_progress.show_folder = false
      this.folder_icon.select_witnesses = false
    } else this.folder.add_start_layer(this.folder_default_tab)
  }

  folder_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.render()
      this.click_sound.play()
      this.folder.close_folder()
    }
  }

  map_click = (_item: unknown, _args: unknown) => {
    const c = this.game.datastore.user_character_progress.case
    const last_dep = c.list_departments[c.list_departments.length - 1]
    if (c.last_department_lair === last_dep && c.arrest_order_thief == null && this.phase_number === 2 && !this.arrest_order_warning_shown) {
      this.arrest_order_warning_shown = true
      this.show_arrest_order_warning()
    } else {
      this.map.set_up(true, false)
      this.show_dialog(this.map.map_layer, this.map_handle_event)
      this.map.add_other_layer()
      this.render()
      this.open_map_sound.play()
    }
  }

  map_handle_event = (_e: PgEvent) => {
    // En el original la tecla Escape no cierra el mapa (hay un "return" antes).
  }

  disable_map() { this.map_icon.set_alpha(120) }
  disable_folder() { this.folder_icon.set_alpha(120) }
  disable_notes() { this.notes_icon.set_alpha(120) }
  enable_map() { this.map_icon.set_alpha(255) }
  enable_folder() { this.folder_icon.set_alpha(255) }
  enable_notes() { this.notes_icon.set_alpha(255) }

  hide_clues(fade: boolean, callback: (() => void) | null) {
    for (const [item_mask, item_found] of this.clue_items) {
      item_mask.set_visible(false)
      if (fade) animations.fade_out_item(item_found, false, 500)
      else item_found.set_visible(false)
    }
    if (fade) {
      this.render()
      this.fade_sound.play()
    }
    if (callback != null) animations.wait(this, 500, callback)
  }

  show_clues_with_fade(callback: (i: any) => void) {
    let show = false
    for (const [item_mask, item_found] of this.clue_items) {
      if (!item_found.get_visible()) {
        item_mask.set_visible(true)
        item_found.set_visible(true)
        if (!show) {
          animations.fade_in_item(item_found, 500, callback)
          show = true
        } else animations.fade_in_item(item_found, 500)
      }
    }
    if (!show) callback(null)
    else {
      this.render()
      this.fade_sound.play()
    }
  }

  find_clue(stage_clues: any[], item_type: string) {
    for (const stage_clue of stage_clues) if (stage_clue.clue.id === item_type) return stage_clue
    throw new Error('There is no clue for item_type = ' + item_type)
  }

  has_item_found(clue: unknown) { return this.items_found.includes(clue) }

  add_item_found(item: any, _show_animation: boolean) {
    const x = 174, y = 422
    const item_image = item.get_image()
    const item_found = new ItemImage(x + this.items_found.length * 60 - idiv(item_image.get_width(), 2), y - idiv(item_image.get_height(), 2), item_image)
    item_found.stage_clue = item.stage_clue
    const item_mask = new ItemMask(x + this.items_found.length * 60 - 17, y - 17, [34, 34])
    item_mask.item = item_found
    item_mask.add_event_handler(ItemEvent.CLICK, this._clue_click)
    item_mask.set_rollover(this.glow_image, this.rollover_sound, idiv(-item_mask.get_width(), 2) - 2)
    this.options_layer.add(item_mask)
    this.options_layer.add(item_found)
    this.items_found.push(item.stage_clue)
    this.clue_items.push([item_mask, item_found])
    return item_found
  }

  show_arrest_order_warning() {
    const layer = new Layer()
    layer.add(new ItemImage(43, 33, assets.load_image('p0_warning_noID_back.png')))
    this.warning_sound = assets.load_sound('p0_warning.ogg')
    const font = assets.load_font('evilgeniusbb_reg.ttf', 13)
    const font_bold = assets.load_font('evilgeniusbb_bld.ttf', 13)
    const message =
      'Estás &#f:bold!muy cerca&#f! de encontrar al ladrón\n' +
      'y aún no tienes una &#c144,22,22!&#f:bold!orden de arresto&#f!&#c! en su contra.\n' +
      '\n' +
      'Para hacerla ve a la solapa de &#c144,22,22!&#f:bold!identikit&#f!&#c! dentro de la\n' +
      '&#c144,22,22!&#f:bold!carpeta&#f!&#c! y &#f:bold!completa la información&#f! con los datos\n' +
      'que te dieron los &#f:bold!testigos&#f!.'
    const additional_fonts: Record<string, [Font, number, number]> = { bold: [font_bold, 13, -2] }
    layer.add(new ItemText(88, 75, font, 16, message, [0, 0, 0], null, 405, 160, 2, 2, additional_fonts))
    const close_item = new ItemImage(276, 328, assets.load_image('p0_button_close.png'))
    close_item.set_rollover_image(assets.load_image('p0_button_close_rollover.png'), this.rollover_sound)
    close_item.add_event_handler(ItemEvent.CLICK, this._close_arrest_order_warning_click)
    layer.add(close_item)
    this.warning_dialog = layer
    this.show_dialog(layer, this.arrest_order_warning_dialog_handle_event)
    this.blind_dialog(layer, animations.BlindDirection.SHOW_DOWN)
    this.set_music_volume(0.2, 200)
    animations.wait(this, 300, this.play_warning_sound)
  }

  play_warning_sound = () => {
    this.warning_sound.play()
    animations.wait(this, 300, this.play_music_after_warning)
  }

  play_music_after_warning = () => { this.set_music_volume(1, 500) }

  arrest_order_warning_dialog_handle_event = (e: PgEvent) => {
    // original: "if e.type == KEYDOWN and pygame.K_ESCAPE" (cualquier tecla cierra)
    if (e.type === KEYDOWN && K.K_ESCAPE) {
      this.render()
      this.click_sound.play()
      this.close_arrest_order_warning_dialog()
      return true
    }
    return undefined
  }

  show_help_dialog(page: number, delay = 0, call_before_show: (() => void) | null = null, call_after_close: (() => void) | null = null) {
    if (this.during_night_or_applying_blind()) {
      this.start_timer('show_help_dialog', 10, this.show_help_dialog_timer, [page, delay, call_before_show, call_after_close], true, false)
    } else if (delay > 0) {
      animations.wait_locked(this, delay, this.show_help_dialog_wait_callback, [page, 0, call_before_show, call_after_close])
    } else if (!this.showing_help) {
      this.showing_help = true
      this.help_call_after_close = call_after_close
      const help_dialog = new help.Help(this)
      if (call_before_show != null) call_before_show()
      help_dialog.show_help(page, false, true, this.close_help_callback)
    }
  }

  close_help_callback = () => {
    this.showing_help = false
    if (this.help_call_after_close != null) this.help_call_after_close()
  }

  show_help_dialog_timer = (key: unknown, data: any[]) => {
    this.stop_timer(key)
    this.show_help_dialog(data[0], data[1], data[2], data[3])
  }

  show_help_dialog_wait_callback = (data: any[]) => { this.show_help_dialog(data[0], data[1], data[2], data[3]) }

  _close_arrest_order_warning_click = (_item: unknown, _args: unknown) => { this.close_arrest_order_warning_dialog() }

  close_arrest_order_warning_dialog() {
    this.blind_dialog(this.warning_dialog, animations.BlindDirection.HIDE_DOWN, true, [], this._blind_arrest_order_warning_callback)
  }

  _blind_arrest_order_warning_callback = (layer: Layer) => { this.close_dialog(layer) }

  _clue_click = (item: any, _args: unknown) => {
    this.clue_dialog = this.show_clue_message(item.item, false, true, this._close_clue_dialog)
  }

  _close_clue_dialog = () => {
    this.close_dialog(this.clue_dialog!)
    this.reset_dialog()
  }

  show_clue_message(item: any, from_stage: boolean, play_sound: boolean, close_callback: () => void) {
    const font = assets.load_font('evilgeniusbb_reg.ttf', 13)
    const dialog = new Layer()
    dialog.add(new ItemImage(62, 135, assets.load_image('p2_avatar_dialog_aclue.png')))
    let message = ''
    if (from_stage) message = 'mmmm... '
    message += item.stage_clue.build_item_message()
    message = text.to_upper(message)
    if (!message.endsWith('.')) message += '.'
    dialog.add(new ItemText(92, 214, font, 0, message, [0, 0, 0], null, 280, 70, 2, 2))
    const close_x = 356, close_y = 157
    const item_image = item.get_image()
    dialog.add(new ItemImage(229 - idiv(item_image.get_width(), 2), 180 - idiv(item_image.get_height(), 2), item.get_image()))
    const close_button = new ItemImage(close_x, close_y, assets.load_image('btn_testigo_x_normal.png'), null, true)
    close_button.set_rollover_image(assets.load_image('btn_testigo_x_rollover.png'), this.rollover_sound)
    close_button.add_event_handler(ItemEvent.CLICK, this.clue_dialog_close_click)
    dialog.add(close_button)
    this.clue_dialog = dialog
    this.clue_dialog_close_callback = close_callback
    this.prepare_dialog(dialog)
    this.show_dialog(dialog, this.clue_dialog_handle_event)
    if (play_sound) {
      this.render()
      this.popup_sound.play()
    }
    return dialog
  }

  clue_dialog_close_click = (_item: unknown = null, _args: unknown = null) => { this.close_clue_dialog() }

  clue_dialog_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.render()
      this.click_sound.play()
      this.close_clue_dialog()
      return true
    }
    return undefined
  }

  close_clue_dialog() { this.clue_dialog_close_callback!() }

  blind_layers(direction: number, _area: unknown, duration = 450, callback: ((l: Layer) => void) | null = null) {
    let call = callback
    for (const layer of this.layers.slice()) {
      animations.blind_layer(layer, direction, null, duration, call)
      call = null
    }
  }

  start_map_help_animation() {
    this.start_timer('start_map_animation', 30, this._start_map_help_animation_preinvoke_timer, true)
  }

  _start_map_help_animation_preinvoke_timer = (key: unknown, _data: unknown) => {
    if (!this._check_timer_moving()) {
      this.stop_timer(key)
      this.map_animation_times = 0
      this.map_animation_dy = 30
      this._map_help_animation_up()
      this.render()
      this.bounce_sound.play()
    }
  }

  _map_help_animation_up = (_item: unknown = null) => {
    if (this.map_animation_times >= 4) this.map_animation_dy *= 0.5
    else this.map_animation_dy *= 0.9
    this.map_animation_times += 1
    if (this.map_animation_times <= 8) {
      this.map_icon.set_lefttop(375, 397)
      const duration = 60 + (this.map_animation_dy / 30) * 250
      animations.start_move(this.map_icon, 375, 397 - this.map_animation_dy, duration, [0.2, 0.5, 1], null, this._map_help_animation_down)
    }
  }

  _map_help_animation_down = (_item: unknown = null) => {
    const delay = 40 + (this.map_animation_dy / 30) * 160
    animations.start_move(this.map_icon, 375, 397, delay, [0.7, 0.5, 1], null, this._map_help_animation_up)
  }

  start_notes_help_animation(delay = 0) {
    this.start_timer('start_notes_animation', 30, this._start_notes_help_animation_preinvoke_timer, [delay], true)
  }

  _start_notes_help_animation_preinvoke_timer = (key: unknown, data: any[]) => {
    if (!this._check_timer_moving()) {
      this.stop_timer(key)
      const delay = data[0]
      if (this.notes_icon.get_alpha() < 255) return
      if (delay !== 0) {
        this.animation_times = 0
        animations.wait_locked(this, delay, this._start_notes_help_animation_wait)
      } else {
        this.notes_animation_times = 0
        this.notes_animation_dy = 30
        this._notes_help_animation_up()
        this.render()
        this.bounce_sound.play()
      }
    }
  }

  _start_notes_help_animation_wait = (_item: unknown = null) => { this.start_notes_help_animation() }

  _notes_help_animation_up = (_item: unknown = null) => {
    if (this.notes_animation_times >= 4) this.notes_animation_dy *= 0.5
    else this.notes_animation_dy *= 0.9
    this.notes_animation_times += 1
    if (this.notes_animation_times <= 8) {
      this.notes_icon.set_lefttop(520, 394)
      const duration = 60 + (this.notes_animation_dy / 30) * 250
      animations.start_move(this.notes_icon, 520, 394 - this.notes_animation_dy, duration, [0.2, 0.5, 1], null, this._notes_help_animation_down)
    }
  }

  _notes_help_animation_down = (_item: unknown = null) => {
    const delay = 40 + (this.notes_animation_dy / 30) * 160
    animations.start_move(this.notes_icon, 520, 394, delay, [0.7, 0.5, 1], null, this._notes_help_animation_up)
  }

  lock_folder_help() { this.folder_animation_locks += 1 }

  release_folder_help() {
    this.folder_animation_locks -= 1
    if (this.pending_folder_animation) this.start_folder_help_animation()
  }

  start_folder_help_animation(delay = 0) {
    this.start_timer('start_folder_animation', 30, this._start_folder_help_animation_preinvoke_timer, [delay], true)
  }

  _start_folder_help_animation_preinvoke_timer = (key: unknown, data: any[]) => {
    if (!this._check_timer_moving()) {
      this.stop_timer(key)
      const delay = data[0]
      if (this.folder_animation_locks > 0) {
        this.pending_folder_animation = true
        return
      }
      this.pending_folder_animation = false
      if (this.folder_icon.get_alpha() < 255) return
      if (delay !== 0) {
        this.animation_times = 0
        animations.wait_locked(this, delay, this._start_folder_help_animation_wait)
      } else {
        this.folder_animation_times = 0
        this.folder_animation_dy = 30
        this._folder_help_animation_up()
        this.render()
        this.bounce_sound.play()
      }
    }
  }

  _start_folder_help_animation_wait = (_item: unknown = null) => { this.start_folder_help_animation() }

  _folder_help_animation_up = (_item: unknown = null) => {
    if (this.folder_animation_times >= 4) this.folder_animation_dy *= 0.5
    else this.folder_animation_dy *= 0.9
    this.folder_animation_times += 1
    if (this.folder_animation_times <= 8) {
      this.folder_icon.set_lefttop(445, 398)
      const duration = 60 + (this.folder_animation_dy / 30) * 250
      animations.start_move(this.folder_icon, 445, 398 - this.folder_animation_dy, duration, [0.2, 0.5, 1], null, this._folder_help_animation_down)
    }
  }

  _folder_help_animation_down = (_item: unknown = null) => {
    const delay = 40 + (this.folder_animation_dy / 30) * 160
    animations.start_move(this.folder_icon, 445, 398, delay, [0.7, 0.5, 1], null, this._folder_help_animation_up)
  }

  _check_timer_moving() {
    const [days, hour] = this.game.datastore.user_character_progress.case.actual_days()
    return this.timer_days < days || (this.timer_days === days && this.timer_hour < hour)
  }

  _show_loading_callback = (_layer: Layer) => {
    this.start_timer('load_phase', 0, this._load_phase_callback)
  }

  _hide_loading_callback = (_layer: unknown = null, _inital_phase = false) => {
    this.set_time_left(0, this._loading_set_time_callback)
  }

  _loading_set_time_callback = () => {
    this.loading_phase = false
    this.seting_timer = true
    if (!this.minigame_started && this.phase_number !== 3) animations.wait_locked(this, 50, this._show_dialog_step_callback)
  }

  _show_dialog_step_callback = () => {
    if (this.during_night_or_applying_blind()) animations.wait(this, 50, this._show_dialog_step_callback)
    else {
      this.seting_timer = false
      if (this.phase_number === 1) this.check_ending()
      if (!this._ending_visible) {
        const cp = this.game.datastore.user_character_progress
        const c = cp.case
        if (c.time_spend < c.time_limit) {
          if (this.phase_number === 1) {
            if (cp.last_help_step_seen <= 0) {
              this.show_help_dialog(1, 1000)
              cp.last_help_step_seen = 1
            }
            this.phase.check_show_arrived_wrong_location()
          } else if (this.phase_number === 2) {
            if (cp.last_help_step_seen <= 4) {
              this.show_help_dialog(5, 1000)
              cp.last_help_step_seen = 5
            }
          }
        }
      }
    }
  }

  _load_phase_callback = (key: unknown, _data: unknown) => {
    this.stop_timer(key)
    this._load_phase(this.load_phase_number)
  }

  _load_phase(phase: number) {
    const modName = ('phase' + phase) as lazy.ModName
    if ((phase === 1 || phase === 2 || phase === 3) && !lazy.isLoaded(modName)) {
      // módulo de la fase todavía descargándose (code-splitting): se reintenta al llegar
      this.loading_phase = true
      void lazy.ensure(modName).then(() => this._load_phase(phase))
      return
    }
    this.loading_phase = true
    if (!this._stage_initialized) {
      this.initialize_stage()
      this._stage_initialized = true
      this.initialized = true
    }
    this.empty_layers()
    if (this.phase != null) this.reset_dialog()
    this.set_mouse_cursor(null)
    this.set_items('')
    // (web) el reloj bloquea la interfaz mientras avanza; si se corta acá hay que liberar ese bloqueo
    if (this.is_timer_started('timer_clock')) { this.release_folder_help(); this.unlock_ui() }
    this.stop_timers()
    this.phase = null
    this.map_icon.set_lefttop(375, 397)
    this.folder_icon.set_lefttop(445, 398)
    this.notes_icon.set_lefttop(520, 394)
    if (phase === 1) {
      this.phase = new (lazy.need('phase1') as any).Phase1Content()
      this.update_locator()
    } else if (phase === 2) {
      this.phase = new (lazy.need('phase2') as any).Phase2Content()
      this.arrest_order_warning_shown = false
    } else if (phase === 3) {
      this.phase = new (lazy.need('phase3') as any).Phase3Content()
    } else throw new Error("Phase '" + str(phase) + "' not implemented.")
    this.phase_number = phase
    this.add_layer(this.background_layer)
    this.phase.initialize(this.game, this)
    this.phase.add_content_layers()
    this.add_layer(this.options_layer)
    this.phase.add_above_options_layers()
    this.add_layer(this.info_layer)
    this.phase.add_above_info_layers()
    if (this.save_state_on_next_load_phase) {
      this.save_progress(true)
      this.save_state_on_next_load_phase = false
    } else this.save_state_on_next_load_phase = true
    this.play_phase_music()
    this._ending_visible = false
    if (phase === 1 && this.minigame != null) {
      this.phase.start_minigame(this.minigame)
      this.minigame_started = true
    } else this.minigame_started = false
    this.minigame = null
    this.game.stats.start_time_event(statcodes.PHASE_PREFIX + str(this.phase_number))
    // En la fase 3 el original no oculta aquí la pantalla de carga (la oculta Phase3Content)
    if (this.phase_number !== 3) this.game.hide_loading(this._hide_loading_callback)
  }

  save_progress(check_save_in_development: boolean, save_character_list = false) {
    this.game.datastore.save_character('p' + str(this.phase_number), check_save_in_development)
    if (save_character_list) this.game.datastore.save_characters()
  }

  play_phase_music() {
    const music = this.phase.get_music()
    if (music != null) this.play_music(music[0], music[1])
  }

  check_ending = () => {
    this.checking_ending = true
    if (!this.loading_phase) {
      if (this.during_night_or_applying_blind()) animations.wait(this, 50, this.check_ending)
      else {
        this.checking_ending = false
        const c = this.game.datastore.user_character_progress.case
        if (c.time_spend >= c.time_limit) {
          if (!this._ending_visible) {
            this._ending_visible = true
            this.show_time_up_end_game()
          }
          return
        }
        if (lazy.isLoaded('phase1') && this.phase instanceof (lazy.need('phase1') as any).Phase1Content) {
          if (!this._ending_visible && this.phase.final_stage_check()) this._ending_visible = true
        }
      }
    }
  }

  during_night_or_applying_blind() {
    if (this.during_night) return true
    for (const layer of this.layers) if (animations.is_applying_blind(this, layer)) return true
    return false
  }

  show_time_up_end_game = () => {
    if (this.during_night_or_applying_blind()) animations.wait(this, 50, this.show_time_up_end_game)
    else {
      const ending = new endgame.EndGame(this, endgame.EndReason.TIME_UP)
      ending.show_opening_dialog()
      this.save_progress(false)
    }
  }

  show_mainmenu() {
    if (!this.showing_mainmenu) {
      this.pause_music(450)
      const main = new mainmenu.MainMenu(this)
      this.showing_mainmenu = true
      main.show_mainmenu(true, this.close_mainmenu_callback)
    }
  }

  close_mainmenu_callback = () => {
    this.showing_mainmenu = false
    this.unpause_music()
  }

  handle_event(e: PgEvent) {
    if (e.type === KEYDOWN) {
      if (e.key === K.K_ESCAPE && !this.checking_ending && !this._ending_visible && !this.seting_timer && !this.loading_phase) {
        this.render()
        this.click_sound.play()
        this.show_mainmenu()
      }
      // Los atajos de desarrollo del original (get_development_mode) están siempre desactivados.
    }
    return undefined
  }

  get_common_modifiers(mod: number) {
    return mod & (64 | 128 | 256 | 512 | 1 | 2)
  }
}
