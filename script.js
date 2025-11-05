document.addEventListener("DOMContentLoaded", function() {
    // !!! PENTING: Ganti dengan link .csv Anda dari Google Sheets !!!
    const urlDatabase = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?output=csv'; 
    
    const tabelBody = document.getElementById('tabel-buku');
    const filterInput = document.getElementById('filterInput');
    let dataBuku = []; // Untuk menyimpan data asli

    // Elemen untuk statistik dashboard
    const totalJudulBukuElement = document.getElementById('total-judul-buku');
    const bukuTersediaElement = document.getElementById('buku-tersedia');
    const bukuDipinjamElement = document.getElementById('buku-dipinjam');

    // Ambil semua item menu sidebar
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    // Ambil semua section konten
    const contentSections = document.querySelectorAll('.content-section');

    // Fungsi untuk mengubah section aktif saat menu diklik
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault(); // Mencegah link pindah halaman
            
            // Hapus kelas 'active' dari semua menu item dan content section
            menuItems.forEach(i => i.classList.remove('active'));
            contentSections.forEach(s => s.classList.remove('active'));

            // Tambahkan kelas 'active' ke menu item yang diklik
            this.classList.add('active');

            // Dapatkan target section dari atribut data-target
            const targetId = this.querySelector('a').getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // Jika yang di-klik adalah "Katalog Buku", pastikan tabelnya terisi
            if (targetId === 'katalog-buku') {
                tampilkanData(dataBuku); // Tampilkan ulang data jika perlu
            }
        });
    });

    // Fungsi untuk mengambil data dari Google Sheets
    async function ambilData() {
        try {
            const respons = await fetch(urlDatabase);
            if (!respons.ok) {
                throw new Error('Gagal memuat data');
            }
            const dataCsv = await respons.text();
            
            // Mengubah data CSV mentah menjadi array yang bisa dipakai
            // split('\n') memecah per baris, slice(1) membuang baris header
            // filter(baris => baris.trim() !== '') untuk membuang baris kosong
            dataBuku = dataCsv.split('\n').slice(1).filter(baris => baris.trim() !== '').map(baris => {
                const kolom = baris.split(',');
                return {
                    noInventaris: kolom[0] ? kolom[0].trim() : '',
                    judul: kolom[1] ? kolom[1].trim() : '',
                    pengarang: kolom[2] ? kolom[2].trim() : '',
                    penerbit: kolom[3] ? kolom[3].trim() : '',
                    status: kolom[4] ? kolom[4].trim() : '' 
                };
            });
            
            tampilkanData(dataBuku);
            updateDashboardStats(); // Panggil fungsi untuk update statistik

        } catch (error) {
            console.error('Error:', error);
            tabelBody.innerHTML = '<tr><td colspan="5" class="loading" style="color: red;">Gagal mengambil data dari database. Periksa link CSV Anda dan pastikan sudah dipublikasikan.</td></tr>';
        }
    }

    // Fungsi untuk menampilkan data ke tabel HTML
    function tampilkanData(data) {
        tabelBody.innerHTML = ''; 
        
        if (data.length === 0) {
            tabelBody.innerHTML = '<tr><td colspan="5" class="loading">Tidak ada data buku yang ditemukan.</td></tr>';
            return;
        }

        data.forEach(buku => {
            let statusClass = '';
            // Pastikan status di Google Sheet sesuai ('Tersedia', 'Dipinjam')
            if (buku.status.toLowerCase() === 'tersedia') {
                statusClass = 'status-tersedia';
            } else if (buku.status.toLowerCase() === 'dipinjam') {
                statusClass = 'status-dipinjam';
            }

            const barisHtml = `
                <tr>
                    <td>${buku.noInventaris}</td>
                    <td>${buku.judul}</td>
                    <td>${buku.pengarang}</td>
                    <td>${buku.penerbit}</td>
                    <td><span class="status ${statusClass}">${buku.status}</span></td>
                </tr>
            `;
            tabelBody.innerHTML += barisHtml;
        });
    }

    // Fungsi untuk update statistik di Dashboard
    function updateDashboardStats() {
        const totalJudul = dataBuku.length;
        const bukuTersedia = dataBuku.filter(buku => buku.status.toLowerCase() === 'tersedia').length;
        const bukuDipinjam = dataBuku.filter(buku => buku.status.toLowerCase() === 'dipinjam').length;

        totalJudulBukuElement.textContent = totalJudul;
        bukuTersediaElement.textContent = bukuTersedia;
        bukuDipinjamElement.textContent = bukuDipinjam;
    }

    // Fungsi untuk filter/pencarian
    filterInput.addEventListener('keyup', function() {
        const kataKunci = filterInput.value.toLowerCase();
        
        const dataFilter = dataBuku.filter(buku => {
            return (
                buku.judul.toLowerCase().includes(kataKunci) ||
                buku.pengarang.toLowerCase().includes(kataKunci) ||
                buku.penerbit.toLowerCase().includes(kataKunci)
            );
        });
        
        tampilkanData(dataFilter);
    });

    // Panggil fungsi utama untuk mengambil data saat halaman dibuka
    ambilData();
});
