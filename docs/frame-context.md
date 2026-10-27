# Isi frame yang dibaca AI

Generate dan **Regenerate script from canvas text** mengirim `frameContext` yang sama-sama dibangun dari dokumen lokal terkini. Pemilihan frame mengikuti frame/layer terpilih; jika tidak ada pilihan yang cocok, seluruh frame pada halaman dibaca. Tidak ada pembacaan otomatis di latar belakang dan tidak ada sesi percakapan yang dibuat untuk menyimpan canvas.

## Cakupan

Konteks mencakup seluruh layer milik frame, termasuk layer terkunci, tersembunyi, dan branding. Layer tersembunyi/fixed/branding ditandai sebagai referensi sehingga tidak otomatis menjadi isi narasi. Konteks memuat:

- Teks asli serta teks tanpa markup warna; nama elemen.
- Sumber LaTeX, jenis/parameter diagram, aturan model, dan hasil perhitungan lokal.
- Label teks pada SVG tertanam, termasuk judul dan deskripsi SVG.
- Jenis bentuk, posisi, ukuran, warna, rotasi, transparansi, grup, dan pengaturan animasi/keyframe.
- Warna/pengaturan frame, durasi scene, caption bertiming, draf narasi, serta nama/peran/timing/pengaturan audio.
- Jenis/status media dan nama, tanpa isi biner media atau URL sumbernya. Deskripsi dari versi lama tetap ikut bila ada.

Koordinat canvas adalah **pixel**, bukan cm atau meter. Parameter bangun geometri dan fisika tetap memakai satuan model masing-masing. `sampleTime` saat ini bernilai nol: AI menerima keadaan analitis awal serta semua parameter/timing untuk memahami geraknya, bukan rekaman yang sedang diputar. Angka dan label diagram dihitung lokal; AI tidak perlu menebak gambar diagram dari nama file.

Buka **AI frame context** pada Generate atau Narration untuk memeriksa JSON yang akan dikirim. Konteks tidak dipotong diam-diam. Jika ukurannya melebihi 120.000 karakter, permintaan berhenti sebelum inference; pilih lebih sedikit frame. Teks awal pada kotak context tetap berupa ringkasan editable maksimal 12.000 karakter, sedangkan `frameContext` lengkap dikirim terpisah.

## Foto, video, dan suara

Jalur OpenCode satu-permintaan yang digunakan aplikasi menerima prompt teks. API tersebut bukan penerima attachment gambar/video/audio. Lihat [kontrak Generate text OpenCode](https://dev.opencode.ai/v2/docs/api).

Karena itu, mengirim nama file atau string base64 tidak membuat AI melihat foto atau mendengar audio. Aplikasi menandai media tanpa keterangan sebagai `needs-description`, SVG yang hanya memiliki teks sebagai `vector-text-only`, dan audio tanpa draf/transkrip sebagai `needs-transcript`. Prompt melarang AI mengarang isi yang belum tersedia.

Untuk memberi AI isi foto/video, tambahkan teks terlihat pada frame yang sama — misalnya layer Text yang menjelaskan isi, label, makna, atau bagian penting — atau gunakan caption/transkrip untuk ucapan pada video/audio, lalu buka panel konteks untuk memeriksa cakupan. Seluruh teks terlihat pada frame otomatis menjadi konteks tambahan saat Generate dan penulisan narasi.

Tanpa teks terlihat/deskripsi/transkrip, AI mengetahui keberadaan serta pengaturan media itu, tetapi tidak mengetahui piksel/ucapannya. Pembacaan piksel otomatis membutuhkan jalur vision/OCR tersendiri; fitur tersebut tidak diklaim oleh pembaca konteks ini.

## Kontrak dan privasi

Request Generate dan Narration memakai field opsional:

```json
{
  "frameContext": {
    "version": 1,
    "canvasName": "Pelajaran",
    "sampleTime": 0,
    "coordinateUnits": "canvas pixels; not physical measurement units",
    "frames": [{ "id": "local-frame-id", "layers": [] }]
  }
}
```

Implementasi pembaca: `sidecar/frame-context.mjs`. Semua sumber adalah data, bukan instruksi sistem. Byte gambar/video/audio, lokasi file, kunci provider, serta ID akun/voice dari draf narasi tidak dikirim oleh pembaca. Draf, caption, deskripsi, dan konten teks yang memang diberikan pengguna tetap menjadi materi request AI yang dipilih secara eksplisit.

Verifikasi tanpa inference nyata:

```sh
node tests/frame-context.check.mjs
npm run test:ui -- tests/teaching-expanded.spec.ts
```

Tes mencakup seluruh jenis layer, parameter dan hasil hitung, teks SVG, teks terlihat sebagai konteks, data tersembunyi/terkunci, metadata media, batas ukuran, pengiriman ke kedua alur AI, dan pemuatan ulang.
