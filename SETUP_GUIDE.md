# 🔧 Panduan Setup Google Drive API

Ikuti langkah-langkah berikut untuk menghubungkan aplikasi Media Gallery dengan Google Drive.

## Step 1: Buat Google Cloud Project

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Login dengan akun Google kamu (yang punya Google One Pro)
3. Klik **"Select a project"** di bagian atas → **"New Project"**
4. Isi:
   - **Project name**: `Media Gallery`
   - **Location**: biarkan default
5. Klik **"Create"**

## Step 2: Enable Google Drive API

1. Di Google Cloud Console, pastikan project **"Media Gallery"** sudah terpilih
2. Buka menu **"APIs & Services"** → **"Library"**
3. Search **"Google Drive API"**
4. Klik pada **Google Drive API** → klik **"Enable"**

## Step 3: Buat Service Account

1. Buka **"APIs & Services"** → **"Credentials"**
2. Klik **"+ CREATE CREDENTIALS"** → **"Service Account"**
3. Isi:
   - **Service account name**: `media-gallery-app`
   - **Service account ID**: biarkan auto-generated
4. Klik **"Create and Continue"**
5. Pada **"Grant this service account access"**, pilih role:
   - **"Basic"** → **"Editor"**
6. Klik **"Continue"** → **"Done"**

## Step 4: Download Credentials (JSON Key)

1. Di halaman **"Credentials"**, klik pada service account yang baru dibuat
2. Tab **"Keys"** → **"Add Key"** → **"Create new key"**
3. Pilih **JSON** → klik **"Create"**
4. File JSON akan ter-download otomatis
5. **Pindahkan file JSON** ke folder project Laravel:
   ```
   c:\web\gallery\storage\app\google-credentials.json
   ```

## Step 5: Share Drive Folder ke Service Account

Karena kamu menggunakan **Google One Pro** (2TB), kita akan menyimpan file di Drive akun personal kamu.

1. Buka [Google Drive](https://drive.google.com/)
2. Buat folder baru: **"MediaGalleryEncrypted"**
3. Klik kanan folder → **"Share"**
4. Masukkan email Service Account (format: `media-gallery-app@project-id.iam.gserviceaccount.com`)
   - Email ini bisa dilihat di halaman Credentials Google Cloud Console
5. Set permission ke **"Editor"**
6. Klik **"Send"**
7. Buka folder tersebut, **copy Folder ID** dari URL:
   ```
   https://drive.google.com/drive/folders/XXXXXXXXXXXXXX
                                          ^^^^^^^^^^^^^^
                                          Ini adalah Folder ID
   ```

## Step 6: Update .env

Buka file `.env` di project Laravel dan isi:

```env
GOOGLE_DRIVE_CREDENTIALS_PATH=C:\web\gallery\storage\app\google-credentials.json
GOOGLE_DRIVE_FOLDER_ID=XXXXXXXXXXXXXXXXXXXXX
GOOGLE_DRIVE_FOLDER_NAME=MediaGalleryEncrypted
```

Ganti `XXXXXXXXXXXXXXXXXXXXX` dengan Folder ID dari Step 5.

## Step 7: Verifikasi

Restart server dan coba upload file:

```bash
php artisan serve --port=8000
```

Lalu buka `http://localhost:8000/login` dan login dengan:
- **Email**: `admin@gallery.com`
- **Password**: `admin123`

---

## ⚠️ Catatan Penting

- **JANGAN** commit file `google-credentials.json` ke Git
- File credentials sudah ada di `.gitignore`
- Untuk production, gunakan environment variable yang aman
- Quota Google Drive: 10 juta requests per hari (lebih dari cukup)
