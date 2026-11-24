// Controles en pantalla para la persecución en auto: equivalen a las flechas del teclado.
import { useRef } from 'react'
import * as ev from '../pg/events.ts'

function press(key: number, down: boolean) {
  ev.setKey(key, down)
  ev.post({ type: down ? ev.KEYDOWN : ev.KEYUP, key, unicode: '', mod: 0 })
}

function Btn({ k, label, cls }: { k: number; label: string; cls: string }) {
  const held = useRef(false)
  const down = (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); if (!held.current) { held.current = true; press(k, true) } }
  const up = (e: React.PointerEvent) => { e.preventDefault(); if (held.current) { held.current = false; press(k, false) } }
  return <button type="button" className={`pad ${cls}`} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onContextMenu={(e) => e.preventDefault()}>{label}</button>
}

export function TouchPad({ floating = false }: { floating?: boolean }) {
  return (
    <div className={`touchpad ${floating ? 'floating' : ''}`}>
      <div className="steer">
        <Btn k={ev.K.K_LEFT} label="◀" cls="left" />
        <Btn k={ev.K.K_RIGHT} label="▶" cls="right" />
      </div>
      <div className="pedals">
        <Btn k={ev.K.K_DOWN} label="Freno" cls="brake" />
        <Btn k={ev.K.K_UP} label="Acelerar" cls="gas" />
      </div>
    </div>
  )
}
