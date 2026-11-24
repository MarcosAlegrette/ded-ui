// Port de game/stages/janitor.py: el conserje del condominio (pregunta sobre deporte/mascota del
// ladrón) y las puertas equivocadas.
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import * as text from '../../framework/text.ts'
import { Layer, ItemImage, ItemText, ItemEvent, KEYDOWN, K } from '../../framework/stage.ts'
import type { CustomSound } from '../../framework/assets.ts'
import type { PgEvent } from '../../pg/events.ts'
import { randint } from '../../pg/py.ts'

export const HIDEOUT_DIALOG = 1
export const QUESTION_DIALOG = 2
export const WRONGDOOR_DIALOG = 3

export class Janitor {
  stage: any
  layer = new Layer()
  character_layer = new Layer()
  folder_layer: any = null
  rollover_sound: CustomSound
  continue_sound: CustomSound
  janitor_sound: CustomSound
  wrong_door_open_sound: CustomSound
  wrong_door_man_sound: CustomSound
  wrong_door_female_sound: CustomSound
  option_texts: string[] = []
  right_choice: string | null = null
  city: any
  active_dialog = HIDEOUT_DIALOG
  ignore_layers: Layer[] = []
  option_results: number[] = []
  kid_number = 0

  constructor(stage: any) {
    this.stage = stage
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.continue_sound = assets.load_sound('GUI_Click.ogg')
    this.janitor_sound = assets.load_sound('p0_janitor.ogg')
    this.wrong_door_open_sound = assets.load_sound('p0_wrong_door_open.ogg')
    this.wrong_door_man_sound = assets.load_sound('p0_wrong_door_no.ogg')
    this.wrong_door_female_sound = assets.load_sound('p0_wrong_door_no_female.ogg')
  }

  show_janitor(city: any, option_texts: string[], right_option: string) {
    this.option_texts = option_texts
    this.right_choice = right_option
    this.city = city
    this.active_dialog = HIDEOUT_DIALOG
    this.ignore_layers = []
    this.stage.prepare_dialog(this.character_layer, false, true)
    this.stage.show_dialog(this.layer, this.handle_event)
    this.stage.add_layer(this.character_layer)
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, true, [this.character_layer, ...this.ignore_layers], this.blind_show_janitor_callback)
  }

  blind_show_janitor_callback = (_layer: Layer) => {
    this.load_option_results()
    this.set_up_hideout_dialogue(this.city)
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, false, [this.character_layer, this.folder_layer, ...this.ignore_layers])
  }

  set_up_hideout_dialogue(city: any) {
    this.layer.add(new ItemImage(108, 86, assets.load_image('p1_hideout_box.png'), null))
    const font_24 = assets.load_font('powdrft_.ttf', 24)
    this.layer.add(new ItemText(163, 93, font_24, 0, text.to_upper(city.name), [157, 21, 21], null, 272, 30, 2, 2))
    const font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    const message = 'Luego de indagar en la localidad,\nconcluyes que el ladrón se hospeda en un\ncondominio de la zona. Una vez allí\n.'
    this.layer.add(new ItemText(119, 112, font_14, 18, message, [0, 0, 0], null, 360, 151, 2, 2))
    const font_14_bld = assets.load_font('evilgeniusbb_bld.ttf', 14)
    this.layer.add(new ItemText(150, 205, font_14_bld, 18, 'interrogas al conserje.', [0, 0, 0], null, 300, 25, 2))
    const next = new ItemImage(278, 238, assets.load_image('p0_button_next_active.png'))
    next.set_rollover_image(assets.load_image('p0_button_next_rollover.png'), this.rollover_sound)
    next.add_event_handler(ItemEvent.CLICK, this.hideout_next_click)
    this.layer.add(next)
  }

  set_up_question_dialog() {
    this.active_dialog = QUESTION_DIALOG
    this.layer.empty()
    this.set_up_janitor()
    this.set_up_avatar()
    this.set_up_options()
    this.set_up_folder()
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, false, [this.character_layer, this.folder_layer, ...this.ignore_layers], this.blind_show_question_callback)
  }

  blind_show_question_callback = (_layer: Layer) => {
    this.stage.render()
    this.janitor_sound.play()
  }

  set_up_wrongdoor_dialog(kid_number: number) {
    this.active_dialog = WRONGDOOR_DIALOG
    this.layer.empty()
    this.set_up_wrongdoor(kid_number)
    this.kid_number = kid_number
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, false, [this.character_layer, this.folder_layer, ...this.ignore_layers], this.blind_show_wrongdoor_callback)
    animations.wait(this.stage, 50, this.play_wrong_door)
  }

  play_wrong_door = () => { this.wrong_door_open_sound.play() }

  blind_show_wrongdoor_callback = (_layer: Layer) => {
    this.stage.render()
    if (this.kid_number === 1) this.wrong_door_man_sound.play()
    else if (this.kid_number === 2) this.wrong_door_female_sound.play()
    animations.wait_locked(this.stage, 400, this.update_wrong_door_time_left)
  }

  update_wrong_door_time_left = () => { this.stage.set_time_left(1) }

  set_up_janitor() {
    this.layer.add(new ItemImage(453, 87, assets.load_image('p1_janitor.png'), null))
    this.layer.add(new ItemImage(119, 74, assets.load_image('p1_janitor_box.png'), null))
    const c = this.stage.game.datastore.user_character_progress.case
    const question = c.list_witness_statements[0].janitor_statement.type
    let question_image: assets.Image | null = null
    if (question === 1) question_image = assets.load_image('p1_janitor_question_sport.gif')
    else if (question === 2) question_image = assets.load_image('p1_janitor_question_pet.gif')
    this.layer.add(new ItemImage(152, 140, question_image))
  }

  load_option_results() {
    let kid_number = randint(1, 2)
    this.option_results = []
    for (const option_text of this.option_texts) {
      if (option_text === this.right_choice) this.option_results.push(0)
      else {
        this.option_results.push(kid_number)
        kid_number = kid_number === 1 ? 2 : 1
      }
    }
  }

  set_up_options() {
    const font = assets.load_font('evilgeniusbb_bld.ttf', 11)
    const option_hover_image = assets.load_image('p1_avatar_option_hover.png')
    const x = 141
    let y = 259
    for (let i = 0; i < this.option_texts.length; i++) {
      const option_text = this.option_texts[i]
      if (this.option_results[i] === -1) {
        this.layer.add(new ItemText(x, y, font, 0, option_text, [153, 153, 153], null, option_hover_image.get_width(), option_hover_image.get_height(), 2, 2))
      } else {
        const t = new ItemText(x, y, font, 0, option_text, [79, 79, 79], null, option_hover_image.get_width(), option_hover_image.get_height(), 2, 2)
        t.set_rollover(option_hover_image, this.rollover_sound, 0, 1)
        t.set_rollover_color([132, 15, 15], null)
        t.add_event_handler(ItemEvent.CLICK, this.option_click)
        t.index = i
        this.layer.add(t)
      }
      y += 24
    }
  }

  set_up_folder() {
    if (this.folder_layer == null) {
      const folder = this.stage.folder_icon
      const folder_layer = folder.get_layer()
      folder_layer.remove(folder)
      this.folder_layer = folder_layer
      folder.select_witnesses = true
      this.character_layer.add(folder)
      this.character_layer.add(new ItemImage(441, 376, assets.load_image('p0_bottomgui_case_tag.png')))
    }
  }

  restore_folder() {
    if (this.folder_layer != null) {
      const folder = this.stage.folder_icon
      folder.select_witnesses = false
      this.layer.remove(folder)
      this.folder_layer.add(folder)
    }
  }

  set_up_avatar() {
    this.layer.add(new ItemImage(119, 244, assets.load_image('p1_avatar_box.png')))
  }

  set_up_wrongdoor(kid_number: number) {
    this.layer.add(new ItemImage(81, 116, assets.load_image('p1_wrongdoor_box.png')))
    let kid: ItemImage | null = null
    if (kid_number === 1) kid = new ItemImage(415, 104, assets.load_image('p1_wrongdoor_kid_001.png'))
    else if (kid_number === 2) kid = new ItemImage(434, 84, assets.load_image('p1_wrongdoor_kid_002.png'))
    this.layer.add(kid!)
    const next = new ItemImage(262, 249, assets.load_image('p0_button_previous_active.png'))
    next.set_rollover_image(assets.load_image('p0_button_previous_rollover.png'), this.rollover_sound)
    next.add_event_handler(ItemEvent.CLICK, this.wrongdoor_next_click)
    this.layer.add(next)
  }

  hideout_next_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    this.show_next()
  }

  show_next() {
    if (this.active_dialog === HIDEOUT_DIALOG) this.set_up_question_dialog()
    else if (this.active_dialog === WRONGDOOR_DIALOG) this.set_up_question_dialog()
  }

  wrongdoor_next_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    this.show_next()
  }

  option_click = (item: any, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    const result = this.option_results[item.index]
    if (result === 0) this.go_to_Phase2()
    else {
      this.set_up_wrongdoor_dialog(result)
      this.option_results[item.index] = -1
    }
  }

  go_to_Phase2() {
    this.restore_folder()
    this.stage.game.datastore.user_character_progress.case.time_spend += 1
    this.stage.set_phase(2)
  }

  handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.continue_sound.play()
      if (this.active_dialog === QUESTION_DIALOG) this.stage.show_mainmenu()
      else this.show_next()
      return true
    }
    return undefined
  }
}
