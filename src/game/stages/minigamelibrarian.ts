// Port de game/stages/minigamelibrarian.py (minijuego del bibliotecario: formar palabras).
// Los diccionarios originales (data/words_small.tcd y words_full.tcd) vienen en src/data/words_*.json
// y se cargan con este módulo (code-splitting).
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import type { Image } from '../../framework/assets.ts'
import { ItemImage, ItemRect, ItemText, ItemEvent, Layer, KEYDOWN, K } from '../../framework/stage.ts'
import { choice } from '../../pg/py.ts'
import type { PgEvent } from '../../pg/events.ts'
import { Minigame } from './minigame.ts'
import * as statcodes from '../data/statcodes.ts'
import WORDS_SMALL from '../../data/words_small.json'
import WORDS_FULL from '../../data/words_full.json'

assets.register_data('words_small.tcd', WORDS_SMALL as string[][])
assets.register_data('words_full.tcd', WORDS_FULL as string[][])

export class MinigameLibrarian extends Minigame {
  word_max_length: number
  correct_words_to_win: number
  letters: string[] | null
  correct_words: number
  wrong_words: number
  letters_used: number
  animation_on: boolean
  powdrf_18: any
  powdrf_23: any
  bell_sound: assets.CustomSound
  type_sound: assets.CustomSound
  erase_sound: assets.CustomSound
  correct_choice: assets.CustomSound
  incorrect_choice: assets.CustomSound
  timer: assets.CustomSound
  witness_item: ItemImage
  witness_minigame_box_image: Image
  title: string
  question_intro: string
  question: string
  request_text: string
  request_question_text: string
  thanks_text: string
  dictionary_small: string[][]
  dictionary_full: string[][]
  letters_count = 7
  average_time = 90
  timer_complete_time = 135
  good_color_image!: Image
  good_white_image!: Image
  bad_color_image!: Image
  bad_white_image!: Image
  rightmark_image!: Image
  result_layer!: Layer
  timer_line_item!: ItemRect
  adjustement_value = 1
  timer_topbar_item!: ItemImage
  timer_ringer_item!: ItemImage
  letter_items: [ItemText, ItemImage][] = []
  accept_button!: ItemImage
  delete_button!: ItemImage
  exit_button!: ItemImage
  help_button!: ItemImage
  typed_text = ''
  typed_letter_items: ItemText[] = []
  correct_word_list: string[] = []
  upper_help_text_item!: ItemText
  lower_help_text_item!: ItemText

  constructor(stage: any, phase1content: any, witness: any) {
    super(stage, phase1content, witness, statcodes.MG_LIRARIAN, statcodes.MG_LIRARIAN_SOLVED, statcodes.MG_LIRARIAN_NOTSOLVED, 'librarian')
    this.word_max_length = 6
    this.correct_words_to_win = 5
    this.letters = null
    this.correct_words = 0
    this.wrong_words = 0
    this.letters_used = 0
    this.animation_on = false
    this.powdrf_18 = assets.load_font('powdrft_.ttf', 18)
    this.powdrf_23 = assets.load_font('powdrft_.ttf', 23)
    this.bell_sound = assets.load_sound('p1_minigame_bell.ogg')
    this.type_sound = assets.load_sound('p1_minigame_type.ogg')
    this.erase_sound = assets.load_sound('p1_minigame_erase.ogg')
    this.correct_choice = assets.load_sound('p1_minigame_right.ogg')
    this.incorrect_choice = assets.load_sound('p1_minigame_wrong.ogg')
    this.timer = assets.load_sound('p1_minigame_timer.ogg')
    this.witness_item = new ItemImage(447, 77, assets.load_image('p1_minigame_librarian_librarian.png'), null)
    this.witness_minigame_box_image = assets.load_image('p1_minigame_flux_librarian_dialogue1.png')
    this.max_help_stages = 4
    this.title = 'BIBLIOTECARIO'
    this.question_intro = 'El Bibliotecario se encuentra muy ocupado\nen este momento, quizás si lo ayudas\npuedas interrogarlo luego.'
    this.question = '¿Te ofreces a ayudarlo?'
    this.request_text = 'Estoy intentando restaurar unos libros antiguos y\nalgunas palabras no se ven bien. Tengo una\nlista de las letras que podrían formarlas.'
    this.request_question_text = '¿Puedes ayudarme a formar\npalabras con ellas?'
    this.thanks_text = '¡Muchas gracias!\n\nYa puedo terminar de restaurar los libros.'
    this.dictionary_small = assets.load_data('words_small.tcd')
    this.dictionary_full = assets.load_data('words_full.tcd')
  }

  get_music() { return this.phase1content.music_minigame_2 }

  blind_show_minigame_callback(_layer: unknown) {
    if (!this.stage.game.datastore.user_character_progress.minigame_librarian_help_seen) {
      this.stop_minigame(false)
      this.stage.game.datastore.user_character_progress.minigame_librarian_help_seen = true
      this.show_help_dialog()
    } else this.start_minigame()
  }

  set_up_minigame() {
    const character_progress = this.stage.game.datastore.user_character_progress
    const minigame_level = character_progress.range.minigame_level
    if (minigame_level === 1) this.letters_count = 7
    else if (minigame_level === 2) this.letters_count = 7
    else this.letters_count = 6
    const level = character_progress.range.level
    if (level === 0) { this.average_time = 90; this.timer_complete_time = 135 }
    else if (level === 1) { this.average_time = 76; this.timer_complete_time = 114 }
    else if (level === 2) { this.average_time = 62; this.timer_complete_time = 93 }
    else if (level === 3) { this.average_time = 48; this.timer_complete_time = 72 }
    else if (level === 4) { this.average_time = 34; this.timer_complete_time = 51 }
    else { this.average_time = 20; this.timer_complete_time = 30 }
    this.set_up_game_background_items()
    this.set_up_timer()
    this.set_up_letters()
    this.set_up_game_buttons()
    this.set_up_typed_text()
    this.set_up_witness()
    this.good_color_image = assets.load_image('p1_minigame_librarian_popup_good.png')
    this.good_white_image = assets.load_image('p1_minigame_librarian_popup_good_white.png')
    this.bad_color_image = assets.load_image('p1_minigame_librarian_popup_bad.png')
    this.bad_white_image = assets.load_image('p1_minigame_librarian_popup_bad_white.png')
    this.rightmark_image = assets.load_image('p1_minigame_librarian_rightmark.png')
    this.result_layer = new Layer()
    this.stage.add_layer(this.result_layer)
  }

  set_up_timer() {
    const timer_backbar_item = new ItemImage(92, 111, assets.load_image('p1_minigame_shoptender_timer_backbar.jpg'), null)
    this.timer_line_item = new ItemRect(97, 118, 11, 128, null, 0, '', [0, 0, 0], [236, 14, 36])
    this.adjustement_value = this.timer_line_item.get_height() / this.timer_complete_time
    this.timer_topbar_item = new ItemImage(94, 104, assets.load_image('p1_minigame_shoptender_timer_topbar.png'), null)
    const timer_barshadow_item = new ItemImage(90, 110, assets.load_image('p1_minigame_shoptender_timer_barshadow.png'), null)
    const timer_front_item = new ItemImage(83, 100, assets.load_image('p1_minigame_shoptender_timer_front.png'), null)
    this.timer_ringer_item = new ItemImage(52, 235, assets.load_image('p1_minigame_shoptender_timer_ringer_001.png'), null)
    this.layer.add(timer_backbar_item)
    this.layer.add(this.timer_line_item)
    this.layer.add(this.timer_topbar_item)
    this.layer.add(timer_barshadow_item)
    this.layer.add(timer_front_item)
    this.layer.add(this.timer_ringer_item)
  }

  set_up_letters() {
    this.letter_items = []
    if (this.letters_count === 7) {
      this.add_letter(158, 93, 167, 105)
      this.add_letter(199, 90, 208, 101)
      this.add_letter(238, 90, 248, 102)
      this.add_letter(278, 89, 288, 100)
      this.add_letter(318, 90, 328, 101)
      this.add_letter(358, 92, 369, 103)
      this.add_letter(398, 95, 410, 106)
    } else if (this.letters_count === 6) {
      this.add_letter(178, 93, 187, 105)
      this.add_letter(219, 91, 227, 102)
      this.add_letter(258, 90, 269, 102)
      this.add_letter(300, 90, 310, 102)
      this.add_letter(340, 92, 351, 103)
      this.add_letter(380, 95, 392, 106)
    }
  }

  add_letter(button_x: number, button_y: number, letter_x: number, letter_y: number) {
    const k = String(this.letter_items.length + 1)
    const back_item = new ItemImage(button_x, button_y, assets.load_image('p1_minigame_librarian_btn_00' + k + '_standby.png'))
    back_item.set_rollover_image(assets.load_image('p1_minigame_librarian_btn_00' + k + '_rollover.png'), this.rollover_sound)
    back_item.add_event_handler(ItemEvent.CLICK, this.letter_click)
    this.layer.add(back_item)
    const item = new ItemText(letter_x, letter_y, this.powdrf_23, 0, '', [80, 49, 19], null, 30, 30, 2)
    back_item.letter_item = item
    this.layer.add(item)
    this.letter_items.push([item, back_item])
  }

  set_up_game_buttons() {
    this.accept_button = new ItemImage(204, 143, assets.load_image('p1_minigame_librarian_btn_accept_standby.jpg'))
    this.accept_button.set_rollover_image(assets.load_image('p1_minigame_librarian_btn_accept_rollover.jpg'), this.rollover_sound)
    this.accept_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.layer.add(this.accept_button)
    this.delete_button = new ItemImage(303, 143, assets.load_image('p1_minigame_librarian_btn_delete_standby.jpg'))
    this.delete_button.set_rollover_image(assets.load_image('p1_minigame_librarian_btn_delete_rollover.jpg'), this.rollover_sound)
    this.delete_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.layer.add(this.delete_button)
  }

  set_up_typed_text() {
    this.typed_text = ''
    this.typed_letter_items = []
    this.add_typed_letter(214, 204)
    this.add_typed_letter(244, 205)
    this.add_typed_letter(274, 204)
    this.add_typed_letter(304, 204)
    this.add_typed_letter(334, 204)
    this.add_typed_letter(364, 204)
  }

  add_typed_letter(x: number, y: number) {
    const item = new ItemText(x, y, this.font_24, 0, '', [150, 20, 15], null, 26, 30, 2)
    this.typed_letter_items.push(item)
    this.layer.add(item)
  }

  start_bell_animation() {
    const img1 = this.timer_ringer_item.get_image()!
    const img2 = assets.load_image('p1_minigame_shoptender_timer_ringer_002.png')
    const img3 = assets.load_image('p1_minigame_shoptender_timer_ringer_003.png')
    const img4 = assets.load_image('p1_minigame_shoptender_timer_ringer_004.png')
    animations.start_image_sequence(this.timer_ringer_item, [img2, img3, img4, img1], 60, 10, null)
  }

  update_timer = (_item: unknown, _args: unknown) => {
    this.timer_topbar_item.set_top(this.timer_topbar_item.get_top() + 1)
    this.timer_line_item.set_top(this.timer_line_item.get_top() + 1)
    this.timer_line_item.set_height(this.timer_line_item.get_height() - 1)
    if (this.timer_line_item.get_height() === 1) {
      this.stop_minigame(false)
      this.stop_minigame_music(0)
      this.start_bell_animation()
      this.bell_sound.play()
      this.correct_words = 0
      this.wrong_words = 0
      this.letters_used = 0
      this.animation_on = true
      animations.wait_locked(this.stage, 2000, () => this.loose_game())
    }
  }

  load_help_data() {
    let background_image!: Image
    let back_left = 0, back_top = 0
    let upper_help_text = '', upper_text_left = 0, upper_text_top = 0, upper_text_width = 0, upper_text_height = 0
    let lower_help_text: string | null = null, lower_text_left = 0, lower_text_top = 0, lower_text_width = 0, lower_text_height = 0
    if (this.help_stage === 1) {
      background_image = assets.load_image('p1_minigame_librarian_help_d1.jpg')
      back_left = 125; back_top = 165
      upper_help_text = 'En la parte superior de la pantalla aparecerán las letras que debemos usar para formar palabras.'
      upper_text_left = 157; upper_text_top = 102; upper_text_width = 288; upper_text_height = 67
      lower_help_text = null
      this.help_previous_button.set_visible(false)
    } else if (this.help_stage === 2) {
      background_image = assets.load_image('p1_minigame_librarian_help_d2.jpg')
      back_left = 125; back_top = 139
      upper_help_text = 'Puedes seleccionarlas haciendo clic sobre ellas o escribiendolas en el teclado.'
      upper_text_left = 164; upper_text_top = 86; upper_text_width = 275; upper_text_height = 49
      lower_help_text = 'Lo mismo para el botón de borrar.'
      lower_text_left = 217; lower_text_top = 326; lower_text_width = 163; lower_text_height = 34
    } else if (this.help_stage === 3) {
      background_image = assets.load_image('p1_minigame_librarian_help_d3.jpg')
      back_left = 125; back_top = 157
      upper_help_text = 'Una vez que hayas escrito la palabra debes apretar el botón de aceptar o la tecla "enter" del teclado.'
      upper_text_left = 156; upper_text_top = 92; upper_text_width = 288; upper_text_height = 56
      lower_help_text = null
    } else if (this.help_stage === 4) {
      background_image = assets.load_image('p1_minigame_librarian_help_d4.jpg')
      back_left = 125; back_top = 152
      upper_help_text = 'Debes completar 5 palabras de al menos 3 letras cada una antes de que se acabe el tiempo y suene la campana.'
      upper_text_left = 155; upper_text_top = 92; upper_text_width = 288; upper_text_height = 56
      lower_help_text = null
    }
    const bg = new ItemImage(0, 0, null, null)
    bg.set_image(background_image)
    bg.set_lefttop(back_left, back_top)
    this.help_current_layer.add(bg)
    this.upper_help_text_item = new ItemText(upper_text_left, upper_text_top, this.font_14, 16, upper_help_text, [183, 35, 35], null, upper_text_width, upper_text_height, 2)
    this.help_current_layer.add(this.upper_help_text_item)
    if (lower_help_text != null) {
      this.lower_help_text_item = new ItemText(lower_text_left, lower_text_top, this.font_14, 16, lower_help_text, [183, 35, 35], null, lower_text_width, lower_text_height, 2)
      this.help_current_layer.add(this.lower_help_text_item)
    }
  }

  start_minigame(_animation_item: unknown = null) {
    this.stage.render()
    if (this.letters == null) {
      this.select_letters()
      this.reset_text()
    }
    if (!this.stage.is_timer_started('timer_librarian')) {
      this.play_music()
      this.stage.start_timer('timer_librarian', Math.trunc(1000 / this.adjustement_value), this.update_timer)
      this.timer.play(-1)
    }
    this.start_play_stats_event()
  }

  stop_minigame(solved: boolean) {
    if (this.stage.is_timer_started('timer_librarian')) {
      this.stage.stop_timer('timer_librarian')
      this.timer.stop()
      this.stop_minigame_music()
    }
    this.end_play_stats_event(solved)
  }

  set_up_game_background_items() {
    this.layer.add(new ItemImage(111, 79, assets.load_image('p1_minigame_librarian_back_center.jpg')))
    this.layer.add(new ItemImage(91, 79, assets.load_image('p1_minigame_librarian_back_left.png')))
    this.layer.add(new ItemImage(501, 79, assets.load_image('p1_minigame_librarian_back_right.png')))
    this.layer.add(new ItemImage(98, 50, assets.load_image('p1_minigame_librarian_back_top.png')))
    this.layer.add(new ItemImage(91, 356, assets.load_image('p1_minigame_librarian_back_bottom.png')))
    this.exit_button = new ItemImage(264, 47, assets.load_image('p1_minigames_btn_close_normal.png'))
    this.exit_button.set_rollover_image(assets.load_image('p1_minigames_btn_close_active.png'), this.rollover_sound)
    this.layer.add(this.exit_button)
    this.exit_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.help_button = new ItemImage(299, 47, assets.load_image('p1_minigames_btn_help_normal.png'))
    this.help_button.set_rollover_image(assets.load_image('p1_minigames_btn_help_active.png'), this.rollover_sound)
    this.help_button.add_event_handler(ItemEvent.CLICK, (i: any, a: any) => this.help_click(i, a))
    this.layer.add(this.help_button)
  }

  letter_click = (item: any, _args: unknown) => { this.type_letter(item.letter, [item.letter_item, item]) }

  button_click = (item: unknown, _args: unknown) => {
    if (item === this.delete_button) this.delete_letter()
    else if (item === this.accept_button) this.accept_text()
    else if (item === this.exit_button) {
      this.correct_words = 0
      this.wrong_words = 0
      this.letters_used = 0
      this.stop_minigame(false)
      this.phase1content.minigame_solved(false)
      this.close_minigame()
    }
  }

  check_for_minigame_finished() {
    if (this.timer_line_item.get_height() <= 1 || this.correct_words === this.correct_words_to_win) {
      this.stop_minigame(true)
      animations.wait_locked(this.stage, 1500, () => this.final_resolution())
    }
  }

  final_resolution(_item: unknown = null) {
    this.minigame_solved_callback()
    this.animation_on = false
  }

  select_letters() {
    this.correct_word_list = []
    this.letters = this.generate_letters()
    let i = 0
    for (const letter of this.letters) {
      this.letter_items[i][0].set_text(this.to_upper(letter))
      this.letter_items[i][1].letter = letter
      i += 1
    }
  }

  get_matches(dictionary: string[][]) {
    const matches: string[] = []
    for (const word of dictionary[0]) {
      let missing_letters = 0
      const available_letters = this.letters!.slice()
      for (const letter of word) {
        const i = available_letters.indexOf(letter)
        if (i >= 0) available_letters.splice(i, 1)
        else missing_letters += 1
      }
      if (missing_letters === 0) matches.push(word)
    }
    return matches
  }

  generate_letters(): string[] {
    const words = this.dictionary_small[0]
    const min_matches = this.letters_count >= 7 ? 4 * this.correct_words_to_win : 3 * this.correct_words_to_win
    for (;;) {
      const letters: string[] = []
      while (letters.length < this.letters_count) {
        const missing_letter_score = new Map<string, number>()
        for (const word of words) {
          let missing_letters = 0
          let available_letters = letters.slice()
          for (const letter of word) {
            const i = available_letters.indexOf(letter)
            if (i >= 0) available_letters.splice(i, 1)
            else missing_letters += 1
          }
          if (missing_letters > 0 && missing_letters <= this.letters_count - letters.length) {
            let word_score: number
            if (missing_letters === 1) word_score = 150
            else if (missing_letters === 2) word_score = 20
            else if (missing_letters === 3) word_score = 10
            else if (missing_letters === 4) word_score = 5
            else if (missing_letters === 5) word_score = 2
            else word_score = 1
            available_letters = letters.slice()
            for (const letter of word) {
              const i = available_letters.indexOf(letter)
              if (i >= 0) available_letters.splice(i, 1)
              else missing_letter_score.set(letter, (missing_letter_score.get(letter) ?? 0) + word_score)
            }
          }
        }
        const top_letters: string[] = []
        while (top_letters.length < 4) {
          let max_letter = ''
          let max_score = 0
          for (const [letter, score] of missing_letter_score) {
            if (score > max_score && !top_letters.includes(letter)) { max_letter = letter; max_score = score }
          }
          if (max_score === 0) break
          top_letters.push(max_letter)
        }
        if (top_letters.length > 0) letters.push(choice(top_letters))
        else {
          let letter_selected = false
          while (!letter_selected) {
            const word = choice(words)
            for (const letter of word) {
              if (!letters.includes(letter)) { letters.push(letter); letter_selected = true; break }
            }
          }
        }
      }
      let matches = 0
      for (const word of words) {
        let missing_letters = 0
        const available_letters = letters.slice()
        for (const letter of word) {
          const i = available_letters.indexOf(letter)
          if (i >= 0) available_letters.splice(i, 1)
          else missing_letters += 1
        }
        if (missing_letters === 0) matches += 1
      }
      if (matches >= min_matches) return letters
    }
  }

  type_letter(letter: string, letter_items: [ItemText, ItemImage] | null = null) {
    if (this.typed_text.length < this.typed_letter_items.length) {
      if (letter_items == null) {
        for (const [item, back_item] of this.letter_items) {
          if (back_item.letter === letter && back_item.get_visible()) { letter_items = [item, back_item]; break }
        }
      }
      if (letter_items != null) {
        this.typed_text += letter
        this.typed_letter_items[this.typed_text.length - 1].set_text(this.to_upper(letter))
        letter_items[0].set_visible(false)
        letter_items[1].set_visible(false)
        this.stage.render()
        this.type_sound.play()
      }
    }
  }

  to_upper(letter: string) {
    if (letter === 'á') return 'Á'
    if (letter === 'é') return 'É'
    if (letter === 'í') return 'Í'
    if (letter === 'ó') return 'Ó'
    if (letter === 'ú') return 'Ú'
    if (letter === 'ñ') return 'Ñ'
    if (letter === 'ü') return 'Ü'
    return letter.toUpperCase()
  }

  delete_letter() {
    if (this.typed_text.length > 0) {
      const letter = this.typed_text[this.typed_text.length - 1]
      let letter_item: [ItemText, ItemImage] | null = null
      for (const [item, back_item] of this.letter_items) {
        if (back_item.letter === letter && !back_item.get_visible()) { letter_item = [item, back_item]; break }
      }
      letter_item![0].set_visible(true)
      letter_item![1].set_visible(true)
      this.typed_text = this.typed_text.slice(0, this.typed_text.length - 1)
      this.typed_letter_items[this.typed_text.length].set_text('')
      this.stage.render()
      this.erase_sound.play()
    }
  }

  accept_text() {
    if (this.typed_text.length > 0) {
      let word_to_add: string | null = null
      const index = this.dictionary_full[0].indexOf(this.typed_text)
      if (index >= 0) word_to_add = this.dictionary_full[1][index]
      if (word_to_add != null && !this.correct_word_list.includes(word_to_add)) {
        this.add_correct_word(word_to_add)
        this.start_result_animation(true)
        this.stage.render()
        this.correct_choice.play()
        this.check_for_minigame_finished()
      } else {
        if (!this.correct_word_list.includes(word_to_add as string)) this.wrong_words += 1
        this.start_result_animation(false)
        this.stage.render()
        this.incorrect_choice.play()
      }
      this.reset_text()
    }
  }

  reset_text() {
    this.typed_text = ''
    for (const [item, back_item] of this.letter_items) {
      item.set_visible(true)
      back_item.set_visible(true)
    }
    for (const item of this.typed_letter_items) item.set_text('')
  }

  add_correct_word(word: string) {
    if (!this.correct_word_list.includes(word)) {
      let number_x = 0, number_y = 0, tick_x = 0, tick_y = 0, text_x = 0, text_y = 0
      if (this.correct_words === 0) { number_x = 233; number_y = 295; tick_x = 344; tick_y = 279; text_x = 249; text_y = 289 }
      else if (this.correct_words === 1) { number_x = 233; number_y = 315; tick_x = 344; tick_y = 299; text_x = 249; text_y = 312 }
      else if (this.correct_words === 2) { number_x = 233; number_y = 337; tick_x = 344; tick_y = 321; text_x = 249; text_y = 332 }
      else if (this.correct_words === 3) { number_x = 233; number_y = 356; tick_x = 344; tick_y = 342; text_x = 249; text_y = 352 }
      else if (this.correct_words === 4) { number_x = 233; number_y = 379; tick_x = 344; tick_y = 364; text_x = 249; text_y = 375 }
      const number = String(this.correct_words + 1)
      this.layer.add(new ItemImage(number_x, number_y, assets.load_image('p1_minigame_librarian_' + number + 'listed.jpg')))
      this.layer.add(new ItemImage(tick_x, tick_y, this.rightmark_image))
      let word_upper = ''
      for (const c of word) word_upper += this.to_upper(c)
      this.layer.add(new ItemText(text_x, text_y, this.powdrf_18, 0, word_upper, [150, 20, 15], null, 103, 25, 2))
      this.correct_words += 1
      this.correct_word_list.push(word)
      this.letters_used += word.length
    }
  }

  minigame_handle_event(e: PgEvent) {
    if (e.type === KEYDOWN) {
      if (this.stage.is_timer_started('timer_librarian')) {
        if (e.key === K.K_BACKSPACE) this.delete_letter()
        else if (e.key === K.K_RETURN || e.key === K.K_KP_ENTER) this.accept_text()
        else {
          const u = e.unicode ?? ''
          let valid = true
          for (const c of u) if (c.charCodeAt(0) >= 256) { valid = false; break }
          if (valid && u !== '') {
            const letter = u.toLowerCase()
            if (this.letters != null && this.letters.includes(letter)) this.type_letter(letter)
          }
        }
      }
    }
    super.minigame_handle_event(e)
    return undefined
  }

  start_result_animation(good: boolean) {
    new ResultAnimation(this.stage, this, this.result_layer, good).start()
  }

  calculate_solved_score() {
    const remaining_time = Math.min(this.timer_complete_time, this.timer_line_item.get_height() / this.adjustement_value)
    const elapsed_time = this.timer_complete_time - remaining_time
    const time_score = elapsed_time <= this.average_time ? (128 * (this.average_time - elapsed_time)) / this.average_time : 0
    return [100, time_score, this.letters_used * 1, -10 * this.wrong_words]
  }

  create_character_happy_item() {
    return new ItemImage(447, 77, assets.load_image('p1_minigame_librarian_happy.png'), null)
  }
}

export class ResultAnimation {
  stage: any
  result_layer: Layer
  color_image: Image
  white_image: Image
  color_item: ItemImage
  white_item: ItemImage

  constructor(stage: any, minigame: MinigameLibrarian, result_layer: Layer, good: boolean) {
    this.stage = stage
    this.result_layer = result_layer
    if (good) { this.color_image = minigame.good_color_image; this.white_image = minigame.good_white_image }
    else { this.color_image = minigame.bad_color_image; this.white_image = minigame.bad_white_image }
    this.color_item = new ItemImage(240, 160, this.color_image)
    this.white_item = new ItemImage(240, 160, this.white_image)
  }

  start() {
    this.result_layer.add(this.color_item)
    this.result_layer.add(this.white_item)
    animations.fade_out_item(this.white_item, true, 167, (i) => this._fade_out_callback(i))
  }

  private _fade_out_callback(_item: unknown) { animations.wait(this.stage, 167, () => this._wait_callback()) }

  private _wait_callback() {
    if (this.result_layer.get_stage() != null) {
      animations.start_move(this.color_item, this.color_item.get_left(), this.color_item.get_top() - 95, 400)
      animations.fade_out_item(this.color_item, true, 400)
    }
  }
}
