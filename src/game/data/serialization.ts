// Port de game/data/serialization.py: guardado/carga del detective (mismo formato de filas ';' que
// los c<id>.dat originales, ahora en localStorage) y generación aleatoria de casos (CaseGenerator).
import * as assets from '../../framework/assets.ts'
import * as datamodel from './datamodel.ts'
import { choice, shuffle } from '../../pg/py.ts'
import type { Datastore } from './datastore.ts'

const S = (x: unknown) => String(x)

export function new_uuid(): string {
  try { return crypto.randomUUID() } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16) })
  }
}

export function save_character(datastore: Datastore, c: datamodel.Character, cp: datamodel.CharacterProgress, _game: unknown, stage: string | null, _check: boolean) {
  const cd: string[][] = []
  const ds = datastore
  const cs = cp.case!
  if (stage != null) cd.push(['stage', stage])
  cd.push(['info', S(ds.list_departments.indexOf(c.department))])
  cd.push(['uuid', S(c.uuid)])
  cd.push(['casenum', S(cs.number)])
  cd.push(['lair', S(ds.list_departments.indexOf(cs.last_department_lair))])
  cd.push(['lastvisited', S(ds.list_departments.indexOf(cs.last_department_visited))])
  cd.push(['crimeloc', S(ds.list_crime_locations.indexOf(cs.crime_location))])
  cd.push(['stolenobj', S(ds.list_stolen_objects.indexOf(cs.stolen_object))])
  cd.push(['timelimit', S(cs.time_limit)])
  cd.push(['timespend', S(cs.time_spend)])
  const clues_found = ['cluesfound']
  if (Array.isArray(cs.clues_found)) for (const cf of cs.clues_found) clues_found.push(cf)
  cd.push(clues_found)
  cd.push(['wrongwitness', cs.wrong_witness_visited ? '1' : '0'])
  cd.push(['thief', S(ds.list_thieves.indexOf(cs.thief))])
  cd.push(['arrestorder', cs.arrest_order_thief != null ? S(ds.list_thieves.indexOf(cs.arrest_order_thief)) : '-1'])
  cd.push(['caughtthief', cs.caught_thief == null ? '-1' : S(Number(cs.caught_thief))])
  cd.push(['cluesidentified', cs.clues_identified ? '1' : '0'])
  cd.push(['thieves', ...cs.list_thieves.map((t) => S(ds.list_thieves.indexOf(t)))])
  cd.push(['departments', ...cs.list_departments.map((d) => S(ds.list_departments.indexOf(d)))])
  cd.push(['targetcities', ...cs.list_target_cities.map(S)])
  const witnesses = ['witnesses']
  let wit_dep: datamodel.Department | null = null
  let wit_dep_index = 0
  for (const w of cs.list_witnesses) {
    for (let i = 0; i < ds.list_witnesses.length; i++) {
      if (ds.list_witnesses[i].name === w.name) {
        if (wit_dep == null || !cs.list_departments[wit_dep_index].city_pins.includes(w.city)) {
          wit_dep_index = 0
          for (let j = 0; j < cs.list_departments.length; j++) {
            const d = cs.list_departments[j]
            if (d.city_pins.includes(w.city)) { wit_dep = d; wit_dep_index = j }
          }
        }
        witnesses.push(S(i), S(wit_dep_index), S(wit_dep!.city_pins.indexOf(w.city)))
        if (ds.list_statements.includes(w.witness_statement)) witnesses.push(S(ds.list_statements.indexOf(w.witness_statement)))
        else {
          let found = false
          for (let k = 0; k < cs.list_witness_statements.length; k++) {
            if (cs.list_witness_statements[k].are_equal(w.witness_statement)) { witnesses.push(S(-k - 1)); found = true; break }
          }
          if (!found) throw new Error('Statement not defined (' + S(w.witness_statement) + ')')
        }
      }
    }
  }
  cd.push(witnesses)
  const statements = ['statements']
  for (const s of cs.list_witness_statements) {
    const location = s.location_statement ? '1' : '-1'
    const identikit = s.identikit_statement ? S(ds.list_identikit_statements.indexOf(s.identikit_statement)) : '-2'
    statements.push(S(ds.list_statements.indexOf(s.intro_statement)), S(ds.list_janitor_statements.indexOf(s.janitor_statement)), location, identikit)
  }
  cd.push(statements)
  cd.push(['visitedwit', ...cs.list_visited_witnesses.map((w) => S(cs.list_witnesses.indexOf(w)))])
  cd.push(['folderwit', ...cs.list_folder_witnesses.map((w) => S(cs.list_witnesses.indexOf(w)))])
  cd.push(['posdepts', ...cs.list_posible_departments.map((d) => S(ds.list_departments.indexOf(d)))])
  const lair_set = ['thieflair', S(cs.thief_lair_set[0][0]), S(cs.thief_lair_set[0][1])]
  if (cs.thief_lair_set[1] != null) for (const item of cs.thief_lair_set[1]) lair_set.push(item[0], S(item[1]), S(item[2]))
  cd.push(lair_set)
  const clues = ['clues']
  for (const sc of cs.list_stage_clues) {
    clues.push(S(ds.list_clues.indexOf(sc.clue)))
    save_note(clues, sc.note_item, ds)
  }
  cd.push(clues)
  const sf = cs.list_selected_features
  cd.push(['selectedfeatures', S(sf[0]), S(sf[1]), S(sf[2]), S(sf[3])])
  cd.push(['depsolved', ...cp.list_departments_solved.map((d) => S(ds.list_departments.indexOf(d)))])
  cd.push(['mggardenerhelp', cp.minigame_gardener_help_seen ? '1' : '0'])
  cd.push(['mgshoptenderhelp', cp.minigame_shoptender_help_seen ? '1' : '0'])
  cd.push(['mglibrarianhelp', cp.minigame_librarian_help_seen ? '1' : '0'])
  cd.push(['mgbricklayerhelp', cp.minigame_bricklayer_help_seen ? '1' : '0'])
  cd.push(['phase2help', cp.phase2_help ? '1' : '0'])
  cd.push(['phase3help', cp.phase3_help ? '1' : '0'])
  cd.push(['identikithelp', cp.identikit_help ? '1' : '0'])
  cd.push(['showfolder', cp.show_folder ? '1' : '0'])
  cd.push(['shownotesanimation', cp.show_notes_animation ? '1' : '0'])
  cd.push(['score', S(cp.score)])
  cd.push(['resolvedcases', S(cp.resolved_cases)])
  const medals = ['medals']
  for (const m of cp.medals) medals.push(m.name, S(m.count))
  cd.push(medals)
  const notes = ['notes']
  for (const n of cp.notes) save_note(notes, n, ds)
  cd.push(notes)
  const new_notes = ['newnotes']
  for (const n of cp.new_notes) save_note(new_notes, n, ds)
  cd.push(new_notes)
  cd.push(['bricklayerpics', ...cp.bricklayer_pictures_seen.map(S)])
  cd.push(['lasthelpstep', S(cp.last_help_step_seen)])
  cd.push(['capturedthieves', ...cp.captured_thieves.map((t) => S(ds.list_thieves.indexOf(t)))])
  assets.save_data('c' + S(c.charinfo.id) + '.dat', cd)
}

/** Copia de phase1.generate_thief_location_statement (phase1 se carga en diferido). */
function generate_thief_location_statement(city: datamodel.CityPin) {
  let article = city.article
  if (article !== '') article += ' '
  return 'Mencionó que se estaba hospedando en\n' + article + '&#c144,22,22!&#f:bold!' + city.name + '&#f!&#c!.'
}

export function open_character(datastore: Datastore, charinfo: datamodel.CharacterInfo): [datamodel.Character, datamodel.CharacterProgress, string | null] {
  const ds = datastore
  const character_data = assets.load_data(get_character_file_name(charinfo.id), ';', false, true, true)
  if (character_data == null || character_data.length === 0) return create_new_character(datastore, charinfo)
  let c_uuid: string | null = null
  let stage: string | null = null
  let score = 0
  let resolved_cases = 0
  const medals: datamodel.Medal[] = []
  const bricklayer_pictures_seen: number[] = []
  const list_dep: datamodel.Department[] = []
  const list_dep_solved: datamodel.Department[] = []
  const list_target_cities: number[] = []
  const list_thieves: datamodel.Thief[] = []
  const list_sel_feat: number[] = []
  const list_posible_deps: datamodel.Department[] = []
  const list_wit_statements: datamodel.WitnessStatement[] = []
  const list_witnesses: datamodel.Witness[] = []
  const list_visited_witnesses: datamodel.Witness[] = []
  const list_folder_witnesses: datamodel.Witness[] = []
  let c_dep: datamodel.Department = ds.list_departments[0]
  let last_dep_lair = ds.list_departments[0]
  let last_dep_visited = ds.list_departments[0]
  let crime_loc = ds.list_crime_locations[0]
  let stolen_obj = ds.list_stolen_objects[0]
  let time_spend = 0
  let time_limit = 0
  let clues_found: any = 0
  const list_clues: datamodel.StageClue[] = []
  let thief_lair_set: any = 1
  let case_number: any = 0
  let gardener_help_seen = false
  let bricklayer_help_seen = false
  let shoptender_help_seen: boolean | null = null
  let last_help_step_seen = 0
  let phase2_help = false
  let phase3_help = false
  let identikit_help = false
  let show_folder = false
  let show_notes_animation = false
  let caught_thief: number | null = null
  let clues_identified = false
  let wrong_witness_visited = false
  let thief: datamodel.Thief | null = null
  let arrest_order_thief: datamodel.Thief | null = null
  const notes: datamodel.NoteItem[] = []
  const new_notes: datamodel.NoteItem[] = []
  const captured_thieves: datamodel.Thief[] = []
  const pending_witness_statements: [datamodel.Witness, number][] = []
  const I = (s: string) => parseInt(s, 10)
  for (const line of character_data) {
    const type = line[0]
    if (type === 'stage') stage = line[1]
    else if (type === 'info') c_dep = ds.list_departments[I(line[1])]
    else if (type === 'uuid') c_uuid = line[1]
    else if (type === 'casenum') case_number = line[1]
    else if (type === 'lair') last_dep_lair = ds.list_departments[I(line[1])]
    else if (type === 'lastvisited') last_dep_visited = ds.list_departments[I(line[1])]
    else if (type === 'crimeloc') crime_loc = ds.list_crime_locations[I(line[1])]
    else if (type === 'stolenobj') stolen_obj = ds.list_stolen_objects[I(line[1])]
    else if (type === 'timelimit') time_limit = I(line[1])
    else if (type === 'timespend') time_spend = I(line[1])
    else if (type === 'cluesfound') clues_found = line.slice(1)
    else if (type === 'wrongwitness') wrong_witness_visited = I(line[1]) === 1
    else if (type === 'thief') thief = ds.list_thieves[I(line[1])]
    else if (type === 'arrestorder') { const ti = I(line[1]); arrest_order_thief = ti === -1 ? null : ds.list_thieves[ti] }
    else if (type === 'thieves') for (const t of line.slice(1)) list_thieves.push(ds.list_thieves[I(t)])
    else if (type === 'departments') for (const d of line.slice(1)) list_dep.push(ds.list_departments[I(d)])
    else if (type === 'targetcities') for (const tc of line.slice(1)) list_target_cities.push(I(tc))
    else if (type === 'witnesses') {
      let k = 1
      while (k < line.length) {
        const wit_ori = ds.list_witnesses[I(line[k])]
        const witness = new datamodel.Witness(wit_ori.name, wit_ori.image)
        witness.department = list_dep[0]
        const dep_index = I(line[k + 1])
        witness.city = list_dep[dep_index].city_pins[I(line[k + 2])]
        pending_witness_statements.push([witness, I(line[k + 3])])
        list_witnesses.push(witness)
        k += 4
      }
    } else if (type === 'statements') {
      let k = 1
      while (k < line.length) {
        const intro_statement = ds.list_statements[I(line[k])]
        const janitor_statement = ds.list_janitor_statements[I(line[k + 1])]
        let location_statement: datamodel.Statement | null = null
        if (I(line[k + 2]) !== -1) {
          const city = list_dep[0].city_pins[list_target_cities[0]]
          location_statement = new datamodel.Statement(generate_thief_location_statement(city))
        }
        const identikit_statement = I(line[k + 3]) !== -2 ? ds.list_identikit_statements[I(line[k + 3])] : null
        list_wit_statements.push(new datamodel.WitnessStatement(intro_statement, janitor_statement, identikit_statement, location_statement))
        k += 4
      }
    } else if (type === 'visitedwit') for (const w of line.slice(1)) list_visited_witnesses.push(list_witnesses[I(w)])
    else if (type === 'folderwit') for (const w of line.slice(1)) list_folder_witnesses.push(list_witnesses[I(w)])
    else if (type === 'posdepts') for (const d of line.slice(1)) list_posible_deps.push(ds.list_departments[I(d)])
    else if (type === 'thieflair') {
      const set_elements = [I(line[1]), I(line[2])]
      let layout: [string, number, number][] | null = null
      if (line.length > 3) {
        layout = []
        let k = 3
        while (k < line.length) { layout.push([line[k], I(line[k + 1]), I(line[k + 2])]); k += 3 }
      }
      thief_lair_set = [set_elements, layout]
    } else if (type === 'clues') {
      let k = 1
      while (k < line.length) {
        const clue = ds.list_clues[I(line[k])]
        k += 1
        const [note_item, size] = read_note(line, k, ds)
        k += size
        list_clues.push(new datamodel.StageClue(clue, note_item))
      }
    } else if (type === 'selectedfeatures') list_sel_feat.push(I(line[1]), I(line[2]), I(line[3]), I(line[4]))
    else if (type === 'depsolved') for (const d of line.slice(1)) list_dep_solved.push(ds.list_departments[I(d)])
    else if (type === 'mggardenerhelp') gardener_help_seen = line[1] === '1'
    else if (type === 'mgshoptenderhelp') shoptender_help_seen = line[1] === '1'
    else if (type === 'mglibrarianhelp') { /* el original lo leía pero pasaba el valor del jardinero (ver abajo) */ }
    else if (type === 'mgbricklayerhelp') bricklayer_help_seen = line[1] === '1'
    else if (type === 'phase2help') phase2_help = line[1] === '1'
    else if (type === 'phase3help') phase3_help = line[1] === '1'
    else if (type === 'identikithelp') identikit_help = I(line[1]) === 1
    else if (type === 'showfolder') show_folder = I(line[1]) === 1
    else if (type === 'shownotesanimation') show_notes_animation = I(line[1]) === 1
    else if (type === 'score') score = I(line[1])
    else if (type === 'resolvedcases') resolved_cases = I(line[1])
    else if (type === 'medals') { let k = 1; while (k < line.length) { medals.push(new datamodel.Medal(line[k], I(line[k + 1]))); k += 2 } }
    else if (type === 'notes') { let k = 1; while (k < line.length) { const [n, s] = read_note(line, k, ds); k += s; notes.push(n) } }
    else if (type === 'newnotes') { let k = 1; while (k < line.length) { const [n, s] = read_note(line, k, ds); k += s; new_notes.push(n) } }
    else if (type === 'bricklayerpics') for (const p of line.slice(1)) bricklayer_pictures_seen.push(I(p))
    else if (type === 'lasthelpstep') last_help_step_seen = I(line[1])
    else if (type === 'caughtthief') {
      if (line[1] === '-1') caught_thief = null
      else {
        let value = line[1]
        if (value.startsWith('(')) value = value.slice(1, value.indexOf(','))
        caught_thief = I(value)
      }
    } else if (type === 'cluesidentified') clues_identified = I(line[1]) === 1
    else if (type === 'capturedthieves') {
      for (const t of line.slice(1)) { const ct = ds.list_thieves[I(t)]; if (!captured_thieves.includes(ct)) captured_thieves.push(ct) }
    }
  }
  for (const [witness, si] of pending_witness_statements) {
    witness.witness_statement = si >= 0 ? ds.list_statements[si] : list_wit_statements[-si - 1]
  }
  if (c_uuid == null) c_uuid = new_uuid()
  const char = new datamodel.Character(charinfo, c_dep, c_uuid)
  // (igual que el original: el flag del bibliotecario se carga con el valor del jardinero)
  const cp = new datamodel.CharacterProgress(char, score, resolved_cases, medals, list_dep_solved, gardener_help_seen, shoptender_help_seen, gardener_help_seen, bricklayer_help_seen, phase2_help, phase3_help, identikit_help, show_folder, show_notes_animation, notes, new_notes, bricklayer_pictures_seen, last_help_step_seen, captured_thieves)
  const c = new datamodel.Case(case_number, last_dep_lair, last_dep_visited, crime_loc, stolen_obj, time_limit, time_spend, clues_found, wrong_witness_visited, thief, arrest_order_thief, clues_identified, list_thieves, list_witnesses, list_wit_statements, list_visited_witnesses, list_folder_witnesses, list_dep, list_target_cities, list_posible_deps, thief_lair_set, list_clues, list_sel_feat, caught_thief)
  cp.set_case(c)
  return [char, cp, stage]
}

export function create_new_character(datastore: Datastore, charinfo: datamodel.CharacterInfo): [datamodel.Character, datamodel.CharacterProgress, string | null] {
  let dep = datastore.list_departments[0]
  for (const d of datastore.list_departments) if (d.name === charinfo.location) { dep = d; break }
  const char = new datamodel.Character(charinfo, dep, new_uuid())
  return [char, new datamodel.CharacterProgress(char), null]
}

export function get_character_file_name(char_id: number) { return 'c' + S(char_id) + '.dat' }

export function delete_character(char_id: number) { assets.delete_data(get_character_file_name(char_id)) }

export function save_note(list: string[], note: datamodel.NoteItem, datastore: Datastore) {
  const dep = note.get_departments()[0]
  const item_type = note.type
  list.push(S(datastore.department_type_index[dep.name][item_type].indexOf(note)))
  list.push(S(datastore.list_departments.indexOf(dep)))
  list.push(item_type)
}

export function read_note(line: string[], k: number, datastore: Datastore): [datamodel.NoteItem, number] {
  const note_index = parseInt(line[k], 10)
  const dep_index = parseInt(line[k + 1], 10)
  const note_item_type = line[k + 2]
  const dep_name = datastore.list_departments[dep_index].name
  return [datastore.department_type_index[dep_name][note_item_type][note_index], 3]
}

export class CaseGenerator {
  use_fixed_route = false
  datastore: Datastore
  private _seed = 0
  constructor(datastore: Datastore) { this.datastore = datastore }

  private get cp() { return this.datastore.user_character_progress! }

  new_case() {
    this._seed = Date.now() / 1000
    const last_department_visited = this.cp.character.department
    const last_department_lair = this.generate_case_department()
    const [list_departments, list_posible_departments] = this.generate_departments(last_department_lair)
    const list_target_cities = this.generate_target_cities(list_departments)
    const crime_location = this.generate_crime_location(last_department_lair)
    const stolen_object = this.generate_stolen_object(crime_location)
    const [thief, list_thieves] = this.generate_thiefs()
    const list_witnesses = this.generate_witnesses(list_departments)
    const time_limit = this.generate_time_limit(list_departments)
    const thief_lair_set = this.generate_thief_lair_set()
    const list_witness_statements = this.generate_witness_statements(thief, this.datastore)
    const case_number = this.generate_case_number()
    const list_clues = this.generate_clues(list_departments)
    return new datamodel.Case(case_number, last_department_lair, last_department_visited, crime_location, stolen_object, time_limit, 0, [], false, thief, null, false, list_thieves, list_witnesses, list_witness_statements, [], [], list_departments, list_target_cities, list_posible_departments, thief_lair_set, list_clues, [0, 0, 0, 0], null)
  }

  generate_thief_lair_set() { return [choice(this.datastore.list_lair_sets), null] }

  select_clue_types(notes: datamodel.NoteItem[], clues: datamodel.StageClue[], added_clues: datamodel.Clue[]): boolean {
    if (clues.length === 3) return true
    if (notes.length) {
      const list_clues = this.datastore.list_clues.slice()
      shuffle(list_clues)
      for (const clue of list_clues) {
        if (clue.list_types.map((t) => t.type).includes(notes[0].type) && !added_clues.includes(clue)) {
          clues.push(new datamodel.StageClue(clue, notes[0]))
          added_clues.push(clue)
          if (this.select_clue_types(notes.slice(1), clues, added_clues)) return true
          added_clues.pop()
          clues.pop()
        }
      }
    }
    return false
  }

  generate_department_clues(department: datamodel.Department) {
    const types = this.datastore.list_clue_types.slice()
    shuffle(types)
    const notes: datamodel.NoteItem[] = []
    for (const type of types) {
      if (type.type === 'MUSICIAN') continue
      const candidates = this.datastore.department_type_index[department.name][type.type] ?? []
      if (candidates.length) notes.push(choice(candidates))
      if (notes.length === 3) break
    }
    if (notes.length !== 3) throw new Error('Less notes:' + notes.length + ', seed: ' + this._seed + '; depart: ' + department.name)
    const clues: datamodel.StageClue[] = []
    const added_clues: datamodel.Clue[] = []
    if (!this.select_clue_types(notes, clues, added_clues)) throw new Error('Not enough clues, seed: ' + this._seed + '; depart: ' + department.name)
    if (new Set(added_clues).size !== added_clues.length) throw new Error('repeated clues, seed: ' + this._seed + '; depart: ' + department.name)
    return clues
  }

  generate_clues(list_departments: datamodel.Department[]) { return this.generate_department_clues(list_departments[1]) }

  generate_witness_statements(thief: datamodel.Thief, datastore: Datastore) {
    const list_identikit_statements: datamodel.IdentikitStatement[] = []
    const list_janitor_statements: datamodel.JanitorStatement[] = []
    const list_w_statements: datamodel.WitnessStatement[] = []
    const intro_statement = thief.sex === 1 ? datastore.list_statements[1] : datastore.list_statements[2]
    for (const s of datastore.list_identikit_statements) {
      if (thief.sex === s.sex_feature && thief.height === s.height_feature) list_identikit_statements.push(s)
      else if (thief.sex === s.sex_feature && thief.hair === s.hair_feature) list_identikit_statements.push(s)
      else if (thief.distinctive_feature === s.distinctive_feature) list_identikit_statements.push(s)
    }
    const take = (l: datamodel.JanitorStatement[]) => l.splice(l.indexOf(choice(l)), 1)[0]
    const selection = choice<any>([thief.animal, thief.sport])
    if (selection === thief.sport) {
      const list_sport_statements: datamodel.JanitorStatement[] = []
      for (const s of datastore.list_janitor_statements) {
        if (s.type === 1 && (s.category1 === thief.sport.category || s.category2 === thief.sport.team || s.category3 === thief.sport.ball) && (thief.sex === s.thief_sex || s.thief_sex === -1)) list_sport_statements.push(s)
      }
      for (let i = 0; i < 3; i++) list_janitor_statements.push(take(list_sport_statements))
    } else {
      const list_animal_statements: datamodel.JanitorStatement[] = []
      for (const s of datastore.list_janitor_statements) {
        if (s.type === 2 && (s.category1 === thief.animal.classification || s.category2 === thief.animal.diet || s.category3 === thief.animal.movement) && (thief.sex === s.thief_sex || s.thief_sex === -1)) list_animal_statements.push(s)
      }
      for (let i = 0; i < 3; i++) list_janitor_statements.push(take(list_animal_statements))
    }
    for (let i = 0; i < 3; i++) {
      const identikit_statement = list_identikit_statements[i] ?? null
      list_w_statements.push(new datamodel.WitnessStatement(intro_statement, list_janitor_statements[i], identikit_statement))
    }
    return list_w_statements
  }

  generate_case_number() {
    const first_7_digits = Math.floor(Math.random() * 9999999)
    const last_digit = Math.floor(Math.random() * 10)
    return S(first_7_digits) + '-' + S(last_digit)
  }

  generate_time_limit(list_departments: datamodel.Department[]) {
    const range = this.cp.range
    const minigame_turns = 1, thief_lair = 1, times_resolution = 1
    const basic_turns = (minigame_turns * 3 + thief_lair) * times_resolution
    let travel_turns = 0
    for (let i = 0; i < 1; i++) travel_turns += get_travel_turns(this.datastore, [list_departments[i], list_departments[i + 1]])
    return Math.trunc((basic_turns + travel_turns) * range.time_limit_percentage) + 1
  }

  generate_thiefs(): [datamodel.Thief, datamodel.Thief[]] {
    const possible = this.datastore.list_thieves.slice()
    const captured = this.cp.captured_thieves
    if (captured.length === possible.length) captured.splice(0, Math.floor(possible.length / 2))
    for (const t of captured) { const i = possible.indexOf(t); if (i >= 0) possible.splice(i, 1) }
    const case_thief = choice(possible)
    const thieves = this.datastore.list_thieves.filter((x) => x.sex === case_thief.sex)
    thieves.push(choice(this.datastore.list_thieves.filter((x) => x.sex !== case_thief.sex)))
    shuffle(thieves)
    return [case_thief, thieves]
  }

  generate_stolen_object(crime_location: datamodel.CrimeLocation) {
    const list: datamodel.StolenObject[] = []
    let so: datamodel.StolenObject | null = null
    for (const tl of crime_location.type_locations) {
      for (const o of this.datastore.list_stolen_objects) {
        if (o.type_location === tl) { list.push(o); so = choice(list) }
      }
    }
    return so!
  }

  generate_witnesses(list_departments: datamodel.Department[]) {
    const list_witnesses: datamodel.Witness[] = []
    const dep = list_departments[0]
    const list_pos_cities = dep.city_pins.slice()
    let witnesses: datamodel.Witness[] = []
    for (let i = 0; i < dep.city_pins.length; i++) {
      if (witnesses.length === 0) witnesses = this.datastore.list_witnesses.slice()
      const random_wit = choice(witnesses)
      witnesses.splice(witnesses.indexOf(random_wit), 1)
      const wit = new datamodel.Witness(random_wit.name, random_wit.image)
      wit.department = dep
      wit.city = list_pos_cities.splice(list_pos_cities.indexOf(choice(list_pos_cities)), 1)[0]
      wit.witness_statement = this.datastore.list_statements[0]
      list_witnesses.push(wit)
    }
    return list_witnesses
  }

  generate_crime_location(last_department_lair: datamodel.Department) {
    return choice(this.datastore.list_crime_locations.filter((c) => c.department === last_department_lair))
  }

  generate_case_department(): datamodel.Department {
    const list = this.datastore.list_departments.filter((d) => !this.cp.list_departments_solved.includes(d))
    if (list.length === 0) {
      this.cp.list_departments_solved = []
      return this.generate_case_department()
    }
    if (this.use_fixed_route) return list[8]
    return choice(list)
  }

  generate_departments(last_department_lair: datamodel.Department): [datamodel.Department[], datamodel.Department[]] {
    const IN_RANGE = true, OUT_OF_RANGE = false
    const pm = this.datastore.generate_departments_proximity_matrix()
    const range = this.cp.range
    let last_dep = last_department_lair
    const list_posible_deps: datamodel.Department[] = []
    const list_deps_to_visit: datamodel.Department[] = [last_department_lair]
    const list_border_deps = this.get_border_departments(last_dep)
    for (const d of list_border_deps) {
      if (this.department_in_range(pm, range, last_dep, d) && !list_deps_to_visit.includes(d)) list_posible_deps.push(d)
    }
    for (const d of list_posible_deps) list_border_deps.splice(list_border_deps.indexOf(d), 1)
    const pop = (l: datamodel.Department[]) => l.splice(l.indexOf(choice(l)), 1)[0]
    const tryAdd = (sel: datamodel.Department) => {
      if (list_posible_deps.length < range.max_departments && !list_posible_deps.includes(sel) && !list_deps_to_visit.includes(sel)) list_posible_deps.push(sel)
    }
    if (list_posible_deps.length > range.max_departments) {
      while (list_posible_deps.length > range.max_departments) list_posible_deps.splice(list_posible_deps.indexOf(choice(list_posible_deps)), 1)
    } else if (list_posible_deps.length < range.max_departments) {
      const pbd = this.generate_posible_departments(pm, range, list_deps_to_visit, list_posible_deps, last_dep, IN_RANGE)
      while (pbd.length > 0 && list_posible_deps.length < range.max_departments) tryAdd(pop(pbd))
      while (list_border_deps.length > 0 && list_posible_deps.length < range.max_departments) tryAdd(pop(list_border_deps))
      let guard = 0
      while (list_posible_deps.length < range.max_departments) {
        if (list_posible_deps.length === 17 && list_deps_to_visit.length === 2) break
        const pbd2 = this.generate_posible_departments(pm, range, list_deps_to_visit, list_posible_deps, last_dep, OUT_OF_RANGE)
        if (pbd2.length === 0 && ++guard > 50) break // (protección: el original podía quedar en bucle)
        while (pbd2.length > 0 && list_posible_deps.length < range.max_departments) tryAdd(pop(pbd2))
      }
    }
    last_dep = this.use_fixed_route ? list_posible_deps[0] : choice(list_posible_deps)
    list_deps_to_visit.push(last_dep)
    return [list_deps_to_visit, list_posible_deps]
  }

  generate_target_cities(deps: datamodel.Department[]) {
    return deps.map((d) => Math.floor(Math.random() * d.city_pins.length))
  }

  generate_posible_departments(pm: number[][], range: datamodel.Range, list_deps_to_visit: datamodel.Department[], list_deps_added: datamodel.Department[], last_dep: datamodel.Department, in_range: boolean) {
    const list_border_deps: datamodel.Department[] = []
    for (const d of list_deps_added) {
      for (const td of this.get_border_departments(d)) {
        if (!list_border_deps.includes(td) && !list_deps_added.includes(td) && !list_deps_to_visit.includes(td)) {
          if (in_range) { if (this.department_in_range(pm, range, last_dep, td)) list_border_deps.push(td) }
          else list_border_deps.push(td)
        }
      }
    }
    return list_border_deps
  }

  department_in_range(pm: number[][], _range: datamodel.Range, start_dep: datamodel.Department, end_dep: datamodel.Department) {
    const max = this.cp.range.distance
    const d = pm[this.datastore.list_departments.indexOf(start_dep)][this.datastore.list_departments.indexOf(end_dep)]
    return d <= max && d !== 0
  }

  get_border_departments(start_dep: datamodel.Department) {
    const bm = this.datastore.generate_departments_bordering_matrix()
    const p = this.datastore.list_departments.indexOf(start_dep)
    const out: datamodel.Department[] = []
    for (let i = 0; i < 19; i++) if (bm[p][i] === 1) out.push(this.datastore.list_departments[i])
    return out
  }
}

export function get_travel_turns(datastore: Datastore, list_deps: datamodel.Department[]) {
  const pm = datastore.generate_departments_proximity_matrix()
  return pm[datastore.list_departments.indexOf(list_deps[0])][datastore.list_departments.indexOf(list_deps[1])]
}
