// Port de game/stages/witness.py: ficha de un testigo (en la carpeta del caso).
import * as assets from '../../framework/assets.ts'
import { Layer, ItemImage, ItemText, ItemEvent, KEYDOWN, K, type FontSpec } from '../../framework/stage.ts'
import type { Font } from '../../pg/font.ts'
import type { PgEvent } from '../../pg/events.ts'

export class Witness {
  stage: any
  font_18: Font
  font_19: Font
  font_20: Font
  font_24: Font
  rollover_sound: any
  click_sound: any
  layer = new Layer()
  close_callback: (() => void) | null = null
  background_image!: assets.Image
  background!: ItemImage
  image!: ItemImage
  name!: ItemText
  department!: ItemText
  city!: ItemText
  statement!: ItemText
  close_button_image!: assets.Image
  close_button_image_rollover!: assets.Image
  close_button!: ItemImage

  constructor(stage: any) {
    this.stage = stage
    this.font_18 = assets.load_font('powdrft_.ttf', 18)
    this.font_19 = assets.load_font('powdrft_.ttf', 19)
    this.font_20 = assets.load_font('powdrft_.ttf', 20)
    this.font_24 = assets.load_font('powdrft_.ttf', 24)
    this.rollover_sound = stage.rollover_sound
    this.click_sound = stage.click_sound
    this.set_up_witness_background()
    this.set_up_witness_texts()
    this.set_up_witness_buttons()
  }

  show_witness(witness: any, close_callback: (() => void) | null = null) {
    this.close_callback = close_callback
    this.image.set_image(assets.load_image(witness.image))
    this.name.set_text(witness.name)
    this.city.set_text(witness.city.name)
    this.department.set_text(witness.department.name)
    const ws = witness.witness_statement
    let s = '"' + ws.intro_statement.text + '"\n\n"' + ws.janitor_statement.text + '"\n\n"' + ws.identikit_statement.text + '"'
    if (ws.location_statement) s += '\n\n"' + ws.location_statement.text.replace(/\n/g, ' ') + '"'
    this.statement.set_text(s)
    this.stage.show_dialog(this.layer, this.witness_handle_event)
  }

  close_witness() {
    this.stage.close_dialog(this.layer)
    if (this.close_callback != null) this.close_callback()
  }

  witness_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.click_sound.play()
      this.close_witness()
    }
  }

  set_up_witness_background() {
    this.background_image = assets.load_image('p0_witness_popup.png')
    this.background = new ItemImage(112, 53, this.background_image, null)
    this.image = new ItemImage(154, 82, null, null)
    this.layer.add(this.background)
    this.layer.add(this.image)
  }

  set_up_witness_texts() {
    this.name = new ItemText(219, 78, this.font_24, 0, '', [157, 21, 21], null, 180, 232)
    this.department = new ItemText(220, 117, this.font_18, 0, '', [102, 102, 102], null, 250, 232)
    this.city = new ItemText(221, 101, this.font_20, 0, '', [51, 51, 51], null, 250, 232)
    const additional_fonts: Record<string, FontSpec> = { bold: [this.font_19, 14, 0] }
    this.statement = new ItemText(157, 158, this.font_19, 14, '', [51, 51, 51], null, 285, 205, 1, 1, additional_fonts)
    this.layer.add(this.name)
    this.layer.add(this.city)
    this.layer.add(this.department)
    this.layer.add(this.statement)
  }

  set_up_witness_buttons() {
    this.close_button_image = assets.load_image('btn_testigo_x_normal.png')
    this.close_button_image_rollover = assets.load_image('btn_testigo_x_rollover.png')
    this.close_button = new ItemImage(432, 75, this.close_button_image, null, true)
    this.close_button.set_rollover(this.close_button_image_rollover, this.rollover_sound)
    this.close_button.add_event_handler(ItemEvent.CLICK, this.close_click)
    this.layer.add(this.close_button)
  }

  close_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    this.close_witness()
  }
}
