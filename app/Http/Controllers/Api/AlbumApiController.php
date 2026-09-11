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
    public function index(Request $request): JsonResponse
    {
        $token = $request->attributes->get('plain_api_token') ?: $request->bearerToken() ?: $request->query('token');
        $tokenParam = $request->bearerToken() ? '?token=' . urlencode($request->bearerToken()) : '';
        $baseApiUrl = rtrim($request->getSchemeAndHttpHost(), '/') . '/api';

        $hasLockedMedia = false;
        try {
            \Illuminate\Support\Facades\DB::select("SELECT `is_locked` FROM `media` LIMIT 0");
            $hasLockedMedia = true;
        } catch (\Throwable $e) {
            $hasLockedMedia = false;
        }

        $hasLockedAlbums = false;
        try {
            \Illuminate\Support\Facades\DB::select("SELECT `is_locked` FROM `albums` LIMIT 0");
            $hasLockedAlbums = true;
        } catch (\Throwable $e) {
            $hasLockedAlbums = false;
        }

        $albumsQuery = Album::query();
        if ($hasLockedAlbums) {
            try {
                $albumsQuery->where('is_locked', false);
            } catch (\Throwable $e) {}
        }

        $albums = $albumsQuery->withCount(['media' => function ($q) use ($hasLockedMedia) {
                if ($hasLockedMedia) {
                    try {
                        $q->where('is_locked', false);
                    } catch (\Throwable $e) {}
                }
            }])
            ->orderBy('name')
            ->get()
            ->map(function ($album) use ($baseApiUrl, $tokenParam) {
                $coverId = $album->cover_media_id ?: $album->media()->latest()->value('id');
                $coverUrl = $coverId ? "{$baseApiUrl}/media/{$coverId}/thumbnail{$tokenParam}" : null;

                return [
                    'id' => $album->id,
                    'name' => $album->name,
                    'slug' => $album->slug,
                    'description' => $album->description,
                    'media_count' => $album->media_count,
                    'cover_url' => $coverUrl,
                    'download_url' => "{$baseApiUrl}/albums/{$album->id}/download{$tokenParam}",
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

    /**
     * Download an entire album as a ZIP file via API.
     */
    public function download(Request $request, Album $album, \App\Http\Controllers\AlbumController $albumController)
    {
        return $albumController->download($request, $album);
    }
}
