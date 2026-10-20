// Diagnosis cepat: apa locale di store Studio dan teks apa yang terbaca dari DOM.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = createRequire(path.resolve(ROOT, '../ajarka/projects/ajarka-web/package.json'))('playwright')
const s1 = await serve(path.join(ROOT, 'build'), 4101)
const b = await chromium.launch()
const p = await b.newPage()
await p.goto('http://localhost:4101/')
await p.waitForFunction(() => window.ajarkaStudio, null, { timeout: 60000 })
await p.waitForTimeout(3000)
const info = await p.evaluate(() => {
  const st = window.ajarkaStudio.store.getState()
  const t = document.body.textContent
  return {
    locale: st.locales && st.locales.locale,
    adaGerakan: /Gerakan/.test(t), adaBerkas: /Berkas/.test(t), adaKejadian: /Kejadian/.test(t),
    potongan: t.replace(/\s+/g, ' ').slice(0, 300),
    menu: [...document.querySelectorAll('[class*="menu-bar_menu-bar-item"]')].map((e) => e.textContent.trim()).filter(Boolean),
  }
})
console.log(JSON.stringify(info, null, 2))
await b.close()
s1.close()
