<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Models\Album;
use App\Services\GoogleDriveService;
use App\Services\FileEncryptionService;
use App\Services\MediaCacheService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MediaController extends Controller
{
    public function __construct(
        private GoogleDriveService $driveService,
        private FileEncryptionService $encryptionService,
        private MediaCacheService $cacheService,
    ) {}

    /**
     * Admin: List all media
     */
    public function index(Request $request)
    {
        $query = Media::with('album')->latest();

        if ($request->filled('album_id')) {
            $query->where('album_id', $request->album_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        $media = $query->paginate(24);
        $albums = Album::orderBy('name')->get();

        return view('admin.media.index', compact('media', 'albums'));
    }

    /**
     * Admin: Show upload form
     */
    public function create()
    {
        $albums = Album::orderBy('name')->get();
        return view('admin.media.upload', compact('albums'));
    }

    /**
     * Admin: Process upload
     */
    public function store(Request $request)
    {
        $request->validate([
            'files' => 'required|array',
            'files.*' => 'required|file|max:512000', // 500MB max
            'album_id' => 'nullable|exists:albums,id',
            'title' => 'nullable|string|max:255',
        ]);

        $uploaded = [];
        $errors = [];

        foreach ($request->file('files') as $file) {
            $tempPath = null;
            $originalName = $file->getClientOriginalName();

            try {
                $mimeType = $file->getMimeType() ?: 'application/octet-stream';
                $type = str_starts_with($mimeType, 'image/') ? 'image' : 'video';
                $title = $request->title ?: pathinfo($originalName, PATHINFO_FILENAME);
                $size = $file->getSize();

                // Move uploaded file to safe local temp storage inside project
                $tempDir = storage_path('app/temp_uploads');
                if (!is_dir($tempDir)) {
                    mkdir($tempDir, 0755, true);
                }
                $ext = $file->getClientOriginalExtension() ?: 'tmp';
                $tempFilename = Str::random(32) . '.' . $ext;
                $file->move($tempDir, $tempFilename);
                $tempPath = $tempDir . DIRECTORY_SEPARATOR . $tempFilename;

                // Generate thumbnail for images or videos
                $thumbDriveId = null;
                if ($type === 'image') {
                    $thumbDriveId = $this->generateAndUploadThumbnail($tempPath, $mimeType);
                } elseif ($type === 'video') {
                    $thumbDriveId = $this->generateAndUploadVideoThumbnail($tempPath, $title, $ext);
                }

                // Encrypt the file
                $encryptedPath = $this->encryptionService->encryptFile($tempPath);

                // Upload to Google Drive (use large upload for files > 5MB)
                $encryptedSize = filesize($encryptedPath);
                $driveName = Str::random(32) . '.enc';

                if ($encryptedSize > 5 * 1024 * 1024) {
                    $driveFileId = $this->driveService->uploadLarge($encryptedPath, $driveName);
                } else {
                    $driveFileId = $this->driveService->upload($encryptedPath, $driveName);
                }

                // Clean up encrypted temp file and raw temp file
                @unlink($encryptedPath);
                @unlink($tempPath);
                $tempPath = null;

                // Create media record
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

                $uploaded[] = $media;

            } catch (\Throwable $e) {
                if ($tempPath && file_exists($tempPath)) {
                    @unlink($tempPath);
                }
                Log::error('Media upload failed', [
                    'file' => $originalName ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
                $errors[] = ($originalName ?? 'unknown') . ': ' . $e->getMessage();
            }
        }

        if ($request->ajax() || $request->wantsJson()) {
            return response()->json([
                'success' => count($uploaded),
                'errors' => $errors,
                'media' => $uploaded,
            ]);
        }

        $message = count($uploaded) . ' file(s) uploaded successfully.';
        if (!empty($errors)) {
            $message .= ' ' . count($errors) . ' file(s) failed.';
        }

        return redirect()->route('admin.media.index')
            ->with('success', $message)
            ->with('errors', $errors);
    }

    /**
     * Stream media file (with HTTP Range support for video seeking).
     */
    public function stream(Media $media)
    {
        $this->authorizeMediaAccess();

        // Check if file is cached
        $cachedPath = $this->cacheService->getCachedPath($media);

        if (!$cachedPath) {
            // Download from Drive and decrypt
            $tempEncrypted = tempnam(sys_get_temp_dir(), 'drv_');

            try {
                $this->driveService->download($media->drive_file_id, $tempEncrypted);
                $decryptedPath = $this->encryptionService->decryptFile($tempEncrypted);
                @unlink($tempEncrypted);

                // Cache the decrypted file
                $cachedPath = $this->cacheService->cacheFile($media, $decryptedPath);
            } catch (\Exception $e) {
                @unlink($tempEncrypted);
                Log::error('Media stream failed', [
                    'media_id' => $media->id,
                    'error' => $e->getMessage(),
                ]);
                abort(500, 'Failed to load media');
            }
        }

        // Serve with HTTP Range support for smooth video streaming
        return $this->serveFileWithRangeSupport($cachedPath, $media->mime_type, $media->original_filename);
    }

    /**
     * Download decrypted original media file.
     */
    public function download(Media $media)
    {
        $this->authorizeMediaAccess();

        $cachedPath = $this->cacheService->getCachedPath($media);

        if (!$cachedPath) {
            $tempEncrypted = tempnam(sys_get_temp_dir(), 'drv_');

            try {
                $this->driveService->download($media->drive_file_id, $tempEncrypted);
                $decryptedPath = $this->encryptionService->decryptFile($tempEncrypted);
                @unlink($tempEncrypted);

                $cachedPath = $this->cacheService->cacheFile($media, $decryptedPath);
            } catch (\Exception $e) {
                @unlink($tempEncrypted);
                Log::error('Media download failed', [
                    'media_id' => $media->id,
                    'error' => $e->getMessage(),
                ]);
                abort(500, 'Gagal mengunduh file media: ' . $e->getMessage());
            }
        }

        $filename = $media->original_filename ?: ($media->title . ($media->isVideo() ? '.mp4' : '.jpg'));

        return response()->download($cachedPath, $filename, [
            'Content-Type' => $media->mime_type,
        ]);
    }

    /**
     * Serve thumbnail image.
     */
    public function thumbnail(Media $media)
    {
        $this->authorizeMediaAccess();

        // Check thumb cache
        $thumbPath = $this->cacheService->getThumbPath($media);

        if (!$this->cacheService->hasThumb($media)) {
            if ($media->thumb_drive_id) {
                // Download thumbnail from Drive
                try {
                    $tempEncrypted = tempnam(sys_get_temp_dir(), 'thb_');
                    $this->driveService->download($media->thumb_drive_id, $tempEncrypted);
                    $decryptedPath = $this->encryptionService->decryptFile($tempEncrypted);
                    @unlink($tempEncrypted);

                    // Cache thumbnail
                    $dir = dirname($thumbPath);
                    if (!is_dir($dir)) {
                        mkdir($dir, 0755, true);
                    }
                    copy($decryptedPath, $thumbPath);
                    @unlink($decryptedPath);
                } catch (\Exception $e) {
                    @unlink($tempEncrypted ?? '');
                    return $this->placeholderResponse($media);
                }
            } elseif ($media->isVideo()) {
                // Try generating thumbnail from cached video using ffmpeg
                $cachedPath = $this->cacheService->getCachedPath($media);
                if ($cachedPath && file_exists($cachedPath)) {
                    $dir = dirname($thumbPath);
                    if (!is_dir($dir)) {
                        mkdir($dir, 0755, true);
                    }
                    $cmd = sprintf('ffmpeg -y -ss 00:00:01 -i %s -vframes 1 -q:v 2 %s 2>&1', escapeshellarg($cachedPath), escapeshellarg($thumbPath));
                    @exec($cmd);
                }
                // If ffmpeg was unavailable or produced no file, generate sleek dark GD thumbnail
                if (!file_exists($thumbPath) || filesize($thumbPath) === 0) {
                    $ext = strtoupper(pathinfo($media->original_filename ?: 'MP4', PATHINFO_EXTENSION) ?: 'MP4');
                    $this->createVideoPlaceholderGd($thumbPath, $media->title ?: 'Video', $ext);
                }
            } else {
                // Generate thumbnail from original image
                $cachedPath = $this->cacheService->getCachedPath($media);
                if (!$cachedPath) {
                    // Need to download and decrypt first
                    $tempEncrypted = tempnam(sys_get_temp_dir(), 'drv_');
                    try {
                        $this->driveService->download($media->drive_file_id, $tempEncrypted);
                        $decryptedPath = $this->encryptionService->decryptFile($tempEncrypted);
                        @unlink($tempEncrypted);
                        $cachedPath = $this->cacheService->cacheFile($media, $decryptedPath);
                    } catch (\Exception $e) {
                        @unlink($tempEncrypted);
                        return $this->placeholderResponse($media);
                    }
                }

                try {
                    $this->createThumbnailFromImage($cachedPath, $thumbPath);
                } catch (\Exception $e) {
                    $ext = strtoupper(pathinfo($media->original_filename ?: 'JPG', PATHINFO_EXTENSION) ?: 'JPG');
                    $this->createImagePlaceholderGd($thumbPath, $media->title ?: 'Foto', $ext);
                }
            }
        }

        if (file_exists($thumbPath) && filesize($thumbPath) > 0) {
            return response()->file($thumbPath, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        return $this->placeholderResponse($media);
    }

    /**
     * Admin: Delete media
     */
    public function destroy(Media $media)
    {
        try {
            // Delete from Drive (best effort - prevent blocking deletion if file already deleted from Drive)
            try {
                if ($media->drive_file_id) {
                    $this->driveService->delete($media->drive_file_id);
                }
                if ($media->thumb_drive_id) {
                    $this->driveService->delete($media->thumb_drive_id);
                }
            } catch (\Exception $driveEx) {
                Log::warning('Drive file deletion skipped or failed: ' . $driveEx->getMessage(), [
                    'media_id' => $media->id,
                ]);
            }

            // Remove from local cache
            $this->cacheService->removeCached($media);

            // Delete from database
            $media->delete();

            if (request()->ajax() || request()->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Media berhasil dihapus.',
                ]);
            }

            return redirect()->back()
                ->with('success', 'Media berhasil dihapus.');
        } catch (\Exception $e) {
            Log::error('Media delete failed', [
                'media_id' => $media->id,
                'error' => $e->getMessage(),
            ]);

            if (request()->ajax() || request()->wantsJson()) {
                return response()->json(['error' => 'Gagal menghapus media: ' . $e->getMessage()], 500);
            }

            return back()->with('error', 'Gagal menghapus media: ' . $e->getMessage());
        }
    }

    /**
     * Admin: Batch delete multiple media items
     */
    public function batchDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:media,id',
        ]);

        $deletedCount = 0;
        foreach ($validated['ids'] as $id) {
            $media = Media::find($id);
            if ($media) {
                try {
                    if ($media->drive_file_id) {
                        $this->driveService->delete($media->drive_file_id);
                    }
                    if ($media->thumb_drive_id) {
                        $this->driveService->delete($media->thumb_drive_id);
                    }
                } catch (\Exception $e) {
                    Log::warning("Drive batch delete skipped for media {$id}: " . $e->getMessage());
                }

                $this->cacheService->removeCached($media);
                $media->delete();
                $deletedCount++;
            }
        }

        if (request()->ajax() || request()->wantsJson()) {
            return response()->json([
                'success' => true,
                'deleted' => $deletedCount,
                'message' => "{$deletedCount} media berhasil dihapus.",
            ]);
        }

        return redirect()->back()->with('success', "{$deletedCount} media berhasil dihapus.");
    }

    /**
     * Admin: Update media info
     */
    public function update(Request $request, Media $media)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'album_id' => 'nullable|exists:albums,id',
        ]);

        $media->update($request->only('title', 'description', 'album_id'));

        if ($request->ajax()) {
            return response()->json(['success' => true, 'media' => $media]);
        }

        return back()->with('success', 'Media updated successfully.');
    }

    /**
     * Move media (single or batch) to an album.
     */
    public function moveAlbum(Request $request)
    {
        $request->validate([
            'media_id' => 'nullable|integer|exists:media,id',
            'media_ids' => 'nullable|array',
            'media_ids.*' => 'integer|exists:media,id',
            'album_id' => 'nullable',
            'new_album_name' => 'nullable|string|max:255',
        ]);

        $ids = $request->filled('media_ids') ? (array)$request->media_ids : ($request->filled('media_id') ? [$request->media_id] : []);
        if (empty($ids)) {
            return response()->json(['error' => 'Tidak ada media yang dipilih.'], 422);
        }

        $albumId = $request->album_id;
        $targetAlbumName = 'Tanpa Album';

        if ($request->filled('new_album_name')) {
            $newAlbum = Album::create([
                'name' => trim($request->new_album_name),
                'slug' => Str::slug(trim($request->new_album_name)) . '-' . Str::random(5),
            ]);
            $albumId = $newAlbum->id;
            $targetAlbumName = $newAlbum->name;
        } elseif ($albumId && $albumId !== 'none' && $albumId != '0') {
            $album = Album::find($albumId);
            if ($album) {
                $albumId = $album->id;
                $targetAlbumName = $album->name;
            } else {
                $albumId = null;
            }
        } else {
            $albumId = null;
        }

        Media::whereIn('id', $ids)->update(['album_id' => $albumId]);

        $count = count($ids);
        $msg = "{$count} media berhasil dipindahkan ke \"{$targetAlbumName}\".";

        if ($request->ajax() || $request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $msg,
                'album_id' => $albumId,
                'album_name' => $targetAlbumName,
                'count' => $count,
            ]);
        }

        return redirect()->back()->with('success', $msg);
    }

    /**
     * Copy / duplicate media (single or batch) to an album.
     */
    public function copyAlbum(Request $request)
    {
        $request->validate([
            'media_id' => 'nullable|integer|exists:media,id',
            'media_ids' => 'nullable|array',
            'media_ids.*' => 'integer|exists:media,id',
            'album_id' => 'nullable',
            'new_album_name' => 'nullable|string|max:255',
        ]);

        $ids = $request->filled('media_ids') ? (array)$request->media_ids : ($request->filled('media_id') ? [$request->media_id] : []);
        if (empty($ids)) {
            return response()->json(['error' => 'Tidak ada media yang dipilih.'], 422);
        }

        $albumId = $request->album_id;
        $targetAlbumName = 'Tanpa Album';

        if ($request->filled('new_album_name')) {
            $newAlbum = Album::create([
                'name' => trim($request->new_album_name),
                'slug' => Str::slug(trim($request->new_album_name)) . '-' . Str::random(5),
            ]);
            $albumId = $newAlbum->id;
            $targetAlbumName = $newAlbum->name;
        } elseif ($albumId && $albumId !== 'none' && $albumId != '0') {
            $album = Album::find($albumId);
            if ($album) {
                $albumId = $album->id;
                $targetAlbumName = $album->name;
            } else {
                $albumId = null;
            }
        } else {
            $albumId = null;
        }

        $items = Media::whereIn('id', $ids)->get();
        $cloned = 0;

        foreach ($items as $item) {
            $newItem = $item->replicate();
            $newItem->album_id = $albumId;
            $newItem->cache_key = Str::random(40);
            if ($item->album_id == $albumId) {
                $newItem->title = $item->title . ' (Salinan)';
            }
            $newItem->save();
            $cloned++;
        }

        $msg = "{$cloned} media berhasil disalin ke \"{$targetAlbumName}\".";

        if ($request->ajax() || $request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $msg,
                'album_id' => $albumId,
                'album_name' => $targetAlbumName,
                'count' => $cloned,
            ]);
        }

        return redirect()->back()->with('success', $msg);
    }

    /**
     * Toggle favorite status on a media item.
     */
    public function toggleFavorite(Media $media)
    {
        $media->is_favorite = !$media->is_favorite;
        $media->save();

        $msg = $media->is_favorite ? 'Ditambahkan ke Favorit ❤️' : 'Dihapus dari Favorit';

        if (request()->ajax() || request()->wantsJson()) {
            return response()->json([
                'success' => true,
                'is_favorite' => (bool)$media->is_favorite,
                'message' => $msg,
            ]);
        }

        return redirect()->back()->with('success', $msg);
    }

    /**
     * Quick rename title and description of a media item.
     */
    public function quickRename(Request $request, Media $media)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $media->update($validated);

        if ($request->ajax() || $request->wantsJson()) {
            return response()->json([
                'success' => true,
                'media' => [
                    'id' => $media->id,
                    'title' => $media->title,
                    'description' => $media->description,
                ],
                'message' => 'Judul media berhasil diperbarui.',
            ]);
        }

        return redirect()->back()->with('success', 'Judul media berhasil diperbarui.');
    }

    /**
     * Return list of all albums for modal selectors.
     */
    public function albumsList()
    {
        $albums = Album::select('id', 'name', 'slug')->withCount('media')->orderBy('name')->get();
        return response()->json([
            'albums' => $albums,
        ]);
    }

    /**
     * Serve file with HTTP Range headers for smooth video streaming.
     * This is what makes video playback smooth like YouTube.
     */
    private function serveFileWithRangeSupport(string $filePath, string $mimeType, string $fileName): Response|BinaryFileResponse|StreamedResponse
    {
        $fileSize = filesize($filePath);
        $request = request();

        // Check for Range header
        $range = $request->header('Range');

        if ($range) {
            // Parse range header
            preg_match('/bytes=(\d+)-(\d*)/', $range, $matches);
            $start = (int)$matches[1];
            $end = !empty($matches[2]) ? (int)$matches[2] : $fileSize - 1;

            if ($start > $end || $start >= $fileSize) {
                return response('', 416, [
                    'Content-Range' => "bytes */$fileSize",
                ]);
            }

            $length = $end - $start + 1;

            $response = new StreamedResponse(function () use ($filePath, $start, $length) {
                $handle = fopen($filePath, 'rb');
                fseek($handle, $start);
                $remaining = $length;
                $bufferSize = 8192;

                while ($remaining > 0 && !feof($handle)) {
                    $readSize = min($bufferSize, $remaining);
                    echo fread($handle, $readSize);
                    $remaining -= $readSize;
                    flush();
                }

                fclose($handle);
            }, 206);

            $response->headers->set('Content-Type', $mimeType);
            $response->headers->set('Content-Length', $length);
            $response->headers->set('Content-Range', "bytes $start-$end/$fileSize");
            $response->headers->set('Accept-Ranges', 'bytes');
            $response->headers->set('Cache-Control', 'public, max-age=3600');

            return $response;
        }

        // No range request — serve full file
        return response()->file($filePath, [
            'Content-Type' => $mimeType,
            'Content-Length' => $fileSize,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'public, max-age=3600',
            'Content-Disposition' => 'inline; filename="' . $fileName . '"',
        ]);
    }

    /**
     * Generate thumbnail for image and upload it to Drive (encrypted).
     */
    public function generateAndUploadThumbnail(string $imagePath, string $mimeType): ?string
    {
        if (empty($imagePath) || !file_exists($imagePath)) {
            return null;
        }

        $thumbPath = null;
        $encryptedThumb = null;

        try {
            $tempDir = storage_path('app/temp_uploads');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            $thumbPath = $tempDir . DIRECTORY_SEPARATOR . 'thumb_' . Str::random(32) . '.jpg';

            // Use GD library to create thumbnail
            $this->createThumbnailFromImage($imagePath, $thumbPath, 400, 400);

            if (!file_exists($thumbPath)) {
                return null;
            }

            // Encrypt thumbnail
            $encryptedThumb = $this->encryptionService->encryptFile($thumbPath);
            @unlink($thumbPath);
            $thumbPath = null;

            // Upload to Drive
            $thumbDriveId = $this->driveService->upload(
                $encryptedThumb,
                'thumb_' . Str::random(32) . '.enc'
            );
            @unlink($encryptedThumb);
            $encryptedThumb = null;

            return $thumbDriveId;
        } catch (\Throwable $e) {
            if ($thumbPath && file_exists($thumbPath)) {
                @unlink($thumbPath);
            }
            if ($encryptedThumb && file_exists($encryptedThumb)) {
                @unlink($encryptedThumb);
            }
            Log::warning('Thumbnail generation failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Generate thumbnail for video and upload it to Drive (encrypted).
     */
    public function generateAndUploadVideoThumbnail(string $videoPath, string $title = 'Video', string $format = 'MP4'): ?string
    {
        if (empty($videoPath) || !file_exists($videoPath)) {
            return null;
        }

        $thumbPath = null;
        $encryptedThumb = null;

        try {
            $tempDir = storage_path('app/temp_uploads');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            $thumbPath = $tempDir . DIRECTORY_SEPARATOR . 'thumb_' . Str::random(32) . '.jpg';

            // 1. Try ffmpeg if available
            $cmd = sprintf('ffmpeg -y -ss 00:00:01 -i %s -vframes 1 -q:v 2 %s 2>&1', escapeshellarg($videoPath), escapeshellarg($thumbPath));
            @exec($cmd);

            // 2. Fallback to sleek dark GD video thumbnail
            if (!file_exists($thumbPath) || filesize($thumbPath) === 0) {
                $this->createVideoPlaceholderGd($thumbPath, $title, $format);
            }

            if (!file_exists($thumbPath) || filesize($thumbPath) === 0) {
                return null;
            }

            // Encrypt thumbnail
            $encryptedThumb = $this->encryptionService->encryptFile($thumbPath);
            @unlink($thumbPath);
            $thumbPath = null;

            // Upload to Drive
            $thumbDriveId = $this->driveService->upload(
                $encryptedThumb,
                'thumb_' . Str::random(32) . '.enc'
            );
            @unlink($encryptedThumb);
            $encryptedThumb = null;

            return $thumbDriveId;
        } catch (\Throwable $e) {
            if ($thumbPath && file_exists($thumbPath)) {
                @unlink($thumbPath);
            }
            if ($encryptedThumb && file_exists($encryptedThumb)) {
                @unlink($encryptedThumb);
            }
            Log::warning('Video thumbnail generation failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Create a thumbnail using GD.
     */
    public function createThumbnailFromImage(string $source, string $destination, int $maxWidth = 400, int $maxHeight = 400): void
    {
        if (empty($source) || !file_exists($source)) {
            throw new \RuntimeException('Source image file not found: ' . $source);
        }

        $dir = dirname($destination);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $info = @getimagesize($source);
        if (!$info) {
            throw new \RuntimeException('Cannot read image info from ' . $source);
        }

        [$origWidth, $origHeight, $type] = $info;

        // Calculate thumbnail dimensions maintaining aspect ratio
        $ratio = min($maxWidth / $origWidth, $maxHeight / $origHeight);
        $newWidth = (int)($origWidth * $ratio);
        $newHeight = (int)($origHeight * $ratio);

        // Create source image resource
        $sourceImage = match ($type) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($source),
            IMAGETYPE_PNG => imagecreatefrompng($source),
            IMAGETYPE_GIF => imagecreatefromgif($source),
            IMAGETYPE_WEBP => imagecreatefromwebp($source),
            default => throw new \RuntimeException('Unsupported image type'),
        };

        $thumb = imagecreatetruecolor($newWidth, $newHeight);

        // Preserve transparency for PNG/GIF
        if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_GIF) {
            imagealphablending($thumb, false);
            imagesavealpha($thumb, true);
        }

        imagecopyresampled($thumb, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);

        // Save as JPEG
        imagejpeg($thumb, $destination, 85);

        imagedestroy($sourceImage);
        imagedestroy($thumb);
    }

    /**
     * Generate a dark Apple-style video thumbnail using GD.
     */
    public function createVideoPlaceholderGd(string $destination, string $title, string $format = 'MP4', int $width = 480, int $height = 480): void
    {
        $img = imagecreatetruecolor($width, $height);
        imageantialias($img, true);

        // Dark gradient background
        for ($y = 0; $y < $height; $y++) {
            $ratio = $y / $height;
            $r = (int)(15 + (8 - 15) * $ratio);
            $g = (int)(18 + (10 - 18) * $ratio);
            $b = (int)(25 + (16 - 25) * $ratio);
            $lineColor = imagecolorallocate($img, $r, $g, $b);
            imageline($img, 0, $y, $width, $y, $lineColor);
        }

        // Subtle borders
        $borderCol = imagecolorallocatealpha($img, 255, 255, 255, 110);
        imageline($img, 0, 0, $width, 0, $borderCol);
        imageline($img, 0, $height - 1, $width, $height - 1, $borderCol);

        // Glowing cyan/blue concentric aura
        $cx = (int)($width / 2);
        $cy = (int)($height / 2) - 15;
        for ($radius = 65; $radius >= 35; $radius -= 2) {
            $alpha = (int)(115 + (127 - 115) * (($radius - 35) / 30));
            $glowCol = imagecolorallocatealpha($img, 10, 132, 255, $alpha);
            imagefilledellipse($img, $cx, $cy, $radius * 2, $radius * 2, $glowCol);
        }

        // Frosted glass circle behind play icon
        $glassCol = imagecolorallocatealpha($img, 24, 24, 30, 25);
        imagefilledellipse($img, $cx, $cy, 80, 80, $glassCol);
        $circleBorder = imagecolorallocatealpha($img, 255, 255, 255, 65);
        imageellipse($img, $cx, $cy, 80, 80, $circleBorder);

        // Bright play triangle
        $white = imagecolorallocate($img, 255, 255, 255);
        $trianglePoints = [
            $cx - 10, $cy - 16,
            $cx + 18, $cy,
            $cx - 10, $cy + 16,
        ];
        imagefilledpolygon($img, $trianglePoints, $white);

        // Format badge
        $badgeW = 54;
        $badgeH = 24;
        $badgeX = $width - $badgeW - 16;
        $badgeY = $height - $badgeH - 16;
        $badgeBg = imagecolorallocatealpha($img, 0, 0, 0, 50);
        imagefilledrectangle($img, $badgeX, $badgeY, $badgeX + $badgeW, $badgeY + $badgeH, $badgeBg);
        $badgeBorder = imagecolorallocatealpha($img, 255, 255, 255, 80);
        imagerectangle($img, $badgeX, $badgeY, $badgeX + $badgeW, $badgeY + $badgeH, $badgeBorder);

        $badgeText = strtoupper(substr($format ?: 'MP4', 0, 4));
        imagestring($img, 3, $badgeX + 12, $badgeY + 5, $badgeText, $white);

        // Video title
        $cleanTitle = mb_strimwidth($title ?: 'Video', 0, 24, '...');
        $titleCol = imagecolorallocate($img, 220, 225, 235);
        imagestring($img, 4, 18, $height - 32, $cleanTitle, $titleCol);

        $dir = dirname($destination);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        imagejpeg($img, $destination, 90);
        imagedestroy($img);
    }

    /**
     * Generate a dark Apple-style image thumbnail placeholder using GD.
     */
    public function createImagePlaceholderGd(string $destination, string $title, string $format = 'JPG', int $width = 480, int $height = 480): void
    {
        $img = imagecreatetruecolor($width, $height);
        imageantialias($img, true);

        // Dark gradient
        for ($y = 0; $y < $height; $y++) {
            $ratio = $y / $height;
            $r = (int)(20 + (10 - 20) * $ratio);
            $g = (int)(20 + (10 - 20) * $ratio);
            $b = (int)(28 + (15 - 28) * $ratio);
            $lineColor = imagecolorallocate($img, $r, $g, $b);
            imageline($img, 0, $y, $width, $y, $lineColor);
        }

        $cx = (int)($width / 2);
        $cy = (int)($height / 2) - 15;

        // Image frame icon
        $dimWhite = imagecolorallocatealpha($img, 255, 255, 255, 60);
        imagerectangle($img, $cx - 36, $cy - 28, $cx + 36, $cy + 28, $dimWhite);
        imagefilledellipse($img, $cx - 16, $cy - 12, 10, 10, $dimWhite);

        // Mountain peak
        $pts = [
            $cx - 36, $cy + 28,
            $cx - 10, $cy - 4,
            $cx + 8, $cy + 14,
            $cx + 20, $cy + 2,
            $cx + 36, $cy + 28,
        ];
        imagefilledpolygon($img, $pts, $dimWhite);

        // Title
        $cleanTitle = mb_strimwidth($title ?: 'Foto', 0, 24, '...');
        $titleCol = imagecolorallocate($img, 200, 205, 215);
        imagestring($img, 4, 18, $height - 32, $cleanTitle, $titleCol);

        $dir = dirname($destination);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        imagejpeg($img, $destination, 85);
        imagedestroy($img);
    }

    /**
     * Return a placeholder JPEG image response (GD-generated) and cache it.
     */
    private function placeholderResponse(Media $media): Response|BinaryFileResponse
    {
        $thumbPath = $this->cacheService->getThumbPath($media);
        if (file_exists($thumbPath) && filesize($thumbPath) > 0) {
            return response()->file($thumbPath, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        $dir = dirname($thumbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $isVideo = $media->isVideo();
        $ext = strtoupper(pathinfo($media->original_filename ?: ($isVideo ? 'MP4' : 'JPG'), PATHINFO_EXTENSION) ?: ($isVideo ? 'MP4' : 'JPG'));

        if ($isVideo) {
            $this->createVideoPlaceholderGd($thumbPath, $media->title ?: 'Video', $ext);
        } else {
            $this->createImagePlaceholderGd($thumbPath, $media->title ?: 'Foto', $ext);
        }

        if (file_exists($thumbPath) && filesize($thumbPath) > 0) {
            return response()->file($thumbPath, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        return response('', 404);
    }

    /**
     * Ensure request is authorized via Web session or API Personal Access Token.
     */
    private function authorizeMediaAccess(): void
    {
        if (\Illuminate\Support\Facades\Auth::check()) {
            return;
        }

        $token = request()->bearerToken() ?: request()->query('token') ?: request()->query('api_token');
        if ($token) {
            $tokenRecord = \App\Models\PersonalAccessToken::findToken($token);
            if ($tokenRecord && (!$tokenRecord->expires_at || $tokenRecord->expires_at->isFuture())) {
                $user = $tokenRecord->tokenable;
                if ($user) {
                    \Illuminate\Support\Facades\Auth::setUser($user);
                    return;
                }
            }
            abort(401, 'Unauthenticated.');
        }

        if (request()->wantsJson() || request()->is('api/*')) {
            abort(401, 'Unauthenticated.');
        }

        throw new \Illuminate\Http\Exceptions\HttpResponseException(redirect()->guest(route('login')));
    }
}
