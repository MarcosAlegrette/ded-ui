// Ayudas para portar Python 2 fielmente (división entera, módulo, random, formato...).

/** a / b de Python 2 con enteros (división entera hacia -infinito). */
export const idiv = (a: number, b: number) => Math.floor(a / b)
/** a % b de Python (el signo sigue al divisor). */
export const pmod = (a: number, b: number) => ((a % b) + b) % b
/** int(x) de Python (trunca hacia cero). */
export const int = (x: number | string) => (typeof x === 'string' ? parseInt(x, 10) : Math.trunc(x))
/** round(x) de Python 2 (mitades lejos de cero). Devuelve número. */
export function pyround(x: number, n = 0) {
  const k = Math.pow(10, n)
  return (Math.sign(x) * Math.round(Math.abs(x) * k)) / k
}
export const range = (a: number, b?: number, step = 1): number[] => {
  if (b === undefined) { b = a; a = 0 }
  const out: number[] = []
  if (step > 0) for (let i = a; i < b; i += step) out.push(i)
  else for (let i = a; i > b; i += step) out.push(i)
  return out
}

// random de Python
export const random = () => Math.random()
/** randint(a, b) incluye ambos extremos */
export const randint = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
export const randrange = (a: number, b?: number, step = 1) => {
  if (b === undefined) { b = a; a = 0 }
  const n = Math.ceil((b - a) / step)
  return a + step * Math.floor(Math.random() * n)
}
export const uniform = (a: number, b: number) => a + (b - a) * Math.random()
export function choice<T>(seq: readonly T[]): T {
  if (seq.length === 0) throw new Error('IndexError: cannot choose from an empty sequence')
  return seq[Math.floor(Math.random() * seq.length)]
}
export function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
export function sample<T>(pop: readonly T[], k: number): T[] {
  if (k > pop.length) throw new Error('ValueError: sample larger than population')
  const a = pop.slice()
  shuffle(a)
  return a.slice(0, k)
}

/** '%03d' % n */
export const zpad = (n: number, w: number) => (n < 0 ? '-' : '') + String(Math.abs(Math.trunc(n))).padStart(w, '0')
/** str(x) de Python para números */
export const str = (x: unknown): string => {
  if (typeof x === 'boolean') return x ? 'True' : 'False'
  if (x == null) return 'None'
  return String(x)
}
/** list.remove(x) */
export function remove<T>(arr: T[], x: T) {
  const i = arr.indexOf(x)
  if (i < 0) throw new Error('ValueError: list.remove(x): x not in list')
  arr.splice(i, 1)
}
/** del arr[i] */
export const del = <T>(arr: T[], i: number) => arr.splice(i, 1)
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
export const upper = (s: string) => s.toUpperCase()
export const lower = (s: string) => s.toLowerCase()
/** Python "x in list" para tuplas/arrays por valor */
export const eqArr = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eqArr(x, b[i]))
  return a === b
}
