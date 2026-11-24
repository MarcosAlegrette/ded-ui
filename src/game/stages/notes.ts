// Port de game/stages/notes.py: la libreta de notas (índice alfabético de ríos, lagunas, cerros,
// hechos históricos, localidades y escritores que el detective fue descubriendo).
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import { Layer, ItemImage, ItemText, ItemMask, ItemEvent, KEYDOWN, K } from '../../framework/stage.ts'
import pygame from '../../pg/index.ts'
import type { Font } from '../../pg/font.ts'
import type { PgEvent } from '../../pg/events.ts'

export const LETTER_ROLLOVER_TIMER_KEY = 'show_note_letter_rollover'

/** [letra, x, y, ítem de página, x hover, y hover, habilitada, x palabra, y palabra]
 *  (recuperado de las constantes del bytecode: el decompilador mostraba índices de constantes) */
type LetterData = [string, number, number, ItemImage | null, number, any, boolean, number, number]

export class Notes {
  stage: any
  layer = new Layer()
  popup_layer: Layer | null = null
  selected_letter: LetterData | null = null
  page_items: any[] = []
  pending_changes_to_save = false
  last_hover_show: number | null = null
  line_font: Font
  click_sound: any
  rollover_sound: any
  popup_sound: any
  notes_close_sound: assets.CustomSound
  turn_page_sound: assets.CustomSound
  note_fade_in_sound: assets.CustomSound
  letters_data: LetterData[] = []
  current_page = 1
  letter_notes: any[] = []
  new_notes_letters: Record<string, ItemImage> = {}
  close_button_image!: assets.Image
  close_button_image_rollover!: assets.Image
  next_button_image!: assets.Image
  next_button_image_rollover!: assets.Image
  previous_button_image!: assets.Image
  previous_button_image_rollover!: assets.Image
  close_button!: ItemImage
  next_button!: ItemImage
  previous_button!: ItemImage
  menu_back!: ItemImage
  letter_hover!: ItemImage
  letter_selected_top!: ItemImage
  letter_selected_bottom!: ItemImage
  headerline!: ItemImage
  dot_image!: assets.Image
  item_hoversmall_image!: assets.Image
  item_hoverbig_image!: assets.Image
  popup_title!: ItemText
  popup_subtitle1!: ItemText
  popup_subtitle2!: ItemText
  popup_description!: ItemText

  constructor(stage: any) {
    this.stage = stage
    this.line_font = assets.load_font('gapstown.ttf', 22)
    this.click_sound = stage.click_sound
    this.rollover_sound = stage.rollover_sound
    this.popup_sound = stage.witness_popup_sound
    this.notes_close_sound = assets.load_sound('GUI_Notes_Close.ogg')
    this.turn_page_sound = assets.load_sound('GUI_Turn_Page.ogg')
    this.note_fade_in_sound = assets.load_sound('fade.ogg')
    this.set_up()
  }

  close_notes() { this.stage.close_dialog(this.layer) }

  select_first_page() { this.select_letter(this.letters_data[0]) }

  set_letters_data() {
    const d: [string, number, number, number, number, number, number][] = [
      ['A', 150, 5, 143, 2, 152, 13], ['B', 174, 5, 167, 2, 176, 13], ['C', 200, 5, 193, 2, 203, 13],
      ['D', 225, 5, 218, 2, 227, 13], ['E', 249, 5, 242, 2, 251, 13], ['F', 271, 5, 265, 2, 273, 13],
      ['G', 294, 5, 286, 2, 295, 13], ['H', 317, 5, 310, 2, 319, 13], ['I', 338, 5, 332, 2, 340, 13],
      ['J', 359, 5, 353, 2, 363, 13], ['K', 381, 5, 374, 2, 383, 13], ['L', 402, 5, 395, 2, 404, 13],
      ['M', 119, 31, 110, 26, 120, 37], ['N', 143, 31, 135, 26, 144, 37], ['Ñ', 165, 31, 156, 26, 165, 37],
      ['O', 187, 31, 179, 26, 188, 37], ['P', 210, 31, 202, 26, 210, 37], ['Q', 233, 31, 225, 26, 233, 37],
      ['R', 257, 31, 249, 26, 258, 37], ['S', 282, 31, 274, 26, 283, 37], ['T', 305, 31, 297, 26, 306, 37],
      ['U', 328, 31, 320, 26, 329, 37], ['V', 351, 31, 343, 26, 351, 37], ['W', 373, 31, 365, 26, 373, 37],
      ['X', 398, 31, 391, 26, 399, 37], ['Y', 418, 31, 410, 26, 419, 37], ['Z', 441, 31, 432, 26, 442, 37],
    ]
    this.letters_data = d.map(([l, x, y, hx, hy, wx, wy]) => [l, x, y, null, hx, hy, true, wx, wy])
  }

  set_up() {
    this.set_letters_data()
    this.set_background()
    this.set_up_menu_buttons()
    this.set_up_letters()
    this.set_up_new_notes()
    this.set_up_page()
  }

  set_background() {
    this.layer.add(new ItemImage(43, 61, assets.load_image('p0_notes_center.jpg'), null))
    this.layer.add(new ItemImage(15, 31, assets.load_image('p0_notes_top.png'), null))
    this.layer.add(new ItemImage(22, 421, assets.load_image('p0_notes_bottom.png'), null))
    this.layer.add(new ItemImage(2, 61, assets.load_image('p0_notes_left.png'), null))
    this.layer.add(new ItemImage(545, 61, assets.load_image('p0_notes_right.png'), null))
  }

  set_up_menu_buttons() {
    this.close_button_image = assets.load_image('p0_button_close.png')
    this.close_button_image_rollover = assets.load_image('p0_button_close_rollover.png')
    this.next_button_image = assets.load_image('p0_button_next_active.png')
    this.next_button_image_rollover = assets.load_image('p0_button_next_rollover.png')
    this.previous_button_image = assets.load_image('p0_button_previous_active.png')
    this.previous_button_image_rollover = assets.load_image('p0_button_previous_rollover.png')
    this.close_button = new ItemImage(275, 392, this.close_button_image, null)
    this.close_button.set_rollover_image(this.close_button_image_rollover, this.rollover_sound)
    this.next_button = new ItemImage(305, 392, this.next_button_image, null)
    this.next_button.set_rollover_image(this.next_button_image_rollover, this.rollover_sound)
    this.previous_button = new ItemImage(245, 392, this.previous_button_image, null)
    this.previous_button.set_rollover_image(this.previous_button_image_rollover, this.rollover_sound)
    this.close_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.next_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.previous_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.layer.add(this.close_button)
    this.layer.add(this.next_button)
    this.layer.add(this.previous_button)
  }

  set_up_letters() {
    this.menu_back = new ItemImage(101, 5, assets.load_image('p0_notes_menuback.png'), null)
    this.menu_back.add_event_handler(ItemEvent.CLICK, this.letters_click)
    this.menu_back.add_event_handler(ItemEvent.MOUSE_MOVE, this.letters_mousemove)
    this.menu_back.add_event_handler(ItemEvent.MOUSE_LEAVE, this.letters_leave)
    this.layer.add(this.menu_back)
    this.letter_hover = new ItemImage(101, 5, assets.load_image('p0_notes_menuhover.png'), null)
    this.letter_hover.set_visible(false)
    this.layer.add(this.letter_hover)
    this.letter_selected_top = new ItemImage(101, 5, assets.load_image('p0_notes_menuselected_top.png'), null)
    this.letter_selected_top.set_visible(false)
    this.layer.add(this.letter_selected_top)
    this.letter_selected_bottom = new ItemImage(101, 5, assets.load_image('p0_notes_menuselected_bottom.png'), null)
    this.letter_selected_bottom.set_visible(false)
    this.layer.add(this.letter_selected_bottom)
    const letters: string[] = []
    for (const note of this.stage.game.datastore.user_character_progress.notes) {
      const letter = this.get_note_letter(note)
      if (!letters.includes(letter)) letters.push(letter)
    }
    for (const letter_data of this.letters_data) {
      const color = letters.includes(letter_data[0]) ? 'red' : 'grey'
      const letter_char = this.get_letter_image_char(letter_data[0])
      this.layer.add(new ItemImage(letter_data[7], letter_data[8], assets.load_image('p0_notes_menuwords_' + color + '_' + letter_char + '.png')))
    }
  }

  set_up_new_notes() {
    const new_letters: string[] = []
    let index = this.layer.index_of(this.letter_hover) + 1
    for (const note of this.stage.game.datastore.user_character_progress.new_notes) {
      const letter = this.get_note_letter(note)
      if (!new_letters.includes(letter)) new_letters.push(letter)
    }
    this.new_notes_letters = {}
    if (new_letters.length > 0) {
      const letter_selected_image = assets.load_image('p0_notes_menuselected.png')
      new_letters.sort()
      for (const letter of new_letters) {
        let letter_data: LetterData | null = null
        for (const l of this.letters_data) if (l[0] === letter) { letter_data = l; break }
        const item = new ItemImage(letter_data![1] - 5, letter_data![2] + 3, letter_selected_image)
        this.layer.add(item, index + 1)
        index += 1
        this.new_notes_letters[letter] = item
      }
    }
  }

  set_up_page() {
    this.headerline = new ItemImage(66, 69, assets.load_image('p0_notes_headerline.jpg'))
    this.layer.add(this.headerline)
    this.dot_image = assets.load_image('p0_notes_dot.png')
    this.item_hoversmall_image = assets.load_image('p0_notes_hoversmall.png')
    this.item_hoverbig_image = assets.load_image('p0_notes_hoverbig.png')
  }

  set_up_popup_layer() {
    this.popup_layer = new Layer()
    this.popup_layer.add(new ItemImage(69, 21, assets.load_image('p0_notes_popupbkg.png')))
    const font24 = assets.load_font('powdrft_.ttf', 24)
    const font20 = assets.load_font('powdrft_.ttf', 20)
    this.popup_title = new ItemText(106, 50, font24, 18, '', [157, 21, 21], null, 320, 37)
    this.popup_layer.add(this.popup_title)
    this.popup_subtitle1 = new ItemText(106, 91, font20, 14, '', [51, 51, 51], null, 320, 18)
    this.popup_layer.add(this.popup_subtitle1)
    this.popup_subtitle2 = new ItemText(106, 108, font20, 14, '', [102, 102, 102], null, 320, 18)
    this.popup_layer.add(this.popup_subtitle2)
    this.popup_description = new ItemText(106, 158, font20, 16, '', [0, 0, 0], null, 380, 220)
    this.popup_layer.add(this.popup_description)
    const close_button = new ItemImage(483, 40, assets.load_image('btn_testigo_x_normal.png'), null, true)
    close_button.set_rollover(assets.load_image('btn_testigo_x_rollover.png'), this.rollover_sound)
    close_button.add_event_handler(ItemEvent.CLICK, this.popup_close_click)
    this.popup_layer.add(close_button)
  }

  button_click = (item: unknown, _args: unknown) => {
    if (item === this.close_button) {
      this.stage.render()
      this.notes_close_sound.play()
      if (this.pending_changes_to_save) {
        this.stage.save_progress(false)
        this.pending_changes_to_save = false
      }
      this.close_notes()
    }
    if (item === this.next_button) {
      const has_items = this.load_letter_page(this.current_page + 1)[0]
      if (!has_items) {
        const index = this.letters_data.indexOf(this.selected_letter!)
        if (index + 1 < this.letters_data.length) this.select_letter(this.letters_data[index + 1])
        else this.load_letter_page(this.current_page - 1)
      }
    } else if (item === this.previous_button) {
      if (this.current_page > 1) this.load_letter_page(this.current_page - 1)
      else {
        const index = this.letters_data.indexOf(this.selected_letter!)
        if (index > 0) this.select_letter(this.letters_data[index - 1], true)
      }
    }
    if (item === this.previous_button || item === this.next_button) {
      this.stage.render()
      this.turn_page_sound.play()
    }
  }

  popup_close_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_popup()
  }

  popup_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_popup()
    }
  }

  close_popup() { this.stage.close_dialog(this.popup_layer) }

  letters_click = (_item: unknown, args: any) => {
    const letter = this.get_letter_at(args.x, args.y)
    if (letter != null) {
      if ((this.selected_letter !== letter || this.current_page !== 1) && letter[5]) {
        this.letter_hover.set_visible(false)
        this.select_letter(letter)
        this.stage.render()
        this.turn_page_sound.play()
      }
    }
  }

  letters_mousemove = (_item: unknown, args: any) => {
    const letter = this.get_letter_at(args.x, args.y)
    if (letter == null || letter === this.selected_letter) {
      this.stage.stop_timer(LETTER_ROLLOVER_TIMER_KEY)
      this.letter_hover.set_visible(false)
      this.letter_hover.set_left(0)
      this.letter_hover.set_top(0)
    } else if (letter[5]) {
      const letter_left = letter[4]
      const letter_top = letter[5]
      if (this.letter_hover.get_left() !== letter_left || this.letter_hover.get_top() !== letter_top) {
        this.letter_hover.set_left(letter_left)
        this.letter_hover.set_top(letter_top)
        this.letter_hover.set_visible(false)
        this.stage.stop_timer(LETTER_ROLLOVER_TIMER_KEY)
        this.stage.start_timer(LETTER_ROLLOVER_TIMER_KEY, 50, this.show_letter_rollover)
        this.last_hover_show = pygame.time.get_ticks()
      }
    }
  }

  show_letter_rollover = (key: unknown, _data: unknown) => {
    this.stage.stop_timer(key)
    this.letter_hover.set_visible(true)
    this.rollover_sound.stop()
    this.stage.render()
    this.rollover_sound.play()
    this.last_hover_show = pygame.time.get_ticks()
  }

  letters_leave = (_item: unknown, _args: unknown) => {
    this.stage.stop_timer(LETTER_ROLLOVER_TIMER_KEY)
    this.letter_hover.set_visible(false)
  }

  note_click = (item: any, _args: unknown) => {
    if (this.popup_layer == null) this.set_up_popup_layer()
    this.load_note_data(item.note)
    this.stage.show_dialog(this.popup_layer, this.popup_handle_event)
    this.stage.render()
    this.popup_sound.play()
  }

  load_note_data(note: any) {
    this.popup_title.set_text(note.get_full_name())
    if (note.type === 'HISTORY_FACT') {
      this.popup_subtitle1.set_text('(' + note.date + ')')
      this.popup_subtitle2.set_text('')
      this.popup_description.set_text(this.get_joint_description(note))
    } else if (note.type === 'RIVER') {
      this.popup_subtitle1.set_text('Longitud: ' + note.length)
      this.popup_subtitle2.set_text('Cuenca: ' + note.basin)
      this.popup_description.set_text(this.get_joint_description(note))
    } else if (note.type === 'LAGOON') {
      this.popup_subtitle1.set_text('Superficie: ' + note.surface)
      this.popup_subtitle2.set_text('')
      this.popup_description.set_text(this.get_joint_description(note))
    } else if (note.type === 'HILL') {
      this.popup_subtitle1.set_text('Altura: ' + note.height)
      this.popup_subtitle2.set_text('')
      this.popup_description.set_text(this.get_joint_description(note))
    } else if (note.type === 'LOCATION') {
      this.popup_subtitle1.set_text(note.location_type)
      this.popup_subtitle2.set_text('Población: ' + note.population)
      this.popup_description.set_text(note.description)
    } else if (note.type === 'WRITER') {
      this.popup_subtitle1.set_text(note.dates)
      this.popup_subtitle2.set_text('')
      this.popup_description.set_text(note.description)
    }
  }

  get_joint_description(note: any) {
    let s = note.description1
    if (note.description2 != null) s += '\n\n' + note.description2
    return s
  }

  get_letter_at(x: number, y: number): LetterData | null {
    for (const ld of this.letters_data) {
      if (ld[2] + 2 <= y && y < ld[2] + 28 && ld[1] <= x && x < ld[1] + 26) return ld
    }
    return null
  }

  select_letter(letter: LetterData, load_last_page = false) {
    if (letter[0] in this.new_notes_letters) {
      this.layer.remove(this.new_notes_letters[letter[0]])
      delete this.new_notes_letters[letter[0]]
    }
    if (letter[2] < 20) {
      this.letter_selected_top.set_left(letter[1])
      this.letter_selected_top.set_top(letter[2])
      this.letter_selected_top.set_visible(true)
      this.letter_selected_bottom.set_visible(false)
    } else {
      this.letter_selected_bottom.set_left(letter[1])
      this.letter_selected_bottom.set_top(letter[2])
      this.letter_selected_bottom.set_visible(true)
      this.letter_selected_top.set_visible(false)
    }
    let letter_item = letter[3]
    if (letter_item == null) {
      const letter_char = this.get_letter_image_char(letter[0])
      letter_item = new ItemImage(66, 69, assets.load_image('p0_notes_' + letter_char + '.jpg'))
      letter[3] = letter_item
    }
    // (estructura recuperada del bytecode; el decompilador la había desordenado)
    if (this.selected_letter != null && this.selected_letter[3] != null) this.layer.remove(this.selected_letter[3])
    this.layer.add(letter_item)
    this.selected_letter = letter
    this.load_letter_notes(letter[0])
    if (!load_last_page) this.load_letter_page(1)
    else {
      const last_page = this.load_letter_page(99999)[1]
      this.load_letter_page(last_page)
    }
  }

  get_letter_image_char(letter: string) {
    let letter_char = letter[0].toLowerCase()
    if (letter_char === 'ñ' || letter_char === 'Ñ') letter_char = 'nn'
    return letter_char
  }

  load_letter_notes(letter: string) {
    this.letter_notes = []
    for (const note of this.stage.game.datastore.user_character_progress.notes) {
      if (this.get_note_letter(note) === letter) this.letter_notes.push(note)
    }
    this.letter_notes.sort((a, b) => this.note_compare(a, b))
  }

  get_note_letter(note: any) {
    let letter: string = note.name[0].toUpperCase()
    if (letter === 'Á' || letter === 'á') letter = 'A'
    else if (letter === 'É' || letter === 'é') letter = 'E'
    else if (letter === 'Í' || letter === 'í') letter = 'I'
    else if (letter === 'Ó' || letter === 'ó') letter = 'O'
    else if (letter === 'Ú' || letter === 'ú') letter = 'U'
    return letter
  }

  note_compare(note1: any, note2: any) {
    const a = note1.get_full_name(), b = note2.get_full_name()
    if (a > b) return 1
    if (a === b) return 0
    return -1
  }

  load_letter_page(page_number: number): [boolean, number] {
    for (const item of this.page_items) this.layer.remove(item)
    let index = this.layer.index_of(this.menu_back)
    if (page_number === 1) {
      this.headerline.set_visible(true)
      this.selected_letter![3]!.set_visible(true)
    } else {
      this.headerline.set_visible(false)
      this.selected_letter![3]!.set_visible(false)
    }
    let current_page = 1
    let text_x = 86
    let text_y = 175
    this.current_page = page_number
    let has_items = false
    this.page_items = []
    let last_page = true
    let play_new_notes = false
    for (const note of this.letter_notes) {
      const [text_width] = this.line_font.size(note.get_full_name())
      const text_height = text_width > 188 ? 44 : 22
      if (text_y + text_height > 380) {
        if (text_x < 100) text_x = 335
        else {
          text_x = 83
          current_page += 1
        }
        text_y = 65
      }
      if (current_page === page_number) {
        const hover_image = text_height <= 30 ? this.item_hoversmall_image : this.item_hoverbig_image
        const mask = new ItemMask(text_x - 20, text_y, hover_image.get_size())
        mask.set_rollover(hover_image, this.rollover_sound)
        mask.note = note
        mask.add_event_handler(ItemEvent.CLICK, this.note_click)
        this.layer.add(mask, index)
        index += 1
        this.page_items.push(mask)
        const t = new ItemText(text_x, text_y, this.line_font, 22, note.get_full_name(), [55, 62, 92], null, 188)
        this.layer.add(t, index)
        index += 1
        this.page_items.push(t)
        const dot_item = new ItemImage(text_x - 12, text_y + 8, this.dot_image)
        this.layer.add(dot_item, index)
        index += 1
        this.page_items.push(dot_item)
        const new_notes = this.stage.game.datastore.user_character_progress.new_notes
        const ni = new_notes.indexOf(note)
        if (ni >= 0) {
          new_notes.splice(ni, 1)
          this.pending_changes_to_save = true
          animations.fade_in_item(t)
          animations.fade_in_item(dot_item)
          play_new_notes = true
        }
        has_items = true
      } else if (current_page > page_number) {
        last_page = false
        break
      }
      text_y += text_height
    }
    this.update_buttons_enabled(page_number, last_page)
    if (play_new_notes) {
      this.stage.render()
      this.note_fade_in_sound.play()
    }
    return [has_items, current_page]
  }

  update_buttons_enabled(page_number: number, last_page: boolean) {
    this.previous_button.set_visible(this.selected_letter !== this.letters_data[0] || page_number > 1)
    this.next_button.set_visible(this.selected_letter !== this.letters_data[this.letters_data.length - 1] || !last_page)
  }

  set_letters_state(letters: string[] | null, enabled: boolean) {
    // como en el original: el índice 5 (también usado como "y" del hover) hace de bandera
    if (letters) {
      for (const letter of letters) for (const data of this.letters_data) if (data[0] === letter) { data[5] = enabled; break }
    } else for (const letter of this.letters_data) letter[5] = enabled
  }

  disable_letters(letters: string[] | null = null) { this.set_letters_state(letters, false) }
  enable_letters(letters: string[] | null = null) { this.set_letters_state(letters, true) }

  disable_next_button() {
    this.next_button.set_rollover_image(null, null)
    this.next_button.remove_event_handler(ItemEvent.CLICK, this.button_click)
  }
  disable_previous_button() {
    this.previous_button.set_rollover_image(null, null)
    this.previous_button.remove_event_handler(ItemEvent.CLICK, this.button_click)
  }
  disable_close_button() {
    this.close_button.set_rollover_image(null, null)
    this.close_button.remove_event_handler(ItemEvent.CLICK, this.button_click)
  }
  enable_next_button() {
    this.next_button.set_rollover_image(this.next_button_image_rollover, this.rollover_sound)
    this.next_button.add_event_handler(ItemEvent.CLICK, this.button_click)
  }
  enable_previous_button() {
    this.previous_button.set_rollover_image(this.previous_button_image_rollover, this.rollover_sound)
    this.previous_button.add_event_handler(ItemEvent.CLICK, this.button_click)
  }
  enable_close_button() {
    this.close_button.set_rollover_image(this.close_button_image_rollover, this.rollover_sound)
    this.close_button.add_event_handler(ItemEvent.CLICK, this.button_click)
  }
  disable_notes() {}
}
