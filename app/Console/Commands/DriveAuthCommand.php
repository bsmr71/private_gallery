<?php

namespace App\Console\Commands;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class DriveAuthCommand extends Command
{
    protected $signature = 'drive:auth';
    protected $description = 'Authenticate Google Drive via OAuth 2.0 (for Google One accounts)';

    public function handle()
    {
        $clientId = config('services.google_drive.client_id');
        $clientSecret = config('services.google_drive.client_secret');

        if (!$clientId) {
            $clientId = $this->ask('Masukkan Google Client ID');
        }

        if (!$clientSecret) {
            $clientSecret = $this->secret('Masukkan Google Client Secret');
        }

        if (!$clientId || !$clientSecret) {
            $this->error('Client ID dan Client Secret dibutuhkan.');
            return 1;
        }

        $client = new GoogleClient();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri('urn:ietf:wg:oauth:2.0:oob');
        $client->addScope(GoogleDrive::DRIVE);
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        $authUrl = $client->createAuthUrl();

        $this->info('====================================================');
        $this->info('Buka URL berikut di browser kamu untuk mengizinkan:');
        $this->line($authUrl);
        $this->info('====================================================');

        $authCode = $this->ask('Masukkan kode otorisasi yang diberikan Google');

        if (!$authCode) {
            $this->error('Kode otorisasi tidak boleh kosong.');
            return 1;
        }

        try {
            $accessToken = $client->fetchAccessTokenWithAuthCode(trim($authCode));

            if (isset($accessToken['error'])) {
                $this->error('Gagal: ' . ($accessToken['error_description'] ?? $accessToken['error']));
                return 1;
            }

            $refreshToken = $accessToken['refresh_token'] ?? null;

            if (!$refreshToken) {
                $this->error('Tidak ada refresh token. Coba jalankan kembali dan pastikan memilih consent.');
                return 1;
            }

            $this->updateEnvFile([
                'GOOGLE_DRIVE_CLIENT_ID' => $clientId,
                'GOOGLE_DRIVE_CLIENT_SECRET' => $clientSecret,
                'GOOGLE_DRIVE_REFRESH_TOKEN' => $refreshToken,
            ]);

            $this->info('✓ Google Drive berhasil terhubung!');
            $this->info('✓ Refresh token telah disimpan ke .env');
            return 0;
        } catch (\Throwable $e) {
            $this->error('Error: ' . $e->getMessage());
            return 1;
        }
    }

    private function updateEnvFile(array $data): void
    {
        $envPath = base_path('.env');
        if (!File::exists($envPath)) {
            return;
        }

        $content = File::get($envPath);

        foreach ($data as $key => $value) {
            $value = trim($value);
            if (str_contains($value, ' ') || str_contains($value, '#')) {
                $value = '"' . $value . '"';
            }

            if (preg_match("/^{$key}=.*/m", $content)) {
                $content = preg_replace("/^{$key}=.*/m", "{$key}={$value}", $content);
            } else {
                $content .= "\n{$key}={$value}";
            }
        }

        File::put($envPath, $content);
    }
}
