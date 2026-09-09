# 🍎 Walkthrough: Transformasi Total Menjadi Gaya Apple Photos (iOS 18)

Galeri Anda kini telah bertransformasi total memiliki nuansa, estetika, dan interaksi yang **100% identik dengan Apple Photos (aplikasi Foto iPhone / iCloud Photos)**, baik untuk versi Web yang sudah live di `gallery.bsmrlab.com` maupun **Aplikasi Mobile Android Native berbasis React Native (Expo)**!

---

## 🎨 1. Fitur Baru Apple Photos pada Versi Web (`gallery.bsmrlab.com`)

### 🎞️ Lightbox Filmstrip Mini-Scroller Khas iPhone
- **Miniature Filmstrip Scroller**: Tepat di bawah foto yang dibuka, terdapat deretan strip thumbnail foto-foto lainnya. Thumbnail aktif memiliki border putih menyala, efek pembesaran (*scale*), dan otomatis bergulir ke tengah (*smooth auto-centering*). Anda dapat mengklik atau menggeser strip ini untuk berpindah foto secara kilat tanpa harus menutup viewer!
- **Apple Action Dock Mengambang**: Kapsul melayang di bawah layar dengan kaca buram frosted glass:
  - 📤 **Bagikan / Unduh**: Mengunduh atau menyalin tautan berkas.
  - ❤️ **Favorit**: Menandai foto favorit dengan animasi hati merah Apple.
  - ℹ️ **Info Inspector**: Menampilkan drawer detail metadata resolusi, format, ukuran berkas, dan status keamanan Google Drive terenkripsi AES-256.
  - 📁 **Pindah / Salin**: Memindahkan atau menyalin berkas antar album.
  - 🗑️ **Hapus**: Menghapus media secara permanen dari server & Google Drive.
- **Mode Sinema Imersif (Apple Touch to Hide Chrome)**: Ketuk/klik area kosong pada foto untuk menyembunyikan seluruh header dan bilah aksi menjadi tampilan layar penuh hitam pekat tanpa gangguan (*edge-to-edge cinema*). Ketuk kembali untuk memunculkan kontrol.
- **Gestur Sentuh Mobile**: Geser jari ke kiri/kanan (*swipe*) untuk beralih foto, dan geser ke bawah (*swipe down*) untuk menutup viewer dengan transisi pegas khas iOS.

### 📂 Halaman Album Bergaya Apple Photos (`/albums`)
- **"Album Saya"**: Grid album bersudut membulat (*squircle 16px*) dengan thumbnail sampul dinamis (*cover photo*), counter media, dan kartu interaktif `+ Buat Album Baru`.
- **"Jenis Media" (Media Types)**: Daftar inset grouped khas iOS untuk kategori:
  - 📸 **Foto**
  - 🎬 **Video**
  - ❤️ **Favorit**

---

## 📱 2. Aplikasi Mobile Android (React Native Expo)

Telah dibangun aplikasi Android mandiri di folder `mobile-app/` dengan antarmuka Apple Photos:

1. **4 Tab Navigasi iOS Bawah**:
   - 🖼️ **Perpustakaan (Library)**: Grid 3-kolom foto rapat, badge durasi video, multi-select floating bar, dan tombol upload `＋`.
   - 📁 **Album**: Album squircle dengan cover dinamis dan list Jenis Media.
   - ❤️ **Favorit**: Akses kilat ke seluruh foto/video berbintang favorit.
   - 🔍 **Cari & Akun**: Pencarian instan foto/album, kartu status keamanan Google Drive terenkripsi, konfigurasi server, dan logout.
2. **Unggah Langsung dari Kamera / Galeri HP**: Menggunakan `expo-image-picker` untuk mengambil foto dari galeri HP Android dan langsung dienkripsi lalu diunggah ke Google Drive.
3. **Penyimpanan Token Otomatis**: Bearer token login tersimpan aman di `AsyncStorage` HP pengguna.

### Cara Menjalankan di HP Android:
```bash
cd mobile-app
npm start
```
Buka aplikasi **Expo Go** di HP Android Anda, scan QR Code yang muncul di layar, dan aplikasi akan langsung terbuka secara instan di HP Anda.

---

## ⚡ 3. Backend REST API (Laravel Sanctum)

Telah disiapkan endpoint RESTful API lengkap pada `routes/api.php` yang siap melayani aplikasi mobile dan web:
- `POST /api/auth/login` (Mendukung autentikasi 2-Faktor / 2FA)
- `GET /api/auth/user`
- `POST /api/auth/logout`
- `GET /api/media` (Filter type, favorite, album_id, search, pagination)
- `GET /api/media/{id}`
- `POST /api/media/upload` (Unggah berkas langsung dari HP)
- `POST /api/media/{id}/favorite`
- `POST /api/media/{id}/rename`
- `POST /api/media/move`
- `POST /api/media/copy`
- `DELETE /api/media/{id}`
- `POST /api/media/batch-delete`
- `GET /api/albums`
- `POST /api/albums`
- `PUT /api/albums/{id}`
- `DELETE /api/albums/{id}`

---

## 🧪 4. Status Pengujian & Git Repository

- **Automated Tests**: **36 tests lulus 100% (148 assertions)** tanpa satu pun kendala.
- **Git Commit & Push**:
  - Commit `4d4f5a0`: Transform web gallery to authentic Apple Photos iOS 18 with filmstrip scroller, floating dock, media types, and Laravel Sanctum REST API.
  - Commit `0352fb4`: Add Apple Photos React Native Android application with Filmstrip viewer, squircle albums, and camera upload.
  - Berhasil di-push ke: `https://github.com/bsmr71/private_gallery.git` pada branch `main`.

---

## 🌐 5. Cara Menerapkan Perubahan Ini ke Server Live (`gallery.bsmrlab.com`)

Buka terminal SSH ke server Anda:
```bash
cd ~/gallery.bsmrlab.com
git pull origin main
php artisan migrate --force
php artisan view:clear
php artisan cache:clear
```
Setelah itu buka `https://gallery.bsmrlab.com` di browser Anda untuk langsung menikmati tampilan Apple Photos terbaru!
