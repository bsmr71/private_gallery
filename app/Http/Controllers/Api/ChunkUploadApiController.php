<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\Media;
use App\Services\GoogleDriveService;
use App\Services\FileEncryptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChunkUploadApiController extends Controller
{
    public function __construct(
        protected GoogleDriveService $driveService,
        protected FileEncryptionService $encryptionService
    ) {}

    /**
     * Get directory path for chunk storage.
     */
    private function getChunkDir(string $uploadId): string
    {
        return storage_path('app/chunks/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $uploadId));
    }

    /**
     * Delete all files inside chunk directory and remove directory safely across OS platforms.
     */
    private function cleanupChunkDir(string $chunkDir): void
    {
        if (!is_dir($chunkDir)) return;

        try {
            $files = array_diff(scandir($chunkDir), ['.', '..']);
            foreach ($files as $file) {
                $filePath = $chunkDir . DIRECTORY_SEPARATOR . $file;
                if (is_file($filePath)) {
                    @unlink($filePath);
                }
            }
            @rmdir($chunkDir);
        } catch (\Throwable $e) {
            Log::warning('Cleanup chunk dir warning: ' . $e->getMessage());
        }

        if (is_dir($chunkDir)) {
            File::deleteDirectory($chunkDir);
        }
    }

    /**
     * Periodically clean up abandoned chunk sessions older than 24 hours.
     */
    private function purgeExpiredChunks(): void
    {
        try {
            $baseDir = storage_path('app/chunks');
            if (!is_dir($baseDir)) return;

            $dirs = glob($baseDir . '/*', GLOB_ONLYDIR);
            $now = time();
            foreach ($dirs as $dir) {
                if ($now - filemtime($dir) > 86400) { // older than 24 hours
                    $this->cleanupChunkDir($dir);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Purge expired chunks error: ' . $e->getMessage());
        }
    }

    /**
     * Initialize chunked upload session.
     * Checks for duplicates, sets up chunk tracking folder and metadata.
     */
    public function init(Request $request): JsonResponse
    {
        $this->purgeExpiredChunks();

        $request->validate([
            'filename' => 'required|string|max:255',
            'total_size' => 'required|numeric|min:1',
            'chunk_size' => 'required|integer|min:1024',
            'total_chunks' => 'required|integer|min:1',
            'mime_type' => 'nullable|string|max:100',
            'album_id' => 'nullable|integer|exists:albums,id',
            'title' => 'nullable|string|max:255',
            'thumbnail_base64' => 'nullable|string',
        ]);

        $originalName = trim($request->filename);
        $totalSize = (int)$request->total_size;

        // Duplicate check: if exact file already exists in database, return it immediately
        $existingMedia = Media::where('size', $totalSize)
            ->where('original_filename', $originalName)
            ->first();

        if ($existingMedia) {
            Log::info("Chunk init duplicate detected: {$originalName} ({$totalSize} bytes), returning existing ID {$existingMedia->id}");
            $formatted = $this->formatMediaItem($existingMedia, $request);
            $formatted['is_duplicate'] = true;
            return response()->json([
                'success' => true,
                'is_duplicate' => true,
                'message' => 'Berkas identik sudah ada di galeri.',
                'media' => $formatted,
            ]);
        }

        $uploadId = (string) Str::uuid();
        $chunkDir = $this->getChunkDir($uploadId);

        if (!is_dir($chunkDir)) {
            mkdir($chunkDir, 0755, true);
        }

        // Save optional client-extracted video/photo thumbnail
        if ($request->filled('thumbnail_base64')) {
            try {
                $rawB64 = $request->input('thumbnail_base64');
                $rawB64 = preg_replace('#^data:image/\w+;base64,#i', '', $rawB64);
                $decoded = base64_decode($rawB64);
                if ($decoded && strlen($decoded) > 0) {
                    file_put_contents($chunkDir . DIRECTORY_SEPARATOR . 'client_thumb.jpg', $decoded);
                }
            } catch (\Throwable $e) {
                Log::warning("Chunk init thumbnail save error: " . $e->getMessage());
            }
        }

        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION) ?: 'tmp');
        $meta = [
            'upload_id' => $uploadId,
            'filename' => $originalName,
            'extension' => $ext,
            'total_size' => $totalSize,
            'chunk_size' => (int)$request->chunk_size,
            'total_chunks' => (int)$request->total_chunks,
            'mime_type' => $request->mime_type ?: 'application/octet-stream',
            'album_id' => $request->album_id,
            'title' => $request->title ?: pathinfo($originalName, PATHINFO_FILENAME),
            'uploaded_chunks' => [],
            'created_at' => time(),
        ];

        file_put_contents($chunkDir . DIRECTORY_SEPARATOR . 'meta.json', json_encode($meta, JSON_PRETTY_PRINT));

        return response()->json([
            'success' => true,
            'upload_id' => $uploadId,
            'chunk_size' => $meta['chunk_size'],
            'total_chunks' => $meta['total_chunks'],
            'uploaded_chunks' => [],
            'message' => 'Sesi upload chunk siap.',
        ]);
    }

    /**
     * Upload an individual chunk.
     */
    public function uploadChunk(Request $request): JsonResponse
    {
        @set_time_limit(300);

        $request->validate([
            'upload_id' => 'required|string',
            'chunk_index' => 'required|integer|min:0',
            'chunk' => 'required|file',
        ]);

        $uploadId = $request->input('upload_id');
        $chunkIndex = (int)$request->input('chunk_index');
        $chunkDir = $this->getChunkDir($uploadId);
        $metaFile = $chunkDir . DIRECTORY_SEPARATOR . 'meta.json';

        if (!file_exists($metaFile)) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi upload tidak ditemukan atau telah kedaluwarsa.',
            ], 404);
        }

        $meta = json_decode(file_get_contents($metaFile), true);
        if (!$meta || $chunkIndex >= $meta['total_chunks']) {
            return response()->json([
                'success' => false,
                'message' => 'Indeks chunk tidak valid.',
            ], 422);
        }

        $chunkFile = $request->file('chunk');
        if (!$chunkFile || !$chunkFile->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menerima berkas chunk.',
            ], 400);
        }

        $targetChunkPath = $chunkDir . DIRECTORY_SEPARATOR . 'chunk_' . $chunkIndex;
        $chunkFile->move($chunkDir, 'chunk_' . $chunkIndex);

        // Update meta with completed chunk
        $uploaded = $meta['uploaded_chunks'] ?? [];
        if (!in_array($chunkIndex, $uploaded)) {
            $uploaded[] = $chunkIndex;
            sort($uploaded);
            $meta['uploaded_chunks'] = $uploaded;
            file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT));
        }

        return response()->json([
            'success' => true,
            'upload_id' => $uploadId,
            'chunk_index' => $chunkIndex,
            'uploaded_chunks_count' => count($uploaded),
            'total_chunks' => $meta['total_chunks'],
            'percentage' => round((count($uploaded) / $meta['total_chunks']) * 100),
        ]);
    }

    /**
     * Check current upload status and which chunks have been received.
     * Enables client to resume without re-uploading completed chunks.
     */
    public function status(Request $request, string $uploadId): JsonResponse
    {
        $chunkDir = $this->getChunkDir($uploadId);
        $metaFile = $chunkDir . DIRECTORY_SEPARATOR . 'meta.json';

        if (!file_exists($metaFile)) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi upload tidak ditemukan atau telah kedaluwarsa.',
            ], 404);
        }

        $meta = json_decode(file_get_contents($metaFile), true);
        $totalChunks = (int)$meta['total_chunks'];

        // Verify existing chunk files on disk
        $existing = [];
        for ($i = 0; $i < $totalChunks; $i++) {
            if (file_exists($chunkDir . DIRECTORY_SEPARATOR . 'chunk_' . $i)) {
                $existing[] = $i;
            }
        }

        $meta['uploaded_chunks'] = $existing;
        file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT));

        return response()->json([
            'success' => true,
            'upload_id' => $uploadId,
            'filename' => $meta['filename'],
            'total_size' => $meta['total_size'],
            'chunk_size' => $meta['chunk_size'],
            'total_chunks' => $totalChunks,
            'uploaded_chunks' => $existing,
            'uploaded_count' => count($existing),
            'is_complete' => count($existing) >= $totalChunks,
        ]);
    }

    /**
     * Complete and assemble all chunks into the target encrypted media file.
     */
    public function complete(Request $request): JsonResponse
    {
        @set_time_limit(600);
        @ini_set('memory_limit', '512M');

        $request->validate([
            'upload_id' => 'required|string',
            'album_id' => 'nullable|integer|exists:albums,id',
            'title' => 'nullable|string|max:255',
        ]);

        $uploadId = $request->input('upload_id');
        $chunkDir = $this->getChunkDir($uploadId);
        $metaFile = $chunkDir . DIRECTORY_SEPARATOR . 'meta.json';

        if (!file_exists($metaFile)) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi upload tidak ditemukan atau telah kedaluwarsa.',
            ], 404);
        }

        $meta = json_decode(file_get_contents($metaFile), true);
        $totalChunks = (int)$meta['total_chunks'];
        $originalName = $meta['filename'];
        $ext = $meta['extension'];
        $mimeType = $meta['mime_type'];
        $totalSize = (int)$meta['total_size'];
        $albumId = $request->input('album_id') ?: $meta['album_id'];
        $title = $request->input('title') ?: $meta['title'] ?: pathinfo($originalName, PATHINFO_FILENAME);

        // Verify that all chunks exist on disk
        $missing = [];
        for ($i = 0; $i < $totalChunks; $i++) {
            if (!file_exists($chunkDir . DIRECTORY_SEPARATOR . 'chunk_' . $i)) {
                $missing[] = $i;
            }
        }

        if (count($missing) > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Beberapa chunk belum diterima server (' . count($missing) . ' chunk hilang).',
                'missing_chunks' => $missing,
            ], 422);
        }

        $tempDir = storage_path('app/temp_uploads');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $mergedFilename = 'chunked_' . Str::random(32) . '.' . $ext;
        $mergedPath = $tempDir . DIRECTORY_SEPARATOR . $mergedFilename;
        $tempPath = null;
        $encryptedPath = null;

        try {
            // 1. Binary Stream Merge with zero RAM footprint
            $outHandle = fopen($mergedPath, 'wb');
            if (!$outHandle) {
                throw new \RuntimeException('Gagal membuat berkas penggabungan di server.');
            }

            for ($i = 0; $i < $totalChunks; $i++) {
                $chunkPart = $chunkDir . DIRECTORY_SEPARATOR . 'chunk_' . $i;
                $inHandle = fopen($chunkPart, 'rb');
                if (!$inHandle) {
                    fclose($outHandle);
                    throw new \RuntimeException("Gagal membaca chunk_{$i}.");
                }
                stream_copy_to_stream($inHandle, $outHandle);
                fclose($inHandle);
                unset($inHandle);
                @unlink($chunkPart);
            }
            fclose($outHandle);
            unset($outHandle);

            $actualSize = filesize($mergedPath);
            Log::info("Chunks merged for {$originalName}: expected {$totalSize} bytes, got {$actualSize} bytes");

            // Determine video vs image
            $isVideoExt = in_array($ext, ['mp4', 'mov', 'm4v', 'webm', '3gp', 'mkv', 'avi']);
            $type = (str_starts_with($mimeType, 'video/') || $isVideoExt) ? 'video' : (str_starts_with($mimeType, 'image/') ? 'image' : ($isVideoExt ? 'video' : 'image'));
            if ($type === 'video' && !str_starts_with($mimeType, 'video/')) {
                $mimeType = $ext === 'mov' ? 'video/quicktime' : 'video/mp4';
            }

            // 2. Handle Thumbnail
            $thumbDriveId = null;
            $clientThumbPath = $chunkDir . DIRECTORY_SEPARATOR . 'client_thumb.jpg';
            $mediaCtrl = app(\App\Http\Controllers\MediaController::class);

            if (file_exists($clientThumbPath) && filesize($clientThumbPath) > 0) {
                try {
                    $encThumb = $this->encryptionService->encryptFile($clientThumbPath);
                    $thumbDriveId = $this->driveService->upload($encThumb, 'thumb_' . Str::random(32) . '.enc');
                    @unlink($encThumb);
                } catch (\Throwable $th) {
                    Log::warning('Client thumbnail upload failed: ' . $th->getMessage());
                }
            }

            if (!$thumbDriveId) {
                if ($type === 'image') {
                    try {
                        $thumbDriveId = $mediaCtrl->generateAndUploadThumbnail($mergedPath, $mimeType);
                    } catch (\Throwable $th) {
                        Log::warning('Image thumbnail generation skipped: ' . $th->getMessage());
                    }
                } elseif ($type === 'video') {
                    try {
                        $thumbDriveId = $mediaCtrl->generateAndUploadVideoThumbnail($mergedPath, $title, $ext);
                    } catch (\Throwable $th) {
                        Log::warning('Video thumbnail generation skipped: ' . $th->getMessage());
                    }
                }
            }

            // 3. Encrypt merged file with AES-256
            $encryptedPath = $this->encryptionService->encryptFile($mergedPath);
            $encryptedSize = filesize($encryptedPath);
            $driveName = Str::random(32) . '.enc';

            // 4. Upload to Google Drive
            if ($encryptedSize > 5 * 1024 * 1024) {
                $driveFileId = $this->driveService->uploadLarge($encryptedPath, $driveName);
            } else {
                $driveFileId = $this->driveService->upload($encryptedPath, $driveName);
            }

            // 5. Clean up temporary files and chunk directory
            @unlink($encryptedPath);
            @unlink($mergedPath);
            $this->cleanupChunkDir($chunkDir);

            // 6. Create standard database Media model
            $media = Media::create([
                'title' => $title,
                'description' => $meta['description'] ?? null,
                'type' => $type,
                'mime_type' => $mimeType,
                'original_filename' => $originalName,
                'size' => $actualSize,
                'drive_file_id' => $driveFileId,
                'thumb_drive_id' => $thumbDriveId,
                'album_id' => $albumId,
                'is_favorite' => false,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Berkas besar berhasil digabungkan, dienkripsi, dan disinkronkan ke Cloud.',
                'uploaded' => [$this->formatMediaItem($media, $request)],
                'media' => $this->formatMediaItem($media, $request),
            ], 201);
        } catch (\Throwable $e) {
            if (file_exists($mergedPath)) {
                @unlink($mergedPath);
            }
            if ($encryptedPath && file_exists($encryptedPath)) {
                @unlink($encryptedPath);
            }
            Log::error('Chunk assemble error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Gagal menggabungkan berkas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel upload session and clean up chunk files.
     */
    public function cancel(Request $request): JsonResponse
    {
        $request->validate([
            'upload_id' => 'required|string',
        ]);

        $uploadId = $request->input('upload_id');
        $chunkDir = $this->getChunkDir($uploadId);

        $this->cleanupChunkDir($chunkDir);

        return response()->json([
            'success' => true,
            'message' => 'Sesi upload berhasil dibatalkan dan dibersihkan.',
        ]);
    }

    /**
     * Build API media item payload with proper authenticated URLs.
     */
    private function formatMediaItem(Media $m, Request $request): array
    {
        $token = $request->attributes->get('plain_api_token') ?: $request->bearerToken() ?: $request->query('token');
        $tokenParam = $token ? '?token=' . urlencode($token) : '';

        $host = $request->getHttpHost();
        $isHttps = $request->isSecure()
            || $request->header('X-Forwarded-Proto') === 'https'
            || $request->server('HTTPS') === 'on'
            || $request->server('SERVER_PORT') == 443
            || str_contains($host, 'gallery.bsmrlab.com')
            || str_starts_with(config('app.url'), 'https://');

        $scheme = $isHttps ? 'https' : $request->getScheme();
        $baseApiUrl = $scheme . '://' . $host . '/api';

        $vTimestamp = $m->updated_at ? $m->updated_at->timestamp : ($m->created_at ? $m->created_at->timestamp : 1);
        $vParam = "v={$vTimestamp}";

        if ($token) {
            $streamUrl = "{$baseApiUrl}/media/{$m->id}/stream{$tokenParam}";
            $thumbUrl = "{$baseApiUrl}/media/{$m->id}/thumbnail{$tokenParam}&{$vParam}";
            $downloadUrl = "{$baseApiUrl}/media/{$m->id}/download{$tokenParam}";
        } else {
            $streamUrl = $m->streamUrl();
            $thumbUrl = $m->thumbnailUrl() . "?{$vParam}";
            $downloadUrl = $m->downloadUrl();
        }

        return [
            'id' => $m->id,
            'title' => $m->title,
            'description' => $m->description,
            'type' => $m->type,
            'mime_type' => $m->mime_type,
            'original_filename' => $m->original_filename,
            'size' => $m->size,
            'formatted_size' => $m->formattedSize(),
            'is_favorite' => (bool)$m->is_favorite,
            'album_id' => $m->album_id,
            'album_name' => $m->album ? $m->album->name : null,
            'stream_url' => $streamUrl,
            'thumbnail_url' => $thumbUrl,
            'download_url' => $downloadUrl,
            'created_at' => $m->created_at ? $m->created_at->toIso8601String() : null,
            'formatted_date' => $m->created_at ? $m->created_at->format('d M Y') : null,
        ];
    }
}
