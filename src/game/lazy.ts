// Carga diferida por fase (code-splitting). Los módulos pesados (ciudad + minijuegos, casa del
// ladrón, persecución) se descargan en segundo plano mientras el jugador está en la oficina.
// El código portado los usa de forma sincrónica con need('phase2'); si por algún motivo todavía
// no llegaron, ensure() devuelve una promesa.
const loaders = {
  phase1: () => import('./stages/phase1.ts'),
  phase2: () => import('./stages/phase2.ts'),
  phase3: () => import('./stages/phase3.ts'),
}
type Loaders = typeof loaders
export type ModName = keyof Loaders
type Mod<K extends ModName> = Awaited<ReturnType<Loaders[K]>>

const loaded: Partial<{ [K in ModName]: Mod<K> }> = {}
const pending: Partial<Record<ModName, Promise<unknown>>> = {}

export function ensure<K extends ModName>(name: K): Promise<Mod<K>> {
  if (loaded[name]) return Promise.resolve(loaded[name] as Mod<K>)
  if (!pending[name]) pending[name] = loaders[name]().then((m) => { (loaded as any)[name] = m; return m })
  return pending[name] as Promise<Mod<K>>
}

export function need<K extends ModName>(name: K): Mod<K> {
  const m = loaded[name]
  if (!m) throw new Error(`Módulo ${name} todavía no cargado (usar ensure())`)
  return m as Mod<K>
}

export function isLoaded(name: ModName) { return !!loaded[name] }

/** Descarga en segundo plano todas las fases. */
export function prefetch() {
  return Promise.all((Object.keys(loaders) as ModName[]).map((n) => ensure(n).catch((e) => console.warn('No se pudo cargar', n, e))))
}
