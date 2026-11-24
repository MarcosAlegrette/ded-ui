// Port de game/stages/presentation.py (historieta de introducción).
// Las consultas de actualización y el envío de estadísticas/errores a los servidores originales
// se omiten: la versión web nunca los contacta.
import * as startscreen from './startscreen.ts'
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import * as external from '../../framework/external.ts'
import { Stage, Layer, ItemImage, ItemMask, ItemText, ItemEvent, KEYDOWN, K, Surface, SRCALPHA } from '../../framework/stage.ts'
import type { Font } from '../../pg/font.ts'
import type { CustomSound, Image } from '../../framework/assets.ts'
import type { PgEvent } from '../../pg/events.ts'

export class PresentationStage extends Stage {
  actual_screen = 0
  actual_item = 0
  actual_layer: Layer | null = null
  next_item_wait: unknown = null
  caution_screen_shown = true
  font_13!: Font
  font_14!: Font
  font_13_bold!: Font
  music_intro!: CustomSound
  music_loop!: CustomSound
  rollover_sound!: CustomSound
  continue_sound!: CustomSound
  continue_button_layer: Layer | null = null
  continue_visible = false
  layer!: Layer
  escape_layer!: Layer
  escape_text_item!: ItemImage
  screen_mask!: ItemMask

  constructor(game: any) {
    super(game)
  }

  initialize() {
    this.actual_screen = 0
    this.actual_item = 0
    this.actual_layer = null
    this.next_item_wait = null
    this.caution_screen_shown = !external.other_activities_running()
    this.font_13 = assets.load_font('evilgeniusbb_reg.ttf', 13)
    this.font_14 = assets.load_font('evilgeniusbb_reg.ttf', 14)
    this.font_13_bold = assets.load_font('evilgeniusbb_bld.ttf', 13)
    this.music_intro = assets.load_music('p2_music_intro.ogg')
    this.music_loop = assets.load_music('p2_music_loop.ogg')
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.continue_sound = assets.load_sound('GUI_Click.ogg')
  }

  prepare() {
    if (this.caution_screen_shown) this.start_presentation()
    else {
      const layer = new Layer()
      this.add_layer(layer)
      layer.add(new ItemImage(132, 111, assets.load_image('p0_gamewarning_backslide.png')))
      layer.add(new ItemText(163, 183, this.font_14, 13, 'Se recomienda cerrar todas las aplicaciones para el correcto funcionamiento del juego.', [153, 0, 0], null, 268, 56, 2, 2))
      const button = new ItemImage(245, 265, assets.load_image('p0_gamewarning_btn_continuar_normal.png'))
      button.set_rollover_image(assets.load_image('p0_gamewarning_btn_continuar_rollover.png'), this.rollover_sound)
      button.add_event_handler(ItemEvent.CLICK, () => this.start_presentation())
      layer.add(button)
      this.caution_screen_shown = true
    }
  }

  start_presentation(..._args: unknown[]) {
    this.render()
    this.play_music(this.music_intro, this.music_loop)
    this.set_up_escape_button()
    this.show_next_screen()
  }

  show_next_screen() {
    if (this.actual_screen !== 5) {
      this.empty_layers()
      this.continue_button_layer = null
      this.continue_visible = false
      this.layer = new Layer()
      this.add_layer(this.layer)
      this.set_up_background()
      this.add_layer(this.escape_layer)
    } else {
      this.empty_layers([this.layer, this.escape_layer])
      this.layer.remove(this.screen_mask)
      const index = this.layers.indexOf(this.layer)
      this.layer = new Layer()
      this.set_up_background()
      this.add_layer(this.layer, index + 1)
      this.continue_button_layer = null
      this.continue_visible = false
    }
    animations.blind_layer(this.layer, animations.BlindDirection.SHOW_DOWN, null, 450, (l) => this.blind_show_screen_callback(l), false)
  }

  blind_show_screen_callback(_layer: Layer) {
    this.add_fast_click_mask()
    this.show_next_item()
  }

  add_fast_click_mask() {
    this.screen_mask = new ItemMask(0, 0, [600, 450])
    this.screen_mask.add_event_handler(ItemEvent.CLICK, (i, a) => this.screen_click(i, a))
    this.layer.add(this.screen_mask)
  }

  screen_click(_item: unknown, _args: unknown) {
    if (!this.continue_button_layer && this.actual_layer != null && this.actual_layer.get_stage() == null) {
      if (this.next_item_wait != null) animations.cancel_wait(this, this.next_item_wait)
      this.add_next_item_with_blind()
    }
  }

  set_up_background() {
    if (this.actual_screen >= 0 && this.actual_screen <= 4) {
      const image = assets.load_image('p0_intro_s' + (this.actual_screen + 1) + '_background.jpg')
      this.layer.add(new ItemImage(0, 0, image, null))
    } else if (this.actual_screen === 5) {
      while (this.layer.items.length > 1) this.layer.remove(this.layer.items[1])
      const [ww, wh] = this.game.get_window_size()
      const bs = new Surface([Math.floor(ww / 2), Math.floor(wh / 2)], SRCALPHA)
      bs.fill([0, 0, 0, 180])
      const bi = new assets.Image(bs)
      this.layer.add(new ItemImage(0, 0, bi))
      this.layer.add(new ItemImage(Math.floor(ww / 2), 0, bi))
      this.layer.add(new ItemImage(0, Math.floor(wh / 2), bi))
      this.layer.add(new ItemImage(Math.floor(ww / 2), Math.floor(wh / 2), bi))
    }
  }

  set_up_escape_button() {
    this.escape_layer = new Layer()
    const button_item = new ItemImage(545, 26, assets.load_image('p0_escape_intro_btn_normal.png'))
    button_item.set_rollover_image(assets.load_image('p0_escape_intro_btn_rollover.png'), this.rollover_sound)
    button_item.add_event_handler(ItemEvent.CLICK, (i, a) => this.escape_button_click(i, a))
    button_item.add_event_handler(ItemEvent.MOUSE_ENTER, (i, a) => this.escape_button_enter(i, a))
    button_item.add_event_handler(ItemEvent.MOUSE_LEAVE, (i, a) => this.escape_button_leave(i, a))
    this.escape_layer.add(button_item)
    this.escape_text_item = new ItemImage(433, 24, assets.load_image('p0_escape_intro_txt.png'))
    this.escape_text_item.set_visible(false)
    this.escape_layer.add(this.escape_text_item)
  }

  escape_button_click(_item: unknown, _args: unknown) {
    this.render()
    this.continue_sound.play()
    this.skip_presentation()
  }
  escape_button_enter(_item: unknown, _args: unknown) { this.escape_text_item.set_visible(true) }
  escape_button_leave(_item: unknown, _args: unknown) { this.escape_text_item.set_visible(false) }

  show_continue_button() {
    if (!this.continue_visible) {
      this.actual_layer = new Layer()
      const continue_button = new ItemImage(233, 403, assets.load_image('p0_endings_btn_continue_normal.png'))
      continue_button.set_rollover_image(assets.load_image('p0_endings_btn_continue_rollover.png'), this.rollover_sound)
      continue_button.add_event_handler(ItemEvent.CLICK, (i, a) => this.continue_button_click(i, a))
      this.actual_layer.add(continue_button)
      this.continue_visible = true
      this.next_item_wait = animations.wait(this, 2000, () => this.add_next_item_with_blind())
    }
  }

  show_next_item() {
    // [pantalla][ítem] -> [imagen, left, top, ms]; al terminar los ítems aparece "continuar"
    const ITEMS: [string, number, number, number][][] = [
      [['p0_intro_s1_dialogue.png', 317, 327, 1000]],
      [['p0_intro_s2_dialogue1.png', 49, 38, 1000], ['p0_intro_s2_dialogue2.png', 352, 281, 5500]],
      [['p0_intro_s3_dialogue1.png', 5, 24, 1000], ['p0_intro_s3_dialogue2.png', 308, 146, 5000], ['p0_intro_s3_dialogue3.png', 6, 317, 5000]],
      [['p0_intro_s4_dialogue1.png', 31, 29, 2000], ['p0_intro_s4_dialogue2.png', 328, 184, 5000]],
      [['p0_intro_s5_dialogue1.png', 3, 53, 1000]],
      [['p0_intro_s6_dialogue1.png', 149, 150, 250]],
    ]
    const screen = ITEMS[this.actual_screen]
    if (!screen) return
    const it = screen[this.actual_item]
    if (it) this.show_image(it[1], it[2], assets.load_image(it[0]), it[3])
    else this.show_continue_button()
  }

  show_image(left: number, top: number, image: Image, milliseconds: number) {
    this.actual_layer = new Layer()
    this.actual_layer.add(new ItemImage(left, top, image))
    this.next_item_wait = animations.wait(this, milliseconds, () => this.add_next_item_with_blind())
  }

  show_text(left: number, top: number, milliseconds: number, text: string, font: Font, color: number[], width = -1, height = -1) {
    this.actual_layer = new Layer()
    this.actual_layer.add(new ItemText(left, top, font, 0, text, color, null, width, height, 2, 2))
    this.next_item_wait = animations.wait(this, milliseconds, () => this.add_next_item_with_blind())
  }

  add_next_item_with_blind() {
    this.next_item_wait = null
    const max = [1, 2, 3, 2, 1][this.actual_screen]
    if (this.actual_screen <= 4) {
      if (this.actual_item < max) this.actual_item += 1
      else { this.actual_item = 0; this.actual_screen += 1 }
    } else if (this.actual_screen === 5) {
      if (this.actual_item < 1) this.actual_item = 1
      else { this.actual_item = 0; this.actual_screen = 6 }
    }
    this.add_layer(this.actual_layer!)
    if (this.escape_layer.get_stage() != null) this.remove_layer(this.escape_layer)
    this.add_layer(this.escape_layer)
    animations.blind_layer(this.actual_layer!, animations.BlindDirection.SHOW_DOWN, this.actual_layer!.get_bounds(), 450, null, false)
    if (this.actual_item !== 0) this.show_next_item()
  }

  continue_button_click(_item: unknown, _args: unknown) {
    this.render()
    this.continue_sound.play()
    if (this.actual_screen === 6) this.game.set_stage(new startscreen.StartScreenStage(this.game))
    else this.show_next_screen()
  }

  handle_event(e: PgEvent) {
    if (e.type === KEYDOWN && (e.key === K.K_SPACE || e.key === K.K_ESCAPE)) {
      this.render()
      this.continue_sound.play()
      this.skip_presentation()
      return true
    }
    return undefined
  }

  skip_presentation() { this.game.set_stage(new startscreen.StartScreenStage(this.game)) }
}
