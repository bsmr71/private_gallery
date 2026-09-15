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
        'is_favorite',
        'is_locked',
        'sort_order',
    ];

    protected $casts = [
        'size' => 'integer',
        'is_favorite' => 'boolean',
        'is_locked' => 'boolean',
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
            'description' => $this->description,
            'type' => $this->type,
            'mimeType' => $this->mime_type,
            'original_filename' => $this->original_filename,
            'size' => $this->formattedSize(),
            'size_bytes' => $this->size,
            'is_favorite' => (bool)$this->is_favorite,
            'album_id' => $this->album_id,
            'album' => $this->album ? $this->album->name : null,
            'streamUrl' => $this->streamUrl(),
            'thumbnailUrl' => $this->thumbnailUrl(),
            'downloadUrl' => $this->downloadUrl(),
            'deleteUrl' => route('admin.media.destroy', $this),
            'favoriteUrl' => route('media.favorite', $this),
            'renameUrl' => route('media.quick-rename', $this),
            'created_at' => $this->created_at ? $this->created_at->format('d M Y, H:i') : null,
            'created_date' => $this->created_at ? $this->created_at->format('d M Y') : null,
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

    /**
     * Get duplicate media clusters.
     * Clusters are collections of Media items where count >= 2.
     *
     * @return \Illuminate\Support\Collection<int, \Illuminate\Support\Collection<int, Media>>
     */
    public static function getDuplicateClusters(): \Illuminate\Support\Collection
    {
        // 1. Find all sizes (grouped by type) that appear more than once (size > 0)
        $duplicateSizes = \Illuminate\Support\Facades\DB::table('media')
            ->select('size', 'type')
            ->where('size', '>', 0)
            ->groupBy('size', 'type')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        // 2. Find all drive_file_ids that appear more than once
        $duplicateDrives = \Illuminate\Support\Facades\DB::table('media')
            ->select('drive_file_id')
            ->whereNotNull('drive_file_id')
            ->where('drive_file_id', '!=', '')
            ->groupBy('drive_file_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicateSizes->isEmpty() && $duplicateDrives->isEmpty()) {
            return collect();
        }

        // 3. Query all candidate media items
        $query = static::with('album');
        $hasWhere = false;

        if ($duplicateSizes->isNotEmpty()) {
            $query->where(function ($q) use ($duplicateSizes) {
                foreach ($duplicateSizes as $ds) {
                    $q->orWhere(function ($sub) use ($ds) {
                        $sub->where('size', $ds->size)->where('type', $ds->type);
                    });
                }
            });
            $hasWhere = true;
        }

        if ($duplicateDrives->isNotEmpty()) {
            $driveIds = $duplicateDrives->pluck('drive_file_id')->filter()->values();
            if ($hasWhere) {
                $query->orWhereIn('drive_file_id', $driveIds);
            } else {
                $query->whereIn('drive_file_id', $driveIds);
            }
        }

        $allCandidates = $query->get();

        // 4. Cluster using Disjoint-Set Union (DSU)
        $parent = [];
        $find = function ($i) use (&$parent, &$find) {
            if (!isset($parent[$i])) {
                $parent[$i] = $i;
            }
            if ($parent[$i] !== $i) {
                $parent[$i] = $find($parent[$i]);
            }
            return $parent[$i];
        };
        $union = function ($i, $j) use (&$parent, &$find) {
            $rootI = $find($i);
            $rootJ = $find($j);
            if ($rootI !== $rootJ) {
                $parent[$rootI] = $rootJ;
            }
        };

        $bySizeType = [];
        $byDrive = [];

        foreach ($allCandidates as $item) {
            if ($item->size > 0) {
                $stKey = $item->type . '_' . $item->size;
                if (!isset($bySizeType[$stKey])) {
                    $bySizeType[$stKey] = $item->id;
                } else {
                    $union($item->id, $bySizeType[$stKey]);
                }
            }

            if (!empty($item->drive_file_id)) {
                $dKey = $item->drive_file_id;
                if (!isset($byDrive[$dKey])) {
                    $byDrive[$dKey] = $item->id;
                } else {
                    $union($item->id, $byDrive[$dKey]);
                }
            }
        }

        $clusters = [];
        foreach ($allCandidates as $item) {
            $root = $find($item->id);
            $clusters[$root][] = $item;
        }

        $result = collect();
        foreach ($clusters as $clusterItems) {
            if (count($clusterItems) >= 2) {
                // Sort within cluster:
                // 1. is_favorite DESC
                // 2. has album_id DESC
                // 3. created_at ASC
                $sorted = collect($clusterItems)->sort(function ($a, $b) {
                    if ($a->is_favorite !== $b->is_favorite) {
                        return $b->is_favorite <=> $a->is_favorite;
                    }
                    $aHasAlbum = !empty($a->album_id);
                    $bHasAlbum = !empty($b->album_id);
                    if ($aHasAlbum !== $bHasAlbum) {
                        return $bHasAlbum <=> $aHasAlbum;
                    }
                    return $a->created_at <=> $b->created_at;
                })->values();

                $result->push($sorted);
            }
        }

        return $result;
    }

    /**
     * Get total count of redundant duplicate copies across all clusters.
     */
    public static function getDuplicateCopiesCount(): int
    {
        $clusters = static::getDuplicateClusters();
        return (int)$clusters->sum(function ($cluster) {
            return max(0, $cluster->count() - 1);
        });
    }
}
