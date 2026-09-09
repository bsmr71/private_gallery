<?php

namespace App\Services;

use App\Models\Media;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

/**
 * MediaCacheService
 *
 * Handles caching of decrypted media files for smooth streaming.
 * Cached files are stored locally and served with HTTP Range support
 * for buffer-free video playback (like YouTube).
 */
class MediaCacheService
{
    private string $cachePath;
    private int $maxCacheSize; // in bytes
    private int $cacheTtl; // in seconds

    public function __construct()
    {
        $this->cachePath = storage_path('app/media_cache');
        $this->maxCacheSize = (int)config('services.media_cache.max_size', 2 * 1024 * 1024 * 1024); // 2GB default
        $this->cacheTtl = (int)config('services.media_cache.ttl', 3600); // 1 hour default

        if (!is_dir($this->cachePath)) {
            mkdir($this->cachePath, 0755, true);
        }
    }

    /**
     * Get cached file path for a media item.
     * Returns null if not cached.
     */
    public function getCachedPath(Media $media): ?string
    {
        $filePath = $this->getFilePath($media);

        if (file_exists($filePath)) {
            // Check if cache is still valid
            if (time() - filemtime($filePath) < $this->cacheTtl) {
                // Touch the file to keep it fresh
                touch($filePath);
                return $filePath;
            }

            // Cache expired, remove it
            @unlink($filePath);
        }

        return null;
    }

    /**
     * Cache a decrypted file for a media item.
     *
     * @param Media $media The media model
     * @param string $decryptedPath Path to the decrypted file
     * @return string Path to the cached file
     */
    public function cacheFile(Media $media, string $decryptedPath): string
    {
        $this->enforceMaxCacheSize();

        $cachedPath = $this->getFilePath($media);
        $dir = dirname($cachedPath);

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Move the decrypted file to cache
        if (file_exists($decryptedPath)) {
            copy($decryptedPath, $cachedPath);
            @unlink($decryptedPath);
        }

        return $cachedPath;
    }

    /**
     * Remove cached file for a media item.
     */
    public function removeCached(Media $media): void
    {
        $filePath = $this->getFilePath($media);
        if (file_exists($filePath)) {
            @unlink($filePath);
        }

        // Also remove thumbnail cache
        $thumbPath = $this->getThumbPath($media);
        if (file_exists($thumbPath)) {
            @unlink($thumbPath);
        }
    }

    /**
     * Get or create thumbnail cache path.
     */
    public function getThumbPath(Media $media): string
    {
        return $this->cachePath . '/thumbs/' . $media->cache_key . '.jpg';
    }

    /**
     * Check if thumbnail is cached.
     */
    public function hasThumb(Media $media): bool
    {
        $path = $this->getThumbPath($media);
        return file_exists($path) && (time() - filemtime($path) < $this->cacheTtl * 24);
    }

    /**
     * Get total cache size in bytes.
     */
    public function getCacheSize(): int
    {
        $size = 0;
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->cachePath, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            $size += $file->getSize();
        }

        return $size;
    }

    /**
     * Clean up expired cache files.
     */
    public function cleanup(): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->cachePath, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && time() - $file->getMTime() > $this->cacheTtl) {
                @unlink($file->getPathname());
            }
        }

        Log::info('Media cache cleanup completed');
    }

    /**
     * Clear all cache.
     */
    public function clearAll(): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->cachePath, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isDir()) {
                @rmdir($file->getPathname());
            } else {
                @unlink($file->getPathname());
            }
        }
    }

    private function getFilePath(Media $media): string
    {
        $ext = $this->getExtension($media->mime_type);
        return $this->cachePath . '/' . $media->cache_key . '.' . $ext;
    }

    private function getExtension(string $mimeType): string
    {
        $map = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/svg+xml' => 'svg',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
            'video/x-msvideo' => 'avi',
            'video/x-matroska' => 'mkv',
        ];

        return $map[$mimeType] ?? 'bin';
    }

    /**
     * If cache exceeds max size, remove oldest files until within limit.
     */
    private function enforceMaxCacheSize(): void
    {
        $currentSize = $this->getCacheSize();

        if ($currentSize <= $this->maxCacheSize) {
            return;
        }

        // Collect all files with their modification times
        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->cachePath, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $files[] = [
                    'path' => $file->getPathname(),
                    'size' => $file->getSize(),
                    'mtime' => $file->getMTime(),
                ];
            }
        }

        // Sort by oldest first
        usort($files, fn($a, $b) => $a['mtime'] <=> $b['mtime']);

        // Remove oldest files until within limit
        foreach ($files as $file) {
            if ($currentSize <= $this->maxCacheSize * 0.8) { // Remove until 80% of max
                break;
            }
            @unlink($file['path']);
            $currentSize -= $file['size'];
        }
    }
}
