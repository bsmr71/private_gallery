<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\Media;
use App\Services\GoogleDriveService;
use App\Services\FileEncryptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MediaApiController extends Controller
{
    public function __construct(
        protected GoogleDriveService $driveService,
        protected FileEncryptionService $encryptionService
    ) {}

    private function hasLockedMedia(): bool
    {
        static $hasColumn = null;
        if ($hasColumn !== null) return $hasColumn;

        try {
            \Illuminate\Support\Facades\DB::select("SELECT `is_locked` FROM `media` LIMIT 0");
            $hasColumn = true;
        } catch (\Throwable $e) {
            $hasColumn = false;
        }
        return $hasColumn;
    }

    private function hasLockedAlbums(): bool
    {
        static $hasColumn = null;
        if ($hasColumn !== null) return $hasColumn;

        try {
            \Illuminate\Support\Facades\DB::select("SELECT `is_locked` FROM `albums` LIMIT 0");
            $hasColumn = true;
        } catch (\Throwable $e) {
            $hasColumn = false;
        }
        return $hasColumn;
    }

    /**
     * Get paginated media stream for mobile/web with filters and stats.
     */
    public function index(Request $request): JsonResponse
    {
        $hasLockedMedia = $this->hasLockedMedia();
        $hasLockedAlbums = $this->hasLockedAlbums();

        $query = Media::with('album')->latest();

        if ($hasLockedMedia) {
            try {
                $query->where('is_locked', false);
            } catch (\Throwable $e) {}
        }

        if ($request->filled('type') && in_array($request->type, ['image', 'video'])) {
            $query->where('type', $request->type);
        }

        if ($request->filled('favorite') && $request->favorite == '1') {
            $query->where('is_favorite', true);
        }

        if ($request->filled('album_id')) {
            $query->where('album_id', $request->album_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('original_filename', 'like', "%{$search}%");
            });
        }

        $maxPerPage = $request->boolean('all') ? 5000 : 100;
        $perPage = min((int)$request->input('per_page', $request->boolean('all') ? 5000 : 30), $maxPerPage);
        $paginated = $query->paginate($perPage);

        $items = collect($paginated->items())->map(function ($m) use ($request) {
            return $this->formatMediaItem($m, $request);
        });

        $stats = [
            'total' => 0,
            'images' => 0,
            'videos' => 0,
            'favorites' => 0,
            'albums' => 0,
        ];

        try {
            if ($hasLockedMedia) {
                $stats['total'] = Media::where('is_locked', false)->count();
                $stats['images'] = Media::where('is_locked', false)->where('type', 'image')->count();
                $stats['videos'] = Media::where('is_locked', false)->where('type', 'video')->count();
                $stats['favorites'] = Media::where('is_locked', false)->where('is_favorite', true)->count();
            } else {
                $stats['total'] = Media::count();
                $stats['images'] = Media::where('type', 'image')->count();
                $stats['videos'] = Media::where('type', 'video')->count();
                $stats['favorites'] = Media::where('is_favorite', true)->count();
            }
        } catch (\Throwable $e) {
            $stats['total'] = Media::count();
            $stats['images'] = Media::where('type', 'image')->count();
            $stats['videos'] = Media::where('type', 'video')->count();
            $stats['favorites'] = Media::where('is_favorite', true)->count();
        }

        try {
            $stats['albums'] = $hasLockedAlbums ? Album::where('is_locked', false)->count() : Album::count();
        } catch (\Throwable $e) {
            $stats['albums'] = Album::count();
        }

        return response()->json([
            'success' => true,
            'data' => $items,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'has_more' => $paginated->hasMorePages(),
            ],
            'stats' => $stats,
        ]);
    }

    /**
     * Get single media details.
     */
    public function show(Request $request, Media $media): JsonResponse
    {
        $media->load('album');

        return response()->json([
            'success' => true,
            'data' => $this->formatMediaItem($media, $request),
        ]);
    }

    /**
     * Toggle favorite status.
     */
    public function toggleFavorite(Media $media): JsonResponse
    {
        $media->is_favorite = !$media->is_favorite;
        $media->save();

        return response()->json([
            'success' => true,
            'is_favorite' => (bool)$media->is_favorite,
            'message' => $media->is_favorite ? 'Ditambahkan ke Favorit ❤️' : 'Dihapus dari Favorit',
        ]);
    }

    /**
     * Rename media item.
     */
    public function rename(Request $request, Media $media): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $media->title = trim($request->title);
        $media->save();

        return response()->json([
            'success' => true,
            'message' => 'Judul media berhasil diperbarui.',
            'data' => [
                'id' => $media->id,
                'title' => $media->title,
            ],
        ]);
    }

    /**
     * Move media item(s) to album.
     */
    public function move(Request $request): JsonResponse
    {
        $request->validate([
            'media_ids' => 'required|array',
            'media_ids.*' => 'integer|exists:media,id',
            'album_id' => 'nullable',
            'new_album_name' => 'nullable|string|max:255',
        ]);

        $targetAlbumId = (!empty($request->album_id) && (int)$request->album_id > 0) ? (int)$request->album_id : null;
        $targetAlbumName = 'Tanpa Album';

        if ($request->filled('new_album_name')) {
            $newAlbum = Album::create([
                'name' => trim($request->new_album_name),
                'slug' => Str::slug(trim($request->new_album_name)) . '-' . Str::random(4),
            ]);
            $targetAlbumId = $newAlbum->id;
            $targetAlbumName = $newAlbum->name;
        } elseif ($targetAlbumId) {
            $album = Album::find($targetAlbumId);
            if ($album) {
                $targetAlbumName = $album->name;
            } else {
                $targetAlbumId = null;
            }
        }

        Media::whereIn('id', $request->media_ids)->update(['album_id' => $targetAlbumId]);

        return response()->json([
            'success' => true,
            'message' => count($request->media_ids) . ' media berhasil dipindahkan ke "' . $targetAlbumName . '".',
            'target_album_id' => $targetAlbumId,
            'target_album_name' => $targetAlbumName,
        ]);
    }

    /**
     * Copy media item(s) to album.
     */
    public function copy(Request $request): JsonResponse
    {
        $request->validate([
            'media_ids' => 'required|array',
            'media_ids.*' => 'integer|exists:media,id',
            'album_id' => 'nullable',
            'new_album_name' => 'nullable|string|max:255',
        ]);

        $targetAlbumId = (!empty($request->album_id) && (int)$request->album_id > 0) ? (int)$request->album_id : null;
        $targetAlbumName = 'Tanpa Album';

        if ($request->filled('new_album_name')) {
            $newAlbum = Album::create([
                'name' => trim($request->new_album_name),
                'slug' => Str::slug(trim($request->new_album_name)) . '-' . Str::random(4),
            ]);
            $targetAlbumId = $newAlbum->id;
            $targetAlbumName = $newAlbum->name;
        } elseif ($targetAlbumId) {
            $album = Album::find($targetAlbumId);
            if ($album) {
                $targetAlbumName = $album->name;
            } else {
                $targetAlbumId = null;
            }
        }

        $sourceMedia = Media::whereIn('id', $request->media_ids)->get();
        $createdCount = 0;

        foreach ($sourceMedia as $orig) {
            Media::create([
                'title' => $orig->title . ' (Salinan)',
                'description' => $orig->description,
                'type' => $orig->type,
                'mime_type' => $orig->mime_type,
                'original_filename' => $orig->original_filename,
                'size' => $orig->size,
                'drive_file_id' => $orig->drive_file_id,
                'thumb_drive_id' => $orig->thumb_drive_id,
                'album_id' => $targetAlbumId,
                'is_favorite' => false,
            ]);
            $createdCount++;
        }

        return response()->json([
            'success' => true,
            'message' => "{$createdCount} media berhasil disalin ke \"{$targetAlbumName}\".",
            'target_album_id' => $targetAlbumId,
            'target_album_name' => $targetAlbumName,
        ]);
    }

    /**
     * Delete media item.
     */
    public function destroy(Media $media): JsonResponse
    {
        try {
            if ($media->drive_file_id) {
                $this->driveService->delete($media->drive_file_id);
            }
            if ($media->thumb_drive_id) {
                $this->driveService->delete($media->thumb_drive_id);
            }
        } catch (\Throwable $e) {
            Log::warning('Drive file deletion error: ' . $e->getMessage());
        }

        $media->delete();

        return response()->json([
            'success' => true,
            'message' => 'Media berhasil dihapus.',
        ]);
    }

    /**
     * Batch delete media items.
     */
    public function batchDelete(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:media,id',
        ]);

        $items = Media::whereIn('id', $request->ids)->get();
        $count = $items->count();

        foreach ($items as $item) {
            try {
                if ($item->drive_file_id) {
                    $this->driveService->delete($item->drive_file_id);
                }
                if ($item->thumb_drive_id) {
                    $this->driveService->delete($item->thumb_drive_id);
                }
            } catch (\Throwable $e) {
                Log::warning('Batch delete error for media ' . $item->id . ': ' . $e->getMessage());
            }
            $item->delete();
        }

        return response()->json([
            'success' => true,
            'message' => "{$count} item media berhasil dihapus permanen.",
        ]);
    }

    /**
     * Mobile file upload directly from device camera roll.
     */
    public function upload(Request $request): JsonResponse
    {
        @set_time_limit(600);
        @ini_set('memory_limit', '512M');

        // Check if entire POST payload was dropped by PHP due to post_max_size
        if (empty($_FILES) && empty($_POST) && isset($_SERVER['CONTENT_LENGTH']) && $_SERVER['CONTENT_LENGTH'] > 0) {
            $postMaxSize = ini_get('post_max_size');
            return response()->json([
                'success' => false,
                'message' => "Ukuran berkas melebihi batas post_max_size server ({$postMaxSize}).",
            ], 413);
        }

        // Check for specific upload errors
        if (isset($_FILES['file']['error']) && $_FILES['file']['error'] === UPLOAD_ERR_INI_SIZE) {
            $uploadMax = ini_get('upload_max_filesize');
            return response()->json([
                'success' => false,
                'message' => "Ukuran video melebihi batas upload_max_filesize server ({$uploadMax}).",
            ], 413);
        }

        $request->validate([
            'file' => 'required_without:files|file|max:512000', // 500MB
            'files.*' => 'file|max:512000',
            'album_id' => 'nullable|integer|exists:albums,id',
            'title' => 'nullable|string|max:255',
        ]);

        $files = $request->hasFile('files') ? $request->file('files') : [$request->file('file')];
        $uploaded = [];
        $errors = [];

        foreach ($files as $file) {
            if (!$file || !$file->isValid()) continue;

            $tempPath = null;
            $originalName = $file->getClientOriginalName();

            try {
                $ext = strtolower($file->getClientOriginalExtension() ?: pathinfo($originalName, PATHINFO_EXTENSION) ?: 'tmp');
                $mimeType = $file->getMimeType() ?: 'application/octet-stream';
                $isVideoExt = in_array($ext, ['mp4', 'mov', 'm4v', 'webm', '3gp', 'mkv', 'avi']);
                $type = (str_starts_with($mimeType, 'video/') || $isVideoExt) ? 'video' : (str_starts_with($mimeType, 'image/') ? 'image' : ($isVideoExt ? 'video' : 'image'));
                if ($type === 'video' && !str_starts_with($mimeType, 'video/')) {
                    $mimeType = $ext === 'mov' ? 'video/quicktime' : 'video/mp4';
                }
                $title = $request->title ?: pathinfo($originalName, PATHINFO_FILENAME);
                $size = $file->getSize();

                // Prevent duplicate upload if file with identical size and original filename already exists
                $existingMedia = Media::where('size', $size)
                    ->where('original_filename', $originalName)
                    ->first();

                if ($existingMedia) {
                    Log::info("Duplicate upload skipped for {$originalName} ({$size} bytes), returning existing ID {$existingMedia->id}");
                    $formatted = $this->formatMediaItem($existingMedia, $request);
                    $formatted['is_duplicate'] = true;
                    $uploaded[] = $formatted;
                    continue;
                }

                $tempDir = storage_path('app/temp_uploads');
                if (!is_dir($tempDir)) {
                    mkdir($tempDir, 0755, true);
                }
                $ext = $file->getClientOriginalExtension() ?: 'tmp';
                $tempFilename = Str::random(32) . '.' . $ext;
                $file->move($tempDir, $tempFilename);
                $tempPath = $tempDir . DIRECTORY_SEPARATOR . $tempFilename;

                $thumbDriveId = null;
                $mediaCtrl = app(\App\Http\Controllers\MediaController::class);

                // If mobile uploaded a client-extracted native thumbnail for video
                if ($type === 'video') {
                    $clientThumbPath = null;
                    if ($request->hasFile('thumbnail') && $request->file('thumbnail')->isValid()) {
                        $thumbFile = $request->file('thumbnail');
                        $clientThumbPath = $tempDir . DIRECTORY_SEPARATOR . 'client_thumb_' . Str::random(32) . '.jpg';
                        $thumbFile->move($tempDir, basename($clientThumbPath));
                    } elseif ($request->filled('thumbnail_base64')) {
                        $rawB64 = $request->input('thumbnail_base64');
                        $rawB64 = preg_replace('#^data:image/\w+;base64,#i', '', $rawB64);
                        $decoded = base64_decode($rawB64);
                        if ($decoded && strlen($decoded) > 0) {
                            $clientThumbPath = $tempDir . DIRECTORY_SEPARATOR . 'client_thumb_' . Str::random(32) . '.jpg';
                            file_put_contents($clientThumbPath, $decoded);
                        }
                    }

                    if ($clientThumbPath && file_exists($clientThumbPath) && filesize($clientThumbPath) > 0) {
                        try {
                            $encThumb = $this->encryptionService->encryptFile($clientThumbPath);
                            $thumbDriveId = $this->driveService->upload($encThumb, 'thumb_' . Str::random(32) . '.enc');
                            @unlink($encThumb);
                        } catch (\Throwable $th) {
                            Log::warning('Client video thumbnail upload failed: ' . $th->getMessage());
                        } finally {
                            @unlink($clientThumbPath);
                        }
                    }
                }

                if (!$thumbDriveId) {
                    if ($type === 'image') {
                        try {
                            $thumbDriveId = $mediaCtrl->generateAndUploadThumbnail($tempPath, $mimeType);
                        } catch (\Throwable $th) {
                            Log::warning('Image thumbnail generation skipped: ' . $th->getMessage());
                        }
                    } elseif ($type === 'video') {
                        try {
                            $thumbDriveId = $mediaCtrl->generateAndUploadVideoThumbnail($tempPath, $title, $ext);
                        } catch (\Throwable $th) {
                            Log::warning('Video thumbnail generation skipped: ' . $th->getMessage());
                        }
                    }
                }

                $encryptedPath = $this->encryptionService->encryptFile($tempPath);
                $encryptedSize = filesize($encryptedPath);
                $driveName = Str::random(32) . '.enc';

                if ($encryptedSize > 5 * 1024 * 1024) {
                    $driveFileId = $this->driveService->uploadLarge($encryptedPath, $driveName);
                } else {
                    $driveFileId = $this->driveService->upload($encryptedPath, $driveName);
                }

                @unlink($encryptedPath);
                @unlink($tempPath);
                $tempPath = null;

                $media = Media::create([
                    'title' => $title,
                    'description' => $request->description,
                    'type' => $type,
                    'mime_type' => $mimeType,
                    'original_filename' => $originalName,
                    'size' => $size,
                    'drive_file_id' => $driveFileId,
                    'thumb_drive_id' => $thumbDriveId,
                    'album_id' => $request->album_id,
                ]);

                $uploaded[] = $this->formatMediaItem($media, $request);
            } catch (\Throwable $e) {
                if ($tempPath && file_exists($tempPath)) {
                    @unlink($tempPath);
                }
                Log::error('API Upload error: ' . $e->getMessage());
                $errors[] = [
                    'file' => $originalName,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'success' => count($uploaded) > 0,
            'message' => count($uploaded) . ' berkas berhasil diunggah.',
            'uploaded' => $uploaded,
            'errors' => $errors,
        ], count($uploaded) > 0 ? 201 : 400);
    }

    /**
     * Stream media file via API (supports range requests and token authentication).
     */
    public function stream(Media $media, \App\Http\Controllers\MediaController $mediaController)
    {
        return $mediaController->stream($media);
    }

    /**
     * Serve thumbnail image via API (supports token authentication).
     */
    public function thumbnail(Media $media, \App\Http\Controllers\MediaController $mediaController)
    {
        return $mediaController->thumbnail($media);
    }

    /**
     * Download decrypted media via API (supports token authentication).
     */
    public function download(Media $media, \App\Http\Controllers\MediaController $mediaController)
    {
        return $mediaController->download($media);
    }

    /**
     * Update media thumbnail via API.
     */
    public function updateThumbnail(Request $request, Media $media): JsonResponse
    {
        $mediaCtrl = app(\App\Http\Controllers\MediaController::class);
        $resp = $mediaCtrl->updateThumbnail($request, $media);
        if ($resp instanceof JsonResponse) {
            return $resp;
        }
        return response()->json($resp->getData(), $resp->getStatusCode());
    }

    /**
     * Build API media item payload with proper authenticated URLs based on current request host.
     */
    private function formatMediaItem(Media $m, Request $request): array
    {
        $token = $request->attributes->get('plain_api_token') ?: $request->bearerToken() ?: $request->query('token');
        $tokenParam = $token ? '?token=' . urlencode($token) : '';

        // Properly detect HTTPS scheme behind reverse proxy / SSL termination
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

        // When accessed from web session, use standard web routes so cookies work automatically
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

    /**
     * Get list of duplicate media groups.
     */
    public function duplicates(Request $request): JsonResponse
    {
        $duplicateGroups = \Illuminate\Support\Facades\DB::table('media')
            ->select('size', 'original_filename', \Illuminate\Support\Facades\DB::raw('COUNT(*) as copy_count'))
            ->groupBy('size', 'original_filename')
            ->having('copy_count', '>', 1)
            ->get();

        $groups = [];
        $totalWastedBytes = 0;
        $totalDuplicateCopies = 0;

        foreach ($duplicateGroups as $dg) {
            $items = Media::with('album')
                ->where('size', $dg->size)
                ->where('original_filename', $dg->original_filename)
                ->orderByDesc('is_favorite')
                ->orderBy('created_at')
                ->get();

            if ($items->count() < 2) continue;

            $keeper = $items->first();
            $wasted = ($items->count() - 1) * $dg->size;
            $totalWastedBytes += $wasted;
            $totalDuplicateCopies += ($items->count() - 1);

            $formattedItems = $items->map(function ($m) use ($request, $keeper) {
                $f = $this->formatMediaItem($m, $request);
                $f['is_keeper'] = ($m->id === $keeper->id);
                return $f;
            });

            $groups[] = [
                'group_key' => md5($dg->original_filename . '_' . $dg->size),
                'filename' => $dg->original_filename,
                'size' => $dg->size,
                'formatted_size' => Media::formatBytes($dg->size),
                'wasted_bytes' => $wasted,
                'formatted_wasted' => Media::formatBytes($wasted),
                'copy_count' => $items->count(),
                'keeper_id' => $keeper->id,
                'items' => $formattedItems,
            ];
        }

        return response()->json([
            'success' => true,
            'duplicate_groups_count' => count($groups),
            'total_duplicate_copies' => $totalDuplicateCopies,
            'total_wasted_bytes' => $totalWastedBytes,
            'formatted_total_wasted' => Media::formatBytes($totalWastedBytes),
            'groups' => $groups,
        ]);
    }

    /**
     * Merge duplicates: keeps specified keeper (or best keeper) and deletes duplicate copies.
     */
    public function mergeDuplicates(Request $request): JsonResponse
    {
        $all = $request->boolean('all', false);
        $keepId = $request->input('keep_id');
        $duplicateIds = $request->input('duplicate_ids', []);

        $deletedCount = 0;
        $freedBytes = 0;

        if ($all) {
            $duplicateGroups = \Illuminate\Support\Facades\DB::table('media')
                ->select('size', 'original_filename', \Illuminate\Support\Facades\DB::raw('COUNT(*) as copy_count'))
                ->groupBy('size', 'original_filename')
                ->having('copy_count', '>', 1)
                ->get();

            foreach ($duplicateGroups as $dg) {
                $items = Media::where('size', $dg->size)
                    ->where('original_filename', $dg->original_filename)
                    ->orderByDesc('is_favorite')
                    ->orderBy('created_at')
                    ->get();

                if ($items->count() < 2) continue;

                $redundant = $items->slice(1);

                foreach ($redundant as $dup) {
                    $freedBytes += $dup->size;
                    $this->deleteMediaFilesAndRecord($dup);
                    $deletedCount++;
                }
            }
        } elseif ($keepId && !empty($duplicateIds)) {
            $redundant = Media::whereIn('id', $duplicateIds)
                ->where('id', '!=', $keepId)
                ->get();

            foreach ($redundant as $dup) {
                $freedBytes += $dup->size;
                $this->deleteMediaFilesAndRecord($dup);
                $deletedCount++;
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Parameter keep_id dan duplicate_ids atau all diperlukan.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => "{$deletedCount} berkas duplikat berhasil digabungkan dan dibersihkan dari Google Drive.",
            'deleted_count' => $deletedCount,
            'freed_bytes' => $freedBytes,
            'formatted_freed' => Media::formatBytes($freedBytes),
        ]);
    }

    /**
     * Delete a specific single duplicate media item.
     */
    public function deleteDuplicate(Request $request): JsonResponse
    {
        $request->validate([
            'media_id' => 'required|integer|exists:media,id',
        ]);

        $media = Media::findOrFail($request->media_id);
        $freedBytes = $media->size;
        $this->deleteMediaFilesAndRecord($media);

        return response()->json([
            'success' => true,
            'message' => 'Salinan duplikat berhasil dihapus.',
            'freed_bytes' => $freedBytes,
            'formatted_freed' => Media::formatBytes($freedBytes),
        ]);
    }

    private function deleteMediaFilesAndRecord(Media $media): void
    {
        try {
            if ($media->drive_file_id) {
                $this->driveService->delete($media->drive_file_id);
            }
            if ($media->thumb_drive_id) {
                $this->driveService->delete($media->thumb_drive_id);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed deleting duplicate Drive file: ' . $e->getMessage());
        }

        try {
            $cacheService = app(\App\Services\MediaCacheService::class);
            $cacheService->clearCache($media);
        } catch (\Throwable $e) {}

        $media->delete();
    }
}
