@extends('layouts.app')
@section('title', isset($album) ? $album->name . ' — Galeri' : 'Galeri Media')

@section('content')
<div class="gallery-shell">

    <!-- Clean Header & Controls Bar (Apple / Google Photos Style) -->
    <header class="gallery-toolbar-top">
        <div class="toolbar-main">
            <div class="gallery-heading-area">
                <h1 class="gallery-main-title">
                    @if(isset($album))
                        {{ $album->name }}
                    @else
                        Galeri Foto &amp; Video Pribadi
                    @endif
                </h1>

                <div class="gallery-meta-line">
                    <span class="meta-count-badge">
                        <strong class="count-value">{{ $stats['total'] ?? $media->total() }}</strong> Total Media
                    </span>
                    @if(isset($stats['size']) && $stats['size'])
                        <span class="meta-bullet">•</span>
                        <span class="meta-storage">{{ $stats['size'] }}</span>
                    @endif
                    @if(isset($album) && $album->description)
                        <span class="meta-bullet">•</span>
                        <span class="meta-desc">{{ $album->description }}</span>
                    @endif
                </div>
            </div>

            <!-- Header Actions: Search & Upload -->
            <div class="toolbar-actions">
                <form action="{{ route('gallery.index') }}" method="GET" class="gallery-search-bar" id="search-form">
                    @if(request('type'))
                        <input type="hidden" name="type" value="{{ request('type') }}">
                    @endif
                    <div class="search-input-box">
                        <svg class="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text"
                               class="gallery-search-field"
                               name="search"
                               id="gallery-search"
                               placeholder="Cari dalam galeri..."
                               value="{{ request('search') }}"
                               autocomplete="off">
                        @if(request('search'))
                            <a href="{{ route('gallery.index', request()->except('search')) }}" class="search-clear-cross" title="Hapus pencarian">✕</a>
                        @endif
                    </div>
                </form>

                @auth
                <a href="{{ route('admin.media.create') }}" class="btn-clean-upload" title="Unggah Foto atau Video">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Unggah</span>
                </a>
                @endauth
            </div>
        </div>

        <!-- Filter Tabs & Album Bar -->
        <div class="toolbar-sub">
            <div class="filter-segmented-tabs">
                <a href="{{ route('gallery.index') }}"
                   class="segment-tab {{ !request('type') && !request('album') && !isset($album) ? 'active' : '' }}">
                    <span>Semua</span>
                    <span class="tab-badge">{{ isset($stats) ? $stats['total'] : $media->total() }}</span>
                </a>

                <a href="{{ route('gallery.index', ['type' => 'image']) }}"
                   class="segment-tab {{ request('type') === 'image' ? 'active' : '' }}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Foto</span>
                    @if(isset($stats))
                        <span class="tab-badge">{{ $stats['images'] }}</span>
                    @endif
                </a>

                <a href="{{ route('gallery.index', ['type' => 'video']) }}"
                   class="segment-tab {{ request('type') === 'video' ? 'active' : '' }}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span>Video</span>
                    @if(isset($stats))
                        <span class="tab-badge">{{ $stats['videos'] }}</span>
                    @endif
                </a>
            </div>

            @if($albums->count() > 0)
            <div class="albums-chips-scroll">
                @foreach($albums as $a)
                <a href="{{ route('gallery.album', $a) }}"
                   class="album-chip-tab {{ (isset($album) && $album->id === $a->id) ? 'active' : '' }}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="album-title-text">{{ $a->name }}</span>
                    <span class="album-badge-count">{{ $a->media_count }}</span>
                </a>
                @endforeach
            </div>
            @endif
        </div>
    </header>

    <!-- Media Stream Grid -->
    @if($media->count() > 0)
    <main class="gallery-photo-stream">
        <div class="photo-wall-grid" id="media-grid">
            @include('gallery.partials.media-grid')
        </div>

        <!-- Pagination -->
        <div class="gallery-pagination-bar">
            {{ $media->appends(request()->query())->links() }}
        </div>
    </main>
    @else
    <!-- Empty State -->
    <div class="gallery-empty-state">
        <div class="empty-icon-circle">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>
        </div>
        <h3 class="empty-state-title">Belum Ada Media</h3>
        <p class="empty-state-subtitle">
            @if(request('search'))
                Tidak ada media yang cocok dengan pencarian "<strong>{{ request('search') }}</strong>".
            @elseif(request('type'))
                Belum ada media bertipe <strong>{{ request('type') }}</strong>.
            @else
                Mulai unggah foto dan video untuk disimpan dalam galeri pribadi Anda.
            @endif
        </p>
        @auth
        <a href="{{ route('admin.media.create') }}" class="btn-clean-upload" style="margin-top: 16px;">
            + Unggah Media Pertama
        </a>
        @endauth
    </div>
    @endif

</div>
@endsection
