/* =========================================================
   Perpustakaan Digital MTsS Nurul Kamal Sambirejo
   Dikembangkan oleh Okmansyah
   ========================================================= */
(function () {
'use strict';

// ==========================================================
// == PENGATURAN UTAMA ==
// ==========================================================
const URL_WEBAPP   = 'https://script.google.com/macros/s/AKfycbyOMWss6R-8AwAQccwBwqG8MusRPYGVv7MOk-90Z658RJnd3Aukd8t2dQA3j167lzBo/exec';

const SEKOLAH = {
    yayasan: 'YAYASAN NURUL KAMAL',
    nama: 'MTs SWASTA NURUL KAMAL SAMBIREJO',
    alamat: 'Desa Sambirejo, Kec. Selupu Rejang, Kab. Rejang Lebong, Bengkulu',
    singkat: 'MTsS Nurul Kamal Sambirejo'
};
const TTD_DEFAULT = {
    kamad: 'Hamida, S.Pd.I, M.Ag', kamadNip: '',
    kapus: 'Widia Nengsih, S.Pd', kapusNip: '',
    tempat: 'Sambirejo'
};
const IDLE_MENIT = 30;
const VERSI_WEB = 9;                       // naikkan setiap ada pembaruan (samakan dengan versi.json)
const IN_APP = !!(window.AndroidApp);      // berjalan di dalam APK Android
const CACHE_KEY = 'perpus_cache_v1';       // salinan data terakhir (untuk offline)
const OUTBOX_KEY = 'perpus_outbox_v1';     // antrean perubahan yang belum terkirim
const PWHASH_KEY = 'perpus_pw_hash';       // sidik password (untuk login saat offline)
const DENDA_KEY = 'perpus_denda_v1';       // salinan catatan denda terakhir
const FIELD_EKSTRA = ['isbn', 'kategori', 'rak', 'sumber', 'harga', 'kondisi', 'tahunTerbit'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BLN3 = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

// ==========================================================
// == STATE ==
// ==========================================================
const S = { buku: [], anggota: [], history: [], denda: [], dendaT: 0, settings: { LamaPinjamHari: 7, DendaPerHari: 1000 }, loaded: false, online: navigator.onLine, lastSync: 0, syncing: false };
let charts = {};
let pendingPage = null;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ==========================================================
// == UTIL ==
// ==========================================================
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rupiah(n) { return 'Rp ' + (Math.round(Number(n) || 0)).toLocaleString('id-ID'); }
function lamaPinjam() { return parseInt(S.settings.LamaPinjamHari, 10) || 7; }
function tarifDenda() { return parseInt(S.settings.DendaPerHari, 10) || 0; }

/** CSV parser yang benar (mendukung tanda kutip & koma di dalam sel). */
function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ''));
}

/** Membaca tanggal format Indonesia dd/mm/yyyy [hh:mm:ss] atau ISO. */
function parseTanggal(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    s = String(s).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    const d = new Date(s);
    return isNaN(d) ? null : d;
}
function tglPendek(d) { return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–'; }
function tglPanjang(d) { return d ? `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}` : '–'; }
function tglJam(d) { return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–'; }
function awalHari(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function selisihHari(a, b) { return Math.round((awalHari(a) - awalHari(b)) / 86400000); }

function toast(msg, type = 'info', ms = 4500, aksiLabel, aksiFn) {
    const ico = { ok: 'fa-circle-check', err: 'fa-circle-exclamation', info: 'fa-circle-info' }[type] || 'fa-circle-info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<i class="fa-solid ${ico}"></i><div>${esc(msg)}${aksiLabel ? `<div class="t-act"><button>${esc(aksiLabel)}</button></div>` : ''}</div>`;
    if (aksiLabel) $('button', el).addEventListener('click', () => { el.remove(); aksiFn && aksiFn(); });
    $('#toasts').appendChild(el);
    if (ms > 0) setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
}
async function sha256(t) {
    try {
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('perpus-nk:' + t));
        return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) { return null; }
}
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('Penyimpanan lokal gagal', e); } }
function tglSheet(d, jam) {
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` + (jam ? ` ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : '');
}
function busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text || 'Memproses...'}`; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

// ==========================================================
// == AUTENTIKASI ADMIN ==
// Password tidak pernah disimpan di kode. Dicek oleh server
// (Apps Script) dan hanya disimpan di sessionStorage selama sesi.
// ==========================================================
const AUTH_KEY = 'perpus_admin_pw', LAST_KEY = 'perpus_admin_last', AKUN_KEY = 'perpus_akun';
/** Akun yang sedang login: { user: '' (admin utama) / username petugas, nama, peran: 'admin' | 'petugas' } */
function getAkun() {
    try { const a = JSON.parse(sessionStorage.getItem(AKUN_KEY) || 'null'); if (a) return a; } catch (e) {}
    return { user: '', nama: 'Admin', peran: 'admin' };
}
function isSuperAdmin() { return isAdmin() && getAkun().peran === 'admin'; }
/** Data login yang ikut setiap permintaan ke server */
function kredensial() { const a = getAkun(); const d = { password: getPw() }; if (a.user) d.username = a.user; return d; }
/** Sidik password offline per akun */
function hashTersimpan() {
    const v = lsGet(PWHASH_KEY, null);
    if (typeof v === 'string') return { '': { h: v, nama: 'Admin', peran: 'admin' } };
    return v || {};
}
function getPw() {
    try {
        const pw = sessionStorage.getItem(AUTH_KEY);
        const last = +sessionStorage.getItem(LAST_KEY) || 0;
        if (pw && Date.now() - last > IDLE_MENIT * 60000) { logout(true); return null; }
        return pw;
    } catch (e) { return null; }
}
function isAdmin() { return !!getPw(); }
function touch() { try { if (sessionStorage.getItem(AUTH_KEY)) sessionStorage.setItem(LAST_KEY, Date.now()); } catch (e) {} }
function setAdminUI() {
    const on = isAdmin();
    const akun = getAkun();
    document.body.classList.toggle('is-admin', on);
    document.body.classList.toggle('is-superadmin', on && akun.peran === 'admin');
    document.body.classList.toggle('is-utama', on && !akun.user);
    $('#chip-admin').hidden = !on;
    $('#chip-admin span').innerHTML = on ? esc(akun.nama || akun.user || 'Admin') + (akun.peran === 'admin' ? '' : ' <small>petugas</small>') : 'Admin';
    $('#btn-auth').innerHTML = on ? '<i class="fa-solid fa-right-from-bracket"></i> <span>Keluar</span>' : '<i class="fa-solid fa-lock"></i> <span>Login Petugas</span>';
}
function logout(silent) {
    try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(LAST_KEY); sessionStorage.removeItem(AKUN_KEY); } catch (e) {}
    // Di browser umum (bukan APK), hapus data pribadi siswa dari perangkat saat keluar
    if (!IN_APP && S.loaded) {
        S.anggota = []; S.denda = []; S.dendaT = 0;
        S.history.forEach(h => { h.nis = ''; h.nama = ''; h.petugas = ''; });
        S.buku.forEach(b => { b.nis = ''; });
        simpanCache(); try { localStorage.removeItem(DENDA_KEY); } catch (e) {}
        renderSemua();
    }
    setAdminUI();
    if (!silent) toast('Anda telah keluar.', 'info');
    const cur = currentPage();
    if (isAdminPage(cur)) go('dashboard');
}
function bukaLogin(targetPage) {
    pendingPage = targetPage || null;
    $('#login-error').textContent = '';
    $('#login-pass').value = '';
    $('#modal-login').hidden = false;
    setTimeout(() => ($('#login-user').value ? $('#login-pass') : $('#login-user')).focus(), 50);
}
function tutupLogin() { $('#modal-login').hidden = true; pendingPage = null; }
function pwSalah(msg) { return /password|sandi/i.test(msg || '') && /salah|invalid|wrong|tidak valid/i.test(msg || ''); }

$('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#login-pass').value.trim();
    const user = $('#login-user').value.trim().toLowerCase();
    if (!pw) return;
    const btn = $('#btn-login');
    busy(btn, true, 'Memeriksa...');
    $('#login-error').textContent = '';
    const kirim = { action: 'login', password: pw }; if (user) kirim.username = user;
    const res = await kirimRaw(kirim);
    const hash = await sha256(user + '|' + pw);
    busy(btn, false);
    let offlineLogin = false, akun;
    const daftarHash = hashTersimpan();
    if (res._network) {
        // Tidak ada internet: cocokkan dengan sidik password dari login online terakhir akun ini
        const t = daftarHash[user];
        const hashLama = user ? null : await sha256(pw);   // sidik versi 2 (khusus admin utama)
        if (!t) { $('#login-error').textContent = 'Sedang offline. Login pertama kali untuk akun ini harus saat online.'; return; }
        if (!hash || (hash !== t.h && hashLama !== t.h)) { $('#login-error').textContent = 'Password salah (dicek offline). Coba lagi.'; $('#login-pass').select(); return; }
        akun = { user, nama: t.nama || user || 'Admin', peran: t.peran || 'petugas' };
        offlineLogin = true;
    } else {
        if (pwSalah(res.message)) { $('#login-error').textContent = user ? 'Username atau password salah.' : 'Password salah. Coba lagi.'; $('#login-pass').select(); return; }
        if (res.status !== 'success' && !/tidak dikenal/i.test(res.message || '')) { $('#login-error').textContent = res.message || 'Gagal login.'; return; }
        akun = { user, nama: res.nama || (user || 'Admin'), peran: res.peran || (user ? 'petugas' : 'admin') };
        if (hash) { daftarHash[user] = { h: hash, nama: akun.nama, peran: akun.peran }; lsSet(PWHASH_KEY, daftarHash); }
    }
    try { sessionStorage.setItem(AUTH_KEY, pw); sessionStorage.setItem(LAST_KEY, Date.now()); sessionStorage.setItem(AKUN_KEY, JSON.stringify(akun)); } catch (er) {}
    const target = pendingPage;
    tutupLogin();
    setAdminUI();
    toast((offlineLogin ? 'Masuk sebagai ' : 'Berhasil masuk sebagai ') + akun.nama + (offlineLogin ? ' (mode offline).' : '.'), 'ok');
    muatDenda();
    if (target) go(target);
    if (!offlineLogin) sinkron({ muat: true });
});
$('#btn-login-batal').addEventListener('click', tutupLogin);
$('#pw-eye').addEventListener('click', () => {
    const i = $('#login-pass'); i.type = i.type === 'password' ? 'text' : 'password';
    $('#pw-eye i').className = i.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
});
$('#btn-auth').addEventListener('click', () => isAdmin() ? logout() : bukaLogin(null));
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
setInterval(() => { if (sessionStorage.getItem(AUTH_KEY) && !getPw()) toast('Sesi login berakhir karena tidak aktif.', 'info'); }, 60000);

// ==========================================================
// == BACKEND (Apps Script) ==
// ==========================================================
async function kirimRaw(data) {
    try {
        const res = await fetch(URL_WEBAPP, { method: 'POST', body: JSON.stringify(data) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (err) {
        console.error('Backend error:', err);
        return { status: 'error', _network: true, message: 'Gagal terhubung ke server. Periksa koneksi internet atau deployment Apps Script.' };
    }
}
// ==========================================================
// == ANTREAN OFFLINE & SINKRONISASI ==
// Setiap perubahan dicatat dulu di antrean (outbox) dan langsung
// diterapkan ke data lokal. Antrean dikirim ke server saat online.
// ==========================================================
function outbox() { return lsGet(OUTBOX_KEY, []); }
function simpanOutbox(list) { lsSet(OUTBOX_KEY, list); }
const hasilOp = {}, menunggu = new Set();

/** Terapkan satu perubahan ke data lokal (optimistis). */
const RECENT_KEY = 'perpus_terkirim_v1';
function adaRiwayat(inv, aksi, w) {
    return S.history.some(h => h.noInv === inv && h.aksi.toLowerCase().startsWith(aksi) && h.tgl && Math.abs(h.tgl - w) < 20 * 60000);
}
function terapkanOp(op, pending = true) {
    const d = op.data, w = new Date(op.waktu);
    const b = d.noInventaris ? bukuByInv(d.noInventaris) : null;
    switch (d.action) {
        case 'pinjamBuku': {
            if (!b || (isDipinjam(b) && (!b.nis || b.nis === d.nis))) return;
            const a = anggotaByNis(d.nis) || {};
            const jt = new Date(w); jt.setDate(jt.getDate() + lamaPinjam());
            Object.assign(b, { status: 'Dipinjam', nis: d.nis, tglPinjamRaw: tglSheet(w, true), jatuhTempoRaw: tglSheet(jt) });
            if (!adaRiwayat(b.noInv, 'dipinjam', w)) S.history.push({ ts: tglSheet(w, true), tgl: w, noInv: b.noInv, judul: b.judul, nis: d.nis, nama: a.nama || '', aksi: 'Dipinjam', pending });
            break;
        }
        case 'kembalikanBuku': {
            if (!b || !isDipinjam(b)) return;
            const info = pinjamanAktif().find(p => p.buku.noInv === b.noInv);
            if (!adaRiwayat(b.noInv, 'dikembalikan', w)) S.history.push({ ts: tglSheet(w, true), tgl: w, noInv: b.noInv, judul: b.judul, nis: info ? info.nis : b.nis, nama: info ? info.nama : '', aksi: 'Dikembalikan', pending });
            Object.assign(b, { status: 'Tersedia', nis: '', tglPinjamRaw: '', jatuhTempoRaw: '' });
            break;
        }
        case 'tambahBuku': {
            const m = (d.buku.range || '').match(/^(\d+)\s*-\s*(\d+)$/);
            if (!m) return;
            const pad = m[1].length, a1 = Math.min(+m[1], +m[2]), a2 = Math.max(+m[1], +m[2]);
            for (let i = a1; i <= a2; i++) {
                const inv = String(i).padStart(pad, '0') + d.buku.suffix;
                if (!bukuByInv(inv)) { const nb = { noInv: inv, judul: d.buku.judul, pengarang: d.buku.pengarang, penerbit: d.buku.penerbit, status: 'Tersedia', nis: '', tglPinjamRaw: '', jatuhTempoRaw: '', tglMasukRaw: tglSheet(w), pending: true }; FIELD_EKSTRA.forEach(f => nb[f] = d.buku[f] || ''); S.buku.push(nb); }
            }
            break;
        }
        case 'updateBuku': {
            const x = bukuByInv(d.buku.noInventaris);
            if (x) { Object.assign(x, { judul: d.buku.judul, pengarang: d.buku.pengarang, penerbit: d.buku.penerbit }); FIELD_EKSTRA.forEach(f => { if (d.buku[f] !== undefined) x[f] = d.buku[f]; }); }
            break;
        }
        case 'bayarDenda': {
            S.denda.forEach(x => {
                const cocok = d.idDenda ? x.idDenda === d.idDenda : x.nis === d.nis;
                if (cocok && !/^lunas$/i.test(x.status)) Object.assign(x, { status: 'Lunas', tglBayar: new Date(w).toISOString(), diterimaOleh: getAkun().nama, pending });
            });
            break;
        }
        case 'hapusBuku': S.buku = S.buku.filter(x => x.noInv !== d.noInventaris); break;
        case 'tambahAnggota': if (!anggotaByNis(d.anggota.nis)) S.anggota.push({ ...d.anggota, pending: true }); break;
        case 'updateAnggota': { const x = anggotaByNis(d.anggota.nis); if (x) Object.assign(x, d.anggota); break; }
        case 'hapusAnggota': S.anggota = S.anggota.filter(x => x.nis !== d.nis); break;
        case 'simpanPengaturan': S.settings.LamaPinjamHari = d.settings.lamaPinjam; S.settings.DendaPerHari = d.settings.denda; break;
    }
}

/** Jalankan perubahan: simpan ke antrean, terapkan lokal, lalu coba kirim. */
async function aksi(data) {
    if (!getPw()) { bukaLogin(currentPage()); return { status: 'error', message: 'Silakan login terlebih dahulu.' }; }
    const op = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), waktu: Date.now(), data, akun: getAkun().user };
    const list = outbox(); list.push(op); simpanOutbox(list);
    menunggu.add(op.id);
    terapkanOp(op);
    simpanCache();
    renderSetelahUbah();
    await sinkron();
    menunggu.delete(op.id);
    if (hasilOp[op.id]) { const r = hasilOp[op.id]; delete hasilOp[op.id]; return r; }
    return { status: 'pending', message: 'Tersimpan di HP. Akan dikirim otomatis saat online.' };
}

/** Kirim seluruh antrean ke server secara berurutan. */
async function sinkron(opsi = {}) {
    if (S.syncing) return;
    let list = outbox();
    if (!list.length) { if (opsi.muat) { await muatSemua(); muatDenda(); } return; }
    const pw = getPw();
    if (!pw) { updateSyncUI(); if (opsi.manual) { toast(`${list.length} perubahan menunggu. Login untuk mengirimnya.`, 'info'); bukaLogin(null); } return; }
    S.syncing = true; updateSyncUI();
    let terkirim = 0, latar = 0, gagal = 0, offline = false;
    while (list.length) {
        const op = list[0];
        // waktu = saat transaksi terjadi di perangkat; idTransaksi = mencegah tercatat dua kali
        const res = await kirimRaw({ ...op.data, ...kredensial(), waktu: op.waktu, idTransaksi: op.id });
        if (res._network) { offline = true; break; }
        if (pwSalah(res.message)) {
            S.syncing = false;
            logout(true); bukaLogin(currentPage());
            $('#login-error').textContent = 'Password telah berubah. Silakan login ulang untuk mengirim antrean.';
            updateSyncUI(); return;
        }
        list.shift(); simpanOutbox(list);
        if (menunggu.has(op.id)) hasilOp[op.id] = res; else if (res.status === 'success') latar++;
        if (res.status === 'success') {
            terkirim++;
            // Simpan sebentar agar tetap tampil walau data server dimuat sebelum perubahan selesai ditulis
            const rc = lsGet(RECENT_KEY, []).filter(x => Date.now() - x.sentAt < 15 * 60000);
            rc.push({ op, sentAt: Date.now() }); lsSet(RECENT_KEY, rc);
        }
        else { gagal++; toast(`Gagal disinkron (${op.data.action}): ${res.message || 'ditolak server'}`, 'err', 9000); }
    }
    S.syncing = false;
    S.online = !offline;
    updateSyncUI();
    if (latar) toast(`${latar} perubahan dari mode offline berhasil dikirim ke server.`, 'ok', 4000);
    if (terkirim || gagal || opsi.muat) await muatSemua({ diam: true });
    if (terkirim || opsi.muat) muatDenda();
}

function updateSyncUI() {
    const n = outbox().length;
    const chip = $('#sync-chip'), txt = $('#sync-text');
    chip.className = 'sync-chip ' + (S.syncing ? 'syncing pending' : !S.online ? 'offline' : n ? 'pending' : 'online');
    const jam = S.lastSync ? new Date(S.lastSync).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
    txt.textContent = S.syncing ? 'Menyinkron...' : !S.online ? (n ? `Offline · ${n} antre` : 'Offline') : n ? `${n} menunggu` : (jam ? `Online · ${jam}` : 'Online');
    chip.title = (S.online ? 'Online' : 'Offline — perubahan disimpan di perangkat') + (n ? ` · ${n} perubahan menunggu sinkron` : '') + (S.lastSync ? ` · data terakhir diperbarui ${new Date(S.lastSync).toLocaleString('id-ID')}` : '') + ' — klik untuk sinkron sekarang';
    const bd = $('#badge-antrean'); bd.textContent = n; bd.hidden = n === 0;
}
$('#sync-chip').addEventListener('click', () => sinkron({ manual: true, muat: true }));
window.addEventListener('online', () => { S.online = true; updateSyncUI(); sinkron({ muat: true }); });
window.addEventListener('offline', () => { S.online = false; updateSyncUI(); });
setInterval(() => { if (outbox().length && navigator.onLine) sinkron(); }, 60000);
setInterval(() => { if (navigator.onLine && !S.syncing && document.visibilityState === 'visible') muatSemua({ diam: true }); }, 5 * 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) sinkron({ muat: true }); });

/** Pesan hasil aksi untuk ditampilkan ke pengguna. */
function laporHasil(res, pesanOk) {
    if (res.status === 'success') toast(res.message || pesanOk || 'Berhasil.', 'ok', 5000);
    else if (res.status === 'pending') toast((pesanOk ? pesanOk + ' ' : '') + 'Mode offline: tersimpan di perangkat, akan dikirim otomatis saat online.', 'info', 6000);
    else toast(res.message || 'Gagal memproses.', 'err', 7000);
    return res.status !== 'error';
}
function renderSetelahUbah() { isiDatalist(); renderStats(); updateSyncUI(); }

// ==========================================================
// == MEMUAT DATA ==
// ==========================================================
/**
 * Ambil data dari server (Apps Script).
 * - Sudah login: data lengkap (anggota, riwayat dengan nama siswa).
 * - Belum login: data publik tanpa NIS/nama siswa (katalog & statistik).
 */
async function ambilDataServer() {
    if (getPw()) {
        const r = await kirimRaw({ action: 'ambilData', ...kredensial() });
        if (r._network) throw new Error('offline');
        if (r.status === 'success') return r;
        if (pwSalah(r.message)) logout(true);
        else throw new Error(r.message || 'Gagal mengambil data');
    }
    const res = await fetch(URL_WEBAPP + '?aksi=publik&t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.status !== 'success') throw new Error(j.message || 'Gagal mengambil data');
    return j;
}

function simpanCache() {
    lsSet(CACHE_KEY, {
        t: S.lastSync, buku: S.buku, anggota: S.anggota, settings: S.settings,
        history: S.history.map(h => ({ ...h, tgl: h.tgl ? h.tgl.getTime() : null }))
    });
}
function muatCache() {
    const c = lsGet(CACHE_KEY, null);
    if (!c) return false;
    S.buku = c.buku || []; S.anggota = c.anggota || []; S.settings = { ...S.settings, ...(c.settings || {}) };
    S.history = (c.history || []).map(h => ({ ...h, tgl: h.tgl ? new Date(h.tgl) : null }));
    S.lastSync = c.t || 0;
    return true;
}

let muatBerjalan = null;
function muatSemua(opsi = {}) {
    if (!muatBerjalan) muatBerjalan = muatServer(opsi).finally(() => { muatBerjalan = null; });
    return muatBerjalan;
}
async function muatServer(opsi = {}) {
    const btn = $('#btn-refresh');
    btn.classList.add('spin');
    let data = null;
    try { data = await ambilDataServer(); } catch (e) { console.warn('Ambil data gagal:', e.message); }
    btn.classList.remove('spin');

    if (!data) {
        // Offline / server tidak terjangkau: pakai salinan terakhir di perangkat
        S.online = false;
        if (!S.loaded) {
            if (muatCache()) { if (!opsi.diam) toast('Mode offline: memakai data tersimpan di perangkat.', 'info', 5000); }
            else toast('Tidak ada koneksi dan belum ada data tersimpan. Buka aplikasi sekali saat online.', 'err', 0);
        }
        S.loaded = true;
        renderSemua();
        return;
    }

    S.buku = (data.buku || []).map(k => ({
        noInv: k[0] || '', judul: k[1] || '', pengarang: k[2] || '', penerbit: k[3] || '',
        status: k[4] || '', nis: k[5] || '', tglPinjamRaw: k[6] || '', jatuhTempoRaw: k[7] || '', tglMasukRaw: k[8] || '',
        isbn: k[9] || '', kategori: k[10] || '', rak: k[11] || '', sumber: k[12] || '', harga: k[13] || '', kondisi: k[14] || '', tahunTerbit: k[15] || ''
    })).filter(b => b.noInv);
    S.anggota = (data.anggota || []).map(k => ({ nis: k[0] || '', nama: k[1] || '', kelas: k[2] || '', status: k[3] || '', hp: k[4] || '' })).filter(a => a.nis || a.nama);
    S.history = (data.history || []).map(k => ({ ts: k[0] || '', tgl: parseTanggal(k[0]), noInv: k[1] || '', judul: k[2] || '', nis: k[3] || '', nama: k[4] || '', aksi: k[5] || '', petugas: k[6] || '' }));
    S.history.sort((a, b) => (a.tgl || 0) - (b.tgl || 0));   // transaksi offline bisa masuk belakangan
    (data.settings || []).forEach(k => { if (k[0]) S.settings[String(k[0]).trim()] = String(k[1] || '').trim(); });
    S.publik = !!data.publik;

    // Perubahan yang baru terkirim (CSV belum ikut berubah) dan yang belum terkirim
    // tetap diterapkan di atas data server
    const rc = lsGet(RECENT_KEY, []).filter(x => Date.now() - x.sentAt < 15 * 60000);
    lsSet(RECENT_KEY, rc);
    rc.forEach(x => terapkanOp(x.op, false));
    outbox().forEach(op => terapkanOp(op, true));

    S.online = true;
    S.lastSync = Date.now();
    S.loaded = true;
    simpanCache();
    renderSemua();
}

// ==========================================================
// == DATA TURUNAN ==
// ==========================================================
function isTersedia(b) { return (b.status || '').toLowerCase() === 'tersedia'; }
function isDipinjam(b) { return (b.status || '').toLowerCase() === 'dipinjam'; }
function anggotaByNis(nis) { return S.anggota.find(a => a.nis === nis); }
function bukuByInv(inv) { return S.buku.find(b => b.noInv === inv); }

/** Daftar pinjaman aktif lengkap dengan jatuh tempo & denda. */
function pinjamanAktif() {
    const today = new Date();
    return S.buku.filter(isDipinjam).map(b => {
        let nis = b.nis, tglPinjam = parseTanggal(b.tglPinjamRaw), jt = parseTanggal(b.jatuhTempoRaw), nama = '';
        if (!nis || !tglPinjam) {
            const last = [...S.history].reverse().find(h => h.noInv === b.noInv && /dipinjam/i.test(h.aksi));
            if (last) { nis = nis || last.nis; tglPinjam = tglPinjam || last.tgl; nama = last.nama; }
        }
        if (!jt && tglPinjam) { jt = new Date(tglPinjam); jt.setDate(jt.getDate() + lamaPinjam()); }
        const ang = anggotaByNis(nis);
        const telat = jt ? Math.max(0, selisihHari(today, jt)) : 0;
        const sisa = jt ? selisihHari(jt, today) : null;
        return { buku: b, nis, nama: ang ? ang.nama : (nama || nis || '–'), kelas: ang ? ang.kelas : '', tglPinjam, jatuhTempo: jt, telat, sisa, denda: telat * tarifDenda() };
    });
}

function ringkasKoleksi(list = S.buku) {
    const map = new Map();
    list.forEach(b => {
        const key = (b.judul + '|' + b.pengarang).toLowerCase();
        if (!map.has(key)) map.set(key, { judul: b.judul, pengarang: b.pengarang, penerbit: b.penerbit, rak: b.rak || '', isbn: b.isbn || '', total: 0, tersedia: 0 });
        const r = map.get(key); r.total++; if (isTersedia(b)) r.tersedia++;
        if (!r.penerbit && b.penerbit) r.penerbit = b.penerbit;
        if (!r.rak && b.rak) r.rak = b.rak;
        if (!r.isbn && b.isbn) r.isbn = b.isbn;
    });
    return [...map.values()].sort((a, b) => a.judul.localeCompare(b.judul, 'id'));
}

function kelasList() {
    return [...new Set(S.anggota.map(a => a.kelas).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
}
function tahunInventaris(inv) { const m = (inv || '').match(/(\d{4})\s*$/); return m ? m[1] : ''; }

// ==========================================================
// == NAVIGASI ==
// ==========================================================
const PAGES = {
    dashboard: ['Dashboard', 'Ringkasan koleksi dan sirkulasi perpustakaan'],
    katalog:   ['Katalog Buku', 'Daftar judul buku dan ketersediaan stok'],
    pinjam:    ['Pinjam Buku', 'Catat peminjaman buku oleh anggota'],
    kembali:   ['Kembalikan Buku', 'Catat pengembalian dan hitung denda otomatis'],
    terlambat: ['Terlambat & Denda', 'Buku yang melewati jatuh tempo'],
    riwayat:   ['Riwayat Transaksi', 'Seluruh catatan peminjaman dan pengembalian'],
    anggota:   ['Data Anggota', 'Daftar siswa anggota perpustakaan'],
    laporan:   ['Laporan Bulanan', 'Laporan siap cetak dengan tanda tangan'],
    kartu:     ['Kartu Anggota', 'Cetak kartu anggota dengan QR code / barcode'],
    label:     ['Label Buku', 'Cetak label barcode untuk punggung / sampul buku'],
    kelola:    ['Kelola Data', 'Tambah, ubah, dan hapus data buku, anggota, dan pengaturan']
};
function isAdminPage(p) { const a = $(`.nav a[data-page="${p}"]`); return a && a.hasAttribute('data-admin'); }
function currentPage() { const h = location.hash.slice(1); return PAGES[h] ? h : 'dashboard'; }
function go(p) { if (location.hash.slice(1) === p) tampilkan(p); else location.hash = p; }

function tampilkan(p) {
    if (!PAGES[p]) p = 'dashboard';
    if (isAdminPage(p) && !isAdmin()) {
        bukaLogin(p);
        if (!$('.page.active')) tampilkan('dashboard');
        history.replaceState(null, '', '#' + ($('.page.active')?.id.replace('page-', '') || 'dashboard'));
        return;
    }
    $$('.page').forEach(s => s.classList.toggle('active', s.id === 'page-' + p));
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.page === p));
    $('#page-title').textContent = PAGES[p][0];
    $('#page-sub').textContent = PAGES[p][1];
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    if (S.loaded) renderPage(p);
}
window.addEventListener('hashchange', () => tampilkan(currentPage()));
$$('.nav a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.page); }));
$('#btn-menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
$('#btn-refresh').addEventListener('click', async () => {
    await sinkron({ manual: true, muat: true });
    toast(S.online ? 'Data diperbarui dari server.' : 'Masih offline — menampilkan data tersimpan.', S.online ? 'ok' : 'info', 2500);
});
$$('.modal [data-close]').forEach(b => b.addEventListener('click', () => b.closest('.modal').hidden = true));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal').forEach(m => { if (!m.hidden) { m.hidden = true; pendingPage = null; } }); });

// ==========================================================
// == RENDER ==
// ==========================================================
function renderSemua() {
    updateSyncUI();
    isiDatalist();
    renderStats();
    $('#info-lama').textContent = lamaPinjam();
    $('#info-denda').textContent = rupiah(tarifDenda());
    $('#set-hari').value = lamaPinjam();
    $('#set-denda').value = tarifDenda();
    renderPage(currentPage());
}
function renderPage(p) {
    ({
        dashboard: renderDashboard, katalog: renderKatalog, pinjam: previewPinjam, kembali: renderKembali,
        terlambat: () => { renderTerlambat(); renderDenda(); }, riwayat: renderRiwayat, anggota: renderAnggota, laporan: renderLaporan,
        kartu: renderKartu, label: renderLabel, kelola: () => {}
    }[p] || (() => {}))();
}

function isiDatalist() {
    const urut = [...S.buku].sort((a, b) => a.noInv.localeCompare(b.noInv, undefined, { numeric: true }));
    $('#dl-buku-tersedia').innerHTML = urut.filter(isTersedia).map(b => `<option value="${esc(b.noInv)}">${esc(b.judul)}</option>`).join('');
    $('#dl-buku-dipinjam').innerHTML = urut.filter(isDipinjam).map(b => `<option value="${esc(b.noInv)}">${esc(b.judul)}</option>`).join('');
    $('#dl-buku-semua').innerHTML = urut.map(b => `<option value="${esc(b.noInv)}">${esc(b.judul)} (${esc(b.status)})</option>`).join('');
    $('#dl-anggota').innerHTML = [...S.anggota].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
        .map(a => `<option value="${esc(a.nis)}">${esc(a.nama)} — ${esc(a.kelas)}</option>`).join('');
    const kls = kelasList();
    $('#dl-kelas').innerHTML = kls.map(k => `<option value="${esc(k)}">`).join('');
    const optKelas = '<option value="">Semua kelas</option>' + kls.map(k => `<option>${esc(k)}</option>`).join('');
    ['#filter-kelas-anggota', '#kartu-kelas'].forEach(s => { const el = $(s), v = el.value; el.innerHTML = optKelas; el.value = v; });
    const thn = [...new Set(S.buku.map(b => tahunInventaris(b.noInv)).filter(Boolean))].sort().reverse();
    const lt = $('#label-tahun'), lv = lt.value;
    lt.innerHTML = '<option value="">Semua</option>' + thn.map(t => `<option>${t}</option>`).join('');
    lt.value = lv;
}

function renderStats() {
    const ak = pinjamanAktif();
    const telat = ak.filter(x => x.telat > 0).length;
    $('#st-judul').textContent = ringkasKoleksi().length.toLocaleString('id-ID');
    $('#st-eks').textContent = S.buku.length.toLocaleString('id-ID');
    $('#st-tersedia').textContent = S.buku.filter(isTersedia).length.toLocaleString('id-ID');
    $('#st-dipinjam').textContent = ak.length.toLocaleString('id-ID');
    $('#st-telat').textContent = telat;
    $('#st-anggota').textContent = S.anggota.length.toLocaleString('id-ID');
    const bd = $('#badge-telat'); bd.textContent = telat; bd.hidden = telat === 0;
}

// ---------- DASHBOARD ----------
function statPinjam() {
    const perBulan = {}, perTahun = {};
    S.history.filter(h => /dipinjam/i.test(h.aksi) && h.tgl).forEach(h => {
        const y = h.tgl.getFullYear(), m = h.tgl.getMonth();
        perTahun[y] = (perTahun[y] || 0) + 1;
        (perBulan[y] = perBulan[y] || Array(12).fill(0))[m]++;
    });
    return { perBulan, perTahun };
}
function buatChart(id, cfg) {
    if (typeof Chart === 'undefined') return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
}
const chartOpt = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2ef' } }, x: { grid: { display: false } } }
};
function renderDashboard() {
    renderStats();
    const { perBulan, perTahun } = statPinjam();
    const sel = $('#filter-tahun');
    const now = new Date().getFullYear();
    const years = [...new Set([now, ...Object.keys(perTahun).map(Number)])].sort((a, b) => b - a);
    const prev = sel.value || String(now);
    sel.innerHTML = years.map(y => `<option>${y}</option>`).join('');
    sel.value = years.includes(+prev) ? prev : String(now);
    const drawBulanan = () => buatChart('ch-bulanan', {
        type: 'bar',
        data: { labels: BLN3, datasets: [{ data: perBulan[sel.value] || Array(12).fill(0), backgroundColor: '#0f6b45', borderRadius: 6, maxBarThickness: 28 }] },
        options: chartOpt
    });
    sel.onchange = drawBulanan;
    drawBulanan();
    const ty = Object.keys(perTahun).sort();
    buatChart('ch-tahunan', {
        type: 'bar',
        data: { labels: ty, datasets: [{ data: ty.map(y => perTahun[y]), backgroundColor: '#2563eb', borderRadius: 6, maxBarThickness: 48 }] },
        options: chartOpt
    });
    const ak = {};
    S.buku.forEach(b => { const t = tahunInventaris(b.noInv); if (t) ak[t] = (ak[t] || 0) + 1; });
    const ay = Object.keys(ak).sort();
    buatChart('ch-akuisisi', {
        type: 'line',
        data: { labels: ay, datasets: [{ data: ay.map(y => ak[y]), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,.12)', fill: true, tension: .3, pointRadius: 4 }] },
        options: chartOpt
    });
    const top = {};
    S.history.filter(h => /dipinjam/i.test(h.aksi)).forEach(h => { const j = h.judul || '(tanpa judul)'; top[j] = (top[j] || 0) + 1; });
    const arr = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 7);
    $('#top-buku').innerHTML = arr.length ? arr.map(([j, n]) => `<li><span class="rk-title" title="${esc(j)}">${esc(j)}</span><span class="rk-n">${n}×</span></li>`).join('') : '<li class="muted">Belum ada data peminjaman.</li>';
}

// ---------- KATALOG ----------
function renderKatalog() {
    const q = $('#cari-buku').value.toLowerCase().trim();
    const f = $('#filter-stok').value;
    let list = ringkasKoleksi();
    if (q) list = list.filter(r => (r.judul + ' ' + r.pengarang + ' ' + r.penerbit + ' ' + r.rak + ' ' + r.isbn).toLowerCase().includes(q));
    if (f === 'ada') list = list.filter(r => r.tersedia > 0);
    if (f === 'habis') list = list.filter(r => r.tersedia === 0);
    $('#tb-katalog').innerHTML = list.length ? list.map(r => `
        <tr>
            <td><b>${esc(r.judul)}</b></td>
            <td>${esc(r.pengarang)}</td>
            <td>${esc(r.penerbit) || '<span class="muted">–</span>'}</td>
            <td>${esc(r.rak) || '<span class="muted">–</span>'}</td>
            <td class="t-center">${r.total}</td>
            <td class="t-center"><span class="badge ${r.tersedia > 0 ? 'b-green' : 'b-red'}">${r.tersedia}</span></td>
        </tr>`).join('') : '<tr><td colspan="6" class="loading">Tidak ada buku yang cocok.</td></tr>';
    $('#info-katalog').textContent = `${list.length} judul ditampilkan · ${S.buku.length} eksemplar total`;
}
$('#cari-buku').addEventListener('input', renderKatalog);
$('#filter-stok').addEventListener('change', renderKatalog);

// ---------- PINJAM ----------
function cariAnggota(val) {
    val = (val || '').trim();
    if (!val) return null;
    return anggotaByNis(val) || (() => { const m = S.anggota.filter(a => a.nama.toLowerCase() === val.toLowerCase()); return m.length === 1 ? m[0] : null; })();
}
function previewPinjam() {
    const b = bukuByInv($('#pinjam-buku').value.trim());
    const a = cariAnggota($('#pinjam-anggota').value);
    const pv = $('#pinjam-preview');
    const warn = $('#pinjam-warning');
    warn.innerHTML = '';
    if (!b && !a) { pv.hidden = true; return; }
    let html = '';
    if (b) {
        const jt = new Date(); jt.setDate(jt.getDate() + lamaPinjam());
        html += `<div class="pv-title"><i class="fa-solid fa-book"></i> ${esc(b.judul)}</div>
                 <div class="pv-meta">${esc(b.noInv)} · ${esc(b.pengarang)} · ${isTersedia(b) ? '<span class="badge b-green">Tersedia</span>' : '<span class="badge b-red">' + esc(b.status) + '</span>'}</div>
                 <div class="pv-meta">Jatuh tempo bila dipinjam hari ini: <b>${tglPanjang(jt)}</b></div>`;
    }
    if (a) {
        const aktif = pinjamanAktif().filter(x => x.nis === a.nis);
        html += `<div class="pv-title" style="margin-top:8px"><i class="fa-solid fa-user"></i> ${esc(a.nama)}</div>
                 <div class="pv-meta">NIS ${esc(a.nis)} · Kelas ${esc(a.kelas)} · Sedang meminjam ${aktif.length} buku</div>`;
        const telat = aktif.filter(x => x.telat > 0);
        if (telat.length) warn.innerHTML = `<div class="alert alert-red"><b>Perhatian:</b> ${esc(a.nama)} punya ${telat.length} buku terlambat (perkiraan denda ${rupiah(telat.reduce((s, x) => s + x.denda, 0))}).</div>`;
    }
    pv.innerHTML = html; pv.hidden = false;
    pv.classList.toggle('warn', !!(b && !isTersedia(b)));
}
$('#pinjam-buku').addEventListener('input', previewPinjam);
$('#pinjam-anggota').addEventListener('input', previewPinjam);
$('#btn-pinjam').addEventListener('click', async function () {
    const b = bukuByInv($('#pinjam-buku').value.trim());
    const a = cariAnggota($('#pinjam-anggota').value);
    if (!b) return toast('No. inventaris buku tidak ditemukan.', 'err');
    if (!isTersedia(b)) return toast('Buku ini tidak berstatus Tersedia.', 'err');
    if (!a) return toast('Peminjam tidak ditemukan. Pilih dari daftar (ketik nama atau NIS).', 'err');
    busy(this, true);
    const jt = new Date(); jt.setDate(jt.getDate() + lamaPinjam());
    const res = await aksi({ action: 'pinjamBuku', noInventaris: b.noInv, nis: a.nis });
    busy(this, false);
    if (!laporHasil(res, `Dipinjam ${a.nama}, jatuh tempo ${tglPanjang(jt)}.`)) return;
    $('#pinjam-buku').value = ''; $('#pinjam-anggota').value = '';
    previewPinjam();
    $('#pinjam-buku').focus();
});

// ---------- KEMBALI ----------
function renderKembali() {
    const ak = pinjamanAktif().sort((a, b) => (a.jatuhTempo || 0) - (b.jatuhTempo || 0));
    $('#jml-dipinjam').textContent = ak.length;
    $('#tb-dipinjam').innerHTML = ak.length ? ak.map(x => `
        <tr data-inv="${esc(x.buku.noInv)}" style="cursor:pointer" title="Klik untuk memilih">
            <td class="mono">${esc(x.buku.noInv)}</td>
            <td>${esc(x.buku.judul)}</td>
            <td>${esc(x.nama)}${x.kelas ? ' <span class="muted">(' + esc(x.kelas) + ')</span>' : ''}</td>
            <td>${x.jatuhTempo ? tglPendek(x.jatuhTempo) : '–'} ${x.telat > 0 ? `<span class="badge b-red">+${x.telat} hr</span>` : ''}</td>
        </tr>`).join('') : '<tr><td colspan="4" class="loading">Tidak ada buku yang sedang dipinjam.</td></tr>';
    $$('#tb-dipinjam tr[data-inv]').forEach(tr => tr.addEventListener('click', () => { $('#kembali-buku').value = tr.dataset.inv; previewKembali(); }));
    previewKembali();
}
function previewKembali() {
    const inv = $('#kembali-buku').value.trim();
    const x = pinjamanAktif().find(p => p.buku.noInv === inv);
    const pv = $('#kembali-preview');
    if (!x) { pv.hidden = true; $('#kembali-bayar-wrap').hidden = true; return; }
    pv.classList.toggle('warn', x.telat > 0);
    pv.innerHTML = `<div class="pv-title"><i class="fa-solid fa-book"></i> ${esc(x.buku.judul)}</div>
        <div class="pv-meta">${esc(x.buku.noInv)}</div>
        <div class="pv-meta">Peminjam: <b>${esc(x.nama)}</b> ${x.kelas ? '(' + esc(x.kelas) + ')' : ''}</div>
        <div class="pv-meta">Dipinjam: ${tglPendek(x.tglPinjam)} · Jatuh tempo: <b>${tglPendek(x.jatuhTempo)}</b></div>
        ${x.telat > 0 ? `<div style="margin-top:6px;color:#b91c1c"><b>Terlambat ${x.telat} hari · perkiraan denda ${rupiah(x.denda)}</b></div>` : '<div style="margin-top:6px;color:#166534"><b>Tidak terlambat</b></div>'}`;
    pv.hidden = false;
    $('#kembali-bayar-wrap').hidden = !(x.telat > 0);
}
$('#kembali-buku').addEventListener('input', () => { $('#kembali-hasil').hidden = true; previewKembali(); });
$('#btn-kembali').addEventListener('click', async function () {
    const inv = $('#kembali-buku').value.trim();
    const b = bukuByInv(inv);
    if (!b) return toast('No. inventaris tidak ditemukan.', 'err');
    if (!isDipinjam(b)) return toast('Buku ini tidak sedang dipinjam.', 'err');
    const info = pinjamanAktif().find(p => p.buku.noInv === inv);
    busy(this, true, 'Memproses... (menghitung denda)');
    const dibayar = !!(info && info.telat > 0 && $('#kembali-bayar').checked);
    const res = await aksi({ action: 'kembalikanBuku', noInventaris: inv, dendaDibayar: dibayar });
    busy(this, false);
    if (!laporHasil(res, 'Pengembalian dicatat.')) return;
    const denda = res.status === 'success' ? (Number(res.denda) || 0) : (info ? info.denda : 0);
    const ket = res.status === 'success' ? '' : '<br><small>(perkiraan — mode offline, akan disinkron)</small>';
    const box = $('#kembali-hasil');
    box.className = 'result-box ' + (denda > 0 && !dibayar ? 'denda' : 'ok');
    box.innerHTML = denda > 0
        ? (dibayar ? `Buku dikembalikan. Denda sudah dibayar:<strong style="color:#166534">${rupiah(denda)}</strong>${ket}`
                   : `Buku dikembalikan. Denda yang harus dibayar:<strong style="color:#b91c1c">${rupiah(denda)}</strong><small>Tercatat sebagai <b>belum lunas</b> di halaman Terlambat &amp; Denda.</small>${ket}`)
        : `Buku dikembalikan tepat waktu.<strong style="color:#166534">Tanpa denda</strong>${ket}`;
    box.hidden = false;
    $('#kembali-buku').value = ''; $('#kembali-bayar').checked = false;
    if (res.status === 'success' && denda > 0) muatDenda();
    renderKembali();
});

// ---------- TERLAMBAT ----------
function renderTerlambat() {
    const ak = pinjamanAktif();
    const telat = ak.filter(x => x.telat > 0).sort((a, b) => b.telat - a.telat);
    const segera = ak.filter(x => x.sisa !== null && x.sisa >= 0 && x.sisa <= 3).length;
    $('#tl-jml').textContent = telat.length;
    $('#tl-total').textContent = rupiah(telat.reduce((s, x) => s + x.denda, 0));
    $('#tl-segera').textContent = segera;
    $('#tb-telat').innerHTML = telat.length ? telat.map(x => `
        <tr>
            <td class="mono">${esc(x.buku.noInv)}</td>
            <td>${esc(x.buku.judul)}</td>
            <td><b>${esc(x.nama)}</b><br><span class="muted mono">${esc(x.nis)}</span></td>
            <td>${esc(x.kelas) || '–'}</td>
            <td>${tglPendek(x.tglPinjam)}</td>
            <td>${tglPendek(x.jatuhTempo)}</td>
            <td class="t-center"><span class="badge b-red">${x.telat} hari</span></td>
            <td class="t-right"><b>${rupiah(x.denda)}</b></td>
            <td class="t-center">${tombolWA(x.nis)}</td>
        </tr>`).join('') : '<tr><td colspan="9" class="loading"><i class="fa-solid fa-circle-check" style="color:#16a34a"></i> Tidak ada buku yang terlambat.</td></tr>';
}
$('#btn-cetak-telat').addEventListener('click', () => {
    const telat = pinjamanAktif().filter(x => x.telat > 0).sort((a, b) => (a.kelas || '').localeCompare(b.kelas || '', 'id', { numeric: true }) || a.nama.localeCompare(b.nama));
    const html = `<div class="paper doc">${kopHTML()}
        <div class="doc-title">Daftar Peminjam Terlambat Mengembalikan Buku</div>
        <div class="doc-sub">Per tanggal ${tglPanjang(new Date())}</div>
        ${tabelTelat(telat)}
        ${ttdHTML(new Date())}</div>`;
    cetak(html);
});

// ---------- RIWAYAT ----------
function renderRiwayat() {
    const q = $('#cari-riwayat').value.toLowerCase().trim();
    const f = $('#filter-aksi').value;
    let list = [...S.history].reverse();
    if (f) list = list.filter(h => h.aksi.toLowerCase().startsWith(f.slice(0, 6)));
    if (q) list = list.filter(h => (h.judul + ' ' + h.nama + ' ' + h.nis + ' ' + h.noInv).toLowerCase().includes(q));
    const tampil = list.slice(0, 300);
    $('#tb-riwayat').innerHTML = tampil.length ? tampil.map(h => `
        <tr>
            <td>${h.tgl ? tglJam(h.tgl) : esc(h.ts)}</td>
            <td class="mono">${esc(h.noInv)}</td>
            <td>${esc(h.judul)}</td>
            <td class="mono">${esc(h.nis)}</td>
            <td>${esc(h.nama || (anggotaByNis(h.nis) || {}).nama || '')}</td>
            <td><span class="badge ${/dipinjam/i.test(h.aksi) ? 'b-amber' : 'b-green'}"${h.petugas ? ` title="Petugas: ${esc(h.petugas)}"` : ''}>${esc(h.aksi)}</span>${h.pending ? '<span class="badge-pending" title="Belum terkirim ke server">menunggu sinkron</span>' : ''}</td>
        </tr>`).join('') : '<tr><td colspan="6" class="loading">Belum ada riwayat.</td></tr>';
    $('#info-riwayat').textContent = `Menampilkan ${tampil.length} dari ${list.length} transaksi (terbaru di atas).`;
}
$('#cari-riwayat').addEventListener('input', renderRiwayat);
$('#filter-aksi').addEventListener('change', renderRiwayat);

// ---------- ANGGOTA ----------
function renderAnggota() {
    const q = $('#cari-anggota').value.toLowerCase().trim();
    const k = $('#filter-kelas-anggota').value;
    const ak = pinjamanAktif();
    let list = [...S.anggota].sort((a, b) => a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) || a.nama.localeCompare(b.nama, 'id'));
    if (k) list = list.filter(a => a.kelas === k);
    if (q) list = list.filter(a => (a.nama + ' ' + a.nis + ' ' + a.kelas + ' ' + (a.hp || '')).toLowerCase().includes(q));
    $('#tb-anggota').innerHTML = list.length ? list.map(a => {
        const n = ak.filter(x => x.nis === a.nis); const t = n.some(x => x.telat > 0);
        return `<tr>
            <td class="mono">${esc(a.nis)}</td>
            <td><b>${esc(a.nama)}</b></td>
            <td>${esc(a.kelas)}</td>
            <td class="mono">${a.hp ? `<a href="${waLink(a.hp, '')}" target="_blank" rel="noopener" class="wa-mini" title="Buka WhatsApp"><i class="fa-brands fa-whatsapp"></i> ${esc(a.hp)}</a>` : '<span class="muted">–</span>'}</td>
            <td><span class="badge ${/aktif/i.test(a.status) && !/non|tidak/i.test(a.status) ? 'b-green' : 'b-gray'}">${esc(a.status) || '–'}</span></td>
            <td class="t-center">${n.length ? `<span class="badge ${t ? 'b-red' : 'b-amber'}">${n.length}</span>` : '<span class="muted">0</span>'}</td>
        </tr>`; }).join('') : '<tr><td colspan="6" class="loading">Tidak ada anggota yang cocok.</td></tr>';
    $('#info-anggota').textContent = `${list.length} dari ${S.anggota.length} anggota ditampilkan.`;
}
$('#cari-anggota').addEventListener('input', renderAnggota);
$('#filter-kelas-anggota').addEventListener('change', renderAnggota);

// ==========================================================
// == CETAK (Laporan, Kartu, Label) ==
// ==========================================================
function getTTD() { try { return { ...TTD_DEFAULT, ...JSON.parse(localStorage.getItem('perpus_ttd') || '{}') }; } catch (e) { return { ...TTD_DEFAULT }; } }
function kopHTML() {
    return `<div class="kop"><img src="logo.png" alt="">
        <div class="kop-text"><div class="k1">${SEKOLAH.yayasan}</div><div class="k2">${SEKOLAH.nama}</div>
        <div class="k1" style="font-size:12pt">PERPUSTAKAAN MADRASAH</div><div class="k3">${SEKOLAH.alamat}</div></div>
        <div style="width:78px"></div></div>`;
}
function ttdHTML(tgl) {
    const t = getTTD();
    return `<div class="ttd">
        <div>Mengetahui,<br>Kepala Madrasah<div class="space"></div><div class="nm">${esc(t.kamad)}</div>${t.kamadNip ? 'NIP. ' + esc(t.kamadNip) : ''}</div>
        <div>${esc(t.tempat)}, ${tglPanjang(tgl)}<br>Kepala Perpustakaan<div class="space"></div><div class="nm">${esc(t.kapus)}</div>${t.kapusNip ? 'NIP. ' + esc(t.kapusNip) : ''}</div>
    </div>`;
}
function tabelTelat(list) {
    if (!list.length) return '<p><i>Tidak ada buku yang terlambat.</i></p>';
    return `<table><thead><tr><th>No</th><th>Nama</th><th>Kelas</th><th>No. Inventaris</th><th>Judul Buku</th><th>Jatuh Tempo</th><th>Telat</th><th>Denda</th></tr></thead><tbody>
        ${list.map((x, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(x.nama)}</td><td style="text-align:center">${esc(x.kelas)}</td><td>${esc(x.buku.noInv)}</td><td>${esc(x.buku.judul)}</td><td>${tglPendek(x.jatuhTempo)}</td><td style="text-align:center">${x.telat} hr</td><td style="text-align:right">${rupiah(x.denda)}</td></tr>`).join('')}
        <tr><td colspan="7" style="text-align:right"><b>Total perkiraan denda</b></td><td style="text-align:right"><b>${rupiah(list.reduce((s, x) => s + x.denda, 0))}</b></td></tr>
    </tbody></table>`;
}
function cetak(html) {
    const area = $('#print-area');
    area.innerHTML = html;
    const imgs = $$('img', area).filter(i => !i.complete);
    const go = () => setTimeout(() => {
        if (IN_APP && window.AndroidApp.print) window.AndroidApp.print(document.title);   // cetak / simpan PDF di HP
        else window.print();
    }, 300);
    if (!imgs.length) go(); else { let n = imgs.length; imgs.forEach(i => { i.onload = i.onerror = () => { if (--n === 0) go(); }; }); }
}
window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });

// ---------- LAPORAN BULANAN ----------
(function initLaporan() {
    const now = new Date();
    $('#lap-bulan').innerHTML = BULAN.map((b, i) => `<option value="${i}">${b}</option>`).join('');
    $('#lap-bulan').value = now.getMonth();
    const y = now.getFullYear();
    $('#lap-tahun').innerHTML = [y, y - 1, y - 2, y - 3].map(t => `<option>${t}</option>`).join('');
    $('#lap-bulan').addEventListener('change', renderLaporan);
    $('#lap-tahun').addEventListener('change', renderLaporan);
})();
function laporanHTML() {
    const m = +$('#lap-bulan').value, y = +$('#lap-tahun').value;
    const trx = S.history.filter(h => h.tgl && h.tgl.getMonth() === m && h.tgl.getFullYear() === y).sort((a, b) => a.tgl - b.tgl);
    const pinjam = trx.filter(h => /dipinjam/i.test(h.aksi));
    const kembali = trx.filter(h => /kembali/i.test(h.aksi));
    const peminjamUnik = new Set(pinjam.map(h => h.nis).filter(Boolean)).size;
    const kelasMap = {};
    pinjam.forEach(h => { const k = (anggotaByNis(h.nis) || {}).kelas || 'Tidak diketahui'; kelasMap[k] = (kelasMap[k] || 0) + 1; });
    const kelasArr = Object.entries(kelasMap).sort((a, b) => a[0].localeCompare(b[0], 'id', { numeric: true }));
    const top = {}; pinjam.forEach(h => { top[h.judul] = (top[h.judul] || 0) + 1; });
    const topArr = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const akhirBulan = new Date(y, m + 1, 0);
    const isBulanIni = y === new Date().getFullYear() && m === new Date().getMonth();
    const tglTtd = isBulanIni || akhirBulan > new Date() ? new Date() : akhirBulan;
    const telat = pinjamanAktif().filter(x => x.telat > 0).sort((a, b) => b.telat - a.telat);
    const kol = ringkasKoleksi();

    return `<div class="doc">${kopHTML()}
        <div class="doc-title">Laporan Bulanan Perpustakaan</div>
        <div class="doc-sub">Bulan ${BULAN[m]} ${y}</div>

        <h4>A. Keadaan Koleksi</h4>
        <table class="no-border" style="width:auto">
            <tr><td>Jumlah judul buku</td><td>:</td><td><b>${kol.length}</b> judul</td></tr>
            <tr><td>Jumlah eksemplar</td><td>:</td><td><b>${S.buku.length}</b> eksemplar</td></tr>
            <tr><td>Eksemplar tersedia</td><td>:</td><td><b>${S.buku.filter(isTersedia).length}</b> eksemplar</td></tr>
            <tr><td>Eksemplar sedang dipinjam</td><td>:</td><td><b>${S.buku.filter(isDipinjam).length}</b> eksemplar</td></tr>
            <tr><td>Jumlah anggota</td><td>:</td><td><b>${S.anggota.length}</b> siswa</td></tr>
        </table>

        <h4>B. Ringkasan Sirkulasi Bulan ${BULAN[m]} ${y}</h4>
        <table class="no-border" style="width:auto">
            <tr><td>Jumlah peminjaman</td><td>:</td><td><b>${pinjam.length}</b> kali</td></tr>
            <tr><td>Jumlah pengembalian</td><td>:</td><td><b>${kembali.length}</b> kali</td></tr>
            <tr><td>Jumlah siswa yang meminjam</td><td>:</td><td><b>${peminjamUnik}</b> siswa</td></tr>
        </table>

        <h4>C. Peminjaman per Kelas</h4>
        ${kelasArr.length ? `<table style="width:60%"><thead><tr><th>No</th><th>Kelas</th><th>Jumlah Peminjaman</th></tr></thead><tbody>
            ${kelasArr.map(([k, n], i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(k)}</td><td style="text-align:center">${n}</td></tr>`).join('')}
            <tr><td colspan="2" style="text-align:right"><b>Jumlah</b></td><td style="text-align:center"><b>${pinjam.length}</b></td></tr></tbody></table>` : '<p><i>Tidak ada peminjaman pada bulan ini.</i></p>'}

        <h4>D. Buku Paling Banyak Dipinjam</h4>
        ${topArr.length ? `<table><thead><tr><th style="width:40px">No</th><th>Judul Buku</th><th style="width:110px">Dipinjam</th></tr></thead><tbody>
            ${topArr.map(([j, n], i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(j)}</td><td style="text-align:center">${n} kali</td></tr>`).join('')}</tbody></table>` : '<p><i>Tidak ada data.</i></p>'}

        <h4>E. Rincian Transaksi</h4>
        ${trx.length ? `<table><thead><tr><th>No</th><th>Tanggal</th><th>No. Inventaris</th><th>Judul Buku</th><th>Nama Siswa</th><th>Kelas</th><th>Keterangan</th></tr></thead><tbody>
            ${trx.map((h, i) => { const a = anggotaByNis(h.nis) || {}; return `<tr><td style="text-align:center">${i + 1}</td><td>${h.tgl.toLocaleDateString('id-ID')}</td><td>${esc(h.noInv)}</td><td>${esc(h.judul)}</td><td>${esc(h.nama || a.nama || '')}</td><td style="text-align:center">${esc(a.kelas || '')}</td><td>${esc(h.aksi)}</td></tr>`; }).join('')}
            </tbody></table>` : '<p><i>Tidak ada transaksi pada bulan ini.</i></p>'}

        <h4>F. Buku Terlambat Dikembalikan (per ${tglPanjang(new Date())})</h4>
        ${tabelTelat(telat)}

        ${ttdHTML(tglTtd)}
    </div>`;
}
function renderLaporan() { $('#laporan-preview').innerHTML = laporanHTML(); }
$('#btn-cetak-laporan').addEventListener('click', () => cetak(`<div class="paper">${laporanHTML()}</div>`));
$('#btn-ttd').addEventListener('click', () => {
    const t = getTTD();
    $('#ttd-kamad').value = t.kamad; $('#ttd-kamad-nip').value = t.kamadNip;
    $('#ttd-kapus').value = t.kapus; $('#ttd-kapus-nip').value = t.kapusNip;
    $('#ttd-tempat').value = t.tempat;
    $('#modal-ttd').hidden = false;
});
$('#form-ttd').addEventListener('submit', e => {
    e.preventDefault();
    const t = { kamad: $('#ttd-kamad').value.trim(), kamadNip: $('#ttd-kamad-nip').value.trim(), kapus: $('#ttd-kapus').value.trim(), kapusNip: $('#ttd-kapus-nip').value.trim(), tempat: $('#ttd-tempat').value.trim() || 'Sambirejo' };
    try { localStorage.setItem('perpus_ttd', JSON.stringify(t)); } catch (er) {}
    $('#modal-ttd').hidden = true;
    renderLaporan();
    toast('Penanda tangan disimpan.', 'ok');
});

// ---------- KARTU ANGGOTA ----------
function qrSVG(text) {
    if (typeof qrcode === 'undefined') return '';
    const q = qrcode(0, 'M'); q.addData(String(text)); q.make();
    return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
}
function barcodeSVG(text, opt = {}) {
    if (typeof JsBarcode === 'undefined') return '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
        JsBarcode(svg, String(text), { format: 'CODE128', displayValue: true, fontSize: 14, height: 50, margin: 0, textMargin: 1, ...opt });
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const w = svg.getAttribute('width'), h = svg.getAttribute('height');
        svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
        svg.removeAttribute('width'); svg.removeAttribute('height');
        return svg.outerHTML;
    } catch (e) { return ''; }
}
function dataKartu() {
    const k = $('#kartu-kelas').value, q = $('#kartu-cari').value.toLowerCase().trim();
    let list = [...S.anggota].sort((a, b) => a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) || a.nama.localeCompare(b.nama, 'id'));
    if (k) list = list.filter(a => a.kelas === k);
    if (q) list = list.filter(a => (a.nama + ' ' + a.nis).toLowerCase().includes(q));
    return list;
}
function kartuHTML(list) {
    const mode = $('#kartu-kode').value;
    return list.map(a => `
        <div class="member-card ${mode === 'barcode' ? 'bar' : ''}">
            <div class="mc-head"><img src="logo.png" alt=""><div><div class="t1">KARTU ANGGOTA PERPUSTAKAAN</div><div class="t2">${SEKOLAH.singkat}</div></div></div>
            <div class="mc-body">
                <div class="mc-info">
                    <div class="lbl2">Nama</div><div class="val name">${esc(a.nama)}</div>
                    <div style="display:flex;gap:5mm">
                        <div><div class="lbl2">NIS</div><div class="val">${esc(a.nis)}</div></div>
                        <div><div class="lbl2">Kelas</div><div class="val">${esc(a.kelas)}</div></div>
                    </div>
                </div>
                <div class="mc-code ${mode === 'qr' ? 'qr' : ''}">${mode === 'qr' ? qrSVG(a.nis) : barcodeSVG(a.nis, { displayValue: false, height: 40 })}</div>
            </div>
            <div class="mc-foot">Bawa kartu ini setiap meminjam buku</div>
        </div>`).join('');
}
function renderKartu() {
    const list = dataKartu();
    const max = 60;
    $('#kartu-preview').innerHTML = kartuHTML(list.slice(0, max));
    $('#info-kartu').textContent = `${list.length} kartu siap dicetak${list.length > max ? ` (pratinjau menampilkan ${max} pertama; semua ikut tercetak)` : ''}. Ukuran kartu 85,6 × 54 mm (seukuran KTP), 8 kartu per halaman A4.`;
}
['#kartu-kelas', '#kartu-kode'].forEach(s => $(s).addEventListener('change', renderKartu));
$('#kartu-cari').addEventListener('input', renderKartu);
$('#btn-cetak-kartu').addEventListener('click', () => {
    const list = dataKartu();
    if (!list.length) return toast('Tidak ada anggota untuk dicetak.', 'err');
    cetak(`<div class="cards-grid">${kartuHTML(list)}</div>`);
});

// ---------- LABEL BUKU ----------
function dataLabel() {
    const q = $('#label-cari').value.toLowerCase().trim(), t = $('#label-tahun').value;
    let list = [...S.buku].sort((a, b) => a.noInv.localeCompare(b.noInv, undefined, { numeric: true }));
    if (t) list = list.filter(b => tahunInventaris(b.noInv) === t);
    if (q) list = list.filter(b => (b.judul + ' ' + b.noInv).toLowerCase().includes(q));
    return list;
}
function labelHTML(list) {
    return list.map(b => `
        <div class="book-label">
            <div class="bl-head"><img src="logo.png" alt="">PERPUSTAKAAN ${SEKOLAH.singkat.toUpperCase()}</div>
            <div class="bl-title">${esc(b.judul)}</div>
            <div class="bl-code">${barcodeSVG(b.noInv, { displayValue: false, height: 45 })}</div>
            <div class="bl-inv">${esc(b.noInv)}</div>
        </div>`).join('');
}
function renderLabel() {
    const list = dataLabel();
    const max = 60;
    $('#label-preview').innerHTML = labelHTML(list.slice(0, max));
    $('#info-label').textContent = `${list.length} label${list.length > max ? ` (pratinjau ${max} pertama; semua ikut tercetak)` : ''}. Ukuran 60 × 32 mm (21 label per halaman A4), barcode berisi No. Inventaris sehingga bisa di-scan saat pinjam/kembali.`;
}
$('#label-cari').addEventListener('input', renderLabel);
$('#label-tahun').addEventListener('change', renderLabel);
$('#btn-cetak-label').addEventListener('click', () => {
    const list = dataLabel();
    if (!list.length) return toast('Tidak ada buku untuk dicetak.', 'err');
    cetak(`<div class="labels-grid">${labelHTML(list)}</div>`);
});

// ==========================================================
// == KELOLA DATA ==
// ==========================================================
$$('#kelola-tabs .tab').forEach(t => t.addEventListener('click', () => {
    $$('#kelola-tabs .tab').forEach(x => x.classList.toggle('active', x === t));
    $$('#page-kelola .tab-panel').forEach(p => p.classList.toggle('active', p.id === t.dataset.tab));
}));

// Tambah buku
function hintRange() {
    const r = $('#buku-range').value.trim(), s = $('#buku-suffix').value.trim();
    const m = r.match(/^(\d+)\s*-\s*(\d+)$/);
    const h = $('#buku-range-hint');
    if (!r) { h.textContent = ''; return; }
    if (!m) { h.textContent = 'Format rentang: angka-angka, misalnya 01-20.'; return; }
    const n = Math.abs(+m[2] - +m[1]) + 1;
    const dup = S.buku.filter(b => b.noInv === m[1] + s || b.noInv === m[2] + s).length;
    h.innerHTML = `Akan dibuat <b>${n}</b> eksemplar: <span class="mono">${esc(m[1] + s)}</span> s.d. <span class="mono">${esc(m[2] + s)}</span>` + (dup ? ' <span style="color:#b91c1c">— peringatan: sebagian nomor sudah ada!</span>' : '');
}
$('#buku-range').addEventListener('input', hintRange);
$('#buku-suffix').addEventListener('input', hintRange);
$('#btn-tambah-buku').addEventListener('click', async function () {
    const buku = { range: $('#buku-range').value.trim(), suffix: $('#buku-suffix').value.trim(), judul: $('#buku-judul').value.trim(), pengarang: $('#buku-pengarang').value.trim(), penerbit: $('#buku-penerbit').value.trim(), ...bacaEkstra('buku-') };
    if (!buku.range || !buku.suffix || !buku.judul) return toast('Rentang, akhiran, dan judul wajib diisi.', 'err');
    const m = buku.range.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return toast('Format rentang salah. Contoh: 01-20.', 'err');
    const n = Math.abs(+m[2] - +m[1]) + 1;
    const ringkas = `Simpan ${n} eksemplar?\n\nJudul: ${buku.judul}\nPengarang: ${buku.pengarang || '-'}\nPenerbit: ${buku.penerbit || '-'}` +
        (buku.isbn ? `\nISBN: ${buku.isbn}` : '') + `\nNo. inventaris: ${m[1]}${buku.suffix} s.d. ${m[2]}${buku.suffix}`;
    if (!confirm(ringkas)) return;
    busy(this, true, 'Menyimpan...');
    const res = await aksi({ action: 'tambahBuku', buku });
    busy(this, false);
    if (laporHasil(res, 'Buku ditambahkan.')) {
        lsSet(SUFFIX_KEY, buku.suffix);
        $('#auto-isi-info').hidden = true;
        $$('#tab-tambah-buku .auto-isi').forEach(el => el.classList.remove('auto-isi'));
        ['#buku-kategori', '#buku-sumber', '#buku-kondisi'].forEach(s => $(s).value = '');
        ['#buku-range', '#buku-judul', '#buku-pengarang', '#buku-penerbit', '#buku-isbn', '#buku-harga', '#buku-tahun'].forEach(s => $(s).value = '');
        hintRange();
    }
});

// Edit buku
function isiEditBuku() {
    const b = bukuByInv($('#edit-buku-pilih').value.trim());
    const hint = $('#edit-buku-hint');
    $('#edit-buku-judul').value = b ? b.judul : '';
    $('#edit-buku-pengarang').value = b ? b.pengarang : '';
    $('#edit-buku-penerbit').value = b ? b.penerbit : '';
    isiEkstra('edit-buku-', b);
    const locked = b && isDipinjam(b);
    $('#btn-update-buku').disabled = !b || locked;
    $('#btn-hapus-buku').disabled = !b || locked;
    hint.innerHTML = !b ? '' : locked ? '<span style="color:#b45309">Buku ini sedang dipinjam, tidak bisa diubah atau dihapus.</span>' : `Status: ${esc(b.status)}`;
}
$('#edit-buku-pilih').addEventListener('input', isiEditBuku);
$('#btn-update-buku').addEventListener('click', async function () {
    const inv = $('#edit-buku-pilih').value.trim();
    const buku = { noInventaris: inv, judul: $('#edit-buku-judul').value.trim(), pengarang: $('#edit-buku-pengarang').value.trim(), penerbit: $('#edit-buku-penerbit').value.trim(), ...bacaEkstra('edit-buku-') };
    if (!bukuByInv(inv) || !buku.judul) return toast('Pilih buku dan isi judul.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await aksi({ action: 'updateBuku', buku });
    busy(this, false);
    laporHasil(res, 'Data buku diperbarui.');
});
$('#btn-hapus-buku').addEventListener('click', async function () {
    const inv = $('#edit-buku-pilih').value.trim();
    if (!bukuByInv(inv)) return toast('Pilih buku terlebih dahulu.', 'err');
    if (!confirm(`Hapus buku dengan No. Inventaris ${inv}?\nTindakan ini tidak bisa dibatalkan.`)) return;
    busy(this, true, 'Menghapus...');
    const res = await aksi({ action: 'hapusBuku', noInventaris: inv });
    busy(this, false);
    if (laporHasil(res, 'Buku dihapus.')) { $('#edit-buku-pilih').value = ''; isiEditBuku(); }
});

// Tambah anggota
$('#btn-tambah-anggota').addEventListener('click', async function () {
    const anggota = { nis: $('#anggota-nis').value.trim(), nama: $('#anggota-nama').value.trim(), kelas: $('#anggota-kelas').value.trim(), status: $('#anggota-status').value.trim(), hp: $('#anggota-hp').value.trim() };
    if (!anggota.nis || !anggota.nama) return toast('NIS dan nama wajib diisi.', 'err');
    if (anggotaByNis(anggota.nis)) return toast('NIS ini sudah terdaftar.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await aksi({ action: 'tambahAnggota', anggota });
    busy(this, false);
    if (laporHasil(res, 'Anggota ditambahkan.')) {
        ['#anggota-nis', '#anggota-nama', '#anggota-hp'].forEach(s => $(s).value = '');
        $('#anggota-nis').focus();
    }
});

// Edit anggota
function isiEditAnggota() {
    const a = cariAnggota($('#edit-anggota-pilih').value);
    $('#edit-anggota-nama').value = a ? a.nama : '';
    $('#edit-anggota-kelas').value = a ? a.kelas : '';
    $('#edit-anggota-status').value = a ? a.status : '';
    $('#edit-anggota-hp').value = a ? (a.hp || '') : '';
    $('#btn-update-anggota').disabled = !a;
    $('#btn-hapus-anggota').disabled = !a;
    $('#edit-anggota-hint').textContent = a ? `NIS ${a.nis} (tidak bisa diubah)` : '';
}
$('#edit-anggota-pilih').addEventListener('input', isiEditAnggota);
$('#btn-update-anggota').addEventListener('click', async function () {
    const a = cariAnggota($('#edit-anggota-pilih').value);
    if (!a) return toast('Pilih anggota terlebih dahulu.', 'err');
    const anggota = { nis: a.nis, nama: $('#edit-anggota-nama').value.trim(), kelas: $('#edit-anggota-kelas').value.trim(), status: $('#edit-anggota-status').value.trim(), hp: $('#edit-anggota-hp').value.trim() };
    busy(this, true, 'Menyimpan...');
    const res = await aksi({ action: 'updateAnggota', anggota });
    busy(this, false);
    laporHasil(res, 'Data anggota diperbarui.');
});
$('#btn-hapus-anggota').addEventListener('click', async function () {
    const a = cariAnggota($('#edit-anggota-pilih').value);
    if (!a) return toast('Pilih anggota terlebih dahulu.', 'err');
    if (pinjamanAktif().some(x => x.nis === a.nis)) return toast('Anggota ini masih meminjam buku. Kembalikan dulu sebelum menghapus.', 'err');
    if (!confirm(`Hapus anggota ${a.nama} (NIS ${a.nis})?\nTindakan ini tidak bisa dibatalkan.`)) return;
    busy(this, true, 'Menghapus...');
    const res = await aksi({ action: 'hapusAnggota', nis: a.nis });
    busy(this, false);
    if (laporHasil(res, 'Anggota dihapus.')) { $('#edit-anggota-pilih').value = ''; isiEditAnggota(); }
});

// Kolom katalog tambahan (ISBN, DDC, rak, dll.)
const ID_EKSTRA = { isbn: 'isbn', kategori: 'kategori', rak: 'rak', sumber: 'sumber', harga: 'harga', kondisi: 'kondisi', tahunTerbit: 'tahun' };
function bacaEkstra(prefix) {
    const o = {};
    FIELD_EKSTRA.forEach(f => { const el = $('#' + prefix + ID_EKSTRA[f]); if (el) o[f] = el.value.trim(); });
    if (o.harga) o.harga = o.harga.replace(/[^0-9]/g, '');
    return o;
}
function isiEkstra(prefix, b) { FIELD_EKSTRA.forEach(f => { const el = $('#' + prefix + ID_EKSTRA[f]); if (el) el.value = b ? (b[f] || '') : ''; }); }

// ---------- CATATAN DENDA ----------
let dendaBerjalan = false;
async function muatDenda(opsi = {}) {
    if (!isAdmin() || !navigator.onLine || dendaBerjalan) { if (opsi.manual && !navigator.onLine) toast('Sedang offline — menampilkan catatan denda tersimpan.', 'info'); return; }
    dendaBerjalan = true;
    const res = await kirimRaw({ action: 'daftarDenda', ...kredensial() });
    dendaBerjalan = false;
    if (res._network) { if (opsi.manual) toast('Tidak bisa terhubung ke server.', 'err'); return; }
    if (res.status !== 'success') { if (opsi.manual) toast(res.message || 'Gagal memuat denda.', 'err'); return; }
    S.denda = res.data || []; S.dendaT = Date.now();
    // pembayaran yang belum terkirim tetap terlihat lunas
    outbox().filter(op => op.data.action === 'bayarDenda').forEach(op => terapkanOp(op, true));
    lsSet(DENDA_KEY, { t: S.dendaT, data: S.denda });
    if (currentPage() === 'terlambat') renderDenda();
}
function renderDenda() {
    if (!S.denda.length && !S.dendaT) { const c = lsGet(DENDA_KEY, null); if (c) { S.denda = c.data || []; S.dendaT = c.t || 0; } }
    const f = $('#denda-filter').value, q = $('#denda-cari').value.toLowerCase().trim();
    const belum = S.denda.filter(x => !/^lunas$/i.test(x.status));
    $('#dn-belum').textContent = rupiah(belum.reduce((s, x) => s + (Number(x.denda) || 0), 0));
    $('#dn-lunas').textContent = rupiah(S.denda.filter(x => /^lunas$/i.test(x.status)).reduce((s, x) => s + (Number(x.denda) || 0), 0));
    $('#dn-siswa').textContent = new Set(belum.map(x => String(x.nis))).size;
    let list = [...S.denda].reverse();
    if (f) list = list.filter(x => (x.status || '').toLowerCase() === f);
    if (q) list = list.filter(x => [x.nama, x.nis, x.judul, x.noInventaris, x.idDenda].join(' ').toLowerCase().includes(q));
    const tg = v => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? tglPendek(d) : '–'; };
    $('#tb-denda').innerHTML = list.length ? list.map(x => {
        const lunas = /^lunas$/i.test(x.status);
        const a = anggotaByNis(String(x.nis));
        return `<tr>
            <td>${tg(x.waktuKembali)}<br><span class="muted mono" style="font-size:11px">${esc(x.idDenda)}</span></td>
            <td><b>${esc(x.nama || (a && a.nama) || '')}</b><br><span class="muted mono">${esc(x.nis)}</span>${a && a.kelas ? ` <span class="muted">· ${esc(a.kelas)}</span>` : ''}</td>
            <td>${esc(x.judul)}<br><span class="muted mono">${esc(x.noInventaris)}</span></td>
            <td class="t-center">${esc(x.hariTerlambat)} hr</td>
            <td class="t-right"><b>${rupiah(x.denda)}</b></td>
            <td>${lunas ? `<span class="badge b-green">Lunas</span><br><span class="muted" style="font-size:11px">${tg(x.tglBayar)}${x.diterimaOleh ? ' · ' + esc(x.diterimaOleh) : ''}</span>` : '<span class="badge b-red">Belum lunas</span>'}${x.pending ? '<span class="badge-pending">menunggu sinkron</span>' : ''}</td>
            <td class="t-right">${lunas ? '' : `<button class="btn btn-success btn-xs" data-bayar="${esc(x.idDenda)}"><i class="fa-solid fa-money-bill"></i> Bayar</button>`}</td>
        </tr>`; }).join('')
        : `<tr><td colspan="7" class="loading">${!isAdmin() ? 'Login untuk melihat catatan denda.' : S.dendaT ? 'Tidak ada catatan denda yang cocok.' : 'Belum dimuat — butuh internet. Klik "Muat Ulang".'}</td></tr>`;
    $$('#tb-denda [data-bayar]').forEach(b => b.addEventListener('click', () => bayar(b, { idDenda: b.dataset.bayar })));
    $('#info-denda-list').textContent = (S.dendaT ? `Diperbarui ${new Date(S.dendaT).toLocaleString('id-ID')}. ` : '') + 'Denda tercatat otomatis saat buku terlambat dikembalikan. Pembayaran saat offline dikirim ke server ketika online.';
}
async function bayar(btn, target) {
    const x = S.denda.find(d => d.idDenda === target.idDenda);
    if (!x) return;
    if (!confirm(`Catat pembayaran denda ${rupiah(x.denda)} dari ${x.nama || x.nis}?`)) return;
    busy(btn, true, '');
    const res = await aksi({ action: 'bayarDenda', ...target });
    busy(btn, false);
    laporHasil(res, 'Pembayaran denda dicatat.');
    renderDenda();
}
$('#denda-filter').addEventListener('change', renderDenda);
$('#denda-cari').addEventListener('input', renderDenda);
$('#btn-muat-denda').addEventListener('click', async function () { busy(this, true, 'Memuat...'); await muatDenda({ manual: true }); busy(this, false); renderDenda(); });

// ---------- PETUGAS ----------
async function kirimAkun(data) {
    if (!getPw()) { bukaLogin(currentPage()); return { status: 'error', message: 'Silakan login terlebih dahulu.' }; }
    const res = await kirimRaw({ ...data, ...kredensial() });
    if (res._network) return { status: 'error', message: 'Butuh koneksi internet untuk mengelola akun.' };
    return res;
}
async function muatPetugas() {
    const tb = $('#tb-petugas');
    tb.innerHTML = '<tr><td colspan="5" class="loading">Memuat...</td></tr>';
    const res = await kirimAkun({ action: 'daftarPetugas' });
    if (res.status !== 'success') { tb.innerHTML = `<tr><td colspan="5" class="loading">${esc(res.message || 'Gagal memuat.')}</td></tr>`; return; }
    const list = res.data || [];
    tb.innerHTML = list.length ? list.map(p => `<tr>
        <td class="mono"><b>${esc(p.username)}</b></td><td>${esc(p.nama)}</td>
        <td><span class="badge ${p.peran === 'admin' ? 'b-amber' : 'b-gray'}">${esc(p.peran)}</span></td>
        <td>${p.dibuat ? tglPendek(new Date(p.dibuat)) : '–'}</td>
        <td class="t-right"><button class="btn btn-danger btn-xs" data-hapus-ptg="${esc(p.username)}"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="loading">Belum ada akun petugas. Tambahkan di bawah.</td></tr>';
    $$('#tb-petugas [data-hapus-ptg]').forEach(b => b.addEventListener('click', async () => {
        const u = b.dataset.hapusPtg;
        if (!confirm(`Hapus akun petugas "${u}"? Petugas ini tidak bisa login lagi.`)) return;
        busy(b, true, '');
        const r = await kirimAkun({ action: 'hapusPetugas', username_hapus: u });
        busy(b, false);
        if (laporHasil(r)) muatPetugas();
    }));
}
$('#btn-muat-petugas').addEventListener('click', muatPetugas);
$('#btn-tambah-petugas').addEventListener('click', async function () {
    const petugas = { username: $('#ptg-user').value.trim().toLowerCase(), nama: $('#ptg-nama').value.trim(), password: $('#ptg-pass').value, peran: $('#ptg-peran').value };
    if (!/^[a-z0-9._]{3,20}$/.test(petugas.username)) return toast('Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.', 'err');
    if (petugas.password.length < 6) return toast('Password minimal 6 karakter.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await kirimAkun({ action: 'tambahPetugas', petugas });
    busy(this, false);
    if (laporHasil(res)) { ['#ptg-user', '#ptg-nama', '#ptg-pass'].forEach(s => $(s).value = ''); muatPetugas(); }
});
$('#btn-ganti-pw').addEventListener('click', async function () {
    const a = $('#pw-baru').value, b = $('#pw-baru2').value;
    if (a.length < 6) return toast('Password baru minimal 6 karakter.', 'err');
    if (a !== b) return toast('Ulangi password tidak sama.', 'err');
    if (outbox().length) return toast('Masih ada perubahan menunggu sinkron. Sinkronkan dulu sebelum mengganti password.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await kirimAkun({ action: 'gantiPassword', passwordBaru: a });
    busy(this, false);
    if (!laporHasil(res)) return;
    const akun = getAkun();
    try { sessionStorage.setItem(AUTH_KEY, a); } catch (e) {}
    const h = await sha256(akun.user + '|' + a), daftar = hashTersimpan();
    if (h) { daftar[akun.user] = { h, nama: akun.nama, peran: akun.peran }; lsSet(PWHASH_KEY, daftar); }
    $('#pw-baru').value = ''; $('#pw-baru2').value = '';
});
$$('#kelola-tabs .tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.tab === 'tab-petugas' && isSuperAdmin()) muatPetugas(); }));

// ==========================================================
// == ISI OTOMATIS: SCAN ISBN -> DATABASE BUKU, ATAU FOTO SAMPUL -> AI ==
// ==========================================================
const SUFFIX_KEY = 'perpus_suffix_terakhir';
const SC = { stream: null, timer: null, isbn: '', sibuk: false, detector: null, reader: null, selesai: false };

/** ISBN-10/13 -> ISBN-13 yang valid, atau null */
function normalIsbn(t) {
    const x = String(t || '').toUpperCase().replace(/[^0-9X]/g, '');
    if (x.length === 13 && /^97[89]\d{10}$/.test(x)) {
        let s = 0; for (let i = 0; i < 12; i++) s += +x[i] * (i % 2 ? 3 : 1);
        return (10 - s % 10) % 10 === +x[12] ? x : null;
    }
    if (x.length === 10 && /^\d{9}[\dX]$/.test(x)) {
        let s = 0; for (let i = 0; i < 10; i++) s += (x[i] === 'X' ? 10 : +x[i]) * (10 - i);
        if (s % 11) return null;
        const b = '978' + x.slice(0, 9); let t = 0; for (let i = 0; i < 12; i++) t += +b[i] * (i % 2 ? 3 : 1);
        return b + ((10 - t % 10) % 10);
    }
    return null;
}
function rapikanPengarang(list) {
    const a = (list || []).map(v => String(v).trim()).filter(Boolean);
    return a.length > 2 ? a[0] + ', dkk' : a.join(', ');
}
function tahunDari(t) { const m = String(t || '').match(/(19|20)\d{2}/); return m ? m[0] : ''; }

async function ambilJson(url, ms = 9000) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), ms);
    try { const r = await fetch(url, { signal: ac.signal }); return r.ok ? await r.json() : null; }
    catch (e) { return null; } finally { clearTimeout(tm); }
}
/** Cari data buku dari ISBN: Google Books, lalu Open Library */
async function cariDataIsbn(isbn) {
    const g = await ambilJson('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn);
    const v = g && g.items && g.items[0] && g.items[0].volumeInfo;
    if (v && v.title) return {
        sumber: 'Google Books', isbn, judul: v.title + (v.subtitle ? ': ' + v.subtitle : ''),
        pengarang: rapikanPengarang(v.authors), penerbit: v.publisher || '', tahunTerbit: tahunDari(v.publishedDate)
    };
    const o = await ambilJson('https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data');
    const b = o && o['ISBN:' + isbn];
    if (b && b.title) return {
        sumber: 'Open Library', isbn, judul: b.title + (b.subtitle ? ': ' + b.subtitle : ''),
        pengarang: rapikanPengarang((b.authors || []).map(a => a.name)), penerbit: ((b.publishers || [])[0] || {}).name || '', tahunTerbit: tahunDari(b.publish_date)
    };
    return null;
}

function scanStatus(t, jenis = '') { const el = $('#scan-status'); el.textContent = t; el.className = 'scan-status ' + jenis; }
function scanLangkah(foto) {
    $('#step-isbn').className = foto ? 'selesai' : 'aktif';
    $('#step-foto').className = foto ? 'aktif' : '';
    $('#scan-frame').classList.toggle('foto', foto);
    $('#btn-scan-foto').classList.toggle('btn-primary', foto);
    $('#btn-scan-foto').classList.toggle('btn-outline', !foto);
}
function berhentiKamera() {
    clearInterval(SC.timer); SC.timer = null;
    if (SC.stream) { SC.stream.getTracks().forEach(t => t.stop()); SC.stream = null; }
}
function tutupScan() { berhentiKamera(); $('#modal-scan').hidden = true; }

async function bukaScan() {
    Object.assign(SC, { isbn: '', sibuk: false, selesai: false });
    $('#scan-gambar').hidden = true; $('#scan-isbn-ketik').value = '';
    $('#scan-frame').classList.remove('ok');
    scanLangkah(false);
    $('#modal-scan').hidden = false;
    scanStatus('Menyalakan kamera...');
    try {
        SC.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        const v = $('#scan-video'); v.srcObject = SC.stream; await v.play().catch(() => {});
        try { const t = SC.stream.getVideoTracks()[0], c = t.getCapabilities ? t.getCapabilities() : {}; if (c.focusMode && c.focusMode.includes('continuous')) t.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
        scanStatus('Arahkan kamera ke barcode ISBN di sampul belakang buku.');
        mulaiDeteksi();
    } catch (e) {
        scanStatus('Kamera tidak bisa dibuka. Ketik ISBN, atau tekan "Pilih Foto".', 'err');
    }
}

function siapkanPembaca() {
    if (SC.detector === null && 'BarcodeDetector' in window) {
        try { SC.detector = new BarcodeDetector({ formats: ['ean_13'] }); } catch (e) { SC.detector = false; }
    }
    if (!SC.reader && window.ZXing) {
        const r = new ZXing.MultiFormatReader(), h = new Map();
        h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13]);
        h.set(ZXing.DecodeHintType.TRY_HARDER, true);
        r.setHints(h); SC.reader = r;
    }
}
/** Baca barcode EAN-13 dari gambar/video; kembalikan ISBN-13 atau null */
async function bacaBarcode(sumber, w, h) {
    siapkanPembaca();
    if (SC.detector) {
        try { const hasil = await SC.detector.detect(sumber); for (const b of hasil) { const i = normalIsbn(b.rawValue); if (i) return i; } } catch (e) {}
    }
    if (!SC.reader) return null;
    const cv = $('#scan-canvas'), skala = Math.min(1, 1000 / w);
    cv.width = Math.round(w * skala); cv.height = Math.round(h * skala);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sumber, 0, 0, cv.width, cv.height);
    try {
        const r = SC.reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(cv))));
        return normalIsbn(r.getText());
    } catch (e) { return null; }
}
function mulaiDeteksi() {
    clearInterval(SC.timer);
    let jalan = false;
    SC.timer = setInterval(async () => {
        const v = $('#scan-video');
        if (jalan || SC.sibuk || SC.isbn || !v.videoWidth) return;
        jalan = true;
        const isbn = await bacaBarcode(v, v.videoWidth, v.videoHeight);
        jalan = false;
        if (isbn && !SC.isbn) prosesIsbn(isbn);
    }, 300);
}

async function prosesIsbn(isbn) {
    SC.isbn = isbn; SC.sibuk = true;
    clearInterval(SC.timer);
    $('#scan-frame').classList.add('ok');
    try { navigator.vibrate && navigator.vibrate(80); } catch (e) {}
    $('#scan-isbn-ketik').value = isbn;
    const ada = S.buku.find(b => normalIsbn(b.isbn) === isbn);
    if (!navigator.onLine) {
        SC.sibuk = false;
        if (ada) return selesaiIsi({ sumber: 'katalog perpustakaan', isbn, judul: ada.judul, pengarang: ada.pengarang, penerbit: ada.penerbit, tahunTerbit: ada.tahunTerbit, kategori: ada.kategori });
        scanStatus(`ISBN ${isbn} terbaca, tapi sedang offline sehingga data tidak bisa dicari. ISBN tetap diisikan.`, 'err');
        return selesaiIsi({ sumber: 'scan ISBN (offline)', isbn });
    }
    scanStatus(`ISBN ${isbn} terbaca. Mencari data buku...`);
    const d = await cariDataIsbn(isbn);
    SC.sibuk = false;
    if (d) { if (ada && ada.kategori) d.kategori = ada.kategori; return selesaiIsi(d); }
    if (ada) return selesaiIsi({ sumber: 'katalog perpustakaan', isbn, judul: ada.judul, pengarang: ada.pengarang, penerbit: ada.penerbit, tahunTerbit: ada.tahunTerbit, kategori: ada.kategori });
    scanLangkah(true);
    $('#scan-frame').classList.remove('ok');
    scanStatus(`Data ISBN ${isbn} tidak ditemukan. Sekarang foto SAMPUL DEPAN buku, lalu tekan "Foto Sampul Depan".`, 'err');
}

/** Ambil gambar (dari video atau file), perkecil, lalu kirim ke AI lewat server */
function gambarKeJpeg(sumber, w, h) {
    const cv = document.createElement('canvas'), s = Math.min(1, 1024 / Math.max(w, h));
    cv.width = Math.round(w * s); cv.height = Math.round(h * s);
    cv.getContext('2d').drawImage(sumber, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.82);
}
async function bacaSampulAI(dataUrl) {
    if (!getPw()) { tutupScan(); bukaLogin('kelola'); return; }
    if (!navigator.onLine) return scanStatus('Membaca sampul dengan AI butuh internet. Isi data secara manual, atau coba lagi saat online.', 'err');
    SC.sibuk = true;
    $('#scan-gambar').src = dataUrl; $('#scan-gambar').hidden = false;
    berhentiKamera();
    scanStatus('AI sedang membaca sampul buku... (5–20 detik)');
    busy($('#btn-scan-foto'), true, 'Membaca...');
    const res = await kirimRaw({ action: 'bacaSampul', gambar: dataUrl.split(',')[1], isbn: SC.isbn, ...kredensial() });
    busy($('#btn-scan-foto'), false);
    SC.sibuk = false;
    if (res._network) return scanStatus('Gagal terhubung ke server. Periksa internet lalu coba lagi.', 'err');
    if (pwSalah(res.message)) { tutupScan(); logout(true); bukaLogin('kelola'); return; }
    if (res.status !== 'success' || !res.data) {
        scanStatus(res.message || 'AI gagal membaca sampul.', 'err');
        $('#scan-gambar').hidden = true; return bukaUlangKamera();
    }
    const d = res.data;
    if (!d.judul) { scanStatus('Judul tidak terbaca. Coba foto lebih dekat dan terang, sampul memenuhi bingkai.', 'err'); $('#scan-gambar').hidden = true; return bukaUlangKamera(); }
    selesaiIsi({ ...d, isbn: normalIsbn(d.isbn) || SC.isbn || d.isbn || '', sumber: 'foto sampul (AI)' });
}
async function bukaUlangKamera() {
    try {
        SC.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        const v = $('#scan-video'); v.srcObject = SC.stream; await v.play().catch(() => {});
        if (!SC.isbn) mulaiDeteksi();
    } catch (e) {}
}

/** Isi form Tambah Buku, lalu tampilkan untuk diperiksa sebelum disimpan */
function selesaiIsi(d) {
    tutupScan();
    go('kelola');
    $$('#kelola-tabs .tab').find(t => t.dataset.tab === 'tab-tambah-buku').click();
    $$('#tab-tambah-buku .auto-isi').forEach(el => el.classList.remove('auto-isi'));
    const isi = (sel, v) => { const el = $(sel); if (el && v) { el.value = v; el.classList.add('auto-isi'); } };
    isi('#buku-judul', d.judul); isi('#buku-pengarang', d.pengarang); isi('#buku-penerbit', d.penerbit);
    isi('#buku-isbn', d.isbn); isi('#buku-tahun', d.tahunTerbit); isi('#buku-kategori', d.kategori);
    $('#tab-tambah-buku details.more-fields').open = true;

    // Usulan akhiran & nomor inventaris berikutnya
    const sama = S.buku.filter(b => (d.isbn && normalIsbn(b.isbn) === d.isbn) || (d.judul && b.judul.toLowerCase().trim() === d.judul.toLowerCase().trim()));
    const sfx = $('#buku-suffix');
    if (!sfx.value.trim()) sfx.value = lsGet(SUFFIX_KEY, '') || '';
    const akhiran = sfx.value.trim();
    let usul = '';
    if (akhiran) {
        const nomor = S.buku.filter(b => b.noInv.endsWith(akhiran)).map(b => parseInt(b.noInv, 10)).filter(n => !isNaN(n));
        const berikut = (nomor.length ? Math.max(...nomor) : 0) + 1;
        usul = ` Nomor terakhir dengan akhiran <span class="mono">${esc(akhiran)}</span> adalah <b>${nomor.length ? berikut - 1 : '–'}</b>, jadi rentang bisa mulai dari <b>${String(berikut).padStart(2, '0')}</b>.`;
    }
    const info = $('#auto-isi-info');
    info.className = 'alert ' + (d.judul ? 'alert-green' : 'alert-amber');
    info.innerHTML = (d.judul
        ? `<b><i class="fa-solid fa-circle-check"></i> Data terisi dari ${esc(d.sumber)}.</b> Periksa isian berwarna hijau dan ubah bila perlu.`
        : `<b>Hanya ISBN yang terisi.</b> Lengkapi judul dan data lainnya secara manual.`) +
        (sama.length ? `<br><i class="fa-solid fa-circle-info"></i> Judul ini sudah ada di katalog (<b>${sama.length}</b> eksemplar, contoh <span class="mono">${esc(sama[0].noInv)}</span>). Isi rentang lanjutan untuk menambah eksemplar.` : '') +
        `<br>Langkah terakhir: isi <b>Rentang No. Inventaris</b> dan <b>Akhiran</b>, lalu tekan <b>Tambah Buku Massal</b>.` + usul;
    info.hidden = false;
    hintRange();
    toast(d.judul ? 'Data buku terisi. Periksa dulu sebelum menyimpan.' : 'ISBN terisi.', 'ok', 3500);
    setTimeout(() => { info.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#buku-range').focus({ preventScroll: true }); }, 150);
}

$('#btn-buka-scan').addEventListener('click', bukaScan);
$('#btn-scan-tutup').addEventListener('click', tutupScan);
$('#btn-isbn-cari').addEventListener('click', () => {
    const i = normalIsbn($('#scan-isbn-ketik').value);
    if (!i) return scanStatus('ISBN tidak valid. Periksa kembali 10 atau 13 digitnya.', 'err');
    SC.isbn = ''; prosesIsbn(i);
});
$('#scan-isbn-ketik').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#btn-isbn-cari').click(); } });
$('#btn-scan-foto').addEventListener('click', () => {
    const v = $('#scan-video');
    if (!SC.stream || !v.videoWidth) return $('#scan-file').click();
    bacaSampulAI(gambarKeJpeg(v, v.videoWidth, v.videoHeight));
});
$('#btn-scan-galeri').addEventListener('click', () => $('#scan-file').click());
$('#scan-file').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const img = new Image(); img.src = URL.createObjectURL(f);
    try { await img.decode(); } catch (er) { return scanStatus('Foto tidak bisa dibuka.', 'err'); }
    if (!SC.isbn) {
        scanStatus('Memeriksa barcode di foto...');
        const i = await bacaBarcode(img, img.naturalWidth, img.naturalHeight);
        if (i) { URL.revokeObjectURL(img.src); return prosesIsbn(i); }
    }
    const url = gambarKeJpeg(img, img.naturalWidth, img.naturalHeight);
    URL.revokeObjectURL(img.src);
    bacaSampulAI(url);
});
$('#modal-scan').addEventListener('click', e => { if (e.target.id === 'modal-scan') tutupScan(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') berhentiKamera(); });

// ==========================================================
// == SCAN KAMERA UNTUK PINJAM & KEMBALI ==
// Kartu anggota berisi NIS (QR / barcode), label buku berisi No. Inventaris (CODE128)
// ==========================================================
const SK = { mode: '', stream: null, timer: null, detector: null, reader: null, terakhir: '', jedaSampai: 0, buku: null, anggota: null };
const SK_LANJUT_KEY = 'perpus_scan_langsung';

function bunyi(ok = true) {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = ok ? 1250 : 330; o.type = 'sine'; g.gain.value = .12;
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + (ok ? .09 : .25));
        setTimeout(() => ac.close(), 400);
    } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(ok ? 60 : [80, 60, 80]); } catch (e) {}
}
function skStatus(t, jenis = '') { const el = $('#sk-status'); el.textContent = t; el.className = 'scan-status ' + jenis; }
function skChips() {
    const b = SK.buku, a = SK.anggota;
    const chipBuku = `<div class="sk-chip ${b ? (SK.mode === 'pinjam' && !isTersedia(b) ? 'err' : 'ok') : ''}">Buku${b ? `<b>${esc(b.judul)}</b><span class="mono">${esc(b.noInv)}</span>` : '<b>— belum —</b>'}</div>`;
    if (SK.mode === 'kembali') { $('#sk-chips').className = 'sk-chips satu'; $('#sk-chips').innerHTML = chipBuku; return; }
    $('#sk-chips').className = 'sk-chips';
    $('#sk-chips').innerHTML = `<div class="sk-chip ${a ? 'ok' : ''}">Peminjam${a ? `<b>${esc(a.nama)}</b><span>${esc(a.kelas)} · NIS ${esc(a.nis)}</span>` : '<b>— belum —</b>'}</div>` + chipBuku;
}
function skBerhenti() {
    clearInterval(SK.timer); SK.timer = null;
    if (SK.stream) { SK.stream.getTracks().forEach(t => t.stop()); SK.stream = null; }
}
function skTutup() { skBerhenti(); $('#modal-sirkulasi').hidden = true; }

function skSiapkanPembaca() {
    if (SK.detector === null && 'BarcodeDetector' in window) {
        try { SK.detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] }); } catch (e) { SK.detector = false; }
    }
    if (!SK.reader && window.ZXing) {
        const r = new ZXing.MultiFormatReader(), h = new Map();
        h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.EAN_13]);
        h.set(ZXing.DecodeHintType.TRY_HARDER, true);
        r.setHints(h); SK.reader = r;
    }
}
async function skBaca(v) {
    skSiapkanPembaca();
    if (SK.detector) {
        try { const h = await SK.detector.detect(v); if (h.length) return h[0].rawValue; } catch (e) {}
    }
    if (!SK.reader) return null;
    const cv = $('#sk-canvas'), sk = Math.min(1, 1000 / v.videoWidth);
    cv.width = Math.round(v.videoWidth * sk); cv.height = Math.round(v.videoHeight * sk);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, cv.width, cv.height);
    try { return SK.reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(cv)))).getText(); }
    catch (e) { return null; }
}

async function bukaScanSirkulasi(mode) {
    if (!S.loaded) return toast('Data belum dimuat.', 'err');
    Object.assign(SK, { mode, terakhir: '', jedaSampai: 0, buku: null, anggota: null });
    if (mode === 'pinjam') {
        SK.buku = bukuByInv($('#pinjam-buku').value.trim()) || null;
        SK.anggota = cariAnggota($('#pinjam-anggota').value) || null;
    }
    $('#sk-judul').innerHTML = mode === 'pinjam' ? '<i class="fa-solid fa-qrcode"></i> Scan Peminjaman' : '<i class="fa-solid fa-barcode"></i> Scan Pengembalian';
    $('#sk-lanjut-wrap').hidden = mode !== 'pinjam';
    $('#sk-lanjut').checked = !!lsGet(SK_LANJUT_KEY, false);
    $('#btn-sk-senter').hidden = true;
    skChips();
    $('#modal-sirkulasi').hidden = false;
    skStatus('Menyalakan kamera...');
    try {
        SK.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const v = $('#sk-video'); v.srcObject = SK.stream; await v.play().catch(() => {});
        try {
            const t = SK.stream.getVideoTracks()[0], c = t.getCapabilities ? t.getCapabilities() : {};
            if (c.focusMode && c.focusMode.includes('continuous')) t.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            if (c.torch) $('#btn-sk-senter').hidden = false;
        } catch (e) {}
        skStatus(mode === 'pinjam' ? 'Arahkan kamera ke kartu anggota atau label buku (urutan bebas).' : 'Arahkan kamera ke barcode label buku.');
        let jalan = false;
        SK.timer = setInterval(async () => {
            const vv = $('#sk-video');
            if (jalan || !vv.videoWidth || Date.now() < SK.jedaSampai) return;
            jalan = true;
            const kode = await skBaca(vv);
            jalan = false;
            if (kode) skProses(String(kode).trim());
        }, 250);
    } catch (e) {
        skStatus('Kamera tidak bisa dibuka. Izinkan akses kamera, atau ketik / pakai scanner USB.', 'err');
    }
}

function skProses(kode) {
    if (!kode || (kode === SK.terakhir && Date.now() < SK.jedaSampai + 2500)) return;
    SK.terakhir = kode; SK.jedaSampai = Date.now() + 1200;
    const b = bukuByInv(kode);
    const a = !b && SK.mode === 'pinjam' ? anggotaByNis(kode) : null;
    const frame = $('#sk-frame');
    const kedip = ok => { frame.classList.add(ok ? 'ok' : 'err'); setTimeout(() => frame.classList.remove('ok', 'err'), 600); };

    if (SK.mode === 'kembali') {
        if (!b) { bunyi(false); kedip(false); return skStatus(`Kode "${kode}" bukan nomor inventaris yang terdaftar.`, 'err'); }
        if (!isDipinjam(b)) { bunyi(false); kedip(false); SK.buku = b; skChips(); return skStatus(`${b.noInv} tidak sedang dipinjam (status: ${b.status}).`, 'err'); }
        bunyi(true); kedip(true); SK.buku = b; skChips();
        $('#kembali-buku').value = b.noInv; $('#kembali-hasil').hidden = true;
        skTutup(); previewKembali();
        $('#btn-kembali').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#btn-kembali').focus({ preventScroll: true });
        return toast('Buku terbaca. Periksa denda, lalu tekan Proses Pengembalian.', 'ok', 3500);
    }

    if (b) {
        SK.buku = b; $('#pinjam-buku').value = b.noInv;
        if (!isTersedia(b)) { bunyi(false); kedip(false); skStatus(`${b.noInv} berstatus "${b.status}", tidak bisa dipinjam. Scan buku lain.`, 'err'); skChips(); previewPinjam(); return; }
        bunyi(true); kedip(true);
    } else if (a) {
        SK.anggota = a; $('#pinjam-anggota').value = a.nis; bunyi(true); kedip(true);
        const telat = pinjamanAktif().filter(x => x.nis === a.nis && x.telat > 0);
        if (telat.length) skStatus(`Perhatian: ${a.nama} punya ${telat.length} buku terlambat.`, 'err');
    } else {
        bunyi(false); kedip(false);
        return skStatus(`Kode "${kode}" tidak dikenal sebagai kartu anggota atau label buku.`, 'err');
    }
    skChips(); previewPinjam();
    if (SK.buku && SK.anggota && isTersedia(SK.buku)) {
        skTutup();
        if ($('#sk-lanjut').checked) { $('#btn-pinjam').click(); return; }
        $('#btn-pinjam').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#btn-pinjam').focus({ preventScroll: true });
        toast('Kartu dan buku terbaca. Tekan Proses Peminjaman.', 'ok', 3500);
    } else if (!$('#sk-status').classList.contains('err')) {
        skStatus(SK.anggota ? 'Peminjam terbaca. Sekarang scan label buku.' : 'Buku terbaca. Sekarang scan kartu anggota.', 'ok');
    }
}

$('#btn-scan-pinjam').addEventListener('click', () => bukaScanSirkulasi('pinjam'));
$('#btn-scan-kembali').addEventListener('click', () => bukaScanSirkulasi('kembali'));
$('#btn-sk-tutup').addEventListener('click', skTutup);
$('#modal-sirkulasi').addEventListener('click', e => { if (e.target.id === 'modal-sirkulasi') skTutup(); });
$('#sk-lanjut').addEventListener('change', e => lsSet(SK_LANJUT_KEY, e.target.checked));
$('#btn-sk-senter').addEventListener('click', async function () {
    try {
        const t = SK.stream.getVideoTracks()[0], nyala = !this.classList.contains('aktif');
        await t.applyConstraints({ advanced: [{ torch: nyala }] }); this.classList.toggle('aktif', nyala);
    } catch (e) { toast('Senter tidak didukung di perangkat ini.', 'info'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') skBerhenti(); });

// ==========================================================
// == BACKUP DATA (admin) ==
// ==========================================================
async function muatInfoBackup() {
    const el = $('#backup-info');
    if (!navigator.onLine) { el.textContent = 'Butuh internet untuk melihat info backup.'; return; }
    const r = await kirimAkun({ action: 'infoBackup' });
    if (r.status !== 'success') { el.textContent = r.message || 'Info backup tidak tersedia.'; return; }
    const t = r.terakhir, g = r.gagal;
    let h = r.jadwal ? `Jadwal otomatis: <b>${esc(r.jadwal)}</b>.<br>` : '<span style="color:#b45309"><b>Jadwal otomatis belum dipasang.</b> Jalankan fungsi <span class="mono">pasangBackupMingguan</span> sekali di editor Apps Script.</span><br>';
    h += t ? `Backup terakhir: <b>${esc(new Date(t.waktu).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }))}</b> · ${t.jumlah} backup tersimpan (maks. 8) · <a href="${esc(t.url || t.folderUrl)}" target="_blank" rel="noopener">Buka file backup</a>` : 'Belum pernah ada backup.';
    if (g && (!t || new Date(g.waktu) > new Date(t.waktu))) h += `<br><span style="color:#b91c1c"><b>Backup otomatis terakhir gagal</b> (${esc(new Date(g.waktu).toLocaleString('id-ID'))}): ${esc(g.pesan)}</span>`;
    el.innerHTML = h;
}
$('#btn-muat-backup').addEventListener('click', muatInfoBackup);
$('#btn-backup-sekarang').addEventListener('click', async function () {
    if (!navigator.onLine) return toast('Backup butuh koneksi internet.', 'err');
    busy(this, true, 'Membuat backup... (bisa 10-30 detik)');
    const r = await kirimAkun({ action: 'backupSekarang' });
    busy(this, false);
    laporHasil(r);
    if (r.status === 'success') muatInfoBackup();
});
$$('#kelola-tabs .tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.tab === 'tab-denda' && isSuperAdmin()) muatInfoBackup(); }));

// ==========================================================
// == PENGINGAT WHATSAPP ==
// ==========================================================
const WA_KEY = 'perpus_wa_template';
const WA_BAWAAN = "Assalamu'alaikum warahmatullahi wabarakatuh.\n\nYth. Bapak/Ibu wali dari *{nama}* (kelas {kelas}).\nKami dari Perpustakaan MTsS Nurul Kamal Sambirejo memberitahukan bahwa per {tanggal} ananda belum mengembalikan {jumlah} buku berikut:\n{daftar}\n\nPerkiraan denda saat ini: *{total}*.\nMohon buku dapat segera dikembalikan ke perpustakaan. Terima kasih.\n\nPetugas Perpustakaan MTsS Nurul Kamal";
function waTemplate() { return lsGet(WA_KEY, '') || WA_BAWAAN; }
/** Nomor HP Indonesia -> format internasional untuk wa.me (628xxxx) */
function nomorWA(hp) {
    let d = String(hp || '').replace(/[^0-9]/g, '');
    if (!d) return '';
    if (d.startsWith('0')) d = '62' + d.slice(1);
    else if (d.startsWith('8')) d = '62' + d;
    return d.length >= 10 && d.length <= 15 ? d : '';
}
function waLink(hp, pesan) { const n = nomorWA(hp); return n ? `https://wa.me/${n}${pesan ? '?text=' + encodeURIComponent(pesan) : ''}` : '#'; }
function pesanPengingat(nis) {
    const a = anggotaByNis(nis) || {};
    const telat = pinjamanAktif().filter(x => x.nis === nis && x.telat > 0);
    const daftar = telat.map((x, i) => `${i + 1}. ${x.buku.judul} (${x.buku.noInv}), jatuh tempo ${tglPanjang(x.jatuhTempo)}, terlambat ${x.telat} hari`).join('\n');
    const isi = { nama: a.nama || (telat[0] && telat[0].nama) || nis, kelas: a.kelas || '-', daftar, jumlah: String(telat.length), total: rupiah(telat.reduce((s, x) => s + x.denda, 0)), tanggal: tglPanjang(new Date()) };
    return waTemplate().replace(/\{(nama|kelas|daftar|jumlah|total|tanggal)\}/g, (m, k) => isi[k]);
}
function tombolWA(nis) {
    const a = anggotaByNis(nis);
    if (!a || !nomorWA(a.hp)) return `<span class="muted" title="No. HP belum diisi di data anggota" style="font-size:12px">No. HP<br>belum ada</span>`;
    return `<a class="btn btn-wa btn-xs" href="${waLink(a.hp, pesanPengingat(nis))}" target="_blank" rel="noopener" title="Kirim pengingat ke ${esc(a.hp)}"><i class="fa-brands fa-whatsapp"></i> Kirim</a>`;
}
$('#wa-template').value = waTemplate();
$('#btn-wa-simpan').addEventListener('click', () => {
    const t = $('#wa-template').value.trim();
    if (!t) return toast('Pesan tidak boleh kosong.', 'err');
    lsSet(WA_KEY, t === WA_BAWAAN ? '' : t);
    toast('Pesan pengingat disimpan di perangkat ini.', 'ok');
    if (currentPage() === 'terlambat') renderTerlambat();
});
$('#btn-wa-reset').addEventListener('click', () => { $('#wa-template').value = WA_BAWAAN; lsSet(WA_KEY, ''); toast('Pesan dikembalikan ke bawaan.', 'info'); });

// Pengaturan denda
$('#btn-simpan-set').addEventListener('click', async function () {
    const lama = $('#set-hari').value.trim(), denda = $('#set-denda').value.trim();
    if (!lama || denda === '') return toast('Isi lama pinjam dan denda.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await aksi({ action: 'simpanPengaturan', settings: { lamaPinjam: lama, denda } });
    busy(this, false);
    if (laporHasil(res, 'Pengaturan disimpan.')) renderSemua();
});

// ==========================================================
// == MULAI ==
// ==========================================================
// Tampilkan data tersimpan dulu (cepat & bisa offline), lalu sinkron dengan server
if (IN_APP) document.body.classList.add('in-app');
$('#info-versi').textContent = 'Versi web ' + VERSI_WEB + (IN_APP && window.AndroidApp.versiApk ? ' · APK ' + window.AndroidApp.versiApk() : '');
setAdminUI();
isiEditBuku(); isiEditAnggota();
if (muatCache()) { S.loaded = true; S.online = navigator.onLine; }
tampilkan(currentPage());
if (S.loaded) renderSemua();
updateSyncUI();
sinkron({ muat: true });

// Dipanggil APK saat pembaruan tampilan/fitur dari GitHub sudah terunduh
window.onPembaruanSiap = function (v) {
    toast('Pembaruan aplikasi (versi ' + v + ') sudah diunduh.', 'ok', 0, 'Muat ulang sekarang', () => location.reload());
};
// Website biasa: pasang service worker agar bisa dibuka offline & dipasang di layar utama
if (!IN_APP && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

})();
