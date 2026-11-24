// Port de game/stages/map.py: mapa de Uruguay para viajar entre departamentos (con el autito
// que deja la huella de puntos y gira en ángulos de 45°).
import * as animations from '../../framework/animations.ts'
import * as assets from '../../framework/assets.ts'
import { Layer, ItemImage, ItemMask, ItemText, ItemEvent } from '../../framework/stage.ts'
import type { Image, CustomSound } from '../../framework/assets.ts'
import type { Font } from '../../pg/font.ts'
import * as phase0 from './phase0.ts'
import { get_travel_turns } from '../data/serialization.ts'
import { idiv, pyround } from '../../pg/py.ts'

/** variable de módulo map.car_angle del original (se conserva entre aperturas del mapa) */
export let car_angle = 135

export class MapDepartment {
  department: any
  image_name: string
  x: number
  y: number
  mask_color: number[]
  center_x: number
  center_y: number
  inactive = true
  roll_over: ItemImage | null = null
  constructor(department: any, image_name: string, x: number, y: number, mask_color: number[], center_x: number, center_y: number) {
    this.department = department
    this.image_name = image_name
    this.x = x
    this.y = y
    this.mask_color = mask_color
    this.center_x = center_x
    this.center_y = center_y
  }
}

export class Map {
  stage: any
  from_phase0: boolean
  map_layer = new Layer()
  rollover_layer = new Layer()
  mask_layer = new Layer()
  car_layer = new Layer()
  font: Font
  large_font: Font
  background_image!: Image
  close_button_image!: Image
  close_button_image_rollover!: Image
  car_stopped: Image[] = []
  car_running: Image[][] = []
  car_move_marks!: animations.MoveMarks
  rollover_sound!: CustomSound
  click_sound!: CustomSound
  engine_sound!: CustomSound
  tires_sound!: CustomSound
  img_id_normal = false
  selected_department: MapDepartment | null = null
  traveling_to: MapDepartment | null = null
  map_movement_unlocked = false
  background!: ItemImage
  department_data: MapDepartment[] = []
  close_button!: ItemImage
  department_masks!: ItemMask
  department_text!: ItemText
  car!: ItemImage
  active_department!: MapDepartment
  active_department_image!: ItemImage
  show_rotation_animation = true

  constructor(stage: any, from_phase0: boolean, car_animation = false) {
    this.stage = stage
    this.from_phase0 = from_phase0
    this.font = assets.load_font('freesansbold.ttf', 13)
    this.large_font = assets.load_font('nakel___.ttf', 30)
    this.load_dialog_images()
    this.load_car_images()
    this.load_sounds()
    this.set_up(!car_animation, car_animation)
  }

  load_dialog_images() {
    this.background_image = assets.load_image('p0_map_back.png')
    this.close_button_image = assets.load_image('p0_button_close.png')
    this.close_button_image_rollover = assets.load_image('p0_button_close_rollover.png')
  }

  close_map() { this.stage.close_dialog(this.map_layer) }

  load_car_images() {
    this.car_stopped = ['t', 'tl', 'l', 'bl', 'b'].map((d) => assets.load_image('p0_map_car_' + d + '.png'))
    this.car_running = ['t', 'tl', 'l', 'bl', 'b'].map((d) => [1, 2, 3].map((i) => assets.load_image('p0_map_car_' + d + '_00' + i + '.png')))
    this.car_move_marks = new animations.MoveMarks(assets.load_image('p0_map_dot.png'), 20)
  }

  load_sounds() {
    this.rollover_sound = assets.load_sound('GUI_roll_over.ogg')
    this.click_sound = assets.load_sound('GUI_Click.ogg')
    this.engine_sound = assets.load_sound('p0_car_map.ogg')
    this.tires_sound = assets.load_sound('p3_car_tires.wav')
  }

  set_up(show_close: boolean, all_actives: boolean) {
    this.img_id_normal = false
    this.selected_department = null
    this.traveling_to = null
    this.map_movement_unlocked = false
    this.map_layer.empty()
    this.rollover_layer.empty()
    this.mask_layer.empty()
    this.car_layer.empty()
    this.background = new ItemImage(0, 0, this.background_image, null)
    this.map_layer.add(this.background)
    this.set_map_movement_data(all_actives)
    this.set_departaments_data(all_actives)
    if (show_close) this.set_up_close_button()
    this.set_up_department_items()
    this.set_up_department_masks()
    this.set_up_texts()
    this.set_up_active_department()
    this.set_up_car()
  }

  set_map_movement_data(all_actives: boolean) {
    const c = this.stage.game.datastore.user_character_progress.case
    if (!all_actives) {
      const clue_found = c.clues_found.length > 0
      if ((c.last_department_visited === c.list_departments[0] && c.last_department_lair === c.list_departments[0]) || (!c.wrong_witness_visited && !clue_found)) this.map_movement_unlocked = false
      else this.map_movement_unlocked = true
    } else this.map_movement_unlocked = true
  }

  set_departaments_data(all_actives: boolean) {
    const d = this.stage.game.datastore.list_departments
    this.department_data = [
      new MapDepartment(d[0], 'artigas', 139, 64, [255, 0, 0], 196, 104),
      new MapDepartment(d[1], 'canelones', 224, 335, [150, 150, 150], 256, 359),
      new MapDepartment(d[2], 'cerrolargo', 286, 170, [0, 150, 255], 339, 218),
      new MapDepartment(d[3], 'colonia', 118, 308, [255, 150, 150], 161, 333),
      new MapDepartment(d[4], 'durazno', 186, 220, [255, 255, 150], 245, 262),
      new MapDepartment(d[5], 'flores', 176, 267, [255, 0, 255], 204, 296),
      new MapDepartment(d[6], 'florida', 221, 263, [150, 255, 150], 258, 312),
      new MapDepartment(d[7], 'lavalleja', 270, 278, [150, 150, 255], 306, 319),
      new MapDepartment(d[8], 'maldonado', 279, 317, [0, 150, 0], 311, 366),
      new MapDepartment(d[9], 'montevideo', 227, 368, [0, 0, 150], 238, 378),
      new MapDepartment(d[10], 'paysandu', 127, 157, [255, 150, 0], 178, 197),
      new MapDepartment(d[11], 'rionegro', 116, 214, [0, 255, 0], 172, 242),
      new MapDepartment(d[12], 'rivera', 237, 113, [0, 255, 150], 289, 162),
      new MapDepartment(d[13], 'rocha', 328, 268, [150, 0, 255], 357, 322),
      new MapDepartment(d[14], 'salto', 132, 109, [255, 255, 0], 189, 152),
      new MapDepartment(d[15], 'sanjose', 186, 312, [255, 150, 255], 210, 344),
      new MapDepartment(d[16], 'soriano', 116, 258, [0, 0, 255], 154, 291),
      new MapDepartment(d[17], 'tacuarembo', 213, 141, [0, 255, 255], 262, 197),
      new MapDepartment(d[18], 'treintaytres', 297, 237, [255, 0, 150], 346, 261),
    ]
    if (all_actives) {
      for (const dep of this.department_data) dep.inactive = false
    } else {
      let posible_deps: any[] = []
      const c = this.stage.game.datastore.user_character_progress.case
      if (c.last_department_lair === c.list_departments[0] || c.last_department_lair === c.list_departments[1]) posible_deps = c.list_posible_departments
      for (const dd of posible_deps) this.department_data[d.indexOf(dd)].inactive = false
      this.set_last_visited_departments()
    }
  }

  set_up_close_button() {
    this.close_button = new ItemImage(275, 392, this.close_button_image, null)
    this.close_button.add_event_handler(ItemEvent.CLICK, this.button_click)
    this.close_button.set_rollover_image(this.close_button_image_rollover, this.rollover_sound)
    this.map_layer.add(this.close_button)
  }

  set_up_department_items() {
    const c = this.stage.game.datastore.user_character_progress.case
    for (const dep_data of this.department_data) {
      if (this.map_movement_unlocked) {
        if (dep_data.inactive && dep_data.department !== c.list_departments[0]) {
          this.map_layer.add(new ItemImage(dep_data.x, dep_data.y, assets.load_image('p0_map_inactive_' + dep_data.image_name + '.png')))
        } else {
          dep_data.roll_over = new ItemImage(dep_data.x, dep_data.y, assets.load_image('p0_map_' + dep_data.image_name + '_rollover.png'))
        }
      } else {
        dep_data.inactive = true
        this.map_layer.add(new ItemImage(dep_data.x, dep_data.y, assets.load_image('p0_map_inactive_' + dep_data.image_name + '.png')))
      }
    }
  }

  set_up_department_masks() {
    const masks = assets.load_mask('p0_map_mask.gif')
    this.department_masks = new ItemMask(117, 66, masks)
    this.mask_layer.add(this.department_masks)
    this.department_masks.add_event_handler(ItemEvent.CLICK, this.department_masks_click)
    this.department_masks.add_event_handler(ItemEvent.MOUSE_MOVE, this.department_masks_move)
    this.department_masks.add_event_handler(ItemEvent.MOUSE_LEAVE, this.department_masks_leave)
  }

  set_up_texts() {
    this.department_text = new ItemText(368, 115, this.large_font, 37, '', [100, 25, 25], null, 130, 91, 2, 2)
    this.map_layer.add(this.department_text)
  }

  set_up_car() {
    const car_image = this.get_car_stopped_image(car_angle)
    const [left, top] = this.get_car_pos(this.active_department, car_image)
    this.car = new ItemImage(left, top, car_image)
    this.car_layer.add(this.car)
  }

  get_car_pos(dep: MapDepartment, car_image: Image): [number, number] {
    return [dep.center_x - idiv(car_image.get_width(), 2), dep.center_y - idiv(car_image.get_height(), 2)]
  }

  button_click = (item: unknown, _args: unknown) => {
    this.stage.render()
    this.click_sound.play()
    if (item === this.close_button) this.close_map()
  }

  department_masks_click = (_item: unknown, args: any) => {
    if (this.traveling_to == null) {
      const dep_data = this.get_department(args)
      if (dep_data != null) {
        this.stage.render()
        this.click_sound.play()
        this.set_selected_department(null, false)
        this.go_to(dep_data.department)
        this.close_button.set_visible(false)
        const c = this.stage.game.datastore.user_character_progress.case
        const travel_turns = get_travel_turns(this.stage.game.datastore, [c.last_department_visited, c.last_department_lair])
        c.time_spend += travel_turns
        if (c.wrong_witness_visited) c.wrong_witness_visited = false
      }
    }
  }

  department_masks_move = (_item: unknown, args: any) => {
    if (this.traveling_to == null) this.set_selected_department(this.get_department(args), true)
  }

  department_masks_leave = (_item: unknown, _args: unknown) => { this.set_selected_department(null, false) }

  get_department(args: any): MapDepartment | null {
    let color: number[]
    try {
      color = this.department_masks.get_at(args.x - this.department_masks.get_left(), args.y - this.department_masks.get_top())
    } catch { return null }
    for (const dep_data of this.department_data) {
      if (dep_data.mask_color[0] === color[0] && dep_data.mask_color[1] === color[1] && dep_data.mask_color[2] === color[2]) {
        if (dep_data.inactive) return null
        return dep_data
      }
    }
    return null
  }

  set_up_active_department() {
    const last_department = this.stage.game.datastore.user_character_progress.case.last_department_visited
    for (const data of this.department_data) {
      if (data.department === last_department) { this.active_department = data; break }
    }
    const image = assets.load_image('p0_map_active_' + this.active_department.image_name + '.png')
    this.active_department_image = new ItemImage(this.active_department.x, this.active_department.y, image)
    this.map_layer.add(this.active_department_image)
    this.department_text.set_text(last_department.name)
  }

  set_selected_department(dep_data: MapDepartment | null, play_rollover_sound: boolean) {
    if (this.selected_department !== dep_data) {
      this.rollover_layer.empty()
      this.department_text.set_text('')
      if (dep_data != null && dep_data !== this.active_department) {
        this.department_text.set_text(dep_data.department.name)
        if (!dep_data.inactive) {
          this.rollover_layer.add(dep_data.roll_over!)
          if (play_rollover_sound) {
            this.stage.render()
            this.rollover_sound.stop()
            this.rollover_sound.play()
          }
        }
      }
      this.selected_department = dep_data
    }
  }

  go_to(department: any, show_rotation_animation = true) {
    let dep_data: MapDepartment | null = null
    for (const data of this.department_data) if (data.department === department) { dep_data = data; break }
    this.traveling_to = dep_data
    if (dep_data === this.active_department) animations.wait(this.stage, 2000, this.go_to_phase1)
    else {
      this.department_text.set_text(dep_data!.department.name)
      this.show_rotation_animation = show_rotation_animation
      animations.wait(this.stage, 100, this.start_engine)
    }
  }

  start_engine = () => {
    this.stage.render()
    this.engine_sound.play(-1)
    animations.wait(this.stage, 150, this.start_move_car)
  }

  start_move_car = () => {
    this.stage.render()
    this.engine_sound.play(-1)
    animations.remove_move_marks(this.car)
    animations.stop_image_sequence(this.car)
    const [rotation_images, new_angle] = this.get_car_rotation_images()
    car_angle = new_angle
    if (this.show_rotation_animation) animations.start_image_sequence(this.car, rotation_images, 15, 0, this.rotate_car_callback)
    else this.move_car_to_target()
  }

  get_car_rotation_images(): [Image[], number] {
    const [left, top] = this.get_car_pos(this.traveling_to!, this.car.get_image()!)
    const dx = left - this.car.get_left()
    const dy = top - this.car.get_top()
    let angle = -((Math.atan2(dy, dx) * 180) / Math.PI)
    angle = pyround(angle / 45) * 45
    let current_angle = car_angle
    let diff = angle - current_angle
    if (diff >= 360) diff -= 360
    const increment = (diff >= 0 && diff <= 180) || diff <= -180 ? 45 : -45
    const images: Image[] = []
    if (angle === 180) angle = -180
    if (current_angle === 180) current_angle = -180
    if (angle !== current_angle) {
      if (angle === 180) angle = -180
      for (;;) {
        images.push(this.get_car_stopped_image(current_angle))
        if (angle === current_angle) break
        current_angle += increment
        if (current_angle >= 180) current_angle -= 360
        else if (current_angle < -180) current_angle += 360
      }
    }
    return [images, current_angle]
  }

  get_car_running_image(angle: number, index: number) {
    if (angle === 0) return this.car_running[2][index].flip_h_copy()
    if (angle === 45) return this.car_running[1][index].flip_h_copy()
    if (angle === 90) return this.car_running[0][index]
    if (angle === 135) return this.car_running[1][index]
    if (angle === -45) return this.car_running[3][index].flip_h_copy()
    if (angle === -90) return this.car_running[4][index]
    if (angle === -135) return this.car_running[3][index]
    return this.car_running[2][index]
  }

  get_car_stopped_image(angle: number) {
    if (angle === 0) return this.car_stopped[2].flip_h_copy()
    if (angle === 45) return this.car_stopped[1].flip_h_copy()
    if (angle === 90) return this.car_stopped[0]
    if (angle === 135) return this.car_stopped[1]
    if (angle === -45) return this.car_stopped[3].flip_h_copy()
    if (angle === -90) return this.car_stopped[4]
    if (angle === -135) return this.car_stopped[3]
    return this.car_stopped[2]
  }

  rotate_car_callback = (_item: unknown) => { this.move_car_to_target() }

  move_car_to_target() {
    const [left, top] = this.get_car_pos(this.traveling_to!, this.car.get_image()!)
    const dx = left - this.car.get_left()
    const dy = top - this.car.get_top()
    const distance = Math.sqrt(dx * dx + dy * dy)
    this.start_car_on_animation()
    const duration = distance * 8
    animations.start_move(this.car, left, top, duration, null, this.car_move_marks, this.move_car_callback)
    animations.wait(this.stage, duration - 150, this.play_tires_sound)
  }

  play_tires_sound = () => {
    this.engine_sound.stop()
    this.tires_sound.play()
  }

  move_car_callback = (_item: unknown) => {
    const c = this.stage.game.datastore.user_character_progress.case
    c.last_department_visited = this.traveling_to!.department
    animations.fade_out_item(this.active_department_image, true, 250)
    this.set_up_active_department()
    animations.fade_in_item(this.active_department_image, 250)
    animations.wait(this.stage, 2000, this.go_to_phase1)
  }

  go_to_phase1 = () => {
    if (this.from_phase0) this.stage.set_phase(1, true)
    else {
      const game = this.stage.game
      game.set_stage(new phase0.Phase0Stage(game, 1), true, 'p0_loading_slides_001.jpg')
    }
  }

  add_other_layer() {
    this.stage.add_layer(this.rollover_layer)
    this.stage.add_layer(this.car_layer)
    this.stage.add_layer(this.mask_layer)
  }

  start_car_on_animation() {
    const images: Image[] = []
    const l = this.car_running[0].length
    const image_index = 0
    for (let i = 0; i < l; i++) images.push(this.get_car_running_image(car_angle, (image_index + i) % l))
    animations.start_image_sequence(this.car, images, 15, -1)
  }

  set_last_visited_departments() {
    const c = this.stage.game.datastore.user_character_progress.case
    const deps = this.stage.game.datastore.list_departments
    if (c.last_department_lair === c.list_departments[0] || c.last_department_lair === c.list_departments[1]) {
      const last_visited = this.department_data[deps.indexOf(c.list_departments[0])]
      this.map_layer.add(new ItemImage(last_visited.x, last_visited.y, assets.load_image('p0_map_lkl_' + last_visited.image_name + '.png')))
    } else if (c.last_department_lair === c.list_departments[2]) {
      const visited = this.department_data[deps.indexOf(c.list_departments[0])]
      const last_visited = this.department_data[deps.indexOf(c.list_departments[1])]
      const visited_item = new ItemImage(visited.x, visited.y, assets.load_image('p0_map_lkl_' + visited.image_name + '.png'))
      const last_visited_item = new ItemImage(last_visited.x, last_visited.y, assets.load_image('p0_map_lkl_' + last_visited.image_name + '.png'))
      this.map_layer.add(visited_item)
      this.map_layer.add(last_visited_item)
    }
  }
}
