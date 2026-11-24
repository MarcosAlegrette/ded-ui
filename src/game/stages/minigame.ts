// Port de game/stages/minigame.py: base común de los minijuegos de los testigos (diálogo de
// apertura, pedido, ayuda, puntaje animado, agradecimiento y declaración del testigo).
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import * as text from '../../framework/text.ts'
import { Layer, ItemImage, ItemText, ItemEvent, KEYDOWN, K, KMOD } from '../../framework/stage.ts'
import type { Image, CustomSound } from '../../framework/assets.ts'
import type { Font } from '../../pg/font.ts'
import type { PgEvent } from '../../pg/events.ts'
import { idiv, pmod } from '../../pg/py.ts'

export const WRONG_PLACE_DIALOG = 0
export const OPENING_DIALOG = 1
export const WITNESS_REQUEST = 2
export const WITNESS_MINIGAME = 3
export const WITNESS_GOODBYE = 4
export const WITNESS_THANKS = 5
export const WITNESS_AID = 6
export const WITNESS_AID_2 = 7
export const WITNESS_HELP = 8
export const SCORE_DIALOG = 9
export const SCORE_INCREMENT = 6
export const SCORE_DELAY = 35
export const SCORE_END_SOUND_DELAY = 0

export class Minigame {
  [k: string]: any
  stage: any
  phase1content: any
  witness: any
  play_statcode: string
  solved_statcode: string
  not_solved_statcode: string
  score_category: string
  layer: Layer
  score_layer: Layer
  character_layer: Layer
  witness_layer: Layer
  help_layer: Layer
  help_previous_layer: Layer
  help_current_layer: Layer
  active_dialog: number | null
  next: any
  playing_minigame_music: boolean
  start_stage_music: boolean
  help_stage: number
  max_help_stages: number
  witness_opening_box_image: Image
  witness_titler: Image
  font_24: Font
  font_18: Font
  font_13: Font
  font_13_bld: Font
  font_12: Font
  font_12_bld: Font
  font_14_bld: Font
  font_14: Font
  option_hover_image: Image
  avatar_box_image: Image
  previous_image: Image
  previous_rollover_image: Image
  next_image: Image
  next_rollover_image: Image
  rollover_sound: CustomSound
  continue_sound: CustomSound
  help_sound: CustomSound
  // definidos por las subclases
  witness_item!: ItemImage
  witness_minigame_box_image!: Image
  title!: string
  question_intro!: string
  question!: string
  request_text!: string
  request_question_text!: string
  thanks_text!: string

  constructor(stage: any, phase1content: any, witness: any, play_statcode: string, solved_statcode: string, not_solved_statcode: string, score_category: string) {
    this.stage = stage
    this.phase1content = phase1content
    this.witness = witness
    this.play_statcode = play_statcode
    this.solved_statcode = solved_statcode
    this.not_solved_statcode = not_solved_statcode
    this.score_category = score_category
    this.layer = new Layer()
    this.score_layer = new Layer()
    this.character_layer = new Layer()
    this.witness_layer = new Layer()
    this.help_layer = new Layer()
    this.help_previous_layer = new Layer()
    this.help_current_layer = new Layer()
    this.active_dialog = null
    this.next = ''
    this.playing_minigame_music = false
    this.start_stage_music = false
    this.help_stage = 1
    this.max_help_stages = 3
    this.witness_opening_box_image = assets.load_image('p1_minigame_flux_dialogue1.png')
    this.witness_titler = assets.load_image('p1_minigame_flux_titler.png')
    this.font_24 = assets.load_font('powdrft_.ttf', 24)
    this.font_18 = assets.load_font('evilgeniusbb_bld.ttf', 18)
    this.font_13 = assets.load_font('evilgeniusbb_reg.ttf', 13)
    this.font_13_bld = assets.load_font('evilgeniusbb_bld.ttf', 13)
    this.font_12 = assets.load_font('evilgeniusbb_reg.ttf', 12)
    this.font_12_bld = assets.load_font('evilgeniusbb_bld.ttf', 12)
    this.font_14_bld = assets.load_font('evilgeniusbb_bld.ttf', 14)
    this.font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    this.option_hover_image = assets.load_image('p1_minigame_opening_flux_optionselector.gif')
    this.avatar_box_image = assets.load_image('p1_minigame_opening_flux_avatarboxdialogue.png')
    this.previous_image = assets.load_image('p0_button_previous_active.png')
    this.previous_rollover_image = assets.load_image('p0_button_previous_rollover.png')
    this.next_image = assets.load_image('p0_button_next_active.png')
    this.next_rollover_image = assets.load_image('p0_button_next_rollover.png')
    this.rollover_sound = this.stage.rollover_sound
    this.continue_sound = this.stage.click_sound
    this.help_sound = assets.load_sound('p0_help.ogg')
  }

  show_witness_minigame() {
    this.layer.empty()
    this.active_dialog = WITNESS_MINIGAME
    this.stage.prepare_dialog(this.character_layer)
    this.set_up_witness()
    this.stage.show_dialog(this.layer, this.minigame_dialog_handle_event)
    this.stage.add_layer(this.character_layer)
    this.stage.add_layer(this.witness_layer)
    this.set_up_minigame()
    const ignore_layers = [this.character_layer, this.witness_layer]
    this.stage.set_music_volume(0, 600)
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, false, ignore_layers, (l: Layer) => this.blind_show_minigame_callback(l))
  }

  blind_show_minigame_callback(_layer: Layer) {}

  show_opening_dialog() {
    this.active_dialog = OPENING_DIALOG
    this.playing_minigame_music = false
    this.start_stage_music = false
    this.stop_stage_music()
    this.stage.prepare_dialog(this.character_layer, false, true)
    this.stage.show_dialog(this.layer, this.handle_event)
    this.stage.add_layer(this.character_layer)
    const ignore_layers = [this.character_layer]
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, true, ignore_layers, (l: Layer) => this.blind_show_opening_callback(l))
  }

  escape_key_event() { return false }

  handle_event = (e: PgEvent): unknown => {
    if (e.type === KEYDOWN) {
      if (e.key === K.K_ESCAPE) {
        this.stage.render()
        this.stage.click_sound.play()
        if (this.active_dialog === OPENING_DIALOG) {
          this.close_minigame()
          return true
        } else {
          this.show_next()
          return true
        }
      }
      // atajo de desarrollo (Shift+Z) del original: sólo en modo desarrollo, que la web no usa
      const mod = this.get_common_modifiers(e.mod ?? 0)
      if (mod === KMOD.KMOD_LSHIFT && e.key === K.K_z && this.stage.game.get_development_mode()) {
        this.stage.remove_layer(this.witness_layer)
        this.show_happy_character()
        this.stage.close_dialog(this.layer)
        this.active_dialog = WITNESS_AID
        this.show_witness_dialog(true)
      }
    }
    return undefined
  }

  minigame_dialog_handle_event = (e: PgEvent): unknown => {
    if (e.type === KEYDOWN) {
      if (e.key === K.K_ESCAPE && !this.escape_key_event()) {
        this.stage.render()
        this.stage.click_sound.play()
        if (this.active_dialog === WITNESS_MINIGAME) {
          this.phase1content.minigame_solved(false)
          this.close_minigame()
        } else this.show_next()
        return true
      }
    }
    return this.minigame_handle_event(e)
  }

  minigame_handle_event(_e: PgEvent): unknown { return undefined }

  blind_show_opening_callback(_layer: Layer) {
    this.set_up_question_dialog()
    this.stage.add_layer(this.witness_layer)
    const layers = [this.character_layer]
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, false, layers)
  }

  set_up_question_dialog() {
    this.set_up_witness_message_box(true)
    this.set_up_witness()
    this.set_up_avatar_box()
  }

  set_up_score() {
    this.scores = this.calculate_solved_score()
    this.total = 0
    for (let i = 0; i < this.scores.length; i++) {
      this.scores[i] = Math.min(9999, Math.max(-9999, Math.trunc(this.scores[i])))
      this.total += this.scores[i]
    }
    if (this.total < 0) this.total = 0
    const datastore = this.stage.game.datastore
    const character_progress = datastore.user_character_progress
    character_progress.score += this.total
    datastore.add_score(this.score_category, datastore.user_character, this.total)
    datastore.add_score('total', datastore.user_character, character_progress.score)
    datastore.save_highscores()
    this.score_layer.add(new ItemImage(0, 69, assets.load_image('p1_minigame_scores_topbar.png')))
    this.score_layer.add(new ItemImage(0, 330, assets.load_image('p1_minigame_scores_bottombar.png')))
    this.score_font_24 = assets.load_font('turkey.ttf', 24)
    this.score_font_29 = assets.load_font('turkey.ttf', 29)
    this.score_loop_sound = assets.load_sound('score_loop.ogg')
    this.score_end_sound = assets.load_sound('score_end.ogg')
  }

  add_score_item = (_item: unknown = null) => {
    const score_count = this.scores.length
    let item_image: Image | null = null
    if (this.score_item === 1) {
      item_image = assets.load_image('p1_minigame_scores_game.png')
      if (score_count === 3) { this.score_text_top = 142; this.score_value_top = 139 } else { this.score_text_top = 132; this.score_value_top = 129 }
    } else if (this.score_item === 2) {
      item_image = assets.load_image('p1_minigame_scores_bonus.png')
      if (score_count === 3) { this.score_text_top = 170; this.score_value_top = 171 } else { this.score_text_top = 159; this.score_value_top = 160 }
    } else if (this.score_item === 3 && score_count === 4) {
      item_image = assets.load_image('p1_minigame_scores_usedletters.png')
      this.score_text_top = 194
      this.score_value_top = 191
    } else if (this.score_item === 4 || score_count === 3) {
      item_image = assets.load_image('p1_minigame_scores_mistakes.png')
      if (score_count === 3) { this.score_text_top = 204; this.score_value_top = 203 } else { this.score_text_top = 223; this.score_value_top = 222 }
    }
    const item = new ItemImage(120, this.score_text_top, item_image)
    this.score_layer.add(item)
    if (this.skip_scores_animation) this.score_item_callback(item)
    else animations.fade_in_item(item, 600, this.score_item_callback)
  }

  add_total_item = () => {
    const score_count = this.scores.length
    if (score_count === 3) { this.score_text_top = 258; this.score_value_top = 254 } else { this.score_text_top = 268; this.score_value_top = 264 }
    const total_item = new ItemImage(120, this.score_text_top, assets.load_image('p1_minigame_scores_total.png'))
    this.score_layer.add(total_item)
    if (this.skip_scores_animation) this.score_item_callback(total_item)
    else animations.fade_in_item(total_item, 600, this.score_item_callback)
  }

  add_score_continue = () => {
    const continue_normal = assets.load_image('p0_endings_btn_continue_normal.png')
    const continue_rollover = assets.load_image('p0_endings_btn_continue_rollover.png')
    this.next = new ItemImage(219, 322, continue_normal)
    this.next.set_rollover_image(continue_rollover, this.rollover_sound)
    this.next.add_event_handler(ItemEvent.CLICK, this.option_click)
    this.score_layer.add(this.next)
    this.score_continue_visible = true
    if (this.skip_scores_animation) {
      this.stage.render()
      this.score_end_sound.play()
      this.skip_scores_animation = false
    }
  }

  score_item_callback = (_item: unknown) => {
    const final_value = this.score_item <= this.scores.length ? this.scores[this.score_item - 1] : this.total
    this.score_increment = calculate_score_increment(SCORE_INCREMENT, final_value, this.scores[0])
    const increments = idiv(final_value, this.score_increment)
    const score_time = Math.trunc(increments * SCORE_DELAY)
    const loop_length = this.score_loop_sound.get_length() * 1000
    const sound_loops = loop_length > 0 ? Math.trunc((score_time + SCORE_END_SOUND_DELAY) / loop_length) : 0
    if (!this.skip_scores_animation) this.score_loop_sound.play(-1)
    this.score_text_value = 0
    let score_texts: ItemText[]
    if (this.score_item <= this.scores.length) score_texts = this.add_text_with_shadow(this.score_layer, 391, this.score_value_top, this.score_font_24, text.format_number(this.score_text_value), [255, 103, 28], 51, 35, 3, 1, -3, 4)
    else score_texts = this.add_text_with_shadow(this.score_layer, 381, this.score_value_top, this.score_font_29, text.format_number(this.score_text_value), [255, 144, 0], 67, 55, 3, 1, -3, 4)
    let delay_between_update: number
    if (increments === 0 || this.skip_scores_animation) delay_between_update = 0
    else delay_between_update = Math.max(0, (sound_loops * loop_length - SCORE_END_SOUND_DELAY) / increments)
    this.stage.start_timer('minigame_item_score', delay_between_update, this.update_score, score_texts, false, false)
  }

  update_score = (key: unknown, score_texts: ItemText[]) => {
    const final_value = this.score_item <= this.scores.length ? this.scores[this.score_item - 1] : this.total
    if (final_value >= 0) {
      this.score_text_value += this.score_increment
      if (this.score_text_value > final_value) this.score_text_value = final_value
    } else {
      this.score_text_value -= this.score_increment
      if (this.score_text_value < final_value) this.score_text_value = final_value
    }
    if (this.skip_scores_animation) this.score_text_value = final_value
    for (const item of score_texts) item.set_text(text.format_number(this.score_text_value))
    if (this.score_text_value === final_value) {
      this.stage.stop_timer(key)
      let delay = 200
      if (this.skip_scores_animation) delay = 0
      if (this.score_item < this.scores.length) {
        this.score_item += 1
        animations.wait(this.stage, delay, () => this.add_score_item())
      } else if (this.score_item === this.scores.length) {
        this.score_item += 1
        animations.wait(this.stage, delay, this.add_total_item)
      } else animations.wait(this.stage, delay, this.add_score_continue)
      this.stage.render()
      this.score_loop_sound.stop()
      if (!this.skip_scores_animation) this.score_end_sound.play()
    }
  }

  add_text_with_shadow(layer: Layer, left: number, top: number, font: Font, txt: string, color: number[], width: number, height: number, h_align: number, v_align: number, shadow_dx = -1, shadow_dy = 2): ItemText[] {
    const shadow_item = new ItemText(left + shadow_dx, top + shadow_dy, font, 0, txt, [0, 0, 0], null, width, height, h_align, v_align)
    layer.add(shadow_item)
    const text_item = new ItemText(left, top, font, 0, txt, color, null, width, height, h_align, v_align)
    layer.add(text_item)
    return [text_item, shadow_item]
  }

  set_up_witness_message_box(opening_dialog: boolean) {
    const image = opening_dialog ? this.witness_opening_box_image : this.witness_minigame_box_image
    this.layer.add(new ItemImage(56, 96, image, null))
    const titler = new ItemImage(136, 80, this.witness_titler)
    const title_text = new ItemText(142, 87, this.font_24, 0, this.title, [157, 21, 21], null, 272, 30, 2, 2)
    this.layer.add(titler)
    this.layer.add(title_text)
    if (opening_dialog) {
      this.box_text = new ItemText(111, 134, this.font_13, 16, this.question_intro, [0, 0, 0], null, 328, 68, 2, 2)
      this.layer.add(this.box_text)
      this.box_text = new ItemText(111, 212, this.font_14_bld, 16, this.question, [0, 0, 0], null, 328, 20, 2)
      this.layer.add(this.box_text)
    }
  }

  set_up_witness() {
    this.witness_layer.remove(this.witness_item)
    this.witness_layer.add(this.witness_item)
  }

  set_up_avatar_box() {
    this.layer.add(new ItemImage(183, 280, this.avatar_box_image))
    const w = this.option_hover_image.get_width(), h = this.option_hover_image.get_height()
    this.option_text_yes = new ItemText(211, 294, this.font_13_bld, 0, 'SI', [79, 79, 79], null, w, h, 2, 2)
    this.option_text_no = new ItemText(211, 319, this.font_13_bld, 0, 'NO', [79, 79, 79], null, w, h, 2, 2)
    this.option_text_yes.set_rollover(this.option_hover_image, this.rollover_sound, 0, 1)
    this.option_text_no.set_rollover(this.option_hover_image, this.rollover_sound, 0, 1)
    this.option_text_yes.set_rollover_color([132, 15, 15], null)
    this.option_text_no.set_rollover_color([132, 15, 15], null)
    this.option_text_yes.add_event_handler(ItemEvent.CLICK, this.option_click)
    this.option_text_no.add_event_handler(ItemEvent.CLICK, this.option_click)
    this.layer.add(this.option_text_yes)
    this.layer.add(this.option_text_no)
  }

  option_click = (item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    if (item === this.next) this.show_next()
    else if (item === this.option_text_yes) {
      this.stage.close_dialog(this.layer)
      this.active_dialog = WITNESS_REQUEST
      this.show_witness_dialog(true)
    } else if (item === this.option_text_no) this.close_minigame()
  }

  show_next() {
    if (this.active_dialog === WITNESS_REQUEST) {
      this.stage.close_dialog(this.layer)
      this.show_witness_minigame()
    } else if (this.active_dialog === WITNESS_GOODBYE) {
      this.phase1content.minigame_solved(false)
      this.close_minigame()
    } else if (this.active_dialog === SCORE_DIALOG) {
      if (this.score_continue_visible) {
        this.stage.close_dialog(this.layer)
        this.active_dialog = WITNESS_THANKS
        this.show_witness_dialog(true)
      } else this.skip_scores_animation = true
    } else if (this.active_dialog === WITNESS_THANKS) {
      this.stage.close_dialog(this.layer)
      this.active_dialog = WITNESS_AID
      this.show_witness_dialog(true)
    } else if (this.active_dialog === WITNESS_AID) {
      this.stage.close_dialog(this.layer)
      this.active_dialog = WITNESS_AID_2
      this.show_witness_dialog(true)
    } else if (this.active_dialog === WITNESS_AID_2) this.close_minigame(1)
    else if (this.active_dialog === WRONG_PLACE_DIALOG) this.close_minigame(2)
  }

  show_witness_dialog(transition = false, blind_witness = false) {
    this.layer.empty()
    this.stage.prepare_dialog(this.character_layer, false, true)
    this.stage.show_dialog(this.layer, this.handle_event)
    if (this.score_layer.items.length > 0) {
      this.stage.add_layer(this.score_layer)
      animations.blind_layer(this.score_layer, animations.BlindDirection.HIDE_DOWN, null, 450, this.hide_score_callback)
    }
    this.set_up_witness_message_box(false)
    this.set_up_witness()
    this.stage.add_layer(this.character_layer)
    this.stage.add_layer(this.witness_layer)
    let text2 = ''
    let request_line_count = 0
    if (this.active_dialog === WITNESS_REQUEST) {
      text2 = this.request_text
      const text3 = this.request_question_text
      request_line_count = splitlines(text3).length
      let box_text3: ItemText
      if (request_line_count <= 1) box_text3 = new ItemText(86, 195, this.font_14_bld, 16, text3, [0, 0, 0], null, 378, 34, 2, 3)
      else box_text3 = new ItemText(86, 195, this.font_12_bld, 16, text3, [0, 0, 0], null, 378, 36, 2, 3)
      this.layer.add(box_text3)
    } else if (this.active_dialog === WITNESS_GOODBYE) {
      text2 = 'Gracias de todos modos.\nQuizás puedas ayudarme en otro momento.'
    } else if (this.active_dialog === WITNESS_THANKS) {
      text2 = this.thanks_text
    } else if (this.active_dialog === WITNESS_AID) {
      text2 = this.witness.witness_statement.intro_statement.text + '\n\n' + this.witness.witness_statement.janitor_statement.text
    } else if (this.active_dialog === WITNESS_AID_2) {
      text2 = this.witness.witness_statement.identikit_statement.text
      if (this.witness.witness_statement.location_statement) text2 += '\n\n' + this.witness.witness_statement.location_statement.text
    } else if (this.active_dialog === WRONG_PLACE_DIALOG) {
      text2 = this.stage.game.datastore.list_statements[0].text
    }
    if (this.active_dialog !== WITNESS_REQUEST) {
      const additional_fonts = { bold: [this.font_14_bld, 15, -1] as [Font, number, number] }
      let x = 100
      // isinstance(self, MinigameBricklayer) (import circular evitado: se usa su categoría)
      if (this.score_category === 'bricklayer') x -= 4
      this.box_text2 = new ItemText(x, 116, this.font_14, 16, text2, [0, 0, 0], null, 340, 130, 2, 2, additional_fonts)
    } else if (request_line_count <= 1) this.box_text2 = new ItemText(86, 129, this.font_13, 16, text2, [0, 0, 0], null, 378, 78, 2, 2)
    else this.box_text2 = new ItemText(86, 122, this.font_13, 16, text2, [0, 0, 0], null, 378, 78, 2, 2)
    this.layer.add(this.box_text2)
    let image: Image, rollover_image: Image
    if (this.active_dialog === WRONG_PLACE_DIALOG) { image = this.previous_image; rollover_image = this.previous_rollover_image }
    else { image = this.next_image; rollover_image = this.next_rollover_image }
    this.next = new ItemImage(252, 232, image)
    this.next.set_rollover_image(rollover_image, this.rollover_sound)
    this.next.add_event_handler(ItemEvent.CLICK, this.option_click)
    this.layer.add(this.next)
    const ignore_layers = [this.character_layer, this.score_layer]
    if (transition && !blind_witness) ignore_layers.push(this.witness_layer)
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, !transition, ignore_layers)
  }

  hide_score_callback = (_layer: Layer) => { this.score_layer.empty() }

  show_dialog(active_dialog: number) {
    this.active_dialog = active_dialog
    this.stop_stage_music()
    this.stage.prepare_dialog(this.character_layer, false, true)
    this.stage.show_dialog(this.layer, this.handle_event)
    this.stage.add_layer(this.character_layer)
    const ignore_layers = [this.character_layer]
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, true, ignore_layers, (l: Layer) => this.blind_show_dialog_callback(l))
  }

  stop_stage_music() {
    if (!this.start_stage_music && !this.playing_minigame_music) {
      this.stage.set_music_volume(0, 450)
      this.start_stage_music = true
    }
  }

  show_score() {
    this.active_dialog = SCORE_DIALOG
    this.score_continue_visible = false
    this.skip_scores_animation = false
    this.stage.prepare_dialog(this.character_layer, false, true)
    this.stage.show_dialog(this.layer, this.handle_event)
    this.set_up_score()
    this.set_up_witness()
    for (const l of this.minigame_above_layers) this.stage.add_layer(l)
    this.stage.add_layer(this.score_layer)
    this.stage.add_layer(this.character_layer)
    this.show_happy_character()
    if (this.playing_minigame_music) this.stage.set_music_volume(0.7, 400)
    animations.blind_layer(this.score_layer, animations.BlindDirection.SHOW_DOWN, null, 450, (l) => this.show_score_callback(l))
    animations.blind_layer(this.witness_layer, animations.BlindDirection.SHOW_DOWN, null, 450, null)
    animations.blind_layer(this.layer, animations.BlindDirection.HIDE_DOWN, null, 450, null)
    animations.blind_layer(this.witness_worried_layer, animations.BlindDirection.HIDE_DOWN, null, 450, null)
    for (const l of this.minigame_above_layers) animations.blind_layer(l, animations.BlindDirection.HIDE_DOWN, null, 450, null)
  }

  show_happy_character() {
    this.witness_worried_layer = this.witness_layer
    this.stage.add_layer(this.witness_worried_layer)
    this.witness_layer = new Layer()
    this.witness_item = this.create_character_happy_item()
    this.witness_layer.add(this.witness_item)
    this.stage.add_layer(this.witness_layer)
  }

  create_character_happy_item(): ItemImage { throw new Error('minigame not implemented') }

  show_score_callback(_layer: Layer) {
    this.layer.empty()
    this.score_item = 1
    this.add_score_item()
  }

  show_wrong_place_dialog() { this.show_dialog(WRONG_PLACE_DIALOG) }

  blind_show_dialog_callback(_layer: Layer) {
    this.stage.close_dialog(this.layer)
    this.show_witness_dialog(true, true)
  }

  close_minigame(result = 0) {
    this.stop_minigame_music()
    this.stop_minigame(result !== 1)
    this.close_result = result
    const ignore_layers = [this.character_layer]
    this.stage.blind_dialog(this.layer, animations.BlindDirection.HIDE_UP, true, ignore_layers, (l: Layer) => this.blind_close_callback(l))
    this.stage.reset_dialog(false, true)
  }

  stop_minigame_music(fadems = 400) {
    if (this.playing_minigame_music) {
      this.playing_minigame_music = false
      this.start_stage_music = true
      this.stage.set_music_volume(0, fadems)
    }
  }

  blind_close_callback(_layer: Layer) {
    this.stage.close_dialog(this.layer)
    this.stage.reset_dialog()
    if (this.start_stage_music) {
      this.start_stage_music = false
      this.stage.play_phase_music()
    }
    if (this.close_result === 1) this.phase1content.minigame_solved(true)
    else if (this.close_result === 2) this.stage.show_clues_with_fade(this.start_map_help_animation)
  }

  start_map_help_animation = (_item: unknown = null) => { this.stage.start_map_help_animation() }

  minigame_solved_callback() {
    this.minigame_above_layers = []
    let layer_found = false
    for (const l of this.stage.layers) {
      if (layer_found) {
        if (l !== this.character_layer && l !== this.witness_layer) this.minigame_above_layers.push(l)
      } else if (l === this.layer) layer_found = true
    }
    this.stop_minigame_music()
    this.stage.close_dialog(this.layer)
    this.show_score()
  }

  show_help_dialog(close_callback: (() => void) | null = null) {
    this.stage.show_dialog(this.help_layer, this.help_handle_event, undefined, undefined, close_callback)
    this.stage.blind_dialog(this.help_layer, animations.BlindDirection.SHOW_DOWN, true, [], (l: Layer) => this.blind_show_help_callback(l))
  }

  close_help_dialog() {
    this.active_dialog = WITNESS_MINIGAME
    this.stage.blind_dialog(this.help_layer, animations.BlindDirection.HIDE_DOWN, true, [], (l: Layer) => this.blind_close_help_callback(l))
  }

  help_handle_event = (e: PgEvent): unknown => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.stage.click_sound.play()
      this.close_help_dialog()
      return true
    }
    return undefined
  }

  blind_show_help_callback(_layer: Layer) {
    this.set_up_help_dialog()
    this.set_up_help_data()
    this.stage.add_layer(this.help_previous_layer)
    this.stage.add_layer(this.help_current_layer)
    this.stage.blind_dialog(this.help_layer, animations.BlindDirection.SHOW_DOWN, false, [], null)
    this.stage.render()
    animations.wait(this.stage, 100, () => this.play_help_sound())
  }

  play_help_sound() { this.help_sound.play() }

  set_up_help_dialog() {
    this.font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    this.help_layer.add(new ItemImage(112, 24, assets.load_image('p1_minigame_help_background.png'), null))
    const close_button_image = assets.load_image('p1_minigames_btn_play_normal.png')
    const close_button_rollover_image = assets.load_image('p1_minigames_btn_play_rollover.png')
    this.next_button_image = assets.load_image('p1_minigames_btn_next_normal.png')
    this.next_button_rollover_image = assets.load_image('p1_minigames_btn_next_rollover.png')
    this.previous_button_image = assets.load_image('p1_minigames_btn_prev_normal.png')
    this.previous_button_rollover_image = assets.load_image('p1_minigames_btn_prev_rollover.png')
    this.help_close_button = new ItemImage(262, 371, close_button_image, null)
    this.help_close_button.set_rollover_image(close_button_rollover_image, this.rollover_sound)
    this.help_next_button = new ItemImage(356, 374, this.next_button_image, null)
    this.help_next_button.set_rollover_image(this.next_button_rollover_image, this.rollover_sound)
    this.help_previous_button = new ItemImage(220, 374, this.previous_button_image, null)
    this.help_previous_button.set_rollover_image(this.previous_button_rollover_image, this.rollover_sound)
    this.help_close_button.add_event_handler(ItemEvent.CLICK, this.help_button_click)
    this.help_next_button.add_event_handler(ItemEvent.CLICK, this.help_button_click)
    this.help_previous_button.add_event_handler(ItemEvent.CLICK, this.help_button_click)
    this.help_layer.add(this.help_close_button)
    this.help_layer.add(this.help_next_button)
    this.help_layer.add(this.help_previous_button)
  }

  help_button_click = (item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    if (item === this.help_close_button) this.close_help_dialog()
    else if (this.active_dialog === WITNESS_HELP) {
      if (item === this.help_next_button) this.help_stage += 1
      else this.help_stage -= 1
      this.help_previous_button.set_visible(this.help_stage > 1)
      this.help_next_button.set_visible(this.help_stage < this.max_help_stages)
      this.set_up_help_data()
    } else if (item === this.help_previous_button) {
      this.help_stage -= 1
      this.set_up_help_data()
      if (this.help_stage === this.max_help_stages - 1) this.help_next_button.set_visible(true)
      else if (this.help_stage === 2) this.help_previous_button.set_visible(false)
    }
  }

  clean_help_dialog() {
    if (this.active_dialog === WITNESS_MINIGAME) {
      this.active_dialog = WITNESS_HELP
      this.help_stage = 1
      this.help_previous_button.set_visible(false)
    }
  }

  set_up_help_data() {
    const items = this.help_current_layer.items.slice()
    this.help_previous_layer.empty()
    this.help_current_layer.empty()
    for (const item of items) this.help_previous_layer.add(item)
    this.clean_help_dialog()
    this.load_help_data()
    if (this.help_previous_layer.items.length > 0) {
      animations.stop_blind_layer(this.help_current_layer)
      animations.stop_blind_layer(this.help_previous_layer)
      this.help_previous_layer.set_clip(null)
      animations.blind_layer(this.help_current_layer, animations.BlindDirection.SHOW_DOWN, this.help_current_layer.get_bounds(), 350, null, false)
      animations.blind_layer(this.help_previous_layer, animations.BlindDirection.HIDE_DOWN, this.help_previous_layer.get_bounds(), 350, null, false)
    }
  }

  load_help_data() {}

  blind_close_help_callback(_layer: Layer) {
    this.help_layer.empty()
    this.help_previous_layer.empty()
    this.help_current_layer.empty()
    this.stage.close_dialog(this.help_layer)
    this.start_minigame()
  }

  help_click = (_item: unknown, _args: unknown) => {
    this.stop_minigame(false)
    this.stage.set_music_volume(0, 600)
    this.show_help_dialog()
  }

  loose_game = () => {
    this.active_dialog = WITNESS_GOODBYE
    this.stage.close_dialog(this.layer)
    this.stage.reset_dialog()
    this.show_witness_dialog(true)
  }

  stop_minigame(_solved: boolean) {}
  start_minigame(..._args: unknown[]) {}

  start_play_stats_event() { this.stage.game.stats.start_time_event(this.play_statcode) }

  end_play_stats_event(solved: boolean) {
    const accumulate = solved ? this.solved_statcode : this.not_solved_statcode
    this.stage.game.stats.end_time_event(this.play_statcode, accumulate)
  }

  get_music(): any { return null }

  play_music() {
    const music_loop = this.get_music()
    this.stage.play_music(null, music_loop)
    this.playing_minigame_music = true
  }

  set_up_minigame() { throw new Error('minigame not implemented') }

  calculate_solved_score(): number[] { return [] }

  get_common_modifiers(mod: number) {
    return mod & (KMOD.KMOD_LCTRL | KMOD.KMOD_RCTRL | KMOD.KMOD_LALT | KMOD.KMOD_RALT | KMOD.KMOD_LSHIFT | KMOD.KMOD_RSHIFT)
  }
}

const splitlines = (t: string) => {
  const parts = t.split(/\r\n|\r|\n/)
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts
}

export function calculate_score_increment(score_increment: number, final_value: number, base_score: number) {
  let increment = Math.max(score_increment, Math.max(idiv(final_value, 30), idiv(base_score, 30)))
  increment -= pmod(increment, 10)
  increment += 8
  return increment
}
