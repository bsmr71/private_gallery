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

        <!-- iOS 18 "Jenis Media" (Media Types) Section -->
        <section class="ios-media-types-section" aria-label="Jenis Media">
            <h2 class="ios-section-heading">Jenis Media</h2>
            <div class="ios-media-types-list">
                <a href="{{ route('gallery.index', ['type' => 'image']) }}" class="ios-media-type-row">
                    <div class="type-row-left">
                        <span class="type-icon type-icon-photo">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </span>
                        <span class="type-label">Foto</span>
                    </div>
                    <div class="type-row-right">
                        <span class="type-count">{{ $stats['images'] ?? 0 }}</span>
                        <svg class="chevron-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </a>

                <a href="{{ route('gallery.index', ['type' => 'video']) }}" class="ios-media-type-row">
                    <div class="type-row-left">
                        <span class="type-icon type-icon-video">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                        </span>
                        <span class="type-label">Video</span>
                    </div>
                    <div class="type-row-right">
                        <span class="type-count">{{ $stats['videos'] ?? 0 }}</span>
                        <svg class="chevron-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </a>

                <a href="{{ route('gallery.index', ['favorite' => '1']) }}" class="ios-media-type-row">
                    <div class="type-row-left">
                        <span class="type-icon type-icon-fav">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        </span>
                        <span class="type-label">Favorit</span>
                    </div>
                    <div class="type-row-right">
                        <span class="type-count">{{ $stats['favorites'] ?? 0 }}</span>
                        <svg class="chevron-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </a>
            </div>
        </section>

        <!-- iOS 18 "Utilitas" (Utilities) Section -->
        <section class="ios-media-types-section" aria-label="Utilitas" style="margin-top: 32px;">
            <h2 class="ios-section-heading">Utilitas</h2>
            <div class="ios-media-types-list">
                <!-- Duplikat Row (Clickable) -->
                <div class="ios-media-type-row" role="button" tabindex="0" onclick="openDuplicatesModal()" style="cursor: pointer;" title="Lihat dan bersihkan media duplikat">
                    <div class="type-row-left">
                        <span class="type-icon" style="background: rgba(10, 132, 255, 0.15); color: #0A84FF;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </span>
                        <span class="type-label">Duplikat</span>
                    </div>
                    <div class="type-row-right">
                        <span class="type-count" id="dup-badge-count">{{ $stats['duplicates'] ?? 0 }}</span>
                        <svg class="chevron-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </div>

                <!-- Perbaiki Thumbnail Video Row (Clickable) -->
                <div class="ios-media-type-row" role="button" tabindex="0" onclick="openVideoRepairModal()" style="cursor: pointer;" title="Perbaiki thumbnail video agar tidak lagi hitam">
                    <div class="type-row-left">
                        <span class="type-icon" style="background: rgba(168, 85, 247, 0.15); color: #a855f7;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                        </span>
                        <span class="type-label">Perbaiki Thumbnail Video</span>
                    </div>
                    <div class="type-row-right">
                        <span class="type-count" style="font-size: 11.5px; color: #a855f7; background: rgba(168, 85, 247, 0.12); padding: 2px 8px; border-radius: 10px;">{{ $stats['videos'] ?? 0 }} video</span>
                        <svg class="chevron-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </div>
            </div>
        </section>

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

<!-- Modal Apple Photos Duplikat -->
<div class="organize-modal-backdrop" id="duplicates-modal" style="display:none;" onclick="if(event.target === this) closeDuplicatesModal()">
    <div class="duplicates-modal-box">
        <div class="duplicates-header">
            <div class="dup-header-left">
                <div class="dup-header-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </div>
                <div>
                    <h3 class="dup-header-title">Duplikat</h3>
                    <p class="dup-header-subtitle">Gabungkan foto dan video yang identik untuk menghemat ruang</p>
                </div>
            </div>
            <button type="button" class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="closeDuplicatesModal()">Tutup</button>
        </div>

        <div class="dup-summary-bar">
            <div class="dup-summary-info" id="dup-summary-text">
                Memindai media duplikat...
            </div>
            <button type="button" class="btn btn-primary" id="btn-merge-all-web" style="display:none; padding: 6px 16px; font-size: 12.5px;" onclick="mergeAllDuplicatesWeb()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Gabung Semua
            </button>
        </div>

        <div class="duplicates-body" id="duplicates-container">
            <!-- Dynamic content loaded via JS -->
            <div style="text-align:center; padding: 40px 20px; color: rgba(255,255,255,0.5);">
                <div class="spinner" style="margin: 0 auto 12px;"></div>
                <span>Memuat data duplikat...</span>
            </div>
        </div>
    </div>
</div>

<!-- Modal Perbaiki Thumbnail Video -->
<div class="organize-modal-backdrop" id="video-repair-modal" style="display:none;" onclick="if(event.target === this) closeVideoRepairModal()">
    <div class="organize-modal-box rename-box" style="max-width: 540px;">
        <div class="organize-modal-header">
            <div class="header-icon-pill" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
            </div>
            <div>
                <h3 class="organize-modal-title">Perbaiki Thumbnail Video</h3>
                <p class="organize-modal-subtitle">Ganti thumbnail hitam dengan frame asli video secara otomatis</p>
            </div>
        </div>

        <div class="organize-modal-body" style="padding: 20px 24px;">
            <p style="font-size: 13.5px; color: rgba(255,255,255,0.75); line-height: 1.5; margin-bottom: 14px;">
                Browser web akan memutar potongan awal video (detik 0.5s) di latar belakang, mengambil screenshot frame berkualitas tinggi, dan menyimpannya secara permanen ke server & Google Drive.
            </p>

            <div class="video-repair-progress-bar" id="v-repair-progress-bar" style="display:none;">
                <div class="video-repair-progress-fill" id="v-repair-progress-fill"></div>
            </div>
            <div id="v-repair-status-text" style="font-size: 12.5px; color: #a855f7; font-weight: 500; min-height: 20px;"></div>
        </div>

        <div class="organize-modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeVideoRepairModal()">Tutup</button>
            <button type="button" class="btn btn-primary" id="btn-start-video-repair" onclick="startVideoThumbnailAutoExtraction()" style="background: #9333ea; border-color: #9333ea;">
                Mulai Perbaikan
            </button>
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
