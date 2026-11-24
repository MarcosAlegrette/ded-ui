// Port de game/stages/case.py
import * as map from './map.ts'
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import { Stage, Layer, ItemImage, ItemText, ItemEvent, KEYDOWN, K } from '../../framework/stage.ts'
import type { PgEvent } from '../../pg/events.ts'

export class CaseStage extends Stage {
  font: any
  newcase_sound: any
  rollover_sound: any
  continue_sound: any
  case_layer!: Layer
  next_button!: ItemImage

  constructor(game: any) {
    super(game)
  }

  initialize() {
    this.font = assets.load_font('powdrft_.ttf', 17)
    this.newcase_sound = assets.load_sound('GUI_Turn_Page.ogg')
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.continue_sound = assets.load_sound('GUI_Click.ogg')
  }

  prepare() { this.set_up_case() }

  set_up_case() {
    this.case_layer = new Layer()
    this.case_layer.add(new ItemImage(0, 0, assets.load_image('p0_case_presentation_clean.jpg')))
    const text1 = new ItemText(45, 120, this.font, 13, '', [0, 0, 0], null, 230, 270)
    this.case_layer.add(text1)
    const text2 = new ItemText(330, 68, this.font, 13, '', [0, 0, 0], null, 131, 102)
    this.case_layer.add(text2)
    const text3 = new ItemText(330, 159, this.font, 13, '', [0, 0, 0], null, 220, 227)
    this.case_layer.add(text3)
    text1.break_text_into(text2)
    text2.break_text_into(text3)
    const ds = this.game.datastore
    const text = ds.user_character_progress.case.get_full_text(ds.user_character, ds.user_character_progress)
    text1.set_text(text)
    const next_image = assets.load_image('p0_endings_btn_continue_normal.png')
    const next_rollover_image = assets.load_image('p0_endings_btn_continue_rollover.png')
    this.next_button = new ItemImage(220, 401, next_image)
    this.next_button.set_rollover_image(next_rollover_image, this.rollover_sound)
    this.next_button.add_event_handler(ItemEvent.CLICK, this.next_click)
    this.case_layer.add(this.next_button)
    this.add_layer(this.case_layer)
    animations.blind_layer(this.case_layer, animations.BlindDirection.SHOW_DOWN, null)
    this.render()
    this.newcase_sound.play()
  }

  next_click = (_item: unknown, _args: unknown) => {
    this.render()
    this.continue_sound.play()
    this.go_next()
  }

  go_next() {
    const crime_department = this.game.datastore.user_character_progress.case.crime_location.department
    const m = new map.Map(this, false, true)
    this.show_dialog(m.map_layer, null)
    m.add_other_layer()
    m.go_to(crime_department, false)
  }

  handle_event(e: PgEvent) {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.render()
      this.continue_sound.play()
      this.go_next()
    }
    return undefined
  }
}
