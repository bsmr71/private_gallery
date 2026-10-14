<?php

namespace App\Console\Commands;

use App\Models\Album;
use App\Models\Media;
use App\Services\FileEncryptionService;
use App\Services\GoogleDriveService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class VaultSyncDriveCommand extends Command
{
    protected $signature = 'vault:sync-drive';
    protected $description = 'Scan Google Drive for direct uploads from mobile, decrypt metadata, and sync into database';

    public function handle(GoogleDriveService $driveService, FileEncryptionService $encryptionService): int
    {
        $this->info('Memulai pemindaian Google Drive Vault...');

        try {
            $allFiles = $driveService->listFilesInFolder();
        } catch (\Throwable $e) {
            $this->error('Gagal membaca Google Drive: ' . $e->getMessage());
            return 1;
        }

        if (empty($allFiles)) {
            $this->warn('Tidak ada file ditemukan di folder Vault Google Drive.');
            return 0;
        }

        $this->info('Ditemukan ' . count($allFiles) . ' file di folder Drive. Memproses file manifest (.meta)...');

        // Index .enc files by name and id
        $encFilesByName = [];
        $metaFiles = [];

        foreach ($allFiles as $f) {
            $name = $f['name'] ?? '';
            if (str_ends_with($name, '.meta')) {
                $metaFiles[] = $f;
            } elseif (str_ends_with($name, '.enc')) {
                $base = substr($name, 0, -4);
                $encFilesByName[$base] = $f;
            }
        }

        $this->info('Jumlah manifest (.meta): ' . count($metaFiles));

        $syncedCount = 0;
        $skippedCount = 0;
        $errorCount = 0;

        foreach ($metaFiles as $metaFile) {
            $metaId = $metaFile['id'];
            $metaName = $metaFile['name'];
            $baseName = substr($metaName, 0, -5); // remove .meta

            $tempMetaPath = tempnam(sys_get_temp_dir(), 'meta_');
            try {
                $driveService->download($metaId, $tempMetaPath);
                $encryptedContent = file_get_contents($tempMetaPath);
                if (empty($encryptedContent)) {
                    $errorCount++;
                    continue;
                }

                // Try decrypting manifest using Master Vault Key first, fallback to direct JSON
                $metaData = null;
                try {
                    $jsonStr = $encryptionService->decryptString(trim($encryptedContent));
                    $metaData = json_decode($jsonStr, true);
                } catch (\Throwable $e) {
                    $metaData = null;
                }

                if (!is_array($metaData)) {
                    $metaData = json_decode($encryptedContent, true);
                }

                if (!is_array($metaData)) {
                    $this->warn("Format manifest invalid pada {$metaName}");
                    $errorCount++;
                    continue;
                }

                // Identify corresponding encrypted media file ID
                $driveFileId = $metaData['media_file_id'] ?? null;
                if (!$driveFileId && isset($encFilesByName[$baseName])) {
                    $driveFileId = $encFilesByName[$baseName]['id'];
                }

                if (!$driveFileId) {
                    $this->warn("File .enc untuk {$metaName} belum ditemukan di Drive.");
                    continue;
                }

                // Check if already registered in database
                $existing = Media::where('drive_file_id', $driveFileId)->first();
                if ($existing) {
                    $skippedCount++;
                    continue;
                }

                // Album resolution
                $albumId = null;
                $albumName = trim($metaData['album_name'] ?? '');
                if (!empty($albumName)) {
                    $album = Album::firstOrCreate(
                        ['name' => $albumName],
                        ['slug' => Str::slug($albumName) . '-' . Str::random(4)]
                    );
                    $albumId = $album->id;
                }

                $originalFilename = $metaData['original_filename'] ?? ($baseName . ($metaData['type'] === 'video' ? '.mp4' : '.jpg'));
                $title = $metaData['title'] ?? pathinfo($originalFilename, PATHINFO_FILENAME);
                $type = ($metaData['type'] ?? 'image') === 'video' ? 'video' : 'image';
                $mimeType = $metaData['mime_type'] ?? ($type === 'video' ? 'video/mp4' : 'image/jpeg');
                $size = (int)($metaData['size'] ?? ($encFilesByName[$baseName]['size'] ?? 0));
                $thumbDriveId = $metaData['thumb_drive_id'] ?? null;

                Media::create([
                    'title' => $title,
                    'description' => $metaData['description'] ?? null,
                    'type' => $type,
                    'mime_type' => $mimeType,
                    'original_filename' => $originalFilename,
                    'size' => $size,
                    'drive_file_id' => $driveFileId,
                    'thumb_drive_id' => $thumbDriveId,
                    'cache_key' => Str::random(32),
                    'album_id' => $albumId,
                    'sort_order' => 0,
                    'is_favorite' => (bool)($metaData['is_favorite'] ?? false),
                    'is_locked' => false,
                ]);

                $syncedCount++;
                $this->info("✓ Berhasil sinkronisasi: {$title} ({$type})");
            } catch (\Throwable $e) {
                $this->error("Gagal memproses {$metaName}: " . $e->getMessage());
                Log::warning("VaultSync error on {$metaName}: " . $e->getMessage());
                $errorCount++;
            } finally {
                @unlink($tempMetaPath);
            }
        }

        $this->info("==========================================");
        $this->info("Sinkronisasi Selesai!");
        $this->info("Media Baru Ditambahkan : {$syncedCount}");
        $this->info("Media Sudah Ada (Skip) : {$skippedCount}");
        $this->info("Gagal / Error          : {$errorCount}");
        $this->info("==========================================");

        return 0;
    }
}
