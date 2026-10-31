// Uji origin induk sah (bridge.js originSah): persis + pola subdomain satu tingkat.
//   node test/origin.mjs
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../src/bridge.js', import.meta.url), 'utf8')
const fn = src.match(/function originSah\(o\) \{[\s\S]*?\n  \}\n/)[0]
const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8')
const reservedSubdomains = JSON.parse(config.match(/reservedSubdomains:\s*(\[[^\]]*\])/)[1].replace(/'/g, '"'))
const CFG = { parentOrigins: ['https://ajarka.com', 'https://www.ajarka.com', 'https://*.ajarka.com', 'http://localhost:3000'], reservedSubdomains }
const originSah = new Function('CFG', `${fn}; return originSah`)(CFG)
const kasus = [
  ['https://ajarka.com', true], ['https://www.ajarka.com', true], ['https://pastipintar.ajarka.com', true],
  ['http://localhost:3000', true], ['https://bimbel-contoh.ajarka.com', true],
  ['http://pastipintar.ajarka.com', false], ['https://a.b.ajarka.com', false], ['https://evilajarka.com', false],
  ['https://ajarka.com.evil.com', false], ['https://-x.ajarka.com', false], ['https://.ajarka.com', false], ['http://localhost:3001', false],
  ['https://cdn.ajarka.com', false], ['https://api.ajarka.com', false], ['https://hub.ajarka.com', false], ['https://studio.ajarka.com', false],
  ['https://staging.ajarka.com', false], ['https://cdnx.ajarka.com', true],
]
let gagal = 0
for (const [o, harap] of kasus) {
  const dapat = originSah(o)
  console.log(`${dapat === harap ? '✔' : '✖'} ${o} -> ${dapat}`)
  if (dapat !== harap) gagal++
}
if (gagal) process.exit(1)
