// Genera los datos del juego en src/data a partir de los archivos ORIGINALES:
//  - data/*.tcs, *.tcl, *.tcd (formato "DAT!" + zlib) -> src/data/files.json, tal cual los devolvía
//    assets.load_data(): una lista de filas separadas por ';' (las palabras del bibliotecario van aparte
//    en src/data/words_*.json porque son grandes y sólo se cargan con ese minijuego)
//  - data/*.yaml (persecución en auto) -> src/data/yaml.json
//  - game/data/datastore.py recuperado (casos, ladrones, pistas, textos...) -> src/data/datastore.json
//    mediante scripts/extract_datastore.py (sólo parsea el código, no lo ejecuta)
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAME = path.resolve(root, '../data/juego_ded/data')
const META = path.join(root, 'src/data')

fs.mkdirSync(META, { recursive: true })


function loadData(file: string): string[][] {
  const raw = fs.readFileSync(file)
  const content = raw.subarray(0, 4).toString('latin1') === 'DAT!' ? zlib.inflateSync(raw.subarray(4)) : raw
  return content.toString('latin1').split('\n').map((line) => line.split(';'))
}

const files: Record<string, string[][]> = {}
for (const f of fs.readdirSync(GAME).sort()) {
  if (!/\.(tcs|tcl|tcd)$/.test(f)) continue
  const rows = loadData(path.join(GAME, f))
  if (f.endsWith('.tcd')) fs.writeFileSync(path.join(META, f.replace('.tcd', '') + '.json'), JSON.stringify(rows))
  else files[f] = rows
}
fs.writeFileSync(path.join(META, 'files.json'), JSON.stringify(files))

const yaml: Record<string, unknown> = {}
for (const f of fs.readdirSync(GAME).sort()) {
  if (!f.endsWith('.yaml')) continue
  yaml[f] = YAML.parse(fs.readFileSync(path.join(GAME, f)).toString('latin1'))
}
fs.writeFileSync(path.join(META, 'yaml.json'), JSON.stringify(yaml))

// Métricas de las fuentes TTF originales (tablas head/hhea) para reproducir los cálculos de SDL_ttf
const fonts: Record<string, { upm: number; yMax: number; yMin: number; asc: number; desc: number; gap: number }> = {}
const FONTS = path.resolve(root, '../data/juego_ded/fonts')
for (const f of fs.readdirSync(FONTS).sort()) {
  const b = fs.readFileSync(path.join(FONTS, f))
  const n = b.readUInt16BE(4)
  const tables: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16
    tables[b.toString('latin1', o, o + 4)] = b.readUInt32BE(o + 8)
  }
  const h = tables.head, hh = tables.hhea
  fonts[f] = { upm: b.readUInt16BE(h + 18), yMin: b.readInt16BE(h + 38), yMax: b.readInt16BE(h + 42), asc: b.readInt16BE(hh + 4), desc: b.readInt16BE(hh + 6), gap: b.readInt16BE(hh + 8) }
}
fs.writeFileSync(path.join(META, 'fonts.json'), JSON.stringify(fonts))

const py = ['/opt/homebrew/bin/python3.11', 'python3.11', 'python3'].find((p) => {
  try { execFileSync(p, ['-c', 'pass']); return true } catch { return false }
})
const SRC = path.join(root, '_original_src/py/game/data')
if (py && fs.existsSync(SRC)) {
  const out = execFileSync(py, ['-I', path.join(root, 'scripts/extract_datastore.py'), path.join(SRC, 'datastore.py'), path.join(SRC, 'datamodel.py'), path.join(META, 'datastore.json')])
  process.stdout.write(out)
} else if (!fs.existsSync(path.join(META, 'datastore.json'))) {
  throw new Error('Falta python3 o _original_src para generar src/data/datastore.json')
} else console.log('datastore.json ya generado (no se encontró python3); se conserva')

console.log(`datos listos: ${Object.keys(files).length} archivos de niveles, ${Object.keys(yaml).length} yaml`)
