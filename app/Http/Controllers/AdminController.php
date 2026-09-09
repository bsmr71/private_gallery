<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Models\Album;
use App\Services\MediaCacheService;
use App\Services\GoogleDriveService;

class AdminController extends Controller
{
    public function dashboard(GoogleDriveService $driveService, MediaCacheService $cacheService)
    {
        $totalMedia = Media::count();
        $totalImages = Media::where('type', 'image')->count();
        $totalVideos = Media::where('type', 'video')->count();
        $totalAlbums = Album::count();
        $totalSize = Media::sum('size');
        $cacheSize = $cacheService->getCacheSize();
        $recentMedia = Media::latest()->take(8)->get();

        // Try to get Drive storage info
        $driveStorage = ['used' => 0, 'limit' => 0];
        try {
            $driveStorage = $driveService->getStorageInfo();
        } catch (\Exception $e) {
            // Ignore if Drive is not configured yet
        }

        return view('admin.dashboard', compact(
            'totalMedia',
            'totalImages',
            'totalVideos',
            'totalAlbums',
            'totalSize',
            'cacheSize',
            'recentMedia',
            'driveStorage',
        ));
    }
}
