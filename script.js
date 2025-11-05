document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================================
    // == PENGATURAN UTAMA ==
    // ==========================================================

    // 1. LINK CSV (UNTUK BACA DATA / WEBVIEW)
    const urlBuku = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=0&single=true&output=csv'; // <-- Ganti dengan link CSV sheet "Katalog Buku"
    const urlAnggota = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=485044064&single=true&output=csv'; // <-- Ganti dengan link CSV sheet "Anggota"

    // 2. LINK BACKEND (UNTUK TULIS DATA / CRUD)
    // PASTE URL APLIKASI WEB ANDA DARI HASIL DEPLOY APPS SCRIPT
    const urlWebApp = 'https://script.google.com/macros/s/AKfycbyeoIbVg-ZSuDKk-6zweHTlXSjEMbsXBx2GP5XdqJNQyBGc5EzlsLCf0Ick-5BgOMP5/exec'; // <-- GANTI INI

    // ==========================================================
    // == Variabel Global & Elemen ==
    // ==========================================================
    
    // Data Penyimpanan
    let dataBuku = [];
    let dataAnggota = [];

    // Elemen Navigasi
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const contentSections = document.querySelectorAll('.content-section');

    // Elemen Halaman Katalog Buku
    const tabelBuku = document.getElementById('tabel-buku');
    const filterBuku = document.getElementById('filterBuku');

    // Elemen Halaman Anggota
    const tabelAnggota = document.getElementById('tabel-anggota');
    const filterAnggota = document.getElementById('filterAnggota');
    
    // Elemen Halaman Dashboard
    const totalJudulBukuElement = document.getElementById('total-judul-buku');
    const bukuTersediaElement = document.getElementById('buku-tersedia');
    const bukuDipinjamElement = document.getElementById('buku-dipinjam');

    // Elemen Form Pinjam
    const btnProsesPinjam = document.getElementById('btn-proses-pinjam');
    const inputPinjamInv = document.getElementById('pinjam-no-inventaris');
    const inputPinjamNIS = document.getElementById('pinjam-nis');
    const pinjamFeedback = document.getElementById('pinjam-feedback');
    
    // Elemen Form Kembali
    const btnProsesKembali = document.getElementById('btn-proses-kembali');
    const inputKembaliInv = document.getElementById('kembali-no-inventaris');
    const kembaliFeedback = document.getElementById('kembali-feedback');

    // ===========================================
    // Logika Navigasi Menu Sidebar
    // ===========================================
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.querySelector('a').getAttribute('data-target');
            
            menuItems.forEach(i => i.classList.remove('active'));
            contentSections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // ===========================================
    // Fungsi Baca Data (Fetch CSV)
    // ===========================================
    
    async function fetchData(url) {
        try {
            const respons = await fetch(url);
            if (!respons.ok) throw new Error('Gagal memuat data');
            const dataCsv = await respons.text();
            return dataCsv.split('\n').slice(1).filter(baris => baris.trim() !== '');
        } catch (error) {
            console.error('Error:', error);
            return null;
        }
    }
    
    async function muatDataBuku() {
        tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Memuat data buku...</td></tr>';
        const dataCsv = await fetchData(urlBuku);
        if (!dataCsv) {
            tabelBuku.innerHTML = '<tr><td colspan="5" class="loading" style="color:red;">Gagal mengambil data buku.</td></tr>';
            return;
        }
        dataBuku = dataCsv.map(baris => {
            const k = baris.split(',');
            return { noInventaris: (k[0]||'').trim(), judul: (k[1]||'').trim(), pengarang: (k[2]||'').trim(), penerbit: (k[3]||'').trim(), status: (k[4]||'').trim() };
        });
        tampilkanDataBuku(dataBuku);
        updateDashboardStats();
    }

    function tampilkanDataBuku(data) {
        tabelBuku.innerHTML = '';
        if (data.length === 0) {
            tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Data tidak ditemukan.</td></tr>';
            return;
        }
        data.forEach(buku => {
            const statusClass = buku.status.toLowerCase() === 'tersedia' ? 'status-tersedia' : 'status-dipinjam';
            tabelBuku.innerHTML += `
                <tr>
                    <td>${buku.noInventaris}</td>
                    <td>${buku.judul}</td>
                    <td>${buku.pengarang}</td>
                    <td>${buku.penerbit}</td>
                    <td><span class="status ${statusClass}">${buku.status}</span></td>
                </tr>`;
        });
    }

    async function muatDataAnggota() {
        tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading">Memuat data anggota...</td></tr>';
        const dataCsv = await fetchData(urlAnggota);
        if (!dataCsv) {
            tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading" style="color:red;">Gagal mengambil data anggota.</td></tr>';
            return;
        }
        dataAnggota = dataCsv.map(baris => {
            const k = baris.split(',');
            return { nis: (k[0]||'').trim(), nama: (k[1]||'').trim(), kelas: (k[2]||'').trim(), status: (k[3]||'').trim() };
        });
        tampilkanDataAnggota(dataAnggota);
    }
    
    function tampilkanDataAnggota(data) {
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
    
    function updateDashboardStats() {
        const totalJudul = dataBuku.length;
        const bukuTersedia = dataBuku.filter(buku => buku.status.toLowerCase() === 'tersedia').length;
        const bukuDipinjam = totalJudul - bukuTersedia;

        totalJudulBukuElement.textContent = totalJudul;
        bukuTersediaElement.textContent = bukuTersedia;
        bukuDipinjamElement.textContent = bukuDipinjam;
    }

    // ===========================================
    // Logika Filter Pencarian
    // ===========================================
    filterBuku.addEventListener('keyup', () => {
        const kataKunci = filterBuku.value.toLowerCase();
        const dataFilter = dataBuku.filter(buku => 
            buku.judul.toLowerCase().includes(kataKunci) ||
            buku.pengarang.toLowerCase().includes(kataKunci) ||
            buku.penerbit.toLowerCase().includes(kataKunci)
        );
        tampilkanDataBuku(dataFilter);
    });
    
    filterAnggota.addEventListener('keyup', () => {
        const kataKunci = filterAnggota.value.toLowerCase();
        const dataFilter = dataAnggota.filter(anggota => 
            anggota.nama.toLowerCase().includes(kataKunci) ||
            anggota.nis.toLowerCase().includes(kataKunci) ||
            anggota.kelas.toLowerCase().includes(kataKunci)
        );
        tampilkanDataAnggota(dataFilter);
    });

    // ===========================================
    // == FUNGSI CRUD (KIRIM DATA KE APPS SCRIPT) ==
    // ===========================================
    
    // --- Proses PINJAM BUKU ---
    btnProsesPinjam.addEventListener('click', async function() {
        const noInventaris = inputPinjamInv.value.trim();
        const nis = inputPinjamNIS.value.trim();
        
        if (!noInventaris || !nis) {
            pinjamFeedback.textContent = "Mohon isi No. Inventaris dan NIS.";
            pinjamFeedback.style.color = "red";
            return;
        }
        
        // Tampilkan loading
        this.disabled = true;
        this.textContent = "Memproses...";
        pinjamFeedback.textContent = "Menghubungi server...";
        pinjamFeedback.style.color = "blue";
        
        const dataKirim = {
            action: "pinjamBuku",
            noInventaris: noInventaris,
            nis: nis
        };
        
        const response = await kirimDataKeBackend(dataKirim);
        
        // Tampilkan hasil
        pinjamFeedback.textContent = response.message;
        pinjamFeedback.style.color = (response.status === "success") ? "green" : "red";
        
        if (response.status === "success") {
            inputPinjamInv.value = ""; // Kosongkan form
            inputPinjamNIS.value = "";
            muatDataBuku(); // Refresh tabel buku
        }
        
        this.disabled = false;
        this.textContent = "Proses Peminjaman";
    });

    // --- Proses KEMBALIKAN BUKU ---
    btnProsesKembali.addEventListener('click', async function() {
        const noInventaris = inputKembaliInv.value.trim();
        
        if (!noInventaris) {
            kembaliFeedback.textContent = "Mohon isi No. Inventaris.";
            kembaliFeedback.style.color = "red";
            return;
        }
        
        this.disabled = true;
        this.textContent = "Memproses...";
        kembaliFeedback.textContent = "Menghubungi server...";
        kembaliFeedback.style.color = "blue";
        
        const dataKirim = {
            action: "kembalikanBuku",
            noInventaris: noInventaris
        };
        
        const response = await kirimDataKeBackend(dataKirim);
        
        kembaliFeedback.textContent = response.message;
        kembaliFeedback.style.color = (response.status === "success") ? "green" : "red";
        
        if (response.status === "success") {
            inputKembaliInv.value = ""; // Kosongkan form
            muatDataBuku(); // Refresh tabel buku
        }
        
        this.disabled = false;
        this.textContent = "Proses Pengembalian";
    });

    // Fungsi inti untuk mengirim data ke Google Apps Script
    async function kirimDataKeBackend(data) {
        try {
            const res = await fetch(urlWebApp, {
                method: "POST",
                body: JSON.stringify(data),
                headers: { "Content-Type": "application/json" }
            });
            
            if (!res.ok) {
                throw new Error("Respon jaringan tidak OK");
            }
            
            return await res.json(); // Mengambil balasan JSON dari Apps Script
            
        } catch (error) {
            console.error("Error saat mengirim data:", error);
            return { status: "error", message: "Gagal terhubung ke server. " + error.message };
        }
    }

    // ===========================================
    // Jalankan Fungsi Saat Halaman Dimuat
    // ===========================================
    muatDataBuku();
    muatDataAnggota();
});
