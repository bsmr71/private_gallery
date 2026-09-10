<?php

namespace App\Console\Commands;

use App\Http\Controllers\MediaController;
use App\Models\Media;
use App\Services\FileEncryptionService;
use App\Services\GoogleDriveService;
use App\Services\MediaCacheService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class GenerateVideoThumbnailsCommand extends Command
{
    protected $signature = 'media:generate-video-thumbnails 
                            {--force : Paksa generate ulang semua video meskipun sudah ada thumbnail}
                            {--id= : Proses media ID spesifik saja}';

    protected $description = 'Ekstrak thumbnail frame asli untuk video di galeri menggunakan FFmpeg dan simpan ke Google Drive';

    public function handle(
        GoogleDriveService $driveService,
        FileEncryptionService $encryptionService,
        MediaCacheService $cacheService,
        MediaController $mediaController
    ): int {
        $this->info('=== Pipeline Ekstraksi Thumbnail Video ===');

        $ffmpeg = MediaController::findFfmpegBinary();
        if (!$ffmpeg) {
            $this->warn('FFmpeg belum terdeteksi di server.');

            if (PHP_OS_FAMILY !== 'Windows') {
                $this->info('Mengunduh binary standalone static FFmpeg untuk Linux ke storage/bin/ffmpeg...');
                $binDir = storage_path('bin');
                if (!is_dir($binDir)) {
                    @mkdir($binDir, 0755, true);
                }
                $targetFile = $binDir . DIRECTORY_SEPARATOR . 'ffmpeg';

                $url = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64';
                $fp = @fopen($targetFile, 'w+');
                if ($fp) {
                    $ch = curl_init($url);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 180);
                    curl_setopt($ch, CURLOPT_FILE, $fp);
                    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                    curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    fclose($fp);

                    if ($httpCode === 200 && file_exists($targetFile) && filesize($targetFile) > 1000000) {
                        @chmod($targetFile, 0755);
                        $this->info("✓ Berhasil memasang FFmpeg ke: {$targetFile}");
                        $ffmpeg = $targetFile;
                    } else {
                        @unlink($targetFile);
                    }
                }
            }

            if (!$ffmpeg) {
                $this->error('FFmpeg tidak dapat dipasang otomatis.');
                $this->line('Anda dapat memasangnya manual di cPanel terminal dengan perintah:');
                $this->line('  mkdir -p storage/bin && curl -sL https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64 -o storage/bin/ffmpeg && chmod +x storage/bin/ffmpeg');
                return 1;
            }
        }

        $this->info("Menggunakan FFmpeg: {$ffmpeg}");

        $query = Media::where('type', 'video');

        if ($specificId = $this->option('id')) {
            $query->where('id', $specificId);
        } elseif (!$this->option('force')) {
            $query->whereNull('thumb_drive_id');
        }

        $videos = $query->orderBy('id', 'desc')->get();
        $total = $videos->count();

        if ($total === 0) {
            $this->info('Tidak ada video yang membutuhkan generate thumbnail.');
            return 0;
        }

        $this->info("Memproses {$total} video...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $successCount = 0;
        $failCount = 0;

        foreach ($videos as $media) {
            $cachedPath = $cacheService->getCachedPath($media);
            $tempEncrypted = null;
            $tempDecrypted = null;

            try {
                if (!$cachedPath || !file_exists($cachedPath)) {
                    $tempEncrypted = tempnam(sys_get_temp_dir(), 'drv_gen_');
                    $driveService->download($media->drive_file_id, $tempEncrypted);
                    $tempDecrypted = $encryptionService->decryptFile($tempEncrypted);
                    @unlink($tempEncrypted);
                    $cachedPath = $cacheService->cacheFile($media, $tempDecrypted);
                    @unlink($tempDecrypted);
                }

                if ($cachedPath && file_exists($cachedPath)) {
                    $tempDir = storage_path('app/temp_uploads');
                    if (!is_dir($tempDir)) {
                        @mkdir($tempDir, 0755, true);
                    }
                    $tempThumb = $tempDir . DIRECTORY_SEPARATOR . 'gen_thumb_' . $media->id . '_' . Str::random(16) . '.jpg';

                    $ffmpegBin = escapeshellarg($ffmpeg);
                    $cmd = sprintf('%s -y -ss 00:00:00.5 -i %s -vframes 1 -q:v 2 %s 2>&1', $ffmpegBin, escapeshellarg($cachedPath), escapeshellarg($tempThumb));
                    @exec($cmd);

                    if (!file_exists($tempThumb) || filesize($tempThumb) === 0) {
                        $cmd = sprintf('%s -y -i %s -ss 00:00:00.5 -vframes 1 -q:v 2 %s 2>&1', $ffmpegBin, escapeshellarg($cachedPath), escapeshellarg($tempThumb));
                        @exec($cmd);
                    }

                    if (file_exists($tempThumb) && filesize($tempThumb) > 0) {
                        $mediaController->applyNewThumbnail($media, $tempThumb);
                        $successCount++;
                    } else {
                        $failCount++;
                    }
                } else {
                    $failCount++;
                }
            } catch (\Throwable $e) {
                @unlink($tempEncrypted ?? '');
                @unlink($tempDecrypted ?? '');
                $failCount++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Selesai! Berhasil: {$successCount}, Gagal/Lewat: {$failCount}");
        return 0;
    }
}
