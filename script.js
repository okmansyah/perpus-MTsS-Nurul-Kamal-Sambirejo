/* =========================================================
   Perpustakaan Digital MTsS Nurul Kamal Sambirejo
   Dikembangkan oleh Okmansyah
   ========================================================= */
(function () {
'use strict';

// ==========================================================
// == PENGATURAN UTAMA ==
// ==========================================================
const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?single=true&output=csv&gid=';
const URL_BUKU     = SHEET + '0';
const URL_ANGGOTA  = SHEET + '485044064';
const URL_HISTORY  = SHEET + '658377134';
const URL_SETTINGS = SHEET + '1547395606';
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
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BLN3 = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

// ==========================================================
// == STATE ==
// ==========================================================
const S = { buku: [], anggota: [], history: [], settings: { LamaPinjamHari: 7, DendaPerHari: 1000 }, loaded: false };
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

function toast(msg, type = 'info', ms = 4500) {
    const ico = { ok: 'fa-circle-check', err: 'fa-circle-exclamation', info: 'fa-circle-info' }[type] || 'fa-circle-info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<i class="fa-solid ${ico}"></i><div>${esc(msg)}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
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
const AUTH_KEY = 'perpus_admin_pw', LAST_KEY = 'perpus_admin_last';
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
    document.body.classList.toggle('is-admin', on);
    $('#chip-admin').hidden = !on;
    $('#btn-auth').innerHTML = on ? '<i class="fa-solid fa-right-from-bracket"></i> <span>Keluar Admin</span>' : '<i class="fa-solid fa-lock"></i> <span>Login Admin</span>';
}
function logout(silent) {
    try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(LAST_KEY); } catch (e) {}
    setAdminUI();
    if (!silent) toast('Anda telah keluar dari mode admin.', 'info');
    const cur = currentPage();
    if (isAdminPage(cur)) go('dashboard');
}
function bukaLogin(targetPage) {
    pendingPage = targetPage || null;
    $('#login-error').textContent = '';
    $('#login-pass').value = '';
    $('#modal-login').hidden = false;
    setTimeout(() => $('#login-pass').focus(), 50);
}
function tutupLogin() { $('#modal-login').hidden = true; pendingPage = null; }
function pwSalah(msg) { return /password|sandi/i.test(msg || '') && /salah|invalid|wrong|tidak valid/i.test(msg || ''); }

$('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#login-pass').value.trim();
    if (!pw) return;
    const btn = $('#btn-login');
    busy(btn, true, 'Memeriksa...');
    $('#login-error').textContent = '';
    const res = await kirimRaw({ action: 'cekLogin', password: pw });
    busy(btn, false);
    if (res._network) { $('#login-error').textContent = 'Tidak bisa menghubungi server. Periksa koneksi internet.'; return; }
    if (pwSalah(res.message)) { $('#login-error').textContent = 'Password salah. Coba lagi.'; $('#login-pass').select(); return; }
    try { sessionStorage.setItem(AUTH_KEY, pw); sessionStorage.setItem(LAST_KEY, Date.now()); } catch (er) {}
    const target = pendingPage;
    tutupLogin();
    setAdminUI();
    toast('Berhasil masuk sebagai admin.', 'ok');
    if (target) go(target);
});
$('#btn-login-batal').addEventListener('click', tutupLogin);
$('#pw-eye').addEventListener('click', () => {
    const i = $('#login-pass'); i.type = i.type === 'password' ? 'text' : 'password';
    $('#pw-eye i').className = i.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
});
$('#btn-auth').addEventListener('click', () => isAdmin() ? logout() : bukaLogin(null));
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
setInterval(() => { if (sessionStorage.getItem(AUTH_KEY) && !getPw()) toast('Sesi admin berakhir karena tidak aktif.', 'info'); }, 60000);

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
async function kirim(data) {
    const pw = getPw();
    if (!pw) { bukaLogin(currentPage()); return { status: 'error', message: 'Silakan login admin terlebih dahulu.' }; }
    const res = await kirimRaw({ ...data, password: pw });
    if (pwSalah(res.message)) {
        logout(true);
        bukaLogin(currentPage());
        $('#login-error').textContent = 'Password admin telah berubah. Silakan login ulang.';
    }
    return res;
}

// ==========================================================
// == MEMUAT DATA ==
// ==========================================================
async function ambilCSV(url) {
    const res = await fetch(url + '&t=' + Date.now());
    if (!res.ok) throw new Error('Status ' + res.status);
    return parseCSV(await res.text()).slice(1);
}

async function muatSemua() {
    const btn = $('#btn-refresh');
    btn.classList.add('spin');
    const hasil = await Promise.allSettled([ambilCSV(URL_BUKU), ambilCSV(URL_ANGGOTA), ambilCSV(URL_HISTORY), ambilCSV(URL_SETTINGS)]);
    btn.classList.remove('spin');
    const [rb, ra, rh, rs] = hasil;

    if (rb.status === 'fulfilled') {
        S.buku = rb.value.map(k => ({
            noInv: k[0] || '', judul: k[1] || '', pengarang: k[2] || '', penerbit: k[3] || '',
            status: k[4] || '', nis: k[5] || '', tglPinjamRaw: k[6] || '', jatuhTempoRaw: k[7] || '', tglMasukRaw: k[8] || ''
        })).filter(b => b.noInv);
    } else toast('Gagal memuat data buku: ' + rb.reason.message, 'err');

    if (ra.status === 'fulfilled') {
        S.anggota = ra.value.map(k => ({ nis: k[0] || '', nama: k[1] || '', kelas: k[2] || '', status: k[3] || '' })).filter(a => a.nis || a.nama);
    } else toast('Gagal memuat data anggota.', 'err');

    if (rh.status === 'fulfilled') {
        S.history = rh.value.map(k => ({ ts: k[0] || '', tgl: parseTanggal(k[0]), noInv: k[1] || '', judul: k[2] || '', nis: k[3] || '', nama: k[4] || '', aksi: k[5] || '' }));
    } else toast('Gagal memuat riwayat.', 'err');

    if (rs.status === 'fulfilled') {
        rs.value.forEach(k => { if (k[0]) S.settings[k[0].trim()] = (k[1] || '').trim(); });
    }

    S.loaded = true;
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
        if (!map.has(key)) map.set(key, { judul: b.judul, pengarang: b.pengarang, penerbit: b.penerbit, total: 0, tersedia: 0 });
        const r = map.get(key); r.total++; if (isTersedia(b)) r.tersedia++;
        if (!r.penerbit && b.penerbit) r.penerbit = b.penerbit;
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
$('#btn-refresh').addEventListener('click', () => muatSemua().then(() => toast('Data diperbarui.', 'ok', 2000)));
$$('.modal [data-close]').forEach(b => b.addEventListener('click', () => b.closest('.modal').hidden = true));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal').forEach(m => { if (!m.hidden) { m.hidden = true; pendingPage = null; } }); });

// ==========================================================
// == RENDER ==
// ==========================================================
function renderSemua() {
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
        terlambat: renderTerlambat, riwayat: renderRiwayat, anggota: renderAnggota, laporan: renderLaporan,
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
    if (q) list = list.filter(r => (r.judul + ' ' + r.pengarang + ' ' + r.penerbit).toLowerCase().includes(q));
    if (f === 'ada') list = list.filter(r => r.tersedia > 0);
    if (f === 'habis') list = list.filter(r => r.tersedia === 0);
    $('#tb-katalog').innerHTML = list.length ? list.map(r => `
        <tr>
            <td><b>${esc(r.judul)}</b></td>
            <td>${esc(r.pengarang)}</td>
            <td>${esc(r.penerbit) || '<span class="muted">–</span>'}</td>
            <td class="t-center">${r.total}</td>
            <td class="t-center"><span class="badge ${r.tersedia > 0 ? 'b-green' : 'b-red'}">${r.tersedia}</span></td>
        </tr>`).join('') : '<tr><td colspan="5" class="loading">Tidak ada buku yang cocok.</td></tr>';
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
    const res = await kirim({ action: 'pinjamBuku', noInventaris: b.noInv, nis: a.nis });
    busy(this, false);
    if (res.status !== 'success') return toast(res.message || 'Gagal memproses.', 'err', 7000);
    const now = new Date(), jt = new Date(); jt.setDate(jt.getDate() + lamaPinjam());
    Object.assign(b, { status: 'Dipinjam', nis: a.nis, tglPinjamRaw: tglJam(now).replace(',', ''), jatuhTempoRaw: `${jt.getDate()}/${jt.getMonth() + 1}/${jt.getFullYear()}` });
    S.history.push({ ts: 'Baru saja', tgl: now, noInv: b.noInv, judul: b.judul, nis: a.nis, nama: a.nama, aksi: 'Dipinjam' });
    toast(`${res.message || 'Berhasil.'} Jatuh tempo ${tglPanjang(jt)}.`, 'ok', 6000);
    $('#pinjam-buku').value = ''; $('#pinjam-anggota').value = '';
    isiDatalist(); renderStats(); previewPinjam();
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
    if (!x) { pv.hidden = true; return; }
    pv.classList.toggle('warn', x.telat > 0);
    pv.innerHTML = `<div class="pv-title"><i class="fa-solid fa-book"></i> ${esc(x.buku.judul)}</div>
        <div class="pv-meta">${esc(x.buku.noInv)}</div>
        <div class="pv-meta">Peminjam: <b>${esc(x.nama)}</b> ${x.kelas ? '(' + esc(x.kelas) + ')' : ''}</div>
        <div class="pv-meta">Dipinjam: ${tglPendek(x.tglPinjam)} · Jatuh tempo: <b>${tglPendek(x.jatuhTempo)}</b></div>
        ${x.telat > 0 ? `<div style="margin-top:6px;color:#b91c1c"><b>Terlambat ${x.telat} hari · perkiraan denda ${rupiah(x.denda)}</b></div>` : '<div style="margin-top:6px;color:#166534"><b>Tidak terlambat</b></div>'}`;
    pv.hidden = false;
}
$('#kembali-buku').addEventListener('input', () => { $('#kembali-hasil').hidden = true; previewKembali(); });
$('#btn-kembali').addEventListener('click', async function () {
    const inv = $('#kembali-buku').value.trim();
    const b = bukuByInv(inv);
    if (!b) return toast('No. inventaris tidak ditemukan.', 'err');
    if (!isDipinjam(b)) return toast('Buku ini tidak sedang dipinjam.', 'err');
    const info = pinjamanAktif().find(p => p.buku.noInv === inv);
    busy(this, true, 'Memproses... (menghitung denda)');
    const res = await kirim({ action: 'kembalikanBuku', noInventaris: inv });
    busy(this, false);
    if (res.status !== 'success') return toast(res.message || 'Gagal memproses.', 'err', 7000);
    const denda = Number(res.denda) || 0;
    const box = $('#kembali-hasil');
    box.className = 'result-box ' + (denda > 0 ? 'denda' : 'ok');
    box.innerHTML = denda > 0 ? `Buku dikembalikan. Denda yang harus dibayar:<strong style="color:#b91c1c">${rupiah(denda)}</strong>` : `Buku dikembalikan tepat waktu.<strong style="color:#166534">Tanpa denda</strong>`;
    box.hidden = false;
    S.history.push({ ts: 'Baru saja', tgl: new Date(), noInv: inv, judul: b.judul, nis: info ? info.nis : b.nis, nama: info ? info.nama : '', aksi: 'Dikembalikan' });
    Object.assign(b, { status: 'Tersedia', nis: '', tglPinjamRaw: '', jatuhTempoRaw: '' });
    toast(res.message || 'Pengembalian berhasil.', 'ok');
    $('#kembali-buku').value = '';
    isiDatalist(); renderStats(); renderKembali();
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
        </tr>`).join('') : '<tr><td colspan="8" class="loading"><i class="fa-solid fa-circle-check" style="color:#16a34a"></i> Tidak ada buku yang terlambat.</td></tr>';
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
            <td><span class="badge ${/dipinjam/i.test(h.aksi) ? 'b-amber' : 'b-green'}">${esc(h.aksi)}</span></td>
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
    if (q) list = list.filter(a => (a.nama + ' ' + a.nis + ' ' + a.kelas).toLowerCase().includes(q));
    $('#tb-anggota').innerHTML = list.length ? list.map(a => {
        const n = ak.filter(x => x.nis === a.nis); const t = n.some(x => x.telat > 0);
        return `<tr>
            <td class="mono">${esc(a.nis)}</td>
            <td><b>${esc(a.nama)}</b></td>
            <td>${esc(a.kelas)}</td>
            <td><span class="badge ${/aktif/i.test(a.status) && !/non|tidak/i.test(a.status) ? 'b-green' : 'b-gray'}">${esc(a.status) || '–'}</span></td>
            <td class="t-center">${n.length ? `<span class="badge ${t ? 'b-red' : 'b-amber'}">${n.length}</span>` : '<span class="muted">0</span>'}</td>
        </tr>`; }).join('') : '<tr><td colspan="5" class="loading">Tidak ada anggota yang cocok.</td></tr>';
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
    const go = () => setTimeout(() => window.print(), 150);
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
    const buku = { range: $('#buku-range').value.trim(), suffix: $('#buku-suffix').value.trim(), judul: $('#buku-judul').value.trim(), pengarang: $('#buku-pengarang').value.trim(), penerbit: $('#buku-penerbit').value.trim() };
    if (!buku.range || !buku.suffix || !buku.judul) return toast('Rentang, akhiran, dan judul wajib diisi.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await kirim({ action: 'tambahBuku', buku });
    busy(this, false);
    toast(res.message || (res.status === 'success' ? 'Berhasil.' : 'Gagal.'), res.status === 'success' ? 'ok' : 'err', 6000);
    if (res.status === 'success') {
        ['#buku-range', '#buku-judul', '#buku-pengarang', '#buku-penerbit'].forEach(s => $(s).value = '');
        hintRange();
        setTimeout(muatSemua, 1500);
    }
});

// Edit buku
function isiEditBuku() {
    const b = bukuByInv($('#edit-buku-pilih').value.trim());
    const hint = $('#edit-buku-hint');
    $('#edit-buku-judul').value = b ? b.judul : '';
    $('#edit-buku-pengarang').value = b ? b.pengarang : '';
    $('#edit-buku-penerbit').value = b ? b.penerbit : '';
    const locked = b && isDipinjam(b);
    $('#btn-update-buku').disabled = !b || locked;
    $('#btn-hapus-buku').disabled = !b || locked;
    hint.innerHTML = !b ? '' : locked ? '<span style="color:#b45309">Buku ini sedang dipinjam, tidak bisa diubah atau dihapus.</span>' : `Status: ${esc(b.status)}`;
}
$('#edit-buku-pilih').addEventListener('input', isiEditBuku);
$('#btn-update-buku').addEventListener('click', async function () {
    const inv = $('#edit-buku-pilih').value.trim();
    const buku = { noInventaris: inv, judul: $('#edit-buku-judul').value.trim(), pengarang: $('#edit-buku-pengarang').value.trim(), penerbit: $('#edit-buku-penerbit').value.trim() };
    if (!bukuByInv(inv) || !buku.judul) return toast('Pilih buku dan isi judul.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await kirim({ action: 'updateBuku', buku });
    busy(this, false);
    toast(res.message || '', res.status === 'success' ? 'ok' : 'err');
    if (res.status === 'success') { Object.assign(bukuByInv(inv), { judul: buku.judul, pengarang: buku.pengarang, penerbit: buku.penerbit }); isiDatalist(); }
});
$('#btn-hapus-buku').addEventListener('click', async function () {
    const inv = $('#edit-buku-pilih').value.trim();
    if (!bukuByInv(inv)) return toast('Pilih buku terlebih dahulu.', 'err');
    if (!confirm(`Hapus buku dengan No. Inventaris ${inv}?\nTindakan ini tidak bisa dibatalkan.`)) return;
    busy(this, true, 'Menghapus...');
    const res = await kirim({ action: 'hapusBuku', noInventaris: inv });
    busy(this, false);
    toast(res.message || '', res.status === 'success' ? 'ok' : 'err');
    if (res.status === 'success') { S.buku = S.buku.filter(b => b.noInv !== inv); $('#edit-buku-pilih').value = ''; isiEditBuku(); isiDatalist(); renderStats(); }
});

// Tambah anggota
$('#btn-tambah-anggota').addEventListener('click', async function () {
    const anggota = { nis: $('#anggota-nis').value.trim(), nama: $('#anggota-nama').value.trim(), kelas: $('#anggota-kelas').value.trim(), status: $('#anggota-status').value.trim() };
    if (!anggota.nis || !anggota.nama) return toast('NIS dan nama wajib diisi.', 'err');
    if (anggotaByNis(anggota.nis)) return toast('NIS ini sudah terdaftar.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await kirim({ action: 'tambahAnggota', anggota });
    busy(this, false);
    toast(res.message || '', res.status === 'success' ? 'ok' : 'err');
    if (res.status === 'success') {
        S.anggota.push(anggota);
        ['#anggota-nis', '#anggota-nama'].forEach(s => $(s).value = '');
        isiDatalist(); renderStats();
        $('#anggota-nis').focus();
    }
});

// Edit anggota
function isiEditAnggota() {
    const a = cariAnggota($('#edit-anggota-pilih').value);
    $('#edit-anggota-nama').value = a ? a.nama : '';
    $('#edit-anggota-kelas').value = a ? a.kelas : '';
    $('#edit-anggota-status').value = a ? a.status : '';
    $('#btn-update-anggota').disabled = !a;
    $('#btn-hapus-anggota').disabled = !a;
    $('#edit-anggota-hint').textContent = a ? `NIS ${a.nis} (tidak bisa diubah)` : '';
}
$('#edit-anggota-pilih').addEventListener('input', isiEditAnggota);
$('#btn-update-anggota').addEventListener('click', async function () {
    const a = cariAnggota($('#edit-anggota-pilih').value);
    if (!a) return toast('Pilih anggota terlebih dahulu.', 'err');
    const anggota = { nis: a.nis, nama: $('#edit-anggota-nama').value.trim(), kelas: $('#edit-anggota-kelas').value.trim(), status: $('#edit-anggota-status').value.trim() };
    busy(this, true, 'Menyimpan...');
    const res = await kirim({ action: 'updateAnggota', anggota });
    busy(this, false);
    toast(res.message || '', res.status === 'success' ? 'ok' : 'err');
    if (res.status === 'success') { Object.assign(a, anggota); isiDatalist(); }
});
$('#btn-hapus-anggota').addEventListener('click', async function () {
    const a = cariAnggota($('#edit-anggota-pilih').value);
    if (!a) return toast('Pilih anggota terlebih dahulu.', 'err');
    if (pinjamanAktif().some(x => x.nis === a.nis)) return toast('Anggota ini masih meminjam buku. Kembalikan dulu sebelum menghapus.', 'err');
    if (!confirm(`Hapus anggota ${a.nama} (NIS ${a.nis})?\nTindakan ini tidak bisa dibatalkan.`)) return;
    busy(this, true, 'Menghapus...');
    const res = await kirim({ action: 'hapusAnggota', nis: a.nis });
    busy(this, false);
    toast(res.message || '', res.status === 'success' ? 'ok' : 'err');
    if (res.status === 'success') { S.anggota = S.anggota.filter(x => x.nis !== a.nis); $('#edit-anggota-pilih').value = ''; isiEditAnggota(); isiDatalist(); renderStats(); }
});

// Pengaturan denda
$('#btn-simpan-set').addEventListener('click', async function () {
    const lama = $('#set-hari').value.trim(), denda = $('#set-denda').value.trim();
    if (!lama || denda === '') return toast('Isi lama pinjam dan denda.', 'err');
    busy(this, true, 'Menyimpan...');
    const res = await kirim({ action: 'simpanPengaturan', settings: { lamaPinjam: lama, denda } });
    busy(this, false);
    toast(res.message || '', res.status === 'success' ? 'ok' : 'err');
    if (res.status === 'success') { S.settings.LamaPinjamHari = lama; S.settings.DendaPerHari = denda; renderSemua(); }
});

// ==========================================================
// == MULAI ==
// ==========================================================
setAdminUI();
isiEditBuku(); isiEditAnggota();
tampilkan(currentPage());
muatSemua();

})();
