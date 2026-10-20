// Diagnosis: item menu bar, kelas logo, dan judul kartu di galeri ekstensi (bahasa Indonesia).
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = createRequire(path.resolve(ROOT, '../ajarka/projects/ajarka-web/package.json'))('playwright')
const s1 = await serve(path.join(ROOT, 'build'), 4111)
const MUAT = path.resolve(ROOT, '../ajarka/docs/content/materi/petualang-kode/p01-halo-scratch/proyek-awal-p01.sb3')
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1366, height: 768 } })
await p.goto('http://localhost:4111/')
await p.waitForFunction(() => window.ajarkaStudio, null, { timeout: 60000 })
await p.waitForTimeout(2500)
const menu = await p.evaluate(() => ({
  item: [...document.querySelectorAll('[class*="menu-bar_menu-bar-item"]')].map((e) => ({ teks: e.textContent.trim(), kelas: e.className })),
  logo: [...document.querySelectorAll('img[class*="logo"], [class*="scratch-logo"]')].map((e) => e.className),
  tombolEkstensi: [...document.querySelectorAll('[class*="extension-button"]')].map((e) => e.className),
}))
console.log(JSON.stringify(menu, null, 1))
await p.click('[class*="extension-button"]')
await p.waitForTimeout(2000)
const kartu = await p.evaluate(() => [...document.querySelectorAll('[class*="library-item_library-item"]')].map((e) => ({
  judul: (e.querySelector('[class*="library-item_library-item-title"]') || {}).textContent,
  gambar: (e.querySelector('img') || {}).src,
})))
console.log(JSON.stringify(kartu, null, 1))
await p.screenshot({ path: path.join(ROOT, 'test/hasil/galeri-ekstensi.png') })
await b.close()
s1.close()
