// Port de game/stages/help.py (ayuda / tutorial del policía)
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import { Layer, ItemImage, ItemText, ItemEvent, Rect, KEYDOWN, K, type FontSpec } from '../../framework/stage.ts'
import type { PgEvent } from '../../pg/events.ts'

const BLACK = [0, 0, 0]
const RED = [144, 22, 22]

export class Help {
  stage: any
  hide_up: boolean
  include_ui_help: boolean
  ui_page_count = 4
  guide_page_count = 9
  layer = new Layer()
  current_layer = new Layer()
  previous_layer = new Layer()
  button_layer = new Layer()
  continue_sound: any
  rollover_sound: any
  help_sound: any
  page = 1
  show_nextprevious = false
  close_callback: (() => void) | null = null
  page_range: number[] | null = null
  ui_help = false
  background_item!: ItemImage
  font_20_bold: any
  font_13: any
  font_13_bold: any
  close_button_image: any
  close_button_rollover_image: any
  next_button_image: any
  next_button_rollover_image: any
  previous_button_image: any
  previous_button_rollover_image: any
  previous_button_item!: ItemImage
  next_button_item!: ItemImage

  constructor(stage: any, hide_up = false, include_ui_help = false) {
    this.stage = stage
    this.hide_up = hide_up
    this.include_ui_help = include_ui_help
    this.continue_sound = stage.click_sound
    this.rollover_sound = stage.rollover_sound
    this.help_sound = assets.load_sound('p0_help.ogg')
  }

  show_help(page: number, show_nextprevious: boolean, show_empty_background: boolean, close_callback: (() => void) | null = null, page_range: number[] | null = null) {
    this.page = page
    this.show_nextprevious = show_nextprevious
    this.close_callback = close_callback
    this.page_range = page_range
    this.ui_help = this.include_ui_help && page === 1
    this.load_help_shared_data()
    this.stage.show_dialog(this.layer, this.handle_event)
    if (show_empty_background) this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, true, [], (l: Layer) => this.blind_show_help_callback(l))
    else this.blind_show_help_callback(this.layer, true)
  }

  close_help() {
    const dir = this.hide_up ? animations.BlindDirection.HIDE_UP : animations.BlindDirection.HIDE_DOWN
    this.stage.blind_dialog(this.layer, dir, true, [], (l: Layer) => this.blind_close_help_callback(l))
  }

  blind_show_help_callback(_layer: Layer, blind_background = false) {
    this.set_up_help_dialog()
    this.set_up_help_page()
    this.stage.add_layer(this.previous_layer)
    this.stage.add_layer(this.current_layer)
    this.stage.add_layer(this.button_layer)
    this.stage.blind_dialog(this.layer, animations.BlindDirection.SHOW_DOWN, blind_background, [])
    this.stage.render()
    animations.wait(this.stage, 100, () => this.play_help_sound())
  }

  play_help_sound() { this.help_sound.play() }

  load_help_shared_data() {
    this.background_item = new ItemImage(51, 27, assets.load_image('p0_tutorial_remake_background.png'))
    this.font_20_bold = assets.load_font('evilgeniusbb_bld.ttf', 20)
    this.font_13 = assets.load_font('evilgeniusbb_reg.ttf', 13)
    this.font_13_bold = assets.load_font('evilgeniusbb_bld.ttf', 13)
    this.close_button_image = assets.load_image('p0_tutorial_remake_btn_close_normal.png')
    this.close_button_rollover_image = assets.load_image('p0_tutorial_remake_btn_close_rollover.png')
    if (this.show_nextprevious) {
      this.next_button_image = assets.load_image('p0_tutorial_remake_btn_next_normal.png')
      this.next_button_rollover_image = assets.load_image('p0_tutorial_remake_btn_next_rollover.png')
      this.previous_button_image = assets.load_image('p0_tutorial_remake_btn_prev_normal.png')
      this.previous_button_rollover_image = assets.load_image('p0_tutorial_remake_btn_prev_rollover.png')
    }
    this.continue_sound = assets.load_sound('GUI_Click.ogg')
  }

  set_up_help_dialog() {
    this.layer.empty()
    this.layer.add(this.background_item)
    const close_button_item = new ItemImage(261, 382, this.close_button_image)
    close_button_item.set_rollover_image(this.close_button_rollover_image, this.rollover_sound)
    close_button_item.add_event_handler(ItemEvent.CLICK, this.close_button_click)
    this.button_layer.add(close_button_item)
    if (this.show_nextprevious) {
      this.previous_button_item = new ItemImage(220, 386, this.previous_button_image)
      this.previous_button_item.set_rollover_image(this.previous_button_rollover_image, this.rollover_sound)
      this.previous_button_item.add_event_handler(ItemEvent.CLICK, this.previous_button_click)
      this.button_layer.add(this.previous_button_item)
      this.next_button_item = new ItemImage(356, 386, this.next_button_image)
      this.next_button_item.set_rollover_image(this.next_button_rollover_image, this.rollover_sound)
      this.next_button_item.add_event_handler(ItemEvent.CLICK, this.next_button_click)
      this.button_layer.add(this.next_button_item)
    }
  }

  private img(name: string, x: number, y: number) { this.current_layer.add(new ItemImage(x, y, assets.load_image(name))) }
  private txt(x: number, y: number, font: any, lh: number, msg: string, w: number, h: number, ha: number, va: number, af: Record<string, FontSpec> = {}) {
    this.current_layer.add(new ItemText(x, y, font, lh, msg, BLACK, null, w, h, ha, va, af))
  }
  private number(y: number) { this.current_layer.add(new ItemText(264, y, this.font_20_bold, 0, String(this.page), RED, null, 66, 25, 2, 1)) }

  set_up_help_page() {
    const items = this.current_layer.items.slice()
    this.previous_layer.empty()
    this.current_layer.empty()
    for (const item of items) this.previous_layer.add(item)
    const police1 = 'p0_tutorial_remake_policeman_pos1.png'
    const p = this.page
    if (this.ui_help) {
      if (p === 1) {
        this.img('p0_tut_nuevo_interface_notext_001.jpg', 69, 89)
        this.txt(173, 178, this.font_13, 12, 'DEPARTAMENTO\nACTUAL', 115, 50, 1, 1)
        this.txt(292, 178, this.font_13, 12, 'DÍA & HORA', 115, 30, 3, 1)
        this.txt(219, 245, this.font_13, 12, 'AQUÍ PUEDES VER TODA LA\nINFORMACIÓN SOBRE\n&#c150,6,3!TU DETECTIVE&#c!', 176, 52, 1, 1)
        this.img(police1, 394, 69)
      } else if (p === 2) {
        this.img('p0_tut_nuevo_interface_notext_002.jpg', 69, 89)
        this.txt(193, 156, this.font_13, 12, 'AQUÍ VERÁS LOS &#c150,6,3!OBJETOS&#c! QUE\nENCUENTRES AL INVESTIGAR EL\nESCONDITE DEL LADRÓN.', 195, 60, 2, 1)
        this.img(police1, 394, 69)
      } else if (p === 3) {
        this.img('p0_tut_nuevo_interface_notext_003.jpg', 69, 89)
        this.txt(110, 135, this.font_13, 12, 'CON ESTE &#c150,6,3!MAPA&#c! PUEDES\n&#c150,6,3!VIAJAR&#c! POR TODO EL PAÍS\nPARA ATRAPAR AL LADRÓN.', 235, 47, 3, 1)
        this.txt(110, 189, this.font_13, 12, 'AQUÍ PUEDES VER TODA LA\n&#c150,6,3!INFORMACIÓN&#c! SOBRE EL CASO Y\n&#c150,6,3!HACER EL IDENTIKIT&#c! DEL LADRÓN.', 235, 47, 3, 1)
        this.txt(110, 248, this.font_13, 12, 'AQUÍ PUEDES VER TODOS LOS\n&#c150,6,3!DATOS&#c! QUE HAYAS OBTENIDO\nSOBRE NUESTRO PAÍS.', 235, 47, 3, 1)
        this.img(police1, 394, 69)
      } else if (p === 4) {
        this.img('p0_tut_nuevo_interface_notext_004.jpg', 69, 89)
        this.txt(147, 100, this.font_13, 12, 'PRESIONANDO LA TECLA &#c150,6,3!"X"&#c! ACCEDES AL MENÚ\nPRINCIPAL. EL PROGRESO DE TU DETECTIVE\nQUEDA GUARDADO AUTOMÁTICAMENTE.', 286, 45, 3, 1)
        this.img(police1, 394, 69)
      }
    } else {
      const bold16: Record<string, FontSpec> = { bold: [this.font_13_bold, 16, -2] }
      if (p === 1) {
        this.img('p0_tutorial_remake_d1.jpg', 67, 140)
        this.number(133)
        let message = !this.include_ui_help ? '&#c144,22,22!&#f:bold!Saludos Agente.&#f!&#c!\n' : ''
        message += 'te haré una breve reseña de los\n' + '&#f:bold!pasos a seguir para atrapar al ladrón.&#f!'
        this.txt(114, 84, this.font_13, 16, message, 364, 50, 2, 2, bold16)
        this.txt(171, 162, this.font_13, 16, 'Interroga a &#c144,22,22!&#f:bold!los testigos&#f!&#c! que han visto actividades sospechosas.', 243, 35, 2, 2, bold16)
        this.img(police1, 394, 69)
      } else if (p === 2) {
        this.img('p0_tutorial_remake_d4.jpg', 67, 87)
        this.number(80)
        const message = 'Usa las &#f:bold!pistas&#f! que te den los &#f:bold!testigos&#f! para\n' + '&#f:bold!armar el identikit del ladrón&#f! y enviar\n' + 'una&#f:bold! orden de arresto&#f! en su contra, sin ella\n' + '&#c144,22,22!&#f:bold!no podrás arrestarlo&#f!&#c! aunque lo atrapes.'
        this.txt(130, 96, this.font_13, 16, message, 332, 92, 2, 2, bold16)
        this.img(police1, 394, 69)
      } else if (p === 3) {
        this.img('p0_tutorial_remake_d5.jpg', 67, 87)
        this.number(80)
        this.txt(166, 112, this.font_13, 16, 'Recuerda que tienes un &#f:bold!tiempo límite&#f! para atrapar al ladrón.\n' + 'SI LO SOBREPASAS, &#f:bold!ESCAPARÁ&#f!.', 263, 50, 2, 2, bold16)
        this.img('p0_tutorial_remake_policeman_pos2.png', 394, 69)
      } else if (p === 4) {
        this.img('p0_tutorial_remake_d2.jpg', 67, 87)
        this.number(80)
        this.txt(171, 109, this.font_13, 16, 'Usa las pistas que te den para dar con el &#f:bold!escondite&#f! del ladrón.', 243, 34, 2, 2, bold16)
        this.img('p0_tutorial_remake_policeman_pos2.png', 394, 69)
      } else if (p === 5) {
        this.img('p0_tutorial_remake_d3.jpg', 67, 87)
        this.number(80)
        this.txt(161, 109, this.font_13, 16, 'Investiga el escondite para\nencontrar pistas que te indiquen su\nnuevo paradero.', 263, 50, 2, 2, bold16)
        this.img(police1, 394, 69)
      } else if (p === 6) {
        this.img('p0_tutorial_remake_dik.jpg', 67, 87)
        this.number(80)
        this.txt(166, 132, this.font_13_bold, 16, '¡Persigue al ladrón &#c144,22,22!en tu coche&#c! antes de que se escape!', 263, 50, 2, 2)
        this.img('p0_tutorial_remake_policeman_pos3.png', 394, 69)
      } else if (p === 7) {
        this.img('p3_help_d1.jpg', 68, 87)
        this.txt(141, 101, this.font_13_bold, 14, 'Debes atrapar al ladrón antes de que\nse acabe el combustible.', 302, 38, 2, 2)
        this.txt(141, 141, this.font_13, 14, 'Para conducir el auto usa los\n&#f:bold!&#c150,6,3!siguientes controles&#c!&#f!:', 302, 38, 2, 2, { bold: [this.font_13_bold, 14, -1] })
        this.img(police1, 394, 69)
      } else if (p === 8) {
        this.img('p3_help_d2.jpg', 68, 87)
        this.txt(141, 105, this.font_13_bold, 12, '&#c150,6,3!O TAMBIÉN PUEDES UTILIZAR:&#c!', 302, 38, 2, 2)
        this.img(police1, 394, 69)
      } else if (p === 9) {
        this.img('p3_help_d3.jpg', 68, 87)
        this.txt(141, 112, this.font_13, 16, 'Para atrapar al ladrón solo debes &#f:bold!adelantarlo&#f!.', 302, 38, 2, 2, bold16)
        this.img(police1, 394, 69)
      } else if (p === 101) {
        this.img('p0_tutorial_remake_dik.jpg', 67, 87)
        this.txt(143, 93, this.font_13, 16, '&#c144,22,22!&#f:bold!¡MUY BIEN!&#f!&#c!\nVas por buen camino, ya tienes una &#f:bold!órden\nde arresto&#f! contra el ladrón.\n\nAhora deberás &#f:bold!seguir buscándolo&#f!\npara poder atraparlo.', 312, 128, 2, 2, bold16)
        this.img(police1, 394, 69)
      } else if (p === 102) {
        this.img('p0_tutorial_remake_dg2.jpg', 67, 87)
        this.txt(130, 94, this.font_13, 16, '&#c144,22,22!&#f:bold!¡MUY BIEN!&#f!&#c!\nYa encontraste &#f:bold!todas las pistas&#f! que\nhay en la habitación.\n\nAhora deberás usarlas para descubrir la &#f:bold!nueva\nubicación&#f! del ladrón y &#f:bold!viajar&#f! hasta allí.', 340, 128, 2, 2, bold16)
        this.img(police1, 394, 69)
      }
    }
    if (this.show_nextprevious) {
      if (this.include_ui_help) {
        this.previous_button_item.set_visible(this.page > 1 || !this.ui_help)
        this.next_button_item.set_visible(this.page < this.guide_page_count || this.ui_help)
      } else {
        const from_page = this.page_range == null ? 1 : this.page_range[0]
        const to_page = this.page_range == null ? this.guide_page_count : this.page_range[1]
        this.previous_button_item.set_visible(this.page > from_page)
        this.next_button_item.set_visible(this.page < to_page)
      }
    }
    if (this.previous_layer.items.length > 0) {
      animations.stop_blind_layer(this.current_layer)
      animations.stop_blind_layer(this.previous_layer)
      this.previous_layer.set_clip(null)
      const area = new Rect(69, 52, 455, 345)
      animations.blind_layer(this.current_layer, animations.BlindDirection.SHOW_DOWN, area, 450, null, false)
      animations.blind_layer(this.previous_layer, animations.BlindDirection.HIDE_DOWN, area, 450, null, false)
    }
  }

  close_button_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    this.close_help()
  }

  blind_close_help_callback(_layer: Layer) {
    this.stage.close_dialog(this.layer)
    if (this.close_callback != null) this.close_callback()
  }

  previous_button_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    this.page -= 1
    if (this.page === 0 && !this.ui_help) {
      this.page = this.ui_page_count
      this.ui_help = true
    }
    this.set_up_help_page()
  }

  next_button_click = (_item: unknown, _args: unknown) => {
    this.stage.render()
    this.continue_sound.play()
    this.page += 1
    if (this.page > this.ui_page_count && this.ui_help) {
      this.page = 1
      this.ui_help = false
    }
    this.set_up_help_page()
  }

  handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === K.K_ESCAPE) {
      this.stage.render()
      this.continue_sound.play()
      this.close_help()
      return true
    }
    return undefined
  }
}
