// Tips singkat Outcome-Based Education yang tampil bergantian selama AI bekerja.
// Tips per tahap tampil lebih dulu saat tahap itu berjalan; sisanya bergiliran.
// Isinya praktik baik OBE yang umum, sengaja tanpa angka atau nomor peraturan tertentu.

export const TIPS_TAHAP = {
  konteks:
    'AI tidak menebak aturan kurikulum: ia membaca potongan buku pedoman prodi terlebih dahulu, lalu menulis berdasarkan potongan itu (Retrieval-Augmented Generation).',
  web: 'Referensi RPS dari kampus lain hanya dipakai sebagai pembanding materi, bukan disalin ke draf.',
  validasi:
    'Draf diperiksa otomatis sebelum disimpan. Bila melanggar aturan OBE, AI diminta memperbaikinya sendiri sebelum hasilnya ditampilkan.',
}

export const TIPS = {
  rps: [
    'Setiap pertemuan sebaiknya mengarah ke satu CPMK yang jelas, supaya ketercapaiannya bisa diukur di akhir semester.',
    'CPMK yang baik memakai kata kerja operasional yang terukur, misalnya "menganalisis" atau "merancang", bukan "memahami".',
    'Bentuk asesmen mengikuti CPMK: kemampuan merancang lebih tepat diukur lewat proyek daripada soal pilihan ganda.',
    'Bobot penilaian yang tersebar di beberapa asesmen memberi gambaran capaian yang lebih adil daripada bertumpu pada UTS dan UAS saja.',
    'Rubrik yang dibagikan sejak pertemuan pertama membantu mahasiswa memahami standar capaian yang diharapkan.',
    'Metode berpusat pada mahasiswa seperti studi kasus dan proyek mendorong capaian pada level kognitif yang lebih tinggi.',
    'Draf RPS dari AI adalah titik awal. Sesuaikan urutan materi dan contoh kasus dengan kondisi kelas Anda sebelum dipakai.',
  ],
  narasi: [
    'Analisis yang kuat membandingkan capaian dengan target, lalu menjelaskan penyebab selisihnya.',
    'Rekomendasi sebaiknya spesifik: apa yang diubah, pada CPMK mana, dan kapan dievaluasi kembali.',
    'Capaian rendah pada satu CPMK sering berkaitan dengan bentuk asesmen atau urutan materi, bukan hanya kemampuan mahasiswa.',
    'Hasil evaluasi semester ini menjadi masukan perbaikan RPS semester berikutnya. Itulah siklus perbaikan berkelanjutan dalam OBE.',
    'Sertakan angka pendukung seperti rata-rata dan persentase mahasiswa yang tercapai agar narasi mudah diverifikasi saat audit mutu.',
    'Narasi dari AI tetap perlu dibaca ulang. Tambahkan konteks kelas yang hanya Anda ketahui, misalnya kendala jadwal atau fasilitas.',
  ],
}
