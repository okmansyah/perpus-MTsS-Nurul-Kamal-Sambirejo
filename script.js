document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================================
    // == PENGATURAN UTAMA ==
    // ==========================================================

    // 1. LINK CSV (UNTUK BACA DATA / WEBVIEW)
    // PASTIKAN LINK INI BENAR DAN SUDAH "PUBLISH TO THE WEB"
    const urlBuku = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=0&single=true&output=csv'; 
    const urlAnggota = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=485044064&single=true&output=csv'; 

    // 2. LINK BACKEND (UNTUK TULIS DATA / CRUD)
    // PASTIKAN INI ADALAH URL DEPLOYMENT TERBARU ANDA
    const urlWebApp = 'https://script.google.com/macros/s/AKfycbwM1VqMNd4WbL36c1aXNO6KfI3Vz0a459I22UX2NjJZck-UVRqssIeEKK6opOImPF9R/exec';

    // ==========================================================
    // == Variabel Global & Elemen ==
    // ==========================================================
    
    let dataBuku = [];
    let dataAnggota = [];

    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const contentSections = document.querySelectorAll('.content-section');

    const tabelBuku = document.getElementById('tabel-buku');
    const filterBuku = document.getElementById('filterBuku');
    const tabelAnggota = document.getElementById('tabel-anggota');
    const filterAnggota = document.getElementById('filterAnggota');
    
    const totalJudulBukuElement = document.getElementById('total-judul-buku');
    const bukuTersediaElement = document.getElementById('buku-tersedia');
    const bukuDipinjamElement = document.getElementById('buku-dipinjam');

    // Elemen Form Pinjam (Sudah diubah ke <select>)
    const btnProsesPinjam = document.getElementById('btn-proses-pinjam');
    const selectPinjamInv = document.getElementById('pinjam-no-inventaris');
    const selectPinjamKelas = document.getElementById('pinjam-kelas');
    const selectPinjamNama = document.getElementById('pinjam-nama');
    const inputPinjamNIS = document.getElementById('pinjam-nis');
    const inputPinjamPass = document.getElementById('pinjam-password'); 
    const pinjamFeedback = document.getElementById('pinjam-feedback');
    
    // Elemen Form Kembali (Sudah diubah ke <select>)
    const btnProsesKembali = document.getElementById('btn-proses-kembali');
    const selectKembaliInv = document.getElementById('kembali-no-inventaris');
    const inputKembaliPass = document.getElementById('kembali-password'); 
    const kembaliFeedback = document.getElementById('kembali-feedback');

    // ===========================================
    // Logika Navigasi Menu Sidebar
    // ===========================================
    // Kode ini WAJIB berjalan agar menu bisa diklik
    if (menuItems.length > 0 && contentSections.length > 0) {
        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.querySelector('a').getAttribute('data-target');
                
                menuItems.forEach(i => i.classList.remove('active'));
                contentSections.forEach(s => s.classList.remove('active'));

                this.classList.add('active');
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.classList.add('active');
                }
            });
        });
    } else {
        console.error("Error: Elemen sidebar (menuItems) tidak ditemukan.");
    }


    // ===========================================
    // Fungsi Baca Data (Fetch CSV)
    // ===========================================
    
    async function fetchData(url) {
        try {
            const respons = await fetch(url);
            if (!respons.ok) {
                 // Ganti error 404 generik menjadi pesan spesifik
                 throw new Error(`Gagal memuat data dari URL: ${url}. Status: ${respons.status} (Not Found)`);
            }
            const dataCsv = await respons.text();
            return dataCsv.split('\n').slice(1).filter(baris => baris.trim() !== '');
        } catch (error) {
            console.error('Error di fungsi fetchData:', error);
            // Tampilkan error di tabel agar pengguna tahu
            if(tabelBuku) tabelBuku.innerHTML = `<tr><td colspan="5" class="loading" style="color:red;">Error: ${error.message}. Cek link CSV.</td></tr>`;
            if(tabelAnggota) tabelAnggota.innerHTML = `<tr><td colspan="4" class="loading" style="color:red;">Error: ${error.message}. Cek link CSV.</td></tr>`;
            return null;
        }
    }
    
    async function muatDataBuku() {
        if (!tabelBuku && !selectPinjamInv) return; // Cek jika elemen ada

        if(tabelBuku) tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Memuat data buku...</td></tr>';
        
        const dataCsv = await fetchData(urlBuku);
        if (!dataCsv) {
            // Pesan error sudah ditangani di dalam fetchData
            return;
        }
        dataBuku = dataCsv.map(baris => {
            const k = baris.split(',');
            return { 
                noInventaris: (k[0]||'').trim(), 
                judul: (k[1]||'').trim(), 
                pengarang: (k[2]||'').trim(), 
                penerbit: (k[3]||'').trim(), 
                status: (k[4]||'').trim() 
            };
        });

        if (tabelBuku) {
            tampilkanDataBuku(dataBuku);
        }
        if (totalJudulBukuElement) {
            updateDashboardStats();
        }
        
        // Panggil fungsi untuk mengisi dropdown buku
        populateBukuDropdowns();
    }

    function tampilkanDataBuku(data) {
        if (!tabelBuku) return;
        tabelBuku.innerHTML = '';
        if (data.length === 0) {
            tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Data tidak ditemukan.</td></tr>';
            return;
        }
        data.forEach(buku => {
            const statusClass = (buku.status || "").toLowerCase() === 'tersedia' ? 'status-tersedia' : 'status-dipinjam';
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
        if (!tabelAnggota && !selectPinjamKelas) return; // Cek jika elemen ada

        if(tabelAnggota) tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading">Memuat data anggota...</td></tr>';
        
        const dataCsv = await fetchData(urlAnggota);
        if (!dataCsv) {
            // Pesan error sudah ditangani di dalam fetchData
            return;
        }
        dataAnggota = dataCsv.map(baris => {
            const k = baris.split(',');
            return { 
                nis: (k[0]||'').trim(), 
                nama: (k[1]||'').trim(), 
                kelas: (k[2]||'').trim(), 
                status: (k[3]||'').trim() 
            };
        });
        
        if (tabelAnggota) {
            tampilkanDataAnggota(dataAnggota);
        }

        // Panggil fungsi untuk mengisi dropdown kelas
        populateKelasSelect();
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
    
    function updateDashboardStats() {
        if (!totalJudulBukuElement) return;
        const totalJudul = dataBuku.length;
        const bukuTersedia = dataBuku.filter(buku => (buku.status || "").toLowerCase() === 'tersedia').length;
        const bukuDipinjam = totalJudul - bukuTersedia;

        totalJudulBukuElement.textContent = totalJudul;
        bukuTersediaElement.textContent = bukuTersedia;
        bukuDipinjamElement.textContent = bukuDipinjam;
    }

    // ===========================================
    // == FUNGSI BARU UNTUK DROPDOWN SIRKULASI ==
    // ===========================================

    function populateBukuDropdowns() {
        if (!selectPinjamInv || !selectKembaliInv) return;

        // Kosongkan dulu
        selectPinjamInv.innerHTML = '<option value="">-- Pilih Buku (Tersedia) --</option>';
        selectKembaliInv.innerHTML = '<option value="">-- Pilih Buku (Dipinjam) --</option>';

        // Urutkan buku berdasarkan No. Inventaris
        const sortedData = [...dataBuku].sort((a, b) => a.noInventaris.localeCompare(b.noInventaris, undefined, { numeric: true }));

        sortedData.forEach(buku => {
            const optionText = `${buku.noInventaris} - ${buku.judul}`;
            
            if ((buku.status || "").toLowerCase() === 'tersedia') {
                // Tambahkan ke dropdown Pinjam
                selectPinjamInv.innerHTML += `<option value="${buku.noInventaris}">${optionText}</option>`;
            } else {
                // Tambahkan ke dropdown Kembali
                selectKembaliInv.innerHTML += `<option value="${buku.noInventaris}">${optionText}</option>`;
            }
        });
    }

    function populateKelasSelect() {
        if (!selectPinjamKelas) return;

        // Dapatkan semua kelas unik dari dataAnggota
        const semuaKelas = dataAnggota.map(anggota => anggota.kelas);
        const kelasUnik = [...new Set(semuaKelas)].sort(); // Urutkan kelas

        selectPinjamKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        kelasUnik.forEach(kelas => {
            if (kelas) { // Hindari jika ada kelas kosong
                selectPinjamKelas.innerHTML += `<option value="${kelas}">${kelas}</option>`;
            }
        });
    }

    // --- Tambahkan Event Listener untuk Dropdown Bertingkat ---
    if (selectPinjamKelas) {
        selectPinjamKelas.addEventListener('change', function() {
            const kelasTerpilih = this.value;
            
            // Kosongkan dropdown nama dan NIS
            selectPinjamNama.innerHTML = '<option value="">-- Pilih Nama --</option>';
            inputPinjamNIS.value = ""; // Pastikan input NIS dikosongkan

            if (!kelasTerpilih) return; // Jika memilih "-- Pilih Kelas --"

            // Filter anggota berdasarkan kelas terpilih
            const anggotaDiKelas = dataAnggota
                .filter(anggota => anggota.kelas === kelasTerpilih)
                .sort((a, b) => a.nama.localeCompare(b.nama)); // Urutkan nama

            if (anggotaDiKelas.length === 0) {
                selectPinjamNama.innerHTML = '<option value="">-- Tidak ada siswa di kelas ini --</option>';
            } else {
                anggotaDiKelas.forEach(siswa => {
                    // Value dari option ini adalah NIS-nya
                    selectPinjamNama.innerHTML += `<option value="${siswa.nis}">${siswa.nama}</option>`;
                });
            }
        });
    }

    if (selectPinjamNama) {
        selectPinjamNama.addEventListener('change', function() {
            // Tampilkan NIS di input readonly
            inputPinjamNIS.value = this.value;
        });
    }

    // ===========================================
    // Logika Filter Pencarian
    // ===========================================
    if (filterBuku) {
        filterBuku.addEventListener('keyup', () => {
            const kataKunci = filterBuku.value.toLowerCase();
            const dataFilter = dataBuku.filter(buku => 
                (buku.judul || "").toLowerCase().includes(kataKunci) ||
                (buku.pengarang || "").toLowerCase().includes(kataKunci) ||
                (buku.penerbit || "").toLowerCase().includes(kataKunci)
            );
            tampilkanDataBuku(dataFilter);
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
            const noInventaris = selectPinjamInv.value; // Diambil dari <select>
            const nis = inputPinjamNIS.value.trim();    // Diambil dari input (readonly)
            const adminPassword = inputPinjamPass.value.trim();
            
            if (!noInventaris || !nis || !adminPassword) {
                pinjamFeedback.textContent = "Mohon lengkapi pilihan Buku, Peminjam, dan Password Admin.";
                pinjamFeedback.style.color = "red";
                return;
            }
            
            this.disabled = true;
            this.textContent = "Memproses...";
            pinjamFeedback.textContent = "Menghubungi server...";
            pinjamFeedback.style.color = "blue";
            
            const dataKirim = {
                action: "pinjamBuku",
                noInventaris: noInventaris,
                nis: nis,
                password: adminPassword
            };
            
            const response = await kirimDataKeBackend(dataKirim);
            
            pinjamFeedback.textContent = response.message;
            pinjamFeedback.style.color = (response.status === "success") ? "green" : "red";
            
            if (response.status === "success") {
                // Reset form
                selectPinjamInv.value = "";
                selectPinjamKelas.value = "";
                selectPinjamNama.innerHTML = '<option value="">-- Pilih kelas terlebih dahulu --</option>';
                inputPinjamNIS.value = "";
                inputPinjamPass.value = "";
                // Muat ulang data agar dropdown buku juga ter-update
                await muatDataBuku(); 
            }
            
            this.disabled = false;
            this.textContent = "Proses Peminjaman";
        });
    }

    if (btnProsesKembali) {
        btnProsesKembali.addEventListener('click', async function() {
            const noInventaris = selectKembaliInv.value; // Diambil dari <select>
            const adminPassword = inputKembaliPass.value.trim(); 
            
            if (!noInventaris || !adminPassword) {
                kembaliFeedback.textContent = "Mohon pilih Buku dan isi Password Admin.";
                kembaliFeedback.style.color = "red";
                return;
            }
            
            this.disabled = true;
            this.textContent = "Memproses...";
            kembaliFeedback.textContent = "Menghubungi server...";
            kembaliFeedback.style.color = "blue";
            
            const dataKirim = {
                action: "kembalikanBuku",
                noInventaris: noInventaris,
                password: adminPassword
            };
            
            const response = await kirimDataKeBackend(dataKirim);
            
            kembaliFeedback.textContent = response.message;
            kembaliFeedback.style.color = (response.status === "success") ? "green" : "red";
            
            if (response.status === "success") {
                // Reset form
                selectKembaliInv.value = "";
                inputKembaliPass.value = "";
                // Muat ulang data agar dropdown buku juga ter-update
                await muatDataBuku(); 
            }
            
            this.disabled = false;
            this.textContent = "Proses Pengembalian";
        });
    }

    async function kirimDataKeBackend(data) {
        try {
            const res = await fetch(urlWebApp, {
                method: "POST",
                body: JSON.stringify(data)
                // PERBAIKAN 'FAILED TO FETCH': Header 'Content-Type' dihapus
            });
            
            if (!res.ok) {
                throw new Error("Respon jaringan tidak OK");
            }
            
            return await res.json(); 
            
        } catch (error) {
            console.error("Error saat mengirim data:", error);
            // Ini adalah pesan error jika server (Google) mati atau URL salah
            return { status: "error", message: "Gagal terhubung ke server. Pastikan URL Web App benar dan server di-deploy." };
        }
    }

    // ===========================================
    // Jalankan Fungsi Saat Halaman Dimuat
    // ===========================================
    muatDataBuku();
    muatDataAnggota();
});
