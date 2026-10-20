#!/usr/bin/env node
/**
 * Build Ajarka Studio ke folder `build/`:
 *   1. unduh tarball @scratch/scratch-gui (versi DIKUNCI) dari npm, verifikasi sha512 integritas,
 *   2. ekstrak `package/dist/*` (bundle standalone UMD + chunks + static) ke build/,
 *   3. salin src/* (index.html, bridge.js, studio.css) ke build/.
 * Tidak ada modifikasi pada kode Scratch - Studio hanya membungkus bundle resmi.
 *
 *   node scripts/build.mjs
 *
 * Variabel lingkungan (opsional, dipakai build produksi / Dockerfile):
 *   STUDIO_OUT              folder hasil (default build/)
 *   STUDIO_PARENT_ORIGINS   daftar origin induk dipisah koma, menimpa parentOrigins di config.js
 *                           (produksi: https://ajarka.com,https://www.ajarka.com - tanpa localhost)
 *   STUDIO_PRECOMPRESS=1    tulis salinan .gz berkas teks untuk nginx gzip_static
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch.lock.json'), 'utf8'))
const CACHE = path.join(ROOT, '.cache')
const OUT = path.resolve(ROOT, process.env.STUDIO_OUT || 'build')

fs.mkdirSync(CACHE, { recursive: true })
const tgz = path.join(CACHE, `scratch-gui-${PIN.version}.tgz`)

if (!fs.existsSync(tgz)) {
  console.log(`unduh @scratch/scratch-gui@${PIN.version} ...`)
  const res = await fetch(PIN.tarball)
  if (!res.ok) throw new Error(`gagal unduh: ${res.status}`)
  fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()))
}

const digest = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(tgz)).digest('base64')
if (digest !== PIN.integrity) {
  fs.rmSync(tgz)
  throw new Error(`integritas tidak cocok untuk ${PIN.version}:\n  diharapkan ${PIN.integrity}\n  didapat    ${digest}`)
}
console.log('integritas tarball OK')

fs.rmSync(OUT, { recursive: true, force: true })
const tmp = path.join(CACHE, 'extract')
fs.rmSync(tmp, { recursive: true, force: true })
fs.mkdirSync(tmp, { recursive: true })
// Path relatif dari folder cache: GNU tar di Windows membaca "D:" sebagai host jarak jauh.
execFileSync('tar', ['-xzf', path.basename(tgz), '-C', 'extract', 'package/dist', 'package/LICENSE'], { cwd: CACHE, stdio: 'inherit' })
fs.cpSync(path.join(tmp, 'package/dist'), OUT, { recursive: true })
fs.copyFileSync(path.join(tmp, 'package/LICENSE'), path.join(OUT, 'SCRATCH-LICENSE.txt'))
const semuaBerkas = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? semuaBerkas(path.join(dir, e.name)) : [path.join(dir, e.name)]))
// Peta sumber tidak disajikan ke pengguna (besar); kode sumber tersedia di repo resmi + repo ini.
for (const f of semuaBerkas(OUT)) if (f.endsWith('.map')) fs.rmSync(f)
// Model MediaPipe (~14 MB) hanya dipakai ekstensi faceSensing, yang diblokir di config.js (privasi anak).
fs.rmSync(path.join(OUT, 'chunks', 'mediapipe'), { recursive: true, force: true })
// Studio memakai bundle standalone saja: build library (scratch-gui.js) dan tipe TS tidak disajikan.
for (const f of ['scratch-gui.js', 'scratch-gui.js.LICENSE.txt']) fs.rmSync(path.join(OUT, f), { force: true })
fs.rmSync(path.join(OUT, 'types'), { recursive: true, force: true })
for (const f of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(OUT, f))
fs.writeFileSync(path.join(OUT, 'versi.json'), JSON.stringify({ studio: PIN.studio, scratchGui: PIN.version }, null, 2))

const originEnv = (process.env.STUDIO_PARENT_ORIGINS || '').trim()
if (originEnv) {
  const origins = originEnv.split(',').map((o) => o.trim()).filter(Boolean)
  for (const o of origins) {
    if (new URL(o).origin !== o) throw new Error(`STUDIO_PARENT_ORIGINS: "${o}" bukan origin (tanpa path / garis miring akhir)`)
  }
  const cfgPath = path.join(OUT, 'config.js')
  const cfg = fs.readFileSync(cfgPath, 'utf8')
  const baru = cfg.replace(/parentOrigins:\s*\[[^\]]*\]/, `parentOrigins: ${JSON.stringify(origins)}`)
  if (baru === cfg) throw new Error('parentOrigins tidak ditemukan di config.js')
  fs.writeFileSync(cfgPath, baru)
  console.log(`parentOrigins: ${origins.join(', ')}`)
}

if (process.env.STUDIO_PRECOMPRESS === '1') {
  const TEKS = /\.(js|css|html|json|svg|txt)$/
  let n = 0
  for (const f of semuaBerkas(OUT)) {
    if (!TEKS.test(f) || fs.statSync(f).size < 1024) continue
    fs.writeFileSync(`${f}.gz`, zlib.gzipSync(fs.readFileSync(f), { level: 9 }))
    n++
  }
  console.log(`gzip_static: ${n} berkas .gz`)
}

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0)
console.log(`build/ siap: ${(size(OUT) / 1e6).toFixed(1)} MB (scratch-gui ${PIN.version})`)
