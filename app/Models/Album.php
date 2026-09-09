<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Album extends Model
{
    protected $fillable = [
        'name',
        'description',
        'slug',
        'cover_media_id',
        'is_locked',
        'sort_order',
    ];

    protected $casts = [
        'is_locked' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($album) {
            if (empty($album->slug)) {
                $album->slug = Str::slug($album->name);
                // Ensure unique slug
                $count = static::where('slug', 'like', $album->slug . '%')->count();
                if ($count > 0) {
                    $album->slug .= '-' . ($count + 1);
                }
            }
        });
    }

    public function media(): HasMany
    {
        return $this->hasMany(Media::class)->orderBy('sort_order');
    }

    public function coverMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function mediaCount(): int
    {
        return $this->media()->count();
    }

    public function getCoverThumbnailUrl(): ?string
    {
        if ($this->coverMedia) {
            return $this->coverMedia->thumbnailUrl();
        }
        $latest = $this->media()->latest()->first();
        if ($latest) {
            return $latest->thumbnailUrl();
        }
        return null;
    }
}
