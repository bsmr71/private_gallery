@extends('layouts.app')
@section('title', isset($album) ? $album->name . ' — Galeri' : (request('favorite') ? 'Foto & Video Favorit' : 'Galeri Media'))

@section('content')
<div class="gallery-shell">

    <!-- Clean Header & Controls Bar (Apple / Google Photos Style) -->
    <header class="gallery-toolbar-top">
        <div class="toolbar-main">
            <div class="gallery-heading-area">
                <h1 class="gallery-main-title">
                    @if(isset($album))
                        {{ $album->name }}
                    @elseif(request('favorite'))
                        Favorit ❤️
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

            <!-- Header Actions: Search, Select Mode & Upload -->
            <div class="toolbar-actions">
                <form action="{{ route('gallery.index') }}" method="GET" class="gallery-search-bar" id="search-form">
                    @if(request('type'))
                        <input type="hidden" name="type" value="{{ request('type') }}">
                    @endif
                    @if(request('favorite'))
                        <input type="hidden" name="favorite" value="1">
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

                @if($media->count() > 0)
                <!-- Multi-select toggle button -->
                <button type="button" class="btn-select-mode" id="btn-toggle-select" onclick="toggleSelectionMode()" title="Pilih Beberapa Foto">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <polyline points="9 11 12 14 22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    <span id="select-mode-text">Pilih</span>
                </button>
                @endif

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
                   class="segment-tab {{ !request('type') && !request('album') && !request('favorite') && !isset($album) ? 'active' : '' }}">
                    <span>Semua</span>
                    <span class="tab-badge">{{ isset($stats) ? $stats['total'] : $media->total() }}</span>
                </a>

                <a href="{{ route('gallery.index', ['type' => 'image']) }}"
                   class="segment-tab {{ request('type') === 'image' && !request('favorite') ? 'active' : '' }}">
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
                   class="segment-tab {{ request('type') === 'video' && !request('favorite') ? 'active' : '' }}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span>Video</span>
                    @if(isset($stats))
                        <span class="tab-badge">{{ $stats['videos'] }}</span>
                    @endif
                </a>

                <a href="{{ route('gallery.albums') }}"
                   class="segment-tab {{ request()->routeIs('gallery.albums*') ? 'active' : '' }}" title="Lihat Koleksi Album">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Album</span>
                    @if(isset($stats['albums']))
                        <span class="tab-badge">{{ $stats['albums'] }}</span>
                    @endif
                </a>

                <a href="{{ route('gallery.index', ['favorite' => '1']) }}"
                   class="segment-tab {{ request('favorite') ? 'active' : '' }}" title="Foto & Video Favorit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>Favorit</span>
                    @if(isset($stats['favorites']))
                        <span class="tab-badge">{{ $stats['favorites'] }}</span>
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
        <h3 class="empty-state-title">
            @if(request('favorite'))
                Belum Ada Foto Favorit
            @else
                Belum Ada Media
            @endif
        </h3>
        <p class="empty-state-subtitle">
            @if(request('search'))
                Tidak ada media yang cocok dengan pencarian "<strong>{{ request('search') }}</strong>".
            @elseif(request('favorite'))
                Klik ikon hati ❤️ pada foto atau video untuk menambahkannya ke koleksi favorit Anda.
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

<!-- Floating Multi-Selection Action Bar (Apple / Google Photos Style) -->
<aside class="floating-selection-bar" id="floating-selection-bar" style="display:none;" aria-label="Aksi Seleksi Media">
    <div class="selection-bar-inner">
        <div class="selection-count-info">
            <span class="selection-badge" id="selection-count-badge">0</span>
            <span class="selection-text">item dipilih</span>
        </div>

        <div class="selection-actions-group">
            <!-- Select All / Deselect All -->
            <button type="button" class="bar-action-btn" onclick="toggleSelectAll()" id="btn-select-all" title="Pilih Semua di Halaman">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                <span id="select-all-label">Semua</span>
            </button>

            @auth
            <!-- Move to Album -->
            <button type="button" class="bar-action-btn primary" onclick="openMoveCopyFromSelection('move')" title="Pindahkan ke Album">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    <polyline points="12 11 12 16 14 14"/>
                </svg>
                <span>Pindahkan</span>
            </button>

            <!-- Copy to Album -->
            <button type="button" class="bar-action-btn" onclick="openMoveCopyFromSelection('copy')" title="Salin / Duplikasi ke Album">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>Salin</span>
            </button>

            <!-- Batch Delete -->
            <button type="button" class="bar-action-btn danger" onclick="batchDeleteSelected()" title="Hapus yang Dipilih">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Hapus</span>
            </button>
            @endauth

            <!-- Cancel / Close -->
            <button type="button" class="bar-action-btn close" onclick="exitSelectionMode()" title="Batalkan Pilihan">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    </div>
</aside>

<!-- Move / Copy to Album Modal -->
<div class="organize-modal-backdrop" id="organize-modal" style="display:none;">
    <div class="organize-modal-box">
        <div class="organize-modal-header">
            <div class="header-icon-pill" id="organize-modal-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
                <h3 class="organize-modal-title" id="organize-modal-title">Pindahkan ke Album</h3>
                <p class="organize-modal-subtitle" id="organize-modal-subtitle">Pilih album target untuk media ini</p>
            </div>
            <button type="button" class="organize-close-btn" onclick="closeMoveCopyModal()">✕</button>
        </div>

        <form id="organize-form" onsubmit="submitMoveCopyForm(event)">
            <input type="hidden" id="organize-mode" value="move">
            <input type="hidden" id="organize-media-ids" value="">

            <div class="organize-form-body">
                <label class="organize-label">Pilih Album Tujuan:</label>
                <div class="organize-album-list" id="organize-album-list">
                    <label class="album-option-card">
                        <input type="radio" name="target_album_id" value="none" checked>
                        <div class="album-option-info">
                            <span class="album-option-name">Tanpa Album (Keluarkan)</span>
                            <span class="album-option-desc">Tampilkan hanya di galeri utama</span>
                        </div>
                    </label>

                    @foreach($albums as $albumItem)
                    <label class="album-option-card">
                        <input type="radio" name="target_album_id" value="{{ $albumItem->id }}">
                        <div class="album-option-info">
                            <span class="album-option-name">{{ $albumItem->name }}</span>
                            <span class="album-option-desc">{{ $albumItem->media_count }} media tersimpan</span>
                        </div>
                    </label>
                    @endforeach
                </div>

                <div class="new-album-divider">
                    <span>atau buat album baru</span>
                </div>

                <div class="new-album-input-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <input type="text"
                           id="organize-new-album-name"
                           name="new_album_name"
                           class="new-album-field"
                           placeholder="Ketik nama album baru..."
                           autocomplete="off">
                </div>
            </div>

            <div class="organize-modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeMoveCopyModal()">Batal</button>
                <button type="submit" class="btn btn-primary" id="organize-submit-btn">
                    <span id="organize-submit-text">Pindahkan</span>
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Quick Rename Modal -->
<div class="organize-modal-backdrop" id="rename-modal" style="display:none;">
    <div class="organize-modal-box rename-box">
        <div class="organize-modal-header">
            <div class="header-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
            </div>
            <div>
                <h3 class="organize-modal-title">Ganti Judul Media</h3>
                <p class="organize-modal-subtitle">Perbarui nama foto atau video ini</p>
            </div>
            <button type="button" class="organize-close-btn" onclick="closeQuickRenameModal()">✕</button>
        </div>

        <form id="rename-form" onsubmit="submitQuickRenameForm(event)">
            <input type="hidden" id="rename-media-id" value="">
            <input type="hidden" id="rename-url" value="">

            <div class="organize-form-body">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label class="organize-label" for="rename-input-title">Judul Baru</label>
                    <input type="text" id="rename-input-title" class="form-input" required maxlength="255">
                </div>
                <div class="form-group">
                    <label class="organize-label" for="rename-input-desc">Deskripsi (Opsional)</label>
                    <textarea id="rename-input-desc" class="form-textarea" rows="2" placeholder="Tambahkan catatan..."></textarea>
                </div>
            </div>

            <div class="organize-modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeQuickRenameModal()">Batal</button>
                <button type="submit" class="btn btn-primary" id="rename-submit-btn">Simpan Perubahan</button>
            </div>
        </form>
    </div>
</div>

<!-- Album list data embedded for JavaScript -->
<script>
    window.galleryAlbumsData = @json($albums->map(fn($a) => ['id' => $a->id, 'name' => $a->name, 'count' => $a->media_count]));
</script>
@endsection
