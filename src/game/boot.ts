// Arranque: equivalente al main.py original (recuperado del PYTHONSCRIPT de main.exe):
//   g = Game("División Especial de Detectives", "cursor.png", "p0_loading.gif")
//   g.set_quit_on_escape(False); g.datastore = datastore.Datastore(g)
//   g.run(presentation.PresentationStage(g))
import { Game } from '../framework/engine.ts'
import { loadFonts } from '../pg/font.ts'
import { unlock } from '../pg/mixer.ts'
import * as assets from '../framework/assets.ts'
import { setFocusHook, ItemText } from '../framework/stage.ts'
import { Datastore } from './data/datastore.ts'
import { PresentationStage } from './stages/presentation.ts'
import { StartScreenStage } from './stages/startscreen.ts'
import { setSummary, setReload } from '../ui/shell.ts'

export interface Booted { game: Game; start: () => void }

export async function boot(canvas: HTMLCanvasElement, textInput: HTMLInputElement): Promise<Booted> {
  await loadFonts()
  const g = new Game(canvas, 'División Especial de Detectives', 'cursor.png', 'p0_loading.gif')
  g.set_quit_on_escape(false)
  g.datastore = new Datastore(g)
  // imágenes comunes que conviene tener listas desde el principio
  assets.preload_images(['p0_loading.gif', 'cursor.png'])
  setFocusHook((item) => {
    if (item instanceof ItemText && item.is_editable()) {
      textInput.value = ''
      textInput.focus({ preventScroll: true })
    } else if (document.activeElement === textInput) textInput.blur()
  })

  // Resumen del detective activo para la nube y el ranking
  setSummary(() => {
    const ds = g.datastore as Datastore
    const cp = ds.user_character_progress
    if (!cp) {
      // sin detective cargado: el mejor de los guardados en este dispositivo (sólo su rango)
      const best = Math.max(0, ...ds.characters.map((c) => c.range_level))
      return { elo: 0, gold: 0, max_area: best + 1, spots_won: 0, games_played: 0 }
    }
    const medals = cp.medals.reduce((s, m) => s + m.count, 0)
    return { elo: Math.max(0, cp.score), gold: medals, max_area: Math.min(100, cp.range.level + 1), spots_won: cp.resolved_cases, games_played: cp.resolved_cases }
  })
  // Cuando llegan datos de la nube: se releen los detectives y se vuelve al menú principal
  setReload(() => {
    const ds = g.datastore as Datastore
    ds.load_characters()
    ds.user_character = null
    ds.user_character_progress = null
    ds.highscores = null
    if (g.get_stage()) g.set_stage(new StartScreenStage(g, true))
  })

  if (import.meta.env.DEV) {
    // Ayudas de desarrollo: window.__ded.click(x, y) hace clic en coordenadas lógicas 600x450
    void import('../pg/events.ts').then((ev) => {
      const click = (x: number, y: number) => {
        ev.mouse.x = x; ev.mouse.y = y
        ev.post({ type: ev.MOUSEMOTION, pos: [x, y], rel: [0, 0], buttons: [0, 0, 0] })
        ev.mouse.buttons = [1, 0, 0]
        ev.post({ type: ev.MOUSEBUTTONDOWN, pos: [x, y], button: 1 })
        g.tickNow()
        ev.mouse.buttons = [0, 0, 0]
        ev.post({ type: ev.MOUSEBUTTONUP, pos: [x, y], button: 1 })
        g.tickNow()
      }
      const key = (k: number, unicode = '') => { ev.post({ type: ev.KEYDOWN, key: k, unicode, mod: 0 }); ev.post({ type: ev.KEYUP, key: k, mod: 0 }) }
      ;(window as any).__ded = { game: g, assets, ev, click, key, K: ev.K }
    })
  }
  return {
    game: g,
    start: () => {
      unlock()
      g.run(new PresentationStage(g))
    },
  }
}
