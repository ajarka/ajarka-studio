/**
 * Jembatan Ajarka Studio <-> halaman induk Ajarka (postMessage).
 *
 * Studio TIDAK pernah memegang token/cookie Ajarka: semua panggilan API dilakukan halaman induk.
 * Protokol (semua pesan berbentuk { type, ... }):
 *   Studio -> induk : studio:siap {versi}      editor siap menerima perintah
 *                     studio:termuat {id}       proyek selesai dimuat
 *                     studio:berubah            ada perubahan sejak simpan/muat terakhir
 *                     studio:simpan {id, sb3, projectJson}   hasil minta-simpan (sb3 = ArrayBuffer)
 *                     studio:galat {id, pesan}
 *   induk -> Studio : studio:muat {id, sb3}     muat proyek (ArrayBuffer .sb3)
 *                     studio:minta-simpan {id}  minta isi proyek saat ini
 * Mode lihat (guru): ?mode=lihat - pemutar saja, tanpa pengeditan.
 */
;(function () {
  'use strict'
  var CFG = window.STUDIO_CONFIG || { parentOrigins: [], blockedExtensions: [] }
  var GUI = window.GUI
  var params = new URLSearchParams(location.search)
  var lihat = params.get('mode') === 'lihat'
  var induk = null // origin induk yang sah, dikunci pada pesan pertama yang valid
  var vm = null
  var berubah = false
  // Memuat proyek ikut memicu PROJECT_CHANGED (juga sesaat setelah selesai) - bukan perubahan oleh anak.
  var sedangMuat = false
  var muatSelesai = 0
  var JEDA_SETELAH_MUAT = 1000

  function kirim(pesan, transfer) {
    if (window.parent === window) return
    // studio:siap belum tahu induknya: tidak berisi data sensitif, boleh ke '*'.
    window.parent.postMessage(pesan, induk || '*', transfer || [])
  }

  // ---------- pasang editor ----------
  var app = document.getElementById('app')
  GUI.setAppElement(app)
  var state = new GUI.EditorState({ locale: 'id', isPlayerOnly: lihat })
  var root = GUI.createStandaloneRoot(state, app)
  root.render({
    canSave: false,
    canEditTitle: false,
    canShare: false,
    canRemix: false,
    canCreateNew: false,
    backpackVisible: false,
    showComingSoon: false,
    isPlayerOnly: lihat,
    onClickLogo: function () {},
  })

  function ambilVm() {
    var s = state.store.getState()
    return s && s.scratchGui && s.scratchGui.vm
  }

  // ---------- rapikan menu bar (simpan & bantuan ditangani Ajarka) ----------
  function rapikanMenu() {
    var sembunyi = CFG.hiddenMenus || []
    var item = document.querySelectorAll('[class*="menu-bar_menu-bar-item"]')
    for (var i = 0; i < item.length; i++) {
      if (sembunyi.indexOf(item[i].textContent.trim()) !== -1) item[i].classList.add('ajarka-sembunyi')
    }
  }
  new MutationObserver(rapikanMenu).observe(app, { childList: true, subtree: true })

  // ---------- blokir ekstensi terlarang ----------
  function pasangBlokirEkstensi(v) {
    var em = v.extensionManager
    if (!em || em.__ajarkaBlokir) return
    var asli = em.loadExtensionURL.bind(em)
    em.loadExtensionURL = function (id) {
      if (CFG.blockedExtensions.indexOf(id) !== -1) {
        return Promise.reject(new Error('Ekstensi ' + id + ' tidak tersedia di Ajarka Studio'))
      }
      return asli(id)
    }
    em.__ajarkaBlokir = true
  }

  // ---------- tunggu VM siap ----------
  var tunggu = setInterval(function () {
    vm = ambilVm()
    if (!vm) return
    clearInterval(tunggu)
    pasangBlokirEkstensi(vm)
    // Untuk uji & diagnosis di origin Studio saja (induk lintas-origin tidak bisa mengaksesnya).
    window.ajarkaStudio = { vm: vm, store: state.store }
    vm.on('PROJECT_CHANGED', function () {
      if (sedangMuat || Date.now() - muatSelesai < JEDA_SETELAH_MUAT) return
      if (berubah) return
      berubah = true
      kirim({ type: 'studio:berubah' })
    })
    kirim({ type: 'studio:siap', versi: window.STUDIO_VERSI || null, mode: lihat ? 'lihat' : 'edit' })
  }, 50)

  // ---------- terima perintah dari induk ----------
  window.addEventListener('message', function (e) {
    if (CFG.parentOrigins.indexOf(e.origin) === -1) return
    if (e.source !== window.parent) return
    if (induk && e.origin !== induk) return
    induk = e.origin
    var m = e.data || {}
    if (!vm) return kirim({ type: 'studio:galat', id: m.id, pesan: 'editor belum siap' })

    if (m.type === 'studio:muat') {
      sedangMuat = true
      vm.loadProject(m.sb3)
        .then(function () {
          sedangMuat = false
          muatSelesai = Date.now()
          berubah = false
          kirim({ type: 'studio:termuat', id: m.id })
        })
        .catch(function (err) {
          sedangMuat = false
          kirim({ type: 'studio:galat', id: m.id, pesan: 'gagal memuat proyek: ' + (err && err.message) })
        })
    } else if (m.type === 'studio:minta-simpan') {
      vm.saveProjectSb3()
        .then(function (blob) { return blob.arrayBuffer() })
        .then(function (buf) {
          berubah = false
          kirim({ type: 'studio:simpan', id: m.id, sb3: buf, projectJson: vm.toJSON() }, [buf])
        })
        .catch(function (err) {
          kirim({ type: 'studio:galat', id: m.id, pesan: 'gagal menyimpan: ' + (err && err.message) })
        })
    }
  })
})()
