# Analisa: Dialog "Generate frames" — overflow, isi tidak sesuai template, animasi hilang, narasi gantung

> Historical analysis: generation transport has since moved to the OpenCode SDK with Beam Free. See [current setup and contract](ai-generation.md); Cloudflare references below describe the earlier implementation.

Tanggal: 2026-10-27. Sumber: screenshot pengguna + inspeksi kode lokal (tanpa model call berbayar).
Cakupan: `src/editor/generate-dialog.tsx`, `src/editor/generation.ts`, `src/styles/generate.css`,
`src/components/ui/scroll-area.tsx`, `sidecar/generate.mjs`, `src/editor/template-animation.ts`,
`src/editor/resolve-assets.ts`, asset pack `asset-packs/siswa-juara/pack/presets/`.

---

## 1. Ringkasan temuan

| #   | Keluhan pengguna                                                                                                                       | Akar masalah (sudah diverifikasi di kode/data)                                                                                                                                                                                                            | Tingkat keyakinan                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A   | Panel kanan dialog overflow terpotong (filmstrip Cover–List + kartu editor)                                                            | Kombinasi grid blowout + komponen `ScrollArea` satu-orientasi + `.generate-scene-list { width: max-content }` tanpa pengaman `minmax(0,…)`                                                                                                                | Tinggi (mekanisme pasti, lihat §2; titik pemicu persisnya perlu cek computed style) |
| B   | Hasil generate "tidak menempatkan isi sesuai template" (teks bertumpuk, badge/CTA ikut ditulis ulang, frame duplikat, slot IMG kosong) | `textSlots()` mengirim SEMUA teks non-logo/footer sebagai slot AI — termasuk badge "SISWA JUARA • …", nomor halaman "3/5", angka list "1/2/3", headline yang terpecah 2 box; tidak ada deduplikasi template antar-scene; image slot memang tidak diisi AI | Terverifikasi (data + kode)                                                         |
| C   | "Template yang baru tidak menggunakan animasi sama sekali"                                                                             | 7 template `essentials-*` ber-`motion: "none"` → `withTemplateAnimation()` skip; `fillGenerationTemplates()` hanya memperpanjang `animation.end` bila animasi sudah ada                                                                                   | Terverifikasi                                                                       |
| D   | "Hasil generate content dari AI dan narasinya terasa gantung"                                                                          | System prompt tidak memberi panduan per-useCase, tidak ada panjang minimum narasi per durasi scene, tidak ada alur antar-scene, tidak ada larangan mengulang headline yang sama                                                                           | Terverifikasi (baca prompt)                                                         |

---

## 2. Masalah A — overflow panel kanan

### Bukti visual

- Screenshot 1 (`image-1.png`): kartu ke-5 "List" terpotong di tepi dialog, kartu editor "01 · Cover" ikut terpotong
  (dropdown "6 seconds", toggle, textarea). Artinya yang melebar **seluruh kolom kanan**, bukan cuma filmstrip.
- Screenshot 4: dialog muat normal — jadi ini tergantung lebar konten (jumlah scene × 102px + jumlah kolom editor).

### Struktur kode terkait

- `src/editor/generate-dialog.tsx:204-210` — `ScrollArea.generate-scenes` (vertikal, default) membungkus
  `ScrollArea.generate-filmstrip` (`orientation="horizontal"`) yang berisi `.generate-scene-list`.
- `src/components/ui/scroll-area.tsx:5-15` — komponen hanya merender **satu** `Scrollbar` sesuai `orientation`.
  Radix mengaktifkan scroll-X hanya bila ada Scrollbar horizontal (terkonfirmasi di
  `node_modules/@radix-ui/react-scroll-area/dist/index.mjs`: `overflowX: context.scrollbarXEnabled ? "scroll" : "hidden"`).
- `src/styles/generate.css:17` — `.generate-layout { display:grid; grid-template-columns: 1fr 1.03fr; … }`.
- `src/styles/generate.css:60` — `.generate-scene-list { display:flex; gap:10px; width:max-content; … }`.
- Kartu `width:102px` (`generate.css:61`); 5 scene ≈ 550px + padding — lebih lebar dari kolom kanan
  (~500px pada dialog 1080px), jadi filmstrip **wajib** scroll horizontal.

### Hipotesis akar masalah (urut kemungkinan)

1. **Grid blowout.** `1fr` = `minmax(auto, 1fr)`: minimum grid item = min-content konten. Elemen terlebar
   adalah `.generate-scene-list` (`max-content`). Memang ada `.ui-scroll-area { min-width:0 }`
   (`generate.css:2`) dan `.generate-column { max-width:100% }` (`generate.css:20`), tapi rantai Radix
   (Root → Viewport → div kolom) + `width:100%; height:100%` pada Viewport membuat proteksi ini rapuh;
   perbaikan baku: `grid-template-columns: minmax(0,1fr) minmax(0,1.03fr)` + `min-width:0` eksplisit pada
   `.generate-scenes` dan `.generate-scene-editor`.
2. **Filmstrip horizontal tidak menjadi scroll container yang efektif.** Root horizontal tidak punya tinggi
   eksplisit; Viewport `height:100%` terhadap parent `height:auto` → perilaku tinggi tak tentu; Scrollbar
   horizontal di-render sebagai flex-child statis (CSS `generate.css:5-7` tidak memosisikan absolut seperti
   pola baku Radix), sehingga bisa menambah lebar/tinggi tak terduga.
3. **Kontributor sekunder:** `.generate-template-trigger strong { white-space:nowrap }` (`generate.css:79`),
   `.generate-fields` 2 kolom (`generate.css:37`), dan `.generate-count { white-space:nowrap }`
   (`generate.css:58`) ikut menaikkan min-content kolom.

### Perbaikan yang diminta (sesuai permintaan pengguna: pakai `@src/components/ui/scroll-area.tsx`)

- Kolom kanan tetap `ScrollArea` vertikal; filmstrip tetap `ScrollArea` horizontal — **jangan** ganti ke
  `overflow:auto` mentah.
- `generate.css:17`: `grid-template-columns: minmax(0,1fr) minmax(0,1.03fr);`
- Tambah pengaman: `.generate-scenes, .generate-inputs { min-width:0; overflow:hidden; }`,
  `.generate-filmstrip { max-width:100%; }`, `.generate-scene-editor { min-width:0; }`.
- Pastikan `ScrollArea` horizontal benar-benar scroll: beri `type="always"` (atau `"scroll"`) pada filmstrip
  saat konten overflow agar affordance terlihat, dan/atau `max-width:100%` pada Root-nya.
- Kriteria terima: pada dialog 1080px dengan 5–8 scene, tidak ada konten terpotong di kolom kanan;
  filmstrip scroll horizontal; kolom kiri/kanan scroll vertikal independen; tidak ada regresi pada
  breakpoint `max-width:760px` (`generate.css:105-118`).

### Cara verifikasi (tanpa paid call)

- Playwright `tests/generate.spec.ts` sudah mem-mock `ai.generate`; tambah assertion:
  `dialog` memenuhi `scrollWidth <= clientWidth` pada `.generate-scenes` dan filmstrip bisa di-scroll
  (`scrollWidth > clientWidth` + `scrollTo` mengubah `scrollLeft`).

---

## 3. Masalah B — isi tidak menempati template

### B.1 Slot AI mencakup chrome template (terverifikasi, ini penyebab utama)

`textSlots()` (`src/editor/generation.ts:31-36`) menyertakan **semua** objek teks kecuali `hide` dan
`brandRole logo/footer`. Akibatnya slot yang dikirim ke AI mencakup elemen yang seharusnya invarian.
Hitungan kapasitas dari template asli (`classic/sudah-lancar-membaca-4-5.json`):

| layer      | nama                                       | ukuran → maxChars (rumus `generation.ts:34`)                   |
| ---------- | ------------------------------------------ | -------------------------------------------------------------- |
| layer-3    | badge "SISWA JUARA • ORANG TUA PERLU TAHU" | ~71 char → **ditulis ulang AI**                                |
| layer-5    | nomor halaman "1/5"                        | ~4 char → **ditulis ulang AI**                                 |
| layer-6/7  | headline terpecah 2 box                    | ~19 + ~22 char (AI mengisi 2 fragmen tanpa tahu satu headline) |
| layer-9/11 | quote + CTA kuning                         | ~102 + ~28 char                                                |

Screenshot 4 membuktikan: mode review menampilkan field "SISWA JUARA •" dan "3/5" sebagai input editable.
Risiko: AI mengubah badge/nomor (padahal nomor harus = posisi scene), membuang token/usaha pada chrome,
dan validasi `parseGenerationResult` (`sidecar/generate.mjs:62-65`) gagal total bila satu slot tidak pas.

### B.2 Headline terpecah beberapa box

Template klasik memecah satu headline visual menjadi 2 objek teks (layer-6/7). Prompt
(`sidecar/generate.mjs:40-41`) hanya berkata "Slots may be fragments of one headline" — tanpa/memberi tahu
AI pasangan fragmennya atau batas gabungannya. Hasil: headline tidak menyatu + tumpukan kuning menutup teks
(terlihat di screenshot 2–3: `"Bacanya lancar, Bu. Tapi bingung"` tertutup pil "Yuk, cek pemahaman.").

### B.3 Frame duplikat antar-scene

`sceneTemplate()` (`generation.ts:28-30`) memilih template terbaik **per scene secara independen**;
skor = +20 bila `useCases` cocok + 3 per kata konteks. Template katalog mencakup banyak useCase sekaligus
(mis. "Gawai dan Pemahaman": cover+content; "Kelancaran Membaca…": cover+content), sehingga scene 1 (cover)
dan scene 2 (content) dapat memilih **template identik**. Screenshot 2–3 menunjukkan scene 1–2 sama persis
("LANCAR MEMBACA / JAWABAN SALAH?") dan scene 3–4 sama persis ("TANYAKAN 3 HAL"). Tidak ada logika
diversifikasi/pengingat "satu template satu scene".

### B.4 Slot gambar kosong

`fillGenerationTemplates` hanya mengisi teks; image slot diselesaikan oleh `resolvePresetAssets`
(`resolve-assets.ts:5-39`) dari asset pack — bila tidak cocok, placeholder "IMG / Story photo" dipertahankan
(terlihat di frame "Cerita Raka"). Untuk useCase `image`, hasil generate memang tidak menaruh gambar apa pun.
Ini ekspektasi yang harus diputuskan: (a) sembunyikan scene `image` bila tak ada aset, atau (b) tandai jelas
di review bahwa slot gambar perlu diisi manual, atau (c) isi otomatis dari library.

### B.5 `fitText` menyusutkan font tapi tidak mereflow layout

`fitText` (`generation.ts:46-66`) mengecilkan font sampai teks muat dalam box, lalu melempar error bila tetap
tidak muat. Box yang tumpang tindih di desain (headline 2 baris + pil highlight) tetap tumpang tindih —
teks AI yang panjangnya berbeda dari contoh template memperparah overlap visual.

### Rencana perbaikan B (untuk AI pelaksana)

1. Perkenalkan konsep **slot role**: `locked` (badge, nomor halaman, angka list "1/2/3", CTA generik) vs
   `editable`. Opsi implementasi (pilih satu, urut rekomendasi):
   - Tandai di data template: objek chrome diberi `hide:true` (tidak dirender? tidak — hide menyembunyikan),
     lebih tepat: tambah flag `locked`/abaikan-slot di `model.ts` + skrip migrasi preset, lalu filter di
     `textSlots()`. Nomor halaman sebaiknya **diisi otomatis** = indeks scene (`0X/0N`), bukan oleh AI.
   - Atau filter heuristik sementara: kecualikan teks ≤ 6 char yang seluruhnya digit/simbol (`1/5`, `1`)
     dan badge yang mengandung "SISWA JUARA". Heuristik rapuh — jadikan batu loncatan saja.
2. Gabungkan fragmen headline: bila dua box teks berdekatan vertikal dengan gaya sama, kirim sebagai **satu
   slot** lalu pecah kembali saat `fillGenerationTemplates` (atau ubah template agar headline = 1 box).
3. Diversifikasi template: di `makeScenes`/`sceneTemplate`, jangan pilih identifier yang sudah dipakai scene
   lain kecuali tidak ada alternatif (fallback: tambah varian suffix pada judul).
4. Putuskan perilaku image slot (opsi a/b/c di §B.4) dan tampilkan statusnya di kartu review.
5. Tambah **pratinjau render per-scene di dialog review** (pakai `PresetPreviewImage` yang sudah ada di
   `generate-dialog.tsx:209` + renderer scaled) sehingga overlap terlihat sebelum "Add frames".

---

## 4. Masalah C — template baru tanpa animasi

- 7 template `essentials-*` (cover, content, image, question, answer, explanation, list) ber-`motion: "none"`
  (cek: `asset-packs/siswa-juara/pack/presets/essentials/*.json`), sedangkan template klasik ber-`motion: "auto"`.
- `withTemplateAnimation()` (`src/editor/template-animation.ts:76-77`) **langsung return** bila
  `preset.motion === "none"` — tidak ada animasi enter/float/motion teks apa pun.
- `fillGenerationTemplates` (`generation.ts:72-76`) dan jalur voice (`generate-dialog.tsx:159`) hanya
  memperpanjang `animation.end` **bila animasi sudah ada** — objek tanpa animasi tetap statis.
- Catatan: koreografi `template-animation.ts:9-67` di-key per nama template; nama essentials tidak ada di map
  sehingga memakai fallback default (`slide-down` + `zoom`, `bodyDelay 0.7`) — ituproblemsudah ditangani, hanya
  saja tidak pernah tercapai karena `motion:none`.

### Rencana perbaikan C

1. Ubah `motion` ketujuh file `essentials/*.json` dari `"none"` → `"auto"` (plus entri katalog bila menyimpan
   salinan metadata motion — cek `catalog.json`; bila tidak ada field motion di katalog, cukup file template).
   **Atau**, bila `none` disengaja untuk pemakaian manual: di `prepareGenerationTemplates`/`fillGenerationTemplates`,
   terapkan `withTemplateAnimation` sebagai fallback saat preset untuk generate tidak punya animasi.
2. Tambahkan entri koreografi per nama essentials di `template-animation.ts:9-67` bila gerakannya ingin
   dibedakan dari default.
3. Tambah test: setiap template berkind `template` yang dipakai `GENERATION_PRESETS` harus memiliki ≥1 objek
   ber-animasi setelah `parsePresets` (pola test ada di `tests/presets.spec.ts`).

---

## 5. Masalah D — konten AI dan narasi "gantung"

### Kelemahan prompt saat ini (`sidecar/generate.mjs:31-48`)

1. **Tanpa panduan per-useCase.** `cover` vs `content` vs `image` vs `question` vs `answer` vs `explanation`
   vs `list` tidak dijelaskan perannya; hanya ada daftar `useCases` valid (`generate.mjs:2`). AI tidak tahu
   bahwa cover butuh hook, question butuh 1 pertanyaan pancingan, list butuh N butir sejajar, dsb.
2. **Narasi tanpa batas bawah.** Hanya "about 2 words per second" (`generate.mjs:43`); untuk scene 6 detik
   ≈ 10–14 kata, tapi tidak ada minimum/maksimum kata per `scene.seconds`, tidak ada keharusan ending
   (pertanyaan/CTA transisi). Kalimat tunggal pendek → terdengar "gantung".
3. **Tanpa alur antar-scene.** Tidak diminta alur (hook → konteks → contoh → latihan → rekap) yang konsisten
   dengan preset terpilih (`parent-tips`, dll. di `generation.ts:7-12`); tiap scene ditulis lepas → terasa
   tidak nyambung. Duplikasi §B.3 memperparah.
4. **Tidak ada larangan yang relevan dengan temuan visual:** jangan mengulang headline yang sama di dua scene;
   lengkapi alasan/contoh sebelum CTA; sesuaikan jumlah butir list dengan slot bernomor yang tersedia.
5. **Validasi hanya format** (`parseGenerationResult`, `generate.mjs:50-73`): panjang, ID slot, kecocokan
   useCase — tidak ada cek koherensi (pengulangan, pertanyaan tanpa jawaban pada preset Q&A, narasi yang
   mengakhiri tengah kalimat).

### Rencana perbaikan D

1. Perkuat `buildScriptPrompt`:
   - Sisipkan deskripsi peran per useCase + jumlah kata target per scene dari `scene.seconds`
     (mis. `clamp(seconds*2 ± 20%)`) untuk `narration`, dan batas kalimat untuk teks visual.
   - Wajibkan busur mini sesuai preset (hook → isi → ajakan) + larangan mengulang headline antar-scene +
     aturan list bernomor (jumlah butir = jumlah slot bernomor).
   - Instruksikan ending narasi: tiap scene berakhir dengan jembatan ke scene berikut / CTA, kecuali scene
     terakhir yang merangkum + CTA baca bersama.
2. Setelah #B.1 (slot chrome dikunci), prompt otomatis lebih fokus; ulang uji keterbacaan Bahasa Indonesia
   (nada warm/cheerful/calm/curious di `generation.ts:13` + audio tags di `generate.mjs:3-7`).
3. Tambah validasi ringan pasca-generate (tanpa model call): tolak/ingatkan bila dua scene punya headline
   identik, bila preset `question-explain` tidak punya jawaban, atau narasi < 60% target kata → tampilkan
   tombol "Regenerate scene" per-scene (perlu endpoint ulang per scene; bila belum ada, mulai dari tombol
   "Generate content" ulang dengan template terkunci).
4. Kriteria terima: 5 scene parent-tips dari contoh "Reading comprehension" menghasilkan: tidak ada headline
   duplikat, tiap narasi 8–16 kata untuk 6 detik dan diakhiri kalimat lengkap, slot badge/nomor tidak berubah.

---

## 6. Usulan urutan kerja untuk AI pelaksana

1. **A (UI overflow)** — murni CSS/komponen; verifikasi via Playwright mock (tanpa biaya). File:
   `src/styles/generate.css`, `src/components/ui/scroll-area.tsx`, `src/editor/generate-dialog.tsx`.
2. **C (animasi essentials)** — perubahan data + 1 fallback; risiko rendah. File:
   `asset-packs/siswa-juara/pack/presets/essentials/*.json`, `src/editor/template-animation.ts`,
   `src/editor/generation.ts`. Perhatikan AGENTS.md: asset pack adalah pack eksternal — ubah sumber +
   regenerate pack (`npm run assets:pack` membutuhkan FFmpeg; bila tidak tersedia, ubah file pack
   ter-generate + sumbernya agar konsisten).
3. **B (slot & template mapping)** — perubahan model/data terbesar; butuh migrasi preset + test.
   File: `src/editor/model.ts`, `src/editor/generation.ts`, `sidecar/generate.mjs`,
   `src/editor/generate-dialog.tsx`, skrip di `scripts/`.
4. **D (prompt)** — iterasi murah (tanpa publish/posting), tapi nilai rasa bahasa ("gantung") butuh review
   manusia Indonesia. File: `sidecar/generate.mjs`, `tests/generate.check.mjs`.

Batasan verifikasi (sesuai AGENTS.md): jangan lakukan paid model call, publish, atau mutasi provider live
untuk mengetes perubahan biasa. Gunakan mock di `tests/generate.spec.ts` dan pemeriksaan statis
(`tests/generate.check.mjs`, `tests/preset-layers.check.mjs`).

---

## 7. Implementasi perbaikan (2026-10-27)

- **A:** grid memakai `minmax(0, …)`, viewport vertikal membatasi lebar konten Radix, filmstrip tetap memakai `ScrollArea` horizontal dengan scrollbar terlihat. Diuji pada lebar 1440, 900, 650, dan 390 px dengan 5 serta 8 kartu. Lima kartu pada 650 px memang muat; delapan kartu tetap bisa digeser.
- **C:** sumber persiapan dan tujuh JSON essentials lokal memakai `motion: "auto"`. Jalur Generate memberi animasi pada template lama yang sama sekali belum memiliki animasi; pengaturan template untuk penggunaan manual tetap berlaku. Indeks byte manifest pack lokal sudah diperbarui.
- **B:** metadata `generationRole` dan `generationGroup` dipersistenkan saat persiapan pack. Pack lama tetap didukung melalui inferensi saat Generate. Badge, label pilihan, angka list, CTA generik, dan nomor halaman tidak dikirim sebagai slot AI. Nomor halaman diisi dari posisi scene. Headline bertumpuk menjadi satu slot lalu dibagi pada batas kata dan di-fit ke masing-masing box; tinggi teks dibatasi bila box lama beririsan dengan teks berikutnya. Pemilihan otomatis menghindari template yang sudah digunakan selama ada alternatif dengan useCase yang sama, serta menghormati pilihan manual. Review merender isi hasil fitting dan memperbarui preview setelah edit. Slot gambar kosong ditandai untuk diisi manual di canvas.
- **D:** prompt menyertakan tujuan setiap useCase, alur dan penutup keseluruhan, jumlah item list bila diketahui, serta rentang kata narasi menurut durasi. Validasi lokal mendeteksi headline berulang antar-scene, narasi terlalu pendek, dan akhir narasi tanpa tanda baca kalimat. Pengguna bisa memperbaiki isi di review atau memakai **Edit setup → Generate content** untuk mencoba lagi; belum ditambahkan endpoint regenerate per-scene.

Pemeriksaan screenshot hasil implementasi menemukan penyebab tambahan B: filter ekstraksi referensi memakai batas atas `y > H * 0.075`, sehingga judul tinggi yang mulai pada y≈98 ikut terbuang sebagai header dan hurufnya tertinggal di surface. Persiapan dan fitting preview kini memakai pusat vertikal baris untuk batas header, dengan pengecualian branding tetap berlaku. Preset referensi diuji agar `MULAI DARI SATU BACAAN.` menjadi bagian slot headline. Karena `contoh-frame-standar.json` tidak tersedia di checkout ini, rebuild lokal menggunakan snapshot portabel standar dari pack yang sudah ada melalui `GENIE_STANDARD_FRAME`; sumber asli perlu tersedia kembali atau diganti export standar untuk rebuild selanjutnya.

Verifikasi menggunakan provider mock dan aset lokal: build TypeScript/Vite, `tests/generate.check.mjs`, `tests/preset-layers.check.mjs`, serta 12 skenario Playwright (11 Generate dan validasi seluruh 18 preset). Tidak ada model call berbayar, publish, atau mutasi provider live. Kualitas semantik narasi tetap perlu review manusia; validasi tanda baca dan jumlah kata tidak membuktikan koherensi isi.
