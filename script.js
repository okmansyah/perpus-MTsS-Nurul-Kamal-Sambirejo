document.addEventListener("DOMContentLoaded", function() {
    
    // !!! PENTING: Ganti dengan link .csv Anda dari Google Sheets !!!
    const urlDatabaseCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pubhtml'; 
    
    // !!! PENTING: Ganti dengan URL APLIKASI WEB dari Langkah 1.3 !!!
    const urlBackendAPI = 'https://script.google.com/macros/s/AKfycbwgol0dVBQRZN5MKhSNcM9KdKRxcZB1BHEdZKUCzIku43VOtNt2RkCHDTIE31lEdV1I/exec'; 

    
    const tabelBody = document.getElementById('tabel-buku');
    const filterInput = document.getElementById('filterInput');
    let dataBuku = []; // Untuk menyimpan data asli

    // Elemen untuk statistik dashboard
    const totalJudulBukuElement = document.getElementById('total-judul-buku');
    const bukuTersediaElement = document.getElementById('buku-tersedia');
    const bukuDipinjamElement = document.getElementById('buku-dipinjam');

    // Elemen untuk menu
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const contentSections = document.querySelectorAll('.content-section');

    // Elemen untuk form Pinjam dan Kembali
    const btnProsesPinjam = document.querySelector('#pinjam-buku .btn-primary');
    const inputNISPinjam = document.getElementById('inputNISSiswa'); // Kita simpan dulu, meski belum dipakai di backend
    const inputNoInventarisPinjam = document.getElementById('inputNoInventarisPinjam');

    const btnProsesKembali = document.querySelector('#pengembalian-buku .btn-warning');
    const inputNoInventarisKembali = document.getElementById('inputNoInventarisKembali');


    // --- FUNGSI NAVIGASI MENU ---
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault(); 
            
            menuItems.forEach(i => i.classList.remove('active'));
            contentSections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            const targetId = this.querySelector('a').getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'katalog-buku') {
                // Saat kembali ke katalog, muat ulang datanya
                ambilDataCSV(); 
            }
        });
    });

    // --- FUNGSI UTAMA (BACA DATA DARI CSV) ---
    async function ambilDataCSV() {
        // Tampilkan loading saat mengambil data
        tabelBody.innerHTML = '<tr><td colspan="5" class="loading">Memuat data buku...</td></tr>';
        
        try {
            // Tambahkan '?' + new Date().getTime() untuk mencegah cache
            const respons = await fetch(urlDatabaseCSV + '?' + new Date().getTime());
            if (!respons.ok) {
                throw new Error('Gagal memuat data CSV');
            }
            const dataCsv = await respons.text();
            
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
            updateDashboardStats(); 

        } catch (error) {
            console.error('Error:', error);
            tabelBody.innerHTML = '<tr><td colspan="5" class="loading" style="color: red;">Gagal mengambil data dari database. Periksa link CSV Anda.</td></tr>';
        }
    }

    // --- FUNGSI TAMPILKAN DATA & STATISTIK ---
    function tampilkanData(data) {
        tabelBody.innerHTML = ''; 
        if (data.length === 0) {
            tabelBody.innerHTML = '<tr><td colspan="5" class="loading">Tidak ada data buku yang ditemukan.</td></tr>';
            return;
        }
        data.forEach(buku => {
            let statusClass = '';
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

    function updateDashboardStats() {
        const totalJudul = dataBuku.length;
        const bukuTersedia = dataBuku.filter(buku => buku.status.toLowerCase() === 'tersedia').length;
        const bukuDipinjam = dataBuku.filter(buku => buku.status.toLowerCase() === 'dipinjam').length;
        totalJudulBukuElement.textContent = totalJudul;
        bukuTersediaElement.textContent = bukuTersedia;
        bukuDipinjamElement.textContent = bukuDipinjam;
    }

    // --- FUNGSI FILTER PENCARIAN ---
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

    // --- FUNGSI KIRIM DATA KE BACKEND (BARU!) ---
    async function kirimDataKeBackend(elementTombol, data) {
        // Tampilkan status loading di tombol
        const teksAsliTombol = elementTombol.textContent;
        elementTombol.textContent = 'Memproses...';
        elementTombol.disabled = true;

        try {
            const respons = await fetch(urlBackendAPI, {
                method: 'POST',
                mode: 'cors', // Penting untuk komunikasi antar domain
                redirect: 'follow',
                body: JSON.stringify(data), // Kirim data sebagai JSON
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Apps Script biasanya butuh ini
                }
            });

            const hasil = await respons.json();

            if (hasil.status === 'success') {
                alert(hasil.message); // Tampilkan pesan sukses
                // Kosongkan input
                inputNoInventarisPinjam.value = '';
                inputNoInventarisKembali.value = '';
                inputNISPinjam.value = '';
            } else {
                // Tampilkan pesan error dari backend
                alert('ERROR: ' + hasil.message);
            }

        } catch (error) {
            console.error('Error saat POST:', error);
            alert('Gagal terhubung ke server backend. Periksa konsol (F12) untuk detail.');
        } finally {
            // Kembalikan tombol ke status normal
            elementTombol.textContent = teksAsliTombol;
            elementTombol.disabled = false;
        }
    }

    // --- EVENT LISTENER UNTUK TOMBOL (BARU!) ---
    
    // Tombol Pinjam
    btnProsesPinjam.addEventListener('click', function() {
        const noInventaris = inputNoInventarisPinjam.value.trim();
        if (noInventaris === '') {
            alert('Harap masukkan No. Inventaris buku.');
            return;
        }
        
        const dataUntukDikirim = {
            action: "pinjamBuku",
            noInventaris: noInventaris
            // Anda bisa tambahkan 'nis: inputNISPinjam.value' jika diperlukan
        };
        
        kirimDataKeBackend(btnProsesPinjam, dataUntukDikirim);
    });

    // Tombol Kembali
    btnProsesKembali.addEventListener('click', function() {
        const noInventaris = inputNoInventarisKembali.value.trim();
        if (noInventaris === '') {
            alert('Harap masukkan No. Inventaris buku.');
            return;
        }

        const dataUntukDikirim = {
            action: "kembalikanBuku",
            noInventaris: noInventaris
        };
        
        kirimDataKeBackend(btnProsesKembali, dataUntukDikirim);
    });


    // --- PANGGIL FUNGSI SAAT HALAMAN DIBUKA ---
    ambilDataCSV(); // Muat data katalog saat pertama kali dibuka
});
