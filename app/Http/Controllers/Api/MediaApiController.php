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

    /**
     * Get paginated media stream for mobile/web with filters and stats.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Media::with('album')->latest();

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

        $perPage = min((int)$request->input('per_page', 30), 100);
        $paginated = $query->paginate($perPage);

        $items = collect($paginated->items())->map(function ($m) use ($request) {
            return $this->formatMediaItem($m, $request);
        });

        $stats = [
            'total' => Media::count(),
            'images' => Media::where('type', 'image')->count(),
            'videos' => Media::where('type', 'video')->count(),
            'favorites' => Media::where('is_favorite', true)->count(),
            'albums' => Album::count(),
        ];

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
            'album_id' => 'nullable|integer|exists:albums,id',
            'new_album_name' => 'nullable|string|max:255',
        ]);

        $targetAlbumId = $request->album_id;

        if ($request->filled('new_album_name')) {
            $newAlbum = Album::create([
                'name' => trim($request->new_album_name),
                'slug' => Str::slug(trim($request->new_album_name)) . '-' . Str::random(4),
            ]);
            $targetAlbumId = $newAlbum->id;
        }

        Media::whereIn('id', $request->media_ids)->update(['album_id' => $targetAlbumId]);

        return response()->json([
            'success' => true,
            'message' => count($request->media_ids) . ' media berhasil dipindahkan.',
            'target_album_id' => $targetAlbumId,
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
            'album_id' => 'nullable|integer|exists:albums,id',
            'new_album_name' => 'nullable|string|max:255',
        ]);

        $targetAlbumId = $request->album_id;

        if ($request->filled('new_album_name')) {
            $newAlbum = Album::create([
                'name' => trim($request->new_album_name),
                'slug' => Str::slug(trim($request->new_album_name)) . '-' . Str::random(4),
            ]);
            $targetAlbumId = $newAlbum->id;
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
            'message' => "{$createdCount} media berhasil disalin.",
            'target_album_id' => $targetAlbumId,
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
                $mimeType = $file->getMimeType() ?: 'application/octet-stream';
                $type = str_starts_with($mimeType, 'image/') ? 'image' : 'video';
                $title = $request->title ?: pathinfo($originalName, PATHINFO_FILENAME);
                $size = $file->getSize();

                $tempDir = storage_path('app/temp_uploads');
                if (!is_dir($tempDir)) {
                    mkdir($tempDir, 0755, true);
                }
                $ext = $file->getClientOriginalExtension() ?: 'tmp';
                $tempFilename = Str::random(32) . '.' . $ext;
                $file->move($tempDir, $tempFilename);
                $tempPath = $tempDir . DIRECTORY_SEPARATOR . $tempFilename;

                $thumbDriveId = null;
                if ($type === 'image') {
                    $mediaCtrl = app(\App\Http\Controllers\MediaController::class);
                    // Generate and upload thumbnail if supported
                    try {
                        $reflector = new \ReflectionMethod($mediaCtrl, 'generateAndUploadThumbnail');
                        $reflector->setAccessible(true);
                        $thumbDriveId = $reflector->invoke($mediaCtrl, $tempPath, $mimeType);
                    } catch (\Throwable $th) {
                        Log::warning('Thumbnail generation skipped: ' . $th->getMessage());
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
     * Build API media item payload with proper authenticated URLs based on current request host.
     */
    private function formatMediaItem(Media $m, Request $request): array
    {
        $token = $request->attributes->get('plain_api_token') ?: $request->bearerToken() ?: $request->query('token');
        $tokenParam = $token ? '?token=' . urlencode($token) : '';
        $baseApiUrl = rtrim($request->getSchemeAndHttpHost(), '/') . '/api';

        return [
            'id' => $m->id,
            'title' => $m->title,
            'description' => $m->description,
            'type' => $m->type,
            'mime_type' => $m->mime_type,
            'size' => $m->size,
            'formatted_size' => $m->formattedSize(),
            'is_favorite' => (bool)$m->is_favorite,
            'album_id' => $m->album_id,
            'album_name' => $m->album ? $m->album->name : null,
            'stream_url' => "{$baseApiUrl}/media/{$m->id}/stream{$tokenParam}",
            'thumbnail_url' => "{$baseApiUrl}/media/{$m->id}/thumbnail{$tokenParam}",
            'download_url' => "{$baseApiUrl}/media/{$m->id}/download{$tokenParam}",
            'created_at' => $m->created_at ? $m->created_at->toIso8601String() : null,
            'formatted_date' => $m->created_at ? $m->created_at->format('d M Y') : null,
        ];
    }
}
