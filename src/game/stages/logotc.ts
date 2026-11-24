// Port de game/stages/logotc.py
import * as startscreen from './startscreen.ts'
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import { Stage, Layer, ItemRect, ItemImage } from '../../framework/stage.ts'

export class LogoTCStage extends Stage {
  layer!: Layer
  logo!: ItemImage

  constructor(game: any) {
    super(game)
  }

  initialize() {
    this.layer = new Layer()
    const back_rect = new ItemRect(0, 0, 600, 450, null, 0, '', [0, 0, 0], [173, 168, 153])
    this.layer.add(back_rect)
    const logo_image = assets.load_image_alpha('p0_placalogo.gif', null)
    this.logo = new ItemImage(220, 121, logo_image)
    this.add_layer(this.layer)
    animations.wait(this, 2000, () => this.show_logo())
  }

  show_logo() {
    this.layer.add(this.logo)
    animations.fade_in_item(this.logo, 500, (i) => this.wait_show_logo(i))
  }

  wait_show_logo(_item: unknown) { animations.wait(this, 3300, () => this.hide_logo()) }
  hide_logo() { animations.fade_out_item(this.logo, false, 500, (i) => this.wait_hide_logo(i)) }
  wait_hide_logo(_item: unknown) { animations.wait(this, 500, () => this.go_to_main()) }
  go_to_main() { this.game.set_stage(new startscreen.StartScreenStage(this.game)) }
}
