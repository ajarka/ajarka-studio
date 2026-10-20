# Ajarka Studio

Editor Scratch resmi ([`@scratch/scratch-gui`](https://www.npmjs.com/package/@scratch/scratch-gui), Scratch Foundation) yang disematkan di platform belajar [Ajarka](https://ajarka.com). Anak menyusun program blok di dalam Ajarka; karya tersimpan otomatis ke akunnya dan bisa dilihat gurunya.

Studio **tidak mengubah kode Scratch**. Studio hanya:
- memuat bundle standalone resmi (versi dikunci di [`scratch.lock.json`](scratch.lock.json), integritas sha512 diverifikasi saat build),
- memasang editor lewat API resmi `createStandaloneRoot` dengan bahasa Indonesia,
- menambahkan jembatan `postMessage` ([`src/bridge.js`](src/bridge.js)) untuk memuat dan menyimpan proyek dari halaman induk Ajarka,
- mematikan ekstensi kamera dan ekstensi yang mengirim data ke server luar ([`src/config.js`](src/config.js)).

## Arsitektur singkat

Studio berjalan di origin sendiri (`studio.ajarka.com`) sebagai iframe di halaman Ajarka. Studio **tidak pernah memegang token atau cookie Ajarka**: halaman induk yang memanggil API Ajarka, lalu mengirim/menerima file `.sb3` lewat pesan.

| Pesan | Arah | Isi |
|---|---|---|
| `studio:siap` | Studio -> induk | editor siap (`mode: edit/lihat`) |
| `studio:muat` | induk -> Studio | `{id, sb3: ArrayBuffer}` |
| `studio:termuat` | Studio -> induk | proyek selesai dimuat |
| `studio:berubah` | Studio -> induk | ada perubahan oleh pengguna sejak muat/simpan terakhir |
| `studio:minta-simpan` | induk -> Studio | `{id}` |
| `studio:simpan` | Studio -> induk | `{id, sb3: ArrayBuffer, projectJson, thumbnail: ArrayBuffer PNG 240x180 atau null}` |
| `studio:galat` | Studio -> induk | `{id, pesan}` |

Pesan hanya diterima dari origin di `parentOrigins` (`src/config.js`). Mode lihat untuk guru: `?mode=lihat`.

## Build & uji

```bash
node scripts/build.mjs        # unduh + verifikasi @scratch/scratch-gui, susun build/
node test/serve.mjs           # Studio :4101, induk tiruan :4102/induk.html
node test/f0-spike.mjs        # uji otomatis (Playwright)
```

## Lisensi

Kode di repo ini dilisensikan **GNU AGPL-3.0** ([LICENSE](LICENSE)), sama dengan Scratch editor yang dibungkusnya ([SCRATCH-LICENSE.txt](build/SCRATCH-LICENSE.txt) ikut disajikan bersama build). Scratch adalah proyek Scratch Foundation; "Scratch" dan logo Scratch adalah merek Scratch Foundation. Ajarka Studio tidak berafiliasi dengan maupun didukung oleh Scratch Foundation.
