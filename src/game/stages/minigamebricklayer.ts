// Port de game/stages/minigamebricklayer.py (minijuego del albañil: rompecabezas deslizante).
// Las listas por comprensión mutiladas por el decompilador se recuperaron del desensamblado.
import * as assets from '../../framework/assets.ts'
import * as animations from '../../framework/animations.ts'
import type { Image } from '../../framework/assets.ts'
import { ItemImage, ItemText, ItemEvent } from '../../framework/stage.ts'
import pygame, { Rect, Surface, SRCALPHA } from '../../pg/index.ts'
import { choice, randint, idiv, pmod } from '../../pg/py.ts'
import { Minigame } from './minigame.ts'
import * as statcodes from '../data/statcodes.ts'

export class MinigameBricklayer extends Minigame {
  witness_minigame_box_image: Image
  right_sound: assets.CustomSound
  drag_sound: assets.CustomSound
  fade_sound: assets.CustomSound
  showing_missing_piece: boolean
  move_duration: number
  witness_item: ItemImage
  puzzle_pieces: ItemImage[]
  minigame_solved: boolean
  start_time: number | null
  pause_start_time: number | null
  pause_total_time: number
  title: string
  question_intro: string
  question: string
  request_text: string
  request_question_text: string
  thanks_text: string
  picture: Picture
  maximum_time = 15
  maximum_time_score = 150
  puzzle_image!: Image
  tile_image: Image | null = null
  rows = 3
  cols = 3
  minigame_level = 1
  grid: (ItemImage | null)[][] = []
  piece_width = 0
  piece_height = 0
  from_row = 0
  from_col = 0
  upper_help_text_item!: ItemText

  constructor(stage: any, phase1content: any, witness: any) {
    super(stage, phase1content, witness, statcodes.MG_BRICKLAYER, statcodes.MG_BRICKLAYER_SOLVED, statcodes.MG_BRICKLAYER_NOTSOLVED, 'bricklayer')
    this.witness_minigame_box_image = assets.load_image('p1_minigame_flux_bricklayer_dialogue1.png')
    this.right_sound = assets.load_sound('p1_minigame_right.ogg')
    this.drag_sound = assets.load_sound('p1_minigame_bricklayer_drag.ogg')
    this.fade_sound = assets.load_sound('fade.ogg')
    this.showing_missing_piece = false
    this.move_duration = this.drag_sound.get_length() * 1000 * 0.75
    this.witness_item = new ItemImage(428, 66, assets.load_image('p1_minigame_bricklayer.png'), null)
    this.puzzle_pieces = []
    this.max_help_stages = 4
    this.minigame_solved = false
    this.start_time = null
    this.pause_start_time = null
    this.pause_total_time = 0
    this.title = 'ALBAÑIL'
    this.question_intro = 'El Albañil se encuentra muy ocupado\nen este momento, quizás si lo ayudas\npuedas interrogarlo luego.'
    this.question = '¿Te ofreces a ayudarlo?'
    this.request_text = 'El dueño de casa me pidió que colocara\nun mural en la pared y me lo dio separado\nen piezas de cerámica.'
    this.request_question_text = '¿Me ayudas a ordenar las piezas\npara formar la imagen?'
    this.thanks_text = '¡Muchas gracias! El dueño de casa va a quedar muy satisfecho.'
    this.picture = this.select_picture()
  }

  get_music() { return this.phase1content.music_minigame_1 }

  blind_show_minigame_callback(_layer: unknown) {
    if (!this.stage.game.datastore.user_character_progress.minigame_bricklayer_help_seen) {
      this.stop_minigame(false)
      this.show_help_dialog()
      this.stage.game.datastore.user_character_progress.minigame_bricklayer_help_seen = true
    } else this.start_minigame()
  }

  load_help_data() {
    let background_image!: Image
    let back_left = 0, back_top = 0
    let upper_help_text = '', upper_text_left = 0, upper_text_top = 0, upper_text_width = 0, upper_text_height = 0
    if (this.help_stage === 1) {
      background_image = assets.load_image('p1_minigame_bricklayer_help_d1.jpg')
      back_left = 126; back_top = 146
      upper_help_text = 'En la pantalla veremos las piezas del mural desordenadas.'
      upper_text_left = 157; upper_text_top = 94; upper_text_width = 288; upper_text_height = 67
      this.help_previous_button.set_visible(false)
    } else if (this.help_stage === 2) {
      background_image = assets.load_image('p1_minigame_bricklayer_help_d2.jpg')
      back_left = 125; back_top = 143
      upper_help_text = 'Haciendo clic sobre una pieza, ésta se moverá hasta el espacio vacío.'
      upper_text_left = 163; upper_text_top = 94; upper_text_width = 275; upper_text_height = 49
    } else if (this.help_stage === 3) {
      background_image = assets.load_image('p1_minigame_bricklayer_help_d3.jpg')
      back_left = 125; back_top = 143
      upper_help_text = 'Si hay más piezas entre ella y el espacio vacío se moverán todas.'
      upper_text_left = 156; upper_text_top = 94; upper_text_width = 288; upper_text_height = 56
    } else if (this.help_stage === 4) {
      background_image = assets.load_image('p1_minigame_bricklayer_help_d4.jpg')
      back_left = 125; back_top = 143
      upper_help_text = 'Una vez que la imagen esté formada se dará por concluída la tarea.'
      upper_text_left = 157; upper_text_top = 94; upper_text_width = 288; upper_text_height = 56
    }
    const bg = new ItemImage(0, 0, null, null)
    bg.set_image(background_image)
    bg.set_lefttop(back_left, back_top)
    this.help_current_layer.add(bg)
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
    const photo_number = this.picture.number
    const location = this.picture.location
    const department = this.picture.department
    const minigame_level = this.stage.game.datastore.user_character_progress.range.minigame_level
    let rows: number, cols: number
    if (minigame_level === 1) { rows = 3; cols = 3; this.maximum_time = 15; this.maximum_time_score = 150 }
    else if (minigame_level === 2) { rows = 3; cols = 3; this.maximum_time = 30; this.maximum_time_score = 200 }
    else { rows = 3; cols = 3; this.maximum_time = 150; this.maximum_time_score = 120 }
    this.set_up_game_background_items()
    this.set_up_puzzle(photo_number, rows, cols, minigame_level)
    this.set_up_frame(location, department)
    this.set_up_buttons()
    this.set_up_photo(photo_number)
    this.set_up_witness()
  }

  close_click = (_item: unknown, _args: unknown) => {
    if (!this.escape_key_event()) {
      this.stop_minigame(false)
      this.phase1content.minigame_solved(false)
      this.close_minigame()
    }
  }

  set_up_buttons() {
    const close_item = new ItemImage(258, 43, assets.load_image('p1_minigames_btn_close_normal.png'))
    close_item.set_rollover_image(assets.load_image('p1_minigames_btn_close_active.png'), this.rollover_sound)
    close_item.add_event_handler(ItemEvent.CLICK, this.close_click)
    this.layer.add(close_item)
    const help_item = new ItemImage(293, 44, assets.load_image('p1_minigames_btn_help_normal.png'))
    help_item.set_rollover_image(assets.load_image('p1_minigames_btn_help_active.png'), this.rollover_sound)
    help_item.add_event_handler(ItemEvent.CLICK, (i: any, a: any) => this.help_click(i, a))
    this.layer.add(help_item)
  }

  set_up_game_background_items() {
    this.layer.add(new ItemImage(89, 62, assets.load_image('p1_minigame_bricklayer_background.png')))
  }

  set_up_frame(location: string, department: string) {
    this.layer.add(new ItemImage(89, 62, assets.load_image('p1_minigame_bricklayer_frame.png')))
    this.layer.add(new ItemText(180, 360, this.font_13_bld, 0, location, [75, 47, 7], null, 229, 20, 2))
    const font_10_bld = assets.load_font('evilgeniusbb_bld.ttf', 10)
    this.layer.add(new ItemText(180, 376, font_10_bld, 0, '- ' + department + ' -', [100, 66, 12], null, 229, 16, 2))
  }

  set_up_photo(photo_number: number) {
    this.layer.add(new ItemImage(0, 157, assets.load_image('p1_minigame_bricklayer_photo_00' + String(photo_number) + '.png')))
  }

  set_up_puzzle(photo_number: number, rows: number, cols: number, minigame_level: number) {
    this.puzzle_image = assets.load_image('p1_minigame_bricklayer_postal_00' + String(photo_number) + '.jpg')
    this.tile_image = null
    this.tile_image = assets.load_image('p1_minigame_bricklayer_tile' + String(rows) + 'x' + String(cols) + '.png')
    this.rows = rows
    this.cols = cols
    this.minigame_level = minigame_level
    for (const piece of this.puzzle_pieces) this.layer.remove(piece)
    this.grid = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => null))
    this.piece_width = idiv(this.puzzle_image.get_width(), this.cols)
    this.piece_height = idiv(this.puzzle_image.get_height(), this.rows)
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (i !== this.rows - 1 || j !== this.cols - 1) {
          const piece = new ItemImage(0, 0, this.create_piece_image(i, j))
          piece.add_event_handler(ItemEvent.CLICK, this.piece_click)
          piece.row = i
          piece.col = j
          this.puzzle_pieces.push(piece)
          this.layer.add(piece)
        }
      }
    }
    this.shuffle()
    for (let i = 0; i < this.rows; i++) for (let j = 0; j < this.cols; j++) this.set_piece_pos(i, j)
  }

  shuffle() {
    const rows = this.rows, cols = this.cols
    const n = cols * rows - 1
    let method: number, movements = 0, from_row: number, from_col: number, min_parity: number, max_parity: number
    if (this.minigame_level === 1) { method = 1; movements = 6; from_row = 1; from_col = 0; min_parity = 6; max_parity = 10 }
    else if (this.minigame_level === 2) { method = 1; from_row = 0; from_col = 0; movements = 8; min_parity = 6; max_parity = 12 }
    else { method = 2; min_parity = 10; max_parity = 999; from_row = 0; from_col = 0 }
    let list: number[]
    for (;;) {
      list = method === 1 ? this.perform_random_movements(rows, cols, movements, from_row, from_col) : this.generate_random_positions(n)
      const parity = this.calculate_parity(list, n)
      if (parity % 2 === 0 && parity >= min_parity && parity <= max_parity) break
    }
    for (const piece of this.puzzle_pieces) {
      const piece_pos = piece.row * cols + piece.col
      const index = list.indexOf(piece_pos)
      this.grid[idiv(index, cols)][pmod(index, cols)] = piece
    }
    this.from_row = from_row
    this.from_col = from_col
  }

  perform_random_movements(rows: number, cols: number, movements: number, from_row: number, from_col: number) {
    const matrix = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, k) => i * cols + k))
    let col = cols - 1
    let row = rows - 1
    let previous_oposite_direction = 1
    for (let i = 0; i < movements; i++) {
      let valid_direction = false
      let new_col = col, new_row = row
      while (!valid_direction) {
        let direction = randint(0, 3)
        if (direction === previous_oposite_direction) direction = (direction + 1) % 4
        if (direction === 0) {
          if (row > from_row) { new_col = col; new_row = row - 1; valid_direction = true; previous_oposite_direction = 1 }
        } else if (direction === 1) {
          if (row + 1 < rows) { new_col = col; new_row = row + 1; valid_direction = true; previous_oposite_direction = 0 }
        } else if (direction === 2) {
          if (col > from_col) { new_col = col - 1; new_row = row; valid_direction = true; previous_oposite_direction = 3 }
        } else if (col + 1 < cols) { new_col = col + 1; new_row = row; valid_direction = true; previous_oposite_direction = 2 }
      }
      const temp = matrix[row][col]
      matrix[row][col] = matrix[new_row][new_col]
      matrix[new_row][new_col] = temp
      row = new_row
      col = new_col
    }
    const list: number[] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push(matrix[r][c])
    return list
  }

  generate_random_positions(n: number) {
    const list: number[] = []
    const numbers = Array.from({ length: n }, (_, i) => i)
    for (let k = 0; k < n; k++) {
      const i = choice(numbers)
      numbers.splice(numbers.indexOf(i), 1)
      list.push(i)
    }
    return list
  }

  calculate_parity(list: number[], n: number) {
    let parity = 0
    const parity_list = list.slice()
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < parity_list.length; j++) {
        if (parity_list[j] === i) { parity_list.splice(j, 1); break }
        else parity += 1
      }
    }
    return parity
  }

  set_piece_pos(row: number, col: number, animated = false) {
    const piece = this.grid[row][col]
    if (piece != null) {
      piece.current_row = row
      piece.current_col = col
      const new_left = 114 + col * piece.get_width()
      const new_top = 87 + row * piece.get_height()
      if (animated) {
        animations.start_move(piece, new_left, new_top, this.move_duration)
        animations.wait_locked(this.stage, this.move_duration, null)
      } else {
        piece.set_left(new_left)
        piece.set_top(new_top)
      }
    }
  }

  piece_click = (item: any, _args: unknown) => {
    if (!this.minigame_solved) {
      const row = item.current_row
      const col = item.current_col
      let moved = false
      if (!(row < this.from_row || col < this.from_col)) {
        let empty_row = -1, empty_col = -1
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) if (this.grid[r][c] == null) { empty_row = r; empty_col = c; break }
          if (empty_row !== -1) break
        }
        if (row === empty_row) {
          if (col < empty_col) {
            for (let c = empty_col - 1; c >= col; c--) { this.move_to(this.grid[row][c]!, row, c + 1); moved = true }
          } else if (col > empty_col) {
            for (let c = empty_col + 1; c <= col; c++) { this.move_to(this.grid[row][c]!, row, c - 1); moved = true }
          }
        } else if (col === empty_col) {
          if (row < empty_row) {
            for (let r = empty_row - 1; r >= row; r--) { this.move_to(this.grid[r][col]!, r + 1, col); moved = true }
          } else if (row > empty_row) {
            for (let r = empty_row + 1; r <= row; r++) { this.move_to(this.grid[r][col]!, r - 1, col); moved = true }
          }
        }
      }
      this.stage.render()
      if (moved) this.drag_sound.play()
      else this.stage.click_sound.play()
    }
  }

  move_to(piece: any, to_row: number, to_col: number) {
    if (to_row >= 0 && to_row < this.rows && to_col >= 0 && to_col < this.cols && this.grid[to_row][to_col] == null) {
      const from_row = piece.current_row
      const from_col = piece.current_col
      this.grid[from_row][from_col] = null
      this.grid[to_row][to_col] = piece
      this.set_piece_pos(to_row, to_col, true)
      this.check_minigame_solved()
      return true
    }
    return false
  }

  check_minigame_solved() {
    let solved = true
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const piece = this.grid[row][col]
        if (piece != null && (piece.current_row !== piece.row || piece.current_col !== piece.col)) { solved = false; break }
      }
      if (!solved) break
    }
    if (solved) {
      this.minigame_solved = true
      this.stop_minigame(true)
      this.stage.render()
      this.right_sound.play()
      animations.wait_locked(this.stage, 500, () => this.show_missing_piece())
    }
  }

  show_missing_piece() {
    this.showing_missing_piece = true
    const piece = new ItemImage(0, 0, this.create_piece_image(this.rows - 1, this.cols - 1))
    piece.row = this.rows - 1
    piece.col = this.cols - 1
    this.layer.add(piece)
    this.grid[piece.row][piece.col] = piece
    this.set_piece_pos(piece.row, piece.col)
    animations.fade_in_item(piece, 500)
    animations.wait_locked(this.stage, 1500, () => this.show_missing_piece_callback())
    this.stage.render()
    this.fade_sound.play()
  }

  escape_key_event() {
    if (this.showing_missing_piece) {
      this.continue_sound.play()
      this.minigame_solved_callback()
      return true
    }
    return false
  }

  show_missing_piece_callback() {
    const button = new ItemImage(216, 404, assets.load_image('p0_endings_btn_continue_normal.png'))
    button.set_rollover_image(assets.load_image('p0_endings_btn_continue_rollover.png'), this.rollover_sound)
    button.add_event_handler(ItemEvent.CLICK, this.continue_click)
    this.layer.add(button)
  }

  continue_click = (_item: unknown, _args: unknown) => {
    this.showing_missing_piece = false
    this.minigame_solved_callback()
    this.continue_sound.play()
  }

  create_piece_image(row: number, col: number) {
    const surf = new Surface([this.piece_width, this.piece_height], SRCALPHA, 32)
    surf.blit(this.puzzle_image.surface, [0, 0], new Rect(col * this.piece_width, row * this.piece_height, this.piece_width, this.piece_height))
    if (this.tile_image != null) surf.blit(this.tile_image.surface, [0, 0])
    return new assets.Image(surf)
  }

  calculate_solved_score() {
    if (this.pause_start_time != null) {
      this.pause_total_time += pygame.time.get_ticks() - this.pause_start_time
      this.pause_start_time = null
    }
    const elapsed_time = idiv(pygame.time.get_ticks() - this.start_time! - this.pause_total_time, 1000)
    const time_score = elapsed_time <= this.maximum_time ? idiv(this.maximum_time_score * (this.maximum_time - elapsed_time), this.maximum_time) : 0
    return [100, time_score]
  }

  select_picture(): Picture {
    const pictures_seen: number[] = this.stage.game.datastore.user_character_progress.bricklayer_pictures_seen
    let selected_picture: Picture | null = null
    while (selected_picture == null) {
      const pictures = [
        new Picture('Piedra Pintada', 'Artigas', 1),
        new Picture('Cerro Batoví', 'Tacuarembó', 2),
        new Picture('Faro de Cabo Polonio', 'Rocha', 3),
        new Picture('Monumento al Ahogado', 'Maldonado', 4),
        new Picture('Real de San Carlos', 'Colonia', 5),
      ]
      for (const number of pictures_seen) {
        const i = pictures.findIndex((p) => p.number === Number(number))
        if (i >= 0) pictures.splice(i, 1)
      }
      if (pictures.length === 0) pictures_seen.splice(0, idiv(pictures_seen.length, 2))
      else {
        selected_picture = choice(pictures)
        pictures_seen.push(selected_picture.number)
      }
    }
    return selected_picture
  }

  create_character_happy_item() {
    return new ItemImage(433, 66, assets.load_image('p1_minigame_bricklayer_happy.png'), null)
  }
}

export class Picture {
  constructor(public location: string, public department: string, public number: number) {}
}
