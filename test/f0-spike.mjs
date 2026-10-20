/**
 * Uji F0 Ajarka Studio (Playwright): bahasa, muat, ubah, simpan, muat ulang, blokir ekstensi,
 * mode lihat, ukuran transfer, waktu siap (normal dan CPU 4x lebih lambat).
 *
 *   node test/f0-spike.mjs   (butuh build/ dari scripts/build.mjs)
 * Playwright diambil dari node_modules proyek Ajarka (PLAYWRIGHT_FROM, default ../ajarka/projects/ajarka-web).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FROM = process.env.PLAYWRIGHT_FROM || path.resolve(ROOT, '../ajarka/projects/ajarka-web')
const { chromium } = createRequire(path.join(FROM, 'package.json'))('playwright')
const FIXTURE = path.resolve(ROOT, '../ajarka/docs/content/materi/petualang-kode/p01-halo-scratch/proyek-awal-p01.sb3')
const OUT = path.join(ROOT, 'test/hasil')
fs.mkdirSync(OUT, { recursive: true })
fs.copyFileSync(FIXTURE, path.join(ROOT, 'test/proyek-awal.sb3'))

const s1 = await serve(path.resolve(ROOT, process.env.STUDIO_OUT || 'build'), 4101)
const s2 = await serve(path.join(ROOT, 'test'), 4102)
const hasil = { cek: {}, ukur: {} }
const cek = (nama, ok, info) => { hasil.cek[nama] = { ok: !!ok, ...(info !== undefined ? { info } : {}) }; console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${nama}${info !== undefined ? '  ' + JSON.stringify(info) : ''}`) }
const tungguPesan = (page, type, n = 1, ms = 90000) => page.waitForFunction(([t, k]) => window.__pesan(t).length >= k, [type, n], { timeout: ms })

async function sesi(browser, { cpu = 1, label }) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  let bytes = 0
  page.on('response', async (r) => {
    if (!r.url().startsWith('http://localhost:4101')) return
    try {
      const len = Number((await r.allHeaders())['content-length'] || 0) || (await r.body()).length
      bytes += len
    } catch { /* halaman sudah ditutup */ }
  })
  const t0 = Date.now()
  await page.goto('http://localhost:4102/induk.html')
  await tungguPesan(page, 'studio:siap', 1, 180000)
  const siapMs = Date.now() - t0
  hasil.ukur[label] = { siapMs, transferStudioMB: +(bytes / 1e6).toFixed(2) }
  console.log(`ukur ${label}: siap ${siapMs} ms, transfer Studio ${(bytes / 1e6).toFixed(2)} MB`)
  return { ctx, page }
}

const browser = await chromium.launch()
try {
  // ---------- sesi normal: fungsi ----------
  const { ctx, page } = await sesi(browser, { label: 'normal' })
  const studio = page.frame({ url: /localhost:4101/ })


  await page.evaluate(() => window.__muatUrl('/proyek-awal.sb3', 'm1'))
  await tungguPesan(page, 'studio:termuat')
  await page.waitForTimeout(2500)
  // Catatan F0: sebelum proyek dimuat, nama kategori masih Inggris (Motion, Looks); setelah dimuat jadi Indonesia.
  // Alur Ajarka selalu langsung memuat proyek dan menutupi Studio sampai studio:termuat.
  const bahasa = await studio.waitForFunction(() => /Gerakan/.test(document.body.textContent) && /Kejadian/.test(document.body.textContent) && /Berkas/.test(document.body.textContent), null, { timeout: 30000 }).then(() => true).catch(() => false)
  cek('bahasa Indonesia setelah proyek dimuat (Gerakan, Kejadian, Berkas)', bahasa)
  cek('memuat proyek tidak dianggap perubahan oleh anak', (await page.evaluate(() => window.__pesan('studio:berubah').length)) === 0)
  const info = await studio.evaluate(() => {
    // akses VM lewat store yang sama dengan bridge (uji saja)
    const t = [...document.querySelectorAll('[class*="sprite-selector-item_sprite-name"]')].map((e) => e.textContent)
    return { sprite: t }
  })
  cek('proyek P1 termuat (sprite Kucing tampil)', info.sprite.includes('Kucing'), info)
  await page.screenshot({ path: path.join(OUT, '01-termuat.png') })

  // ubah proyek: ganti nama sprite lewat VM -> harus memicu studio:berubah
  const berubahSebelum = (await page.evaluate(() => window.__pesan('studio:berubah').length))
  const ok = await studio.evaluate(() => {
    const vm = window.ajarkaStudio.vm
    if (!vm) return false
    const k = vm.runtime.targets.find((t) => t.isOriginal && t.sprite.name === 'Kucing')
    vm.renameSprite(k.id, 'KucingAjarka')
    return true
  })
  cek('akses VM untuk uji', ok)
  await tungguPesan(page, 'studio:berubah', berubahSebelum + 1, 10000).catch(() => null)
  cek('perubahan memicu studio:berubah', (await page.evaluate(() => window.__pesan('studio:berubah').length)) > berubahSebelum)

  await page.evaluate(() => window.__kirim({ type: 'studio:minta-simpan', id: 's1' }))
  await tungguPesan(page, 'studio:simpan')
  const simpan = (await page.evaluate(() => window.__pesan('studio:simpan')))[0]
  const pj = JSON.parse(simpan.projectJson)
  const namaSprite = pj.targets.filter((t) => !t.isStage).map((t) => t.name)
  cek('simpan menyertakan thumbnail PNG', simpan.thumbBytes > 200, { thumbBytes: simpan.thumbBytes })
  cek('simpan mengembalikan .sb3 + project.json', simpan.sb3Bytes > 1000 && namaSprite.includes('KucingAjarka'), { sb3Bytes: simpan.sb3Bytes, namaSprite })

  // muat ulang hasil simpan ke Studio -> nama baru harus bertahan
  await page.evaluate(() => window.__muatTerakhir('m2'))
  await tungguPesan(page, 'studio:termuat', 2)
  const setelah = await studio.evaluate(() => [...document.querySelectorAll('[class*="sprite-selector-item_sprite-name"]')].map((e) => e.textContent))
  cek('bolak-balik muat-simpan-muat utuh', setelah.includes('KucingAjarka'), setelah)

  // blokir ekstensi kamera
  const blokir = await studio.evaluate(async () => {
    const vm = window.ajarkaStudio.vm
    try { await vm.extensionManager.loadExtensionURL('videoSensing'); return 'termuat' } catch (e) { return 'ditolak: ' + e.message }
  })
  cek('ekstensi kamera (videoSensing) diblokir', blokir.startsWith('ditolak'), blokir)
  const pen = await studio.evaluate(async () => {
    const vm = window.ajarkaStudio.vm
    try { await vm.extensionManager.loadExtensionURL('pen'); return 'termuat' } catch (e) { return 'ditolak: ' + e.message }
  })
  cek('ekstensi Pen tetap aktif', pen === 'termuat', pen)

  // origin asing ditolak: pesan dari halaman lain tidak boleh memuat proyek
  const asing = await browser.newPage()
  await asing.setContent('<iframe id="f" src="http://localhost:4101/"></iframe>')
  await asing.waitForTimeout(8000)
  const asingHasil = await asing.evaluate(() => new Promise((res) => {
    let dapat = []
    window.addEventListener('message', (e) => dapat.push(e.data && e.data.type))
    document.getElementById('f').contentWindow.postMessage({ type: 'studio:minta-simpan', id: 'x' }, '*')
    setTimeout(() => res(dapat), 3000)
  }))
  cek('perintah dari origin tidak sah diabaikan', !asingHasil.includes('studio:simpan'), asingHasil)
  await asing.close()
  await ctx.close()

  // ---------- mode lihat ----------
  const ctxL = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const pl = await ctxL.newPage()
  await pl.goto('http://localhost:4102/induk.html')
  await pl.evaluate(() => { document.getElementById('studio').src = 'http://localhost:4101/?mode=lihat' })
  await pl.waitForFunction(() => window.__pesan('studio:siap').some((m) => m.mode === 'lihat'), null, { timeout: 120000 })
  await pl.evaluate(() => window.__muatUrl('/proyek-awal.sb3', 'l1'))
  await tungguPesan(pl, 'studio:termuat')
  const sl = pl.frame({ url: /localhost:4101/ })
  const adaPalet = await sl.evaluate(() => !!document.querySelector('.blocklyFlyout, [class*="blocks_blocks"]'))
  cek('mode lihat tanpa palet blok', !adaPalet)
  await pl.screenshot({ path: path.join(OUT, '02-mode-lihat.png') })
  await ctxL.close()

  // ---------- performa CPU 4x lebih lambat (laptop kelas bawah) ----------
  const lambat = await sesi(browser, { cpu: 4, label: 'cpu4x' })
  await lambat.page.screenshot({ path: path.join(OUT, '03-cpu4x-siap.png') })
  await lambat.ctx.close()
} finally {
  await browser.close()
  s1.close()
  s2.close()
}
fs.writeFileSync(path.join(OUT, 'hasil-f0.json'), JSON.stringify(hasil, null, 2))
const gagal = Object.entries(hasil.cek).filter(([, v]) => !v.ok).map(([k]) => k)
console.log(gagal.length ? `\n${gagal.length} cek GAGAL: ${gagal.join('; ')}` : '\nSEMUA CEK LULUS')
process.exit(gagal.length ? 1 : 0)
