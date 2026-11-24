// Port de game/stages/characterid.py (credencial del detective: foto, rango y nombre editable).
import * as assets from '../../framework/assets.ts'
import * as text from '../../framework/text.ts'
import { ItemImage, ItemMask, ItemText, ItemEvent, type Layer } from '../../framework/stage.ts'
import * as datamodel from '../data/datamodel.ts'
import { zpad } from '../../pg/py.ts'
import type { Font } from '../../pg/font.ts'
import type { CustomSound, Image } from '../../framework/assets.ts'

export class CharacterId {
  loaded = false
  rollover_mask: ItemMask | null = null
  name_rollover_item: ItemImage | null = null
  rollover_sound: CustomSound | null
  layer!: Layer
  backdrop_image!: Image
  box_image!: Image
  font_11!: Font
  font_16!: Font
  avatar_name: string | null = null
  avatar_image!: Image
  range_image!: Image
  range_image_level = -1
  avatar!: ItemImage
  range_text!: ItemText
  name_text!: ItemText
  range_item!: ItemImage

  constructor(rollover_sound: CustomSound | null = null) {
    this.rollover_sound = rollover_sound
  }

  set_up_id(layer: Layer, char_info: datamodel.CharacterInfo | null, x: number, y: number, enable_edit = false, click_callback: ((item: any, args: any) => unknown) | null = null) {
    this.layer = layer
    if (!this.loaded) this.load_assets()
    layer.add(new ItemImage(x, y, this.backdrop_image))
    if (click_callback) {
      const rollover_image = assets.load_image('p0_mainmenu_rolloverID.png')
      this.rollover_mask = new ItemMask(x + 29, y + 25, rollover_image.get_size())
      this.rollover_mask.set_rollover(rollover_image, this.rollover_sound)
      this.rollover_mask.add_event_handler(ItemEvent.CLICK, click_callback)
      layer.add(this.rollover_mask)
    } else if (enable_edit) {
      const name_rollover_image = assets.load_image('p0_merits_main_name_rollover.jpg')
      this.name_rollover_item = new ItemImage(x + 152, y + 79, name_rollover_image)
      this.name_rollover_item.set_visible(false)
      layer.add(this.name_rollover_item)
      this.rollover_mask = new ItemMask(this.name_rollover_item.get_left(), this.name_rollover_item.get_top(), name_rollover_image.get_size())
      this.rollover_mask.add_event_handler(ItemEvent.MOUSE_ENTER, this.name_enter)
      this.rollover_mask.add_event_handler(ItemEvent.MOUSE_LEAVE, this.name_leave)
      layer.add(this.rollover_mask)
    }
    this.avatar = new ItemImage(x + 42, y + 38, null)
    layer.add(this.avatar)
    layer.add(new ItemImage(x + 37, y + 33, this.box_image))
    this.range_text = new ItemText(x + 167, y + 63, this.font_11, 0, '', [148, 34, 34], null, 130, 13, 1, 1)
    layer.add(this.range_text)
    this.name_text = new ItemText(x + 167, y + 89, this.font_16, 16, '', [58, 30, 16], null, 100, 49, 1, 1)
    layer.add(this.name_text)
    this.range_item = new ItemImage(x + 42, y + 125, null)
    layer.add(this.range_item)
    if (enable_edit) {
      this.name_text.set_max_chars(30)
      this.name_text.set_editable(true)
      this.name_text.set_edit_on_click(this.rollover_mask, this.name_click)
      this.name_text.add_event_handler(ItemEvent.GOT_FOCUS, this.name_got_focus)
      this.name_text.add_event_handler(ItemEvent.LOST_FOCUS, this.name_lost_focus)
    }
    this.load_character(char_info)
  }

  name_click = (_item: unknown, _args: unknown) => {
    const stage: any = this.layer.get_stage()
    stage.render()
    stage.click_sound.play()
  }

  name_enter = (_item: unknown, _args: unknown) => { this.update_name_rollover_visible() }
  name_leave = (_item: unknown, _args: unknown) => { this.update_name_rollover_visible() }
  name_got_focus = (_item: unknown, _args: unknown) => { this.update_name_rollover_visible() }

  name_lost_focus = (item: any, _args: unknown) => {
    this.update_name_rollover_visible()
    const stage: any = this.layer.get_stage()
    const character = stage.game.datastore.user_character
    const new_name = apply_name_text_casing(item.get_text())
    if (character.charinfo.name !== new_name) {
      character.charinfo.name = new_name
      this.name_text.set_text(new_name)
      stage.game.datastore.save_characters()
      stage.game.datastore.update_score_name(character)
      stage.game.datastore.save_highscores()
    }
  }

  update_name_rollover_visible() {
    const stage = this.layer.get_stage()
    if (!stage) return
    const visible = stage.get_over_item() === this.rollover_mask || stage.get_focus() === this.name_text
    this.name_rollover_item!.set_visible(visible)
  }

  load_character(char_info: datamodel.CharacterInfo | null) {
    if (char_info == null) {
      this.avatar.set_image(assets.load_image('p0_detective_placeholder.jpg'))
      this.range_text.set_text('')
      this.name_text.set_text('')
      this.range_item.set_visible(false)
      if (this.rollover_mask) this.rollover_mask.set_visible(false)
    } else {
      this.load_avatar(char_info)
      this.avatar.set_image(this.avatar_image)
      this.range_text.set_text(datamodel.get_range_name(char_info.range_level))
      this.range_item.set_visible(true)
      this.load_range(char_info)
      this.range_item.set_image(this.range_image)
      this.name_text.set_text(char_info.name)
      if (this.rollover_mask) this.rollover_mask.set_visible(true)
    }
  }

  load_range(char_info: datamodel.CharacterInfo) {
    if (char_info.range_level !== this.range_image_level) {
      this.range_image = assets.load_image('p0_detective_ranks_lvl' + char_info.range_level + '.png')
      this.range_image_level = char_info.range_level
    }
  }

  load_assets() {
    if (!this.loaded) {
      this.backdrop_image = assets.load_image('p0_mainmenu_id_backdrop.png')
      this.box_image = assets.load_image('p0_merits_main_id_box.png')
      this.font_11 = assets.load_font('evilgeniusbb_bld.ttf', 11)
      this.font_16 = assets.load_font('evilgeniusbb_reg.ttf', 16)
      this.avatar_name = null
      this.range_image_level = -1
      // (el original asignaba self.__loaded, así que "loaded" quedaba en False; se recargaba igual)
    }
  }

  load_avatar(char_info: datamodel.CharacterInfo) {
    let name = 'p0_detective_'
    name += char_info.sex === 'M' ? 'male_' : 'female_'
    name += zpad(char_info.avatar, 3) + '_id.jpg'
    if (this.avatar_name !== name) {
      this.avatar_image = assets.load_image(name)
      this.avatar_name = name
    }
  }
}

export function apply_name_text_casing(name: string) {
  let start = 0
  let new_name = ''
  const l = name.length
  for (let i = 0; i <= l; i++) {
    if (i === l) {
      if (start < l) new_name += text.to_upper(name[start]) + text.to_lower(name.slice(start + 1, i))
    } else if (name[i] === ' ') {
      new_name += text.to_upper(name[start] ?? '') + text.to_lower(name.slice(start + 1, i)) + ' '
      start = i + 1
    }
  }
  return new_name
}
