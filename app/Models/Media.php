<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Media extends Model
{
    protected $fillable = [
        'title',
        'description',
        'type',
        'mime_type',
        'original_filename',
        'size',
        'drive_file_id',
        'thumb_drive_id',
        'cache_key',
        'album_id',
        'sort_order',
    ];

    protected $casts = [
        'size' => 'integer',
        'sort_order' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($media) {
            if (empty($media->cache_key)) {
                $media->cache_key = Str::random(40);
            }
        });
    }

    public function album(): BelongsTo
    {
        return $this->belongsTo(Album::class);
    }

    public function isImage(): bool
    {
        return $this->type === 'image';
    }

    public function isVideo(): bool
    {
        return $this->type === 'video';
    }

    public function formattedSize(): string
    {
        $bytes = $this->size;
        $units = ['B', 'KB', 'MB', 'GB'];
        $index = 0;

        while ($bytes >= 1024 && $index < count($units) - 1) {
            $bytes /= 1024;
            $index++;
        }

        return round($bytes, 2) . ' ' . $units[$index];
    }

    public function streamUrl(): string
    {
        return route('media.stream', $this);
    }

    public function thumbnailUrl(): string
    {
        return route('media.thumbnail', $this);
    }

    public function downloadUrl(): string
    {
        return route('media.download', $this);
    }

    public function toLightboxData(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type,
            'mimeType' => $this->mime_type,
            'size' => $this->formattedSize(),
            'streamUrl' => $this->streamUrl(),
            'downloadUrl' => $this->downloadUrl(),
            'album' => $this->album ? $this->album->name : null,
            'created_at' => $this->created_at ? $this->created_at->format('d M Y') : null,
        ];
    }

    public static function formatBytes($bytes, $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));
        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
