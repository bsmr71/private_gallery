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

                // Generate thumbnail for images
                $thumbDriveId = null;
                if ($type === 'image') {
                    $thumbDriveId = $this->generateAndUploadThumbnail($tempPath, $mimeType);
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
                    // Return a placeholder
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
                    if (file_exists($thumbPath) && filesize($thumbPath) > 0) {
                        return response()->file($thumbPath, [
                            'Content-Type' => 'image/jpeg',
                            'Cache-Control' => 'public, max-age=86400',
                        ]);
                    }
                }
                return $this->placeholderResponse($media);
            } else {
                // Generate thumbnail from original
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

                $this->createThumbnailFromImage($cachedPath, $thumbPath);
            }
        }

        if (file_exists($thumbPath)) {
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
            // Delete from Drive
            $this->driveService->delete($media->drive_file_id);

            if ($media->thumb_drive_id) {
                $this->driveService->delete($media->thumb_drive_id);
            }

            // Remove from cache
            $this->cacheService->removeCached($media);

            // Delete from database
            $media->delete();

            if (request()->ajax()) {
                return response()->json(['success' => true]);
            }

            return redirect()->route('admin.media.index')
                ->with('success', 'Media deleted successfully.');
        } catch (\Exception $e) {
            Log::error('Media delete failed', [
                'media_id' => $media->id,
                'error' => $e->getMessage(),
            ]);

            if (request()->ajax()) {
                return response()->json(['error' => $e->getMessage()], 500);
            }

            return back()->with('error', 'Failed to delete media: ' . $e->getMessage());
        }
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
     * Generate thumbnail and upload it to Drive (encrypted).
     */
    private function generateAndUploadThumbnail(string $imagePath, string $mimeType): ?string
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
     * Create a thumbnail using GD.
     */
    private function createThumbnailFromImage(string $source, string $destination, int $maxWidth = 400, int $maxHeight = 400): void
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
     * Return a placeholder image response.
     */
    private function placeholderResponse(Media $media): Response
    {
        $isVideo = $media->isVideo();
        $title = htmlspecialchars(mb_strimwidth($media->title, 0, 32, '...'), ENT_QUOTES, 'UTF-8');
        $ext = strtoupper(pathinfo($media->original_filename ?: ($isVideo ? 'MP4' : 'IMG'), PATHINFO_EXTENSION) ?: ($isVideo ? 'MP4' : 'IMG'));
        $size = $media->formattedSize();

        $svg = <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#18181b"/>
                    <stop offset="100%" stop-color="#0e0e11"/>
                </linearGradient>
            </defs>
            <rect width="400" height="400" fill="url(#bgGrad)"/>
            <rect x="1" y="1" width="398" height="398" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
            
            <g transform="translate(200, 160)">
                <circle r="36" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
SVG;
        if ($isVideo) {
            $svg .= <<<SVG
                <polygon points="-6,-11 11,0 -6,11" fill="#e4e4e7"/>
            </g>
            <rect x="175" y="212" width="50" height="20" rx="4" fill="rgba(255,255,255,0.07)"/>
            <text x="200" y="226" text-anchor="middle" font-size="10" font-weight="700" fill="#a1a1aa" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" letter-spacing="1">{$ext}</text>
SVG;
        } else {
            $svg .= <<<SVG
                <rect x="-14" y="-10" width="28" height="20" rx="3" fill="none" stroke="#e4e4e7" stroke-width="1.8"/>
                <circle cx="-5" cy="-3" r="2" fill="#e4e4e7"/>
                <path d="M-12 6 L-4 -1 L4 6 L8 2 L12 6" fill="none" stroke="#e4e4e7" stroke-width="1.8" stroke-linejoin="round"/>
            </g>
            <rect x="175" y="212" width="50" height="20" rx="4" fill="rgba(255,255,255,0.07)"/>
            <text x="200" y="226" text-anchor="middle" font-size="10" font-weight="700" fill="#a1a1aa" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" letter-spacing="1">{$ext}</text>
SVG;
        }

        $svg .= <<<SVG
            <text x="200" y="260" text-anchor="middle" font-size="13" font-weight="500" fill="#e4e4e7" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">{$title}</text>
            <text x="200" y="280" text-anchor="middle" font-size="11" fill="#71717a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">{$size}</text>
        </svg>
        SVG;

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
