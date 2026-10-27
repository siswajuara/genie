# Model pembelajaran SD–SMP

Genie menyediakan **20 model fisika** dan **40 model pembelajaran matematika/Bahasa Indonesia**. Elemen tersimpan lokal sebagai parameter yang bisa diedit, dengan SVG mandiri untuk portabilitas. Pemutaran timeline dan ekspor memakai renderer lokal yang sama; tidak memerlukan gambar atau kode simulasi dari AI.

## Menambahkan dan mengedit

Buka **Elements → Learning diagram** untuk matematika dan Bahasa Indonesia, atau **Physics diagram** untuk fisika. Pilih model di Properties, lalu ubah parameternya. Teks yang terdiri dari beberapa bagian memakai satu bagian per baris; pilih **Apply diagram text** setelah mengedit. Input yang belum valid tidak mengganti diagram tersimpan.

**Animate emphasis** menyorot bagian diagram secara bergantian. Bangun ruang adalah proyeksi ilustratif dengan ukuran tertulis, bukan mesin 3D. Animasi penekanan tidak mengubah hasil perhitungan. Mode reduced motion mempertahankan keadaan awal. Matikan Animate emphasis untuk diagram diam.

| Kelompok              | Model                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Bangun datar (8)      | Persegi, persegi panjang, segitiga siku-siku, lingkaran, jajar genjang, trapesium sama kaki, belah ketupat, layang-layang        |
| Bangun ruang (7)      | Kubus, balok, tabung, kerucut, bola, prisma segitiga siku-siku, limas persegi                                                    |
| Bilangan dan data (4) | Pecahan, garis bilangan, koordinat Kartesius, diagram batang                                                                     |
| Bahasa Indonesia (5)  | Struktur kalimat S–P–O–K, suku kata, kelompok kosakata (sinonim/antonim/imbuhan), urutan cerita, ide pokok dan rincian pendukung |

Ukuran geometri memakai cm; luas cm² dan volume cm³ dihitung oleh aplikasi. Hasil desimal yang dibulatkan memakai tanda pendekatan. Tinggi segitiga/jajar genjang/trapesium tegak lurus alas. Alas prisma segitiga adalah segitiga siku-siku; limas persegi memiliki puncak tepat di atas pusat alas. Trapesium sama kaki mensyaratkan alas bawah lebih panjang daripada atas. Layang-layang memakai pembagian diagonal simetri 1:2 agar bentuk dapat ditentukan dari dua diagonal.

Pecahan dibatasi 0–1 dan maksimal 12 bagian sama besar. Garis bilangan memiliki 1–20 interval, dengan titik di dalam rentang. Koordinat memakai skala −5 sampai 5. Diagram batang berisi 2–6 kategori bernilai 0–100; sumbu dimulai dari nol dan data contoh tidak dianggap statistik nyata.

Model S–P–O–K memakai contoh kalimat transitif; tidak mengajarkan bahwa semua kalimat wajib mempunyai objek. Validasi suku kata memeriksa apakah potongan menyatu menjadi kata, bukan analisis kebahasaan otomatis. AI diarahkan mengikuti kaidah ejaan; pengguna tetap memeriksa ketepatan pemenggalan dan makna dalam konteks. Rujukan: [pemenggalan kata EYD V](https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/pemenggalan-kata/).

## Fisika

Empat model sebelumnya tetap tersedia: bandul sudut kecil, pegas teredam, proyektil ideal, dan gerak melingkar beraturan. Delapan tambahan:

| Model                 | Besaran dan batas konsep                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Gerak lurus beraturan | Kecepatan tetap dan panjang lintasan; posisi s = vt                                                                                    |
| Jatuh bebas           | Benda dilepas dari diam, tanpa hambatan udara; tinggi awal dan gravitasi                                                               |
| Tuas ideal            | Beban, panjang lengan beban/kuasa; keseimbangan momen                                                                                  |
| Katrol ideal          | Skema gaya pada 1–4 ruas tali penopang; tanpa gesekan/massa katrol, bukan gambar lintasan tali lengkap                                 |
| Gaya apung            | Massa jenis benda/cairan, volume, gravitasi; diagram keseimbangan terapung atau gaya saat terendam penuh                               |
| Gelombang transversal | Amplitudo, panjang gelombang, frekuensi; laju v = λf                                                                                   |
| Rangkaian DC          | Satu sumber dan satu resistor ideal; arus I = U/R dan daya P = UI; titik bergerak mengilustrasikan arah arus, bukan kecepatan elektron |
| Pemantulan cahaya     | Cermin datar; sudut datang/pantul diukur terhadap normal                                                                               |

Parameter fisika menggunakan SI. Tuas, gaya apung, dan pemantulan menjelaskan hubungan besaran; bukan simulasi gerak bebas dengan tumbukan. Model apung tidak memodelkan gelombang cairan atau lintasan benda tenggelam. Dasar konsep: [pesawat sederhana](https://openstax.org/books/physics/pages/9-3-simple-machines) dan [prinsip Archimedes](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy), OpenStax.

## AI dapat menambahkan elemen baru

Pilih **Generate → SD–SMP lesson**, atau masukkan materi seperti “volume kubus kelas 6 SD” dan “subjek predikat kelas 4 SD”. Rekomendasi template mengutamakan layout pelajaran dengan area visual. Keenam **Pelajaran Visual** menyediakan area untuk satu diagram baru, termasuk bila template awal belum memiliki elemen matematika/fisika/bahasa.

Request scene mengirim `allowVisual:true` hanya jika template memiliki `teachingArea`. Prompt menyertakan katalog jenis, parameter, rentang, contoh, dan aturan materi. AI dapat mengembalikan satu `visual`:

```json
{ "type": "learning", "settings": { "kind": "cube", "side": 4 } }
```

Pilihan lain adalah `type:"physics"` dengan parameter model atau `type:"latex"` dengan sumber persamaan. AI tidak menentukan posisi, ukuran, ID, SVG, URL, atau kode. Aplikasi menambahkan elemen baru ke area yang disediakan, menghapus placeholder, merendernya, dan memasukkannya dalam satu perubahan canvas saat frame ditambahkan. AI boleh menghilangkan visual jika tidak membantu scene.

Template yang sudah memiliki diagram tetap memakai slot `learning:[{id,settings}]` atau `physics:[{id,settings}]`, dengan jenis dan ID dipertahankan. Template lama tanpa area visual mempertahankan tata letaknya; pilih **Pelajaran Visual** bila ingin AI menambahkan diagram baru. Logo, footer, dan nomor halaman dikelola aplikasi.

Pada review, periksa **Added teaching visual**, ubah model/parameter/teks, atau pilih **Remove teaching visual**. Periksa juga kesinambungan soal, jawaban, satuan, dan narasi. Setelah **Add frame**, diagram tetap dapat diedit, disimpan ulang, di-undo, dan diekspor bersama animasi. OpenCode tetap menangani penulisan; ElevenLabs hanya dipanggil untuk narasi yang diaktifkan saat penambahan frame.

## Preset dan pengujian

Koleksi eksternal **SD & SMP** berisi **62 preset**: 40 contoh pembelajaran, 16 contoh fisika tambahan, dan enam layout visual adaptif. Ditambah koleksi lama, pustaka berisi 110 template. Data sumber: `design-references/learning-presets.json`; persiapan: `scripts/learning-presets.mjs`. Semua mengikuti standar logo/footer dan panduan preset dalam `design-references/README.md`.

```sh
npm run presets:learning
npm run presets:previews
npm run presets:index
node tests/learning.check.mjs
npm run test:ui -- tests/learning.spec.ts
```

Tes numerik mencocokkan jawaban yang diketahui, rentang, SVG aman, animasi deterministik, dan izin penambahan elemen AI. Tes browser memeriksa pengeditan, pemuatan ulang, reduced motion, ekspor PNG pada waktu berbeda, template eksternal, dan penambahan geometri/bahasa/fisika oleh AI melalui respons mock. Tidak diperlukan panggilan model, audio, atau publikasi berbayar untuk pengujian.

## Model tambahan dan animasi

Enam belas model learning tambahan: sudut, segi banyak beraturan (3–10 sisi), jaring-jaring kubus, perkalian baris-kolom, nilai tempat, penjumlahan pecahan, diagram lingkaran, diagram garis, jam analog, persamaan satu variabel, Venn dua himpunan, perbandingan, tanda baca, imbuhan, sebab-akibat, dan peta unsur cerita.

Delapan model fisika tambahan: GLBB satu arah dengan percepatan positif, bidang miring tanpa gesekan, gesekan kinetik pada kecepatan tetap, hidrolik ideal, tekanan hidrostatis ukur, pembiasan/pantulan internal total, gelombang longitudinal, dan dua resistor seri. Asumsi dan batas parameter setiap model ikut dikirim dalam katalog AI. Imbuhan hanya memakai penggabungan langsung tanpa perubahan bunyi; jam analog mempertahankan waktu pelajaran saat animasi menyorot jarum; jaring kubus menelusuri sisi, bukan simulasi lipatan 3D.

Animasi learning memakai penekanan warna/penanda yang halus berdasarkan waktu scene, tanpa timer atau acak. Isi, label, dan jawaban matematika tetap sama sepanjang animasi. Scrub, preview, dan ekspor memakai fungsi yang sama; Animate emphasis=false dan reduced motion menghasilkan keadaan diam. Pemeriksaan meliputi semua 40 model di beberapa waktu, konsistensi teks, nilai yang diketahui, dan render canvas sebenarnya.

AI kini menerima konteks seluruh layer, bukan hanya teks yang dipilih untuk ringkasan. Lihat [pembacaan frame dan batas media](frame-context.md) untuk persamaan, hasil hitung, SVG, caption, media, dan deskripsi yang tersimpan lokal.
