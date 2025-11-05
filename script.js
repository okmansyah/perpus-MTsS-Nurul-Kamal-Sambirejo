document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================================
    // ⚠️ PERHATIAN: GANTI DUA LINK DI BAWAH INI
    // ==========================================================
    
    // 1. Ganti dengan Link .csv dari Sheet "katalog buku"
    const urlBuku = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=0&single=true&output=csv'; 
    
    // 2. Ganti dengan Link .csv dari Sheet "anggota"
    const urlAnggota = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?gid=485044064&single=true&output=csv'; 
    

    // ===========================================
    // Variabel Global
    // ===========================================
    const menuLinks = document.querySelectorAll('.menu-link');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Variabel Katalog Buku
    const tabelBuku = document.getElementById('tabel-buku');
    const filterBuku = document.getElementById('filterBuku');
    let dataBuku = []; // Penyimpan data buku

    // Variabel Data Anggota
    const tabelAnggota = document.getElementById('tabel-anggota');
    const filterAnggota = document.getElementById('filterAnggota');
    let dataAnggota = []; // Penyimpan data anggota

    
    // ===========================================
    // Logika Menu Klik (Navigasi)
    // ===========================================
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault(); // Hentikan link agar tidak pindah halaman
            
            const targetId = this.getAttribute('data-target');

            // 1. Atur 'active' di menu
            menuLinks.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            
            // 2. Tampilkan/Sembunyikan Konten
            contentSections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });

    // ===========================================
    // Fungsi untuk mengambil data (Fetch)
    // ===========================================

    // Fungsi Generik untuk Ambil Data CSV
    async function fetchData(url) {
        try {
            // Tambahkan parameter cache-busting agar data selalu baru
            const respons = await fetch(`${url}&timestamp=${new Date().getTime()}`);
            if (!respons.ok) {
                throw new Error(`Gagal memuat data (Status: ${respons.status})`);
            }
            const dataCsv = await respons.text();
            // Ubah CSV jadi array, buang baris header (slice(1)) dan baris kosong
            return dataCsv.split('\n').slice(1).filter(baris => baris.trim() !== '');
        } catch (error) {
            console.error('Error fetching data dari URL:', url, error);
            return null; // Kembalikan null jika gagal
        }
    }

    // --- 1. Ambil dan Tampilkan Data BUKU ---
    async function muatDataBuku() {
        const dataCsv = await fetchData(urlBuku);
        if (!dataCsv) {
            tabelBuku.innerHTML = '<tr><td colspan="5" class="loading" style="color: red;">Gagal mengambil data buku. Pastikan Link CSV "katalog buku" Anda benar.</td></tr>';
            return;
        }

        dataBuku = dataCsv.map(baris => {
            const kolom = baris.split(',');
            return {
                noInventaris: (kolom[0] || '').trim(),
                judul: (kolom[1] || '').trim(),
                pengarang: (kolom[2] || '').trim(),
                penerbit: (kolom[3] || '').trim(),
                status: (kolom[4] || '').trim()
            };
        });
        
        tampilkanDataBuku(dataBuku);
    }

    function tampilkanDataBuku(data) {
        tabelBuku.innerHTML = ''; // Kosongkan tabel
        if (data.length === 0) {
            tabelBuku.innerHTML = '<tr><td colspan="5" class="loading">Data tidak ditemukan.</td></tr>';
            return;
        }
        data.forEach(buku => {
            // Perbaiki status agar selalu huruf pertama kapital
            const statusTeks = buku.status.charAt(0).toUpperCase() + buku.status.slice(1).toLowerCase();
            const statusClass = statusTeks.toLowerCase() === 'tersedia' ? 'status-tersedia' : 'status-dipinjam';
            
            const barisHtml = `
                <tr>
                    <td>${buku.noInventaris}</td>
                    <td>${buku.judul}</td>
                    <td>${buku.pengarang}</td>
                    <td>${buku.penerbit}</td>
                    <td><span class="status ${statusClass}">${statusTeks}</span></td>
                </tr>
            `;
            tabelBuku.innerHTML += barisHtml;
        });
    }

    // --- 2. Ambil dan Tampilkan Data ANGGOTA ---
    async function muatDataAnggota() {
        const dataCsv = await fetchData(urlAnggota);
        if (!dataCsv) {
            tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading" style="color: red;">Gagal mengambil data anggota. Pastikan Link CSV "anggota" Anda benar.</td></tr>';
            return;
        }

        dataAnggota = dataCsv.map(baris => {
            const kolom = baris.split(',');
            return {
                nis: (kolom[0] || '').trim(),
                nama: (kolom[1] || '').trim(),
                kelas: (kolom[2] || '').trim(),
                status: (kolom[3] || '').trim()
            };
        });
        
        tampilkanDataAnggota(dataAnggota);
    }

    function tampilkanDataAnggota(data) {
        tabelAnggota.innerHTML = ''; // Kosongkan tabel
        if (data.length === 0) {
            tabelAnggota.innerHTML = '<tr><td colspan="4" class="loading">Data tidak ditemukan.</td></tr>';
            return;
        }
        data.forEach(anggota => {
            const barisHtml = `
                <tr>
                    <td>${anggota.nis}</td>
                    <td>${anggota.nama}</td>
                    <td>${anggota.kelas}</td>
                    <td>${anggota.status}</td>
                </tr>
            `;
            tabelAnggota.innerHTML += barisHtml;
        });
    }

    // ===========================================
    // Logika Filter (Pencarian)
    // ===========================================
    
    // Filter untuk BUKU
    filterBuku.addEventListener('keyup', function() {
        const kataKunci = filterBuku.value.toLowerCase();
        const dataFilter = dataBuku.filter(buku => {
            return (
                buku.judul.toLowerCase().includes(kataKunci) ||
                buku.pengarang.toLowerCase().includes(kataKunci) ||
                buku.penerbit.toLowerCase().includes(kataKunci)
            );
        });
        tampilkanDataBuku(dataFilter);
    });

    // Filter untuk ANGGOTA
    filterAnggota.addEventListener('keyup', function() {
        const kataKunci = filterAnggota.value.toLowerCase();
        const dataFilter = dataAnggota.filter(anggota => {
            return (
                anggota.nama.toLowerCase().includes(kataKunci) ||
                anggota.nis.toLowerCase().includes(kataKunci) ||
                anggota.kelas.toLowerCase().includes(kataKunci)
            );
        });
        tampilkanDataAnggota(dataFilter);
    });

    // ===========================================
    // Jalankan Fungsi Saat Halaman Dimuat
    // ===========================================
    muatDataBuku();
    muatDataAnggota();
});



