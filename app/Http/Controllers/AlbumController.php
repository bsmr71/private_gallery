<?php

namespace App\Http\Controllers;

use App\Models\Album;
use App\Models\Media;
use App\Services\GoogleDriveService;
use App\Services\FileEncryptionService;
use App\Services\MediaCacheService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class AlbumController extends Controller
{
    /**
     * Download an entire album as a decrypted ZIP archive.
     */
    public function download(Request $request, Album $album)
    {
        $this->authorizeAlbumAccess();

        $mediaQuery = $album->media();
        try {
            $mediaQuery->where('is_locked', false);
        } catch (\Throwable $e) {}

        $mediaItems = $mediaQuery->get();

        if ($mediaItems->isEmpty()) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Album ini belum memiliki foto atau video untuk diunduh.',
                ], 404);
            }
            return redirect()->route('gallery.album', $album)->with('error', 'Album ini belum memiliki foto atau video untuk diunduh.');
        }

        $safeAlbumName = Str::slug($album->name, '_') ?: ('album_' . $album->id);
        $zipFilename = $safeAlbumName . '.zip';
        $tempDir = sys_get_temp_dir();
        $zipPath = $tempDir . DIRECTORY_SEPARATOR . 'album_' . $album->id . '_' . Str::random(12) . '.zip';

        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            abort(500, 'Gagal membuat arsip file zip.');
        }

        $driveService = app(GoogleDriveService::class);
        $encryptionService = app(FileEncryptionService::class);
        $cacheService = app(MediaCacheService::class);

        $usedNames = [];
        $addedCount = 0;

        foreach ($mediaItems as $media) {
            try {
                $cachedPath = $cacheService->getCachedPath($media);
                if (!$cachedPath || !file_exists($cachedPath)) {
                    if (!$media->drive_file_id) {
                        continue;
                    }
                    $tempEnc = tempnam($tempDir, 'drv_enc_');
                    $driveService->download($media->drive_file_id, $tempEnc);
                    $decPath = $encryptionService->decryptFile($tempEnc);
                    @unlink($tempEnc);
                    $cachedPath = $cacheService->cacheFile($media, $decPath);
                }

                if ($cachedPath && file_exists($cachedPath)) {
                    $ext = pathinfo($media->original_filename ?: '', PATHINFO_EXTENSION);
                    if (!$ext) {
                        $ext = $media->isVideo() ? 'mp4' : 'jpg';
                    }
                    $rawTitle = pathinfo($media->original_filename ?: $media->title, PATHINFO_FILENAME);
                    $cleanTitle = preg_replace('/[^\w\-\.]+/u', '_', trim($rawTitle)) ?: ('media_' . $media->id);
                    $entryName = $cleanTitle . '.' . $ext;

                    $counter = 1;
                    while (isset($usedNames[strtolower($entryName)])) {
                        $entryName = $cleanTitle . '_' . $counter . '.' . $ext;
                        $counter++;
                    }
                    $usedNames[strtolower($entryName)] = true;

                    $zip->addFile($cachedPath, $entryName);
                    $addedCount++;
                }
            } catch (\Throwable $e) {
                Log::warning("Gagal menambahkan media ID {$media->id} ke zip album: " . $e->getMessage());
            }
        }

        $zip->close();

        if ($addedCount === 0 || !file_exists($zipPath) || filesize($zipPath) === 0) {
            @unlink($zipPath);
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal mengunduh berkas dalam album ini.',
                ], 500);
            }
            return redirect()->route('gallery.album', $album)->with('error', 'Gagal memproses file media untuk diunduh.');
        }

        return response()->download($zipPath, $zipFilename, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => 'attachment; filename="' . $zipFilename . '"',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Ensure request is authorized via Web session or API Personal Access Token.
     */
    private function authorizeAlbumAccess(): void
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

    public function index()
    {
        $albums = Album::withCount('media')->orderBy('sort_order')->get();
        return view('admin.albums.index', compact('albums'));
    }

    public function create()
    {
        return view('admin.albums.form', ['album' => null]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $album = Album::create([
            'name' => $request->name,
            'description' => $request->description,
            'slug' => Str::slug($request->name),
        ]);

        return redirect()->route('admin.albums.index')
            ->with('success', 'Album "' . $album->name . '" created successfully.');
    }

    public function edit(Album $album)
    {
        return view('admin.albums.form', compact('album'));
    }

    public function update(Request $request, Album $album)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $album->update([
            'name' => $request->name,
            'description' => $request->description,
            'slug' => Str::slug($request->name),
        ]);

        return redirect()->route('admin.albums.index')
            ->with('success', 'Album updated successfully.');
    }

    public function destroy(Album $album)
    {
        // Media in this album will have album_id set to null (onDelete set null)
        $album->delete();

        if (request()->ajax()) {
            return response()->json(['success' => true]);
        }

        return redirect()->route('admin.albums.index')
            ->with('success', 'Album deleted successfully.');
    }
}
