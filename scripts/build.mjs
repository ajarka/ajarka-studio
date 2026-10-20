#!/usr/bin/env node
/**
 * Build Ajarka Studio ke folder `build/`:
 *   1. unduh tarball @scratch/scratch-gui (versi DIKUNCI) dari npm, verifikasi sha512 integritas,
 *   2. ekstrak `package/dist/*` (bundle standalone UMD + chunks + static) ke build/,
 *   3. salin src/* (index.html, bridge.js, studio.css) ke build/.
 * Tidak ada modifikasi pada kode Scratch - Studio hanya membungkus bundle resmi.
 *
 *   node scripts/build.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch.lock.json'), 'utf8'))
const CACHE = path.join(ROOT, '.cache')
const OUT = path.join(ROOT, 'build')

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
// Peta sumber tidak disajikan ke pengguna (besar); kode sumber tersedia di repo resmi + repo ini.
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.map')) fs.rmSync(path.join(OUT, f))
// Studio memakai bundle standalone saja: build library (scratch-gui.js) dan tipe TS tidak disajikan.
for (const f of ['scratch-gui.js', 'scratch-gui.js.LICENSE.txt']) fs.rmSync(path.join(OUT, f), { force: true })
fs.rmSync(path.join(OUT, 'types'), { recursive: true, force: true })
for (const f of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(OUT, f))
fs.writeFileSync(path.join(OUT, 'versi.json'), JSON.stringify({ studio: PIN.studio, scratchGui: PIN.version }, null, 2))

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0)
console.log(`build/ siap: ${(size(OUT) / 1e6).toFixed(1)} MB (scratch-gui ${PIN.version})`)
