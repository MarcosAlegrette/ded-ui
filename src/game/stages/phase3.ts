// Port de game/stages/phase3.py (persecución en auto).
// En el original, racer.start(...) era un módulo nativo C++ (game.stages.racer.pyd) que tomaba la
// pantalla y devolvía el resultado de forma sincrónica. Aquí la persecución es una reconstrucción
// (src/game/racer) que corre dentro del loop del juego y devuelve el resultado con un callback.
import * as phase0 from './phase0.ts'
import * as help from './help.ts'
import * as animations from '../../framework/animations.ts'
import { Layer, ItemRect } from '../../framework/stage.ts'
import { start as racer_start } from '../racer/racer.ts'

export function get_time_of_day(hour: number) {
  if (hour < 16) return 'noon'
  if (hour < 18) return 'afternoon'
  return 'night'
}

export class Phase3Content extends phase0.PhaseContent {
  game: any
  stage: any
  start_racer: typeof racer_start = racer_start
  loading_layer: Layer | null = null

  constructor() {
    super()
  }

  initialize(game: any, stage: any) {
    this.game = game
    this.stage = stage
  }

  add_above_info_layers() {
    const background_layer = new Layer()
    this.stage.add_layer(background_layer)
    const background = new ItemRect(0, 0, 600, 450)
    background_layer.add(background)
    this.start_racer = racer_start
    animations.wait(this.stage, 10, () => this.prepare_chase())
  }

  prepare_chase() {
    this.loading_layer = this.game.add_loading_to_stage()
    if (this.loading_layer != null) animations.cancel_blind_layer(this.stage, this.loading_layer, true)
    this.game.hide_loading()
    const cp = this.game.datastore.user_character_progress
    if (!cp.phase3_help) {
      const help_dialog = new help.Help(this.stage)
      help_dialog.show_help(7, true, false, () => this.close_help_callback(), [7, 9])
      cp.phase3_help = true
    } else this.start_chase()
  }

  close_help_callback() {
    this.start_chase()
  }

  start_chase() {
    const case_ = this.game.datastore.user_character_progress.case
    const color = case_.thief_car_color ? case_.thief_car_color : 'violet'
    this.start_racer(
      this.stage,
      case_.thief.phase3_image,
      get_avatar_path(this.game.datastore.user_character.charinfo),
      get_time_of_day(case_.actual_days()[1]),
      'p3_map_' + case_.last_department_lair.chase_map + '.yaml',
      color,
      (result: boolean) => this.end_chase(result),
    )
  }

  /** Lo que en Python seguía a la llamada sincrónica a racer.start(). */
  end_chase(result: boolean) {
    this.game.datastore.user_character_progress.case.caught_thief = result
    if (this.loading_layer != null) this.stage.remove_layer(this.loading_layer)
    this.stage.redraw()
    this.stage.set_phase(1)
  }
}

export function get_avatar_path(char_info: any) {
  let name = 'p0_detective_'
  name += char_info.sex === 'M' ? 'male_' : 'female_'
  name += String(char_info.avatar).padStart(3, '0') + '_carchase.jpg'
  return name
}
