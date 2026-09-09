<div align="center">

# 📷 Private Media Gallery

**Galeri Foto & Video Pribadi Mandiri (*Self-Hosted*) dengan Enkripsi AES-256, Penyimpanan Cloud Google Drive, & Autentikasi 2FA**

[![Laravel](https://img.shields.io/badge/Laravel-11.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)](https://laravel.com)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://php.net)
[![Security](https://img.shields.io/badge/Encryption-AES--256--CBC-10b981?style=for-the-badge&logo=lock&logoColor=white)](#keamanan--privasi)
[![Theme](https://img.shields.io/badge/Theme-Dark%20%7C%20Light-3b82f6?style=for-the-badge)](#antarmuka-modern)
[![Tests](https://img.shields.io/badge/Tests-19%20Passed-success?style=for-the-badge)](tests)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Tentang Aplikasi

**Private Media Gallery** adalah aplikasi galeri foto dan video pribadi yang dirancang untuk pengguna yang menginginkan kendali penuh atas privasi data visual mereka. Media dienkripsi secara otomatis menggunakan algoritma **AES-256-CBC** sebelum disimpan ke Google Drive pribadi Anda, sehingga pihak penyedia hosting maupun pihak ketiga tidak dapat melihat isi foto, video, maupun kredensial rahasia Anda.

Antarmuka dirancang bersih, intuitif, dan responsif dengan inspirasi dari antarmuka modern **Apple Photos** dan **Google Photos**, lengkap dengan dukungan **Mode Gelap (Dark Mode)** dan **Mode Terang (Light Mode)**.

---

## ✨ Fitur Unggulan

### 🔒 1. Keamanan & Enkripsi Berlapis
- **Enkripsi Berkas Media (AES-256-CBC)**: Setiap foto dan video dienkripsi di server sebelum diunggah ke Google Drive.
- **Enkripsi Kredensial Database**: Seluruh data sensitif (Client Secret OAuth, Refresh Token, TOTP Secret 2FA, dan Recovery Codes) dienkripsi secara otomatis saat disimpan di database untuk mencegah kebocoran data dari pihak pengelola hosting.
- **Proteksi Brute-Force**: Pembatasan percobaan login (*Rate Limiting*) otomatis mengunci akun selama 15 menit setelah 5 kali kesalahan input password berturut-turut.

### ☁️ 2. Penyimpanan Cloud Google Drive
- **Integrasi OAuth 2.0**: Menghubungkan penyimpanan langsung ke akun Google Drive pribadi Anda tanpa bergantung pada kuota shared hosting.
- **Streaming Video Halus**: Didukung oleh HTTP Range Requests (`206 Partial Content`) sehingga video dapat diputar langsung dan dipercepat (*seek*) tanpa harus menunggu unduhan penuh.
- **Unduh Berkas Asli**: Tombol unduh instan pada kartu thumbnail maupun di layar Lightbox, yang mendekripsi berkas secara otomatis saat diunduh.

### 🛡️ 3. Autentikasi 2-Langkah (2FA)
- **Google Authenticator (TOTP)**: Dukungan autentikasi dua faktor standar industri RFC 6238 menggunakan QR Code.
- **Kode Pemulihan Darurat (*Recovery Codes*)**: Disediakan 8 kode darurat sekali pakai yang dapat disalin atau diunduh sebagai berkas `.txt` jika ponsel hilang.

### 🎨 4. Antarmuka Pengguna Modern (Apple & Google Photos Style)
- **Photo Wall Grid**: Tata letak grid rapat berasio 1:1 (*square mosaic*) yang seragam dan bersih tanpa elemen promosi/marketing yang mengganggu.
- **Beralih Tema Instan (Dark / Light Mode)**: Dilengkapi tombol pengalih tema di bilah navigasi atas dengan deteksi otomatis preferensi sistem operasi dan penyimpanan ke `localStorage` (bebas kedipan layar).
- **Lightbox Viewer Imersif**: Modal penampil foto/video layar penuh dengan kontrol pintasan keyboard:
  - `D` : Unduh berkas media asli
  - `F` : Layar Penuh (*Fullscreen*)
  - `←` / `→` : Navigasi ke foto/video sebelumnya / berikutnya
  - `Esc` : Tutup Lightbox
- **Ekstraksi Thumbnail Video via FFmpeg**: Ekstraksi frame video asli otomatis sehingga thumbnail video tampil jernih, bukan sekadar ikon generik.

---

## 📋 Persyaratan Sistem

- **PHP**: Versi `8.2` atau lebih tinggi
- **Ekstensi PHP**:
  - `OpenSSL` (untuk enkripsi AES-256)
  - `PDO_SQLite` (atau PDO MySQL / PostgreSQL)
  - `GD` (untuk pengolahan thumbnail gambar)
  - `FileInfo` (untuk verifikasi MIME type berkas)
  - `cURL` (untuk komunikasi dengan Google API)
  - `Mbstring`
- **Composer**: Versi `2.x`
- **FFmpeg**: Disarankan terpasang di sistem agar ekstraksi thumbnail video otomatis aktif.

---

## 🚀 Panduan Instalasi Cepat

### 1. Clone Repository
```bash
git clone https://github.com/bsmr71/private_gallery.git
cd private_gallery
```

### 2. Pasang Dependensi
```bash
composer install
npm install && npm run build # opsional jika ingin memproses ulang aset
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin contoh konfigurasi lingkungan dan buat kunci aplikasi:
```bash
cp .env.example .env
php artisan key:generate
```

Pastikan konfigurasi database di file `.env` sudah sesuai (secara default menggunakan SQLite):
```env
DB_CONNECTION=sqlite
```
*(Jika file database SQLite belum ada, sistem akan otomatis membuatnya saat migrasi).*

### 4. Jalankan Migrasi & Database Seeder
```bash
php artisan migrate --seed
```

Perintah di atas akan membuat akun administrator bawaan:
- **Email:** `admin@gallery.local`
- **Password:** `admin123`

> ⚠️ **PENTING:** Segera ganti password dan aktifkan autentikasi 2-langkah (2FA) di menu pengaturan setelah login pertama kali!

### 5. Jalankan Server Lokal
```bash
php artisan serve
```
Akses aplikasi melalui peramban di: **`http://localhost:8000`**

---

## ⚙️ Menghubungkan Google Drive

1. Masuk ke [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru dan aktifkan **Google Drive API**.
3. Di menu **OAuth consent screen**:
   - Pilih jenis pengguna **External**.
   - Masukkan nama aplikasi dan email Anda.
   - Tambahkan scope: `.../auth/drive.file`.
   - Di bagian *Test Users*, tambahkan email Google Anda.
4. Di menu **Credentials**:
   - Buat **OAuth client ID** bertipe **Web application**.
   - Pada bagian **Authorized redirect URIs**, masukkan:
     ```
     http://localhost:8000/admin/google/callback
     ```
     *(Atau sesuaikan dengan domain yang ditampilkan di halaman Admin Settings).*
5. Salin **Client ID** dan **Client Secret** yang Anda dapatkan, lalu masukkan ke menu **Settings** (`/admin/settings`) di aplikasi Anda, lalu klik **Simpan & Hubungkan Akun Google**.

---

## 🧪 Menjalankan Pengujian Otomatis (*Tests*)

Seluruh fitur inti, sistem keamanan enkripsi, proses unduh, dan autentikasi telah dilengkapi dengan pengujian otomatis:

```bash
php artisan test
```

Hasil pengujian mencakup:
```text
PASS  Tests\Unit\ExampleTest
PASS  Tests\Feature\ExampleTest
PASS  Tests\Feature\MediaDownloadTest
PASS  Tests\Feature\SecurityAndTwoFactorTest

Tests:    19 passed (63 assertions)
```

---

## 📁 Struktur Direktori Penting

```text
private_gallery/
├── app/
│   ├── Http/Controllers/
│   │   ├── GalleryController.php       # Controller galeri utama & filter
│   │   ├── MediaController.php         # Streaming, download, upload, & thumbnail FFmpeg
│   │   ├── GoogleAuthController.php    # OAuth 2.0 & manajemen setting Google Drive
│   │   └── AuthController.php          # Login, rate limiting, & verifikasi 2FA
│   ├── Services/
│   │   ├── FileEncryptionService.php   # Layanan enkripsi/dekripsi AES-256-CBC
│   │   ├── GoogleDriveService.php      # Komunikasi Google Drive API v3
│   │   ├── MediaCacheService.php       # Manajemen cache dekripsi berkas lokal
│   │   └── TotpService.php             # Pembuat kode QR & verifikator TOTP 2FA
├── resources/views/
│   ├── gallery/                        # Tampilan foto/video grid & segmented tabs
│   ├── admin/                          # Dashboard metrik, upload, & pengaturan sistem
│   └── layouts/app.blade.php           # Template dasar, navbar, lightbox, & theme switcher
├── public/
│   ├── css/app.css                     # Sistem desain Mode Gelap & Terang
│   └── js/app.js                       # Logika lightbox, tema, lazy load, & upload AJAX
└── tests/                              # 19 Unit & Feature tests
```

---

## 📄 Lisensi

Aplikasi ini dilisensikan di bawah lisensi terbuka [MIT License](LICENSE). Bebas digunakan dan dimodifikasi untuk kebutuhan pribadi maupun komersial.
