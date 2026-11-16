# Server OMR untuk Not Angka Studio

Mengubah PDF not balok menjadi MusicXML memakai Audiveris (gratis, open source). Aplikasi web mengirim PDF ke `POST /convert`.

## Jalankan di komputer sendiri (paling mudah)
1. Pasang Audiveris dari github.com/Audiveris/audiveris/releases dan Node.js 18+.
2. Windows (PowerShell): `$env:AUDIVERIS_BIN="C:\Program Files\Audiveris\Audiveris.exe"; node server.js`
   Mac/Linux: `AUDIVERIS_BIN=/path/ke/Audiveris node server.js`
3. Di aplikasi, tekan **Server PDF** dan isi `http://localhost:8080` (Chrome mengizinkan localhost dari halaman https).

## Untuk dipakai orang lain
Jalankan di server yang punya alamat https, misalnya dengan Dockerfile di folder ini, lalu isi alamat itu di tombol **Server PDF**. Set `OMR_TOKEN` agar tidak dipakai sembarang orang.

Catatan: argumen Audiveris bisa diubah lewat `AUDIVERIS_ARGS` (default `-batch -export`). Hasil OMR perlu diperiksa manual.
