// Port de game/data/datamodel.py (modelo de datos del juego original).
import * as assets from '../../framework/assets.ts'
import * as text from '../../framework/text.ts'
import { zpad } from '../../pg/py.ts'

export class StolenObject {
  type_location: string
  preposition: string
  description1: string
  description2: string
  constructor(prep: string, desc1: string, desc2: string, type: string) {
    this.type_location = type
    this.preposition = prep
    this.description1 = desc1
    this.description2 = desc2
  }
}

export class CrimeLocation {
  preposition: string
  name: string
  department: Department
  type_locations: string[] = []
  constructor(prep: string, name: string, dep: Department, loc1: string, loc2: string | null = null) {
    this.preposition = prep
    this.name = name
    this.department = dep
    this.add_type_location(loc1)
    if (loc2 != null) this.add_type_location(loc2)
  }
  add_type_location(loc: string) { this.type_locations.push(loc) }
}

export class CityPin {
  x: number
  y: number
  flipped: boolean
  name: string
  tag_size: number
  tag_separation: number
  tag_pos: number[]
  article: string
  constructor(x: number, y: number, flipped: boolean, name: string, tag_size: number, tag_separation: number, tag_pos: number[], article = '') {
    this.x = x
    this.y = y
    this.flipped = flipped
    this.name = name
    this.tag_size = tag_size
    this.tag_separation = tag_separation
    this.tag_pos = tag_pos
    this.article = article
  }
}

export class Department {
  name: string
  image: string
  chase_map: string
  locator_pos: number[]
  image_pos: number[]
  id_img_medal: string
  city_pins: CityPin[]
  constructor(name: string, image: string, image_pos: number[], locator_pos: number[], city_pins: CityPin[], img_medal: string, map: string) {
    this.name = name
    this.image = image
    this.chase_map = map
    this.locator_pos = locator_pos
    this.image_pos = image_pos
    this.id_img_medal = img_medal
    this.city_pins = city_pins
  }
}

export class ClueType {
  type: string
  constructor(type: string) { this.type = type }
}

export class Clue {
  id: string
  list_types: ClueType[]
  constructor(id: string, types: ClueType[]) {
    this.id = id
    this.list_types = types
  }
}

export class StageClue {
  clue: Clue
  note_item: NoteItem
  constructor(clue: Clue, note_item: NoteItem) {
    this.clue = clue
    this.note_item = note_item
  }

  build_item_message(): string {
    const n = this.note_item as any
    const id = this.clue.id
    let message: string
    const unknown = () => { throw new Error('Unknown item type ' + n.type + ' for clue ' + id) }
    if (id === 'i509' || id === 'i529') {
      if (n.type === 'HILL') {
        const article = n.article === 'el' ? 'del' : 'de ' + n.article
        const visiting = n.article === 'los' ? 'visitarlos' : 'visitarlo'
        message = 'Una postal ' + article + ' ' + n.name + '. Seguramente el ladrón piensa ' + visiting + '.'
      } else if (n.type === 'LAGOON') message = 'Una postal de la ' + n.name + '. Seguramente el ladrón piensa visitarla.'
      else if (n.type === 'RIVER') message = 'Una postal del ' + n.name + '. Seguramente el ladrón piensa visitarlo.'
      else if (n.type === 'LOCATION') message = 'Una postal de la localidad de ' + n.name + '. Seguramente el ladrón piensa visitarla.'
      else return unknown()
    } else if (id === 'i510' || id === 'i511') {
      if (n.type === 'HILL') message = 'Una nota. Al parecer el ladrón piensa visitar ' + n.article + ' ' + n.name + '.'
      else if (n.type === 'LAGOON') message = 'Una nota. Al parecer el ladrón piensa visitar la ' + n.name + '.'
      else if (n.type === 'RIVER') message = 'Una nota. Al parecer el ladrón piensa visitar el ' + n.name + '.'
      else if (n.type === 'LOCATION') message = 'Una nota. Al parecer el ladrón piensa visitar la localidad de ' + n.name + '.'
      else if (n.type === 'HISTORY_FACT') message = 'Una nota. Al parecer el ladrón piensa visitar el sitio donde ' + n.sentence_start + ' ' + n.article + ' ' + n.name + '.'
      else if (n.type === 'WRITER') message = 'Una nota. Al parecer el ladrón piensa visitar el lugar de nacimiento de ' + n.name + '.'
      else return unknown()
    } else if (id === 'i523') {
      if (n.type === 'HILL') {
        const marked = n.article === 'los' ? 'marcados' : 'marcado'
        const visiting = n.article === 'los' ? 'visitarlos' : 'visitarlo'
        message = 'Un libro de geografía que tiene ' + marked + ' ' + n.article + ' ' + n.name + '. Seguramente el ladrón piensa ' + visiting + '.'
      } else if (n.type === 'LAGOON') message = 'Un libro de geografía que tiene marcada la ' + n.name + '. Seguramente el ladrón piensa visitarla.'
      else if (n.type === 'RIVER') message = 'Un libro de geografía que tiene marcado el ' + n.name + '. Seguramente el ladrón piensa visitarlo.'
      else if (n.type === 'HISTORY_FACT') message = 'Un libro de historia sobre ' + n.article + ' ' + n.name + '. Seguramente el ladrón piensa visitar el sitio donde ' + n.sentence_start + '.'
      else if (n.type === 'LOCATION') message = 'Un libro de geografía que tiene marcada la localidad de ' + n.name + '. Seguramente el ladrón piensa visitarla.'
      else if (n.type === 'WRITER') message = 'Un libro de ' + n.name + '. Seguramente el ladrón piensa visitar su lugar de nacimiento.'
      else return unknown()
    } else if (id === 'i526') {
      if (n.type === 'HILL') {
        const visiting = n.article === 'los' ? 'visitarlos' : 'visitarlo'
        message = 'Un CD con el título "' + n.name + '". Seguramente el ladrón piensa ' + visiting + '.'
      } else if (n.type === 'LAGOON') message = 'Un CD con el título "' + n.name + '". Seguramente el ladrón piensa visitarla.'
      else if (n.type === 'RIVER') message = 'Un CD con el título "' + n.name + '". Seguramente el ladrón piensa visitarlo.'
      else if (n.type === 'HISTORY_FACT') message = 'Un CD con el título "' + n.name + '". Seguramente el ladrón piensa visitar el sitio donde ' + n.sentence_start + '.'
      else if (n.type === 'LOCATION') message = 'Un CD con el título "' + n.name + ' y sus habitantes". Seguramente el ladrón piensa visitar esa localidad.'
      else if (n.type === 'WRITER') message = 'Un CD con el título "Vida y obra de ' + n.name + '". Seguramente el ladrón piensa visitar su lugar de nacimiento.'
      else return unknown()
    } else if (id === 'i527') {
      if (n.type === 'HILL') {
        const visiting = n.article === 'los' ? 'visitarlos' : 'visitarlo'
        message = 'Un mapa que tiene marcado ' + n.article + ' ' + n.name + '. Seguramente el ladrón piensa ' + visiting + '.'
      } else if (n.type === 'LAGOON') message = 'Un mapa que tiene marcada la ' + n.name + '. Seguramente el ladrón piensa visitarla.'
      else if (n.type === 'RIVER') message = 'Un mapa que tiene marcado el ' + n.name + '. Seguramente el ladrón piensa visitarlo.'
      else if (n.type === 'LOCATION') message = 'Un mapa que tiene marcada la localidad de ' + n.name + '. Seguramente el ladrón piensa visitarla.'
      else return unknown()
    } else if (id === 'i528') {
      if (n.type === 'HILL') message = 'Un papel arrugado. Por lo que dice, el ladrón piensa visitar ' + n.article + ' ' + n.name + '.'
      else if (n.type === 'LAGOON') message = 'Un papel arrugado. Por lo que dice, el ladrón piensa visitar la ' + n.name + '.'
      else if (n.type === 'RIVER') message = 'Un papel arrugado. Por lo que dice, el ladrón piensa visitar el ' + n.name + '.'
      else if (n.type === 'HISTORY_FACT') message = 'Por lo que dice, el ladrón piensa visitar el sitio donde ' + n.sentence_start + ' ' + n.article + ' ' + n.name + '.'
      else if (n.type === 'LOCATION') message = 'Un papel arrugado. Por lo que dice, el ladrón piensa visitar la localidad de ' + n.name + '.'
      else if (n.type === 'WRITER') message = 'Un papel arrugado. Por lo que dice, el ladrón piensa visitar el lugar de nacimiento de ' + n.name + '.'
      else return unknown()
    } else message = 'Esto no parece ser una pista interesante...'
    return message
  }

  build_right_department_message(dep: Department): string {
    const n = this.note_item as any
    let message: string
    if (n.type === 'HILL') {
      let article: string = n.article
      const verb = article === 'los' ? 'están ubicados' : 'está ubicado'
      article = article[0].toUpperCase() + article.slice(1)
      message = article + ' &#c144,22,22!' + n.name + '&#c! ' + verb + ' en el departamento de &#c144,22,22!' + dep.name + '&#c!.'
    } else if (n.type === 'LAGOON') {
      if (n.list_departments.length > 1) message = 'La &#c144,22,22!' + n.name + ' limita con el departamento de &#c144,22,22!' + dep.name + '&#c!.'
      else message = 'La &#c144,22,22!' + n.name + '&#c! está ubicada en el departamento de &#c144,22,22!' + dep.name + '&#c!.'
    } else if (n.type === 'RIVER') {
      if (n.list_departments.length > 1) message = 'El &#c144,22,22!' + n.name + '&#c! pasa por el departamento de &#c144,22,22!' + dep.name + '&#c!.'
      else message = 'El &#c144,22,22!' + n.name + '&#c! está ubicado en el departamento de &#c144,22,22!' + dep.name + '&#c!.'
    } else if (n.type === 'LOCATION') {
      message = 'La localidad de &#c144,22,22!' + n.name + '&#c! está situada en el departamento de &#c144,22,22!' + dep.name + '&#c!.'
    } else if (n.type === 'HISTORY_FACT') {
      let article: string = n.article
      article = article[0].toUpperCase() + article.slice(1)
      message = article + ' &#c144,22,22!' + n.name + '&#c! ' + n.sentence_start + ' en el departamento de &#c144,22,22!' + dep.name + '&#c!.'
    } else if (n.type === 'WRITER') {
      const subject = n.sex === 'M' ? 'El escritor ' : 'La escritora '
      message = subject + '&#c144,22,22!' + n.name + '&#c! nació en el departamento de &#c144,22,22!' + dep.name + '&#c!.'
    } else message = ''
    return message
  }
}

export class Notes {
  items: NoteItem[]
  constructor(items: NoteItem[]) { this.items = items }
}

export class NoteItem {
  name: string
  type: string
  distinction: string | null;
  /** campos de las subclases (para acceso genérico como en Python) */
  [k: string]: any
  constructor(name: string, type: string, distinction: string | null = null) {
    this.name = name
    this.type = type
    this.distinction = distinction
  }
  get_full_name() { return this.distinction ? `${this.name} (${this.distinction})` : this.name }
  get_departments(): Department[] { return [] }
}

export class RiverNote extends NoteItem {
  constructor(name: string, dep_list: Department[], len: string, basin: string, desc1: string, desc2: string | null) {
    super(name, 'RIVER')
    this.list_departments = dep_list
    this.length = len
    this.basin = basin
    this.description1 = desc1
    this.description2 = desc2
  }
  get_departments() { return this.list_departments as Department[] }
}

export class LagoonNote extends NoteItem {
  constructor(name: string, dep_list: Department[], surface: string, desc1: string, desc2: string | null) {
    super(name, 'LAGOON')
    this.list_departments = dep_list
    this.surface = surface
    this.description1 = desc1
    this.description2 = desc2
  }
  get_departments() { return this.list_departments as Department[] }
}

export class HillNote extends NoteItem {
  constructor(name: string, article: string, dep: Department, height: string, desc1: string, desc2: string | null) {
    super(name, 'HILL')
    this.department = dep
    this.article = article
    this.height = height
    this.description1 = desc1
    this.description2 = desc2
  }
  get_departments() { return [this.department as Department] }
}

export class HistoryFactNote extends NoteItem {
  constructor(s_start: string, article: string, name: string, dep_list: Department[], date: string, desc1: string, desc2: string | null) {
    super(name, 'HISTORY_FACT')
    this.sentence_start = s_start
    this.article = article
    this.list_departments = dep_list
    this.date = date
    this.description1 = desc1
    this.description2 = desc2
  }
  get_departments() { return this.list_departments as Department[] }
}

export class LocationNote extends NoteItem {
  constructor(name: string, dep: Department, loc_type: string, s_start: string, population: string, desc: string, distinction: string | null = null) {
    super(name, 'LOCATION', distinction)
    this.department = dep
    this.location_type = loc_type
    this.sentence_start = s_start
    this.population = population
    this.description = desc
  }
  get_departments() { return [this.department as Department] }
}

export class WriterNote extends NoteItem {
  constructor(name: string, sex: string, dep: Department, dates: string, desc: string) {
    super(name, 'WRITER')
    this.sex = sex
    this.department = dep
    this.dates = dates
    this.description = desc
  }
  get_departments() { return [this.department as Department] }
}

export class Witness {
  image: string
  name: string
  identikit_added = false
  department: Department | any = ''
  city: CityPin | any = ''
  witness_statement: any = null;
  [k: string]: any
  constructor(name: string, img: string) {
    this.image = img
    this.name = name
  }
}

export class JanitorStatement {
  type: number | null
  category1: any
  category2: any
  category3: any
  text: string | null
  thief_sex: number | null
  constructor(text: string | null = null, type: number | null = null, sex: number | null = null, cat1: any = null, cat2: any = null, cat3: any = null) {
    this.type = type
    this.category1 = cat1
    this.category2 = cat2
    this.category3 = cat3
    this.text = text
    this.thief_sex = sex
  }
}

export class Statement {
  text: string
  constructor(text: string) { this.text = text }
}

export class IdentikitStatement {
  text: string
  sex_feature: number
  height_feature: number
  hair_feature: number
  distinctive_feature: number
  constructor(text: string, sex_f: number, height_f: number, hair_f: number, distinctive_f: number) {
    this.text = text
    this.sex_feature = sex_f
    this.height_feature = height_f
    this.hair_feature = hair_f
    this.distinctive_feature = distinctive_f
  }
}

export class WitnessStatement {
  intro_statement: Statement
  janitor_statement: JanitorStatement
  location_statement: Statement | null
  identikit_statement: IdentikitStatement | null
  constructor(intro_s: Statement, j_s: JanitorStatement, i_s: IdentikitStatement | null, l_s: Statement | null = null) {
    this.intro_statement = intro_s
    this.janitor_statement = j_s
    this.location_statement = l_s
    this.identikit_statement = i_s
  }
  are_equal(s: WitnessStatement) {
    return this.intro_statement === s.intro_statement && this.janitor_statement === s.janitor_statement && this.location_statement === s.location_statement && this.identikit_statement === s.identikit_statement
  }
}

export class Thief {
  name: string
  nickname: string
  age: string
  description: string
  sex: number
  height: number
  hair: number
  distinctive_feature: number
  animal: Animal
  sport: Sport
  identikit_image: string
  identikit_large_image_side: string
  identikit_large_image_front: string
  phase3_image: string
  constructor(sex: number, height: number, hair: number, d_feature: number, pet: Animal, sport: Sport, name: string, nick: string, age: string, desc: string, i_img: string, i_l_img_f: string, i_l_img_s: string, i_p3_img: string) {
    this.name = name
    this.nickname = nick
    this.age = age
    this.description = desc
    this.sex = sex
    this.height = height
    this.hair = hair
    this.distinctive_feature = d_feature
    this.animal = pet
    this.sport = sport
    this.identikit_image = i_img
    this.identikit_large_image_side = i_l_img_s
    this.identikit_large_image_front = i_l_img_f
    this.phase3_image = i_p3_img
  }
}

export class CharacterInfo {
  active: boolean
  id: number
  name: string
  avatar: number
  sex: string
  location: string
  range_level: number
  constructor(active: boolean, id: number, name: string, avatar: number, sex: string, location: string, range_level: number) {
    this.active = active
    this.id = id
    this.name = name
    this.avatar = avatar
    this.sex = sex
    this.location = location
    this.range_level = range_level
  }
}

export class Character {
  charinfo: CharacterInfo
  department: Department
  uuid: string
  avatar_image: assets.Image
  avatar_rollover_image: assets.Image
  avatar_asleep_image: assets.Image
  avatar_asleep_pos: number[]
  constructor(charinfo: CharacterInfo, dep: Department, uuid: string) {
    this.charinfo = charinfo
    this.department = dep
    this.uuid = uuid
    let image_name = 'p0_detective_'
    image_name += charinfo.sex === 'M' ? 'male_' : 'female_'
    image_name += zpad(charinfo.avatar, 3)
    this.avatar_image = assets.load_image(image_name + '.png')
    this.avatar_rollover_image = assets.load_image(image_name + '_rollover.png')
    this.avatar_asleep_image = assets.load_image(image_name + '_asleep.png')
    const male: Record<number, number[]> = { 1: [77, 41], 2: [58, 58], 3: [79, 35], 4: [76, 44] }
    const female: Record<number, number[]> = { 1: [67, 51], 2: [47, 19], 3: [54, 42], 4: [70, 50] }
    const pos = (charinfo.sex === 'M' ? male : female)[charinfo.avatar]
    if (!pos) throw new Error('Missing asleep position')
    this.avatar_asleep_pos = pos
  }
}

export class HighscoreCharacter {
  constructor(public name: string, public uuid: string, public score: number) {}
}

export class CharacterProgress {
  character: Character
  score: number
  resolved_cases: number
  medals: Medal[]
  list_departments_solved: Department[]
  minigame_gardener_help_seen: boolean
  minigame_shoptender_help_seen: boolean | null
  minigame_librarian_help_seen: boolean
  minigame_bricklayer_help_seen: boolean
  phase2_help: boolean
  phase3_help: boolean
  identikit_help: boolean
  show_folder: boolean
  show_notes_animation: boolean
  notes: NoteItem[]
  new_notes: NoteItem[]
  bricklayer_pictures_seen: number[]
  case: Case | null = null
  last_help_step_seen: number
  range: Range
  captured_thieves: Thief[];
  [k: string]: any

  constructor(char: Character, score = 0, resolved_cases = 0, medals: Medal[] = [], l_dep_solved: Department[] = [], gardener_seen = false, shoptender_seen: boolean | null = false, librarian_seen = false, bricklayer_seen = false, phase2_help = false, phase3_help = false, identikit_help = false, show_folder = false, show_notes_animation = false, notes: NoteItem[] = [], new_notes: NoteItem[] = [], bricklayer_pictures_seen: number[] = [], last_help_step_seen = 0, captured_thieves: Thief[] = []) {
    this.character = char
    this.score = score
    this.resolved_cases = resolved_cases
    this.medals = medals
    this.list_departments_solved = l_dep_solved
    this.minigame_gardener_help_seen = gardener_seen
    this.minigame_shoptender_help_seen = shoptender_seen
    this.minigame_librarian_help_seen = librarian_seen
    this.minigame_bricklayer_help_seen = bricklayer_seen
    this.phase2_help = phase2_help
    this.phase3_help = phase3_help
    this.identikit_help = identikit_help
    this.show_folder = show_folder
    this.show_notes_animation = show_notes_animation
    this.notes = notes
    this.new_notes = new_notes
    this.bricklayer_pictures_seen = bricklayer_pictures_seen
    this.last_help_step_seen = last_help_step_seen
    this.range = new Range(this)
    this.captured_thieves = captured_thieves
  }

  set_case(c: Case | null) { this.case = c }

  add_medal(name: string) {
    for (const medal of this.medals) {
      if (medal.name === name) {
        if (medal.count < 999) medal.count += 1
        return
      }
    }
    this.medals.push(new Medal(name, 1))
  }
}

export class Range {
  private _character_progress: CharacterProgress
  level = 0
  next_range_cases: number | null = 3
  distance = 2
  time_limit_percentage = 2
  max_departments = 3
  minigame_level = 1
  constructor(character_progress: CharacterProgress) {
    this._character_progress = character_progress
    this.level = 0
    this.update()
  }
  update() {
    const rc = this._character_progress.resolved_cases
    const previous_level = this.level
    if (rc < 3) { this.level = 0; this.next_range_cases = 3; this.distance = 2; this.time_limit_percentage = 2; this.max_departments = 3; this.minigame_level = 1 }
    else if (rc < 6) { this.level = 1; this.next_range_cases = 6; this.distance = 3; this.time_limit_percentage = 1.8; this.max_departments = 5; this.minigame_level = 1 }
    else if (rc < 10) { this.level = 2; this.next_range_cases = 10; this.distance = 4; this.time_limit_percentage = 1.6; this.max_departments = 7; this.minigame_level = 2 }
    else if (rc < 14) { this.level = 3; this.next_range_cases = 14; this.distance = 5; this.time_limit_percentage = 1.4; this.max_departments = 10; this.minigame_level = 2 }
    else if (rc < 18) { this.level = 4; this.next_range_cases = 18; this.distance = 6; this.time_limit_percentage = 1.2; this.max_departments = 13; this.minigame_level = 3 }
    else { this.level = 5; this.next_range_cases = null; this.distance = 7; this.time_limit_percentage = 1; this.max_departments = 18; this.minigame_level = 3 }
    this._character_progress.character.charinfo.range_level = this.level
    return previous_level !== this.level
  }
}

export function get_range_name(level: number) {
  if (level === 0) return 'Agente'
  if (level === 1) return 'Oficial'
  if (level === 2) return 'Sub Comisario'
  if (level === 3) return 'Comisario'
  if (level === 4) return 'Inspector'
  return 'Inspector en jefe'
}

export class Medal {
  constructor(public name: string, public count: number) {}
}

export class Case {
  number: string | number | null
  last_department_lair: Department
  last_department_visited: Department
  crime_location: CrimeLocation
  stolen_object: StolenObject
  time_limit: number
  time_spend: number
  clues_found: any
  wrong_witness_visited: boolean
  thief: Thief
  arrest_order_thief: Thief | null
  clues_identified: boolean
  list_thieves: Thief[]
  list_witnesses: Witness[]
  list_witness_statements: WitnessStatement[]
  list_visited_witnesses: Witness[]
  list_folder_witnesses: Witness[]
  list_departments: Department[]
  list_target_cities: number[]
  list_posible_departments: Department[]
  thief_lair_set: any
  list_stage_clues: StageClue[]
  list_selected_features: number[]
  caught_thief: any
  thief_car_color: string | null;
  [k: string]: any

  constructor(n: any = null, ldl: any = null, ldv: any = null, cl: any = null, so: any = null, tl: any = null, ts: any = null, cf: any = null, wwv = false, t: any = null, aot: any = null, ci = false, list_t: Thief[] = [], list_w: Witness[] = [], list_ws: WitnessStatement[] = [], list_wv: Witness[] = [], list_wf: Witness[] = [], list_d: Department[] = [], list_tc: number[] = [], list_pd: Department[] = [], tls: any = 1, list_c: StageClue[] = [], list_sf: number[] = [], ct: any = null, tcc: string | null = null) {
    this.number = n
    this.last_department_lair = ldl
    this.last_department_visited = ldv
    this.crime_location = cl
    this.stolen_object = so
    this.time_limit = tl
    this.time_spend = ts
    this.clues_found = cf
    this.wrong_witness_visited = wwv
    this.thief = t
    this.arrest_order_thief = aot
    this.clues_identified = ci
    this.list_thieves = list_t
    this.list_witnesses = list_w
    this.list_witness_statements = list_ws
    this.list_visited_witnesses = list_wv
    this.list_folder_witnesses = list_wf
    this.list_departments = list_d
    this.list_target_cities = list_tc
    this.list_posible_departments = list_pd
    this.thief_lair_set = tls
    this.list_stage_clues = list_c
    this.list_selected_features = list_sf
    this.caught_thief = ct
    this.thief_car_color = tcc
    if (!this.time_spend) this.time_spend = 0
  }

  update_visited_witnesses(witness_visited: Witness) {
    if (!this.list_visited_witnesses.includes(witness_visited)) this.list_visited_witnesses.push(witness_visited)
  }

  actual_days(): [number, number] {
    const t = this.time_spend
    const days = Math.trunc(t / 8) + 1
    const hours = t + -8 * Math.trunc(t / 8) + 12
    return [days, hours]
  }

  get_turns(days: number, hour: number) { return (days - 1) * 8 + (hour - 12) }

  enough_time_left() { return this.time_limit > this.time_spend }

  static _turns_to_time(t: number): [number, number] { return [Math.trunc(t / 8) + 1, (((t % 8) + 8) % 8) + 12] }
  _turns_to_time(t: number) { return Case._turns_to_time(t) }

  get_time_limit() { return Case._turns_to_time(this.time_limit) }

  get_full_text(user_character: Character, user_character_progress: CharacterProgress) {
    const place_prep = this.crime_location.preposition
    const place = this.crime_location.name
    const stolen_obj_prep = this.stolen_object.preposition
    const stolen_obj = this.stolen_object.description1
    const stolen_obj2 = this.stolen_object.description2
    const sex = user_character_progress.case!.thief.sex === 1 ? 'Masculino' : 'Femenino'
    const department = this.crime_location.department.name
    const [days, hour] = Case._turns_to_time(this.time_limit)
    const time = 'día ' + days + ' a las ' + hour + ' horas '
    const agent = user_character.charinfo.name
    const text1 = 'Robo en '
    const text2 = ' de '
    const text3 = '.\n\nEl director del museo reportó la desaparición '
    const text4 = ' de su colección.\n\nVarios testigos afirman haber visto una silueta de aspecto sospechoso retirarse de la escena del crimen durante la noche, todos coinciden en que se trataba de una persona del sexo '
    const text5 = '.\n\nPor las características del caso se sospecha que sea otra fechoría de la organización criminal C.U.L.T. por lo que la Intendencia de '
    const text6 = ' se ha puesto en contacto con nuestra división para resolver este caso.\n\nContamos contigo para que encuentres al ladrón y devuelvas '
    const text7 = ' a su respectivo dueño antes del '
    const text8 = 'o será demasiado tarde para atraparlo.\n\nBuena suerte ' + text.to_lower(get_range_name(user_character_progress.range.level)) + '\n'
    const text9 = '!'
    const bh = '&#c149,0,0!'
    const eh = '&#c!'
    return text1 + place_prep + ' ' + bh + place + eh + text2 + bh + department + eh + text3 + stolen_obj_prep + ' ' + bh + stolen_obj + eh + text4 + bh + sex + eh + text5 + bh + department + eh + text6 + bh + stolen_obj2 + eh + text7 + bh + time + eh + text8 + bh + agent + eh + text9
  }
}

export class Animal {
  constructor(public name: string, public classification: number, public diet: number, public movement: number) {}
}

export class Sport {
  constructor(public name: string, public category: number, public team: boolean, public ball: boolean) {}
}
