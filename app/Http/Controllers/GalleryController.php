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

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        $media = $query->paginate(24);
        $albums = Album::withCount('media')->orderBy('sort_order')->get();

        $stats = [
            'total' => Media::count(),
            'images' => Media::where('type', 'image')->count(),
            'videos' => Media::where('type', 'video')->count(),
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
     * Show a specific album.
     */
    public function album(Album $album)
    {
        $media = $album->media()->paginate(24);
        $albums = Album::withCount('media')->orderBy('sort_order')->get();

        if (request()->ajax()) {
            return response()->json([
                'html' => view('gallery.partials.media-grid', compact('media'))->render(),
                'hasMore' => $media->hasMorePages(),
                'nextPage' => $media->currentPage() + 1,
            ]);
        }

        return view('gallery.index', compact('media', 'albums', 'album'));
    }
}
