/**
 * Konfigurasi Studio. Di produksi file ini ditimpa saat deploy (lihat README):
 * parentOrigins = origin halaman Ajarka yang boleh menyematkan dan mengendalikan Studio.
 */
window.STUDIO_CONFIG = {
  parentOrigins: ['https://ajarka.com', 'https://www.ajarka.com', 'http://localhost:3000', 'http://localhost:3100', 'http://localhost:4102'],
  /** Ekstensi yang dimatikan: kamera (privasi anak) dan yang mengirim data ke server luar. */
  blockedExtensions: ['videoSensing', 'faceSensing', 'text2speech', 'translate', 'microbit', 'ev3', 'wedo2', 'boost', 'gdxfor'],
  /** Item menu bar Scratch yang disembunyikan (teks berbahasa Indonesia + Inggris). Simpan ditangani Ajarka. */
  hiddenMenus: ['Berkas', 'File', 'Tutorial', 'Tutorials', 'Debug', 'Pengaturan', 'Settings'],
}
