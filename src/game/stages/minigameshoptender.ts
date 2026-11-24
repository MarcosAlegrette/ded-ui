// Port de game/stages/minigameshoptender.py: la almacenera (adivinar el signo de la cuenta).
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import { ItemImage, ItemText, ItemRect, ItemEvent, KEYDOWN, type Layer } from '../../framework/stage.ts'
import type { Image } from '../../framework/assets.ts'
import type { PgEvent } from '../../pg/events.ts'
import { idiv, pmod, randint } from '../../pg/py.ts'
import { Minigame } from './minigame.ts'
import * as statcodes from '../data/statcodes.ts'

export class MinigameShoptender extends Minigame {
  constructor(stage: any, phase1content: any, witness: any) {
    super(stage, phase1content, witness, statcodes.MG_SHOPTENDER, statcodes.MG_SHOPTENDER_SOLVED, statcodes.MG_SHOPTENDER_NOTSOLVED, 'shoptender')
    this.correct_answers = 0
    this.wrong_answers = 0
    this.animation_on = false
    this.font_35 = assets.load_font('jstart.ttf', 35)
    this.bell_sound = assets.load_sound('p1_minigame_bell.ogg')
    this.correct_choice = assets.load_sound('p1_minigame_right.ogg')
    this.incorrect_choice = assets.load_sound('p1_minigame_wrong.ogg')
    this.timer = assets.load_sound('p1_minigame_timer.ogg')
    this.witness_item = new ItemImage(459, 44, assets.load_image('p1_minigame_shoptender.png'), null)
    this.witness_minigame_box_image = assets.load_image('p1_minigame_flux_shoptender_dialogue1.png')
    this.title = 'ALMACENERA'
    this.question_intro = 'La Almacenera se encuentra muy ocupada\nen este momento, quizás si la ayudas\npuedas interrogarla luego.'
    this.question = '¿Te ofreces a ayudarla?'
    this.request_text = 'Estaba pasando las ventas de hoy al libro de\ncuentas, pero se me manchó la libreta\ndonde hago las operaciones y\nno puedo ver su signo.'
    this.request_question_text = '¿Me ayudas a completarlas?'
    this.thanks_text = '¡Muchas gracias!\n\nAhora puedo terminar de actualizar\n el libro de cuentas.'
    this.wait_wrong_symbol_key = null
    this.fade_stain_key = null
  }

  get_music() { return this.phase1content.music_minigame_2 }

  blind_show_minigame_callback(_layer: Layer) {
    const cp = this.stage.game.datastore.user_character_progress
    if (!cp.minigame_shoptender_help_seen) {
      this.stop_minigame(false)
      cp.minigame_shoptender_help_seen = true
      this.show_help_dialog()
    } else this.start_minigame()
  }

  set_up_minigame() {
    this.set_up_game_background_items()
    this.set_up_game_symbols()
    this.set_up_timer()
    this.set_up_witness()
    this.set_up_counters()
  }

  set_up_counters() {
    this.actual_counter = 0
    const counter_back_image = assets.load_image('p1_minigame_shoptender_counter_bkg.png')
    for (let i = 1; i <= 5; i++) {
      this['counter' + i + '_on_image'] = assets.load_image('p1_minigame_shoptender_counter_s' + i + '_on.png')
      this['counter' + i + '_off_image'] = assets.load_image('p1_minigame_shoptender_counter_s' + i + '_off.png')
    }
    const counter_back = new ItemImage(217, 84, counter_back_image, null)
    this.counter1_item = new ItemImage(217, 85, this.counter1_off_image, null)
    this.counter2_item = new ItemImage(252, 85, this.counter2_off_image, null)
    this.counter3_item = new ItemImage(285, 85, this.counter3_off_image, null)
    this.counter4_item = new ItemImage(319, 85, this.counter4_off_image, null)
    this.counter5_item = new ItemImage(354, 84, this.counter5_off_image, null)
    this.layer.add(counter_back)
    this.layer.add(this.counter1_item)
    this.layer.add(this.counter2_item)
    this.layer.add(this.counter3_item)
    this.layer.add(this.counter4_item)
    this.layer.add(this.counter5_item)
  }

  set_up_timer() {
    const level = this.stage.game.datastore.user_character_progress.range.level
    if (level === 0) { this.average_time = 50; this.timer_complete_time = 75 }
    else if (level === 1) { this.average_time = 43; this.timer_complete_time = 65 }
    else if (level === 2) { this.average_time = 36; this.timer_complete_time = 54 }
    else if (level === 3) { this.average_time = 29; this.timer_complete_time = 44 }
    else if (level === 4) { this.average_time = 22; this.timer_complete_time = 33 }
    else { this.average_time = 15; this.timer_complete_time = 23 }
    const timer_backbar_item = new ItemImage(144, 129, assets.load_image('p1_minigame_shoptender_timer_backbar.jpg'), null)
    this.timer_line_item = new ItemRect(149, 136, 11, 128, null, 0, '', [0, 0, 0], [236, 14, 36])
    this.adjustement_value = this.timer_line_item.get_height() / this.timer_complete_time
    this.timer_topbar_item = new ItemImage(146, 122, assets.load_image('p1_minigame_shoptender_timer_topbar.png'), null)
    const timer_barshadow_item = new ItemImage(142, 128, assets.load_image('p1_minigame_shoptender_timer_barshadow.png'), null)
    const timer_front_item = new ItemImage(135, 118, assets.load_image('p1_minigame_shoptender_timer_front.png'), null)
    this.timer_ringer_item = new ItemImage(104, 253, assets.load_image('p1_minigame_shoptender_timer_ringer_001.png'), null)
    this.layer.add(timer_backbar_item)
    this.layer.add(this.timer_line_item)
    this.layer.add(this.timer_topbar_item)
    this.layer.add(timer_barshadow_item)
    this.layer.add(timer_front_item)
    this.layer.add(this.timer_ringer_item)
  }

  start_bell_animation() {
    const timer_ringer_image = this.timer_ringer_item.get_image()
    const i2 = assets.load_image('p1_minigame_shoptender_timer_ringer_002.png')
    const i3 = assets.load_image('p1_minigame_shoptender_timer_ringer_003.png')
    const i4 = assets.load_image('p1_minigame_shoptender_timer_ringer_004.png')
    animations.start_image_sequence(this.timer_ringer_item, [i2, i3, i4, timer_ringer_image], 60, 10, null)
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
      this.correct_answers = 0
      this.wrong_answers = 0
      this.animation_on = true
      animations.wait_locked(this.stage, 2000, this.loose_game)
    }
  }

  load_help_data() {
    const back_left = 125, back_top = 154
    let background_image: Image | null = null
    let upper_help_text = '', upper_text_left = 0, upper_text_top = 0, upper_text_width = 0, upper_text_height = 0
    let lower_help_text: string | null = null, lower_text_left = 0, lower_text_top = 0, lower_text_width = 0, lower_text_height = 0
    if (this.help_stage === 1) {
      background_image = assets.load_image('p1_minigame_shoptender_help_d1.jpg')
      upper_help_text = 'En la libreta aparece la cuenta con el signo tapado por la mancha.'
      upper_text_left = 203; upper_text_top = 96; upper_text_width = 193; upper_text_height = 52
      this.help_previous_button.set_visible(false)
    } else if (this.help_stage === 2) {
      background_image = assets.load_image('p1_minigame_shoptender_help_d2.jpg')
      upper_help_text = 'Debajo de la libreta, debemos elegir el signo que corresponda a la cuenta.'
      upper_text_left = 157; upper_text_top = 104; upper_text_width = 288; upper_text_height = 43
    } else if (this.help_stage === 3) {
      background_image = assets.load_image('p1_minigame_shoptender_help_d3.jpg')
      upper_help_text = 'Debemos completar correctamente 5 cuentas antes de que se acabe el tiempo y suene la campana.'
      upper_text_left = 157; upper_text_top = 96; upper_text_width = 288; upper_text_height = 52
      lower_help_text = 'Cada error resta un acierto.'
      lower_text_left = 159; lower_text_top = 341; lower_text_width = 289; lower_text_height = 18
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
    if (!this.stage.is_timer_started('timer_shoptender')) {
      this.play_music()
      this.stage.start_timer('timer_shoptender', Math.trunc(1000 / this.adjustement_value), this.update_timer)
      this.timer.play(-1)
    }
    this.build_operation()
    this.start_play_stats_event()
  }

  stop_minigame(solved: boolean) {
    if (this.stage.is_timer_started('timer_shoptender')) {
      this.stage.stop_timer('timer_shoptender')
      this.timer.stop()
      this.stop_minigame_music()
    }
    this.end_play_stats_event(solved)
  }

  set_up_game_background_items() {
    this.layer.add(new ItemImage(26, 14, assets.load_image('p1_minigame_shoptender_background.png')))
    this.exit_button = new ItemImage(261, 45, assets.load_image('p1_minigames_btn_close_normal.png'))
    this.exit_button.set_rollover_image(assets.load_image('p1_minigames_btn_close_active.png'), this.rollover_sound)
    this.layer.add(this.exit_button)
    this.exit_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.help_button = new ItemImage(296, 45, assets.load_image('p1_minigames_btn_help_normal.png'))
    this.help_button.set_rollover_image(assets.load_image('p1_minigames_btn_help_active.png'), this.rollover_sound)
    this.help_button.add_event_handler(ItemEvent.CLICK, this.help_click)
    this.layer.add(this.help_button)
    this.stain_item_image = new ItemImage(194, 147, assets.load_image('p1_minigame_shoptender_stain.png'))
    this.layer.add(this.stain_item_image)
    this.success_symbols_list = []
    for (const n of ['add', 'substract', 'multiply', 'divide']) this.success_symbols_list.push(new ItemImage(232, 179, assets.load_image('p1_minigame_shoptender_' + n + '.png')))
    for (const s of this.success_symbols_list) {
      s.set_visible(false)
      this.layer.add(s)
    }
    this.number_lines_list = []
    for (const top of [154, 198, 258]) {
      const t = new ItemText(220, top, this.font_35, 0, '', [71, 71, 130], null, 140, 36, 3)
      this.number_lines_list.push(t)
    }
    for (const t of this.number_lines_list) this.layer.add(t)
  }

  set_up_game_symbols() {
    this.symbol_list = []
    this.symbol_list_wrong = []
    for (let i = 0; i < 4; i++) {
      const symbol_item = new ItemImage(207 + i * 50, 312, assets.load_image('p1_minigame_shoptender_btn_00' + (i + 1) + '_standby.png'))
      symbol_item.set_rollover_image(assets.load_image('p1_minigame_shoptender_btn_00' + (i + 1) + '_hover.png'), this.rollover_sound)
      this.symbol_list.push(symbol_item)
      const symbol_item_wrong = new ItemImage(207 + i * 50, 312, assets.load_image('p1_minigame_shoptender_btn_00' + (i + 1) + '_wrong.png'))
      this.symbol_list_wrong.push(symbol_item_wrong)
      this.layer.add(symbol_item)
      symbol_item_wrong.set_visible(false)
      this.layer.add(symbol_item_wrong)
      symbol_item.add_event_handler(ItemEvent.CLICK, this.button_click)
    }
  }

  update_counters(success: boolean) {
    if (success) {
      this.actual_counter += 1
      if (this.actual_counter >= 1 && this.actual_counter <= 5) this['counter' + this.actual_counter + '_item'].set_image(this['counter' + this.actual_counter + '_on_image'])
    } else if (this.actual_counter > 0) {
      this.actual_counter -= 1
      const n = this.actual_counter + 1
      if (n >= 1 && n <= 5) this['counter' + n + '_item'].set_image(this['counter' + n + '_off_image'])
    }
  }

  button_click = (item: unknown, _args: unknown) => {
    if (item === this.exit_button) {
      this.correct_answers = 0
      this.stop_minigame(false)
      this.phase1content.minigame_solved(false)
      this.close_minigame()
    } else if (this.symbol_list.includes(item)) this.symbol_click(item)
  }

  minigame_handle_event(e: PgEvent): unknown {
    if (e.type === KEYDOWN && this.stage.is_timer_started('timer_shoptender')) {
      if (e.unicode === '+') this.symbol_click(this.symbol_list[0])
      else if (e.unicode === '-') this.symbol_click(this.symbol_list[1])
      else if (e.unicode === '*') this.symbol_click(this.symbol_list[2])
      else if (e.unicode === '/') this.symbol_click(this.symbol_list[3])
    }
    return undefined
  }

  symbol_click(item: any) {
    if (!this.animation_on && this.timer_line_item.get_height() > 1) {
      this.animation_on = true
      const idx = this.symbol_list.indexOf(item)
      if (this.operation_correct_answer.includes(idx)) {
        this.correct_answers += 1
        this.success_symbols_list[idx].set_visible(true)
        this.update_counters(true)
        this.correct_choice.play()
        this.check_for_minigame_finished()
        this.stage.lock_ui()
        this.fade_stain_key = animations.fade_out_item(this.stain_item_image, false, 500, this.animations_resolution)
      } else {
        this.wrong_answers += 1
        if (this.correct_answers > 0) this.correct_answers -= 1
        this.check_for_minigame_finished()
        this.set_wrong_symbol_list(true)
        this.update_counters(false)
        this.stage.render()
        this.incorrect_choice.play()
        this.wait_wrong_symbol_key = animations.wait_locked(this.stage, 500, () => this.set_wrong_symbol_list())
      }
    }
  }

  check_for_minigame_finished() {
    if (this.timer_line_item.get_height() <= 1 || this.correct_answers === 5) this.stop_minigame(true)
  }

  animations_resolution = (_item: unknown) => {
    if (this.correct_answers < 5) {
      this.check_for_minigame_finished()
      animations.fade_in_item(this.stain_item_image, 500, this.final_resolution)
    } else animations.wait_locked(this.stage, 500, () => this.final_resolution())
  }

  final_resolution = (_item: unknown = null) => {
    this.stage.unlock_ui()
    for (const s of this.success_symbols_list) if (s.get_visible()) s.set_visible(false)
    if (this.correct_answers < 5) {
      this.check_for_minigame_finished()
      if (this.timer_line_item.get_height() > 1) this.start_minigame()
    } else this.minigame_solved_callback()
    this.animation_on = false
  }

  set_wrong_symbol_list(state = false) {
    for (let i = 0; i < this.symbol_list_wrong.length; i++) {
      this.symbol_list_wrong[i].set_visible(state)
      this.symbol_list[i].set_visible(!state)
    }
    if (state !== true) {
      this.animation_on = false
      this.check_for_minigame_finished()
      if (this.timer_line_item.get_height() > 1) this.start_minigame()
    }
  }

  build_operation() {
    const type_operation = randint(0, 3)
    const max_number_accepted = 100
    let n1 = 0, n2 = 0, n3 = 0
    if (type_operation === 0) {
      n1 = randint(1, max_number_accepted)
      n2 = randint(0, max_number_accepted - n1)
      n3 = n1 + n2
    }
    if (type_operation === 1) {
      n1 = randint(1, max_number_accepted)
      n2 = randint(1, n1)
      n3 = n1 - n2
    }
    if (type_operation === 2) {
      const controled_range = idiv(max_number_accepted, 2)
      n1 = randint(1, idiv(controled_range, 2))
      n2 = randint(0, idiv(max_number_accepted, n1))
      n3 = n1 * n2
    } else if (type_operation === 3) {
      let tries = 1
      while (tries < 5) {
        n1 = randint(2, max_number_accepted)
        let remaining = 1
        while (remaining !== 0) {
          n2 = randint(2, n1)
          n3 = idiv(n1, n2)
          remaining = pmod(n1, n2)
        }
        if (n3 !== 1 && n3 !== 2) break
        else tries += 1
      }
    }
    this.operation_correct_answer = []
    if (n1 + n2 === n3) this.operation_correct_answer.push(0)
    if (n1 - n2 === n3) this.operation_correct_answer.push(1)
    if (n1 * n2 === n3) this.operation_correct_answer.push(2)
    if (n2 !== 0 && idiv(n1, n2) === n3) this.operation_correct_answer.push(3)
    this.number_lines_list[0].set_text(String(n1))
    this.number_lines_list[1].set_text(String(n2))
    this.number_lines_list[2].set_text(String(n3))
  }

  calculate_solved_score() {
    const remaining_time = Math.min(this.timer_complete_time, this.timer_line_item.get_height() / this.adjustement_value)
    const elapsed_time = this.timer_complete_time - remaining_time
    const time_score = elapsed_time <= this.average_time ? (142.85 * (this.average_time - elapsed_time)) / this.average_time : 0
    return [100, time_score, -10 * this.wrong_answers]
  }

  create_character_happy_item() {
    return new ItemImage(459, 44, assets.load_image('p1_minigame_shoptender_happy.png'), null)
  }
}
