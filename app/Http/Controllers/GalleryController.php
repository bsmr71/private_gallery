<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Models\Album;
use Illuminate\Http\Request;

class GalleryController extends Controller
{
    /**
     * Public gallery homepage — shows all media in a masonry grid.
     */
    public function index(Request $request)
    {
        $query = Media::with('album')->latest();

        if ($request->filled('album')) {
            $query->whereHas('album', function ($q) use ($request) {
                $q->where('slug', $request->album);
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('favorite') || $request->get('favorite') === '1') {
            $query->where('is_favorite', true);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        $media = $query->paginate(24);
        $albums = Album::withCount('media')->orderBy('sort_order')->get();

        $stats = [
            'total' => Media::count(),
            'images' => Media::where('type', 'image')->count(),
            'videos' => Media::where('type', 'video')->count(),
            'favorites' => Media::where('is_favorite', true)->count(),
            'albums' => $albums->count(),
            'size' => Media::formatBytes(Media::sum('size')),
        ];

        // For AJAX infinite scroll
        if ($request->ajax()) {
            return response()->json([
                'html' => view('gallery.partials.media-grid', compact('media'))->render(),
                'hasMore' => $media->hasMorePages(),
                'nextPage' => $media->currentPage() + 1,
            ]);
        }

        return view('gallery.index', compact('media', 'albums', 'stats'));
    }

    /**
     * Show all albums as visual gallery album cards (Apple / Google Photos style).
     */
    public function albums(Request $request)
    {
        $albums = Album::with(['media' => fn($q) => $q->latest()])
            ->withCount('media')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $dupCopies = (int)\Illuminate\Support\Facades\DB::table('media')
            ->select('size', 'original_filename', \Illuminate\Support\Facades\DB::raw('COUNT(*) - 1 as extra'))
            ->groupBy('size', 'original_filename')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->sum('extra');

        $stats = [
            'total' => Media::count(),
            'albums' => $albums->count(),
            'images' => Media::where('type', 'image')->count(),
            'videos' => Media::where('type', 'video')->count(),
            'favorites' => Media::where('is_favorite', true)->count(),
            'duplicates' => $dupCopies,
        ];

        return view('gallery.albums', compact('albums', 'stats'));
    }

    /**
     * Show a specific album.
     */
    public function album(Album $album)
    {
        $media = $album->media()->latest()->paginate(24);
        $albums = Album::withCount('media')->orderBy('sort_order')->get();

        $stats = [
            'total' => $album->media()->count(),
            'images' => $album->media()->where('type', 'image')->count(),
            'videos' => $album->media()->where('type', 'video')->count(),
            'albums' => $albums->count(),
        ];

        if (request()->ajax()) {
            return response()->json([
                'html' => view('gallery.partials.media-grid', compact('media'))->render(),
                'hasMore' => $media->hasMorePages(),
                'nextPage' => $media->currentPage() + 1,
            ]);
        }

        return view('gallery.index', compact('media', 'albums', 'album', 'stats'));
    }
}
