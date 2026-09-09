# Walkthrough: Publikasi ke GitHub Repository

Seluruh kode sumber aplikasi **Private Media Gallery** telah berhasil di-push ke repository GitHub:
🔗 [https://github.com/bsmr71/private_gallery.git](https://github.com/bsmr71/private_gallery.git)

---

## 1. Langkah-Langkah yang Telah Dijalankan

1. **Proteksi Berkas Rahasia (`.gitignore`)**:
   - Memastikan file rahasia berikut **TIDAK** ter-commit ke GitHub:
     - `.env` & `.env.*` (kecuali `.env.example`).
     - File database SQLite (`database/*.sqlite*`).
     - Kredensial service account Google (`storage/app/google-credentials.json`).
     - Cache berkas media asli terdekripsi (`storage/app/media_cache/*`).
     - Direktori `vendor` dan `node_modules`.
2. **Inisialisasi Git & Branch**:
   - `git init -b main`
   - `git remote add origin https://github.com/bsmr71/private_gallery.git`
3. **Commit Awal**:
   - 94 files source code, views Blade, aset CSS & JS (Mode Gelap & Terang), layanan enkripsi AES-256, autentikasi 2FA, dan unit/feature tests.
   - Pesan commit: `Initial commit: Private Media Gallery with Google Drive 2TB, AES-256 encryption, 2FA, Dark & Light Mode`
4. **Push ke GitHub**:
   - `git push -u origin main` berhasil dieksekusi ke branch `main`.

---

## 2. Fitur-Fitur yang Sudah Tersemat di Repository

- **Penyimpanan Terenkripsi Google Drive (2TB)**: Integrasi OAuth 2.0 & AES-256-CBC.
- **Autentikasi 2-Langkah (2FA / Google Authenticator)**: Dengan QR code & kode pemulihan.
- **Desain Galeri Modern (Apple & Google Photos Inspired)**:
  - Antarmuka foto/video rapat, bersih, tanpa elemen marketing berlebih.
  - Dukungan **Mode Terang (Light Mode)** dan **Mode Gelap (Dark Mode)** dengan tombol pengalih di navbar.
  - Tombol **Unduh** langsung pada kartu dan Lightbox.
  - Ekstraksi thumbnail video otomatis via FFmpeg.
- **Proteksi Brute Force Login**: Rate limiting 5 percobaan per 15 menit.
- **19 Automated Feature & Unit Tests**: Pengujian otomatis lulus 100%.
