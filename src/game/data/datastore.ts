// Port de game/data/datastore.py. Los datos (departamentos, museos, objetos, ladrones, pistas,
// notas...) se generan en build desde el código original (scripts/extract_datastore.py ->
// src/data/datastore.json) y aquí se construyen con las mismas clases de datamodel.
import DATA from '../../data/datastore.json'
import * as assets from '../../framework/assets.ts'
import * as stats from '../../framework/stats.ts'
import * as datamodel from './datamodel.ts'
import * as serialization from './serialization.ts'
import { CharacterInfo } from './datamodel.ts'

type Raw = { cls: string; args: unknown[] } | { $ref: [string, number] } | unknown
const D = DATA as unknown as {
  constants: Record<string, any>
  order: string[]
  lists: Record<string, Raw[]>
  bordering_matrix: number[][]
  proximity_matrix: number[][]
}
const C = D.constants

// Los servidores originales: nunca se contactan desde la web (ver framework/web.ts)
export const BASE_REQUEST_URL: string = C.BASE_REQUEST_URL
export const UPDATE_URL = BASE_REQUEST_URL + 'update'
export const STATS_URL = BASE_REQUEST_URL + 'stats'
export const ERRORS_URL = BASE_REQUEST_URL + 'errors'
export const VERSION = 1.07
export const ARTIGAS: string = C.ARTIGAS
export const CANELONES: string = C.CANELONES
export const CERRO_LARGO: string = C.CERRO_LARGO
export const COLONIA: string = C.COLONIA
export const DURAZNO: string = C.DURAZNO
export const FLORES: string = C.FLORES
export const FLORIDA: string = C.FLORIDA
export const LAVALLEJA: string = C.LAVALLEJA
export const MALDONADO: string = C.MALDONADO
export const MONTEVIDEO: string = C.MONTEVIDEO
export const PAYSANDU: string = C.PAYSANDU
export const RIO_NEGRO: string = C.RIO_NEGRO
export const RIVERA: string = C.RIVERA
export const ROCHA: string = C.ROCHA
export const SALTO: string = C.SALTO
export const SAN_JOSE: string = C.SAN_JOSE
export const SORIANO: string = C.SORIANO
export const TACUAREMBO: string = C.TACUAREMBO
export const TREINTA_Y_TRES: string = C.TREINTA_Y_TRES
export const GENERICO: string = C.GENERICO
export const INDIGENA: string = C.INDIGENA
export const GAUCHO: string = C.GAUCHO
export const FOSILES: string = C.FOSILES
export const APARICIO_SARAVIA: string = C.APARICIO_SARAVIA
export const FABINI: string = C.FABINI
export const ARMAS: string = C.ARMAS
export const MONEDAS: string = C.MONEDAS
export const BLANES: string = C.BLANES
export const TORRES_GARCIA: string = C.TORRES_GARCIA
export const SOLARI: string = C.SOLARI
export const ARTE: string = C.ARTE
export const GARDEL: string = C.GARDEL
export const EUSEBIO_GIMENEZ: string = C.EUSEBIO_GIMENEZ
export const MALE = 1
export const FEMALE = 2
export const TALL = 1
export const SHORT = 2
export const BRUNETTE = 1
export const BLONDE = 2
export const REDHEAD = 3
export const GREY_HAIRED = 4
export const SCAR = 1
export const TATOO = 2
export const GLASSES = 3
export const MOLE = 4
export const SPORT = 1
export const PET = 2
export const MAMMAL = 1
export const BIRD = 2
export const REPTILE = 3
export const FISH = 4
export const HERBIVORE = 1
export const CARNIVORE = 2
export const WALK = 1
export const FLY = 2
export const SWIM = 3
export const AQUATIC = 1
export const TERRESTRIAL = 2
export const THIEF_CAR_COLORS: Record<string, string> = { violet: 'violeta', green: 'verde', blue: 'azul' }

const NOTE_TYPES = ['HISTORY_FACT', 'RIVER', 'LAGOON', 'HILL', 'LOCATION', 'WRITER', 'MUSICIAN']

/** Construye las listas de datos a partir del JSON extraído del código original. */
function buildLists(): Record<string, any[]> {
  const lists: Record<string, any[]> = {}
  const build = (v: any): any => {
    if (Array.isArray(v)) return v.map(build)
    if (v && typeof v === 'object') {
      if ('$ref' in v) {
        const [list, i] = v.$ref as [string, number]
        return lists[list][i]
      }
      if ('cls' in v) {
        const Cls = (datamodel as any)[v.cls]
        if (!Cls) throw new Error('Clase de datamodel desconocida: ' + v.cls)
        return new Cls(...v.args.map(build))
      }
    }
    return v
  }
  for (const name of D.order) lists[name] = D.lists[name].map(build)
  return lists
}

export class Datastore {
  wrong_witness_visited = false
  game: any
  list_departments!: datamodel.Department[]
  list_animals!: datamodel.Animal[]
  list_sports!: datamodel.Sport[]
  list_stolen_objects!: datamodel.StolenObject[]
  list_crime_locations!: datamodel.CrimeLocation[]
  list_thieves!: datamodel.Thief[]
  list_lair_sets!: number[][]
  list_witnesses!: datamodel.Witness[]
  list_statements!: datamodel.Statement[]
  list_identikit_statements!: datamodel.IdentikitStatement[]
  list_janitor_statements!: datamodel.JanitorStatement[]
  list_clue_types!: datamodel.ClueType[]
  list_clues!: datamodel.Clue[]
  list_rivers!: datamodel.RiverNote[]
  list_lagoons!: datamodel.LagoonNote[]
  list_hills!: datamodel.HillNote[]
  list_history_facts!: datamodel.HistoryFactNote[]
  list_locations!: datamodel.LocationNote[]
  list_writers!: datamodel.WriterNote[]
  notes_type_index!: Record<string, datamodel.NoteItem[]>
  /** defaultdict(defaultdict(list)): department_type_index[nombre_dep][tipo] -> notas */
  department_type_index!: Record<string, Record<string, datamodel.NoteItem[]>>
  characters: CharacterInfo[] = []
  max_char_id = 0
  user_character: datamodel.Character | null = null
  user_character_progress: datamodel.CharacterProgress | null = null
  user_character_stage: string | null = null
  highscores: Record<string, datamodel.HighscoreCharacter[]> | null = null
  highscores_pending_save = false

  constructor(game: any) {
    this.wrong_witness_visited = false
    this.set_up_data(game)
  }

  set_up_data(game: any) {
    this.game = game
    const l = buildLists()
    this.list_departments = l.list_departments
    this.list_animals = l.list_animals
    this.list_sports = l.list_sports
    this.list_stolen_objects = l.list_stolen_objects
    this.list_crime_locations = l.list_crime_locations
    this.list_thieves = l.list_thieves
    this.list_lair_sets = l.list_lair_sets
    this.list_witnesses = l.list_witnesses
    this.list_statements = l.list_statements
    this.list_identikit_statements = l.list_identikit_statements
    this.list_janitor_statements = l.list_janitor_statements
    this.list_clue_types = l.list_clue_types
    this.list_clues = l.list_clues
    this.list_rivers = l.list_rivers
    this.list_lagoons = l.list_lagoons
    this.list_hills = l.list_hills
    this.list_history_facts = l.list_history_facts
    this.list_locations = l.list_locations
    this.list_writers = l.list_writers
    this.notes_type_index = {
      HISTORY_FACT: this.list_history_facts, RIVER: this.list_rivers, LAGOON: this.list_lagoons,
      HILL: this.list_hills, LOCATION: this.list_locations, WRITER: this.list_writers,
    }
    this.department_type_index = {}
    for (const d of this.list_departments) {
      this.department_type_index[d.name] = {}
      for (const t of NOTE_TYPES) this.department_type_index[d.name][t] = []
    }
    const all: datamodel.NoteItem[] = [...this.list_history_facts, ...this.list_rivers, ...this.list_lagoons, ...this.list_hills, ...this.list_locations, ...this.list_writers]
    for (const note of all) {
      for (const department of note.get_departments()) {
        const byType = (this.department_type_index[department.name] ??= {})
        ;(byType[note.type] ??= []).push(note)
      }
    }
    this.load_characters()
    this.user_character = null
    this.highscores = null
  }

  load_characters() {
    const data = assets.load_data('characters.dat', ';', false, true, true)
    this.characters = []
    this.max_char_id = 0
    let active_character: CharacterInfo | null = null
    for (const character of data) {
      if (character.length >= 2) {
        try {
          const ci = new CharacterInfo(character[0] === '1', parseInt(character[1]), this.decode_name(character[2]), parseInt(character[3]), character[4], character[5], parseInt(character[6]))
          this.characters.push(ci)
          if (ci.active) active_character = ci
          if (ci.id > this.max_char_id) this.max_char_id = ci.id + 1
        } catch (e) {
          console.warn('Error reading characters')
          stats.report_error(null, e)
        }
      }
    }
    return active_character
  }

  save_characters() {
    const rows: string[][] = []
    for (const c of this.characters) rows.push([c.active ? '1' : '0', String(c.id), this.encode_name(c.name), String(c.avatar), c.sex, c.location, String(c.range_level)])
    assets.save_data('characters.dat', rows)
  }

  encode_name(s: string) { return s.replace(/\$/g, '$s').replace(/;/g, '$d') }
  decode_name(s: string) { return s.replace(/\$d/g, ';').replace(/\$s/g, '$') }

  create_character(name: string, is_male: boolean, avatar: number, location: string, set_active = true) {
    const sex = is_male ? 'M' : 'F'
    const id = this.max_char_id + 1
    this.max_char_id = id
    const charinfo = new CharacterInfo(set_active, id, name, avatar, sex, location, 0)
    if (set_active) for (const c of this.characters) c.active = false
    this.characters.push(charinfo)
    serialization.delete_character(charinfo.id)
    this.save_characters()
    return charinfo
  }

  load_character(charinfo: CharacterInfo) {
    const [c, cp, stage] = serialization.open_character(this, charinfo)
    this.user_character = c
    this.user_character_progress = cp
    this.user_character_stage = stage
  }

  delete_character(charinfo: CharacterInfo) {
    const i = this.characters.indexOf(charinfo)
    if (i >= 0) this.characters.splice(i, 1)
    this.save_characters()
    serialization.delete_character(charinfo.id)
  }

  save_character(stage: string | null, check_save_in_development: boolean) {
    serialization.save_character(this, this.user_character!, this.user_character_progress!, this.game, stage, check_save_in_development)
    this.game.stats.save_if_pending()
  }

  get_highscores() {
    if (this.highscores == null) this.load_highscores()
    return this.highscores!
  }

  load_highscores() {
    this.highscores = {}
    this.highscores_pending_save = false
    const data = assets.load_data('highscores.dat', ';', false, true, true)
    for (const line of data) {
      try {
        const category = line[0]
        if (category === undefined || category === '') continue
        const characters: datamodel.HighscoreCharacter[] = []
        let k = 1
        while (k < line.length) {
          const name = this.decode_name(line[k])
          const c_uuid = line[k + 1]
          const score = parseInt(line[k + 2])
          if (c_uuid === undefined || isNaN(score)) throw new Error('bad highscore line')
          characters.push(new datamodel.HighscoreCharacter(name, c_uuid, score))
          k += 3
        }
        this.highscores[category] = characters
      } catch (e) {
        console.warn('Error reading highscores')
        stats.report_error(null, e)
      }
    }
  }

  get_highscore_data() {
    const hs = this.get_highscores()
    const data: string[][] = []
    for (const [category, characters] of Object.entries(hs)) {
      const line = [category]
      for (const c of characters) line.push(this.encode_name(c.name), String(c.uuid), String(c.score))
      data.push(line)
    }
    return data
  }

  save_highscores() {
    if (this.highscores != null && this.highscores_pending_save) {
      assets.save_data('highscores.dat', this.get_highscore_data())
      this.highscores_pending_save = false
    }
  }

  add_score(category: string, character: datamodel.Character, score: number) {
    if (this.highscores == null) this.highscores = {}
    const hc = new datamodel.HighscoreCharacter(character.charinfo.name, character.uuid, score)
    if (!(category in this.highscores)) {
      this.highscores[category] = [hc]
      this.highscores_pending_save = true
    } else {
      const characters = this.highscores[category]
      let update_score = true
      for (let i = 0; i < characters.length; i++) {
        if (characters[i].uuid === character.uuid) {
          if (characters[i].score >= score) update_score = false
          else characters.splice(i, 1)
          break
        }
      }
      if (update_score) {
        let k = 0
        while (k < characters.length) {
          if (characters[k].score < score) break
          k += 1
        }
        characters.splice(k, 0, hc)
        if (characters.length > 10) characters.splice(10)
        this.highscores_pending_save = true
      }
    }
  }

  update_score_name(character: datamodel.Character) {
    if (this.highscores != null) {
      for (const characters of Object.values(this.highscores)) {
        for (const c of characters) {
          if (c.uuid === character.uuid) { c.name = character.charinfo.name; this.highscores_pending_save = true }
        }
      }
    }
  }

  get_clue_type(type: string) {
    for (const c of this.list_clue_types) if (c.type === type) return c
    throw new Error('Clue not found: ' + type)
  }

  generate_departments_bordering_matrix() { return D.bordering_matrix.map((r) => r.slice()) }
  generate_departments_proximity_matrix() { return D.proximity_matrix.map((r) => r.slice()) }
}
