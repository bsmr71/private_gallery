<?php

namespace App\Console\Commands;

use App\Http\Controllers\MediaController;
use Illuminate\Console\Command;

class InstallFfmpegCommand extends Command
{
    protected $signature = 'media:install-ffmpeg';

    protected $description = 'Pasang standalone static binary FFmpeg untuk Linux ke storage/bin/ffmpeg';

    public function handle(): int
    {
        $this->info('=== Pemasangan Standalone Static FFmpeg ===');

        $existing = MediaController::findFfmpegBinary();
        if ($existing) {
            $this->info("FFmpeg sudah terdeteksi di: {$existing}");
            if (!$this->confirm('Apakah Anda ingin tetap mengunduh static binary baru ke storage/bin/ffmpeg?', false)) {
                return 0;
            }
        }

        if (PHP_OS_FAMILY === 'Windows') {
            $this->line('Pada Windows, silakan pasang via PowerShell:');
            $this->line('  winget install Gyan.FFmpeg');
            return 0;
        }

        $binDir = storage_path('bin');
        if (!is_dir($binDir)) {
            @mkdir($binDir, 0755, true);
        }
        $targetFile = $binDir . DIRECTORY_SEPARATOR . 'ffmpeg';

        $this->info('Mengunduh precompiled static Linux FFmpeg binary...');
        $url = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64';

        $fp = @fopen($targetFile, 'w+');
        if (!$fp) {
            $this->error("Gagal membuka file tujuan: {$targetFile}");
            return 1;
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_TIMEOUT, 300);
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $this->output->write('Mengunduh [');
        curl_setopt($ch, CURLOPT_NOPROGRESS, false);
        curl_setopt($ch, CURLOPT_PROGRESSFUNCTION, function ($ch, $dlTotal, $dlNow) {
            static $lastDots = 0;
            if ($dlTotal > 0) {
                $pct = (int)(($dlNow / $dlTotal) * 20);
                while ($lastDots < $pct) {
                    $this->output->write('=');
                    $lastDots++;
                }
            }
        });

        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        fclose($fp);
        $this->output->writeln('] 100%');

        if ($httpCode === 200 && file_exists($targetFile) && filesize($targetFile) > 1000000) {
            @chmod($targetFile, 0755);

            $out = [];
            $code = 0;
            @exec("{$targetFile} -version 2>&1", $out, $code);

            if ($code === 0 && !empty($out)) {
                $this->newLine();
                $this->info("✓ FFmpeg berhasil dipasang dan diverifikasi!");
                $this->line("Lokasi: {$targetFile}");
                $this->line("Versi: " . ($out[0] ?? ''));
                $this->newLine();
                $this->info("Sekarang Anda dapat menjalankan:");
                $this->line("  php artisan media:generate-video-thumbnails");
                return 0;
            } else {
                $this->warn("File terunduh tetapi gagal dieksekusi: " . implode("\n", array_slice($out, 0, 3)));
            }
        }

        $this->error("Gagal mengunduh FFmpeg binary (HTTP {$httpCode}).");
        if ($err) {
            $this->line("Error cURL: {$err}");
        }
        @unlink($targetFile);
        return 1;
    }
}
