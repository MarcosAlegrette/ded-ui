// Port de game/stages/startscreen.py
import * as mainmenu from './mainmenu.ts'
import * as animations from '../../framework/animations.ts'
import { BlindDirection } from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import { Stage, Layer, ItemImage, ItemMask, ItemEvent, KEYDOWN, K } from '../../framework/stage.ts'
import type { Font } from '../../pg/font.ts'
import type { CustomSound } from '../../framework/assets.ts'
import type { PgEvent } from '../../pg/events.ts'

export class StartScreenStage extends Stage {
  start_layer: Layer | null = null
  initial_mainmenu: boolean
  showing_main_menu = false
  font!: Font
  music_intro!: CustomSound
  music_loop!: CustomSound
  click_sound!: CustomSound
  rollover_sound!: CustomSound
  tc_layer!: Layer
  start_info_item!: ItemMask
  blink_text_image!: ItemImage

  constructor(game: any, initial_mainmenu = false) {
    super(game)
    this.initial_mainmenu = initial_mainmenu
  }

  prepare() {
    this.font = assets.load_font('evilgeniusbb_reg.ttf', 24)
    this.music_intro = assets.load_music('p1_music_intro.ogg')
    this.music_loop = assets.load_music('p1_music_loop.ogg')
    this.click_sound = assets.load_sound('GUI_Click.ogg')
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.render()
    this.play_music(this.music_intro, this.music_loop)
    if (this.initial_mainmenu) this.show_mainmenu(true)
    else {
      this.show_tc_logo()
      animations.wait(this, 3606, () => this.show_start_screen())
    }
  }

  show_tc_logo() {
    this.tc_layer = new Layer()
    this.add_layer(this.tc_layer)
    this.tc_layer.add(new ItemImage(220, 77, assets.load_image('p0_logomain_logo.jpg')))
    this.tc_layer.add(new ItemImage(181, 417, assets.load_image('p0_copyright_copy.jpg')))
    this.tc_layer.add(new ItemImage(527, 7, assets.load_image('p0_ceibal_logo.jpg')))
    animations.blind_layer(this.tc_layer, BlindDirection.SHOW_DOWN, null, 450, null, false)
  }

  show_start_screen() {
    if (!this.showing_main_menu) {
      this.start_layer = new Layer()
      this.start_layer.add(new ItemImage(0, 0, assets.load_image('p0_presentation_back_2.jpg')))
      this.start_info_item = new ItemMask(0, 0, [600, 450])
      this.start_layer.add(this.start_info_item)
      animations.wait(this, 366, () => this.add_start_info_item())
      this.blink_text_image = new ItemImage(166, 398, assets.load_image('p0_presentation_btn_2.jpg'))
      this.start_layer.add(this.blink_text_image)
      this.blink_text_image.set_visible(false)
      this.add_layer(this.start_layer)
      animations.blind_layer(this.tc_layer, BlindDirection.HIDE_DOWN, null, 450)
      animations.blind_layer(this.start_layer, BlindDirection.SHOW_DOWN, null, 450, (l) => this.blind_set_up_start_callback(l))
    }
  }

  add_start_info_item() {
    if (!this.showing_main_menu) this.start_info_item.add_event_handler(ItemEvent.CLICK, (i, a) => this.button_click(i, a))
  }

  blind_set_up_start_callback(_layer: Layer) {
    if (!this.is_timer_started('timer_start')) this.start_timer('timer_start', 390, () => this.update_timer())
  }

  update_timer() { this.blink_text_image.set_visible(!this.blink_text_image.get_visible()) }

  button_click(_item: unknown, _args: unknown) {
    this.render()
    this.click_sound.play()
    this.show_mainmenu()
  }

  handle_event(e: PgEvent) {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE && !this.showing_main_menu) {
      this.render()
      this.click_sound.play()
      this.remove_layer(this.tc_layer)
      this.show_mainmenu(true)
      return true
    }
    return undefined
  }

  show_mainmenu(apply_blind = true) {
    if (this.start_layer == null) this.blind_hide_start_callback(this.start_layer, apply_blind)
    else animations.blind_layer(this.start_layer, BlindDirection.HIDE_DOWN, null, 450, (l) => this.blind_hide_start_callback(l))
  }

  blind_hide_start_callback(_layer: Layer | null, apply_blind = true) {
    this.showing_main_menu = true
    const main = new mainmenu.MainMenu(this)
    main.show_mainmenu(false, null, apply_blind)
  }
}
