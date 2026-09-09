@extends('layouts.app')
@section('title', 'Koleksi Album — Galeri')

@section('content')
<div class="gallery-shell">

    <!-- Header & Controls Bar -->
    <header class="gallery-toolbar-top">
        <div class="toolbar-main">
            <div class="gallery-heading-area">
                <h1 class="gallery-main-title">Koleksi Album</h1>
                <div class="gallery-meta-line">
                    <span class="meta-count-badge">
                        <strong class="count-value">{{ $albums->count() }}</strong> Album Tersimpan
                    </span>
                    <span class="meta-bullet">•</span>
                    <span class="meta-storage">{{ $stats['total'] }} Total Media</span>
                </div>
            </div>

            <div class="toolbar-actions">
                @auth
                <!-- Button Create Album -->
                <button type="button" class="btn-create-album-pill" onclick="openCreateAlbumModal()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Album Baru</span>
                </button>

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

        <!-- Filter Segmented Tabs -->
        <div class="toolbar-sub">
            <div class="filter-segmented-tabs">
                <a href="{{ route('gallery.index') }}" class="segment-tab">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <span>Semua Media</span>
                    <span class="tab-badge">{{ $stats['total'] }}</span>
                </a>

                <a href="{{ route('gallery.albums') }}" class="segment-tab active">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Album</span>
                    <span class="tab-badge">{{ $albums->count() }}</span>
                </a>

                <a href="{{ route('gallery.index', ['favorite' => '1']) }}" class="segment-tab">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>Favorit</span>
                    @if(isset($stats['favorites']))
                        <span class="tab-badge">{{ $stats['favorites'] }}</span>
                    @endif
                </a>
            </div>
        </div>
    </header>

    <!-- Visual Albums Showcase Grid (Apple / Google Photos Style) -->
    <main class="albums-showcase-container">
        <div class="albums-grid">

            <!-- Card 1: "+ Buat Album Baru" -->
            @auth
            <div class="album-card-create" onclick="openCreateAlbumModal()" role="button" tabindex="0" title="Buat Album Baru">
                <div class="create-card-inner">
                    <div class="create-icon-bubble">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </div>
                    <span class="create-title">Buat Album Baru</span>
                    <span class="create-subtitle">Kelompokkan foto Anda</span>
                </div>
            </div>
            @endauth

            <!-- Album Cards -->
            @foreach($albums as $album)
            <a href="{{ route('gallery.album', $album) }}" class="album-visual-card" id="album-card-{{ $album->id }}">
                <div class="album-cover-wrapper">
                    @php
                        $coverUrl = $album->getCoverThumbnailUrl();
                    @endphp

                    @if($coverUrl)
                        <img src="{{ $coverUrl }}"
                             alt="{{ $album->name }}"
                             class="album-cover-img"
                             loading="lazy">
                    @else
                        <div class="album-cover-empty">
                            <div class="empty-folder-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                </svg>
                            </div>
                            <span class="empty-folder-text">Album Kosong</span>
                        </div>
                    @endif

                    <div class="album-count-badge">
                        {{ $album->media_count }} {{ $album->media_count == 1 ? 'Media' : 'Media' }}
                    </div>

                    <!-- Quick upload overlay icon on hover -->
                    <div class="album-hover-peek">
                        <span>Buka Album &rarr;</span>
                    </div>
                </div>

                <div class="album-meta-under">
                    <h3 class="album-visual-title" title="{{ $album->name }}">{{ $album->name }}</h3>
                    <p class="album-visual-subtitle">
                        @if($album->description)
                            {{ Str::limit($album->description, 36) }}
                        @else
                            {{ $album->media_count }} foto &amp; video
                        @endif
                    </p>
                </div>
            </a>
            @endforeach

        </div>

        @if($albums->count() === 0)
        <!-- Empty State -->
        <div class="gallery-empty-state" style="margin-top: 40px;">
            <div class="empty-icon-circle">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <h3 class="empty-state-title">Belum Ada Album</h3>
            <p class="empty-state-subtitle">Mulai buat album untuk mengelompokkan kenangan foto dan video Anda.</p>
            @auth
            <button type="button" class="btn btn-primary" style="margin-top: 16px;" onclick="openCreateAlbumModal()">
                + Buat Album Pertama
            </button>
            @endauth
        </div>
        @endif
    </main>

</div>

<!-- Modal Buat Album Baru -->
<div class="organize-modal-backdrop" id="create-album-modal" style="display:none;">
    <div class="organize-modal-box rename-box">
        <div class="organize-modal-header">
            <div class="header-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    <line x1="12" y1="11" x2="12" y2="17"/>
                    <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
            </div>
            <div>
                <h3 class="organize-modal-title">Buat Album Baru</h3>
                <p class="organize-modal-subtitle">Tambahkan koleksi album baru ke galeri Anda</p>
            </div>
            <button type="button" class="organize-close-btn" onclick="closeCreateAlbumModal()">✕</button>
        </div>

        <form action="{{ route('admin.albums.store') }}" method="POST">
            @csrf
            <div class="organize-form-body">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label class="organize-label" for="album-name-input">Nama Album</label>
                    <input type="text"
                           id="album-name-input"
                           name="name"
                           class="form-input"
                           placeholder="Contoh: Liburan Musim Panas, Wisuda, dsb."
                           required
                           autocomplete="off">
                </div>
                <div class="form-group">
                    <label class="organize-label" for="album-desc-input">Deskripsi (Opsional)</label>
                    <textarea id="album-desc-input"
                              name="description"
                              class="form-textarea"
                              rows="2"
                              placeholder="Catatan singkat tentang album ini..."></textarea>
                </div>
            </div>

            <div class="organize-modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeCreateAlbumModal()">Batal</button>
                <button type="submit" class="btn btn-primary">Buat Album</button>
            </div>
        </form>
    </div>
</div>

@push('scripts')
<script>
function openCreateAlbumModal() {
    const modal = document.getElementById('create-album-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            document.getElementById('album-name-input')?.focus();
        }, 100);
    }
}
function closeCreateAlbumModal() {
    const modal = document.getElementById('create-album-modal');
    if (modal) modal.style.display = 'none';
}
</script>
@endpush
@endsection
