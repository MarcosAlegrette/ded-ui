// Port de game/stages/folder.py: la carpeta del caso (datos del caso, texto extendido,
// identikit con orden de arresto y testigos visitados).
import { Layer, ItemImage, ItemMask, ItemText, ItemEvent, KEYDOWN, K } from '../../framework/stage.ts'
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import type { Image, CustomSound } from '../../framework/assets.ts'
import type { Font } from '../../pg/font.ts'
import type { PgEvent } from '../../pg/events.ts'
import * as witness from './witness.ts'

export const CASE = 1
export const CASE_EXTENDED = 2
export const IDENTIKIT = 3
export const WITNESS = 4

class FolderThief {
  thief: any
  identikit_item_image: any = ''
  constructor(thief: any) { this.thief = thief }
}

class FolderWitness {
  witness: any
  image: any = ''
  name: any = ''
  location: any = ''
  department: any = ''
  underline: any = ''
  city: any = ''
  constructor(w: any) { this.witness = w }
}

export class Folder {
  static FolderThief = FolderThief
  static FolderWitness = FolderWitness

  stage: any
  base_layer = new Layer()
  folder_back_layer = new Layer()
  case_layer = new Layer()
  case_data_layer = new Layer()
  case_extended_layer = new Layer()
  identikit_layer = new Layer()
  identikit_thief_layer = new Layer()
  witness_layer = new Layer()
  witness_data_layer = new Layer()
  arrest_order_layer = new Layer()
  active_layer: number | string = ''
  arrest_order_is_working = false
  arrest_order_sent = false
  pending_changes_to_save = false
  identikit_loaded = false
  witness_loaded = false
  _right_identikit_selection = false

  font_15: Font; font_16: Font; font_17: Font; font_18: Font; font_20: Font; font_21: Font
  font_23: Font; font_22: Font; font_24: Font; font_25: Font
  click_sound: CustomSound; rollover_sound: CustomSound; popup_sound: CustomSound
  turn_page_sound: CustomSound; flip_option_sound: CustomSound; witness_fade_in_sound: CustomSound
  arrest_order_sent_sound!: CustomSound
  arrest_order_sound!: CustomSound

  // imágenes e ítems (se crean en los set_up_*)
  [k: string]: any

  constructor(stage: any) {
    this.stage = stage
    this.font_15 = assets.load_font('powdrft_.ttf', 15)
    this.font_16 = assets.load_font('powdrft_.ttf', 16)
    this.font_17 = assets.load_font('powdrft_.ttf', 17)
    this.font_18 = assets.load_font('powdrft_.ttf', 18)
    this.font_20 = assets.load_font('powdrft_.ttf', 20)
    this.font_21 = assets.load_font('powdrft_.ttf', 21)
    this.font_23 = assets.load_font('powdrft_.ttf', 23)
    this.font_22 = assets.load_font('powdrft_.ttf', 22)
    this.font_24 = assets.load_font('powdrft_.ttf', 24)
    this.font_25 = assets.load_font('powdrft_.ttf', 24)
    this.click_sound = stage.click_sound
    this.rollover_sound = stage.rollover_sound
    this.popup_sound = stage.witness_popup_sound
    this.turn_page_sound = assets.load_sound('GUI_Turn_Page.ogg')
    this.flip_option_sound = assets.load_sound('GUI_Flip.ogg')
    this.witness_fade_in_sound = assets.load_sound('fade.ogg')
    this.set_up_identikit()
    this.set_up_witness()
    this.set_up()
  }

  private get cp() { return this.stage.game.datastore.user_character_progress }

  set_up() {
    this.set_up_background()
    this.set_up_buttons()
    this.set_up_case_texts()
    this.set_up_case_extended_texts()
  }

  set_up_background() {
    this.folder_back_layer.add(new ItemImage(34, 39, assets.load_image('p0_folder_center.jpg'), null))
    this.folder_back_layer.add(new ItemImage(23, 16, assets.load_image('p0_folder_top.png'), null))
    this.folder_back_layer.add(new ItemImage(18, 387, assets.load_image('p0_folder_bottom.png'), null))
    this.folder_back_layer.add(new ItemImage(21, 39, assets.load_image('p0_folder_left.png'), null))
    this.folder_back_layer.add(new ItemImage(550, 39, assets.load_image('p0_folder_right.png'), null))
    this.case_image = assets.load_image('p0_folder_case1_back.png')
    this.case_data_image = assets.load_image('p0_folder_case2_back.png')
    this.case_background = new ItemImage(44, 72, this.case_image, null)
    this.case_data_background = new ItemImage(44, 116, this.case_data_image, null)
    this.case_layer.add(this.case_background)
    this.case_data_layer.add(this.case_data_background)
  }

  set_up_buttons() {
    this.set_up_menu_buttons()
    this.set_up_case_page_button()
    this.set_up_identikit_page_button()
    this.set_up_witness_page_button()
  }

  set_up_menu_buttons() {
    const close_button_image = assets.load_image('p0_button_close.png')
    this.close_button_rollover_image = assets.load_image('p0_button_close_rollover.png')
    this.next_button_image = assets.load_image('p0_button_next_active.png')
    const next_button_rollover_image = assets.load_image('p0_button_next_rollover.png')
    this.previous_button_image = assets.load_image('p0_button_previous_active.png')
    this.previous_button_rollover_image = assets.load_image('p0_button_previous_rollover.png')
    this.close_button = new ItemImage(275, 392, close_button_image, null)
    this.close_button.set_rollover_image(this.close_button_rollover_image, this.rollover_sound)
    this.next_button = new ItemImage(305, 392, this.next_button_image, null)
    this.previous_button = new ItemImage(245, 392, this.previous_button_image, null)
    this.next_button.set_rollover_image(next_button_rollover_image, this.rollover_sound)
    this.previous_button.set_rollover_image(this.previous_button_rollover_image, this.rollover_sound)
    this.close_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.next_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.previous_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.base_layer.add(this.close_button)
    this.base_layer.add(this.next_button)
    this.base_layer.add(this.previous_button)
  }

  set_up_case_page_button() {
    this.case_button_active_image = assets.load_image('p0_folder_btn_case_active.png')
    this.case_button_inactive_image = assets.load_image('p0_folder_btn_case_inactive.png')
    this.case_button_rollover_image = assets.load_image('p0_folder_btn_case_hovered.png')
    this.case_button = new ItemImage(538, 67, this.case_button_inactive_image, null)
    this.case_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.base_layer.add(this.case_button)
  }

  set_up_witness_page_button() {
    this.witness_button_active_image = assets.load_image('p0_folder_btn_witnesses_active.png')
    this.witness_button_inactive_image = assets.load_image('p0_folder_btn_witnesses_inactive.png')
    this.witness_button_rollover_image = assets.load_image('p0_folder_btn_witnesses_hovered.png')
    this.witness_button = new ItemImage(538, 249, this.witness_button_inactive_image, null)
    this.witness_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.base_layer.add(this.witness_button)
  }

  set_up_witness_texts() {
    this.witness_case_text = new ItemText(90, 154, this.font_16, 0, '', [157, 21, 21], null, 100, 20)
    this.witness_case_text.set_text(String(this.cp.case.number))
    this.witness_layer.add(this.witness_case_text)
  }

  set_up_witness_buttons() {
    this.witness_set_rollover_image = assets.load_image('p0_folder_witness_whiteback.png')
    this.witness_underline = assets.load_image('p0_folder_witness_underline.png')
    const size = this.witness_set_rollover_image.get_size()
    this.witness_sets = [new ItemMask(46, 204, size), new ItemMask(318, 107, size), new ItemMask(318, 234, size)]
    for (const m of this.witness_sets) m.add_event_handler(ItemEvent.CLICK, this.witness_button_click)
    for (const m of this.witness_sets) this.witness_data_layer.add(m)
  }

  set_up_identikit_page_button() {
    this.identikit_button_active_image = assets.load_image('p0_folder_btn_identikit_active.png')
    this.identikit_button_inactive_image = assets.load_image('p0_folder_btn_identikit_inactive.png')
    this.identikit_button_rollover_image = assets.load_image('p0_folder_btn_identikit_hovered.png')
    this.identikit_button = new ItemImage(538, 152, this.identikit_button_inactive_image, null)
    this.identikit_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.base_layer.add(this.identikit_button)
  }

  set_up_identikit_buttons() {
    const thief_close = assets.load_image('btn_testigo_x_normal.png')
    const thief_close_ro = assets.load_image('btn_testigo_x_rollover.png')
    this.thief_dialog_close_button = new ItemImage(425, 39, thief_close, null, true)
    this.thief_dialog_close_button.set_rollover_image(thief_close_ro, this.rollover_sound)
    const arrow_left_image = assets.load_image('p0_identikit_arrow_prev_standby.png')
    const arrow_left_image_rollover = (this.arrow_left_image_rollover = assets.load_image('p0_identikit_arrow_prev_hover.png'))
    const arrow_left_image_pressed = (this.arrow_left_image_pressed = assets.load_image('p0_identikit_arrow_prev_pressed.png'))
    const arrow_right_image = assets.load_image('p0_identikit_arrow_next_standby.png')
    const arrow_right_image_rollover = (this.arrow_right_image_rollover = assets.load_image('p0_identikit_arrow_next_hover.png'))
    const arrow_right_image_pressed = (this.arrow_right_image_pressed = assets.load_image('p0_identikit_arrow_next_pressed.png'))
    this.arrest_order_not_working_image = assets.load_image('p0_folder_identikit_orderbutton_inactive.png')
    this.arrest_order_issued_image = assets.load_image('p0_identikit_done_orderbutton.png')
    this.arrest_order_working_image = assets.load_image('p0_folder_identikit_orderbutton_active.png')
    this.arrest_order_working_rollover_image = assets.load_image('p0_folder_identikit_orderbutton_rollover.png')
    const ao_close = assets.load_image('p0_button_close.png')
    const ao_close_ro = assets.load_image('p0_button_close_rollover.png')
    const mk = (x: number, y: number, img: Image, ro: Image, pr: Image) => {
      const b = new ItemImage(x, y, img)
      b.set_rollover_image(ro, this.rollover_sound)
      b.set_pressed_image(pr)
      return b
    }
    this.sex_left_button = mk(42, 194, arrow_left_image, arrow_left_image_rollover, arrow_left_image_pressed)
    this.sex_right_button = mk(246, 194, arrow_right_image, arrow_right_image_rollover, arrow_right_image_pressed)
    this.height_left_button = mk(42, 239, arrow_left_image, arrow_left_image_rollover, arrow_left_image_pressed)
    this.height_right_button = mk(246, 239, arrow_right_image, arrow_right_image_rollover, arrow_right_image_pressed)
    this.hair_left_button = mk(42, 286, arrow_left_image, arrow_left_image_rollover, arrow_left_image_pressed)
    this.hair_right_button = mk(246, 286, arrow_right_image, arrow_right_image_rollover, arrow_right_image_pressed)
    this.distinctive_left_button = mk(42, 332, arrow_left_image, arrow_left_image_rollover, arrow_left_image_pressed)
    this.distinctive_right_button = mk(246, 332, arrow_right_image, arrow_right_image_rollover, arrow_right_image_pressed)
    this.arrest_order_box = new ItemImage(317, 296, this.arrest_order_not_working_image, null, true)
    this.arrest_order_button = new ItemMask(318, 316, [219, 39])
    this.arrest_order_dialog_close_button = new ItemImage(272, 305, ao_close, null, true)
    this.arrest_order_dialog_close_button.set_rollover_image(ao_close_ro, this.rollover_sound)
    this.thief_dialog_close_button.add_event_handler(ItemEvent.CLICK, this.identikit_new_dialog_click)
    for (const b of this.arrow_buttons()) b.add_event_handler(ItemEvent.CLICK, this.identikit_arrow_click)
    this.arrest_order_button.add_event_handler(ItemEvent.CLICK, this.identikit_new_dialog_click)
    this.arrest_order_dialog_close_button.add_event_handler(ItemEvent.CLICK, this.identikit_new_dialog_click)
    this.identikit_thief_layer.add(this.thief_dialog_close_button)
    for (const b of this.arrow_buttons()) this.identikit_layer.add(b)
    this.identikit_layer.add(this.arrest_order_button)
    this.identikit_layer.add(this.arrest_order_box)
    this.arrest_order_layer.add(this.arrest_order_dialog_close_button)
  }

  private arrow_buttons(): ItemImage[] {
    return [this.sex_left_button, this.sex_right_button, this.height_left_button, this.height_right_button,
      this.hair_left_button, this.hair_right_button, this.distinctive_left_button, this.distinctive_right_button]
  }

  set_up_identikit_texts() {
    this.identikit_case_text = new ItemText(90, 154, this.font_16, 0, '', [157, 21, 21], null, 100, 20)
    this.identikit_sex_text = new ItemText(99, 192, this.font_24, 0, '', [0, 0, 0], null, 110, 30, 2)
    this.identikit_height_text = new ItemText(99, 237, this.font_24, 0, '', [0, 0, 0], null, 110, 30, 2)
    this.identikit_hair_text = new ItemText(99, 284, this.font_24, 0, '', [0, 0, 0], null, 110, 30, 2)
    this.identikit_distinctive_text = new ItemText(99, 329, this.font_24, 0, '', [0, 0, 0], null, 110, 30, 2)
    this.identikit_thief_name = new ItemText(161, 210, this.font_24, 0, '', [157, 21, 21], null, 290, 30)
    this.identikit_thief_nickname = new ItemText(161, 229, this.font_23, 0, '', [51, 51, 51], null, 250, 30)
    this.identikit_thief_age = new ItemText(166, 248, this.font_18, 0, '', [102, 102, 102], null, 158, 25)
    this.identikit_thief_description = new ItemText(161, 270, this.font_18, 14, '', [0, 0, 0], null, 275, 132)
    this.arrest_order_name_text = new ItemText(163, 263, this.font_22, 0, '', [51, 51, 51], null, 267, 32, 2)
    this.arrest_order_nick_text = new ItemText(163, 280, this.font_20, 0, '', [102, 51, 51], null, 267, 30, 2)
    this.identikit_case_text.set_text(String(this.cp.case.number))
    this.identikit_layer.add(this.identikit_case_text)
    this.identikit_layer.add(this.identikit_sex_text)
    this.identikit_layer.add(this.identikit_height_text)
    this.identikit_layer.add(this.identikit_hair_text)
    this.identikit_layer.add(this.identikit_distinctive_text)
    this.identikit_thief_layer.add(this.identikit_thief_name)
    this.identikit_thief_layer.add(this.identikit_thief_age)
    this.identikit_thief_layer.add(this.identikit_thief_nickname)
    this.identikit_thief_layer.add(this.identikit_thief_description)
    this.arrest_order_layer.add(this.arrest_order_name_text)
    this.arrest_order_layer.add(this.arrest_order_nick_text)
  }

  set_up_case_texts() {
    const c = this.cp.case
    this.case_number_text = new ItemText(90, 154, this.font_16, 0, '', [157, 21, 21], null, 100, 20)
    this.case_agent_text = new ItemText(68, 192, this.font_18, 13, '', [0, 0, 0], null, 170, 50, 1, 2)
    this.case_department_text = new ItemText(138, 228, this.font_18, 0, '', [0, 0, 0], null, 115, 25)
    this.case_place_text = new ItemText(92, 251, this.font_17, 13, '', [0, 0, 0], null, 175, 95)
    this.case_number2_text = new ItemText(467, 111, this.font_16, 0, '', [157, 21, 21], null, 100, 25)
    this.case_stolen_obj_text = new ItemText(323, 149, this.font_17, 13, '', [0, 0, 0], null, 210, 95)
    this.case_time_text = new ItemText(376, 274, this.font_18, 0, '', [0, 0, 0], null, 225, 232)
    this.case_number_text.set_text(String(c.number))
    this.case_number2_text.set_text(String(c.number))
    this.case_department_text.set_text(c.crime_location.department.name)
    this.case_place_text.set_text(c.crime_location.name)
    const so: string = c.stolen_object.description1
    // Python str.capitalize(): primera en mayúscula y el resto en minúscula; luego se pega so[1:]
    this.case_stolen_obj_text.set_text(so[0].toUpperCase() + so.slice(1))
    const tl = c.get_time_limit()
    this.case_time_text.set_text(`Día ${tl[0]} a las ${tl[1]} hs.`)
    this.case_data_layer.add(this.case_number_text)
    this.case_data_layer.add(this.case_agent_text)
    this.case_data_layer.add(this.case_department_text)
    this.case_data_layer.add(this.case_place_text)
    this.case_data_layer.add(this.case_number2_text)
    this.case_data_layer.add(this.case_stolen_obj_text)
    this.case_data_layer.add(this.case_time_text)
  }

  set_up_case_extended_texts() {
    this.case_ext_number_text = new ItemText(90, 154, this.font_16, 0, '', [157, 21, 21], null, 100, 25)
    this.case_ext_text_left = new ItemText(45, 174, this.font_16, 12, '', [0, 0, 0], null, 228, 184)
    this.case_ext_text_right = new ItemText(320, 105, this.font_16, 12, '', [0, 0, 0], null, 228, 257)
    this.case_ext_number_text.set_text(String(this.cp.case.number))
    this.case_ext_text_left.break_text_into(this.case_ext_text_right)
    this.case_extended_layer.add(this.case_ext_number_text)
    this.case_extended_layer.add(this.case_ext_text_left)
    this.case_extended_layer.add(this.case_ext_text_right)
  }

  load_agent_name() {
    this.case_agent_text.set_text(this.stage.game.datastore.user_character.charinfo.name)
  }

  load_case_text() {
    const ds = this.stage.game.datastore
    this.case_ext_text_left.set_text(ds.user_character_progress.case.get_full_text(ds.user_character, ds.user_character_progress))
  }

  close_folder() {
    this.stage.close_dialog(this.base_layer)
    this.stage.folder_default_tab = this.active_layer
  }

  show_arrest_order_done_dialog() {
    this.arrest_order_layer.empty()
    this.arrest_order_sent_sound = assets.load_sound('GUI_arrest_order_sent.ogg')
    this.arrest_order_background.set_image(assets.load_image('p0_identikit_arrest_order_done_background.png'))
    this.arrest_order_background.set_lefttop(109, 75)
    this.arrest_order_layer.add(this.arrest_order_background)
    this.arrest_order_thief_image.set_lefttop(261, 202)
    this.arrest_order_layer.add(this.arrest_order_thief_image)
    this.arrest_order_name_text.set_lefttop(163, 263)
    this.arrest_order_nick_text.set_lefttop(163, 280)
    this.arrest_order_layer.add(this.arrest_order_name_text)
    this.arrest_order_layer.add(this.arrest_order_nick_text)
    this.arrest_order_layer.add(this.arrest_order_dialog_close_button)
    this.obsure_folder_close()
    this.stage.show_dialog(this.arrest_order_layer, this.arrest_order_handle_event, undefined, undefined, this.clarify_folder_close)
    this.stage.render()
    this.arrest_order_sent_sound.play()
  }

  set_up_arrest_order_dialog() {
    this.arrest_order_layer.empty()
    this.arrest_order_sound = assets.load_sound('GUI_arrest_order.ogg')
    this.arrest_order_background.set_image(assets.load_image('p0_identikit_arrest_order_warning_background.png'))
    this.arrest_order_background.set_lefttop(119, 36)
    this.arrest_order_layer.add(this.arrest_order_background)
    this.arrest_order_thief_image.set_lefttop(272, 177)
    this.arrest_order_layer.add(this.arrest_order_thief_image)
    this.arrest_order_name_text.set_lefttop(168, 237)
    this.arrest_order_nick_text.set_lefttop(168, 254)
    this.arrest_order_layer.add(this.arrest_order_name_text)
    this.arrest_order_layer.add(this.arrest_order_nick_text)
    const acc = assets.load_image('p0_identikit_arrest_order_btn_acept_normal.png')
    const acc_ro = assets.load_image('p0_identikit_arrest_order_btn_acept_rollover.png')
    const can = assets.load_image('p0_identikit_arrest_order_btn_cancel_normal.png')
    const can_ro = assets.load_image('p0_identikit_arrest_order_btn_cancel_rollover.png')
    this.arrest_order_dialog_accept_button = new ItemImage(204, 296, acc, null, true)
    this.arrest_order_dialog_accept_button.set_rollover_image(acc_ro, this.rollover_sound)
    this.arrest_order_dialog_cancel_button = new ItemImage(313, 296, can, null, true)
    this.arrest_order_dialog_cancel_button.set_rollover_image(can_ro, this.rollover_sound)
    this.arrest_order_dialog_accept_button.add_event_handler(ItemEvent.CLICK, this.identikit_new_dialog_click)
    this.arrest_order_layer.add(this.arrest_order_dialog_accept_button)
    this.arrest_order_dialog_cancel_button.add_event_handler(ItemEvent.CLICK, this.identikit_new_dialog_click)
    this.arrest_order_layer.add(this.arrest_order_dialog_cancel_button)
  }

  load_identikit_data() {
    this.get_list_identikit()
    this.identikit_image_matrix = Array.from({ length: 9 }, () => '')
    this.circle_outlined_image = new ItemImage(325, 110, assets.load_image('p0_folder_identikit_suspect_selected.png'), null)
    this.arrest_order_thief_image = new ItemImage(261, 202, null, null)
    this.arrest_order_layer.add(this.arrest_order_thief_image)
    this.selected_sex_feature = 0
    this.selected_height_feature = 0
    this.selected_hair_feature = 0
    this.selected_distinctive_feature = 0
    this.list_sex_features = ['-', 'Hombre', 'Mujer']
    this.list_height_features_male = ['-', 'Alto', 'Bajo']
    this.list_height_features_female = ['-', 'Alta', 'Baja']
    this.list_hair_features = ['-', 'Morocho', 'Rubio', 'Pelirrojo', 'Canoso']
    this.list_distinctive_features = ['-', 'Cicatriz', 'Tatuaje', 'Lentes', 'Lunar']
    this.identikit_sex_text.set_text(this.list_sex_features[0])
    this.identikit_height_text.set_text(this.list_sex_features[0])
    this.identikit_hair_text.set_text(this.list_hair_features[0])
    this.identikit_distinctive_text.set_text(this.list_distinctive_features[0])
  }

  set_up_identikit_background() {
    this.identikit_image = assets.load_image('p0_folder_identikit_back.png')
    this.identikit_thief_background_image = assets.load_image('p0_folder_identikit_suspect_popup_back.png')
    this.identikit_background = new ItemImage(44, 72, this.identikit_image, null)
    this.identikit_thief_background = new ItemImage(128, 8, this.identikit_thief_background_image, null)
    this.identikit_thief_image = new ItemImage(160, 37, null, null)
    this.identikit_thief_image_side = new ItemImage(292, 37, null, null)
    this.arrest_order_background = new ItemImage(109, 75, null, null)
    this.identikit_layer.add(this.identikit_background)
    this.identikit_thief_layer.add(this.identikit_thief_background)
    this.identikit_thief_layer.add(this.identikit_thief_image)
    this.identikit_thief_layer.add(this.identikit_thief_image_side)
    this.arrest_order_layer.add(this.arrest_order_background)
  }

  set_up_witness_background() {
    this.witness_image = assets.load_image('p0_folder_witness_back.png')
    this.witness_background = new ItemImage(44, 72, this.witness_image, null)
    this.witness_layer.add(this.witness_background)
  }

  private selected_folder_thief() { return this.list_identikit_thieves[this.identikit_image_matrix.indexOf('')] }

  identikit_arrest_order_sent() {
    if (!this.arrest_order_sent) {
      this.arrest_order_sent = true
      this.identikit_layer.add(new ItemImage(48, 49, assets.load_image('p0_identikit_done_back_center.jpg')))
      this.identikit_layer.add(new ItemImage(30, 27, assets.load_image('p0_identikit_done_back_top.png')))
      this.identikit_layer.add(new ItemImage(33, 373, assets.load_image('p0_identikit_done_back_bottom.png')))
      this.identikit_layer.add(new ItemImage(28, 49, assets.load_image('p0_identikit_done_back_left.png')))
      this.identikit_layer.add(new ItemImage(276, 49, assets.load_image('p0_identikit_done_back_right.png')))
      this.arrest_order_thief_image = new ItemImage(93, 127, null, null)
      const stamp = new ItemImage(182, 128, assets.load_image('p0_identikit_done_overstamp.png'))
      const arrest_order_name_text = new ItemText(58, 313, this.font_24, 16, '', [31, 31, 31], null, 207, 33, 2, 2)
      const arrest_order_nick_text = new ItemText(28, 344, this.font_20, 0, '', [102, 51, 51], null, 267, -1, 2, 2)
      const c = this.cp.case
      if (c.arrest_order_thief == null) {
        const ft = this.selected_folder_thief()
        c.arrest_order_thief = ft.thief
        this.arrest_order_thief_image.set_image(assets.load_image(ft.thief.identikit_large_image_front))
        arrest_order_name_text.set_text(ft.thief.name)
        arrest_order_nick_text.set_text(ft.thief.nickname)
      } else {
        const t = c.arrest_order_thief
        this.arrest_order_thief_image.set_image(assets.load_image(t.identikit_large_image_front))
        arrest_order_name_text.set_text(t.name)
        arrest_order_nick_text.set_text(t.nickname)
      }
      this.arrest_order_thief_image.add_event_handler(ItemEvent.CLICK, this.identikit_button_click)
      this.disable_thieves()
      this.identikit_layer.add(this.arrest_order_thief_image)
      this.identikit_layer.add(arrest_order_name_text)
      this.identikit_layer.add(arrest_order_nick_text)
      this.identikit_layer.add(stamp)
      for (const b of this.arrow_buttons()) this.identikit_layer.remove(b)
      this.identikit_layer.remove(this.arrest_order_button)
      this.arrest_order_box.set_image(this.arrest_order_issued_image)
    }
  }

  identikit_new_dialog_click = (item: any, _args: any) => {
    if (item === this.arrest_order_button && this.arrest_order_is_working) {
      const ft = this.selected_folder_thief()
      this.arrest_order_name_text.set_text(ft.thief.name)
      this.arrest_order_nick_text.set_text(ft.thief.nickname)
      this.arrest_order_thief_image.set_image(ft.identikit_item_image.get_image())
      this.set_up_arrest_order_dialog()
      this.obsure_folder_close()
      this.stage.show_dialog(this.arrest_order_layer, this.arrest_order_confirm_handle_event, undefined, undefined, this.clarify_folder_close)
      this.stage.render()
      this.arrest_order_sound.play()
    } else if (item === this.arrest_order_dialog_close_button) {
      this.stage.render()
      this.click_sound.play()
      this.close_arrest_order()
    } else if (item === this.thief_dialog_close_button) {
      this.stage.render()
      this.click_sound.play()
      this.close_identikit_thief()
    } else if (item === this.arrest_order_dialog_cancel_button) {
      this.stage.render()
      this.click_sound.play()
      this.cancel_arrest_order()
    } else if (item === this.arrest_order_dialog_accept_button) {
      this.stage.render()
      this.click_sound.play()
      this.stage.close_dialog(this.arrest_order_layer)
      this.show_arrest_order_done_dialog()
      this.identikit_arrest_order_sent()
      this.stage.render()
      this.stage.save_progress(false)
    }
  }

  identikit_thief_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_identikit_thief()
    }
  }

  close_identikit_thief() {
    this.identikit_thief_image.set_image(null)
    this.identikit_thief_image_side.set_image(null)
    this.stage.close_dialog(this.identikit_thief_layer)
  }

  arrest_order_confirm_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.cancel_arrest_order()
    }
  }

  cancel_arrest_order() { this.stage.close_dialog(this.arrest_order_layer) }

  arrest_order_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_arrest_order()
    }
  }

  close_arrest_order() {
    this.stage.close_dialog(this.arrest_order_layer)
    const cp = this.cp
    if (!cp.identikit_help) {
      this.obsure_folder_close()
      this.stage.show_help_dialog(101, 1000, null, this.clarify_folder_close)
      cp.identikit_help = true
    }
  }

  button_click = (item: any, _args: any) => {
    if (item === this.close_button) {
      if (this.pending_changes_to_save) {
        this.stage.save_progress(false)
        this.pending_changes_to_save = false
      }
      this.stage.render()
      this.click_sound.play()
      this.close_folder()
    } else if (item === this.next_button) {
      if (this.active_layer === 1) this.update_active_layer(2)
    } else if (item === this.previous_button) {
      if (this.active_layer === 2) this.update_active_layer(1)
    } else if (item === this.case_button && this.active_layer !== CASE && this.active_layer !== CASE_EXTENDED) this.update_active_layer(CASE)
    else if (item === this.identikit_button && this.active_layer !== IDENTIKIT) this.update_active_layer(IDENTIKIT)
    else if (item === this.witness_button && this.active_layer !== WITNESS) this.update_active_layer(WITNESS)
  }

  select_witnesses() {
    if (this.active_layer !== WITNESS) this.update_active_layer(WITNESS)
  }

  private show_thief_popup(thief: any) {
    this.identikit_thief_image.set_image(assets.load_image(thief.identikit_large_image_front))
    this.identikit_thief_image_side.set_image(assets.load_image(thief.identikit_large_image_side))
    this.identikit_thief_name.set_text(thief.name)
    this.identikit_thief_nickname.set_text(thief.nickname)
    this.identikit_thief_age.set_text(thief.age)
    this.identikit_thief_description.set_text(thief.description)
    this.obsure_folder_close()
    this.stage.show_dialog(this.identikit_thief_layer, this.identikit_thief_handle_event, undefined, undefined, this.clarify_folder_close)
    this.stage.render()
    this.popup_sound.play()
  }

  identikit_button_click = (item: any, _args: any) => {
    const c = this.cp.case
    if (c.arrest_order_thief == null) {
      if (this.identikit_layer.contains(item)) {
        for (const ft of this.list_identikit_thieves) {
          if (item === ft.identikit_item_image) this.show_thief_popup(ft.thief)
        }
      }
    } else if (item === this.arrest_order_thief_image) {
      this.show_thief_popup(c.arrest_order_thief)
    }
  }

  witness_button_click = (item: any, _args: any) => {
    const i = this.witness_sets.indexOf(item)
    if (i >= 0) {
      const witnesses = this.cp.case.list_visited_witnesses
      if (i < witnesses.length) {
        this.obsure_folder_close()
        this.witness_dialog.show_witness(witnesses[i], this.clarify_folder_close)
        this.stage.render()
        this.popup_sound.play()
      }
    }
  }

  obsure_folder_close() { this.close_button.set_alpha(80) }
  clarify_folder_close = () => { this.close_button.set_alpha(255) }

  identikit_arrow_click = (item: any, _args: any) => {
    const last_sex_choice = this.selected_sex_feature
    const cycle = (cur: number, max: number, left: any, right: any) => {
      if (cur > 0 && item === left) return cur - 1
      if (cur < max && item === right) return cur + 1
      if (cur === 0 && item === left) return max
      if (cur === max && item === right) return 0
      return cur
    }
    if (item === this.sex_left_button || item === this.sex_right_button)
      this.selected_sex_feature = cycle(this.selected_sex_feature, this.list_sex_features.length - 1, this.sex_left_button, this.sex_right_button)
    if (item === this.height_left_button || item === this.height_right_button)
      this.selected_height_feature = cycle(this.selected_height_feature, this.list_height_features_male.length - 1, this.height_left_button, this.height_right_button)
    if (item === this.hair_left_button || item === this.hair_right_button)
      this.selected_hair_feature = cycle(this.selected_hair_feature, this.list_hair_features.length - 1, this.hair_left_button, this.hair_right_button)
    if (item === this.distinctive_left_button || item === this.distinctive_right_button)
      this.selected_distinctive_feature = cycle(this.selected_distinctive_feature, this.list_distinctive_features.length - 1, this.distinctive_left_button, this.distinctive_right_button)
    this.update_identikit(last_sex_choice)
    this.stage.render()
    this.flip_option_sound.play()
    const c = this.cp.case
    c.list_selected_features = [this.selected_sex_feature, this.selected_height_feature, this.selected_hair_feature, this.selected_distinctive_feature]
    this.mark_pending_changes_to_save(true)
  }

  update_identikit(last_sex_choice: number) {
    this.identikit_sex_text.set_text(this.list_sex_features[this.selected_sex_feature])
    this.identikit_hair_text.set_text(this.list_hair_features[this.selected_hair_feature])
    this.identikit_distinctive_text.set_text(this.list_distinctive_features[this.selected_distinctive_feature])
    const s = this.selected_sex_feature
    if (s === 1 || (last_sex_choice === 1 && s === 0) || (last_sex_choice === 0 && s === 0))
      this.identikit_height_text.set_text(this.list_height_features_male[this.selected_height_feature])
    else if (s === 2 || (last_sex_choice === 2 && s === 0))
      this.identikit_height_text.set_text(this.list_height_features_female[this.selected_height_feature])
    const t = this.cp.case.thief
    this._right_identikit_selection = s === t.sex && this.selected_height_feature === t.height && this.selected_distinctive_feature === t.distinctive_feature && this.selected_hair_feature === t.hair
    this.update_images()
  }

  load_witnesses_data() {
    const c = this.cp.case
    const l = c.list_visited_witnesses
    const folder_witnesses = c.list_folder_witnesses
    let play_sound = true
    let i = 0
    for (const w of l) {
      if (!w.identikit_added) {
        w.identikit_added = true
        const fw = new FolderWitness(w)
        const ws = this.witness_sets[i]
        fw.image = new ItemImage(ws.get_left() + 8, ws.get_top() + 9, assets.load_image(fw.witness.image), null)
        fw.underline = new ItemImage(ws.get_left() + 8, ws.get_top() + 78, this.witness_underline, null)
        fw.name = new ItemText(ws.get_left() + 9, ws.get_top() + 61, this.font_22, 0, fw.witness.name, [157, 21, 21], null, 200, 30)
        fw.city = new ItemText(ws.get_left() + 9, ws.get_top() + 84, this.font_18, 10, fw.witness.city.name, [51, 51, 51], null, 200, 30)
        fw.department = new ItemText(ws.get_left() + 9, ws.get_top() + 98, this.font_20, 0, fw.witness.department.name, [102, 102, 102], null, 200, 30)
        this.witness_data_layer.add(fw.image)
        this.witness_data_layer.add(fw.underline)
        this.witness_data_layer.add(fw.name)
        this.witness_data_layer.add(fw.department)
        this.witness_data_layer.add(fw.city)
        ws.set_rollover(this.witness_set_rollover_image, this.rollover_sound)
        if (!folder_witnesses.includes(w)) {
          animations.fade_in_item(fw.image)
          if (play_sound) {
            play_sound = false
            this.stage.render()
            this.witness_fade_in_sound.play()
          }
          folder_witnesses.push(w)
          this.mark_pending_changes_to_save(false)
        }
      }
      i += 1
      if (i >= 3) break
    }
  }

  get_list_identikit() {
    this.list_identikit_thieves = []
    this.list_identikit_crosses = []
    const cross_back = assets.load_image('p0_folder_identikit_suspect_crossed.png')
    const thief_rollover = assets.load_image('p0_thieves_small_rollovershadow.png')
    const c = this.cp.case
    let x = 325
    let y = 110
    for (let i = 0; i < 3; i++) {
      for (let z = 0; z < 3; z++) {
        const pos = z + i + (i + i)
        const ft = new FolderThief(c.list_thieves[pos])
        ft.identikit_item_image = new ItemImage(x, y, assets.load_image(ft.thief.identikit_image), null)
        this.list_identikit_thieves.push(ft)
        this.identikit_layer.add(ft.identikit_item_image)
        const it = this.list_identikit_thieves[pos].identikit_item_image
        this.list_identikit_crosses.push(new ItemImage(it.get_left(), it.get_top(), cross_back, null))
        it.add_event_handler(ItemEvent.CLICK, this.identikit_button_click)
        if (c.arrest_order_thief == null) it.set_rollover(thief_rollover, this.rollover_sound)
        x += 70
      }
      x = 325
      y += 65
    }
  }

  update_images() {
    this.clean_identikit()
    const sex = this.selected_sex_feature
    const height = this.selected_height_feature
    const hair = this.selected_hair_feature
    const df = this.selected_distinctive_feature
    for (let i = 0; i < 9; i++) {
      const t = this.list_identikit_thieves[i].thief
      if ((t.sex !== sex && sex !== 0) || (t.height !== height && height !== 0) || (t.hair !== hair && hair !== 0) || (t.distinctive_feature !== df && df !== 0)) {
        if (!this.identikit_layer.contains(this.list_identikit_crosses[i])) {
          this.identikit_layer.add(this.list_identikit_crosses[i])
          this.identikit_image_matrix[i] = 'x'
        }
      }
    }
    if (this.identikit_image_matrix.filter((v: string) => v === 'x').length === 8) {
      this.arrest_order_box.set_image(this.arrest_order_working_image)
      this.arrest_order_button.set_rollover(this.arrest_order_working_rollover_image, this.rollover_sound, -1, -20)
      this.arrest_order_is_working = true
      this.set_circle_outlined_image(this.identikit_image_matrix.indexOf(''))
      this.identikit_layer.add(this.circle_outlined_image)
    } else {
      this.arrest_order_box.set_image(this.arrest_order_not_working_image)
      this.arrest_order_button.set_rollover(null, null)
      this.arrest_order_is_working = false
    }
  }

  set_circle_outlined_image(position: number) {
    if (position === 0 || position === 3 || position === 6) this.circle_outlined_image.set_left(325)
    else if (position === 1 || position === 4 || position === 7) this.circle_outlined_image.set_left(395)
    else if (position === 2 || position === 5 || position === 8) this.circle_outlined_image.set_left(465)
    if (position >= 0 && position <= 2) this.circle_outlined_image.set_top(110)
    else if (position >= 3 && position <= 5) this.circle_outlined_image.set_top(175)
    else if (position >= 6 && position <= 8) this.circle_outlined_image.set_top(240)
  }

  clean_identikit() {
    if (this.identikit_layer.contains(this.circle_outlined_image)) this.identikit_layer.remove(this.circle_outlined_image)
    for (const item of this.list_identikit_crosses) this.identikit_layer.remove(item)
    this.identikit_image_matrix = Array.from({ length: 9 }, () => '')
  }

  set_up_identikit() {
    this.set_up_identikit_background()
    this.set_up_identikit_texts()
    this.set_up_identikit_buttons()
    this.load_identikit_data()
    this.set_up_arrest_order_dialog()
    this.identikit_loaded = true
  }

  set_up_witness() {
    this.witness_dialog = new witness.Witness(this.stage)
    this.set_up_witness_background()
    this.set_up_witness_texts()
    this.set_up_witness_buttons()
    this.witness_loaded = true
  }

  mark_pending_changes_to_save(save_timer: boolean) {
    this.pending_changes_to_save = true
    if (save_timer) {
      const key = 'save_folder_pending_changes'
      this.stage.stop_timer(key)
      this.stage.start_timer(key, 1000, this.on_save_pending_changes)
    }
  }

  on_save_pending_changes = (key: unknown, _data: unknown) => {
    this.stage.stop_timer(key)
    if (this.pending_changes_to_save) {
      this.stage.save_progress(false)
      this.pending_changes_to_save = false
    }
  }

  private set_tabs(active: 'case' | 'identikit' | 'witness') {
    const tabs: ['case' | 'identikit' | 'witness', ItemImage, Image, Image, Image][] = [
      ['case', this.case_button, this.case_button_active_image, this.case_button_inactive_image, this.case_button_rollover_image],
      ['identikit', this.identikit_button, this.identikit_button_active_image, this.identikit_button_inactive_image, this.identikit_button_rollover_image],
      ['witness', this.witness_button, this.witness_button_active_image, this.witness_button_inactive_image, this.witness_button_rollover_image],
    ]
    // mismo orden de llamadas que el original: set_image y luego set_rollover_image
    for (const [name, button, act, inact, ro] of tabs) {
      if (name === active) { button.set_image(act); button.set_rollover_image(null, null) }
      else { button.set_image(inact); button.set_rollover_image(ro, this.rollover_sound) }
    }
  }

  update_active_layer(layer: number) {
    this.clean_screen()
    if (this.pending_changes_to_save) {
      this.stage.save_progress(false)
      this.pending_changes_to_save = false
    }
    if (layer === CASE) {
      this.active_layer = CASE
      this.stage.add_layer(this.case_layer)
      this.stage.add_layer(this.case_data_layer)
      this.set_tabs('case')
      this.next_button.set_visible(true)
      this.previous_button.set_visible(false)
      this.load_agent_name()
    } else if (layer === CASE_EXTENDED) {
      this.active_layer = CASE_EXTENDED
      this.stage.add_layer(this.case_layer)
      this.stage.add_layer(this.case_extended_layer)
      this.set_tabs('case')
      this.next_button.set_visible(false)
      this.previous_button.set_visible(true)
      this.load_case_text()
    } else if (layer === IDENTIKIT) {
      if (!this.identikit_loaded) this.set_up_identikit()
      this.active_layer = IDENTIKIT
      this.stage.add_layer(this.identikit_layer)
      this.set_tabs('identikit')
      this.next_button.set_visible(false)
      this.previous_button.set_visible(false)
      const c = this.cp.case
      this.selected_sex_feature = c.list_selected_features[0]
      this.selected_height_feature = c.list_selected_features[1]
      this.selected_hair_feature = c.list_selected_features[2]
      this.selected_distinctive_feature = c.list_selected_features[3]
      this.update_identikit(this.selected_sex_feature)
      if (c.arrest_order_thief != null) this.identikit_arrest_order_sent()
    } else if (layer === WITNESS) {
      if (!this.witness_loaded) this.set_up_witness()
      this.active_layer = WITNESS
      this.stage.add_layer(this.witness_layer)
      this.stage.add_layer(this.witness_data_layer)
      this.set_tabs('witness')
      this.next_button.set_visible(false)
      this.previous_button.set_visible(false)
      this.load_witnesses_data()
    }
    this.stage.render()
    this.turn_page_sound.play()
  }

  disable_identikit_tab() { this.identikit_button.set_rollover_image(null, null); this.identikit_button.remove_event_handler(ItemEvent.CLICK, this.button_click) }
  disable_case_tab() { this.case_button.set_rollover_image(null, null); this.case_button.remove_event_handler(ItemEvent.CLICK, this.button_click) }
  disable_witness_tab() { this.witness_button.set_rollover_image(null, null); this.witness_button.remove_event_handler(ItemEvent.CLICK, this.button_click) }
  disable_close_button() { this.close_button.set_rollover_image(null, null); this.close_button.remove_event_handler(ItemEvent.CLICK, this.button_click) }
  disable_previous_button() { this.previous_button.set_rollover_image(null, null); this.previous_button.remove_event_handler(ItemEvent.CLICK, this.button_click) }
  enable_identikit_tab() { this.identikit_button.set_rollover_image(this.identikit_button_rollover_image, this.rollover_sound); this.identikit_button.add_event_handler(ItemEvent.CLICK, this.button_click) }
  enable_case_tab() { this.case_button.set_rollover_image(this.case_button_rollover_image, this.rollover_sound); this.case_button.add_event_handler(ItemEvent.CLICK, this.button_click) }
  enable_witness_tab() { this.witness_button.set_rollover_image(this.witness_button_rollover_image, this.rollover_sound); this.witness_button.add_event_handler(ItemEvent.CLICK, this.button_click) }
  enable_close_button() { this.close_button.set_rollover_image(this.close_button_rollover_image, this.rollover_sound); this.close_button.add_event_handler(ItemEvent.CLICK, this.button_click) }
  enable_previous_button() { this.previous_button.set_rollover_image(this.previous_button_rollover_image, this.rollover_sound); this.previous_button.add_event_handler(ItemEvent.CLICK, this.button_click) }

  private disable_pair(l: ItemImage, r: ItemImage) {
    for (const b of [l, r]) {
      b.set_rollover_image(null, null)
      b.remove_event_handler(ItemEvent.CLICK, this.identikit_arrow_click)
      b.set_pressed_image(null)
    }
  }
  private enable_pair(l: ItemImage, r: ItemImage) {
    l.set_rollover_image(this.arrow_left_image_rollover, this.rollover_sound)
    l.add_event_handler(ItemEvent.CLICK, this.identikit_arrow_click)
    l.set_pressed_image(this.arrow_left_image_pressed)
    r.set_rollover_image(this.arrow_right_image_rollover, this.rollover_sound)
    r.add_event_handler(ItemEvent.CLICK, this.identikit_arrow_click)
    r.set_pressed_image(this.arrow_right_image_pressed)
  }
  disable_hair_buttons() { this.disable_pair(this.hair_left_button, this.hair_right_button) }
  disable_sex_buttons() { this.disable_pair(this.sex_left_button, this.sex_right_button) }
  disable_distinctive_buttons() { this.disable_pair(this.distinctive_left_button, this.distinctive_right_button) }
  disable_height_buttons() { this.disable_pair(this.height_left_button, this.height_right_button) }
  enable_hair_buttons() { this.disable_hair_buttons(); this.enable_pair(this.hair_left_button, this.hair_right_button) }
  enable_sex_buttons() { this.disable_sex_buttons(); this.enable_pair(this.sex_left_button, this.sex_right_button) }
  enable_height_buttons() { this.disable_height_buttons(); this.enable_pair(this.height_left_button, this.height_right_button) }
  enable_distinctive_buttons() { this.disable_distinctive_buttons(); this.enable_pair(this.distinctive_left_button, this.distinctive_right_button) }

  disable_thieves() {
    for (const t of this.list_identikit_thieves) {
      t.identikit_item_image.remove_event_handler(ItemEvent.CLICK, this.identikit_button_click)
      t.identikit_item_image.set_rollover(null, null)
    }
  }

  clean_screen() {
    if (this.active_layer === CASE) { this.stage.remove_layer(this.case_layer); this.stage.remove_layer(this.case_data_layer) }
    else if (this.active_layer === CASE_EXTENDED) { this.stage.remove_layer(this.case_layer); this.stage.remove_layer(this.case_extended_layer) }
    else if (this.active_layer === IDENTIKIT) this.stage.remove_layer(this.identikit_layer)
    else if (this.active_layer === WITNESS) { this.stage.remove_layer(this.witness_layer); this.stage.remove_layer(this.witness_data_layer) }
  }

  add_start_layer(start_page = CASE) {
    this.stage.add_layer(this.folder_back_layer)
    this.update_active_layer(start_page)
  }
}
