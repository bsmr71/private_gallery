<?php

namespace App\Http\Controllers;

use App\Services\GoogleDriveService;
use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class GoogleAuthController extends Controller
{
    /**
     * Show Google Drive settings page.
     */
    public function settings()
    {
        $credentialsPath = config('services.google_drive.credentials_path', storage_path('app/google-credentials.json'));
        $credentialsExists = File::exists($credentialsPath);
        $credentialsInfo = null;

        if ($credentialsExists) {
            try {
                $json = json_decode(File::get($credentialsPath), true);
                $credentialsInfo = [
                    'type' => $json['type'] ?? 'unknown',
                    'project_id' => $json['project_id'] ?? null,
                    'client_email' => $json['client_email'] ?? null,
                    'file_size' => round(File::size($credentialsPath) / 1024, 1) . ' KB',
                    'updated_at' => date('d M Y H:i', File::lastModified($credentialsPath)),
                ];
            } catch (\Throwable $e) {
                $credentialsInfo = ['error' => 'File JSON tidak valid: ' . $e->getMessage()];
            }
        }

        $folderId = \App\Models\Setting::get('google_folder_id') ?: config('services.google_drive.folder_id', '');
        $folderName = \App\Models\Setting::get('google_folder_name') ?: config('services.google_drive.folder_name', 'MediaGalleryEncrypted');

        $clientId = \App\Models\Setting::get('google_client_id') ?: config('services.google_drive.client_id', '');
        $clientSecret = \App\Models\Setting::get('google_client_secret') ?: config('services.google_drive.client_secret', '');
        $refreshToken = \App\Models\Setting::get('google_refresh_token') ?: config('services.google_drive.refresh_token', '');
        $isOauthConnected = !empty($refreshToken) && !empty($clientId);
        $redirectUri = $this->getRedirectUri();

        $user = \Illuminate\Support\Facades\Auth::user();
        $mobileTokens = $user ? $user->tokens()->orderByDesc('created_at')->get() : collect();
        $mobilePinResetRequested = (bool) \App\Models\Setting::get('mobile_pin_reset_requested', false);
        $mobilePinResetAt = \App\Models\Setting::get('mobile_pin_reset_at');

        return view('admin.settings', compact(
            'credentialsPath',
            'credentialsExists',
            'credentialsInfo',
            'folderId',
            'folderName',
            'clientId',
            'clientSecret',
            'refreshToken',
            'isOauthConnected',
            'redirectUri',
            'user',
            'mobileTokens',
            'mobilePinResetRequested',
            'mobilePinResetAt'
        ));
    }

    /**
     * Save settings (credentials upload and folder configurations).
     */
    public function saveSettings(Request $request)
    {
        $request->validate([
            'credential_file' => 'nullable|file|max:2048',
            'folder_id' => 'nullable|string|max:255',
            'folder_name' => 'nullable|string|max:255',
            'client_id' => 'nullable|string|max:255',
            'client_secret' => 'nullable|string|max:255',
        ]);

        $envUpdates = [];

        // 1. Handle Credentials File Upload (.json)
        if ($request->hasFile('credential_file')) {
            $file = $request->file('credential_file');
            $ext = strtolower($file->getClientOriginalExtension());

            if ($ext !== 'json') {
                return redirect()->route('admin.settings')
                    ->with('error', 'File kredensial harus berformat .json');
            }

            $content = file_get_contents($file->getRealPath());
            $json = json_decode($content, true);

            if (!$json || !is_array($json)) {
                return redirect()->route('admin.settings')
                    ->with('error', 'File JSON kredensial tidak valid atau rusak.');
            }

            $destDir = storage_path('app');
            if (!File::isDirectory($destDir)) {
                File::makeDirectory($destDir, 0755, true);
            }

            $destPath = $destDir . DIRECTORY_SEPARATOR . 'google-credentials.json';
            File::put($destPath, $content);

            $envUpdates['GOOGLE_DRIVE_CREDENTIALS_PATH'] = $destPath;
            \App\Models\Setting::set('google_credentials_path', $destPath);
        }

        // 2. Handle Folder Config
        if ($request->filled('folder_id')) {
            $val = trim($request->folder_id);
            $envUpdates['GOOGLE_DRIVE_FOLDER_ID'] = $val;
            \App\Models\Setting::set('google_folder_id', $val);
        } else if ($request->has('folder_id') && empty($request->folder_id)) {
            $envUpdates['GOOGLE_DRIVE_FOLDER_ID'] = '';
            \App\Models\Setting::set('google_folder_id', '');
        }

        if ($request->filled('folder_name')) {
            $val = trim($request->folder_name);
            $envUpdates['GOOGLE_DRIVE_FOLDER_NAME'] = $val;
            \App\Models\Setting::set('google_folder_name', $val);
        }

        // 3. Handle OAuth Config (encrypted in database for hosting privacy)
        if ($request->filled('client_id')) {
            $val = trim($request->client_id);
            $envUpdates['GOOGLE_DRIVE_CLIENT_ID'] = $val;
            \App\Models\Setting::set('google_client_id', $val);
        }
        if ($request->filled('client_secret')) {
            $val = trim($request->client_secret);
            $envUpdates['GOOGLE_DRIVE_CLIENT_SECRET'] = $val;
            \App\Models\Setting::set('google_client_secret', $val);
        }

        if (!empty($envUpdates)) {
            $this->updateEnv($envUpdates);
        }

        return redirect()->route('admin.settings')
            ->with('success', 'Pengaturan Google Drive berhasil disimpan & dienkripsi dengan aman!');
    }

    /**
     * Test Google Drive connection with current credentials.
     */
    public function testConnection(GoogleDriveService $driveService)
    {
        $clientId = \App\Models\Setting::get('google_client_id') ?: config('services.google_drive.client_id');
        $refreshToken = \App\Models\Setting::get('google_refresh_token') ?: config('services.google_drive.refresh_token');

        // Check if OAuth is configured but not yet authorized
        if (!empty($clientId) && empty($refreshToken)) {
            return redirect()->route('admin.settings')->with('error', 
                "⚠️ Kamu sudah mengisi Client ID & Secret, tetapi BELUM mengotorisasi akun Google.\n" .
                "Silakan klik tombol '🔗 Hubungkan Akun Google Drive' di bawah untuk login dan memberikan izin."
            );
        }

        try {
            $client = $driveService->getClient();
            $drive = new GoogleDrive($client);

            // 1. Test Drive connection by listing about/user info
            $about = $drive->about->get(['fields' => 'user, storageQuota']);
            $userEmail = $about->getUser() ? $about->getUser()->getEmailAddress() : 'Unknown';
            $displayName = $about->getUser() ? $about->getUser()->getDisplayName() : 'Google User';

            // 2. Test Folder access if configured
            $folderId = \App\Models\Setting::get('google_folder_id') ?: config('services.google_drive.folder_id');
            $folderStatus = 'Tidak ada Folder ID (akan otomatis dibuatkan folder baru)';

            if ($folderId) {
                try {
                    $folder = $drive->files->get($folderId, ['fields' => 'id, name, capabilities']);
                    $canAddChildren = $folder->getCapabilities() ? $folder->getCapabilities()->getCanAddChildren() : true;

                    if ($canAddChildren) {
                        $folderStatus = 'Folder "' . $folder->getName() . '" valid dan memiliki izin tulis (Editor).';
                    } else {
                        $folderStatus = 'Folder "' . $folder->getName() . '" ditemukan, tetapi TIDAK memiliki izin tulis. Pastikan role adalah Editor.';
                    }
                } catch (\Throwable $fe) {
                    return redirect()->route('admin.settings')
                        ->with('error', 'Koneksi ke Google berhasil, tapi Folder ID tidak ditemukan/tidak dapat diakses. Pastikan folder sudah dishare ke: ' . $userEmail);
                }
            }

            // 3. Test writing a tiny 5-byte file to verify write permission
            try {
                $testContent = 'ping';
                $testMeta = new DriveFile([
                    'name' => '__test_ping.txt',
                    'parents' => $folderId ? [$folderId] : [],
                ]);
                $created = $drive->files->create($testMeta, [
                    'data' => $testContent,
                    'mimeType' => 'text/plain',
                    'uploadType' => 'multipart',
                    'fields' => 'id',
                ]);

                // Delete test file immediately
                $drive->files->delete($created->getId());

                return redirect()->route('admin.settings')->with('success', 
                    "✅ Koneksi Google Drive Sukses 100%!\n" .
                    "Akun: {$displayName} ({$userEmail})\n" .
                    "Folder: {$folderStatus}\n" .
                    "Uji coba upload & hapus file berhasil dilakukan. Sistem siap dipakai!"
                );

            } catch (\Throwable $we) {
                $msg = $we->getMessage();

                if (str_contains($msg, 'storageQuotaExceeded') || str_contains($msg, 'Service Accounts do not have storage quota')) {
                    return redirect()->route('admin.settings')->with('error', 
                        "⚠️ Google menolak upload Service Account karena kuota 0 Byte.\n" .
                        "Klik tombol '🔗 Hubungkan Akun Google Drive' di bawah agar upload langsung tersimpan di akun Google Drive milikmu."
                    );
                }

                return redirect()->route('admin.settings')->with('error', 
                    "Koneksi terhubung ke Google ({$userEmail}), tetapi gagal menulis file: " . $msg
                );
            }

        } catch (\Throwable $e) {
            return redirect()->route('admin.settings')
                ->with('error', 'Gagal menghubungkan ke Google Drive: ' . $e->getMessage());
        }
    }

    /**
     * Start OAuth 2.0 flow for Google One account.
     */
    public function connect()
    {
        $clientId = \App\Models\Setting::get('google_client_id') ?: config('services.google_drive.client_id');
        $clientSecret = \App\Models\Setting::get('google_client_secret') ?: config('services.google_drive.client_secret');

        if (!$clientId || !$clientSecret) {
            return redirect()->route('admin.settings')
                ->with('error', 'Silakan isi Google Client ID dan Client Secret terlebih dahulu.');
        }

        $client = new GoogleClient();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($this->getRedirectUri());
        $client->addScope(GoogleDrive::DRIVE);
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        $returnUrl = url('/admin/settings');
        $client->setState($returnUrl);

        return redirect()->away($client->createAuthUrl());
    }

    /**
     * OAuth 2.0 Callback handler.
     */
    public function callback(Request $request)
    {
        if (!$request->has('code')) {
            return redirect()->route('admin.settings')
                ->with('error', 'Otorisasi dibatalkan atau tidak ada kode otorisasi.');
        }

        $clientId = \App\Models\Setting::get('google_client_id') ?: config('services.google_drive.client_id');
        $clientSecret = \App\Models\Setting::get('google_client_secret') ?: config('services.google_drive.client_secret');

        $client = new GoogleClient();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($this->getRedirectUri());

        try {
            $token = $client->fetchAccessTokenWithAuthCode($request->code);

            if (isset($token['error'])) {
                return redirect()->route('admin.settings')
                    ->with('error', 'Gagal otorisasi Google: ' . ($token['error_description'] ?? $token['error']));
            }

            $refreshToken = $token['refresh_token'] ?? null;

            if ($refreshToken) {
                \App\Models\Setting::set('google_refresh_token', $refreshToken);
                $this->updateEnv(['GOOGLE_DRIVE_REFRESH_TOKEN' => $refreshToken]);

                $returnUrl = $request->state ?: route('admin.settings');
                $sep = str_contains($returnUrl, '?') ? '&' : '?';
                return redirect()->away($returnUrl . $sep . 'connected=1')
                    ->with('success', '✅ Akun Google Drive Berhasil Terhubung! Media gallery siap digunakan.');
            }

            return redirect()->route('admin.settings')
                ->with('error', 'Google tidak memberikan refresh token. Coba klik Hubungkan kembali dan pastikan memilih Allow/Izinkan.');
        } catch (\Throwable $e) {
            return redirect()->route('admin.settings')
                ->with('error', 'Error menghubungkan Google: ' . $e->getMessage());
        }
    }

    /**
     * Update .env file safely.
     */
    private function updateEnv(array $data): void
    {
        $envPath = base_path('.env');
        if (!File::exists($envPath)) {
            return;
        }

        $content = File::get($envPath);

        foreach ($data as $key => $value) {
            $value = trim($value);
            if (str_contains($value, ' ') || str_contains($value, '#') || str_contains($value, '\\')) {
                $value = '"' . addcslashes($value, '"') . '"';
            }

            if (preg_match("/^{$key}=.*/m", $content)) {
                $content = preg_replace("/^{$key}=.*/m", "{$key}={$value}", $content);
            } else {
                $content .= "\n{$key}={$value}";
            }
        }

        File::put($envPath, $content);
    }

    /**
     * Get appropriate redirect URI for Google OAuth.
     */
    private function getRedirectUri(): string
    {
        $custom = config('services.google_drive.redirect_uri');
        if (!empty($custom)) {
            return $custom;
        }

        $host = request()->getHost();
        if (str_ends_with($host, '.test') || str_ends_with($host, '.local') || $host === 'gallery.test') {
            return 'http://localhost:8000/admin/google/callback';
        }

        return route('admin.google.callback');
    }
}
