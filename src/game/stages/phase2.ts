// Port de game/stages/phase2.py: la casa del ladrón. El jugador busca pistas entre los muebles con una
// lupa: la lupa muestra una segunda escena isométrica al doble de tamaño (large_stage, que se dibuja
// en una superficie propia de 1200x900) y permite abrir puertas/cajones (máscaras $m) y tomar objetos.
// Los muebles de cada casa salen de los niveles originales p2s01lNNNa/b.tcl y p2s01.tcs.
import * as phase0 from './phase0.ts'
import { GRID_ORIGIN, GRID_CELL_WIDTH, GRID_CELL_HEIGHT, GRID_SIZE } from './phase0.ts'
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import * as text from '../../framework/text.ts'
import {
  Layer, ItemImage, ItemText, ItemCell, ItemCustomDraw, ItemEvent, IsoState, StageIso, Rect, Surface, KEYDOWN,
  type ItemEventArgsMouse, type CustomDrawTarget, type IsoPlaceHolder,
} from '../../framework/stage.ts'
import pygame from '../../pg/index.ts'
import { choice, random, remove, zpad } from '../../pg/py.ts'
import type { PgEvent } from '../../pg/events.ts'
import type { CustomSound, Image } from '../../framework/assets.ts'

export const ItemTag = {
  FLOOR: 'Floor',
  WALL: 'Wall',
  WALL_ITEM: 'Wall Item',
  FURNITURE: 'Furniture',
  OBJECT: 'Object',
}

export const ITEM_TAGS = [ItemTag.FLOOR, ItemTag.WALL, ItemTag.WALL_ITEM, ItemTag.FURNITURE, ItemTag.OBJECT]

export const ItemState = {
  NORMAL: new IsoState('Normal', ''),
  OPENED: new IsoState('Opened', 'o'),
}

export const ITEM_STATES = [ItemState.NORMAL, ItemState.OPENED]

// En el original son tuplas (1,), (2,)... (y OUTSIDEITEM = 8); sólo se comparan entre sí.
export const PlaceHolderType = {
  NORMALCLUE: 1,
  NORMALITEM: 2,
  BELOWCLUE: 3,
  BELOWITEM: 4,
  INSIDECLUE: 5,
  INSIDEITEM: 6,
  OUTSIDECLUE: 7,
  OUTSIDEITEM: 8,
}

type PHTag = [string, string[], number]
const T = PlaceHolderType
// Los nombres, ítems y tipos tal cual PlaceHolderTag del original (incluidas sus rarezas:
// InsideItemA y OutsideItemA están marcados como pistas).
const CLUE_IDS: [string, string][] = [['A', 'i509'], ['B', 'i529'], ['C', 'i511'], ['D', 'i510'], ['E', 'i526'], ['F', 'i527'], ['G', 'i528'], ['H', 'i523']]
const ITEM_IDS: [string, string][] = [
  ['A', 'i505'], ['B', 'i503'], ['C', 'i504'], ['D', 'i512'], ['E', 'i507'], ['F', 'i502'], ['G', 'i501'], ['H', 'i513'],
  ['I', 'i534'], ['J', 'i535'], ['K', 'i536'], ['L', 'i537'], ['M', 'i538'], ['N', 'i539'], ['O', 'i540'], ['P', 'i541'],
  ['Q', 'i542'], ['R', 'i543'], ['S', 'i544'], ['T', 'i545'], ['U', 'i546'], ['V', 'i547'], ['W', 'i548'], ['X', 'i549'],
  ['Y', 'i550'], ['Z', 'i551'], ['ZA', 'i552'], ['ZB', 'i553'], ['ZC', 'i554'], ['ZD', 'i555'], ['ZE', 'i556'], ['ZF', 'i557'], ['ZG', 'i558'],
]
export const PlaceHolderTag: Record<string, PHTag> = {}
export const PLACE_HOLDER_TAGS: PHTag[] = []
for (const [prefix, key, clueType, itemType] of [
  ['', '', T.NORMALCLUE, T.NORMALITEM],
  ['Below', 'BELOW', T.BELOWCLUE, T.BELOWITEM],
  ['Inside', 'INSIDE', T.INSIDECLUE, T.INSIDEITEM],
  ['Outside', 'OUTSIDE', T.OUTSIDECLUE, T.OUTSIDEITEM],
] as [string, string, number, number][]) {
  for (const [l, id] of CLUE_IDS) {
    const tag: PHTag = [prefix + 'Clue' + l, [id], clueType]
    PlaceHolderTag[key + 'CLUE' + l] = tag
    PLACE_HOLDER_TAGS.push(tag)
  }
  for (const [l, id] of ITEM_IDS) {
    // InsideItemA / OutsideItemA usan el tipo "clue" en el original
    const type = l === 'A' && (prefix === 'Inside' || prefix === 'Outside') ? clueType : itemType
    const tag: PHTag = [prefix + 'Item' + l, [id], type]
    PlaceHolderTag[key + 'ITEM' + l] = tag
    PLACE_HOLDER_TAGS.push(tag)
  }
}

const sameColor = (c: number[], t: number[]) => c[0] === t[0] && c[1] === t[1] && c[2] === t[2] && c[3] === t[3]

export class PlaceHolderInfo {
  below: boolean
  inside: boolean
  outside: boolean
  clue: boolean
  stage_item: ItemCell
  place_holder: IsoPlaceHolder
  index: number
  items: string[] | null
  list_index = 0
  constructor(below: boolean, inside: boolean, outside: boolean, clue: boolean, stage_item: ItemCell, place_holder: IsoPlaceHolder, index: number, items: string[] | null) {
    this.below = below
    this.inside = inside
    this.outside = outside
    this.clue = clue
    this.stage_item = stage_item
    this.place_holder = place_holder
    this.index = index
    this.items = items
  }
}

export class Phase2Content extends phase0.PhaseContent {
  game: any
  stage: any
  hand!: ItemImage
  hand_item!: ItemImage
  hand_magnifier!: ItemImage
  hand_open!: ItemImage
  magnifier_take_sound!: CustomSound
  magnifier_drop_sound!: CustomSound
  no_clue_sound!: CustomSound
  clue_sound!: CustomSound
  door_close_big_sound!: CustomSound
  door_close_small_sound!: CustomSound
  door_open_big_sound!: CustomSound
  door_open_small_sound!: CustomSound
  drawer_open_sound!: CustomSound
  drawer_close_sound!: CustomSound
  fridge_open_sound!: CustomSound
  fridge_close_sound!: CustomSound
  chest_open_sound!: CustomSound
  chest_close_sound!: CustomSound
  oven_open_sound!: CustomSound
  oven_close_sound!: CustomSound
  music_intro!: CustomSound
  music_loop!: CustomSound
  magnifier_taken = false
  clues_count = 0
  place_holder_tags: Record<string, PHTag> = {}
  small_back_layer!: Layer
  small_items_layer!: Layer
  magnifier_layer!: Layer
  large_back_layer!: Layer
  large_items_layer!: Layer
  magnifier_image!: Image
  magnifier_mask!: Surface
  magnifier!: ItemCustomDraw
  large_stage!: StageIso
  items_found_layer!: Layer
  items_layer_selected_item: any = null
  item_dialog: Layer | null = null

  constructor() {
    super()
  }

  initialize(game: any, stage: any) {
    this.game = game
    this.stage = stage
    this.hand = new ItemImage(0, 0, assets.load_image('hand_cursor.png'))
    this.hand_item = new ItemImage(0, 0, assets.load_image('hand_item.png'))
    this.hand_magnifier = new ItemImage(0, 0, assets.load_image('hand_magnifiergrab.png'))
    this.hand_open = new ItemImage(0, 0, assets.load_image('p2_handcursor_open_002.png'))
    this.magnifier_take_sound = assets.load_sound('p2_magnifying_glass_grab.ogg')
    this.magnifier_drop_sound = assets.load_sound('p2_magnifying_glass_drop.ogg')
    this.no_clue_sound = assets.load_sound('No_Pista_Mujer.ogg')
    this.clue_sound = assets.load_sound('p1_minigame_right.ogg')
    this.door_close_big_sound = assets.load_sound('p2_door_close_big.ogg')
    this.door_close_small_sound = assets.load_sound('p2_door_close_small.ogg')
    this.door_open_big_sound = assets.load_sound('p2_door_open_big.ogg')
    this.door_open_small_sound = assets.load_sound('p2_door_open_small.ogg')
    this.drawer_open_sound = assets.load_sound('p2_drawer_open.ogg')
    this.drawer_close_sound = assets.load_sound('p2_drawer_close.ogg')
    this.fridge_open_sound = assets.load_sound('p2_fridge_open.ogg')
    this.fridge_close_sound = assets.load_sound('p2_fridge_close.ogg')
    this.chest_open_sound = assets.load_sound('p2_chest_open.ogg')
    this.chest_close_sound = assets.load_sound('p2_chest_close.ogg')
    this.oven_open_sound = assets.load_sound('p2_oven_open.ogg')
    this.oven_close_sound = assets.load_sound('p2_oven_close.ogg')
    this.music_intro = assets.load_music('p2_music_intro.ogg')
    this.music_loop = assets.load_music('p2_music_loop.ogg')
    this.magnifier_taken = false
    this.clues_count = 0
    this.build_tags_dictionary()
  }

  get_music(): any {
    return [this.music_intro, this.music_loop]
  }

  add_content_layers() {
    this.stage.prepare_items_set(this.stage, false)
    this.small_back_layer = new Layer()
    this.small_items_layer = new Layer()
    this.magnifier_layer = new Layer()
    this.large_back_layer = new Layer()
    this.large_items_layer = new Layer()
    this.stage.add_layer(this.small_back_layer)
    this.stage.add_layer(this.small_items_layer)
    this.magnifier_image = assets.load_image('p2-magnifier.png')
    this.magnifier_mask = assets.load_mask('p2-magnifier-mask.gif')
    const magnifier_width = this.magnifier_image.get_width()
    const magnifier_height = this.magnifier_image.get_height()
    this.magnifier = new ItemCustomDraw(330, 170, magnifier_width, magnifier_height, this.draw_magnifier, this.magnifier_mask)
    this.magnifier.add_event_handler(ItemEvent.CLICK, this.magnifier_click)
    this.magnifier.add_event_handler(ItemEvent.MOUSE_MOVE, this.magnifier_mouse_move)
    this.magnifier.add_event_handler(ItemEvent.MOUSE_LEAVE, this.magnifier_mouse_leave)
    this.magnifier_layer.add(this.magnifier)
    const [stage_width, stage_height] = this.game.window.get_size()
    const target_surface = new Surface([stage_width * 2, stage_height * 2])
    const large_background = assets.load_image('p0_stage_background_large.jpg')
    this.large_stage = new StageIso(this.game, ITEM_TAGS, large_background, target_surface)
    this.large_stage.set_changed_handler(this.large_stage_changed)
    this.stage.prepare_items_set(this.large_stage, true, this.stage.get_item_definitions())
    this.large_stage.add_layer(this.large_back_layer)
    this.large_stage.add_layer(this.large_items_layer)
    this.stage.set_prerender_buffer(this.small_items_layer)
    this.build_stage()
  }

  add_above_options_layers() {
    this.stage.add_layer(this.magnifier_layer)
  }

  add_above_info_layers() {
    this.items_found_layer = new Layer()
    this.stage.add_layer(this.items_found_layer)
    this.load_progress()
  }

  load_progress() {
    const c = this.stage.game.datastore.user_character_progress.case
    const clues_found: string[] = c.clues_found.slice()
    for (const clue_found of clues_found) {
      for (const item of this.large_items_layer.items) {
        if ((item as ItemCell).get_type() === clue_found && item.is_clue) {
          this.found_item(item, false)
          break
        }
      }
    }
  }

  magnifier_click = (item: any, args: ItemEventArgsMouse) => {
    if (this.magnifier_taken) {
      const new_mouse_x = this.magnifier.get_left() + 74
      const new_mouse_y = this.magnifier.get_top() + 66
      this.drop_magnifier()
      this.stage.set_mouse_pos(new_mouse_x, new_mouse_y)
      this.magnifier_drop_sound.play()
      if (this.stage.hit_test(new_mouse_x, new_mouse_y) === this.magnifier) {
        args.x = new_mouse_x
        args.y = new_mouse_y
        this.magnifier_mouse_move(item, args)
      }
    } else {
      const [result, hit_test_item] = this.hit_test_over_magnifier(item, args.x, args.y)
      if (result === 1) {
        this.stage.set_mouse_cursor(this.magnifier, [Math.floor(this.magnifier.get_width() / 2), Math.floor(this.magnifier.get_height() / 2)], false, false, new Rect(88, 65, 648, 535))
        pygame.event.set_grab(true)
        this.magnifier_taken = true
        this.magnifier_take_sound.play()
      } else if (result === 2) {
        this.show_item_found_message(hit_test_item, true)
      } else if (result === 3) {
        const state = hit_test_item.get_state()
        if (state === ItemState.NORMAL) {
          hit_test_item.set_state(ItemState.OPENED)
          hit_test_item.small_item.set_state(ItemState.OPENED)
        } else {
          hit_test_item.set_state(ItemState.NORMAL)
          hit_test_item.small_item.set_state(ItemState.NORMAL)
        }
        this.update_magnifier_mouse_cursor(item, args)
        this.stage.render()
        const type = hit_test_item.get_type()
        if (state === ItemState.NORMAL) {
          if (type === 'i101') this.drawer_open_sound.play()
          else if (type === 'i105') this.oven_open_sound.play()
          else if (type === 'i106') this.fridge_open_sound.play()
          else if (type === 'i116') this.chest_open_sound.play()
          else if (type === 'i110' || type === 'i104' || type === 'i108' || type === 'i125') this.door_open_small_sound.play()
          else this.door_open_big_sound.play()
        } else {
          if (type === 'i101') this.drawer_close_sound.play()
          else if (type === 'i105') this.oven_close_sound.play()
          else if (type === 'i106') this.fridge_close_sound.play()
          else if (type === 'i116') this.chest_close_sound.play()
          else if (type === 'i110' || type === 'i104' || type === 'i108' || type === 'i125') this.door_close_small_sound.play()
          else this.door_close_big_sound.play()
        }
      }
    }
  }

  magnifier_mouse_move = (item: any, args: ItemEventArgsMouse) => {
    this.update_magnifier_mouse_cursor(item, args)
  }

  update_magnifier_mouse_cursor(item: any, args: ItemEventArgsMouse) {
    if (!this.magnifier_taken) {
      const [result] = this.hit_test_over_magnifier(item, args.x, args.y)
      if (result === 0) this.stage.set_mouse_cursor(null)
      else if (result === 1) this.stage.set_mouse_cursor(this.hand_magnifier, [25, 30])
      else if (result === 2) this.stage.set_mouse_cursor(this.hand_item, [23, 18])
      else if (result === 3) this.stage.set_mouse_cursor(this.hand_open, [25, 20])
      else this.stage.set_mouse_cursor(this.hand, [23, 18])
    }
  }

  hit_test_over_magnifier(item: any, x: number, y: number): [number, any] {
    const hand_center_x = x - item.get_left()
    const hand_center_y = y - item.get_top()
    if (hand_center_x >= 0 && hand_center_y >= 0 && hand_center_x < this.magnifier_mask.get_width() && hand_center_y < this.magnifier_mask.get_height()) {
      const c = this.magnifier_mask.get_at([hand_center_x, hand_center_y])
      if (sameColor(c, [255, 0, 0, 255])) return [1, null]
      const c_2 = this.magnifier_mask.get_at([hand_center_x, hand_center_y])
      if (sameColor(c, [0, 0, 255, 255]) || sameColor(c_2, [0, 0, 255, 255])) {
        const [large_x, large_y] = this.get_amplified_pos(x, y)
        const hit_test_stack = this.large_stage.hit_test_stack(large_x, large_y, true)
        for (const hit_test_item of hit_test_stack) {
          if (hit_test_item instanceof ItemCell) {
            if (hit_test_item.is_clue !== undefined) return [2, hit_test_item]
            else if (hit_test_item.get_definition().has_state(ItemState.OPENED)) {
              let has_outside_item = false
              const small_item = hit_test_item.small_item
              if (small_item.place_holders_used != null) {
                for (const place_holder of small_item.place_holders_used) {
                  if (place_holder.outside) { has_outside_item = true; break }
                }
              }
              if (!has_outside_item) {
                const cm = hit_test_item.get_at_mask(large_x, large_y, 'm')
                if (sameColor(cm, [0, 0, 0, 255])) return [3, hit_test_item]
              }
            }
          }
        }
        return [4, null]
      }
      return [0, null]
    }
    return [0, null]
  }

  drop_magnifier = () => {
    if (this.magnifier_taken) {
      pygame.event.set_grab(false)
      this.magnifier_taken = false
      this.stage.set_mouse_cursor(null)
    }
  }

  magnifier_mouse_leave = (_item: any, _args: unknown) => {
    const mouse_cursor = this.stage.get_mouse_cursor()
    if (mouse_cursor === this.hand || mouse_cursor === this.hand_item || mouse_cursor === this.hand_open || mouse_cursor === this.hand_magnifier) this.stage.set_mouse_cursor(null)
  }

  show_item_found_message(item: any, from_stage: boolean) {
    this.items_layer_selected_item = item
    let sound: CustomSound
    if (item.is_clue) {
      sound = this.clue_sound
      this.update_case_last_department_lair()
      this.item_dialog = this.stage.show_clue_message(item, from_stage, false, this.item_dialog_close_click)
      if (from_stage) {
        const clue_id = item.stage_clue.clue.id
        const c = this.game.datastore.user_character_progress.case
        if (!c.clues_found.includes(clue_id)) c.clues_found.push(clue_id)
        this.stage.render()
        this.stage.save_progress(false)
      }
    } else {
      const dialog = new Layer()
      const font = assets.load_font('evilgeniusbb_reg.ttf', 13)
      let image = assets.load_image('p2_avatar_dialog_notaclue.png')
      dialog.add(new ItemImage(62, 198, image))
      let message = 'Esto no parece ser una pista interesante...'
      message = text.to_upper(message)
      dialog.add(new ItemText(122, 239, font, 12, message, [0, 0, 0], null, 210, 30, 2, 2))
      const close_x = 356
      const close_y = 218
      sound = this.no_clue_sound
      image = assets.load_image('btn_testigo_x_normal.png')
      const rollover_image = assets.load_image('btn_testigo_x_rollover.png')
      const close_button = new ItemImage(close_x, close_y, image, null, true)
      close_button.set_rollover_image(rollover_image, this.stage.rollover_sound)
      close_button.add_event_handler(ItemEvent.CLICK, this.item_dialog_close_click)
      dialog.add(close_button)
      this.item_dialog = dialog
      this.stage.prepare_dialog(dialog)
      this.stage.show_dialog(dialog, this.item_dialog_handle_event)
    }
    if (from_stage) {
      this.stage.render()
      sound.play()
    }
  }

  item_dialog_handle_event = (e: PgEvent) => {
    if (e.type === KEYDOWN && e.key === pygame.K_ESCAPE) {
      this.stage.render()
      this.stage.click_sound.play()
      this.close_item_dialog()
      return true
    }
    return undefined
  }

  found_item(item: any, show_animation = true) {
    if (show_animation) {
      animations.fade_out_item(item.small_item, true)
      animations.fade_out_item(item, true)
      this.stage.fade_sound.play()
    } else {
      item.small_item.get_layer().remove(item.small_item)
      item.get_layer().remove(item)
    }
    this.add_item_found(item, show_animation)
    this.clues_count += 1
    if (this.clues_count === 3) {
      const cp = this.stage.game.datastore.user_character_progress
      if (!cp.phase2_help) {
        this.stage.show_help_dialog(102, 1000, this.drop_magnifier)
        cp.phase2_help = true
      }
    }
  }

  item_dialog_close_click = (_item: any = null, _args: any = null) => {
    this.close_item_dialog()
  }

  close_item_dialog() {
    this.stage.close_dialog(this.item_dialog)
    this.item_dialog = null
    if (this.items_layer_selected_item.is_clue) {
      if (this.items_layer_selected_item.get_layer() != null) this.found_item(this.items_layer_selected_item)
    }
    this.stage.reset_dialog()
  }

  add_item_found(items_layer_selected_item: any, show_animation: boolean) {
    const item = this.stage.add_item_found(items_layer_selected_item, show_animation)
    if (show_animation) animations.fade_in_item(item, 500, this.check_map_help_shown)
  }

  check_map_help_shown = (_item: unknown) => {
    if (this.stage.items_found.length === 1) this.stage.start_map_help_animation()
  }

  item_found_click = (item: any, _args: unknown) => {
    this.show_item_found_message(item.stage_item, false)
  }

  draw_magnifier = (item: any, target: CustomDrawTarget) => {
    this.large_stage.render()
    const x = item.get_left()
    const y = item.get_top()
    const [back_x, back_y] = this.get_amplified_pos(x, y)
    let delta_x = 35
    let delta_y = 21
    target.blit_stage(this.large_stage, [x + delta_x, y + delta_y], new Rect(back_x + delta_x, back_y + delta_y, 76, 18))
    delta_x = 23
    delta_y = 39
    target.blit_stage(this.large_stage, [x + delta_x, y + delta_y], new Rect(back_x + delta_x, back_y + delta_y, 101, 72))
    delta_x = 33
    delta_y = 111
    target.blit_stage(this.large_stage, [x + delta_x, y + delta_y], new Rect(back_x + delta_x, back_y + delta_y, 74, 9))
    target.blit_image(this.magnifier_image, [x, y])
  }

  get_amplified_pos(x: number, y: number): [number, number] {
    const left = this.magnifier.get_left()
    const top = this.magnifier.get_top()
    return [left * 2 + 73 + (x - left), top * 2 + 73 + (y - top)]
  }

  build_stage() {
    const c = this.game.datastore.user_character_progress.case
    const set_number = c.thief_lair_set[0]
    let layout: any[] | null = c.thief_lair_set[1]
    const old_magnifier_visible = this.magnifier.get_visible()
    this.magnifier.set_visible(false)
    let stage_built = false
    let build_stage_attempt = 0
    while (!stage_built) {
      this.small_back_layer.empty()
      this.small_items_layer.empty()
      this.large_back_layer.empty()
      this.large_items_layer.empty()
      this.load_level_in_stages('l' + zpad(set_number[0], 3) + 'a', true)
      this.load_level_in_stages('l' + zpad(set_number[1], 3) + 'b', false)
      const empty_place_holders: [ItemCell, IsoPlaceHolder, number][] = []
      this.stage.load_place_holders(this.small_back_layer, empty_place_holders)
      if (empty_place_holders.length > 0) throw new Error('Place holder in the back items are not supported')
      this.stage.load_place_holders(this.small_items_layer, empty_place_holders)
      const [clue_place_holders, item_place_holders] = this.analyze_place_holders(empty_place_holders)
      if (layout != null) {
        if (this.load_layout(layout, clue_place_holders, item_place_holders)) stage_built = true
        else {
          console.log('Invalid layout. Generating a new one')
          layout = null
        }
      } else {
        layout = []
        if (this.add_clues_and_extra_items(clue_place_holders, item_place_holders, build_stage_attempt, layout)) stage_built = true
        else {
          build_stage_attempt += 1
          layout = null
        }
      }
    }
    c.thief_lair_set[1] = layout
    this.magnifier.set_visible(old_magnifier_visible)
  }

  load_layout(layout: any[], clue_place_holders: PlaceHolderInfo[], item_place_holders: PlaceHolderInfo[]) {
    const c = this.game.datastore.user_character_progress.case
    const clues = c.list_stage_clues
    for (const item of layout) {
      const item_type = item[0]
      const place_holder_index = item[1]
      const category = item[2]
      let place_holder: PlaceHolderInfo
      let is_clue: boolean
      if (category === 1) {
        if (place_holder_index >= clue_place_holders.length) return false
        place_holder = clue_place_holders[place_holder_index]
        is_clue = true
      } else if (category === 2) {
        if (place_holder_index >= clue_place_holders.length) return false
        place_holder = clue_place_holders[place_holder_index]
        is_clue = false
      } else if (category === 3) {
        if (place_holder_index >= item_place_holders.length) return false
        place_holder = item_place_holders[place_holder_index]
        is_clue = false
      } else return false
      if (!(place_holder.items ?? []).includes(item_type)) return false
      if (!this.add_item(item_type, place_holder, is_clue, clues, null)) return false
    }
    return true
  }

  disable_magnifier() {
    this.magnifier.set_visible(false)
  }

  add_clues_and_extra_items(clue_place_holders: PlaceHolderInfo[], item_place_holders: PlaceHolderInfo[], build_stage_attempt: number, layout: any[]) {
    const character_progress = this.stage.game.datastore.user_character_progress
    const level = character_progress.range.level
    let fake_clues: number, extra_items: number, below_prob: number, inside_clue_prob: number, inside_item_prob: number
    if (level === 0) { fake_clues = 2; extra_items = 3; below_prob = 0; inside_clue_prob = 0; inside_item_prob = 0.3 }
    else if (level === 1) { fake_clues = 3; extra_items = 3; below_prob = 0.1; inside_clue_prob = 0.1; inside_item_prob = 0.3 }
    else if (level === 2) { fake_clues = 3; extra_items = 4; below_prob = 0.2; inside_clue_prob = 0.2; inside_item_prob = 0.3 }
    else if (level === 3) { fake_clues = 4; extra_items = 4; below_prob = 0.3; inside_clue_prob = 0.3; inside_item_prob = 0.3 }
    else if (level === 4) { fake_clues = 4; extra_items = 5; below_prob = 0.4; inside_clue_prob = 0.4; inside_item_prob = 0.4 }
    else { fake_clues = 5; extra_items = 5; below_prob = 0.5; inside_clue_prob = 0.5; inside_item_prob = 0.4 }
    const added_items = new Map<string, PlaceHolderInfo>()
    if (!this.add_clues(clue_place_holders, fake_clues, below_prob, inside_clue_prob, build_stage_attempt, added_items, layout)) return false
    this.add_extra_items(item_place_holders, extra_items, below_prob, inside_item_prob, added_items, layout)
    return true
  }

  add_clues(place_holders: PlaceHolderInfo[], fake_clues: number, below_prob: number, inside_prob: number, build_stage_attempt: number, added_items: Map<string, PlaceHolderInfo>, layout: any[] | null) {
    const c = this.game.datastore.user_character_progress.case
    const clues_left: string[] = [c.list_stage_clues[0].clue.id, c.list_stage_clues[1].clue.id, c.list_stage_clues[2].clue.id]
    const clues = c.list_stage_clues
    const used_place_holders: PlaceHolderInfo[] = []
    let [normal_place_holders, below_place_holders, inside_place_holders] = this.split_place_holders(place_holders)
    while (clues_left.length > 0 && normal_place_holders.length > 0) {
      const place_holder = this.extract_random_place_holder(normal_place_holders, below_place_holders, below_prob, inside_place_holders, inside_prob)
      if (this.valid_place_holder(place_holder)) {
        const possible_items = (place_holder.items ?? []).slice()
        while (possible_items.length > 0) {
          const possible_item = choice(possible_items)
          if (clues_left.includes(possible_item)) {
            if (this.add_item(possible_item, place_holder, true, clues, layout)) {
              remove(clues_left, possible_item)
              added_items.set(possible_item, place_holder)
              used_place_holders.push(place_holder)
              break
            }
          }
          remove(possible_items, possible_item)
        }
      }
    }
    if (clues_left.length > 0 && build_stage_attempt < 3) {
      console.log('Some of the clues ' + JSON.stringify(clues_left) + " couldn't be located, building the stage again (attempt " + build_stage_attempt + ')')
      return false
    }
    ;[normal_place_holders, below_place_holders, inside_place_holders] = this.split_place_holders(place_holders, used_place_holders)
    while (normal_place_holders.length > 0 && fake_clues > 0) {
      const place_holder = this.extract_random_place_holder(normal_place_holders, below_place_holders, below_prob, inside_place_holders, inside_prob)
      if (this.valid_place_holder(place_holder)) {
        const possible_items = (place_holder.items ?? []).slice()
        while (possible_items.length > 0) {
          const possible_item = choice(possible_items)
          if (!added_items.has(possible_item)) {
            if (this.add_item(possible_item, place_holder, false, null, layout)) {
              added_items.set(possible_item, place_holder)
              fake_clues -= 1
              break
            }
          }
          remove(possible_items, possible_item)
        }
      }
    }
    return true
  }

  add_extra_items(place_holders: PlaceHolderInfo[], extra_items: number, below_prob: number, inside_prob: number, added_items: Map<string, PlaceHolderInfo>, layout: any[] | null) {
    const [normal_place_holders, below_place_holders, inside_place_holders] = this.split_place_holders(place_holders)
    while (extra_items > 0 && normal_place_holders.length > 0) {
      const place_holder = this.extract_random_place_holder(normal_place_holders, below_place_holders, below_prob, inside_place_holders, inside_prob)
      if (this.valid_place_holder(place_holder)) {
        const possible_items = (place_holder.items ?? []).slice()
        while (possible_items.length > 0) {
          const possible_item = choice(possible_items)
          if (!added_items.has(possible_item)) {
            if (this.add_item(possible_item, place_holder, false, null, layout)) {
              added_items.set(possible_item, place_holder)
              extra_items -= 1
              break
            }
          }
          remove(possible_items, possible_item)
        }
      }
    }
  }

  valid_place_holder(place_holder: PlaceHolderInfo) {
    if (place_holder.outside) {
      const stage_item = place_holder.stage_item
      if (stage_item.place_holders_used != null) {
        for (const used of stage_item.place_holders_used) if (used.inside) return false
      }
    } else if (place_holder.inside) {
      const stage_item = place_holder.stage_item
      if (stage_item.place_holders_used != null) {
        for (const used of stage_item.place_holders_used) if (used.outside) return false
      }
    }
    return true
  }

  split_place_holders(place_holders: PlaceHolderInfo[], exclude_place_holders: PlaceHolderInfo[] = []): [PlaceHolderInfo[], PlaceHolderInfo[], PlaceHolderInfo[]] {
    const normal: PlaceHolderInfo[] = []
    const below: PlaceHolderInfo[] = []
    const inside: PlaceHolderInfo[] = []
    for (const place_holder of place_holders) {
      if (!exclude_place_holders.includes(place_holder)) {
        if (place_holder.inside) inside.push(place_holder)
        else if (place_holder.below) below.push(place_holder)
        else normal.push(place_holder)
      }
    }
    return [normal, below, inside]
  }

  extract_random_place_holder(normal_place_holders: PlaceHolderInfo[], below_place_holders: PlaceHolderInfo[], below_prob: number, inside_place_holders: PlaceHolderInfo[], inside_prob: number) {
    let inside: boolean
    if (inside_place_holders.length === 0) inside = false
    else inside = random() < inside_prob
    let place_holder: PlaceHolderInfo
    if (inside) {
      place_holder = choice(inside_place_holders)
      remove(inside_place_holders, place_holder)
    } else {
      let below: boolean
      if (below_place_holders.length === 0) below = false
      else below = random() < below_prob
      if (below) {
        place_holder = choice(below_place_holders)
        remove(below_place_holders, place_holder)
      } else {
        place_holder = choice(normal_place_holders)
        remove(normal_place_holders, place_holder)
      }
    }
    return place_holder
  }

  add_item(item_type: string, place_holder: PlaceHolderInfo, is_clue: boolean, clues: any[] | null, layout: any[] | null) {
    const add_index = this.get_place_holder_add_index(place_holder)
    const valid = this.validate_place_holder(place_holder, false, add_index)
    if (!valid) return false
    const stage_clue = is_clue ? this.stage.find_clue(clues, item_type) : null
    const only_visible_in_states = place_holder.inside ? [ItemState.OPENED] : null
    const small_item = new ItemCell(this.stage, item_type, ItemState.NORMAL)
    small_item.is_clue = is_clue
    small_item.place_holder = place_holder
    if (stage_clue != null) small_item.stage_clue = stage_clue
    small_item.set_to_place_holder(place_holder.stage_item, place_holder.place_holder, place_holder.below, only_visible_in_states)
    this.small_items_layer.add(small_item, add_index)
    const large_item = small_item.clone(this.large_stage)
    large_item.is_clue = is_clue
    large_item.small_item = small_item
    if (stage_clue != null) large_item.stage_clue = stage_clue
    this.large_items_layer.add(large_item, add_index)
    place_holder.stage_item.large_item.register_placeholder_item(large_item)
    if (layout != null) {
      let category: number
      if (place_holder.clue) category = is_clue ? 1 : 2
      else category = 3
      layout.push([item_type, place_holder.list_index, category])
    }
    const stage_item = place_holder.stage_item
    if (stage_item.place_holders_used == null) stage_item.place_holders_used = [place_holder]
    else stage_item.place_holders_used.push(place_holder)
    return true
  }

  analyze_place_holders(empty_place_holders: [ItemCell, IsoPlaceHolder, number][]): [PlaceHolderInfo[], PlaceHolderInfo[]] {
    const clue_place_holders: PlaceHolderInfo[] = []
    const item_place_holders: PlaceHolderInfo[] = []
    for (const [stage_item, place_holder, index] of empty_place_holders) {
      const info = this.get_place_holder_info(place_holder.tag, stage_item, place_holder, index)
      if (info.clue) {
        info.list_index = clue_place_holders.length
        clue_place_holders.push(info)
      } else {
        info.list_index = item_place_holders.length
        item_place_holders.push(info)
      }
    }
    return [clue_place_holders, item_place_holders]
  }

  get_place_holder_add_index(place_holder: PlaceHolderInfo) {
    const stage_item = place_holder.stage_item
    const items = this.small_items_layer.items
    let index = items.indexOf(stage_item)
    if (place_holder.below) {
      while (index > 0) {
        const previous_item = items[index - 1]
        if (previous_item.place_holder === undefined || previous_item.place_holder.stage_item !== place_holder.stage_item || previous_item.place_holder.index <= place_holder.index) break
        index -= 1
      }
    } else {
      index += 1
      while (index < items.length) {
        const next_item = items[index]
        if (next_item.place_holder === undefined || next_item.place_holder.stage_item !== place_holder.stage_item || next_item.place_holder.index > place_holder.index) break
        index += 1
      }
    }
    return index
  }

  build_tags_dictionary() {
    this.place_holder_tags = {}
    for (const tag of PLACE_HOLDER_TAGS) this.place_holder_tags[tag[0]] = tag
  }

  get_place_holder_info(id: string, stage_item: ItemCell, place_holder: IsoPlaceHolder, place_holder_index: number) {
    let below = false
    let inside = false
    let outside = false
    let clue = false
    const tag = this.place_holder_tags[id]
    let items: string[] | null
    if (tag == null) items = null
    else {
      items = tag[1]
      const type = tag[2]
      if (type === PlaceHolderType.NORMALCLUE) clue = true
      if (type === PlaceHolderType.OUTSIDECLUE) { clue = true; outside = true }
      else if (type === PlaceHolderType.OUTSIDEITEM) outside = true
      else if (type === PlaceHolderType.BELOWCLUE) { clue = true; below = true }
      else if (type === PlaceHolderType.BELOWITEM) below = true
      else if (type === PlaceHolderType.INSIDECLUE) { clue = true; inside = true }
      else if (type === PlaceHolderType.INSIDEITEM) inside = true
    }
    return new PlaceHolderInfo(below, inside, outside, clue, stage_item, place_holder, place_holder_index, items)
  }

  validate_place_holder(place_holder: PlaceHolderInfo, check_covered: boolean, add_index: number) {
    const stage_item = place_holder.stage_item
    const place_holder_def = place_holder.place_holder
    const [x, y] = stage_item.get_place_holder_xy(place_holder_def)
    if (!check_covered && !place_holder.below) {
      return this.is_over_item(stage_item, place_holder_def, place_holder.below, add_index, x, y) === 0
    }
    if (this.is_over_item(stage_item, place_holder_def, place_holder.below, add_index, x, y) !== 0) return false
    if (this.is_over_item(stage_item, place_holder_def, place_holder.below, add_index, x - 4, y - 4) !== 0) return false
    if (this.is_over_item(stage_item, place_holder_def, place_holder.below, add_index, x + 4, y + 4) !== 0) return false
    return true
  }

  is_over_item(stage_item: ItemCell, place_holder_def: IsoPlaceHolder, below: boolean, add_index: number, x: number, y: number): number {
    if (place_holder_def.tag.startsWith('Inside')) {
      const item = this.stage.hit_test(x, y)
      if (stage_item !== item) return 1
      else if (stage_item.placeholder_items != null) {
        for (const it of stage_item.placeholder_items) {
          if (it.place_holder !== undefined) {
            const iph = it.place_holder.place_holder
            if (iph.tag.startsWith('Inside') && Math.abs(place_holder_def.x - iph.x) < 8 && Math.abs(place_holder_def.y - iph.y) < 8) return 1
          }
        }
      }
      return 0
    }
    let item = this.stage.hit_test(x, y)
    if (item != null) {
      if (stage_item === item) {
        const hit_test_stack = this.stage.hit_test_stack(x, y)
        for (const it of hit_test_stack) {
          if (it !== stage_item && it.get_layer() === this.small_items_layer && it instanceof ItemCell && it.get_definition().tag !== ItemTag.FLOOR && it.get_definition().tag !== ItemTag.WALL) {
            if (below) return 1
            if (it.place_holder === undefined || it.place_holder.stage_item !== stage_item) return 1
          }
        }
        return 0
      }
      if (item.get_layer() === this.small_items_layer) {
        if (below) return 1
        if (item.place_holder !== undefined) {
          const iph = item.place_holder.place_holder
          if (Math.abs(place_holder_def.x - iph.x) < 8 && Math.abs(place_holder_def.y - iph.y) < 8 && item.place_holder.stage_item === stage_item) return 1
        }
        if (item.is_clue) return 1
        if (this.small_items_layer.index_of(item) < add_index) return 0
      } else {
        const cells = GRID_SIZE[0] + GRID_SIZE[1]
        const width = Math.floor(GRID_CELL_WIDTH / 2) * cells
        const height = Math.floor(GRID_CELL_HEIGHT / 2) * cells
        const margin = 5
        const y0 = GRID_ORIGIN[1] + height - Math.floor((Math.abs(x - GRID_ORIGIN[0]) * height) / width)
        if (x < GRID_ORIGIN[0] - Math.floor(width / 2) + margin || x > GRID_ORIGIN[0] + Math.floor(width / 2) - margin || y > y0 - margin) return 2
        return 0
      }
      if (item instanceof ItemCell) {
        if (item.get_definition().tag !== ItemTag.FLOOR && (item.place_holder === undefined || item.place_holder.stage_item !== stage_item)) return 1
        if (item.is_clue !== undefined) return 1
      }
    }
    void item
    return 2
  }

  load_level_in_stages(level_name: string, background: boolean) {
    const file = this.stage.get_set_name() + level_name + '.tcl'
    if (assets.load_data(file, ';', false).length > 0) {
      let small_layer: Layer, large_layer: Layer
      if (background) { small_layer = this.small_back_layer; large_layer = this.large_back_layer }
      else { small_layer = this.small_items_layer; large_layer = this.large_items_layer }
      const small_items = this.stage.load_level(level_name, small_layer, ITEM_STATES)
      const large_items = this.large_stage.load_level(level_name, large_layer, ITEM_STATES)
      for (let i = 0; i < small_items.length; i++) {
        large_items[i].small_item = small_items[i]
        small_items[i].large_item = large_items[i]
      }
    }
  }

  large_stage_changed = (_stage: unknown) => {
    this.magnifier.set_dirty()
  }

  update_case_last_department_lair() {
    const c = this.game.datastore.user_character_progress.case
    if (c.last_department_lair === c.list_departments[0] && c.last_department_visited === c.list_departments[0]) {
      this.game.datastore.user_character_progress.case.last_department_lair = c.list_departments[1]
    }
  }
}
