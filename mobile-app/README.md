# 🍎 Private Gallery — Android Mobile App (Apple Photos Experience)

Aplikasi Galeri Android bernuansa **Apple Photos (iOS 18 / iCloud Photos)** yang terhubung langsung ke backend server Private Media Gallery Anda (`https://gallery.bsmrlab.com`).

---

## ✨ Fitur Unggulan Apple Photos di Android

1. **🖼️ Grid Perpustakaan Tanpa Batas (Pure Black Canvas)**:
   - Tampilan foto 3-kolom dengan background hitam pekat `#000000`.
   - Indikator durasi video.
   - Mode multi-select dengan floating action bar.
2. **🎞️ Fullscreen Viewer dengan Filmstrip Scroller Khas iPhone**:
   - Strip thumbnail horizontal di bawah foto yang dapat digeser untuk berpindah foto secara instan.
   - Navigasi geser (swipe left/right) dan swipe down untuk keluar.
   - Mode sinema imersif (ketuk foto untuk menyembunyikan/menampilkan bar).
3. **🍎 Floating Action Dock**:
   - 📤 **Bagikan / Unduh** foto ke aplikasi lain.
   - ❤️ **Favorit instan** dengan animasi hati merah Apple.
   - ℹ️ **Metadata Inspector Sheet**: format foto, ukuran berkas, status enkripsi AES-256 Google Drive, tanggal unggah.
   - 🗑️ **Hapus permanen** dari Google Drive.
4. **📁 Tab Koleksi Album**:
   - Desain kartu persegi squircle berformat 1:1 dengan cover dinamis.
   - Bagian "Jenis Media": Foto, Video, dan Favorit.
   - Tombol "+ Buat Album Baru".
5. **📸 Unggah Langsung dari Kamera / Galeri HP**:
   - Ambil foto atau pilih beberapa foto dari galeri HP Android untuk langsung dienkripsi dan diunggah ke Google Drive.
6. **🔒 Keamanan & Autentikasi**:
   - Login dengan Bearer Token via Laravel Sanctum.
   - Mendukung Autentikasi 2-Faktor (2FA) TOTP Authenticator.

---

## 🚀 Cara Menjalankan di HP Android

### Cara 1: Menjalankan Langsung di HP Android (Paling Cepat via Expo Go)

1. Pasang aplikasi **Expo Go** dari Google Play Store di HP Android Anda.
2. Di komputer/laptop Anda, buka terminal dan masuk ke folder `mobile-app`:
   ```bash
   cd mobile-app
   npm start
   ```
3. Akan muncul **QR Code** di layar terminal Anda.
4. Buka aplikasi **Expo Go** di HP Anda, pilih **Scan QR Code**, lalu arahkan ke layar komputer.
5. Aplikasi akan langsung terbuka di HP Android Anda secara instan dengan pengalaman native!

### Cara 2: Membuat File Installer `.apk` Standalone untuk Android

Jika Anda ingin file mentahan installer `.apk` yang bisa dipasang langsung di HP mana saja tanpa Expo Go:

1. Pasang EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Login ke akun Expo (gratis):
   ```bash
   eas login
   ```
3. Buat file `.apk`:
   ```bash
   eas build -p android --profile preview
   ```
4. Setelah selesai, unduh file `.apk` dari link yang diberikan dan kirim ke HP Android Anda untuk diinstal.

---

## ⚙️ Pengaturan Server Backend

Secara bawaan, aplikasi terhubung ke:
- `https://gallery.bsmrlab.com/api`

Jika Anda ingin mengarahkan ke IP lokal saat pengujian emulator, Anda dapat mengubahnya di tab **Cari & Akun** &rarr; **Koneksi Server** &rarr; Ubah ke alamat IP server Anda.
