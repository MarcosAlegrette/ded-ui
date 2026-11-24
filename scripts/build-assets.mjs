// Convierte el arte y el audio ORIGINAL de DED (../data/juego_ded) en assets web dentro de
// public/assets. No se redibuja nada: cada imagen se recodifica tal cual a WebP (las máscaras
// de colisión "$m"/"$x" y los GIF en modo sin pérdida, para que el test de píxeles sea exacto).
// El audio OGG original se copia tal cual y se agrega un MP3 de respaldo; los WAV se pasan a OGG + MP3.
// Genera además src/data/images.json (tamaños) y src/data/sounds.json (duraciones).
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.resolve(root, '../data/juego_ded')
const OUT = path.join(root, 'public/assets')
const META = path.join(root, 'src/data')
const force = process.argv.includes('--force')
const fresh = (src, dst) => !force && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs
fs.mkdirSync(path.join(OUT, 'images'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'sounds'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true })
fs.mkdirSync(META, { recursive: true })
let made = 0

async function pool(items, n, fn) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]) }))
}

// Nombre web seguro: los caracteres que no sean [A-Za-z0-9_.-] (p. ej. "$" de las máscaras o "+")
// se escriben como -XX (hex). La misma regla está en src/pg/surface.ts.
const webName = (f) => f.replace(/[^A-Za-z0-9_.]/g, (c) => '-' + c.charCodeAt(0).toString(16)) + '.webp'

async function images() {
  const dir = path.join(SRC, 'images')
  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|gif)$/i.test(f)).sort()
  const sizes = {}
  await pool(files, Math.max(2, os.cpus().length), async (f) => {
    const src = path.join(dir, f)
    const dst = path.join(OUT, 'images', webName(f))
    const img = sharp(src, { animated: false })
    const meta = await img.metadata()
    sizes[f] = [meta.width, meta.height]
    if (fresh(src, dst)) return
    const exact = f.includes('$') || /\.gif$/i.test(f) || meta.width * meta.height <= 48 * 48
    const jpg = /\.jpe?g$/i.test(f)
    await img.webp(exact ? { lossless: true, exact: true, effort: 5 } : jpg ? { quality: 86, effort: 5 } : { quality: 90, alphaQuality: 100, effort: 5, smartSubsample: true }).toFile(dst)
    made++
  })
  const sorted = Object.fromEntries(Object.keys(sizes).sort().map((k) => [k, sizes[k]]))
  fs.writeFileSync(path.join(META, 'images.json'), JSON.stringify(sorted))
  // Ícono y cursor del juego
  for (const f of ['icon.gif']) {
    const dst = path.join(root, 'public', 'icon.png')
    if (!fresh(path.join(SRC, f), dst)) {
      // el ícono usa magenta (255,0,255) como color transparente, igual que en engine.__set_icon
      const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      for (let i = 0; i < data.length; i += 4) if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255) data[i + 3] = 0
      await sharp(data, { raw: info }).png().toFile(dst)
      made++
    }
  }
}

function ffmpegAll(jobs) {
  return new Promise((resolve) => {
    let i = 0, running = 0, failed = 0
    const next = () => {
      if (i >= jobs.length && running === 0) return resolve(failed)
      while (running < Math.max(2, os.cpus().length - 1) && i < jobs.length) {
        const args = jobs[i++]
        running++
        const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'ignore' })
        p.on('close', (c) => { if (c) failed++; running--; made++; next() })
      }
    }
    next()
  })
}

function duration(file) {
  try {
    return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()
  } catch { return 0 }
}

async function sounds() {
  const dir = path.join(SRC, 'sounds')
  const jobs = []
  const durations = {}
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(/^(.*)\.(ogg|wav)$/i)
    if (!m) continue
    const src = path.join(dir, f), base = m[1]
    const ogg = path.join(OUT, 'sounds', base + '.ogg'), mp3 = path.join(OUT, 'sounds', base + '.mp3')
    durations[f] = Math.round(duration(src) * 1000) / 1000
    if (m[2].toLowerCase() === 'ogg') {
      if (!fresh(src, ogg)) { fs.copyFileSync(src, ogg); made++ }
    } else if (!fresh(src, ogg)) jobs.push(['-i', src, '-c:a', 'vorbis', '-strict', '-2', '-ac', '2', '-q:a', '5', ogg])
    if (!fresh(src, mp3)) jobs.push(['-i', src, '-codec:a', 'libmp3lame', '-b:a', /music|loop|intro|score/i.test(f) ? '128k' : '96k', mp3])
  }
  fs.writeFileSync(path.join(META, 'sounds.json'), JSON.stringify(durations))
  const failed = await ffmpegAll(jobs)
  if (failed) console.warn(`! ${failed} conversiones de ffmpeg fallaron`)
}

function fonts() {
  const dir = path.join(SRC, 'fonts')
  for (const f of fs.readdirSync(dir)) {
    const dst = path.join(OUT, 'fonts', f)
    if (!fresh(path.join(dir, f), dst)) { fs.copyFileSync(path.join(dir, f), dst); made++ }
  }
}

const t0 = Date.now()
fonts()
await images()
await sounds()
const size = execFileSync('du', ['-sh', OUT]).toString().split('\t')[0]
console.log(`assets listos: ${made} archivos generados en ${((Date.now() - t0) / 1000).toFixed(1)}s — public/assets pesa ${size}`)
