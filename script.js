document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================================
    // == PENGATURAN UTAMA ==
    // ==========================================================

    // 1. LINK CSV
    // PASTIKAN ANDA MENGGANTI 4 LINK DI BAWAH INI
    const urlBuku = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=0&single=true&output=csv'; 
    const urlAnggota = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=485044064&single=true&output=csv'; 
    const urlHistory = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=658377134&single=true&output=csv'; // <-- PASTIKAN INI SUDAH BENAR
    
    // === TAMBAHAN BARU: PASTE LINK CSV "Settings" ANDA DI SINI ===
    const urlSettings = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=1547395606&single=true&output=csv';

    // 2. LINK BACKEND
    const urlWebApp = 'https://script.google.com/macros/s/AKfycbwWiOus2vKJj9H8DUxoSyLyapStIet3-DQgTxGw5jtoLQlGkOBdZhC3wyGPz4Stj4Lb/exec'; 

    // ==========================================================
    // == Variabel Global & Elemen ==
    // ==========================================================
    
    let dataBuku = []; 
    let dataAnggota = [];
    let dataHistory = [];
    let appSettings = {}; 

    // (Elemen Menu & Tabel)
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const contentSections = document.querySelectorAll('.content-section');
    const tabelBuku = document.getElementById('tabel-buku');
    const filterBuku = document.getElementById('filterBuku');
    const tabelAnggota = document.getElementById('tabel-anggota');
    const filterAnggota = document.getElementById('filterAnggota');
    const tabelHistory = document.getElementById('tabel-history'); 
    
    // (Elemen Dashboard)
    const totalJudulBukuElement = document.getElementById('total-judul-buku');
    const bukuTersediaElement = document.getElementById('buku-tersedia');
    const bukuDipinjamElement = document.getElementById('buku-dipinjam');

    // (Elemen Form Pinjam)
    const btnProsesPinjam = document.getElementById('btn-proses-pinjam');
    const selectPinjamInv = document.getElementById('pinjam-no-inventaris');
    const selectPinjamKelas = document.getElementById('pinjam-kelas');
    const selectPinjamNama = document.getElementById('pinjam-nama');
    const inputPinjamNIS = document.getElementById('pinjam-nis');
    const inputPinjamPass = document.getElementById('pinjam-password'); 
    const pinjamFeedback = document.getElementById('pinjam-feedback');
    
    // (Elemen Form Kembali)
    const btnProsesKembali = document.getElementById('btn-proses-kembali');
    const selectKembaliInv = document.getElementById('kembali-no-inventaris');
    const inputKembaliPass = document.getElementById('kembali-password'); 
    const kembaliFeedback = document.getElementById('kembali-feedback');
    const kembaliDenda = document.getElementById('kembali-denda'); 

    // (Elemen Form Pengaturan)
    const inputSettingHari = document.getElementById('setting-hari');
    const inputSettingDenda = document.getElementById('setting-denda');
    const inputSettingPass = document.getElementById('setting-password');
    const btnSimpanPengaturan = document.getElementById('btn-simpan-pengaturan');
    const settingFeedback = document.getElementById('setting-feedback');

    // (Elemen Form Tambah Buku)
    const btnTambahBuku = document.getElementById('btn-tambah-buku');
    const inputBukuInventaris = document.getElementById('buku-inventaris');
    const inputBukuJudul = document.getElementById('buku-judul');
    const inputBukuPengarang = document.getElementById('buku-pengarang');
    const inputBukuPenerbit = document.getElementById('buku-penerbit');
    const inputBukuPassword = document.getElementById('buku-password');
    const bukuFeedback = document.getElementById('buku-feedback');

    // (Elemen Form Tambah Anggota)
    const btnTambahAnggota = document.getElementById('btn-tambah-anggota');
    const inputAnggotaNis = document.getElementById('anggota-nis');
    const inputAnggotaNama = document.getElementById('anggota-nama');
    const inputAnggotaKelas = document.getElementById('anggota-kelas');
    const inputAnggotaStatus = document.getElementById('anggota-status');
    const inputAnggotaPassword = document.getElementById('anggota-password');
    const anggotaFeedback = document.getElementById('anggota-feedback');
    
    // (Elemen Sub-Menu Pengaturan)
    const subNavItems = document.querySelectorAll('.sub-nav-item');
    const subContentSections = document.querySelectorAll('.sub-content-section');
    
    // (Elemen Form Edit Anggota)
    const selectEditAnggota = document.getElementById('select-edit-anggota');
    const inputEditAnggotaNis = document.getElementById('edit-anggota-nis');
    const inputEditAnggotaNama = document.getElementById('edit-anggota-nama');
    const inputEditAnggotaKelas = document.getElementById('edit-anggota-kelas');
    const inputEditAnggotaStatus = document.getElementById('edit-anggota-status');
    const inputEditAnggotaPassword = document.getElementById('edit-anggota-password');
    const btnUpdateAnggota = document.getElementById('btn-update-anggota');
    const btnHapusAnggota = document.getElementById('btn-hapus-anggota');
    const editAnggotaFeedback = document.getElementById('edit-anggota-feedback');

    // (Elemen Form Edit Buku)
    const selectEditBuku = document.getElementById('select-edit-buku');
    const inputEditBukuInventaris = document.getElementById('edit-buku-inventaris');
    const inputEditBukuJudul = document.getElementById('edit-buku-judul');
    const inputEditBukuPengarang = document.getElementById('edit-buku-pengarang');
    const inputEditBukuPenerbit = document.getElementById('edit-buku-penerbit');
    const inputEditBukuPassword = document.getElementById('edit-buku-password');
    const btnUpdateBuku = document.getElementById('btn-update-buku');
    const btnHapusBuku = document.getElementById('btn-hapus-buku');
    const editBukuFeedback = document.getElementById('edit-buku-feedback');


    // ===========================================
    // == Logika Navigasi Menu & Sub-Menu ==
    // ===========================================
    function activateSection(targetId) {
        menuItems.forEach(i => i.classList.remove('active'));
        contentSections.forEach(s => s.classList.remove('active'));
        const targetMenuItem = document.querySelector(`.menu-item a[data-target="${targetId}"]`);
        const targetElement = document.getElementById(targetId);
        if (targetMenuItem && targetElement) {
            targetMenuItem.parentElement.classList.add('active');
            targetElement.classList.add('active');
        } else {
            document.querySelector('.menu-item a[data-target="katalog-buku"]').parentElement.classList.add('active');
            document.getElementById('katalog-buku').classList.add('active');
        }
    }
    if (menuItems.length > 0 && contentSections.length > 0) {
        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault(); 
                const targetId = this.querySelector('a').getAttribute('data-target');
                activateSection(targetId);
                window.location.hash = targetId;
            });
        });
        const currentHash = window.location.hash.substring(1); 
        if (currentHash) {
            activateSection(currentHash); 
        } else {
            activateSection("katalog-buku");
        }
    } else {
        console.error("Error: Elemen sidebar (menuItems) tidak ditemukan.");
    }
    if (subNavItems.length > 0 && subContentSections.length > 0) {
        subNavItems.forEach(item => {
            item.addEventListener('click', function() {
                const subTargetId = this.getAttribute('data-sub-target');
                subNavItems.forEach(i => i.classList.remove('active'));
                subContentSections.forEach(s => s.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(subTargetId).classList.add('active');
            });
        });
    }

    // ===========================================
    // == Fungsi Baca Data (Fetch CSV) ==
    // ===========================================
    async function fetchData(url) {
        if (!url || url.includes('PASTE_LINK')) {
             throw new Error(`URL CSV belum diatur.`);
        }
        try {
            const respons = await fetch(url + '&cachebust=' + new Date().getTime());
            if (!respons.ok) {
                 throw new Error(`Gagal memuat data dari URL. Status: ${respons.status} (Not Found)`);
            }
            const dataCsv = await respons.text();
            return dataCsv.split('\n').slice(1).filter(baris => baris.trim() !== '');
        } catch (error) {
            console.error('Error di fungsi fetchData:', error);
            const errorMsg = `Error: ${error.message}. Cek link CSV.`;
            if (url === urlBuku && tabelBuku) tabelBuku.innerHTML = `<tr><td colspan="5" class="loading" style="color:red;">${errorMsg}</td></tr>`;
            if (url === urlAnggota && tabelAnggota) tabelAnggota.innerHTML = `<tr><td colspan="4" class="loading" style="color:red;">${errorMsg}</td></tr>`;
            if (url === urlHistory && tabelHistory) tabelHistory.innerHTML = `<tr><td colspan="6" class="loading" style="color:red;">${errorMsg}</td></tr>`;
            if (url === urlSettings && settingFeedback) settingFeedback.textContent = "Error memuat pengaturan. " + errorMsg;
            return null;
        }
    }
    
    async function muatDataBuku() {
        if (!tabelBuku && !selectPinjamInv) return; 
        if(tabelBuku) tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Memuat data buku...</td></tr>';
        const dataCsv = await fetchData(urlBuku);
        if (!dataCsv) return;
        dataBuku = dataCsv.map(baris => {
            const k = baris.split(',');
            return { 
                noInventaris: (k[0]||'').trim(), 
                judul: (k[1]||'').trim(), 
                pengarang: (k[2]||'').trim(), 
                penerbit: (k[3]||'').trim(), 
                status: (k[4]||'').trim(),
                peminjamNis: (k[5]||'').trim(),
                tglPinjam: (k[6]||'').trim(), 
                jatuhTempo: (k[7]||'').trim() 
            };
        });
        if (tabelBuku) {
            tampilkanDataBukuAgregat(dataBuku); 
        }
        if (totalJudulBukuElement) {
            updateDashboardStats(dataBuku); 
        }
        populateBukuDropdowns();
        populateEditBukuSelect();
    }
    
    function tampilkanDataBukuAgregat(data) {
        if (!tabelBuku) return;
        tabelBuku.innerHTML = '';
        const aggregatedData = {};
        data.forEach(buku => {
            const key = buku.judul + "|" + buku.pengarang; 
            if (!aggregatedData[key]) {
                aggregatedData[key] = {
                    judul: buku.judul,
                    pengarang: buku.pengarang,
                    penerbit: buku.penerbit,
                    totalStok: 0,
                    stokTersedia: 0
                };
            }
            aggregatedData[key].totalStok += 1;
            if ((buku.status || "").toLowerCase() === 'tersedia') {
                aggregatedData[key].stokTersedia += 1;
            }
        });
        const dataTampil = Object.values(aggregatedData);
        if (dataTampil.length === 0) {
            tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Data tidak ditemukan.</td></tr>';
            return;
        }
        dataTampil.forEach(buku => {
            const stokClass = buku.stokTersedia > 0 ? 'status-tersedia' : 'status-dipinjam';
            tabelBuku.innerHTML += `
                <tr>
                    <td>${buku.judul}</td>
                    <td>${buku.pengarang}</td>
                    <td>${buku.penerbit}</td>
                    <td>${buku.totalStok}</td>
                    <td><span class="status ${stokClass}">${buku.stokTersedia}</span></td>
                </tr>`;
        });
    }

    async function muatDataAnggota() {
        if (!tabelAnggota && !selectPinjamKelas) return; 
        if(tabelAnggota) tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading">Memuat data anggota...</td></tr>';
        const dataCsv = await fetchData(urlAnggota);
        if (!dataCsv) return;
        dataAnggota = dataCsv.map(baris => {
            const k = baris.split(',');
            return { 
                nis: (k[0]||'').trim(), 
                nama: (k[1]||'').trim(), 
                kelas: (k[2]||'').trim(), 
                status: (k[3]||'').trim() 
            };
        });
        if (tabelAnggota) tampilkanDataAnggota(dataAnggota);
        populateKelasSelect(); 
        populateEditAnggotaSelect();
    }
    
    function tampilkanDataAnggota(data) {
        if (!tabelAnggota) return;
        tabelAnggota.innerHTML = '';
        if (data.length === 0) {
            tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading">Data tidak ditemukan.</td></tr>';
            return;
        }
        data.forEach(anggota => {
            tabelAnggota.innerHTML += `
                <tr>
                    <td>${anggota.nis}</td>
                    <td>${anggota.nama}</td>
                    <td>${anggota.kelas}</td>
                    <td>${anggota.status}</td>
                </tr>`;
        });
    }

    async function muatDataHistory() {
        if (!tabelHistory) return;
        if (urlHistory === 'PASTE_LINK_CSV_HISTORY_ANDA_DI_SINI' || !urlHistory) {
            tabelHistory.innerHTML = '<tr><td colspan="6" class="loading" style="color:orange;">Harap masukkan URL CSV Sheet "History" di dalam file script.js</td></tr>';
            return;
        }
        tabelHistory.innerHTML = '<tr><td colspan="6" class="loading">Memuat riwayat...</td></tr>';
        const dataCsv = await fetchData(urlHistory);
        if (!dataCsv) return;
        dataHistory = dataCsv.map(baris => {
            const k = baris.split(',');
            return { 
                timestamp: (k[0]||'').trim(), 
                noInv: (k[1]||'').trim(), 
                judul: (k[2]||'').trim(), 
                // === PERBAIKAN 2: Typo 'trim' menjadi '' ===
                nis: (k[3]||'').trim(), 
                nama: (k[4]||'').trim(),
                aksi: (k[5]||'').trim()
            };
        });
        tampilkanDataHistory(dataHistory);
    }
    
    function tampilkanDataHistory(data) {
        if (!tabelHistory) return;
        tabelHistory.innerHTML = '';
        if (data.length === 0) {
            tabelHistory.innerHTML = '<tr><td colspan="6" class="loading">Belum ada riwayat transaksi.</td></tr>';
            return;
        }
        const dataTampil = [...data].reverse().slice(0, 50); 
        dataTampil.forEach(item => {
            const statusClass = (item.aksi || "").toLowerCase() === 'dipinjam' ? 'status-dipinjam' : 'status-tersedia';
            tabelHistory.innerHTML += `
                <tr>
                    <td>${item.timestamp}</td>
                    <td>${item.noInv}</td>
                    <td>${item.judul}</td>
                    <td>${item.nis}</td>
                    <td>${item.nama}</td>
                    <td><span class="status ${statusClass}">${item.aksi}</span></td>
                </tr>`;
        });
    }
    
    async function muatDataPengaturan() {
        if (urlSettings === 'PASTE_LINK_CSV_SETTINGS_ANDA_DI_SINI' || !urlSettings) {
             if (settingFeedback) settingFeedback.textContent = "URL CSV Settings belum diisi di script.js";
             appSettings = { LamaPinjamHari: "7", DendaPerHari: "1000" };
             return;
        }
        const dataCsv = await fetchData(urlSettings);
        if (!dataCsv) return;
        dataCsv.forEach(baris => {
            const k = baris.split(',');
            const key = (k[0]||'').trim();
            const value = (k[1]||'').trim();
            if (key) {
                appSettings[key] = value;
            }
        });
        if (inputSettingHari) inputSettingHari.value = appSettings.LamaPinjamHari || 7;
        if (inputSettingDenda) inputSettingDenda.value = appSettings.DendaPerHari || 1000;
    }
    
    function updateDashboardStats() {
        if (!totalJudulBukuElement) return;
        const aggregatedData = {};
        dataBuku.forEach(buku => {
            const key = buku.judul + "|" + buku.pengarang; 
            if (!aggregatedData[key]) {
                aggregatedData[key] = {
                    totalStok: 0,
                    stokTersedia: 0
                };
            }
            aggregatedData[key].totalStok += 1;
            if ((buku.status || "").toLowerCase() === 'tersedia') {
                aggregatedData[key].stokTersedia += 1;
            }
        });
        const dataTampil = Object.values(aggregatedData);
        const totalJudul = dataTampil.length;
        const bukuTersedia = dataBuku.filter(buku => (buku.status || "").toLowerCase() === 'tersedia').length;
        const bukuDipinjam = dataBuku.length - bukuTersedia;
        totalJudulBukuElement.textContent = totalJudul; 
        bukuTersediaElement.textContent = bukuTersedia; 
        bukuDipinjamElement.textContent = bukuDipinjam; 
    }
    
    function populateBukuDropdowns() {
        if (!selectPinjamInv || !selectKembaliInv) return;
        selectPinjamInv.innerHTML = '<option value="">-- Pilih Buku (Tersedia) --</option>';
        selectKembaliInv.innerHTML = '<option value="">-- Pilih Buku (Dipinjam) --</option>';
        const sortedData = [...dataBuku].sort((a, b) => a.noInventaris.localeCompare(b.noInventaris, undefined, { numeric: true }));
        sortedData.forEach(buku => {
            const optionText = `${buku.noInventaris} - ${buku.judul}`;
            if ((buku.status || "").toLowerCase() === 'tersedia') {
                selectPinjamInv.innerHTML += `<option value="${buku.noInventaris}">${optionText}</option>`;
            } else {
                selectKembaliInv.innerHTML += `<option value="${buku.noInventaris}">${optionText}</option>`;
            }
        });
    }
    
    function populateKelasSelect() {
        if (!selectPinjamKelas) return;
        const semuaKelas = dataAnggota.map(anggota => anggota.kelas);
        const kelasUnik = [...new Set(semuaKelas)].sort(); 
        selectPinjamKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        kelasUnik.forEach(kelas => {
            if (kelas) { 
                selectPinjamKelas.innerHTML += `<option value="${kelas}">${kelas}</option>`;
            }
        });
    }
    
    function populateEditAnggotaSelect() {
        if (!selectEditAnggota) return;
        selectEditAnggota.innerHTML = '<option value="">-- Pilih Anggota --</option>';
        const sortedAnggota = [...dataAnggota].sort((a, b) => a.nama.localeCompare(b.nama));
        sortedAnggota.forEach(anggota => {
            if (anggota.nis && anggota.nama) {
                selectEditAnggota.innerHTML += `<option value="${anggota.nis}">${anggota.nama} (${anggota.nis})</option>`;
            }
        });
    }
    
    function populateEditBukuSelect() {
        if (!selectEditBuku) return;
        selectEditBuku.innerHTML = '<option value="">-- Pilih Buku (Per No. Inventaris) --</option>';
        const sortedBuku = [...dataBuku].sort((a, b) => a.noInventaris.localeCompare(b.noInventaris, undefined, { numeric: true }));
        sortedBuku.forEach(buku => {
            if (buku.noInventaris && buku.judul) {
                selectEditBuku.innerHTML += `<option value="${buku.noInventaris}">${buku.noInventaris} - ${buku.judul}</option>`;
            }
        });
    }

    if (selectPinjamKelas) {
        selectPinjamKelas.addEventListener('change', function() {
            const kelasTerpilih = this.value;
            selectPinjamNama.innerHTML = '<option value="">-- Pilih Nama --</option>';
            inputPinjamNIS.value = ""; 
            if (!kelasTerpilih) return; 
            const anggotaDiKelas = dataAnggota
                .filter(anggota => anggota.kelas === kelasTerpilih)
                .sort((a, b) => a.nama.localeCompare(b.nama)); 
            if (anggotaDiKelas.length === 0) {
                selectPinjamNama.innerHTML = '<option value="">-- Tidak ada siswa di kelas ini --</option>';
            } else {
                anggotaDiKelas.forEach(siswa => {
                    selectPinjamNama.innerHTML += `<option value="${siswa.nis}">${siswa.nama}</option>`;
                });
            }
        });
    }
    if (selectPinjamNama) {
        selectPinjamNama.addEventListener('change', function() {
            inputPinjamNIS.value = this.value;
        });
    }
    if (filterBuku) {
        filterBuku.addEventListener('keyup', () => {
            const kataKunci = filterBuku.value.toLowerCase();
            const dataFilter = dataBuku.filter(buku => 
                (buku.judul || "").toLowerCase().includes(kataKunci) ||
                (buku.pengarang || "").toLowerCase().includes(kataKunci) ||
                (buku.penerbit || "").toLowerCase().includes(kataKunci)
            );
            tampilkanDataBukuAgregat(dataFilter);
        });
    }
    if (filterAnggota) {
        filterAnggota.addEventListener('keyup', () => {
            const kataKunci = filterAnggota.value.toLowerCase();
            const dataFilter = dataAnggota.filter(anggota => 
                (anggota.nama || "").toLowerCase().includes(kataKunci) ||
                (anggota.nis || "").toLowerCase().includes(kataKunci) ||
                (anggota.kelas || "").toLowerCase().includes(kataKunci)
            );
            tampilkanDataAnggota(dataFilter);
        });
    }

    // ===========================================
    // == FUNGSI CRUD (KIRIM DATA KE APPS SCRIPT) ==
    // ===========================================
    
    if (btnProsesPinjam) {
        btnProsesPinjam.addEventListener('click', async function() {
            if (kembaliDenda) kembaliDenda.value = "";
            if (kembaliFeedback) kembaliFeedback.textContent = "";
            const noInventaris = selectPinjamInv.value; 
            const nis = inputPinjamNIS.value.trim();    
            const adminPassword = inputPinjamPass.value.trim();
            if (!noInventaris || !nis || !adminPassword) {
                pinjamFeedback.textContent = "Mohon lengkapi pilihan Buku, Peminjam, dan Password Admin.";
                pinjamFeedback.style.color = "red";
                return;
            }
            this.disabled = true; this.textContent = "Memproses...";
            pinjamFeedback.textContent = "Menghubungi server..."; pinjamFeedback.style.color = "blue";
            const dataKirim = { action: "pinjamBuku", noInventaris: noInventaris, nis: nis, password: adminPassword };
            const response = await kirimDataKeBackend(dataKirim);
            pinjamFeedback.textContent = response.message;
            pinjamFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                const bukuYangDipinjam = dataBuku.find(b => b.noInventaris === noInventaris);
                const siswaPeminjam = dataAnggota.find(a => a.nis === nis);
                const namaSiswa = siswaPeminjam ? siswaPeminjam.nama : nis;
                const lamaPinjam = parseInt(appSettings.LamaPinjamHari) || 7; 
                const tglJatuhTempo = new Date();
                tglJatuhTempo.setDate(tglJatuhTempo.getDate() + lamaPinjam);
                const tglJatuhTempoString = tglJatuhTempo.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                if (bukuYangDipinjam) {
                    bukuYangDipinjam.status = "Dipinjam";
                    bukuYangDipinjam.peminjamNis = nis;
                    bukuYangDipinjam.tglPinjam = "Baru Saja"; 
                    bukuYangDipinjam.jatuhTempo = tglJatuhTempoString; 
                }
                const newHistoryEntry = { timestamp: "Baru Saja", noInv: noInventaris, judul: bukuYangDipinjam ? bukuYangDipinjam.judul : "N/A", nis: nis, nama: namaSiswa, aksi: "Dipinjam" };
                dataHistory.push(newHistoryEntry); 
                tampilkanDataBukuAgregat(dataBuku); 
                populateBukuDropdowns(); 
                updateDashboardStats(); 
                tampilkanDataHistory(dataHistory); 
                selectPinjamInv.value = "";
                selectPinjamKelas.value = "";
                selectPinjamNama.innerHTML = '<option value="">-- Pilih kelas terlebih dahulu --</option>';
                inputPinjamNIS.value = "";
                inputPinjamPass.value = "";
            }
            this.disabled = false; this.textContent = "Proses Peminjaman";
        });
    }
    if (btnProsesKembali) {
        btnProsesKembali.addEventListener('click', async function() {
            kembaliDenda.value = "";
            kembaliFeedback.textContent = "";
            if (pinjamFeedback) pinjamFeedback.textContent = "";
            const noInventaris = selectKembaliInv.value; 
            const adminPassword = inputKembaliPass.value.trim(); 
            if (!noInventaris || !adminPassword) {
                kembaliFeedback.textContent = "Mohon pilih Buku dan isi Password Admin.";
                kembaliFeedback.style.color = "red";
                return;
            }
            this.disabled = true; this.textContent = "Memproses...";
            kembaliFeedback.textContent = "Menghubungi server... (menghitung denda)";
            kembaliFeedback.style.color = "blue";
            const dataKirim = { action: "kembalikanBuku", noInventaris: noInventaris, password: adminPassword };
            const response = await kirimDataKeBackend(dataKirim);
            kembaliFeedback.textContent = response.message;
            kembaliFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                if (response.denda > 0) {
                    kembaliDenda.value = "Rp " + response.denda;
                } else {
                    kembaliDenda.value = "Rp 0";
                }
                const bukuYangDikembalikan = dataBuku.find(b => b.noInventaris === noInventaris);
                const nisSiswa = bukuYangDikembalikan ? bukuYangDikembalikan.peminjamNis : "N/A";
                const siswaPeminjam = dataAnggota.find(a => a.nis === nisSiswa);
                const namaSiswa = siswaPeminjam ? siswaPeminjam.nama : nisSiswa;
                if (bukuYangDikembalikan) {
                    bukuYangDikembalikan.status = "Tersedia";
                    bukuYangDikembalikan.peminjamNis = "";
                    bukuYangDikembalikan.tglPinjam = "";
                    bukuYangDikembalikan.jatuhTempo = ""; 
                }
                const newHistoryEntry = { timestamp: "Baru Saja", noInv: noInventaris, judul: bukuYangDikembalikan ? bukuYangDikembalikan.judul : "N/A", nis: nisSiswa, nama: namaSiswa, aksi: "Dikembalikan"};
                dataHistory.push(newHistoryEntry);
                tampilkanDataBukuAgregat(dataBuku); 
                populateBukuDropdowns(); 
                updateDashboardStats(); 
                tampilkanDataHistory(dataHistory); 
                selectKembaliInv.value = "";
                inputKembaliPass.value = "";
            }
            this.disabled = false; this.textContent = "Proses Pengembalian";
        });
    }
    if (btnSimpanPengaturan) {
        btnSimpanPengaturan.addEventListener('click', async function() {
            const lamaPinjam = inputSettingHari.value.trim();
            const denda = inputSettingDenda.value.trim();
            const adminPassword = inputSettingPass.value.trim();
            if (!lamaPinjam || !denda || !adminPassword) {
                settingFeedback.textContent = "Mohon lengkapi semua field dan password admin.";
                settingFeedback.style.color = "red";
                return;
            }
            this.disabled = true; this.textContent = "Menyimpan...";
            settingFeedback.textContent = "Menghubungi server...";
            settingFeedback.style.color = "blue";
            const dataKirim = { action: "simpanPengaturan", password: adminPassword, settings: { lamaPinjam: lamaPinjam, denda: denda }};
            const response = await kirimDataKeBackend(dataKirim);
            settingFeedback.textContent = response.message;
            settingFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                appSettings.LamaPinjamHari = lamaPinjam;
                appSettings.DendaPerHari = denda;
                inputSettingPass.value = ""; 
            }
            this.disabled = false; this.textContent = "Simpan Pengaturan";
        });
    }
    if (btnTambahBuku) {
        btnTambahBuku.addEventListener('click', async function() {
            const dataBuku = {
                noInventaris: inputBukuInventaris.value.trim(),
                judul: inputBukuJudul.value.trim(),
                pengarang: inputBukuPengarang.value.trim(),
                penerbit: inputBukuPenerbit.value.trim()
            };
            const adminPassword = inputBukuPassword.value.trim();
            if (!dataBuku.noInventaris || !dataBuku.judul || !adminPassword) {
                bukuFeedback.textContent = "No. Inventaris, Judul, dan Password Admin wajib diisi.";
                bukuFeedback.style.color = "red";
                return;
            }
            this.disabled = true; this.textContent = "Menyimpan...";
            bukuFeedback.textContent = "Menghubungi server..."; bukuFeedback.style.color = "blue";
            const dataKirim = { action: "tambahBuku", password: adminPassword, buku: dataBuku };
            const response = await kirimDataKeBackend(dataKirim);
            bukuFeedback.textContent = response.message;
            bukuFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                inputBukuInventaris.value = "";
                inputBukuJudul.value = "";
                inputBukuPengarang.value = "";
                inputBukuPenerbit.value = "";
                inputBukuPassword.value = "";
                await muatDataBuku(); 
            }
            this.disabled = false; this.textContent = "Tambah Buku";
        });
    }
    if (btnTambahAnggota) {
        btnTambahAnggota.addEventListener('click', async function() {
            const dataAnggota = {
                nis: inputAnggotaNis.value.trim(),
                nama: inputAnggotaNama.value.trim(),
                kelas: inputAnggotaKelas.value.trim(),
                status: inputAnggotaStatus.value.trim()
            };
            const adminPassword = inputAnggotaPassword.value.trim();
            if (!dataAnggota.nis || !dataAnggota.nama || !adminPassword) {
                anggotaFeedback.textContent = "NIS, Nama Lengkap, dan Password Admin wajib diisi.";
                anggotaFeedback.style.color = "red";
                return;
            }
            this.disabled = true; this.textContent = "Menyimpan...";
            anggotaFeedback.textContent = "Menghubungi server..."; anggotaFeedback.style.color = "blue";
            const dataKirim = { action: "tambahAnggota", password: adminPassword, anggota: dataAnggota };
            const response = await kirimDataKeBackend(dataKirim);
            anggotaFeedback.textContent = response.message;
            anggotaFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                inputAnggotaNis.value = "";
                inputAnggotaNama.value = "";
                inputAnggotaKelas.value = "";
                inputAnggotaStatus.value = "";
                inputAnggotaPassword.value = "";
                await muatDataAnggota(); 
            }
            this.disabled = false; this.textContent = "Tambah Anggota";
        });
    }
    if (selectEditAnggota) {
        selectEditAnggota.addEventListener('change', function() {
            const nisTerpilih = this.value;
            editAnggotaFeedback.textContent = ""; 
            if (!nisTerpilih) {
                inputEditAnggotaNis.value = "";
                inputEditAnggotaNama.value = "";
                inputEditAnggotaKelas.value = "";
                inputEditAnggotaStatus.value = "";
                return;
            }
            const anggota = dataAnggota.find(a => a.nis === nisTerpilih);
            if (anggota) {
                inputEditAnggotaNis.value = anggota.nis;
                inputEditAnggotaNama.value = anggota.nama;
                inputEditAnggotaKelas.value = anggota.kelas;
                inputEditAnggotaStatus.value = anggota.status;
            }
        });
    }
    if (btnUpdateAnggota) {
        btnUpdateAnggota.addEventListener('click', async function() {
            const dataAnggotaBaru = {
                nis: inputEditAnggotaNis.value.trim(),
                nama: inputEditAnggotaNama.value.trim(),
                kelas: inputEditAnggotaKelas.value.trim(),
                status: inputEditAnggotaStatus.value.trim()
            };
            const adminPassword = inputEditAnggotaPassword.value.trim();
            if (!dataAnggotaBaru.nis || !adminPassword) {
                editAnggotaFeedback.textContent = "Pilih anggota dan masukkan Password Admin.";
                editAnggotaFeedback.style.color = "red";
                return;
            }
            this.disabled = true; btnHapusAnggota.disabled = true;
            this.textContent = "Mengupdate...";
            editAnggotaFeedback.textContent = "Menghubungi server...";
            editAnggotaFeedback.style.color = "blue";
            const dataKirim = { action: "updateAnggota", password: adminPassword, anggota: dataAnggotaBaru };
            const response = await kirimDataKeBackend(dataKirim);
            editAnggotaFeedback.textContent = response.message;
            editAnggotaFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                await muatDataAnggota(); 
                inputEditAnggotaNis.value = "";
                inputEditAnggotaNama.value = "";
                inputEditAnggotaKelas.value = "";
                inputEditAnggotaStatus.value = "";
                inputEditAnggotaPassword.value = "";
            }
            this.disabled = false; btnHapusAnggota.disabled = false;
            this.textContent = "Update Anggota";
        });
    }
    if (btnHapusAnggota) {
        btnHapusAnggota.addEventListener('click', async function() {
            const nis = inputEditAnggotaNis.value.trim();
            const adminPassword = inputEditAnggotaPassword.value.trim();
            if (!nis || !adminPassword) {
                editAnggotaFeedback.textContent = "Pilih anggota dan masukkan Password Admin.";
                editAnggotaFeedback.style.color = "red";
                return;
            }
            if (!confirm(`Apakah Anda yakin ingin menghapus anggota dengan NIS: ${nis}? \n TINDAKAN INI TIDAK BISA DIBATALKAN.`)) {
                return;
            }
            this.disabled = true; btnUpdateAnggota.disabled = true;
            this.textContent = "Menghapus...";
            editAnggotaFeedback.textContent = "Menghubungi server...";
            editAnggotaFeedback.style.color = "blue";
            const dataKirim = { action: "hapusAnggota", password: adminPassword, nis: nis };
            const response = await kirimDataKeBackend(dataKirim);
            editAnggotaFeedback.textContent = response.message;
            editAnggotaFeedback.style.color = (response.status === "success") ? "green" : "red";
            if (response.status === "success") {
                await muatDataAnggota(); 
                inputEditAnggotaNis.value = "";
                inputEditAnggotaNama.value = "";
                inputEditAnggotaKelas.value = "";
                inputEditAnggotaStatus.value = "";
                inputEditAnggotaPassword.value = "";
            }
            this.disabled = false; btnUpdateAnggota.disabled = false;
            this.textContent = "Hapus Anggota";
        });
    }
    if (selectEditBuku) {
        selectEditBuku.addEventListener('change', function() {
            const noInventarisTerpilih = this.value;
            editBukuFeedback.textContent = ""; 
            
            if (!noInventarisTerpilih) {
                inputEditBukuInventaris.value = "";
                inputEditBukuJudul.value = "";
                inputEditBukuPengarang.value = "";
                inputEditBukuPenerbit.value = "";
                btnUpdateBuku.disabled = false;
                btnHapusBuku.disabled = false;
                return;
            }
            
            const buku = dataBuku.find(b => b.noInventaris === noInventarisTerpilih);
            
            if (buku) {
                inputEditBukuInventaris.value = buku.noInventaris;
                inputEditBukuJudul.value = buku.judul;
                inputEditBukuPengarang.value = buku.pengarang;
                inputEditBukuPenerbit.value = buku.penerbit;

                if (buku.status.toLowerCase() === 'dipinjam') {
                    editBukuFeedback.textContent = "Buku ini sedang dipinjam. Tidak bisa diedit atau dihapus.";
                    editBukuFeedback.style.color = "orange";
                    btnUpdateBuku.disabled = true;
                    btnHapusBuku.disabled = true;
                } else {
                    editBukuFeedback.textContent = "";
                    btnUpdateBuku.disabled = false;
                    btnHapusBuku.disabled = false;
                }
            }
        });
    }
    if (btnUpdateBuku) {
        btnUpdateBuku.addEventListener('click', async function() {
            const dataBukuBaru = {
                noInventaris: inputEditBukuInventaris.value.trim(),
                judul: inputEditBukuJudul.value.trim(),
                pengarang: inputEditBukuPengarang.value.trim(),
                penerbit: inputEditBukuPenerbit.value.trim()
            };
            const adminPassword = inputEditBukuPassword.value.trim();

            if (!dataBukuBaru.noInventaris || !adminPassword) {
                editBukuFeedback.textContent = "Pilih buku dan masukkan Password Admin.";
                editBukuFeedback.style.color = "red";
                return;
            }

            this.disabled = true; btnHapusBuku.disabled = true;
            this.textContent = "Mengupdate...";
            editBukuFeedback.textContent = "Menghubungi server...";
            editBukuFeedback.style.color = "blue";

            const dataKirim = {
                action: "updateBuku",
                password: adminPassword,
                buku: dataBukuBaru
            };

            const response = await kirimDataKeBackend(dataKirim);
            
            editBukuFeedback.textContent = response.message;
            editBukuFeedback.style.color = (response.status === "success") ? "green" : "red";

            if (response.status === "success") {
