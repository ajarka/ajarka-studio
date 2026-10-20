/**
 * Server statis kecil untuk uji lokal: Studio (build/) di :4101 dan induk tiruan (test/) di :4102.
 * Dua port = dua origin, meniru studio.ajarka.com yang disematkan di ajarka.com.
 * Mendukung gzip bila klien meminta, supaya ukuran transfer bisa diukur realistis.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.sb3': 'application/octet-stream', '.hex': 'application/octet-stream', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.gif': 'image/gif', '.jpg': 'image/jpeg' }
const TEKS = new Set(['.html', '.js', '.css', '.json', '.svg'])

export function serve(dir, port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    let file = path.join(dir, decodeURIComponent(url.pathname))
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404') }
    const ext = path.extname(file)
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' }
    let body = fs.readFileSync(file)
    if (TEKS.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = zlib.gzipSync(body)
      headers['Content-Encoding'] = 'gzip'
    }
    res.writeHead(200, headers)
    res.end(body)
  })
  return new Promise((r) => server.listen(port, () => r(server)))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serve(path.join(ROOT, 'build'), 4101)
  await serve(path.join(ROOT, 'test'), 4102)
  console.log('Studio http://localhost:4101  ·  induk http://localhost:4102/induk.html')
}
