// Port de game/stages/minigamegardener.py (minijuego del jardinero: proporciones y fracciones).
// Las listas por comprensión y las tuplas de fracciones que el decompilador había mutilado se
// recuperaron del desensamblado (dis/game/stages/minigamegardener.dis).
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import type { Image } from '../../framework/assets.ts'
import { ItemImage, ItemMask, ItemText, ItemCell, ItemEvent, IsoState, Layer } from '../../framework/stage.ts'
import pygame from '../../pg/index.ts'
import { choice, randint, idiv } from '../../pg/py.ts'
import { Minigame } from './minigame.ts'
import * as statcodes from '../data/statcodes.ts'

export const GRID_ORIGIN = [308, 206]
export const GRID_CELL_WIDTH = 34
export const GRID_CELL_HEIGHT = 18
export const GRID_SIZE = [10, 10]
export const ITEM_TAGS = ['Soil', 'Item', 'Selection']
export const ITEM_STATES = [new IsoState('Normal', '')]
export const PLACE_HOLDER_TAGS = ['Normal']

type Fraction = [string, number]

/** bisect.bisect (bisect_right) */
function bisect_right(a: number[], x: number) {
  let lo = 0, hi = a.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (x < a[mid]) hi = mid; else lo = mid + 1 }
  return lo
}

export class MinigameGardener extends Minigame {
  painting: boolean
  shovel_sound: assets.CustomSound
  minigame_solved_sound: assets.CustomSound
  wrong_sound: assets.CustomSound
  witness_minigame_box_image: Image
  witness_item: ItemImage
  start_time: number | null
  pause_start_time: number | null
  pause_total_time: number
  title: string
  question_intro: string
  question: string
  request_text: string
  request_question_text: string
  thanks_text: string
  average_time = 90
  list: ListItem[] = []
  grid_layer!: Layer
  grid_positions!: number[]
  grid_goodjob_layer!: Layer
  grid_selection_layer!: Layer
  grid_data!: (ItemCell | null)[][]
  selection_grid!: ItemCell[][]
  grid_mask_item!: ItemMask
  option_image_normal!: Image
  option_image_rollover!: Image
  option_image_selected!: Image
  selected_option: any = null
  mouse_option_cursor!: ItemImage
  painting_from: number[] = [0, 0]
  painting_to: number[] = [0, 0]
  lower_help_text_item!: ItemText
  upper_help_text_item!: ItemText

  constructor(stage: any, phase1content: any, witness: any) {
    super(stage, phase1content, witness, statcodes.MG_GARDENER, statcodes.MG_GARDENER_SOLVED, statcodes.MG_GARDENER_NOTSOLVED, 'gardener')
    this.painting = false
    this.shovel_sound = assets.load_sound('p1_minigame_gardener_shovel.ogg')
    this.minigame_solved_sound = assets.load_sound('p1_minigame_right.ogg')
    this.wrong_sound = assets.load_sound('p1_minigame_wrong.ogg')
    this.witness_minigame_box_image = assets.load_image('p1_minigame_flux_gardener_dialogue1.png')
    const gardener_image = assets.load_image('p1_minigame_gardener.png')
    this.witness_item = new ItemImage(438, 83, gardener_image, null)
    this.max_help_stages = 4
    this.start_time = null
    this.pause_start_time = null
    this.pause_total_time = 0
    this.title = 'JARDINERO'
    this.question_intro = 'El Jardinero se encuentra muy ocupado\nen este momento, quizás si lo ayudas\npuedas interrogarlo luego.'
    this.question = '¿Te ofreces a ayudarlo?'
    this.request_text = 'La señora de la casa me pidió que\nplantara su jardín como se\nmuestra en la lista.'
    this.request_question_text = '¿Puedes ayudarme a resolverlo?'
    this.thanks_text = '¡Muchas gracias!\n\nQuedó perfecto, la señora va a estar muy conforme con el trabajo.'
  }

  get_music() { return this.phase1content.music_minigame_1 }

  blind_show_minigame_callback(_layer: unknown) {
    if (!this.stage.game.datastore.user_character_progress.minigame_gardener_help_seen) {
      this.stop_minigame(false)
      this.show_help_dialog()
      this.stage.game.datastore.user_character_progress.minigame_gardener_help_seen = true
    } else this.start_minigame()
  }

  load_help_data() {
    let background_image!: Image
    let back_left = 0, back_top = 0
    let upper_help_text = '', upper_text_left = 0, upper_text_top = 0, upper_text_width = 0, upper_text_height = 0
    let lower_help_text = '', lower_text_left = 0, lower_text_top = 0, lower_text_width = 0, lower_text_height = 0
    if (this.help_stage === 1) {
      background_image = assets.load_image('p1_minigame_gardener_help_d1.jpg')
      back_left = 124; back_top = 132
      upper_help_text = 'El jardín está dividido en 100 partes iguales.'
      upper_text_left = 205; upper_text_top = 92; upper_text_width = 192; upper_text_height = 37
      lower_help_text = 'x 100'
      lower_text_left = 304; lower_text_top = 334; lower_text_width = 49; lower_text_height = 16
      this.help_previous_button.set_visible(false)
    } else if (this.help_stage === 2) {
      background_image = assets.load_image('p1_minigame_gardener_help_d2.jpg')
      back_left = 124; back_top = 167
      upper_help_text = 'En la lista aparecen los diferentes tipos de plantas con las que debemos llenar el jardín y las proporciones correspondientes.'
      upper_text_left = 157; upper_text_top = 93; upper_text_width = 288; upper_text_height = 66
    } else if (this.help_stage === 3) {
      background_image = assets.load_image('p1_minigame_gardener_help_d25.jpg')
      back_left = 124; back_top = 132
      upper_help_text = 'Podemos plantar de a una casilla haciendo click en ella.'
      upper_text_left = 156; upper_text_top = 93; upper_text_width = 288; upper_text_height = 42
      lower_help_text = 'O podemos plantar de a varias, dejando apretado el botón izquierdo del ratón\ny moviendo el cursor.'
      lower_text_left = 151; lower_text_top = 308; lower_text_width = 298; lower_text_height = 54
    } else if (this.help_stage === 4) {
      background_image = assets.load_image('p1_minigame_gardener_help_d3.jpg')
      back_left = 124; back_top = 153
      upper_help_text = 'al completar la cantidad correspondiente a cada planta, cambiará el color en la lista a rojo.'
      upper_text_left = 154; upper_text_top = 93; upper_text_width = 288; upper_text_height = 56
      lower_help_text = 'cuando se complete toda la lista, se dará por concluída la tarea.'
      lower_text_left = 157; lower_text_top = 313; lower_text_width = 288; lower_text_height = 39
    }
    const background_help_image_item = new ItemImage(0, 0, null, null)
    background_help_image_item.set_image(background_image)
    background_help_image_item.set_lefttop(back_left, back_top)
    this.help_current_layer.add(background_help_image_item)
    if (this.help_stage !== 2) {
      this.lower_help_text_item = new ItemText(lower_text_left, lower_text_top, this.font_14, 16, lower_help_text, [183, 35, 35], null, lower_text_width, lower_text_height, 2)
      this.help_current_layer.add(this.lower_help_text_item)
    }
    this.upper_help_text_item = new ItemText(upper_text_left, upper_text_top, this.font_14, 16, upper_help_text, [183, 35, 35], null, upper_text_width, upper_text_height, 2)
    this.help_current_layer.add(this.upper_help_text_item)
  }

  start_minigame() {
    this.play_music()
    this.start_play_stats_event()
    if (this.start_time == null) this.start_time = pygame.time.get_ticks()
    else {
      this.pause_total_time += pygame.time.get_ticks() - this.pause_start_time!
      this.pause_start_time = null
    }
  }

  stop_minigame(solved: boolean) {
    this.end_play_stats_event(solved)
    this.pause_start_time = pygame.time.get_ticks()
  }

  set_up_minigame() {
    const character_progress = this.stage.game.datastore.user_character_progress
    const minigame_level = character_progress.range.minigame_level
    let n_fractions: number
    if (minigame_level === 1) n_fractions = 0
    else if (minigame_level === 2) n_fractions = 5
    else n_fractions = randint(2, 3)
    this.average_time = 90
    this.build_list(n_fractions)
    this.prepare_grid()
    this.set_up_game_background_items()
    this.set_up_witness()
    this.set_up_options()
    this.set_up_buttons()
    this.set_up_texts()
    this.stage.add_layer(this.grid_layer)
    this.stage.add_layer(this.grid_selection_layer)
    this.stage.add_layer(this.grid_goodjob_layer)
    this.stage.set_prerender_buffer(this.grid_layer)
  }

  build_list(n_fractions: number) {
    this.list = []
    const [percentages, fractions] = this.generate_values(n_fractions)
    const added_flowers: number[] = []
    while (added_flowers.length < 4) {
      const flower = randint(1, 5)
      if (!added_flowers.includes(flower)) {
        const n = added_flowers.length
        let option_icon: Image, text_icon: Image, item: ListItem
        if (flower === 1) {
          option_icon = assets.load_image('p1_minigame_gardener_opt_daisy.png')
          text_icon = assets.load_image('p1_minigame_gardener_icon_daisy.png')
          item = new ListItem(option_icon, 'MARGARITAS', text_icon, percentages[n], fractions[n], 'i010', 0)
        } else if (flower === 2) {
          option_icon = assets.load_image('p1_minigame_gardener_opt_carnation.png')
          text_icon = assets.load_image('p1_minigame_gardener_icon_carnation.png')
          item = new ListItem(option_icon, 'CLAVELES', text_icon, percentages[n], fractions[n], 'i011', 0)
        } else if (flower === 3) {
          option_icon = assets.load_image('p1_minigame_gardener_opt_rose.png')
          text_icon = assets.load_image('p1_minigame_gardener_icon_rose.png')
          item = new ListItem(option_icon, 'ROSAS', text_icon, percentages[n], fractions[n], 'i014', 0)
        } else if (flower === 4) {
          option_icon = assets.load_image('p1_minigame_gardener_opt_jazmin.png')
          text_icon = assets.load_image('p1_minigame_gardener_icon_jazmin.png')
          item = new ListItem(option_icon, 'JAZMINES', text_icon, percentages[n], fractions[n], 'i013', 0)
        } else {
          option_icon = assets.load_image('p1_minigame_gardener_opt_tulip_y.png')
          text_icon = assets.load_image('p1_minigame_gardener_icon_tulip_y.png')
          item = new ListItem(option_icon, 'TULIPANES', text_icon, percentages[n], fractions[n], 'i012', 0)
        }
        this.list.push(item)
        added_flowers.push(flower)
      }
    }
    const option_icon = assets.load_image('p1_minigame_gardener_opt_soil.png')
    const text_icon = assets.load_image('p1_minigame_gardener_icon_soil.png')
    this.list.push(new ListItem(option_icon, 'TIERRA', text_icon, percentages[4], fractions[4], 'soil', GRID_SIZE[0] * GRID_SIZE[1]))
  }

  generate_values(n_fractions: number): [number[], (Fraction | null)[]] {
    const n_items = 5
    let percentages = Array.from({ length: n_items }, () => 0)
    let fractions: (Fraction | null)[] = Array.from({ length: n_items }, () => null)
    let total = 0
    let fractions_assigned = 0
    while (fractions_assigned < n_fractions || (n_fractions < n_items && total >= 100)) {
      let fractions_options: Fraction[]
      if (n_fractions === n_items) {
        const fraction_sets: Fraction[][] = [
          [['1_4', 25], ['1_4', 25], ['1_5', 20], ['1_5', 20], ['1_10', 10]],
          [['2_5', 40], ['3_10', 30], ['1_10', 10], ['1_10', 10], ['1_10', 10]],
          [['2_5', 40], ['1_5', 20], ['1_5', 20], ['1_10', 10], ['1_10', 10]],
          [['3_10', 30], ['3_10', 30], ['1_5', 20], ['1_10', 10], ['1_10', 10]],
        ]
        fractions_options = choice(fraction_sets).slice()
      } else {
        fractions_options = [['1_2', 50], ['1_4', 25], ['1_5', 20], ['1_10', 10], ['2_4', 50], ['2_5', 40], ['3_10', 30]]
      }
      fractions_assigned = 0
      percentages = Array.from({ length: n_items }, () => 0)
      fractions = Array.from({ length: n_items }, () => null)
      const indexes = Array.from({ length: n_items }, (_, i) => i)
      total = 0
      while (fractions_assigned < n_fractions && fractions_options.length > 0) {
        const f = choice(fractions_options)
        fractions_options.splice(fractions_options.indexOf(f), 1)
        const percentage = f[1]
        if (total + percentage <= 100) {
          const index = choice(indexes)
          indexes.splice(indexes.indexOf(index), 1)
          percentages[index] += percentage
          fractions[index] = f
          total += percentage
          fractions_assigned += 1
        }
      }
    }
    while (total < 100) {
      const index = randint(0, n_items - 1)
      if (percentages[index] < 65 && fractions[index] == null) {
        percentages[index] += 5
        total += 5
      }
    }
    return [percentages, fractions]
  }

  set_up_game_background_items() {
    this.layer.add(new ItemImage(14, 57, assets.load_image('p1_minigame_gardener_background.png')))
    this.layer.add(new ItemImage(137, 206, assets.load_image('p1_minigame_gardener_grid.png')))
    const grid_mask = assets.load_mask('p1_minigame_gardener_grid_mask.gif')
    this.grid_mask_item = new ItemMask(134, 209, grid_mask)
    this.grid_mask_item.add_event_handler(ItemEvent.MOUSE_ENTER, this.grid_enter)
    this.grid_mask_item.add_event_handler(ItemEvent.MOUSE_LEAVE, this.grid_leave)
    this.grid_mask_item.add_event_handler(ItemEvent.MOUSE_MOVE, this.grid_mousemove)
    this.grid_mask_item.add_event_handler(ItemEvent.CLICK, this.grid_click)
    this.layer.add(this.grid_mask_item)
  }

  set_up_options() {
    this.option_image_normal = assets.load_image('p1_minigame_gardener_opt_button.png')
    this.option_image_rollover = assets.load_image('p1_minigame_gardener_opt_rollover.png')
    this.option_image_selected = assets.load_image('p1_minigame_gardener_opt_selected.png')
    this.add_option(8, 180, this.list[0])
    this.add_option(52, 180, this.list[1])
    this.add_option(95, 180, this.list[2])
    this.add_option(31, 225, this.list[3])
    this.add_option(74, 225, this.list[4])
    this.selected_option = null
    this.mouse_option_cursor = new ItemImage(0, 0, null)
  }

  add_option(x: number, y: number, list_item: ListItem) {
    const option_item = new ItemImage(x, y, this.option_image_normal)
    option_item.set_rollover_image(this.option_image_rollover, this.rollover_sound)
    option_item.list_item = list_item
    option_item.add_event_handler(ItemEvent.CLICK, this.tool_option_item_click)
    this.layer.add(option_item)
    this.layer.add(new ItemImage(x, y, list_item.option_icon))
    return option_item
  }

  set_up_buttons() {
    const close_item = new ItemImage(268, 49, assets.load_image('p1_minigames_btn_close_normal.png'))
    close_item.set_rollover_image(assets.load_image('p1_minigames_btn_close_active.png'), this.rollover_sound)
    close_item.add_event_handler(ItemEvent.CLICK, this.close_click)
    this.layer.add(close_item)
    const help_item = new ItemImage(303, 49, assets.load_image('p1_minigames_btn_help_normal.png'))
    help_item.set_rollover_image(assets.load_image('p1_minigames_btn_help_active.png'), this.rollover_sound)
    help_item.add_event_handler(ItemEvent.CLICK, (i: any, a: any) => this.help_click(i, a))
    this.layer.add(help_item)
  }

  set_up_texts() {
    this.add_list_item(109, 112, this.list[0])
    this.add_list_item(109, 132, this.list[1])
    this.add_list_item(109, 151, this.list[2])
    this.add_list_item(311, 122, this.list[3])
    this.add_list_item(311, 142, this.list[4])
    this.update_items_text()
  }

  add_list_item(x: number, y: number, list_item: ListItem) {
    this.layer.add(new ItemImage(x, y, list_item.text_icon))
    let text = list_item.text + '.................'
    const text_item = new ItemText(x + 26, y + 4, this.font_12_bld, 0, text, [80, 70, 70], null, 108, 19)
    this.layer.add(text_item)
    let percentage_item: ItemText
    let percentage_symbol_item: ItemText | null
    if (list_item.fraction == null) {
      text = list_item.percentage < 10 ? ' ' + String(list_item.percentage) : String(list_item.percentage)
      percentage_item = new ItemText(x + 135, y - 1, this.font_18, 0, text, [80, 70, 70])
      this.layer.add(percentage_item)
      percentage_symbol_item = new ItemText(x + 160, y + 4, this.font_12_bld, 0, '%', [80, 70, 70])
      this.layer.add(percentage_symbol_item)
    } else {
      text = list_item.fraction[0].split('_').join('/')
      percentage_item = new ItemText(x + 135, y - 1, this.font_18, 0, text, [80, 70, 70])
      this.layer.add(percentage_item)
      percentage_symbol_item = null
    }
    list_item.text_items = [text_item, percentage_item, percentage_symbol_item]
  }

  prepare_grid() {
    this.grid_layer = new Layer()
    this.grid_positions = []
    this.grid_goodjob_layer = new Layer()
    this.grid_selection_layer = new Layer()
    this.stage.set_tags(ITEM_TAGS)
    this.stage.set_grid_definition(GRID_ORIGIN, GRID_CELL_WIDTH, GRID_CELL_HEIGHT, 1)
    this.stage.set_items('p1gs01')
    this.grid_data = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => null))
    this.selection_grid = Array.from({ length: 10 }, (_, j) => Array.from({ length: 10 }, (_, i) => new ItemCell(this.stage, 'i001', ITEM_STATES[0], false, j, i)))
  }

  close_click = (_item: unknown, _args: unknown) => {
    this.stop_minigame(false)
    this.phase1content.minigame_solved(false)
    this.close_minigame()
  }

  grid_enter = (_item: unknown, _args: unknown) => {
    if (this.selected_option != null) {
      const item_type = this.selected_option.list_item.item_type
      if (item_type === 'soil') this.stage.set_mouse_cursor(null)
      else {
        const item_image = this.stage.load_item_image(item_type, ITEM_STATES[0])
        const item_definition = this.stage.get_item_definition(item_type)
        this.mouse_option_cursor.set_image(item_image)
        this.stage.set_mouse_cursor(this.mouse_option_cursor, item_definition.center)
      }
    }
  }

  grid_leave = (_item: unknown, _args: unknown) => {
    if (!this.painting) {
      this.stage.set_mouse_cursor(null)
      this.grid_selection_layer.empty()
    }
  }

  grid_mousemove = (_item: unknown, args: any) => {
    if (!this.painting && this.selected_option != null) {
      const [row, col] = this.stage.get_rowcol(args.x, args.y)
      if (row >= 0 && row < GRID_SIZE[0] && col >= 0 && col < GRID_SIZE[1]) {
        this.grid_selection_layer.empty()
        const cell = this.selection_grid[row][col]
        const filled_items = this.get_items_filled()
        const selection_type = this.selected_option.list_item.item_type
        const selection_filled = this.get_selection_filled(selection_type, filled_items)
        this.set_selection_cell_type(row, col, selection_type, cell, selection_filled, filled_items)
        this.grid_selection_layer.add(cell)
      } else this.grid_selection_layer.empty()
    }
  }

  grid_click = (_item: unknown, args: any) => {
    if (this.selected_option != null) {
      const [row, col] = this.stage.get_rowcol(args.x, args.y)
      if (row >= 0 && row < GRID_SIZE[0] && col >= 0 && col < GRID_SIZE[1]) {
        this.painting = true
        this.painting_from = [row, col]
        this.stage.capture_leftmousedown(this.grid_mask_item, this.mouse_paint)
      }
    }
  }

  mouse_paint = (mouse_args: any, released: boolean) => {
    let [row, col] = this.stage.get_rowcol(mouse_args.x, mouse_args.y)
    let mouse_inside: boolean
    if (row >= 0 && row < GRID_SIZE[0] && col >= 0 && col < GRID_SIZE[1]) mouse_inside = true
    else {
      if (row < 0) row = 0
      else if (row >= GRID_SIZE[0]) row = GRID_SIZE[0] - 1
      if (col < 0) col = 0
      else if (col >= GRID_SIZE[1]) col = GRID_SIZE[1] - 1
      mouse_inside = false
    }
    this.painting_to = [row, col]
    if (released) {
      this.painting = false
      const minigame_solved = this.paint_items(mouse_args.x, mouse_args.y)
      this.grid_selection_layer.empty()
      if (!mouse_inside || minigame_solved) this.stage.set_mouse_cursor(null)
      else {
        this.grid_selection_layer.empty()
        this.grid_selection_layer.add(this.selection_grid[row][col])
      }
    } else this.update_paint_region()
  }

  update_paint_region() {
    const from_row = Math.min(this.painting_from[0], this.painting_to[0])
    const from_col = Math.min(this.painting_from[1], this.painting_to[1])
    const to_row = Math.max(this.painting_from[0], this.painting_to[0])
    const to_col = Math.max(this.painting_from[1], this.painting_to[1])
    const filled_items = this.get_items_filled()
    const selection_type = this.selected_option.list_item.item_type
    const selection_filled = this.get_selection_filled(selection_type, filled_items)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = this.selection_grid[r][c]
        if (r >= from_row && r <= to_row && c >= from_col && c <= to_col) {
          this.set_selection_cell_type(r, c, selection_type, cell, selection_filled, filled_items)
          if (cell.get_layer() == null) this.grid_selection_layer.add(cell)
        } else if (cell.get_layer() != null) this.grid_selection_layer.remove(cell)
      }
    }
  }

  set_selection_cell_type(r: number, c: number, selection_type: string, selection_cell: ItemCell, selection_filled: boolean, filled_items: ListItem[]) {
    if (selection_type === 'soil') selection_cell.set_type('i001')
    else if (selection_filled) selection_cell.set_type('i002')
    else if (this.grid_data[r][c] != null) {
      const item_type = this.grid_data[r][c]!.get_type()
      if (item_type === selection_type) selection_cell.set_type('i001')
      else {
        let filled = false
        for (const item of filled_items) if (item.item_type === item_type) { filled = true; break }
        selection_cell.set_type(filled ? 'i002' : 'i001')
      }
    } else selection_cell.set_type('i001')
  }

  get_selection_filled(selection_type: string, filled_items: ListItem[]) {
    for (const item of filled_items) if (item.item_type === selection_type) return true
    return false
  }

  paint_items(_x: number, _y: number): boolean {
    if (this.selected_option == null) return false
    let item_type: string = this.selected_option.list_item.item_type
    const old_filled_items = this.get_items_filled()
    const has_filled_item = this.has_selection_filled_item(item_type, old_filled_items)
    if (has_filled_item) {
      this.stage.render()
      this.wrong_sound.play()
      return false
    }
    const [from_row, from_col] = this.painting_from
    const [to_row, to_col] = this.painting_to
    for (let r = Math.min(from_row, to_row); r < Math.max(from_row, to_row) + 1; r++) {
      for (let c = Math.min(from_col, to_col); c < Math.max(from_col, to_col) + 1; c++) {
        if (this.grid_data[r][c] != null) {
          const cell = this.grid_data[r][c]!
          if (item_type !== cell.get_type()) {
            this.substract_item(cell.get_type())
            if (item_type !== 'soil') {
              cell.set_type(item_type)
              this.sum_item(item_type)
            } else {
              this.grid_data[r][c] = null
              this.grid_layer.remove(cell)
              this.grid_positions.splice(this.grid_positions.indexOf(r + c), 1)
              this.sum_item('soil')
            }
          }
        } else if (item_type !== 'soil') {
          item_type = this.selected_option.list_item.item_type
          const cell = new ItemCell(this.stage, item_type, ITEM_STATES[0])
          cell.set_position(r, c)
          this.grid_data[r][c] = cell
          const index = bisect_right(this.grid_positions, r + c)
          this.grid_layer.add(cell, index)
          this.grid_positions.splice(index, 0, r + c)
          this.substract_item('soil')
          this.sum_item(item_type)
        }
      }
    }
    const new_filled_items = this.update_items_text(old_filled_items)
    this.stage.render()
    this.shovel_sound.play()
    if (new_filled_items.length > 0) {
      const center_row = (from_row + to_row) / 2
      const center_col = (from_col + to_col) / 2
      let [x, y] = this.stage.get_xy(center_row, center_col)
      const separation = 95
      x -= idiv((new_filled_items.length - 1) * separation, 2)
      y -= 20
      for (const item of new_filled_items) {
        if (item.percentage !== 0) {
          this.start_goodjob_animation(item, x, y)
          x += separation
        }
      }
      this.stage.render()
      this.minigame_solved_sound.play()
    }
    return this.check_minigame_solved()
  }

  has_selection_filled_item(selection_item_type: string, filled_items: ListItem[]) {
    if (selection_item_type === 'soil') return false
    for (const item of filled_items) if (item.item_type === selection_item_type) return true
    const [from_row, from_col] = this.painting_from
    const [to_row, to_col] = this.painting_to
    for (let r = Math.min(from_row, to_row); r < Math.max(from_row, to_row) + 1; r++) {
      for (let c = Math.min(from_col, to_col); c < Math.max(from_col, to_col) + 1; c++) {
        const cell = this.grid_data[r][c]
        if (cell != null && selection_item_type !== cell.get_type()) {
          for (const item of filled_items) if (item.item_type === cell.get_type()) return true
        }
      }
    }
    return false
  }

  sum_item(item_type: string) {
    for (const item of this.list) if (item.item_type === item_type) { item.count += 1; break }
  }

  substract_item(item_type: string) {
    for (const item of this.list) if (item.item_type === item_type) { item.count -= 1; break }
  }

  get_items_filled() {
    const filled_items: ListItem[] = []
    const total = GRID_SIZE[0] * GRID_SIZE[1]
    for (const item of this.list) {
      const current_percentage = Math.trunc((item.count / total) * 100)
      if (current_percentage === item.percentage) filled_items.push(item)
    }
    return filled_items
  }

  update_items_text(exclude_filled_items: ListItem[] = []) {
    const filled_items: ListItem[] = []
    const total = GRID_SIZE[0] * GRID_SIZE[1]
    for (const item of this.list) {
      const current_percentage = Math.trunc((item.count / total) * 100)
      if (current_percentage === item.percentage) {
        for (const t of item.text_items) if (t != null) t.set_color([154, 4, 4])
        if (!exclude_filled_items.includes(item)) filled_items.push(item)
      } else {
        for (const t of item.text_items) if (t != null) t.set_color([80, 70, 70])
      }
    }
    return filled_items
  }

  start_goodjob_animation(item: ListItem, x: number, y: number) {
    new GoodJobAnimation(this.stage, this.grid_goodjob_layer, item, x, y).start()
  }

  tool_option_item_click = (item: any, _args: unknown) => {
    this.stage.render()
    this.stage.click_sound.play()
    this.set_selected_option(item)
  }

  set_selected_option(item: any) {
    if (this.selected_option != null) {
      this.selected_option.set_image(this.option_image_normal)
      this.selected_option.set_rollover_image(this.option_image_rollover, this.rollover_sound)
    }
    this.selected_option = item
    item.set_image(this.option_image_selected)
    item.set_rollover_image(null, null)
  }

  check_minigame_solved() {
    let solved = true
    const total = GRID_SIZE[0] * GRID_SIZE[1]
    for (const item of this.list) {
      if (Math.trunc((item.count / total) * 100) !== item.percentage) { solved = false; break }
    }
    if (solved) {
      this.stop_minigame(true)
      this.grid_selection_layer.empty()
      animations.wait_locked(this.stage, 2000, () => this.minigame_solved_callback())
    }
    return solved
  }

  create_character_happy_item() {
    return new ItemImage(438, 83, assets.load_image('p1_minigame_gardener_happy.png'), null)
  }

  calculate_solved_score() {
    if (this.pause_start_time != null) {
      this.pause_total_time += pygame.time.get_ticks() - this.pause_start_time
      this.pause_start_time = null
    }
    const elapsed_time = idiv(pygame.time.get_ticks() - this.start_time! - this.pause_total_time, 1000)
    const time_score = elapsed_time <= this.average_time ? idiv(128 * (this.average_time - elapsed_time), this.average_time) : 0
    return [100, time_score]
  }
}

export class ListItem {
  text_items: (ItemText | null)[] = []
  constructor(public option_icon: Image, public text: string, public text_icon: Image, public percentage: number, public fraction: Fraction | null, public item_type: string, public count: number) {}
}

export class GoodJobAnimation {
  stage: any
  grid_goodjob_layer: Layer
  color_image: Image
  white_image: Image
  color_item: ItemImage
  white_item: ItemImage

  constructor(stage: any, grid_goodjob_layer: Layer, item: ListItem, x: number, y: number) {
    this.stage = stage
    this.grid_goodjob_layer = grid_goodjob_layer
    if (item.fraction == null) {
      const number_str = item.percentage < 10 ? '0' + String(item.percentage) : String(item.percentage)
      this.color_image = assets.load_image('p1_minigame_gardener_goodjob_n' + number_str + '.png')
      this.white_image = assets.load_image('p1_minigame_gardener_goodjob_w' + number_str + '.png')
    } else {
      const fraction_str = item.fraction[0]
      this.color_image = assets.load_image('p1_minigame_gardener_goodjob_f' + fraction_str + '.png')
      this.white_image = assets.load_image('p1_minigame_gardener_goodjob_w' + fraction_str + '.png')
    }
    const left = x - idiv(this.color_image.get_width(), 2)
    const top = y - idiv(this.color_image.get_height(), 2)
    this.color_item = new ItemImage(left, top, this.color_image)
    this.white_item = new ItemImage(left, top, this.white_image)
  }

  start() {
    this.grid_goodjob_layer.add(this.color_item)
    this.grid_goodjob_layer.add(this.white_item)
    const from_size = [Math.trunc(this.color_image.get_width() * 0.82), Math.trunc(this.color_image.get_height() * 0.82)]
    animations.start_resize(this.color_item, this.color_image, from_size, this.color_image.get_size(), 230, 1, (i) => this._resize_callback(i))
    animations.start_resize(this.white_item, this.white_image, from_size, this.white_image.get_size(), 230, 1)
    this.white_item.set_alpha(200)
    animations.fade_out_item(this.white_item, true, 230)
  }

  private _resize_callback(_item: unknown) { animations.wait(this.stage, 100, () => this._wait_callback()) }

  private _wait_callback() {
    if (this.grid_goodjob_layer.get_stage() != null) {
      animations.start_move(this.color_item, this.color_item.get_left(), this.color_item.get_top() - 83, 560)
      animations.fade_out_item(this.color_item, true, 560)
    }
  }
}
