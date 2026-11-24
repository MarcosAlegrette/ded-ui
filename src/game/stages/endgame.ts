// Port de game/stages/endgame.py: final del caso (diario, puntajes, medallas y ascensos).
// El original encriptaba los récords (des) y los enviaba a ws.trojanchicken.com; acá nunca se
// contacta ese servidor: el resultado se informa (opcionalmente) a la API compartida del sitio.
import { Layer, ItemImage, ItemMask, ItemText, ItemEvent, KEYDOWN, K, pygame } from '../../framework/stage.ts'
import * as animations from '../../framework/animations.ts'
import { BlindDirection } from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import * as text from '../../framework/text.ts'
import type { CustomSound, Image } from '../../framework/assets.ts'
import type { Font } from '../../pg/font.ts'
import type { PgEvent } from '../../pg/events.ts'
import { choice, idiv, int } from '../../pg/py.ts'
import * as datastore from '../data/datastore.ts'
import * as statcodes from '../data/statcodes.ts'
import * as datamodel from '../data/datamodel.ts'
import * as minigame from './minigame.ts'
import * as merits from './merits.ts'
import * as startscreen from './startscreen.ts'
import { useShell } from '../../ui/shell.ts'

export const EndReason = { TIME_UP: 0, ARRIVED_LOCATION: 1, ARRIVED_WRONG_LOCATION: 2 }

export class EndGame {
  stage: any
  reason: number
  layer = new Layer()
  font_13: Font; font_13_bold: Font; font_14: Font; font_14_bold: Font; font_16: Font; font_18: Font
  rollover_sound: CustomSound
  continue_sound: CustomSound
  bell_sound!: CustomSound
  right_sound!: CustomSound
  medal_sound!: CustomSound
  promotion_sound!: CustomSound
  case_solved: boolean
  caught_thief: any
  next_visible = false
  continue_visible = false
  score_continue_visible = false
  /** asignado por phase1 cuando se llega a un departamento equivocado */
  wrong_location_callback: (() => void) | null = null;
  // estado dinámico como en Python
  [k: string]: any

  constructor(stage: any, reason: number) {
    this.stage = stage
    this.reason = reason
    this.font_13 = assets.load_font('evilgeniusbb_reg.ttf', 13)
    this.font_13_bold = assets.load_font('evilgeniusbb_bld.ttf', 13)
    this.font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    this.font_14_bold = assets.load_font('evilgeniusbb_bld.ttf', 14)
    this.font_16 = assets.load_font('evilgeniusbb_reg.ttf', 16)
    this.font_18 = assets.load_font('evilgeniusbb_reg.ttf', 18)
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.continue_sound = assets.load_sound('GUI_Click.ogg')
    if (reason === EndReason.TIME_UP) this.bell_sound = assets.load_sound('P0_Clock_Ring.ogg')
    else {
      this.right_sound = assets.load_sound('p1_minigame_right.ogg')
      this.medal_sound = assets.load_sound('p0_medal_bugle.ogg')
      this.promotion_sound = assets.load_sound('p0_promotion_bugle.ogg')
    }
    this.case_solved = this.case_is_solved()
    this.caught_thief = this.stage.game.datastore.user_character_progress.case.caught_thief
  }

  build_fast_click() {
    this.screen_mask = new ItemMask(0, 0, [600, 450])
    this.screen_mask.add_event_handler(ItemEvent.CLICK, this.screen_click)
    this.layer.add(this.screen_mask)
  }

  screen_click = (_item: any, _args: any) => { this.screen_next(true) }

  screen_next(fast = false) {
    if (this.effect_number !== 0) {
      if (!this.continue_button_layer) {
        this.stage.stop_timers()
        this.show_blinds_down_effect(fast)
      }
    }
  }

  show_final_screen(blind_background: boolean) {
    this.layer.empty()
    this.continue_button_layer = null
    this.stage.show_dialog(this.layer, this.final_screen_handle_event)
    this.set_up_final_screen()
    this.effect_number = 0
    this.stage.blind_dialog(this.layer, BlindDirection.SHOW_DOWN, blind_background, [], this.blind_show_final_callback)
    this.build_fast_click()
  }

  blind_show_final_callback = (_layer: any) => { this.build_left_box() }

  final_screen_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.continue_sound.play()
      if (this.continue_visible) this.continue_with_next()
      else if (this.score_continue_visible) this.score_continue()
      else this.screen_next(true)
    }
  }

  set_up_final_screen() {
    const c = this.stage.game.datastore.user_character_progress.case
    this.layer.add(new ItemImage(59, 27, assets.load_image('p0_endings_newspaper.png'), null))
    this.layer.add(new ItemImage(85, 188, assets.load_image(c.thief.identikit_large_image_front), null))
    this.layer.add(new ItemImage(217, 188, assets.load_image(c.thief.identikit_large_image_side), null))
    let header_image: Image
    if (this.case_solved && this.caught_thief) {
      header_image = assets.load_image('p0_endings_newspaper_win_header.gif')
      this.layer.add(new ItemImage(85, 188, assets.load_image('p0_endings_win_jail.png'), null))
      this.calculate_score()
      this.add_resolved_case()
      this.add_medal()
    } else header_image = assets.load_image('p0_endings_newspaper_loose_header.gif')
    this.layer.add(new ItemImage(81, 111, header_image, null))
  }

  calculate_score() {
    const ds = this.stage.game.datastore
    const cp = ds.user_character_progress
    const c = cp.case
    const level = cp.range.level
    this.clues_found = c.clues_found.length
    this.remaining_turns = c.time_limit - c.time_spend
    this.scores = [1000 + level * 1000, 100 * this.clues_found, this.remaining_turns * (100 + level * 100)]
    this.total_score = 0
    for (const s of this.scores) this.total_score += s
    cp.score += this.total_score
    ds.add_score('total', ds.user_character, cp.score)
    ds.save_highscores()
  }

  add_resolved_case() {
    const cp = this.stage.game.datastore.user_character_progress
    cp.resolved_cases += 1
    this.promoted = cp.range.update()
    const c = cp.case
    if (!cp.captured_thieves.includes(c.thief)) cp.captured_thieves.push(c.thief)
    const dep = cp.case.crime_location.department
    if (!cp.list_departments_solved.includes(dep)) cp.list_departments_solved.push(dep)
  }

  add_tutorial_medal() {
    const cp = this.stage.game.datastore.user_character_progress
    this.medal_name = cp.case.crime_location.department.image
    cp.add_medal('tut')
  }

  add_medal() {
    const cp = this.stage.game.datastore.user_character_progress
    const c = cp.case
    this.medal_name = c.crime_location.department.image
    cp.add_medal(c.crime_location.department.image)
    const department_medals: Record<string, number> = {}
    let uy_medals = 0
    for (const d of this.stage.game.datastore.list_departments) department_medals[d.image] = 0
    for (const m of cp.medals) {
      if (m.name in department_medals) department_medals[m.name] = m.count
      else if (m.name === 'uy') uy_medals = m.count
    }
    let won_uy_medals = 999
    for (const count of Object.values(department_medals)) if (count < won_uy_medals) won_uy_medals = count
    this.won_uy_medal = false
    while (uy_medals < won_uy_medals) {
      cp.add_medal('uy')
      uy_medals += 1
      this.won_uy_medal = true
    }
  }

  build_continue_button(fast = false) {
    this.continue_button_layer = new Layer()
    this.continue_button = new ItemImage(421, 395, assets.load_image('p0_endings_btn_continue_normal.png'))
    this.continue_button.set_rollover_image(assets.load_image('p0_endings_btn_continue_rollover.png'), this.rollover_sound)
    this.continue_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.continue_button_layer.add(this.continue_button)
    if (fast) this.show_blinds_down_effect()
    else animations.wait(this.stage, 1000, () => this.show_blinds_down_effect())
  }

  build_left_box() {
    this.left_box_layer = new Layer()
    this.left_box_layer.add(new ItemImage(7, 50, assets.load_image('p0_endings_win+loose_d2_back.png')))
    if (this.case_solved && this.caught_thief) {
      const character_name = this.stage.game.datastore.user_character.charinfo.name
      const message = '¡Felicitaciones! &#f:f14!Agente&#f!\n\n' + '&#c102,0,0!&#f:f16!' + character_name + '&#f!&#c!\n'
      const additional_fonts: Record<string, [Font, number]> = { f14: [this.font_14, 13], f16: [this.font_16, 15] }
      this.left_box_layer.add(new ItemText(32, 60, this.font_14_bold, 13, message, [54, 45, 45], null, 264, 70, 2, 2, additional_fonts))
    } else {
      const text1 = new ItemText(59, 68, this.font_14_bold, 13, 'Mejor suerte', [54, 45, 45], null, 120, 20, 2, 2)
      const text2 = new ItemText(174, 69, this.font_14, 13, 'La próxima', [54, 45, 45], null, 90, 20, 2, 2)
      const text3 = new ItemText(117, 85, this.font_14, 13, 'vez agente', [54, 45, 45], null, 90, 20, 2, 2)
      this.left_box_layer.add(text3)
      this.left_box_layer.add(new ItemText(63, 105, this.font_16, 15, this.stage.game.datastore.user_character.charinfo.name, [102, 0, 0], null, 196, 20, 2, 2))
      this.left_box_layer.add(text1)
      this.left_box_layer.add(text2)
    }
    this.effect_number = 1
    animations.wait(this.stage, 2500, () => this.show_blinds_down_effect())
  }

  show_blinds_down_effect(fast = false) {
    if (this.effect_number !== 0) {
      if (this.effect_number === 1) {
        this.stage.add_layer(this.left_box_layer)
        this.effect_number = 2
        this.build_right_box()
      } else if (this.effect_number === 2) {
        this.stage.add_layer(this.right_box_layer)
        this.effect_number = 3
        this.build_continue_button(fast)
      } else if (this.effect_number === 3) {
        this.continue_visible = true
        this.stage.add_layer(this.continue_button_layer)
      }
    }
  }

  build_right_box() {
    this.right_box_layer = new Layer()
    const L = this.right_box_layer
    const black = [0, 0, 0]
    if (this.reason === EndReason.ARRIVED_LOCATION) {
      if (this.case_solved && this.caught_thief) {
        L.add(new ItemImage(413, 317, assets.load_image('p0_endings_win_d3_back.png')))
        L.add(new ItemText(425, 321, this.font_14_bold, 16, '¡Has resuelto este caso!', black, null, 140, 60, 2, 2))
      } else if (this.caught_thief == null) {
        const right_box_image = new ItemImage(346, 304, assets.load_image('p0_endings_loose_d3_back.png'))
        L.add(right_box_image)
        L.add(new ItemText(362, 322, this.font_13, 16, 'Debes prestar', black, null, 100, 20, 2, 2))
        L.add(new ItemText(441, 320, this.font_13_bold, 16, 'Más atención', black, null, 150, 20, 2, 2))
        L.add(new ItemText(565, 322, this.font_13, 16, 'a', black, null, 20, 20, 2, 2))
        L.add(new ItemText(396, 338, this.font_13, 16, 'los', black, null, 30, 20, 2, 2))
        L.add(new ItemText(423, 336, this.font_13_bold, 16, 'datos', black, null, 50, 20, 2, 2))
        L.add(new ItemText(457, 338, this.font_13, 16, 'que te den', black, null, 100, 20, 2, 2))
        L.add(new ItemText(420, 354, this.font_13, 16, 'los', black, null, 30, 20, 2, 2))
        L.add(new ItemText(448, 352, this.font_13_bold, 16, 'testigos.', black, null, 75, 20, 2, 2))
      } else {
        L.add(new ItemImage(346, 304, assets.load_image('p0_endings_loose_d3_back.png')))
        L.add(new ItemText(362, 322, this.font_13, 16, 'Intenta ser más rápido', black, null, 220, 52, 2, 2))
      }
    } else if (this.reason === EndReason.TIME_UP) {
      const right_box_image = new ItemImage(346, 304, assets.load_image('p0_endings_loose_d3_back.png'))
      L.add(right_box_image)
      L.add(new ItemText(348, 301, this.font_14, 16, 'intenta estudiar &#f:bld!más detalladamente&#f! las pistas.', black, null, right_box_image.get_width(), right_box_image.get_height(), 2, 2, { bld: [this.font_14_bold, 18, 0] }))
    }
    animations.wait(this.stage, 1000, () => this.show_blinds_down_effect())
  }

  show_opening_dialog(blind_background = true) {
    if (this.caught_thief != null && !this.caught_thief) {
      this.next_button = null
      this.show_final_screen(blind_background)
    } else {
      this.stage.show_dialog(this.layer, this.openining_handle_event)
      if (blind_background) this.stage.blind_dialog(this.layer, BlindDirection.SHOW_DOWN, blind_background, [], this.blind_show_opening_callback)
      else this.blind_show_opening_callback()
    }
  }

  blind_show_opening_callback = (_layer: any = null) => {
    this.set_up_opening_dialog()
    this.stage.blind_dialog(this.layer, BlindDirection.SHOW_DOWN, false, [])
    if (this.reason === EndReason.TIME_UP) animations.wait(this.stage, 40, () => this.play_bell())
  }

  score_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.continue_sound.play()
      if (this.continue_visible) this.continue_with_next()
      else if (this.score_continue_visible) this.score_continue()
      else if (this.showing_scores && !this.skip_scores_animation) this.skip_scores_animation = true
      else if (this.next_visible) this.go_next()
    }
  }

  openining_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.continue_sound.play()
      if (this.next_visible) this.go_next()
    }
  }

  play_bell() {
    this.stage.render()
    this.bell_sound.play()
  }

  set_up_opening_dialog() {
    let dialog_box_image!: Image
    let left = 0, top = 0, box_text_w = 0, box_text_h = 0, next_button_x = 0, next_button_y = 0
    if (this.reason === EndReason.ARRIVED_LOCATION) {
      if (this.case_solved) {
        dialog_box_image = assets.load_image('p0_endings_win_d1_back.png')
        left = 95; top = 15; box_text_w = 336; box_text_h = 212; next_button_x = 282; next_button_y = 303
      } else {
        dialog_box_image = assets.load_image('p0_endings_loose_d1_back.png')
        left = 101; top = 19; box_text_w = 336; box_text_h = 212; next_button_x = 282; next_button_y = 330
      }
    } else if (this.reason === EndReason.ARRIVED_WRONG_LOCATION) {
      dialog_box_image = assets.load_image('p0_endings_win_d1_back.png')
      left = 95; top = 15; box_text_w = 336; box_text_h = 212; next_button_x = 282; next_button_y = 303
    } else if (this.reason === EndReason.TIME_UP) {
      dialog_box_image = assets.load_image('p0_endings_notime_box.png')
      left = 134; top = 92; next_button_x = 282; next_button_y = 292
    }
    this.layer.add(new ItemImage(left, top, dialog_box_image, null))
    const c = this.stage.game.datastore.user_character_progress.case
    const thief = c.thief
    const black = [0, 0, 0], red = [102, 0, 0]
    let text1!: ItemText
    let dep_text: ItemText | null = null
    let thief_text: ItemText | null = null
    let stolen_obj = ''
    if (this.reason === EndReason.ARRIVED_LOCATION) {
      const final_department_name = c.list_departments[c.list_departments.length - 1].name
      stolen_obj = c.stolen_object.description2
      text1 = new ItemText(262, 92, this.font_14, 14, 'Al llegar a', black, null, box_text_w, box_text_h)
      dep_text = new ItemText(136, 22, this.font_18, 14, final_department_name, red, null, box_text_w, box_text_h, 2, 2)
      thief_text = new ItemText(135, 117, this.font_18, 14, c.thief.name + ',', red, null, box_text_w, box_text_h, 2, 2)
      this.layer.add(dep_text)
      this.layer.add(thief_text)
    } else if (this.reason === EndReason.ARRIVED_WRONG_LOCATION) {
      stolen_obj = c.stolen_object.description2
      text1 = new ItemText(262, 92, this.font_14, 14, 'Al llegar a', black, null, box_text_w, box_text_h)
      dep_text = new ItemText(136, 26, this.font_18, 14, c.last_department_visited.name, red, null, box_text_w, box_text_h, 2, 2)
      this.layer.add(dep_text)
    } else if (this.reason === EndReason.TIME_UP) {
      const t = 'Lamentablemente el tiempo que tenías para resolver el caso se &#f:bld!acabó&#f!.\n\n' + 'Seguramente el ladrón se encuentra &#f:bld!demasiado lejos&#f! para poder rastrearlo.'
      text1 = new ItemText(182, 168, this.font_14, 14, t, black, null, 243, 111, 2, 2, { bld: [this.font_14_bold, 0, -1] })
      this.stage.game.stats.increment_count_event(statcodes.ENDGAME_TIME_UP)
    }
    this.layer.add(text1)
    const gender = thief.sex === datastore.MALE ? 'o' : 'a'
    if (this.reason === EndReason.ARRIVED_LOCATION) {
      let text2!: ItemText, text3!: ItemText
      if (this.case_solved) {
        if (this.caught_thief == null) {
          c.thief_car_color = choice(Object.keys(datastore.THIEF_CAR_COLORS))
          text2 = new ItemText(137, 65, this.font_14, 14, 'Te pones rápidamente en contacto con las autoridades locales y luego de algunas indagaciones descubren que', black, null, box_text_w, box_text_h, 2, 2)
          text3 = new ItemText(134, 144, this.font_14, 14, 'se encuentra huyendo hacia la carretera en un auto color ' + (datastore.THIEF_CAR_COLORS as Record<string, string>)[c.thief_car_color], black, null, box_text_w, box_text_h, 2, 2)
          const stolen_obj_text = new ItemText(136, 183, this.font_16, 14, '¡Debes perseguirl' + gender + ' y atraparl' + gender + '!', red, null, box_text_w, box_text_h, 2, 2)
          thief_text!.set_top(105)
          this.layer.add(stolen_obj_text)
        } else if (this.caught_thief) {
          text1.set_visible(false)
          dep_text!.set_visible(false)
          text2 = new ItemText(137, 34, this.font_14, 14, 'Una vez arrestad' + gender, black, null, box_text_w, box_text_h, 2, 2)
          text3 = new ItemText(134, 102, this.font_14, 14, 'confiesa el crimen\n y te entrega', black, null, box_text_w, box_text_h, 2, 2)
          const stolen_obj_text = new ItemText(136, 137, this.font_18, 14, stolen_obj + '.', red, null, box_text_w, box_text_h, 2, 2)
          thief_text!.set_top(64)
          this.layer.add(stolen_obj_text)
          this.stage.game.stats.increment_count_event(statcodes.ENDGAME_SOLVED)
        }
      } else {
        text2 = new ItemText(136, 70, this.font_14, 14, 'Te pones rápidamente en contacto con las autoridades locales y luego de algunas indagaciones dan con el paradero del ladrón que resulta ser', black, null, box_text_w, box_text_h, 2, 2)
        text3 = new ItemText(136, 173, this.font_14, 14, 'Lamentablemente no tienes una orden de arresto en su contra.\n\nAsí que te ves obligado a dejarl' + gender + ' en\nlibertad.', black, null, box_text_w, box_text_h, 2, 2)
        this.stage.game.stats.increment_count_event(statcodes.ENDGAME_BAD_ORDER)
      }
      if (text2) this.layer.add(text2)
      if (text3) this.layer.add(text3)
    } else if (this.reason === EndReason.ARRIVED_WRONG_LOCATION) {
      const text2 = new ItemText(136, 85, this.font_14, 14, 'Te pones rápidamente en contacto con las autoridades locales y luego de investigar exhaustivamente &#f:bld!no encuentran rastros de la persona que buscas&#f!.', black, null, box_text_w, box_text_h, 2, 2, { bld: [this.font_14_bold, 0, -1] })
      const text3 = new ItemText(136, 156, this.font_14, 14, 'Seguramente se encuentre en otro departamento, estudia más detalladamente las pistas que encontraste en su escondite.', black, null, box_text_w, box_text_h, 2, 2)
      this.layer.add(text2)
      this.layer.add(text3)
    }
    this.next_button = new ItemImage(next_button_x, next_button_y, assets.load_image('p0_button_next_active.png'))
    this.next_button.set_rollover_image(assets.load_image('p0_button_next_rollover.png'), this.rollover_sound)
    this.next_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.next_visible = true
    this.layer.add(this.next_button)
    if (this.reason === EndReason.TIME_UP) {
      const clock_images = [
        assets.load_image('p0_endings_notime_reloj_stand.png'),
        assets.load_image('p0_endings_notime_reloj_ring1.png'),
        assets.load_image('p0_endings_notime_reloj_ring2.png'),
      ]
      const clock_iterations = [0]
      const clock = new ItemImage(245, 67, clock_images[0])
      this.layer.add(clock)
      const animate_clock = () => {
        clock_iterations[0] += 1
        clock.set_image(clock_images[clock_iterations[0] % 3])
        if (clock_iterations[0] < 12) animations.wait(this.stage, 80, animate_clock)
      }
      animations.wait(this.stage, 80, animate_clock)
    }
  }

  button_click = (item: any, _args: any) => {
    this.stage.render()
    this.continue_sound.play()
    if (item === this.next_button) this.go_next()
    else if (item === this.continue_button) this.continue_with_next()
  }

  go_next() {
    this.next_visible = false
    const hide_background = this.reason === EndReason.ARRIVED_WRONG_LOCATION
    if (this.reason === EndReason.ARRIVED_LOCATION && this.case_solved && this.caught_thief == null) this.stage.set_phase(3)
    else this.stage.blind_dialog(this.layer, BlindDirection.HIDE_DOWN, hide_background, [], this.blind_next_callback)
  }

  continue_with_next() {
    this.continue_visible = false
    this.hide_layers()
    // El original enviaba aquí estadísticas y récords encriptados a su servidor. En la web se
    // informa el resultado del caso a la API compartida (si hay sesión; si no, no hace nada).
    this.report_result()
    if (this.reason !== EndReason.ARRIVED_LOCATION || !this.case_solved || !this.caught_thief) animations.wait(this.stage, 500, () => this.restart_game())
    else animations.wait(this.stage, 500, () => this.show_score())
  }

  /** Reemplazo web del envío de puntajes del original. */
  report_result() {
    try {
      const ds = this.stage.game.datastore
      const cp = ds.user_character_progress
      const c = cp.case
      const won = !!(this.reason === EndReason.ARRIVED_LOCATION && this.case_solved && this.caught_thief)
      const dep = c.crime_location.department
      const area = Math.max(1, ds.list_departments.indexOf(dep) + 1)
      const spot = Math.max(0, int(String(c.number).replace(/\D/g, '') || '0') || 0)
      const gold = won ? 1 + (this.won_uy_medal ? 1 : 0) : 0
      useShell.getState().report({
        area, spot, level: cp.range.level, minigame_type: 'case', won,
        elo_delta: won ? Math.max(0, this.total_score ?? 0) : 0, gold_delta: gold,
      })
    } catch (e) {
      console.warn('No se pudo informar el resultado', e)
    }
  }

  hide_layers() {
    for (const layer of this.stage.layers.slice()) animations.blind_layer(layer, BlindDirection.HIDE_DOWN, null)
  }

  blind_next_callback = (_layer: any) => {
    this.stage.close_dialog(this.layer)
    if (this.reason === EndReason.ARRIVED_WRONG_LOCATION) this.wrong_location_callback?.()
    else this.show_final_screen(false)
  }

  restart_game() {
    const initial_stage = new startscreen.StartScreenStage(this.stage.game, true)
    this.stage.game.set_stage(initial_stage)
    const ds = this.stage.game.datastore
    ds.user_character_stage = null
    ds.save_character('nc', true)
    ds.save_characters()
  }

  show_score() {
    this.showing_scores = true
    this.skip_scores_animation = false
    this.stage.render()
    this.score_back_layer = new Layer()
    this.score_layer = new Layer()
    this.score_font_20 = assets.load_font('turkey.ttf', 20)
    this.score_font_24 = assets.load_font('turkey.ttf', 24)
    this.score_font_29 = assets.load_font('turkey.ttf', 29)
    this.score_font_42 = assets.load_font('turkey.ttf', 42)
    this.handcuff_sound = assets.load_sound('p0_score_handcuffs.ogg')
    this.clock_sound = assets.load_sound('GUI_Clock.ogg')
    this.background_item = new ItemImage(0, 0, assets.load_image('p0_endgame_scores_background.jpg'))
    this.score_layer.add(this.background_item)
    const x = 172
    this.title = new ItemImage(x, 147, assets.load_image('p0_endgame_scores_title.png'))
    this.title_white = new ItemImage(x, 182, assets.load_image('p0_endgame_scores_title_white.png'))
    this.continue_normal = assets.load_image('p0_endings_btn_continue_normal.png')
    this.continue_rollover = assets.load_image('p0_endings_btn_continue_rollover.png')
    this.score_loop_sound = assets.load_sound('score_loop.ogg')
    this.score_end_sound = assets.load_sound('score_end.ogg')
    this.timer_big_hands = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => assets.load_image(`p0_timer_70_bighand_00${i}.png`))
    this.timer_short_hands = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => assets.load_image(`p0_timer_70_shorthand_${String(i).padStart(3, '0')}.png`))
    this.timer_handcenter = assets.load_image('p0_timer_70_handcenter.png')
    this.stage.show_dialog(this.score_back_layer, this.score_handle_event, null)
    this.stage.add_layer(this.score_layer)
    this.stage.blind_dialog(this.score_back_layer, BlindDirection.SHOW_DOWN, false, [], this.blind_show_score_callback)
  }

  blind_show_score_callback = (_layer: any) => {
    this.stage.render()
    this.right_sound.play()
    this.score_layer.add(this.title_white)
    const final_title_x = 147
    const final_title_y = 300
    if (this.skip_scores_animation) {
      this.title_white.set_left(final_title_x)
      this.title_white.set_top(final_title_y)
      this.move_score_title_callback(this.title_white)
    } else {
      animations.fade_in_item(this.title_white, 300)
      // (sic) el original pasa (left actual, 147, 300 ms): sube el título hasta y=147
      animations.start_move(this.title_white, this.title_white.get_left(), final_title_x, final_title_y, null, null, this.move_score_title_callback)
    }
  }

  move_score_title_callback = (_item: any) => {
    this.score_layer.add(this.title)
    if (this.skip_scores_animation) this.score_layer.remove(this.title_white)
    else {
      animations.fade_in_item(this.title, 330)
      animations.fade_out_item(this.title_white, true, 330)
    }
    const c = this.stage.game.datastore.user_character_progress.case
    this.department_name = c.crime_location.department.name
    const department_text = '-' + text.to_upper(this.department_name) + '-'
    const x = 171, y = 195
    this.department = new ItemText(x, y, this.score_font_20, 0, department_text, [255, 212, 12], null, 259, 30, 2, 1)
    this.department_shadow = new ItemText(x - 2, y + 3, this.score_font_20, 0, department_text, [0, 0, 0], null, 259, 30, 2, 1)
    this.score_layer.add(this.department_shadow)
    this.score_layer.add(this.department)
    const final_shadow_alpha = 80
    if (this.skip_scores_animation) {
      this.department_shadow.set_alpha(final_shadow_alpha)
      this.show_title_callback(this.department_shadow)
    } else {
      animations.fade_in_item(this.department, 330, null)
      animations.fade_in_item(this.department_shadow, 330, this.show_title_callback, final_shadow_alpha)
    }
  }

  show_title_callback = (_item: any) => {
    if (this.skip_scores_animation) this.wait_show_title_callback()
    else animations.wait(this.stage, 1500, () => this.wait_show_title_callback())
  }

  wait_show_title_callback() {
    const accel = [0.5, 0.5, 1]
    const x = this.title.get_left()
    this.score_item = 1
    this.clues_found_icons = 0
    this.score_scene = 1
    const title_final_y = 33
    const department_final_x = 171, department_final_y = 81
    if (this.skip_scores_animation) {
      this.title.set_top(title_final_y)
      this.department.set_lefttop(department_final_x, department_final_y)
      this.department_shadow.set_lefttop(department_final_x, department_final_y)
      this.add_score_item(this.department_shadow)
    } else {
      animations.start_move(this.title, x, title_final_y, 400, accel, null)
      animations.start_move(this.department, department_final_x, department_final_y, 400, accel, null)
      animations.start_move(this.department_shadow, department_final_x - 2, department_final_y + 3, 400, accel, null, this.add_score_item)
    }
  }

  add_score_item = (_item: any = null) => {
    let item_image!: Image, x = 0, y = 0
    if (this.score_item === 1) { item_image = assets.load_image('p0_endgame_scores_s1_optArrested.png'); x = 73; y = 133 }
    else if (this.score_item === 2) { item_image = assets.load_image('p0_endgame_scores_s1_optClues.png'); x = 73; y = 168 }
    else if (this.score_item === 3) { item_image = assets.load_image('p0_endgame_scores_s1_optTime.png'); x = 75; y = 204 }
    else if (this.score_item === 4) { item_image = assets.load_image('p0_endgame_scores_s1_optTotal.png'); x = 134; y = 255 }
    const item = new ItemImage(x, y, item_image)
    this.score_layer.add(item)
    if (this.skip_scores_animation) this.add_item_icon(item)
    else animations.fade_in_item(item, 270, this.add_item_icon)
  }

  add_item_icon = (_item: any = null) => {
    let dot_y = 0
    if (this.score_item === 1) {
      this.score_layer.add(new ItemImage(279, 126, assets.load_image('p0_endgame_scores_s1_iconArrested.png')))
      if (!this.skip_scores_animation) { this.stage.render(); this.handcuff_sound.play() }
      this.dots = 26
      dot_y = 134
    } else if (this.score_item === 2) {
      if (this.clues_found_icons === 0) {
        this.icon_image = assets.load_image('p0_endgame_scores_s1_iconClues.png')
        this.clue_sound = assets.load_sound('p0_score_clue.ogg')
      }
      const x = 269 + this.clues_found_icons * 23
      this.score_layer.add(new ItemImage(x, 162, this.icon_image))
      this.clues_found_icons += 1
      if (!this.skip_scores_animation) { this.stage.render(); this.clue_sound.play() }
      if (this.clues_found >= 3) this.dots = 20 - Math.trunc((this.clues_found - 3) * 4.5)
      else this.dots = 26
      dot_y = 168
    } else if (this.score_item === 3) {
      this.score_layer.add(new ItemImage(283, 199, assets.load_image('p0_timer_70_backclock.png')))
      if (!this.skip_scores_animation) { this.stage.render(); this.clock_sound.play() }
      this.timer_days = this.stage.timer_days
      this.timer_hour = this.stage.timer_hour
      this.timer_minute_pos = this.stage.timer_minute_pos
      this.timer_big_hand = new ItemImage(289, 207, this.timer_big_hands[this.timer_minute_pos])
      this.score_layer.add(this.timer_big_hand)
      this.timer_short_hand = new ItemImage(289, 208, this.stage.get_short_hand_image(this.timer_hour, this.timer_minute_pos, this.timer_short_hands))
      this.score_layer.add(this.timer_short_hand)
      this.score_layer.add(new ItemImage(297, 216, this.timer_handcenter))
      this.dots = 26
      dot_y = 204
    } else if (this.score_item === 4) {
      this.dots = 34
      dot_y = 253
    }
    if (this.score_item === 2 && this.clues_found_icons < this.clues_found) {
      if (this.skip_scores_animation) this.add_item_icon()
      else animations.wait(this.stage, 200, () => this.add_item_icon())
    } else {
      let dot_x: number, font: Font, height: number
      if (this.score_item <= 3) {
        dot_x = 456 - this.score_font_24.size('.'.repeat(this.dots))[0]
        font = this.score_font_24
        height = 40
      } else {
        dot_x = 203
        font = this.score_font_29
        height = 50
      }
      this.dotted_line = new ItemText(dot_x, dot_y, font, 0, '', [244, 208, 11], null, 188, height, 1, 1)
      const dy = this.score_item <= 3 ? 2 : 3
      this.dotted_line_shadow = new ItemText(dot_x - 1, dot_y + dy, font, 0, '', [0, 0, 0], null, 188, height, 1, 1)
      this.score_layer.add(this.dotted_line_shadow)
      this.score_layer.add(this.dotted_line)
      if (this.score_item <= 3) this.dotted_line_shadow.set_alpha(140)
      if (this.skip_scores_animation) this.add_next_dot()
      else animations.wait(this.stage, 200, () => this.add_next_dot())
    }
  }

  add_next_dot() {
    let t: string
    if (this.dots === 1) { t = this.dotted_line.get_text() + '.'; this.dots -= 1 }
    else { t = this.dotted_line.get_text() + '..'; this.dots -= 2 }
    this.dotted_line.set_text(t)
    this.dotted_line_shadow.set_text(t)
    if (this.dots > 0) {
      if (this.skip_scores_animation) this.add_next_dot()
      else animations.wait(this.stage, 15, () => this.add_next_dot())
    } else if (this.skip_scores_animation) this.add_item_score()
    else animations.wait(this.stage, 30, () => this.add_item_score())
  }

  add_item_score = (_item: any = null) => {
    this.score_text_value = 0
    let x: number, y: number, final_value: number
    if (this.score_item === 1) { x = 442; y = 132; final_value = this.scores[0] }
    else if (this.score_item === 2) { x = 442; y = 166; final_value = this.scores[1] }
    else if (this.score_item === 3) {
      x = 442; y = 202; final_value = this.scores[2]
      const tl = this.stage.game.datastore.user_character_progress.case.get_time_limit()
      this.timer_steps = (tl[0] * 12 + tl[1] - (this.stage.timer_days * 12 + this.stage.timer_hour)) * this.timer_big_hands.length
    } else if (this.score_item === 4) { x = 380; y = 252; final_value = this.total_score }
    else { x = 321; y = 322; final_value = this.stage.game.datastore.user_character_progress.score }
    let font: Font, color: number[], width: number, height: number
    if (this.score_item <= 3) { font = this.score_font_24; color = [255, 144, 0]; width = 80; height = 40 }
    else if (this.score_item === 4) { font = this.score_font_29; color = [255, 144, 0]; width = 90; height = 40 }
    else { font = this.score_font_42; color = [255, 212, 12]; width = 170; height = 60 }
    const score_item = new ItemText(x, y, font, 0, '0', color, null, width, height, 3, 1)
    const score_item_shadow = new ItemText(x - 2, y + 3, font, 0, '0', [0, 0, 0], null, width, height, 3, 1)
    this.score_layer.add(score_item_shadow)
    this.score_layer.add(score_item)
    if (this.score_item === 5) {
      this.total_score_item = score_item
      this.total_score_item_shadow = score_item_shadow
    }
    this.score_increment = minigame.calculate_score_increment(minigame.SCORE_INCREMENT * 10, final_value, this.scores[0])
    if (this.score_item === 3 && this.timer_steps !== 0) this.score_increment = Math.min(this.score_increment, Math.trunc(final_value / (this.timer_steps * 0.7)))
    // Python 2: división entera entre enteros
    const increments = this.score_increment === 0 ? 0 : idiv(final_value, this.score_increment)
    const score_time = Math.trunc(increments * minigame.SCORE_DELAY)
    const loop_length = this.score_loop_sound.get_length() * 1000
    const sound_loops = loop_length > 0 ? Math.trunc((score_time + minigame.SCORE_END_SOUND_DELAY) / loop_length) : 0
    let delay_between_update: number
    if (increments === 0 || this.skip_scores_animation) delay_between_update = 0
    else delay_between_update = Math.max(0, (sound_loops * loop_length - minigame.SCORE_END_SOUND_DELAY) / increments)
    if (!this.skip_scores_animation) this.stage.render()
    this.stage.start_timer('endgame_item_score', delay_between_update, this.update_score, [score_item, score_item_shadow, final_value], false, false)
    if (this.score_item === 3 && this.timer_steps !== 0) {
      const timer_delay = this.skip_scores_animation ? 0 : score_time / this.timer_steps
      this.stage.start_timer('engame_score_timer', timer_delay, this.update_timer)
    }
    this.score_channel = pygame.mixer.find_channel()
    this.score_channel?.set_volume(assets.SOUND_VOLUME)
    if (!this.skip_scores_animation && sound_loops > 0) this.score_channel?.play(this.score_loop_sound.sound, -1)
  }

  update_score = (key: unknown, data: any[]) => {
    const final_value = data[2]
    if (final_value >= 0) {
      this.score_text_value += this.score_increment
      if (this.score_text_value > final_value) this.score_text_value = final_value
    } else {
      this.score_text_value -= this.score_increment
      if (this.score_text_value < final_value) this.score_text_value = final_value
    }
    if (this.skip_scores_animation) this.score_text_value = final_value
    data[0].set_text(text.format_number(this.score_text_value))
    data[1].set_text(text.format_number(this.score_text_value))
    if (this.score_text_value === final_value) {
      this.stage.stop_timer(key)
      const delay = this.skip_scores_animation ? 0 : 200
      if (this.score_item < 4) {
        this.score_item += 1
        animations.wait(this.stage, delay, () => this.add_score_item())
      } else if (this.score_item === 4) {
        this.score_item += 1
        animations.wait(this.stage, delay, () => this.add_total_item())
      } else animations.wait(this.stage, delay, () => this.add_score_continue())
      if (this.score_channel != null) {
        if (!this.skip_scores_animation) {
          this.stage.render()
          this.score_channel.play(this.score_end_sound.sound)
        } else this.score_channel.stop()
      }
    }
  }

  update_timer = (key: unknown, _data: unknown) => {
    let timer_updated = false
    while (!timer_updated) {
      this.timer_minute_pos += 1
      if (this.timer_minute_pos >= this.timer_big_hands.length) {
        this.timer_minute_pos = 0
        this.timer_hour += 1
        if (this.timer_hour >= 24) this.timer_hour = 0
      }
      this.timer_big_hand.set_image(this.timer_big_hands[this.timer_minute_pos])
      this.timer_short_hand.set_image(this.stage.get_short_hand_image(this.timer_hour, this.timer_minute_pos, this.timer_short_hands))
      this.timer_steps -= 1
      if (this.timer_steps <= 0) this.timer_steps = 0
      if (this.skip_scores_animation) { if (this.timer_steps === 0) timer_updated = true }
      else timer_updated = true
    }
    if (this.timer_steps === 0) this.stage.stop_timer(key)
  }

  add_total_item() {
    const total_item = new ItemImage(101, 324, assets.load_image('p0_endgame_scores_totalscores.png'))
    this.score_layer.add(total_item)
    this.total_score_label = total_item
    if (this.skip_scores_animation) this.add_item_score(total_item)
    else animations.fade_in_item(total_item, 340, this.add_item_score)
  }

  add_score_continue() {
    this.next = new ItemImage(224, 399, this.continue_normal)
    this.next.set_rollover_image(this.continue_rollover, this.rollover_sound)
    this.next.add_event_handler(ItemEvent.CLICK, this.score_continue_click)
    this.score_layer.add(this.next)
    this.score_continue_visible = true
    if (this.skip_scores_animation) {
      this.stage.render()
      this.score_end_sound.play()
      this.skip_scores_animation = false
    }
  }

  score_continue_click = (_item: any, _args: any) => {
    this.stage.render()
    this.continue_sound.play()
    this.score_continue()
  }

  score_continue() {
    this.showing_scores = false
    let next_scene: number | null
    if (this.score_scene === 1) next_scene = 2
    else if (this.score_scene === 2) next_scene = this.won_uy_medal ? 3 : this.promoted ? 4 : null
    else if (this.score_scene === 3) next_scene = this.promoted ? 4 : null
    else next_scene = null
    this.score_continue_visible = false
    if (next_scene == null) {
      this.hide_layers()
      animations.wait(this.stage, 500, () => this.restart_game())
    } else if (this.score_scene === 1) {
      const score_back_items = [this.background_item, this.title, this.department_shadow, this.department, this.total_score_item_shadow, this.total_score_item, this.total_score_label]
      for (const item of score_back_items) {
        this.score_layer.remove(item)
        this.score_back_layer.add(item)
      }
    }
    this.next_scene = next_scene
    animations.blind_layer(this.score_layer, BlindDirection.HIDE_DOWN, null, 600, this.blind_next_scene_callback)
  }

  blind_next_scene_callback = (_layer: any) => {
    for (const item of this.score_back_layer.items) item.set_visible(true)
    this.score_layer.empty()
    this.score_layer.set_clip(null)
    this.score_scene = this.next_scene
    if (this.score_scene === 2) animations.wait_locked(this.stage, 100, () => this.show_medal_won())
    else if (this.score_scene === 3) animations.wait_locked(this.stage, 100, () => this.show_medal_uy_won())
    else if (this.score_scene === 4) animations.wait_locked(this.stage, 100, () => this.show_promotion())
  }

  show_medal_won() {
    this.stage.render()
    const medal_data = (merits.MEDALS_DATA as Record<string, any[]>)[this.medal_name]
    const ribbon = medal_data[3]
    const ribbon_image = ribbon == null ? assets.load_image('p0_merits_medals_big_ribbon_' + this.medal_name + '.png') : assets.load_image('p0_merits_medals_big_ribbon_' + String(ribbon) + '.png')
    this.score_layer.add(new ItemImage(157, 109, ribbon_image))
    this.score_layer.add(new ItemImage(154, 211, assets.load_image('p0_merits_medals_big_genericbase.png')))
    this.score_layer.add(new ItemImage(176, 223, assets.load_image('p0_merits_medals_tab_' + this.medal_name + '.jpg')))
    this.score_layer.add(new ItemText(295, 142, this.font_13_bold, 15, 'En reconocimiento a tu\ndesempeño en este caso,\nla intendencia de', [255, 255, 255], null, 215, 63, 1, 1))
    this.score_layer.add(new ItemText(295, 199, this.font_16, 15, this.department_name, [255, 212, 12], null, 215, 24, 1, 1))
    this.score_layer.add(new ItemText(295, 231, this.font_13_bold, 15, '¡ha decidido condecorarte\ncon una medalla!', [255, 255, 255], null, 225, 53, 1, 1))
    this.stage.set_music_volume(0.2, 300)
    animations.wait(this.stage, 200, () => this.play_medal_sound())
  }

  play_medal_sound() {
    this.stage.render()
    this.medal_sound.play()
    animations.wait(this.stage, this.medal_sound.get_length() * 1000, () => this.play_achievement_sound_callback())
  }

  play_promotion_sound() {
    this.stage.render()
    this.promotion_sound.play()
    animations.wait(this.stage, this.medal_sound.get_length() * 1000, () => this.play_achievement_sound_callback())
  }

  play_achievement_sound_callback() {
    this.stage.set_music_volume(1, 300)
    this.add_score_continue()
  }

  show_medal_tut_won(_item: any = null) {
    this.stage.render()
    this.score_layer.add(new ItemImage(122, 95, assets.load_image('p0_merits_medals_big_tut.png')))
    const bh = '&#c255,212,12!', eh = '&#c!'
    const message = 'Por haber completado\n' + 'satisfactoriamente tu\n' + 'entrenamiento y haber\n' + 'demostrado que eres\n' + 'apto para combatir a la\n' + bh + 'organización criminal CULT' + eh + ',\n' + 'la División Especial de\n' + 'Detectives te hace entrega\n' + 'de esta medalla.'
    this.score_layer.add(new ItemText(293, 127, this.font_13_bold, 15, message, [255, 255, 255], null, 291, 144, 1, 1))
    this.stage.set_music_volume(0.2, 300)
    animations.wait(this.stage, 200, () => this.play_medal_sound())
  }

  show_medal_uy_won(_item: any = null) {
    this.stage.render()
    this.score_layer.add(new ItemImage(155, 26, assets.load_image('p0_endgame_scores_title_uy.png')))
    this.title.set_visible(false)
    this.department.set_visible(false)
    this.department_shadow.set_visible(false)
    this.total_score_item_shadow.set_visible(false)
    this.total_score_item.set_visible(false)
    this.total_score_label.set_visible(false)
    this.score_layer.add(new ItemImage(212, 158, assets.load_image('p0_merits_medals_big_uy.png')))
    const bb = '&#f:bold!', eb = '&#f!'
    const message = 'En reconocimiento a tu ' + bb + 'continuo esfuerzo' + eb + ' a la hora de\n' + 'combatir a la ' + bb + 'organización criminal CULT' + eb + ', y por haber\n' + 'resuelto al menos un caso en ' + bb + 'cada departamento' + eb + ' del país,\n' + 'las autoridades de la nación han decidido\n' + 'condecorarte con esta medalla.'
    this.score_layer.add(new ItemText(85, 90, this.font_13, 15, message, [255, 255, 255], null, 430, 115, 2, 1, { bold: [this.font_13_bold, 15, -2] }))
    this.stage.set_music_volume(0.2, 300)
    animations.wait(this.stage, 200, () => this.play_medal_sound())
  }

  show_promotion() {
    this.stage.render()
    const character = this.stage.game.datastore.user_character
    const cp = this.stage.game.datastore.user_character_progress
    const resolved_cases = cp.resolved_cases
    let suffix = ''
    if (resolved_cases === 11 || resolved_cases === 12) suffix = 'mo'
    else {
      const d = resolved_cases % 10
      if (d === 0) suffix = 'mo'
      else if (d === 1) suffix = 'er'
      else if (d === 2) suffix = 'do'
      else if (d === 3) suffix = 'er'
      else if (d <= 6) suffix = 'to'
      else if (d === 7) suffix = 'mo'
      else if (d === 8) suffix = 'vo'
      else if (d >= 9) suffix = 'no'
    }
    const bh = '&#c255,212,12!', eh = '&#c!', bl = '&#f:large!', el = '&#f!'
    const message = 'Por haber resuelto con éxito tu ' + bh + bl + String(cp.resolved_cases) + suffix + el + eh + ' caso, y haber\n' + 'demostrado grandes habilidades a la hora de combatir a\n' + 'la malvada organización ' + bh + 'CULT' + eh + ', la División Especial de \n' + 'Detectives ha decidido otorgarte un ascenso.'
    this.score_layer.add(new ItemText(44, 114, this.font_13_bold, 15, message, [255, 255, 255], null, 511, 73, 2, 1, { large: [this.font_16, 15, -1] }))
    this.score_layer.add(new ItemImage(240, 196, assets.load_image('p0_endgame_scores_s3_congratulations.png')))
    const turkey_30 = assets.load_font('turkey.ttf', 30)
    const range_name = text.to_upper(datamodel.get_range_name(cp.range.level))
    this.score_layer.add(new ItemText(41, 224, turkey_30, 0, range_name, [0, 0, 0], null, 514, 50, 2, 1))
    this.score_layer.add(new ItemText(43, 221, turkey_30, 0, range_name, [255, 212, 12], null, 514, 50, 2, 1))
    const character_name = text.to_upper(character.charinfo.name)
    this.score_layer.add(new ItemText(21, 254, turkey_30, 29, character_name, [0, 0, 0], null, 554, 90, 2, 1))
    this.score_layer.add(new ItemText(23, 251, turkey_30, 29, character_name, [255, 212, 12], null, 554, 90, 2, 1))
    this.stage.set_music_volume(0.2, 300)
    animations.wait(this.stage, 200, () => this.play_promotion_sound())
  }

  case_is_solved() {
    const c = this.stage.game.datastore.user_character_progress.case
    if (c.arrest_order_thief) return c.thief === c.arrest_order_thief
    return false
  }
}
