// Menú web (fuera del juego original): volumen, pantalla completa, cuenta de jugador y ranking.
import { useEffect, useState } from 'react'
import { useShell } from './shell.ts'
import { api, apiEnabled, ApiError, type RankRow } from '../net/api.ts'
import { setGameKeyboard } from './input.ts'

const RANKS = ['Agente', 'Oficial', 'Sub Comisario', 'Comisario', 'Inspector', 'Inspector en jefe']

export function Overlay() {
  const overlay = useShell((s) => s.overlay)
  const setOverlay = useShell((s) => s.setOverlay)
  useEffect(() => { setGameKeyboard(false); return () => setGameKeyboard(true) }, [])
  return (
    <div className="overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setOverlay('none') }}>
      <div className="panel">
        {overlay === 'menu' && <Menu />}
        {overlay === 'account' && <Account />}
        {overlay === 'ranking' && <Ranking />}
      </div>
    </div>
  )
}

function Menu() {
  const { settings, setSettings, setOverlay, session, cloud } = useShell()
  const full = () => {
    const d = document as Document & { webkitFullscreenElement?: Element }
    if (d.fullscreenElement || d.webkitFullscreenElement) void document.exitFullscreen?.()
    else void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {})
  }
  return (<>
    <h2>DED</h2>
    <label className="row">Música<input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => setSettings({ music: +e.target.value })} /></label>
    <label className="row">Sonidos<input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={(e) => setSettings({ sfx: +e.target.value })} /></label>
    <div className="buttons">
      <button type="button" onClick={full}>Pantalla completa</button>
      {apiEnabled && <button type="button" onClick={() => setOverlay('account')}>{session ? `Jugador: ${session.username}` : 'Cuenta de jugador'}</button>}
      {apiEnabled && <button type="button" onClick={() => setOverlay('ranking')}>Ranking</button>}
      <button type="button" className="primary" onClick={() => setOverlay('none')}>Volver al juego</button>
    </div>
    {session && <p className="note">{cloud === 'offline' ? 'Sin conexión con el servidor: el progreso queda guardado en este dispositivo.' : cloud === 'saving' ? 'Guardando en la nube…' : 'Progreso guardado en tu cuenta.'}</p>}
  </>)
}

function Account() {
  const { session, login, logout, setOverlay, cloud } = useShell()
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (register: boolean) => {
    setErr(''); setBusy(true)
    try { await login(name.trim(), pass, register) } catch (e) { setErr(e instanceof ApiError ? e.message : 'Ocurrió un error.') } finally { setBusy(false) }
  }
  const ok = name.trim().length >= 3 && pass.length >= 4 && !busy
  return (<>
    <h2>Cuenta de jugador</h2>
    {session ? (<>
      <p>¡Hola, <b>{session.username}</b>!</p>
      <p className="note">{cloud === 'offline' ? 'No hay conexión con el servidor: tus detectives quedan guardados en este dispositivo y se suben cuando vuelva.' : 'Tus detectives y su progreso se guardan en tu cuenta para seguir desde cualquier dispositivo.'}</p>
      <div className="buttons"><button type="button" onClick={logout}>Cerrar sesión</button></div>
    </>) : (<>
      <p className="note">Opcional: creá una cuenta para guardar tus casos en la nube y aparecer en el ranking. Sin cuenta, el juego se guarda en este dispositivo.</p>
      <label className="row">Nombre<input value={name} maxLength={24} autoCapitalize="off" autoComplete="username" onChange={(e) => setName(e.target.value)} /></label>
      <label className="row">Contraseña<input type="password" value={pass} maxLength={64} autoComplete="current-password" onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) void submit(false) }} /></label>
      {err && <p className="err">{err}</p>}
      <div className="buttons">
        <button type="button" disabled={!ok} onClick={() => void submit(false)}>Entrar</button>
        <button type="button" disabled={!ok} onClick={() => void submit(true)}>Crear cuenta</button>
      </div>
    </>)}
    <div className="buttons"><button type="button" className="primary" onClick={() => setOverlay('menu')}>Volver</button></div>
  </>)
}

function Ranking() {
  const { setOverlay, session } = useShell()
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.leaderboard(20).then(setRows).catch((e) => setErr(e instanceof ApiError ? e.message : 'Error')) }, [])
  return (<>
    <h2>Ranking de detectives</h2>
    {err ? <p className="err">{err}</p> : !rows ? <p className="note">Cargando…</p> : rows.length === 0 ? <p className="note">Todavía no hay detectives en el ranking.</p> : (
      <div className="scroll">
        <table className="rank">
          <thead><tr><th>#</th><th>Detective</th><th>Puntaje</th><th>Casos</th><th>Rango</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.rank} className={r.username === session?.username ? 'me' : ''}>
              <td>{r.rank}</td><td>{r.username}</td><td>{r.elo.toLocaleString('es-UY')}</td><td>{r.spots_won}</td><td>{RANKS[Math.max(0, Math.min(5, r.max_area - 1))]}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    )}
    <div className="buttons"><button type="button" className="primary" onClick={() => setOverlay('menu')}>Volver</button></div>
  </>)
}
