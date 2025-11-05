document.addEventListener("DOMContentLoaded", function() {
    
    // !!! PENTING: Ganti dengan link .csv Anda dari Google Sheets !!!
    const urlDatabase = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT5Drx7hO3X54afpQyQEj01DTXQLON2eAAG5OIBjNL24Ub_6pIJ6Sr43gjQKAkd_J3nrHfM1XrhNI-/pub?output=csv'; 
    
    const tabelBody = document.getElementById('tabel-buku');
    const filterInput = document.getElementById('filterInput');
    let dataBuku = []; // Untuk menyimpan data asli

    // Fungsi untuk mengambil data dari Google Sheets
    async function ambilData() {
        try {
            const respons = await fetch(urlDatabase);
            if (!respons.ok) {
                throw new Error('Gagal memuat data');
            }
            const dataCsv = await respons.text();
            
            // Mengubah data CSV mentah menjadi array yang bisa dipakai
            // split('\n') memecah per baris, slice(1) membuang baris header (JudulBuku, dll)
            dataBuku = dataCsv.split('\n').slice(1).map(baris => {
                // Split per koma. Hati-hati jika ada koma di dalam judul
                const kolom = baris.split(',');
                return {
                    noInventaris: kolom[0] || '',
                    judul: kolom[1] || '',
                    pengarang: kolom[2] || '',
                    penerbit: kolom[3] || '',
                    status: kolom[4] ? kolom[4].trim() : '' // .trim() untuk hapus spasi
                };
            });
            
            tampilkanData(dataBuku);

        } catch (error) {
            console.error('Error:', error);
            tabelBody.innerHTML = '<tr><td colspan="5" class="loading" style="color: red;">Gagal mengambil data dari database. Periksa link CSV.</td></tr>';
        }
    }

    // Fungsi untuk menampilkan data ke tabel HTML
    function tampilkanData(data) {
        tabelBody.innerHTML = ''; // Kosongkan tabel dulu
        
        if (data.length === 0) {
            tabelBody.innerHTML = '<tr><td colspan="5" class="loading">Tidak ada data buku.</td></tr>';
            return;
        }

        data.forEach(buku => {
            // Tentukan style CSS berdasarkan status
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
