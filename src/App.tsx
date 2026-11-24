// "Shell" web: escala el canvas de 600x450 (resolución nativa del juego) a la pantalla, traduce
// mouse/toque/teclado, y agrega lo que el original no tenía en la web: desbloqueo de audio,
// cuenta de jugador, ranking y controles táctiles para la persecución.
import { useEffect, useRef, useState } from 'react'
import { attachInput } from './ui/input.ts'
import { useShell } from './ui/shell.ts'
import { Overlay } from './ui/Overlay.tsx'
import { TouchPad } from './ui/TouchPad.tsx'
import { boot, type Booted } from './game/boot.ts'

function useViewport() {
  const measure = () => {
    const vw = window.innerWidth, vh = window.visualViewport?.height ?? window.innerHeight
    return { vw, vh, portrait: vw / vh < 1 }
  }
  const [v, setV] = useState(measure)
  useEffect(() => {
    const on = () => setV(measure())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.visualViewport?.removeEventListener('resize', on)
    }
  }, [])
  return v
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  const booted = useRef<Booted | null>(null)
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  const { vw, vh, portrait } = useViewport()
  const touchControls = useShell((s) => s.touchControls)
  const overlay = useShell((s) => s.overlay)
  const setOverlay = useShell((s) => s.setOverlay)
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  useEffect(() => {
    let cancelled = false
    void boot(canvasRef.current!, textRef.current!).then((b) => {
      if (cancelled) return
      booted.current = b
      attachInput(canvasRef.current!, b.game, textRef.current!)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  // Tamaño del canvas: ocupa todo lo posible manteniendo 4:3. En vertical deja lugar abajo para
  // la barra (y los controles táctiles de la persecución).
  const padH = portrait ? (touchControls ? 230 : 64) : 0
  const scale = Math.min(vw / 600, (vh - padH) / 450)
  const w = Math.floor(600 * scale), h = Math.floor(450 * scale)

  return (
    <div className={`shell ${portrait ? 'portrait' : 'landscape'}`}>
      <div className="stage-wrap" style={{ height: portrait ? vh - padH : vh }}>
        <canvas ref={canvasRef} className="game" width={600} height={450} style={{ width: w, height: h }} />
        {!started && (
          <button type="button" className="start" disabled={!ready} onClick={() => { setStarted(true); booted.current?.start() }}>
            <img src="/icon.png" alt="" />
            <span>{ready ? 'Tocá para empezar' : 'Cargando…'}</span>
            <small>División Especial de Detectives</small>
          </button>
        )}
        {touchControls && !portrait && coarse && <TouchPad floating />}
      </div>
      {portrait && (
        <div className="below" style={{ height: padH }}>
          {touchControls ? <TouchPad /> : null}
          <div className="bar">
            <button type="button" onClick={() => setOverlay('menu')}>☰ Menú</button>
            <span className="hint">Girá el celular para verlo más grande</span>
          </div>
        </div>
      )}
      {!portrait && started && <button type="button" className="menu-btn" aria-label="Menú" onClick={() => setOverlay('menu')}>☰</button>}
      {overlay !== 'none' && <Overlay />}
      <input ref={textRef} className="hidden-input" type="text" autoCapitalize="words" autoComplete="off" autoCorrect="off" spellCheck={false} aria-hidden="true" tabIndex={-1} />
    </div>
  )
}
