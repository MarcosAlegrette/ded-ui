// Estado del "shell" web (fuera del juego): menú, cuenta, nube, volumen y controles táctiles.
import { create } from 'zustand'
import { api, apiEnabled, ApiError, type ResultIn } from '../net/api.ts'
import * as assets from '../framework/assets.ts'
import { setVolumes } from '../pg/mixer.ts'

export type Overlay = 'none' | 'menu' | 'account' | 'ranking'
export interface Session { token: string; username: string }
export interface Summary { elo: number; gold: number; max_area: number; spots_won: number; games_played: number }

const TOK = 'ded.session', SET = 'ded.settings'
const read = <T,>(k: string, d: T): T => { try { const s = localStorage.getItem(k); return s ? { ...d, ...JSON.parse(s) } : d } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* modo privado */ } }

/** El juego registra cómo resumir su progreso para la nube/ranking. */
let summarize: () => Summary = () => ({ elo: 0, gold: 0, max_area: 1, spots_won: 0, games_played: 0 })
export function setSummary(f: () => Summary) { summarize = f }
/** El juego registra cómo recargar los datos guardados cuando llegan de la nube. */
let reloadGame: () => void = () => {}
export function setReload(f: () => void) { reloadGame = f }

interface State {
  overlay: Overlay
  touchControls: boolean
  session: Session | null
  cloud: 'idle' | 'saving' | 'saved' | 'offline'
  settings: { music: number; sfx: number }
  setOverlay: (o: Overlay) => void
  setTouchControls: (v: boolean) => void
  setSettings: (p: Partial<State['settings']>) => void
  login: (u: string, p: string, register: boolean) => Promise<void>
  logout: () => void
  syncDown: () => Promise<void>
  pushSoon: () => void
  report: (r: ResultIn) => void
}

let pushTimer: ReturnType<typeof setTimeout> | undefined

export const useShell = create<State>((set, get) => {
  const settings = read(SET, { music: 0.8, sfx: 1 })
  setVolumes(settings)
  let session: Session | null = null
  try { const s = apiEnabled ? localStorage.getItem(TOK) : null; session = s ? JSON.parse(s) : null } catch { session = null }
  return {
    overlay: 'none',
    touchControls: false,
    session,
    cloud: 'idle',
    settings,
    setOverlay: (overlay) => set({ overlay }),
    setTouchControls: (touchControls) => set({ touchControls }),
    setSettings: (p) => { const s = { ...get().settings, ...p }; write(SET, s); setVolumes(s); set({ settings: s }) },
    login: async (u, p, register) => {
      const out = register ? await api.register(u, p) : await api.login(u, p)
      const s = { token: out.access_token, username: out.user.username }
      write(TOK, s)
      set({ session: s })
      await get().syncDown()
    },
    logout: () => { try { localStorage.removeItem(TOK) } catch { /* nada */ } set({ session: null, cloud: 'idle' }) },
    // Al entrar: gana la partida con más progreso (la de la nube o la de este dispositivo)
    syncDown: async () => {
      const { session } = get()
      if (!session) return
      try {
        const cloud = await api.getSave(session.token)
        const local = summarize()
        const remote = cloud.data as { v?: number; files?: Record<string, string[][]> } | null
        const score = (s: { spots_won: number; elo: number }) => s.spots_won * 1e6 + s.elo
        if (remote?.v === 1 && remote.files && score(cloud) > score(local)) {
          assets.import_saved(remote.files)
          reloadGame()
          set({ cloud: 'saved' })
        } else get().pushSoon()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) get().logout()
        else set({ cloud: 'offline' })
      }
    },
    pushSoon: () => {
      const { session } = get()
      if (!session) return
      clearTimeout(pushTimer)
      set({ cloud: 'saving' })
      pushTimer = setTimeout(() => {
        const sum = summarize()
        api.putSave(session.token, { data: { v: 1, files: assets.export_saved() }, ...sum })
          .then(() => set({ cloud: 'saved' }))
          .catch((e) => { if (e instanceof ApiError && e.status === 401) get().logout(); else set({ cloud: 'offline' }) })
      }, 1200)
    },
    report: (r) => {
      const { session } = get()
      if (session) void api.postResult(session.token, r).catch(() => {})
    },
  }
})

// Cada vez que el juego guarda (personajes, progreso, récords) se sube a la nube si hay sesión
assets.setOnSave(() => useShell.getState().pushSoon())
