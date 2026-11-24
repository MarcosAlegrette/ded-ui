// Port de game/stages/merits.py (méritos: puntaje, medallas y récords)
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import * as text from '../../framework/text.ts'
import { Layer, ItemImage, ItemText, ItemEvent, KEYDOWN, K } from '../../framework/stage.ts'
import * as characterid from './characterid.ts'
import type { PgEvent } from '../../pg/events.ts'

export const MEDALS_DATA: Record<string, [number, number, string, number | null]> = {
  artigas: [97, 123, 'ARTIGAS', 1],
  canelones: [143, 123, 'CANELONES', 3],
  cerrolargo: [190, 123, 'CERRO LARGO', null],
  colonia: [236, 123, 'COLONIA', 3],
  durazno: [282, 123, 'DURAZNO', null],
  flores: [328, 123, 'FLORES', 3],
  florida: [375, 123, 'FLORIDA', null],
  lavalleja: [421, 123, 'LAVALLEJA', 1],
  maldonado: [467, 123, 'MALDONADO', 2],
  montevideo: [76, 202, 'MONTEVIDEO', 2],
  paysandu: [123, 202, 'PAYSANDÚ', 2],
  rionegro: [170, 202, 'RÍO NEGRO', 2],
  rivera: [218, 202, 'RIVERA', 1],
  rocha: [265, 202, 'ROCHA', 1],
  salto: [312, 202, 'SALTO', null],
  sanjose: [359, 202, 'SAN JOSÉ', 1],
  soriano: [407, 202, 'SORIANO', 3],
  tacuarembo: [454, 202, 'TACUAREMBÓ', 2],
  treintaytres: [501, 202, 'TREINTA Y TRES', 2],
}

const GOLD = [255, 212, 12]

export class Merits {
  stage: any
  main_layer = new Layer()
  medals_layer: Layer | null = null
  highscores_layer: Layer | null = null
  medal_popup_layer: Layer | null = null
  rollover_sound: any
  click_sound: any
  common_loaded = false
  back_standby_image: any
  back_rollover_image: any
  characterid: any
  generic_backglow_image: any
  medal_rollover_item!: ItemImage
  medal_text_items!: [ItemText, ItemText]
  ribbon_item!: ItemImage
  base_item!: ItemImage
  tab_item!: ItemImage
  big_medal_item!: ItemImage
  big_name_items!: [ItemText, ItemText]
  highscore_font: any
  highscores_left_up_image: any
  highscores_left_rollover_image: any
  highscores_left_center_image: any
  highscores_left_down_image: any
  highscores_right_up_image: any
  highscores_right_rollover_image: any
  highscores_right_center_image: any
  highscores_right_down_image: any
  highscores_left_button!: ItemImage
  highscores_right_button!: ItemImage
  highscores_left_state = 0
  highscores_right_state = 0
  highscores_labels: [any, string][] = []
  highscores_label_index = 0
  highscore_label_item!: ItemImage
  highscores_items: ItemText[] = []

  constructor(stage: any) {
    this.stage = stage
    this.rollover_sound = stage.rollover_sound
    this.click_sound = stage.click_sound
  }

  show_merits(show_empty_dialog = true) {
    this.stage.show_dialog(this.main_layer, this.merits_handle_event)
    if (!show_empty_dialog) this.blind_show_merits_callback(this.main_layer, true)
    else this.stage.blind_dialog(this.main_layer, animations.BlindDirection.SHOW_DOWN, true, [], (l: Layer) => this.blind_show_merits_callback(l))
  }

  close_merits() {
    this.stage.blind_dialog(this.main_layer, animations.BlindDirection.HIDE_UP, true, [], this.blind_main_back_callback)
  }

  merits_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_merits()
    }
  }

  blind_show_merits_callback(_layer: Layer, blind_background = false) {
    this.set_up_common()
    this.set_up_main()
    this.stage.blind_dialog(this.main_layer, animations.BlindDirection.SHOW_DOWN, blind_background, [])
  }

  set_up_common() {
    if (!this.common_loaded) {
      this.back_standby_image = assets.load_image('p0_merits_backbutton_standby.png')
      this.back_rollover_image = assets.load_image('p0_merits_backbutton_rollover.png')
      this.common_loaded = true
    }
  }

  set_up_main() {
    const character = this.stage.game.datastore.user_character
    const character_progress = this.stage.game.datastore.user_character_progress
    const font_20 = assets.load_font('turkey.ttf', 20)
    const font_42 = assets.load_font('turkey.ttf', 42)
    this.main_layer.add(new ItemImage(0, 0, assets.load_image('p0_merits_main_background.jpg')))
    const back_item = new ItemImage(258, 399, this.back_standby_image)
    back_item.set_rollover_image(this.back_rollover_image, this.rollover_sound)
    back_item.add_event_handler(ItemEvent.CLICK, this.main_back_click)
    this.main_layer.add(back_item)
    this.add_text_with_shadow(this.main_layer, 341, 11, font_42, text.format_number(character_progress.score), GOLD, 157, 65, 2, 1, -2, 3)
    this.characterid = new characterid.CharacterId()
    this.characterid.set_up_id(this.main_layer, character.charinfo, 120, 87, false)
    const resolved_cases = character_progress.resolved_cases
    this.add_text_with_shadow(this.main_layer, 359, 335, font_20, text.format_number(resolved_cases), GOLD, 50, 30, 1, 1, -2, 3)
    if (character_progress.range.next_range_cases != null) {
      const next_promotion_cases = character_progress.range.next_range_cases - resolved_cases
      this.add_text_with_shadow(this.main_layer, 432, 363, font_20, text.format_number(next_promotion_cases), GOLD, 50, 30, 1, 1, -2, 3)
    }
    const medals_item = new ItemImage(13, 291, assets.load_image('p0_merits_main_btn_medals_normal.png'), null, true)
    medals_item.set_rollover_image(assets.load_image('p0_merits_main_btn_medals_rollover.png'), this.rollover_sound)
    medals_item.add_event_handler(ItemEvent.CLICK, this.medals_click)
    this.main_layer.add(medals_item)
    const highscores_item = new ItemImage(458, 293, assets.load_image('p0_merits_main_btn_highscore_normal.png'), null, true)
    highscores_item.set_rollover_image(assets.load_image('p0_merits_main_btn_highscore_rollover.png'), this.rollover_sound)
    highscores_item.add_event_handler(ItemEvent.CLICK, this.highscores_click)
    this.main_layer.add(highscores_item)
  }

  set_up_medals() {
    const font_14 = assets.load_font('turkey.ttf', 14)
    const font_18 = assets.load_font('turkey.ttf', 18)
    this.medals_layer = new Layer()
    this.medals_layer.add(new ItemImage(0, 0, assets.load_image('p0_merits_medals_background.jpg')))
    const back_item = new ItemImage(258, 399, this.back_standby_image)
    back_item.set_rollover_image(this.back_rollover_image, this.rollover_sound)
    back_item.add_event_handler(ItemEvent.CLICK, this.medals_back_click)
    this.medals_layer.add(back_item)
    this.generic_backglow_image = assets.load_image('p0_merits_medals_backglow_generic.png')
    this.medal_rollover_item = new ItemImage(0, 0, null)
    this.medal_rollover_item.set_visible(false)
    this.medals_layer.add(this.medal_rollover_item)
    this.medal_text_items = this.add_text_with_shadow(this.medals_layer, 223, 85, font_14, '', [252, 193, 45], 155, 20, 2, 1, -1, 2)
    this.medal_text_items[0].set_visible(false)
    this.medal_text_items[1].set_visible(false)
    const character_progress = this.stage.game.datastore.user_character_progress
    let medal_uy: any = null
    for (const medal of character_progress.medals) {
      if (medal.name === 'uy') medal_uy = medal
      else this.add_tiny_medal(medal.name, medal.count, font_18)
    }
    const count = medal_uy != null ? medal_uy.count : 0
    this.add_bottom_medal('uy', 'URUGUAY', count, 271, 287, -26, -21, 5, -4, 211, 53, font_18)
  }

  add_tiny_medal(name: string, count: number, font: any) {
    const image = assets.load_image('p0_merits_medals_tiny_' + name + '.png')
    const data = MEDALS_DATA[name]
    const item = new ItemImage(data[0], data[1], image)
    item.add_event_handler(ItemEvent.MOUSE_ENTER, this.medal_enter)
    item.add_event_handler(ItemEvent.MOUSE_LEAVE, this.medal_leave)
    item.add_event_handler(ItemEvent.CLICK, this.medal_click)
    this.medals_layer!.add(item)
    if (count > 1) this.add_text_with_shadow(this.medals_layer!, data[0] + 1, data[1] - 3, font, String(count), [254, 227, 0], 35, 28, 3, 1, -1, 3, 255)
    item.medal_department = true
    item.medal_name = name
    item.medal_text = data[2]
    item.medal_backglow = [-22, -21]
    item.medal_backglow_image = this.generic_backglow_image
    item.ribbon = data[3]
  }

  add_bottom_medal(name: string, txt: string, count: number, medal_x: number, medal_y: number, backglow_x: number, backglow_y: number, count_dx: number, count_dy: number, big_x: number, big_y: number, font: any) {
    if (count !== 0) {
      const item = new ItemImage(medal_x, medal_y, assets.load_image('p0_merits_medals_tiny_' + name + '.png'))
      const backglow_image = assets.load_image('p0_merits_medals_backglow_' + name + '.png')
      item.add_event_handler(ItemEvent.MOUSE_ENTER, this.medal_enter)
      item.add_event_handler(ItemEvent.MOUSE_LEAVE, this.medal_leave)
      item.add_event_handler(ItemEvent.CLICK, this.medal_click)
      this.medals_layer!.add(item)
      if (count > 1) this.add_text_with_shadow(this.medals_layer!, medal_x + count_dx, medal_y + count_dy, font, String(count), [254, 227, 0], 45, 28, 3, 1, -1, 3, 255)
      item.medal_department = false
      item.medal_name = name
      item.medal_text = txt
      item.medal_backglow = [backglow_x, backglow_y]
      item.medal_backglow_image = backglow_image
      item.medal_big_pos = [big_x, big_y]
    }
  }

  medal_enter = (item: any, _args: unknown) => {
    this.stage.render()
    this.rollover_sound.stop()
    this.rollover_sound.play()
    this.medal_rollover_item.set_image(item.medal_backglow_image)
    this.medal_rollover_item.set_left(item.get_left() + item.medal_backglow[0])
    this.medal_rollover_item.set_top(item.get_top() + item.medal_backglow[1])
    this.medal_rollover_item.set_visible(true)
    this.medal_text_items[0].set_text(item.medal_text)
    this.medal_text_items[1].set_text(item.medal_text)
    this.medal_text_items[0].set_visible(true)
    this.medal_text_items[1].set_visible(true)
  }

  medal_leave = (_item: unknown, _args: unknown) => {
    this.medal_rollover_item.set_visible(false)
    this.medal_text_items[0].set_visible(false)
    this.medal_text_items[1].set_visible(false)
  }

  medal_click = (item: any, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.medal_popup_layer == null) this.set_up_medal_popup()
    this.set_big_medal(item)
    this.stage.show_dialog(this.medal_popup_layer, this.medal_popup_handle_event, [0, 0, 0, 150])
    this.stage.blind_dialog(this.medal_popup_layer, animations.BlindDirection.SHOW_DOWN, true, [])
  }

  set_up_medal_popup() {
    const font_24 = assets.load_font('turkey.ttf', 24)
    const l = (this.medal_popup_layer = new Layer())
    l.add(new ItemImage(153, 131, assets.load_image('p0_merits_medals_popup_back_center.jpg')))
    l.add(new ItemImage(105, 69, assets.load_image('p0_merits_medals_popup_back_top.png')))
    l.add(new ItemImage(73, 341, assets.load_image('p0_merits_medals_popup_back_bottom.png')))
    l.add(new ItemImage(79, 131, assets.load_image('p0_merits_medals_popup_back_left.png')))
    l.add(new ItemImage(451, 131, assets.load_image('p0_merits_medals_popup_back_right.png')))
    const back_item = new ItemImage(258, 399, this.back_standby_image)
    back_item.set_rollover_image(this.back_rollover_image, this.rollover_sound)
    back_item.add_event_handler(ItemEvent.CLICK, this.medal_popup_back_click)
    l.add(back_item)
    this.ribbon_item = new ItemImage(246, 66, null)
    l.add(this.ribbon_item)
    this.base_item = new ItemImage(243, 168, assets.load_image('p0_merits_medals_big_genericbase.png'))
    l.add(this.base_item)
    this.tab_item = new ItemImage(265, 180, null)
    l.add(this.tab_item)
    this.big_medal_item = new ItemImage(0, 0, null)
    l.add(this.big_medal_item)
    this.big_name_items = this.add_text_with_shadow(l, 204, 284, font_24, '', [252, 193, 45], 195, 35, 2, 1, -2, 3, 255)
  }

  set_big_medal(item: any) {
    this.big_name_items[0].set_text(item.medal_text)
    this.big_name_items[1].set_text(item.medal_text)
    if (!item.medal_department) {
      this.big_medal_item.set_left(item.medal_big_pos[0])
      this.big_medal_item.set_top(item.medal_big_pos[1])
      this.big_medal_item.set_image(assets.load_image('p0_merits_medals_big_' + item.medal_name + '.png'))
      this.big_medal_item.set_visible(true)
      this.ribbon_item.set_visible(false)
      this.base_item.set_visible(false)
      this.tab_item.set_visible(false)
    } else {
      this.big_medal_item.set_visible(false)
      const ribbon_image = item.ribbon == null
        ? assets.load_image('p0_merits_medals_big_ribbon_' + item.medal_name + '.png')
        : assets.load_image('p0_merits_medals_big_ribbon_' + String(item.ribbon) + '.png')
      this.ribbon_item.set_image(ribbon_image)
      this.ribbon_item.set_visible(true)
      this.base_item.set_visible(true)
      this.tab_item.set_image(assets.load_image('p0_merits_medals_tab_' + item.medal_name + '.jpg'))
      this.tab_item.set_visible(true)
    }
  }

  set_up_highscores() {
    this.highscores_layer = new Layer()
    this.highscore_font = assets.load_font('turkey.ttf', 17)
    this.highscores_layer.add(new ItemImage(0, 0, assets.load_image('p0_merits_highscores_background.jpg')))
    this.highscores_left_up_image = assets.load_image('p0_merits_highscores_button_up.png')
    this.highscores_left_rollover_image = assets.load_image('p0_merits_highscores_button_rollover.png')
    this.highscores_left_center_image = assets.load_image('p0_merits_highscores_button_center.png')
    this.highscores_left_down_image = assets.load_image('p0_merits_highscores_button_down.png')
    this.highscores_right_up_image = this.highscores_left_up_image.flip_h_copy()
    this.highscores_right_rollover_image = this.highscores_left_rollover_image.flip_h_copy()
    this.highscores_right_center_image = this.highscores_left_center_image.flip_h_copy()
    this.highscores_right_down_image = this.highscores_left_down_image.flip_h_copy()
    this.highscores_left_button = new ItemImage(398, 80, this.highscores_left_up_image)
    this.highscores_left_button.add_event_handler(ItemEvent.CLICK, this.highscores_left_click)
    this.highscores_left_button.add_event_handler(ItemEvent.MOUSE_ENTER, this.highscores_left_enter)
    this.highscores_left_button.add_event_handler(ItemEvent.MOUSE_LEAVE, this.highscores_left_leave)
    this.highscores_left_state = 0
    this.highscores_layer.add(this.highscores_left_button)
    this.highscores_right_button = new ItemImage(502, 80, this.highscores_right_up_image)
    this.highscores_right_button.add_event_handler(ItemEvent.CLICK, this.highscores_right_click)
    this.highscores_right_button.add_event_handler(ItemEvent.MOUSE_ENTER, this.highscores_right_enter)
    this.highscores_right_button.add_event_handler(ItemEvent.MOUSE_LEAVE, this.highscores_right_leave)
    this.highscores_right_state = 0
    this.highscores_layer.add(this.highscores_right_button)
    this.highscores_labels = [
      [assets.load_image('p0_merits_highscores_label_total.png'), 'total'],
      [assets.load_image('p0_merits_highscores_label_gardener.png'), 'gardener'],
      [assets.load_image('p0_merits_highscores_label_librarian.png'), 'librarian'],
      [assets.load_image('p0_merits_highscores_label_puzzle.png'), 'bricklayer'],
      [assets.load_image('p0_merits_highscores_label_shoptender.png'), 'shoptender'],
    ]
    this.highscores_label_index = 0
    this.highscore_label_item = new ItemImage(433, 74, this.highscores_labels[0][0])
    this.highscores_layer.add(this.highscore_label_item)
    this.highscores_items = []
    this.load_highscores()
    const back_item = new ItemImage(258, 399, this.back_standby_image)
    back_item.set_rollover_image(this.back_rollover_image, this.rollover_sound)
    back_item.add_event_handler(ItemEvent.CLICK, this.highscores_back_click)
    this.highscores_layer.add(back_item)
  }

  load_highscores() {
    const datastore = this.stage.game.datastore
    const highscores = datastore.get_highscores()
    let characters: any[] = []
    const category = this.highscores_labels[this.highscores_label_index][1]
    if (highscores != null) {
      const list = highscores instanceof Map ? highscores.get(category) : highscores[category]
      if (list) characters = list
    }
    for (const i of this.highscores_items) this.highscores_layer!.remove(i)
    this.highscores_items = []
    let y = 120
    if (characters.length > 10) characters = characters.slice(0, 10)
    for (const c of characters) {
      let [i1, i2] = this.add_text_with_shadow(this.highscores_layer!, 66, y, this.highscore_font, String(c.name).toUpperCase(), GOLD, 350, 24, 1, 2, 1, 3)
      this.highscores_items.push(i1, i2)
      ;[i1, i2] = this.add_text_with_shadow(this.highscores_layer!, 410, y, this.highscore_font, text.format_number(c.score), GOLD, 85, 24, 3, 2, 1, 3)
      this.highscores_items.push(i1, i2)
      y += 25
    }
  }

  highscores_left_click = (item: any, _args: unknown) => {
    this.start_left_down()
    this.stage.capture_leftmousedown(item, this.highscores_left_mousecapture)
  }

  start_left_down() {
    this.highscores_left_state = 2
    this.highscores_left_button.set_image(this.highscores_left_center_image)
    this.stage.stop_timer('highscores_left_down')
    this.stage.start_timer('highscores_left_down', 50, (k: unknown, d: unknown) => this.show_left_down(k, d))
  }

  show_left_down(_key: unknown, _data: unknown) {
    this.stage.stop_timer('highscores_left_down')
    if (this.highscores_left_state === 2) this.highscores_left_button.set_image(this.highscores_left_down_image)
  }

  highscores_left_enter = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.rollover_sound.play()
    if (this.highscores_left_state === 0) this.highscores_left_button.set_image(this.highscores_left_rollover_image)
    else this.start_left_down()
  }

  highscores_left_leave = (_item: unknown, _args: unknown) => {
    if (this.highscores_left_state !== 0) this.highscores_left_state = 1
    this.highscores_left_button.set_image(this.highscores_left_up_image)
  }

  highscores_left_mousecapture = (_args: unknown, released: boolean) => {
    if (released) {
      this.highscores_left_state = 0
      if (this.stage.get_over_item() === this.highscores_left_button) {
        this.stage.render()
        this.click_sound.play()
        if (this.highscores_label_index === 0) this.highscores_label_index = this.highscores_labels.length - 1
        else this.highscores_label_index -= 1
        this.highscore_label_item.set_image(this.highscores_labels[this.highscores_label_index][0])
        this.load_highscores()
        this.highscores_left_button.set_image(this.highscores_left_rollover_image)
      }
    }
  }

  highscores_right_click = (item: any, _args: unknown) => {
    this.start_right_down()
    this.stage.capture_leftmousedown(item, this.highscores_right_mousecapture)
  }

  start_right_down() {
    this.highscores_right_state = 2
    this.highscores_right_button.set_image(this.highscores_right_center_image)
    this.stage.stop_timer('highscores_right_down')
    this.stage.start_timer('highscores_right_down', 50, (k: unknown, d: unknown) => this.show_right_down(k, d))
  }

  show_right_down(_key: unknown, _data: unknown) {
    this.stage.stop_timer('highscores_right_down')
    if (this.highscores_right_state === 2) this.highscores_right_button.set_image(this.highscores_right_down_image)
  }

  highscores_right_enter = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.rollover_sound.play()
    if (this.highscores_right_state === 0) this.highscores_right_button.set_image(this.highscores_right_rollover_image)
    else this.start_right_down()
  }

  highscores_right_leave = (_item: unknown, _args: unknown) => {
    if (this.highscores_right_state !== 0) this.highscores_right_state = 1
    this.highscores_right_button.set_image(this.highscores_right_up_image)
  }

  highscores_right_mousecapture = (_args: unknown, released: boolean) => {
    if (released) {
      this.highscores_right_state = 0
      if (this.stage.get_over_item() === this.highscores_right_button) {
        this.stage.render()
        this.click_sound.play()
        if (this.highscores_label_index === this.highscores_labels.length - 1) this.highscores_label_index = 0
        else this.highscores_label_index += 1
        this.highscore_label_item.set_image(this.highscores_labels[this.highscores_label_index][0])
        this.load_highscores()
        this.highscores_right_button.set_image(this.highscores_right_rollover_image)
      }
    }
  }

  add_text_with_shadow(layer: Layer, left: number, top: number, font: any, txt: string, color: number[], width: number, height: number, h_align: number, v_align: number, shadow_dx: number, shadow_dy: number, alpha = 153): [ItemText, ItemText] {
    const shadow_item = new ItemText(left + shadow_dx, top + shadow_dy, font, 0, txt, [0, 0, 0], null, width, height, h_align, v_align)
    shadow_item.set_alpha(alpha)
    layer.add(shadow_item)
    const text_item = new ItemText(left, top, font, 0, txt, color, null, width, height, h_align, v_align)
    layer.add(text_item)
    return [text_item, shadow_item]
  }

  medals_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (this.medals_layer == null) this.set_up_medals()
    this.stage.show_dialog(this.medals_layer, this.medals_handle_event, null)
    this.stage.blind_dialog(this.medals_layer, animations.BlindDirection.SHOW_DOWN, true, [])
  }

  medals_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_medals()
    }
  }

  close_medals() {
    this.stage.blind_dialog(this.medals_layer, animations.BlindDirection.HIDE_UP, true, [], this.blind_medals_back_callback)
  }

  highscores_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.show_highscores()
  }

  show_highscores() {
    if (this.highscores_layer == null) {
      this.set_up_common()
      this.set_up_highscores()
    }
    this.load_highscores()
    this.stage.show_dialog(this.highscores_layer, this.highscores_handle_event, null)
    this.stage.blind_dialog(this.highscores_layer, animations.BlindDirection.SHOW_DOWN, true, [])
  }

  highscores_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_highscores()
    }
  }

  close_highscores() {
    this.stage.blind_dialog(this.highscores_layer, animations.BlindDirection.HIDE_UP, true, [], this.blind_highscores_back_callback)
  }

  main_back_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_merits()
  }

  blind_main_back_callback = (_layer: Layer) => { this.stage.close_dialog(this.main_layer) }

  medals_back_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_medals()
  }

  blind_medals_back_callback = (_layer: Layer) => { this.stage.close_dialog(this.medals_layer) }

  medal_popup_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_medal_popup()
    }
  }

  medal_popup_back_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_medal_popup()
  }

  close_medal_popup() {
    this.stage.blind_dialog(this.medal_popup_layer, animations.BlindDirection.HIDE_UP, true, [], this.blind_medal_popup_back_callback)
  }

  blind_medal_popup_back_callback = (_layer: Layer) => { this.stage.close_dialog(this.medal_popup_layer) }

  highscores_back_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_highscores()
  }

  blind_highscores_back_callback = (_layer: Layer) => { this.stage.close_dialog(this.highscores_layer) }
}
