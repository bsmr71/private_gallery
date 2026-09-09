<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Album;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AlbumApiController extends Controller
{
    /**
     * Get list of albums with cover photo and item counts.
     */
    public function index(): JsonResponse
    {
        $albums = Album::withCount('media')
            ->orderBy('name')
            ->get()
            ->map(function ($album) {
                return [
                    'id' => $album->id,
                    'name' => $album->name,
                    'slug' => $album->slug,
                    'description' => $album->description,
                    'media_count' => $album->media_count,
                    'cover_url' => $album->getCoverThumbnailUrl(),
                    'created_at' => $album->created_at ? $album->created_at->toIso8601String() : null,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $albums,
        ]);
    }

    /**
     * Create a new album.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $baseSlug = Str::slug($request->name);
        $slug = $baseSlug;
        $counter = 1;
        while (Album::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $album = Album::create([
            'name' => trim($request->name),
            'slug' => $slug,
            'description' => $request->description,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Album berhasil dibuat.',
            'data' => [
                'id' => $album->id,
                'name' => $album->name,
                'slug' => $album->slug,
                'description' => $album->description,
                'media_count' => 0,
                'cover_url' => null,
            ],
        ], 201);
    }

    /**
     * Update existing album.
     */
    public function update(Request $request, Album $album): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $album->update([
            'name' => trim($request->name),
            'description' => $request->description,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Album berhasil diperbarui.',
            'data' => [
                'id' => $album->id,
                'name' => $album->name,
                'slug' => $album->slug,
                'description' => $album->description,
            ],
        ]);
    }

    /**
     * Delete an album.
     */
    public function destroy(Album $album): JsonResponse
    {
        // Unset album_id on associated media items
        $album->media()->update(['album_id' => null]);
        $album->delete();

        return response()->json([
            'success' => true,
            'message' => 'Album berhasil dihapus.',
        ]);
    }
}
