// Port de game/stages/mainmenu.py (menú principal: detective, crear/elegir/borrar, ayuda,
// créditos, récords y salir). En la web "Salir" vuelve a la pantalla de inicio y no hay
// actualizaciones online (update_manager no existe o nunca informa actualizaciones).
import { BlindDirection } from '../../framework/animations.ts'
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import pygame from '../../pg/index.ts'
import { Layer, ItemImage, ItemText, ItemMask, ItemRect, ItemEvent, KEYDOWN, K, type FontSpec } from '../../framework/stage.ts'
import * as serialization from '../data/serialization.ts'
import * as help from './help.ts'
import * as merits from './merits.ts'
import * as phase0 from './phase0.ts'
import * as stagecase from './case.ts'
import * as characterid from './characterid.ts'
import * as startscreen from './startscreen.ts'
import { zpad } from '../../pg/py.ts'
import type { PgEvent } from '../../pg/events.ts'

export const STATE_ROLLOVER_TIMER_KEY = 'show_create_char_state_rollover'

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U' }
const cmpKey = <T,>(key: (x: T) => string) => (a: T, b: T) => { const ka = key(a), kb = key(b); return ka < kb ? -1 : ka > kb ? 1 : 0 }

export class MainMenu {
  [k: string]: any
  stage: any
  main_layer = new Layer()
  create_layer: Layer | null = null
  click_sound: any
  rollover_sound: any
  character_id: any
  overlay = false
  close_callback: (() => void) | null = null
  update_added = false
  deleted_characters: number[] = []
  current_character: any = null
  create_callback: (() => void) | null = null
  create_background_layer: Layer | null = null
  create_dark_background = false

  constructor(stage: any) {
    this.stage = stage
    this.click_sound = stage.click_sound
    this.rollover_sound = stage.rollover_sound
    this.character_id = new characterid.CharacterId(this.rollover_sound)
  }

  show_mainmenu(overlay: boolean, close_callback: (() => void) | null = null, apply_blind = true) {
    this.overlay = overlay
    this.close_callback = close_callback
    this.update_added = false
    this.deleted_characters = []
    this.set_up_mainmenu()
    this.stage.show_dialog(this.main_layer, this.handle_event, null)
    if (this.current_character == null) this.show_create(null, false, null, true)
    if (apply_blind) this.stage.blind_dialog(this.main_layer, BlindDirection.SHOW_DOWN, false, [], this.show_mainmenu_callback)
    else this.show_mainmenu_callback()
  }

  show_mainmenu_callback = (_layer: Layer | null = null) => {
    if (this.create_layer != null) this.set_create_name_focus()
    const um = this.stage.game.update_manager
    if (um != null && um.exists_update?.()) this.notify_update_available(um.description)
  }

  close_mainmenu() {
    this.stage.blind_dialog(this.main_layer, BlindDirection.HIDE_UP, true, [], this.close_mainmenu_callback)
  }

  close_mainmenu_callback = (_layer: Layer) => {
    this.stage.close_dialog(this.main_layer)
    if (this.close_callback != null) this.close_callback()
  }

  private button(layer: Layer, x: number, y: number, normal: string, rollover: string, handler: (i: any, a: any) => void) {
    const item = new ItemImage(x, y, assets.load_image(normal))
    item.set_rollover_image(assets.load_image(rollover), this.rollover_sound)
    item.add_event_handler(ItemEvent.CLICK, handler)
    layer.add(item)
    return item
  }

  set_up_mainmenu() {
    this.main_layer.add(new ItemImage(0, 0, assets.load_image('p0_mainmenu_mainback.jpg')))
    this.current_character = this.get_active_character()
    this.character_id.set_up_id(this.main_layer, this.current_character, 120, 126, false, this.charid_click)
    if (!this.overlay) this.main_layer.add(new ItemImage(192, 113, assets.load_image('p0_mainmenu_title_welcome.png')))
    this.play_button = this.button(this.main_layer, 237, 299, 'p0_mainmenu_btn_play_normal.png', 'p0_mainmenu_btn_play_rollover.png', this.play_click)
    if (this.overlay) {
      this.backtogame_button = this.button(this.main_layer, 183, 302, 'p0_mainmenu_btn_backtogame_normal.png', 'p0_mainmenu_btn_backtogame_rollover.png', this.play_click)
      this.play_button.set_visible(false)
    }
    this.button(this.main_layer, 11, 295, 'p0_mainmenu_btn_highscores_normal.png', 'p0_mainmenu_btn_highscores_rollover.png', this.highscores_click)
    this.button(this.main_layer, 465, 298, 'p0_mainmenu_btn_swapdetective_normal.png', 'p0_mainmenu_btn_swapdetective_rollover.png', this.swapdetective_click)
    this.button(this.main_layer, 135, 386, 'p0_mainmenu_btn_help_normal.png', 'p0_mainmenu_btn_help_rollover.png', this.help_click)
    this.button(this.main_layer, 254, 385, 'p0_mainmenu_btn_credits_normal.png', 'p0_mainmenu_btn_credits_rollover.png', this.credits_click)
    this.button(this.main_layer, 375, 386, 'p0_mainmenu_btn_exit_normal.png', 'p0_mainmenu_btn_exit_rollover.png', this.exit_click)
  }

  notify_update_available(description: string) {
    if (!this.update_added) {
      this.updategame_item = new ItemImage(475, 15, assets.load_image('p0_mainmenu_updater_btn_normal.png'))
      this.updategame_item.set_rollover_image(assets.load_image('p0_mainmenu_updater_btn_rollover.png'), this.rollover_sound)
      this.updategame_item.add_event_handler(ItemEvent.CLICK, this.update_game_click)
      this.update_description = description
      this.update_added = true
      const dismissed = !!this.stage.game.updategame_dismissed
      if (!this.overlay && !dismissed) this.show_updategame()
      else this.main_layer.add(this.updategame_item)
    }
  }

  set_up_swapdetective() {
    const l = (this.swapdetective_layer = new Layer())
    l.add(new ItemImage(116, 26, assets.load_image('p0_mainmenu_swap_backdrop.png')))
    this.swapdetective_font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    const font_13 = assets.load_font('evilgeniusbb_bld.ttf', 13)
    this.swapdetective_rollover_back_item = new ItemImage(0, 0, assets.load_image('p0_mainmenu_swap_selector_rollover.png'))
    this.swapdetective_rollover_back_item.set_visible(false)
    l.add(this.swapdetective_rollover_back_item)
    this.swapdetective_selected_back_item = new ItemImage(0, 0, assets.load_image('p0_mainmenu_swap_selector_selected.png'))
    this.swapdetective_selected_back_item.set_visible(false)
    l.add(this.swapdetective_selected_back_item)
    this.swapdetective_selected_text_item = new ItemText(0, 0, font_13, 0, '', [117, 51, 12], null, 250, 20, 2, 1)
    this.swapdetective_selected_text_item.set_visible(false)
    l.add(this.swapdetective_selected_text_item)
    this.create_button = this.button(l, 137, 355, 'p0_mainmenu_btn_create_normal.png', 'p0_mainmenu_btn_create_rollover.png', this.swapdetective_create_click)
    this.create_button_disabled = new ItemImage(137, 355, assets.load_image('p0_mainmenu_btn_create_inactive.png'))
    this.create_button_disabled.set_visible(false)
    l.add(this.create_button_disabled)
    this.select_button = this.button(l, 252, 355, 'p0_mainmenu_btn_select_normal.png', 'p0_mainmenu_btn_select_rollover.png', this.swapdetective_select_click)
    this.select_button_disabled = new ItemImage(252, 355, assets.load_image('p0_mainmenu_btn_select_inactive.png'))
    this.select_button_disabled.set_visible(false)
    l.add(this.select_button_disabled)
    this.delete_button = this.button(l, 374, 355, 'p0_mainmenu_btn_delete_normal.png', 'p0_mainmenu_btn_delete_rollover.png', this.swapdetective_delete_click)
    this.delete_button_disabled = new ItemImage(374, 355, assets.load_image('p0_mainmenu_btn_delete_inactive.png'))
    this.delete_button_disabled.set_visible(false)
    l.add(this.delete_button_disabled)
    this.button(l, 263, 401, 'p0_mainmenu_btn_back_normal.png', 'p0_mainmenu_btn_back_rollover.png', this.swapdetective_back_click)
    this.swapdetective_selected = null
    this.swapdetective_over_item = null
    this.swapdetective_character_items = []
    this.load_characters()
  }

  load_characters() {
    for (const item of this.swapdetective_character_items) this.swapdetective_layer.remove(item)
    this.swapdetective_character_items = []
    const characters = this.stage.game.datastore.characters.slice()
    characters.sort(cmpKey((c: any) => this.get_character_name(c)))
    let y = 113
    let default_selection: any = null
    for (const c of characters) {
      const text_item = new ItemText(175, y, this.swapdetective_font_14, 0, c.name, [73, 72, 54], null, 250, 20, 2, 1)
      this.swapdetective_layer.add(text_item)
      this.swapdetective_character_items.push(text_item)
      const text_mask: any = new ItemMask(175, y - 4, [250, 25])
      text_mask.charinfo = c
      text_mask.text_item = text_item
      text_mask.add_event_handler(ItemEvent.MOUSE_ENTER, this.swapdetective_item_enter)
      text_mask.add_event_handler(ItemEvent.MOUSE_LEAVE, this.swapdetective_item_leave)
      text_mask.add_event_handler(ItemEvent.CLICK, this.swapdetective_item_click)
      this.swapdetective_layer.add(text_mask)
      this.swapdetective_character_items.push(text_mask)
      if (this.current_character != null && c.id === this.current_character.id) default_selection = text_mask
      y += 28
    }
    this.set_swapdetective_selected(default_selection)
    this.update_swapdetective_buttons()
  }

  update_swapdetective_buttons() {
    const k = this.stage.game.datastore.characters.length
    this.create_button.set_visible(k < 8)
    this.create_button_disabled.set_visible(k >= 8)
    const none = k === 0 || this.swapdetective_selected == null
    this.select_button.set_visible(!none)
    this.select_button_disabled.set_visible(none)
    this.delete_button.set_visible(!none)
    this.delete_button_disabled.set_visible(none)
  }

  set_up_create() {
    const l = (this.create_layer = new Layer())
    l.add(new ItemImage(116, 26, assets.load_image('p0_mainmenu_swap_new_backdrop.png')))
    const font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    this.create_flip_sound = assets.load_sound('GUI_Flip.ogg')
    this.create_name_item = new ItemText(232, 105, font_14, 0, '', [0, 0, 0], null, 200, 18, 2, 1)
    this.create_name_item.set_watermark_text('INGRESE AQUÍ SU NOMBRE')
    this.create_name_item.set_editable(true, (key: number) => this.create_name_keypressed(key))
    this.create_name_item.set_max_chars(30)
    l.add(this.create_name_item)
    const character_name_mask = new ItemMask(224, 103, [216, 19])
    l.add(character_name_mask)
    this.create_name_item.set_edit_on_click(character_name_mask)
    const character_state_mask = new ItemMask(263, 128, [178, 19])
    character_state_mask.set_rollover(assets.load_image('p0_mainmenu_btn_state_rollover.png'), this.rollover_sound, 0, -1)
    character_state_mask.add_event_handler(ItemEvent.CLICK, this.create_state_click)
    l.add(character_state_mask)
    this.character_state_item = new ItemText(265, 130, font_14, 0, '', [0, 0, 0], null, 170, 18, 2, 1)
    l.add(this.character_state_item)
    const male_mask = new ItemMask(311, 162, [17, 15])
    male_mask.add_event_handler(ItemEvent.CLICK, this.create_male_click)
    l.add(male_mask)
    const female_mask = new ItemMask(397, 162, [17, 15])
    female_mask.add_event_handler(ItemEvent.CLICK, this.create_female_click)
    l.add(female_mask)
    this.create_sex_check_item = new ItemImage(313, 156, assets.load_image('p0_mainmenu_swap_new_check.png'))
    l.add(this.create_sex_check_item)
    this.create_avatar_item = new ItemImage(242, 208, null)
    l.add(this.create_avatar_item)
    l.add(new ItemImage(237, 203, assets.load_image('p0_merits_main_id_box.png')))
    this.right_arrow_normal_image = assets.load_image('p0_mainmenu_swap_new_arrow_normal.png')
    this.right_arrow_rollover_image = assets.load_image('p0_mainmenu_swap_new_arrow_rollover.png')
    this.right_arrow_clicked_image = assets.load_image('p0_mainmenu_swap_new_arrow_clicked.png')
    this.create_right_arrow_item = new ItemImage(360, 255, this.right_arrow_normal_image)
    this.create_right_arrow_state = 0
    this.create_right_arrow_item.add_event_handler(ItemEvent.MOUSE_ENTER, this.create_next_avatar_enter)
    this.create_right_arrow_item.add_event_handler(ItemEvent.MOUSE_LEAVE, this.create_next_avatar_leave)
    this.create_right_arrow_item.add_event_handler(ItemEvent.CLICK, this.create_next_avatar_click)
    l.add(this.create_right_arrow_item)
    this.left_arrow_normal_image = this.right_arrow_normal_image.flip_h_copy()
    this.left_arrow_rollover_image = this.right_arrow_rollover_image.flip_h_copy()
    this.left_arrow_clicked_image = this.right_arrow_clicked_image.flip_h_copy()
    this.create_left_arrow_item = new ItemImage(207, 255, this.left_arrow_normal_image)
    this.create_left_arrow_state = 0
    this.create_left_arrow_item.add_event_handler(ItemEvent.MOUSE_ENTER, this.create_previous_avatar_enter)
    this.create_left_arrow_item.add_event_handler(ItemEvent.MOUSE_LEAVE, this.create_previous_avatar_leave)
    this.create_left_arrow_item.add_event_handler(ItemEvent.CLICK, this.create_previous_avatar_click)
    l.add(this.create_left_arrow_item)
    this.accept_button = this.button(l, 202, 369, 'p0_mainmenu_btn_accept_normal.png', 'p0_mainmenu_btn_accept_rollover.png', this.create_accept_click)
    this.accept_button_disabled = new ItemImage(202, 369, assets.load_image('p0_mainmenu_btn_accept_inactive.png'))
    this.accept_button_disabled.set_visible(false)
    l.add(this.accept_button_disabled)
    this.button(l, 306, 369, 'p0_mainmenu_btn_cancel_normal.png', 'p0_mainmenu_btn_cancel_rollover.png', this.create_cancel_click)
    this.create_sex_male = true
    this.create_character_location = ''
    this.create_avatar_count = 4
    this.create_avatar = 1
    this.update_create_sex_mark()
    this.update_create_avatar_image()
    this.update_create_accept()
  }

  set_up_state_list() {
    const l = (this.state_list_layer = new Layer())
    l.add(new ItemImage(166, 17, assets.load_image('p0_mainmenu_swap_new_stateselector_backdrop.png')))
    const departments = this.stage.game.datastore.list_departments.slice()
    departments.sort(cmpKey((d: any) => this.get_department_name(d)))
    const state_rollover_image = assets.load_image('p0_mainmenu_swap_new_stateselector_rollover.png')
    this.create_state_rollover_item = new ItemImage(179, 0, state_rollover_image)
    this.create_state_rollover_item.set_visible(false)
    l.add(this.create_state_rollover_item)
    const dep_y = [58, 76, 94, 112, 130, 148, 166, 184, 202, 220, 238, 256, 273, 292, 310, 328, 346, 364, 382]
    for (let i = 0; i < departments.length; i++) {
      const mask: any = new ItemMask(179, dep_y[i], state_rollover_image.get_size())
      mask.add_event_handler(ItemEvent.MOUSE_ENTER, this.create_department_enter)
      mask.add_event_handler(ItemEvent.MOUSE_LEAVE, this.create_department_leave)
      mask.add_event_handler(ItemEvent.CLICK, this.create_department_click)
      mask.department = departments[i]
      l.add(mask)
    }
  }

  update_create_sex_mark() { this.create_sex_check_item.set_left(this.create_sex_male ? 313 : 399) }

  update_create_avatar_image() {
    const image = assets.load_image((this.create_sex_male ? 'p0_detective_male_' : 'p0_detective_female_') + zpad(this.create_avatar, 3) + '_id.jpg')
    this.create_avatar_item.set_image(image)
    this.create_left_arrow_item.set_visible(this.create_avatar > 1)
    this.create_right_arrow_item.set_visible(this.create_avatar < this.create_avatar_count)
  }

  set_up_delete(charinfo: any) {
    const l = (this.delete_layer = new Layer())
    l.add(new ItemImage(150, 24, assets.load_image('p0_mainmenu_swap_del_backdrop.png')))
    const font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    const message = '¿ESTÁ SEGURO QUE DESEA ELIMINAR ESTE DETECTIVE? TODO EL PROGRESO GUARDADO SE PERDERÁ'
    l.add(new ItemText(168, 91, font_14, 13, message, [153, 0, 0], null, 268, 52, 2, 1))
    const charid = new characterid.CharacterId()
    charid.set_up_id(l, charinfo, 123, 147)
    this.button(l, 222, 372, 'p0_mainmenu_btn_yes_normal.png', 'p0_mainmenu_btn_yes_rollover.png', this.delete_yes_click)
    this.button(l, 304, 372, 'p0_mainmenu_btn_no_normal.png', 'p0_mainmenu_btn_no_rollover.png', this.delete_no_click)
  }

  charid_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.load_character_progress()
    const merits_dialog = new merits.Merits(this.stage)
    merits_dialog.show_merits(false)
  }

  load_character_progress() {
    const datastore = this.stage.game.datastore
    if (datastore.user_character == null || datastore.user_character.charinfo.id !== this.current_character.id) datastore.load_character(this.current_character)
  }

  get_character_name(char_info: any) { return this.remove_accents_and_upper(char_info.name) }
  get_department_name(dep: any) { return this.remove_accents_and_upper(dep.name) }
  remove_accents_and_upper(text: string) { return text.replace(/[áéíóúÁÉÍÓÚ]/g, (c) => ACCENTS[c]).toUpperCase() }

  swapdetective_item_enter = (item: any, _args: unknown) => { this.set_swapdetective_rollover_over(item) }
  swapdetective_item_leave = (_item: any, _args: unknown) => { this.set_swapdetective_rollover_over(null) }
  swapdetective_item_click = (item: any, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.set_swapdetective_selected(item)
  }

  set_swapdetective_rollover_over(item: any) {
    if (this.swapdetective_over_item !== item) {
      if (item == null) this.swapdetective_rollover_back_item.set_visible(false)
      else {
        this.swapdetective_rollover_back_item.set_left(item.get_left())
        this.swapdetective_rollover_back_item.set_top(item.get_top())
        this.swapdetective_rollover_back_item.set_visible(true)
      }
      this.swapdetective_over_item = item
    }
  }

  set_swapdetective_selected(item: any) {
    if (this.swapdetective_selected !== item) {
      if (item == null) {
        this.swapdetective_selected_back_item.set_visible(false)
        this.swapdetective_selected_text_item.set_visible(false)
      } else {
        this.swapdetective_selected_back_item.set_left(item.get_left() - 16)
        this.swapdetective_selected_back_item.set_top(item.get_top() - 5)
        this.swapdetective_selected_back_item.set_visible(true)
        this.swapdetective_selected_text_item.set_left(item.get_left())
        this.swapdetective_selected_text_item.set_top(item.get_top() + 3)
        this.swapdetective_selected_text_item.set_text(item.charinfo.name)
        this.swapdetective_selected_text_item.set_visible(true)
        item.text_item.set_visible(false)
      }
      if (this.swapdetective_selected != null) this.swapdetective_selected.text_item.set_visible(true)
      this.swapdetective_selected = item
    }
    this.update_swapdetective_buttons()
  }

  set_up_credits() {
    const l = (this.credits_layer = new Layer())
    l.add(new ItemImage(0, 0, assets.load_image('p0_credits_background.jpg')))
    this.button(l, 267, 393, 'p0_tutorial_remake_btn_close_normal.png', 'p0_tutorial_remake_btn_close_rollover.png', this.credits_close_click)
    this.credits_prev_item = this.button(l, 235, 398, 'p0_tutorial_remake_btn_prev_normal.png', 'p0_tutorial_remake_btn_prev_rollover.png', this.credits_prev_click)
    this.credits_next_item = this.button(l, 354, 399, 'p0_tutorial_remake_btn_next_normal.png', 'p0_tutorial_remake_btn_next_rollover.png', this.credits_next_click)
    this.credits_font_30 = assets.load_font('turkey.ttf', 30)
    this.credits_font_24 = assets.load_font('turkey.ttf', 24)
    this.credits_font_20 = assets.load_font('turkey.ttf', 20)
    this.credits_font_18 = assets.load_font('turkey.ttf', 18)
    this.credits_font_16 = assets.load_font('turkey.ttf', 16)
    this.credits_font_12 = assets.load_font('turkey.ttf', 12)
    this.credits_people_layer = new Layer()
    this.credits_people_layer_old = null
    this.credits_page = 1
    this.credits_pagecount = 7
  }

  load_current_credits(apply_effect = true) {
    let header: string | null = null
    let footer: string | null = null
    let line_separation = 30
    let small_line_font: any = null
    let small_line_height = 0
    let top_margin = 0, title_font: any, text_font: any, header_separation = 0, footer_y = 0
    let text: string[] = []
    const T = (s: string) => '&#c223,0,0!&#f:t!' + s + '&#c!&#f!\n'
    const S = '&#f:s! \n&#f!'
    const BETA = T('BETA TESTERS:')
    const p = this.credits_page
    if (p === 1) {
      top_margin = 10; title_font = this.credits_font_30; text_font = this.credits_font_24; small_line_font = this.credits_font_16; small_line_height = 24
      text = [
        T('DISEÑO DE JUEGO:') + 'MARTÍN DA SILVEIRA\n' + S + T('ARTE:') + 'FERNANDO PICÚN\n' + S + T('MÚSICA Y SONIDO:') + 'MARTÍN DA SILVEIRA\n',
        T('PROGRAMACIÓN:') + 'NICOLÁS CASTAGNET\n' + 'JUAN PABLO AYALA\n' + 'FELIPE OTAMENDI\n\n' + T('PRODUCCIÓN:') + 'MARIANO DE LARROBLA\n' + 'CARMEN FERNANDEZ\n',
      ]
    } else if (p === 2) {
      top_margin = 70; title_font = this.credits_font_24; text_font = this.credits_font_20; small_line_font = this.credits_font_16; small_line_height = 7
      text = [
        T('ASESORAMIENTO PEDAGÓGICO:') + S + 'ANDRÉS COPES\n' + 'WANDA SPINELLI\n',
        T('CORRECCIÓN DE TEXTOS:') + S + 'LETICIA CHIFFLET\n',
        T('EQUIPO DE TESTING:') + S + 'EUGENIA DE LARROBLA\n' + 'GABRIELA CONZE\n',
      ]
    } else if (p >= 3 && p <= 6) {
      top_margin = 38; title_font = this.credits_font_24; text_font = this.credits_font_16; line_separation = 23; header_separation = 44
      header = BETA
      if (p === 3) text = [
        'ADRIÁN KIRCHNITZ\nAGUSTÍN RAMASCO\nAGUSTINA ALVAREZ\nAGUSTINA CHALKLING\nALEJANDRO GONZÁLEZ\nALEJO PIREZ\nALEXANDER ACEVEDO\nALVARO GARCÍA BARBIERI\nANDREA FERRERO PEREIRA\nANGEL MATÍAS FERRARI SUÁREZ\nANTONELLA ECHEVESTE PALOMEQUE\n',
        'BIANCA MARCHESONI\nBIANCA LEGUIZAMÓN\nBRAHIAN RAMIRO GHISOLFO RAMOS\nBRUNO LEEMAN\nCRISTIAN ALMADA\nDANIEL FIGUEREDO\nDIEGO FERNANDO NELCIS PIRIZ\nDIEGO HERNÁNDEZ\nDIEGO PIEGAS\nEMILIANO PICÚN\nENZO FAGUNDEZ\n',
      ]
      else if (p === 4) text = [
        'ERIC MORDEZKI\nESTEFANI CAÑETE\nEZEQUIEL CABRERA\nFABRIZZIO OVIEDO\nFEDERICO MÉNDEZ\nFELIPE DA SILVEIRA\nFIORELLA TORRES\nGABRIEL CURTI\nGABRIELA DENISE GÓMEZ MEDINA\nGONZALO DE SOSA\nGUIDAÍ BLENGINI\n',
        'GUILLERMO GARCÍA BARBIERI\nGUILLERMO MORDEZKI\nJAVIER SINTES\nJOAQUÍN DÍAZ\nJOSÉ IGNACIO GALATTI\nJUAN I. CROSA\nJUAN IGNACIO MEDINA CRUZ\nJUAN IGNACIO VALLE\nJUAN MANUEL VALLE\nJUAN SEBASTIÁN MARTÍNEZ APLANALP\nJULIA DE LEÓN\n',
      ]
      else if (p === 5) text = [
        'JULIA PISSANO\nLARA CONSANI\nLAURA BELÉN VEGA AYALA\nLINET JOANA ALTAMIRANDA DA SILVA\nLUANA PIREZ\nLUCAS GENOLET\nLUCAS MATTOS\nLUCÍA CABRERA\nMAIKEL PEREYRA\nMARÍA EUGENIA DE SOUZA\nMATÍAS IBARRA\n',
        'MAURICIO SILVA\nMAURO CAUTERUCCIO\nMICAELA ALMADA ZÁRATE\nMILENA ZÁRATE MELGAREJO\nMILTON AYALA SANTOS\nNAHUEL ROMERO\nORIANA MONTAÑA\nPABLO SOSA\nPAULA GARCÍA\nPILAR MÉNDEZ\nRENZO CAUTERUCCIO\n',
      ]
      else {
        footer_y = 301
        footer = T('¡MUCHAS GRACIAS A TODOS!')
        text = [
          'ROCÍO CAMILA CURTI MAWAD\nSANTIAGO NICOLÁS PRÓSPER VEINZ\nSANTIAGO QUIJANO\nSERGIO DANIEL GARCÍA SIERRA\nSOFÍA GASPERI\n',
          'SOFÍA PIEDRA CUEVA\nTATIANA PIREZ\nTOLENTINO GÓMEZ\nVALENTINA GONZÁLEZ\nWINSTON SANTOS\n',
        ]
      }
    } else if (p === 7) {
      top_margin = 36; title_font = this.credits_font_24; text_font = this.credits_font_18; line_separation = 24; header_separation = 42
      header = T('AGRADECIMIENTOS:')
      text = [
        "DCA\nINGENIO\nPROYECTO RAYUELA\nFUNDACIÓN \"LOS PINOS\"\nANAINÉS ZIGNAGO\nJOHN MARTZ\nMARTÍN PÉREZ\nRAFAEL GARCÍA\nSHIRLEY SIRI\nCARLOS DA SILVEIRA\nDIEGO LÓPEZ D'ALESSANDRO\n",
        'JUAN PABLO PISÓN\nLILIANA BARDALLO\nMARIANA GIL SALABERRY\nMARTÍN CHAPARRO\nMARTÍN LOSKÍN\nZZ\nCHAIM GINGOLD\nELI BARNETT\nFERNANDO SANSBERRO\nROBIN HUNICKE',
      ]
    }
    if (this.credits_people_layer_old != null) this.stage.remove_layer(this.credits_people_layer_old)
    this.credits_people_layer_old = this.credits_people_layer
    const cl = (this.credits_people_layer = new Layer())
    let x = 7
    const y = 81 + top_margin
    const column_width = Math.floor(585 / text.length)
    const height = 295
    const additional_fonts: Record<string, FontSpec> = { t: [title_font, 0] }
    if (small_line_font != null) additional_fonts.s = [small_line_font, small_line_height]
    const shadowed = (sx: number, sy: number, lh: number, s: string, w: number, h: number) => {
      cl.add(new ItemText(sx + 2, sy + 3, text_font, lh, s.split('&#c223,').join('&#c0,'), [0, 0, 0], null, w, h, 2, 1, additional_fonts))
      cl.add(new ItemText(sx, sy, text_font, lh, s, [255, 255, 255], null, w, h, 2, 1, additional_fonts))
    }
    if (header != null) shadowed(7, 81 + top_margin - header_separation, 30, header, 585, 30)
    if (footer != null) shadowed(7, footer_y, 30, footer, 585, 30)
    for (const column of text) {
      shadowed(x, y, line_separation, column, column_width - 5, height)
      x += column_width
    }
    this.stage.add_layer(cl)
    if (apply_effect) {
      const area = new pygame.Rect(0, 40, 0, 362)
      animations.stop_blind_layer(this.credits_people_layer_old)
      animations.stop_blind_layer(cl)
      this.credits_people_layer_old.set_clip(null)
      cl.set_clip(null)
      animations.blind_layer(this.credits_people_layer_old, BlindDirection.HIDE_DOWN, area, 400, null, false)
      animations.blind_layer(cl, BlindDirection.SHOW_DOWN, area, 400, null, false)
    } else this.stage.remove_layer(this.credits_people_layer_old)
    this.credits_prev_item.set_visible(this.credits_page > 1)
    this.credits_next_item.set_visible(this.credits_page < this.credits_pagecount)
  }

  set_up_exit() {
    const l = (this.exit_layer = new Layer())
    l.add(new ItemImage(132, 77, assets.load_image('p0_mainmenu_exit_backdrop.png')))
    this.button(l, 221, 228, 'p0_mainmenu_btn_yes_normal.png', 'p0_mainmenu_btn_yes_rollover.png', this.exit_yes_click)
    this.button(l, 303, 228, 'p0_mainmenu_btn_no_normal.png', 'p0_mainmenu_btn_no_rollover.png', this.exit_no_click)
    const font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    const font_13 = assets.load_font('evilgeniusbb_bld.ttf', 13)
    l.add(new ItemText(167, 150, font_14, 13, '¿ESTÁ SEGURO QUE DESEA\nSALIR DEL JUEGO?', [153, 0, 0], null, 268, 30, 2, 1))
    l.add(new ItemText(161, 193, font_13, 13, '- SU PROGRESO QUEDARÁ GUARDADO -', [0, 0, 0], null, 278, 23, 2, 1))
  }

  get_active_character() {
    const datastore = this.stage.game.datastore
    for (const c of datastore.characters) if (c.active) return c
    if (datastore.characters.length > 0) return datastore.characters[0]
    return null
  }

  update_game_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.show_updategame()
  }

  set_up_updategame() {
    const l = (this.updategame_layer = new Layer())
    l.add(new ItemImage(120, 47, assets.load_image('p0_mainmenu_updater_backdrop.png')))
    const font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    l.add(new ItemText(167, 117, font_14, 13, 'Hay actualizaciones disponibles.', [153, 0, 0], null, 265, 30, 2, 1))
    l.add(new ItemText(155, 137, font_14, 13, this.update_description, [0, 0, 0], null, 289, 129, 2, 2))
    l.add(new ItemText(167, 279, font_14, 13, 'Para instalarlas,\ndebe salir del juego.\n\nSu progreso quedará guardado.', [153, 0, 0], null, 265, 55, 2, 1))
    this.swapdetective_rollover_back_item = new ItemImage(0, 0, assets.load_image('p0_mainmenu_swap_selector_rollover.png'))
    this.swapdetective_rollover_back_item.set_visible(false)
    l.add(this.swapdetective_rollover_back_item)
    this.button(l, 221, 361, 'p0_mainmenu_btn_yes_normal.png', 'p0_mainmenu_btn_yes_rollover.png', this.updategame_yes_click)
    this.button(l, 303, 361, 'p0_mainmenu_btn_no_normal.png', 'p0_mainmenu_btn_no_rollover.png', this.updategame_no_click)
  }

  updategame_yes_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.stage.game.update_manager?.execute_update?.()
    this.close_updategame()
  }

  updategame_no_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.stage.game.updategame_dismissed = true
    this.close_updategame()
  }

  show_updategame() {
    this.set_up_updategame()
    this.stage.show_dialog(this.updategame_layer, this.updategame_handle_event)
    this.stage.blind_dialog(this.updategame_layer, BlindDirection.SHOW_DOWN, true, [])
  }

  close_updategame() {
    this.stage.blind_dialog(this.updategame_layer, BlindDirection.HIDE_UP, true, [], this.blind_close_updategame_callback)
  }

  blind_close_updategame_callback = (layer: Layer) => {
    this.stage.close_dialog(layer)
    if (!this.main_layer.items.includes(this.updategame_item)) {
      this.main_layer.add(this.updategame_item)
      animations.fade_in_item(this.updategame_item, 200)
    }
  }

  updategame_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_updategame()
    }
  }

  swapdetective_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.set_up_swapdetective()
    this.stage.show_dialog(this.swapdetective_layer, this.swapdetective_handle_event)
    this.stage.blind_dialog(this.swapdetective_layer, BlindDirection.SHOW_DOWN, true, [])
  }

  swapdetective_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_swapdetective()
    }
  }

  swapdetective_create_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.show_create(this.swapdetective_layer, true)
  }

  blind_show_create_callback = (_layer: Layer) => { this.set_create_name_focus() }

  set_create_name_focus() { this.create_name_item.begin_edit() }

  swapdetective_select_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.swapdetective_selected != null) {
      this.select_character(this.swapdetective_selected.charinfo)
      this.stage.blind_dialog(this.swapdetective_layer, BlindDirection.HIDE_UP, true, [], this.blind_close_swapdetective_callback)
    }
  }

  select_character(charinfo: any) {
    this.current_character = charinfo
    this.character_id.load_character(charinfo)
    this.update_play_button()
  }

  update_play_button() {
    if (this.overlay) {
      const back = this.should_back_to_game()
      this.backtogame_button.set_visible(back)
      this.play_button.set_visible(!back)
    }
  }

  swapdetective_delete_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.swapdetective_selected != null) {
      this.set_up_delete(this.swapdetective_selected.charinfo)
      this.stage.show_dialog(this.delete_layer, this.delete_handle_event, null)
      this.stage.blind_dialog(this.swapdetective_layer, BlindDirection.HIDE_DOWN, false, [])
      this.stage.blind_dialog(this.delete_layer, BlindDirection.SHOW_DOWN, false, [])
    }
  }

  swapdetective_back_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_swapdetective()
  }

  close_swapdetective() {
    this.stage.blind_dialog(this.swapdetective_layer, BlindDirection.HIDE_UP, true, [], this.blind_close_swapdetective_callback)
  }

  blind_close_swapdetective_callback = (layer: Layer) => { this.stage.close_dialog(layer) }

  create_name_keypressed(key: number) {
    this.update_create_accept()
    if (key === K.K_RETURN) {
      this.stage.render()
      this.click_sound.play()
      this.accept_create()
    }
  }

  update_create_accept() {
    const empty = this.create_name_item.get_text().trim() === ''
    this.accept_button.set_visible(!empty)
    this.accept_button_disabled.set_visible(empty)
  }

  create_previous_avatar_enter = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.rollover_sound.play()
    this.create_left_arrow_item.set_image(this.create_left_arrow_state === 0 ? this.left_arrow_rollover_image : this.left_arrow_clicked_image)
  }
  create_previous_avatar_leave = (_item: unknown, _args: unknown) => { this.create_left_arrow_item.set_image(this.left_arrow_normal_image) }
  create_previous_avatar_click = (item: any, _args: unknown) => {
    this.create_left_arrow_item.set_image(this.left_arrow_clicked_image)
    this.create_left_arrow_state = 1
    this.stage.capture_leftmousedown(item, this.create_previous_avatar_mousecapture)
  }
  create_previous_avatar_mousecapture = (_args: unknown, released: boolean) => {
    if (released) {
      this.create_left_arrow_state = 0
      if (this.stage.get_over_item() === this.create_left_arrow_item) {
        this.stage.render()
        this.create_flip_sound.play()
        if (this.create_avatar > 1) { this.create_avatar -= 1; this.update_create_avatar_image() }
        this.create_left_arrow_item.set_image(this.left_arrow_rollover_image)
      }
    }
  }

  create_next_avatar_enter = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.rollover_sound.play()
    this.create_right_arrow_item.set_image(this.create_right_arrow_state === 0 ? this.right_arrow_rollover_image : this.right_arrow_clicked_image)
  }
  create_next_avatar_leave = (_item: unknown, _args: unknown) => { this.create_right_arrow_item.set_image(this.right_arrow_normal_image) }
  create_next_avatar_click = (item: any, _args: unknown) => {
    this.create_right_arrow_item.set_image(this.right_arrow_clicked_image)
    this.create_right_arrow_state = 1
    this.stage.capture_leftmousedown(item, this.create_next_avatar_mousecapture)
  }
  create_next_avatar_mousecapture = (_args: unknown, released: boolean) => {
    if (released) {
      this.create_right_arrow_state = 0
      if (this.stage.get_over_item() === this.create_right_arrow_item) {
        this.stage.render()
        this.create_flip_sound.play()
        if (this.create_avatar < this.create_avatar_count) { this.create_avatar += 1; this.update_create_avatar_image() }
        this.create_right_arrow_item.set_image(this.right_arrow_rollover_image)
      }
    }
  }

  create_accept_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.accept_create()
  }

  accept_create() {
    let name = this.create_name_item.get_text().trim()
    if (name === '') {
      this.create_name_item.set_text('')
      this.create_name_item.begin_edit()
    } else if (this.create_character_location === '') this.show_state_list()
    else {
      name = characterid.apply_name_text_casing(name)
      const newchar = this.stage.game.datastore.create_character(name, this.create_sex_male, this.create_avatar, this.create_character_location, false)
      this.select_character(newchar)
      if (this.create_callback != null) this.create_callback()
      else if (this.create_background_layer != null) this.stage.blind_dialog(this.create_background_layer, BlindDirection.HIDE_UP, true, [], this.blind_accept_create_callback)
      else this.stage.blind_dialog(this.create_layer, BlindDirection.HIDE_UP, true, [], this.blind_accept_create_callback)
    }
  }

  blind_accept_create_callback = (_layer: Layer) => {
    this.stage.close_dialog(this.create_layer)
    if (this.create_background_layer != null) this.stage.close_dialog(this.create_background_layer)
    this.create_layer = null
    this.create_callback = null
    this.stage.update_mouse()
  }

  create_state_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.show_state_list()
  }

  show_state_list() {
    this.set_up_state_list()
    this.stage.show_dialog(this.state_list_layer, this.state_list_handle_event, null)
    this.stage.blind_dialog(this.state_list_layer, BlindDirection.SHOW_DOWN, false, [], null)
  }

  state_list_handle_event = (_e: PgEvent) => undefined

  create_department_enter = (item: any, _args: unknown) => {
    this.stage.stop_timer(STATE_ROLLOVER_TIMER_KEY)
    this.create_over_department = item
    this.stage.start_timer(STATE_ROLLOVER_TIMER_KEY, 50, (k: unknown, d: unknown) => this.show_department_rollover(k, d))
  }

  create_department_leave = (_item: unknown, _args: unknown) => {
    this.stage.stop_timer(STATE_ROLLOVER_TIMER_KEY)
    this.create_state_rollover_item.set_visible(false)
  }

  show_department_rollover(key: unknown, _data: unknown) {
    this.stage.stop_timer(key)
    this.stage.render()
    this.rollover_sound.play()
    this.create_state_rollover_item.set_top(this.create_over_department.get_top())
    this.create_state_rollover_item.set_visible(true)
  }

  create_department_click = (item: any, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.create_character_location = item.department.name
    this.character_state_item.set_text(item.department.name)
    animations.blind_layer(this.state_list_layer, BlindDirection.HIDE_DOWN, null, 450, this.blind_close_state_list_callback)
  }

  blind_close_state_list_callback = (_layer: Layer) => {
    this.stage.close_dialog(this.state_list_layer)
    this.state_list_layer = null
    this.stage.update_mouse()
  }

  create_male_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.create_sex_male = true
    this.create_avatar = 1
    this.update_create_sex_mark()
    this.update_create_avatar_image()
  }

  create_female_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.create_sex_male = false
    this.create_avatar = 1
    this.update_create_sex_mark()
    this.update_create_avatar_image()
  }

  create_cancel_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_create()
  }

  create_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN) {
      if (e.key === K.K_RETURN) {
        this.stage.render()
        this.click_sound.play()
        this.accept_create()
      } else if (e.key === K.K_ESCAPE) {
        this.stage.render()
        this.click_sound.play()
        this.close_create()
      }
    }
  }

  show_create(background_layer: Layer | null, apply_blind: boolean, callback: (() => void) | null = null, dark_background = false) {
    this.create_background_layer = background_layer
    this.create_callback = callback
    this.create_dark_background = dark_background
    this.set_up_create()
    if (dark_background) this.stage.show_dialog(this.create_layer, this.create_handle_event)
    else this.stage.show_dialog(this.create_layer, this.create_handle_event, null)
    if (apply_blind) {
      if (background_layer != null) this.stage.blind_dialog(background_layer, BlindDirection.HIDE_DOWN, false, [])
      this.stage.blind_dialog(this.create_layer, BlindDirection.SHOW_DOWN, dark_background, [], this.blind_show_create_callback)
    }
  }

  close_create() {
    if (this.create_background_layer != null) {
      this.create_background_layer.set_clip(null)
      animations.blind_layer(this.create_background_layer, BlindDirection.SHOW_DOWN, null, 450)
    }
    if (this.create_dark_background) this.stage.blind_dialog(this.create_layer, BlindDirection.HIDE_UP, true, [], this.blind_close_create_callback)
    else animations.blind_layer(this.create_layer!, BlindDirection.HIDE_DOWN, null, 450, this.blind_close_create_callback)
  }

  blind_close_create_callback = (_layer: Layer) => {
    this.stage.close_dialog(this.create_layer)
    this.create_layer = null
    this.create_callback = null
    this.stage.update_mouse()
  }

  delete_yes_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    const characters = this.stage.game.datastore.characters.slice()
    characters.sort(cmpKey((c: any) => this.get_character_name(c)))
    const selection_index = characters.indexOf(this.swapdetective_selected.charinfo)
    const new_selection_index = selection_index === 0 ? selection_index + 1 : selection_index - 1
    const new_selected_char = new_selection_index >= 0 && new_selection_index < characters.length ? characters[new_selection_index] : null
    const selected_character = this.swapdetective_selected.charinfo
    this.stage.game.datastore.delete_character(selected_character)
    this.select_character(new_selected_char)
    this.load_characters()
    this.stage.render()
    this.deleted_characters.push(selected_character.id)
    if (this.current_character === selected_character) {
      if (new_selected_char != null) {
        this.select_character(new_selected_char)
        this.current_character.active = true
        this.stage.game.datastore.save_characters()
      } else this.select_character(null)
    }
    this.swapdetective_layer.set_clip(null)
    animations.blind_layer(this.swapdetective_layer, BlindDirection.SHOW_DOWN, null, 450)
    animations.blind_layer(this.delete_layer, BlindDirection.HIDE_DOWN, null, 450, this.blind_close_delete_callback)
  }

  delete_no_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_delete()
  }

  delete_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_delete()
    }
  }

  close_delete() {
    this.swapdetective_layer.set_clip(null)
    animations.blind_layer(this.swapdetective_layer, BlindDirection.SHOW_DOWN, null, 450)
    animations.blind_layer(this.delete_layer, BlindDirection.HIDE_DOWN, null, 450, this.blind_close_delete_callback)
  }

  blind_close_delete_callback = (_layer: Layer) => {
    this.stage.close_dialog(this.delete_layer)
    this.delete_layer = null
    this.stage.update_mouse()
  }

  credits_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.set_up_credits()
    this.stage.show_dialog(this.credits_layer, this.credits_handle_event)
    this.load_current_credits(false)
    this.stage.blind_dialog(this.credits_layer, BlindDirection.SHOW_DOWN, true, [])
  }

  credits_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_credits()
    }
  }

  credits_close_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_credits()
  }

  close_credits() {
    this.stage.blind_dialog(this.credits_layer, BlindDirection.HIDE_UP, true, [], this.blind_close_credits_callback)
  }

  blind_close_credits_callback = (_layer: Layer) => { this.stage.close_dialog(this.credits_layer) }

  credits_next_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.credits_page < this.credits_pagecount) { this.credits_page += 1; this.load_current_credits() }
  }

  credits_prev_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.credits_page > 1) { this.credits_page -= 1; this.load_current_credits() }
  }

  play_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.should_back_to_game()) this.close_mainmenu()
    else if (this.current_character == null) this.show_create(null, true, () => this.start_game(), true)
    else this.start_game()
    this.deleted_characters = []
  }

  should_back_to_game() {
    const datastore = this.stage.game.datastore
    return this.overlay && datastore.user_character != null && this.current_character != null && datastore.user_character.charinfo.id === this.current_character.id && !this.deleted_characters.includes(this.current_character.id)
  }

  start_game() {
    if (this.current_character != null) {
      if (!this.overlay) this.stage.set_music_volume(0, 300)
      const black_layer = new Layer()
      black_layer.add(new ItemRect(0, 0, 600, 450))
      this.stage.add_layer(black_layer)
      animations.blind_layer(black_layer, BlindDirection.SHOW_DOWN, null, 450, this.blind_hide_main_callback)
    }
  }

  blind_hide_main_callback = (_layer: Layer) => {
    const datastore = this.stage.game.datastore
    if (!this.current_character.active) {
      for (const c of datastore.characters) c.active = false
      this.current_character.active = true
      datastore.save_characters()
    }
    this.load_character_progress()
    if (datastore.user_character_stage == null || datastore.user_character_stage === 'nc') {
      const case_generator = new serialization.CaseGenerator(datastore)
      datastore.user_character_progress.set_case(case_generator.new_case())
      this.stage.game.set_stage(new stagecase.CaseStage(this.stage.game))
    } else {
      const s = datastore.user_character_stage
      const loading_image = s === 'p2' ? 'p0_loading_slides_002.jpg' : s === 'p3' ? 'p0_loading_slides_003.jpg' : 'p0_loading_slides_001.jpg'
      this.stage.game.show_loading(this.show_loading_callback, loading_image)
    }
  }

  show_loading_callback = (_layer: Layer) => {
    const s = this.stage.game.datastore.user_character_stage
    let stage: any
    if (s === 'p1') stage = new phase0.Phase0Stage(this.stage.game, 1)
    else if (s === 'p2') stage = new phase0.Phase0Stage(this.stage.game, 2)
    else if (s === 'p3') stage = new phase0.Phase0Stage(this.stage.game, 3)
    else throw new Error('Unknown character current stage (' + s + ')')
    stage.save_state_on_next_load_phase = false
    this.stage.game.set_stage(stage)
    this.stage.game.hide_loading()
  }

  highscores_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    new merits.Merits(this.stage).show_highscores()
  }

  help_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    new help.Help(this.stage, true, true).show_help(1, true, false)
  }

  exit_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.set_up_exit()
    this.stage.show_dialog(this.exit_layer, this.exit_handle_event)
    this.stage.blind_dialog(this.exit_layer, BlindDirection.SHOW_DOWN, true, [])
  }

  // En la web no se puede cerrar el juego: "Salir" vuelve a la pantalla de inicio
  exit_yes_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.stage.game.stats.save_if_pending()
    this.stage.game.set_stage(new startscreen.StartScreenStage(this.stage.game))
  }

  exit_no_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_exit()
  }

  exit_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_exit()
    }
  }

  close_exit() {
    this.stage.blind_dialog(this.exit_layer, BlindDirection.HIDE_UP, true, [], this.blind_close_exit_callback)
  }

  blind_close_exit_callback = (_layer: Layer) => { this.stage.close_dialog(this.exit_layer) }

  handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE && this.overlay) {
      this.stage.render()
      this.click_sound.play()
      this.close_mainmenu()
      return true
    }
    return undefined
  }
}
