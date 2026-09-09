@extends('layouts.app')
@section('title', 'Dashboard — Admin')

@section('content')
<div class="admin-shell">
    <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Ringkasan koleksi galeri dan status penyimpanan</p>
    </div>

    <!-- Stats Grid (Clean Apple / macOS Style) -->
    <div class="dashboard-grid">
        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-label">Total Media</span>
                <div class="stat-icon-sm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
            </div>
            <div class="stat-value">{{ $totalMedia }}</div>
            <div class="stat-footnote">Foto &amp; Video tersimpan</div>
        </div>

        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-label">Foto</span>
                <div class="stat-icon-sm icon-emerald">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
            </div>
            <div class="stat-value">{{ $totalImages }}</div>
            <div class="stat-footnote">Berkas gambar</div>
        </div>

        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-label">Video</span>
                <div class="stat-icon-sm icon-amber">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                </div>
            </div>
            <div class="stat-value">{{ $totalVideos }}</div>
            <div class="stat-footnote">Berkas video terenkripsi</div>
        </div>

        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-label">Album</span>
                <div class="stat-icon-sm icon-purple">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
            </div>
            <div class="stat-value">{{ $totalAlbums }}</div>
            <div class="stat-footnote">Kategori media</div>
        </div>

        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-label">Ukuran Total</span>
                <div class="stat-icon-sm icon-pink">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
            </div>
            <div class="stat-value">{{ \App\Models\Media::formatBytes($totalSize) }}</div>
            <div class="stat-footnote">Terenkripsi AES-256</div>
        </div>

        @if($driveStorage['limit'] > 0)
        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-label">Drive Terpakai</span>
                <div class="stat-icon-sm icon-cyan">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                </div>
            </div>
            <div class="stat-value">{{ \App\Models\Media::formatBytes($driveStorage['used']) }}</div>
            <div class="stat-footnote">dari {{ \App\Models\Media::formatBytes($driveStorage['limit']) }} kuota</div>
        </div>
        @endif
    </div>

    <!-- Quick Actions -->
    <div class="admin-content">
        <div class="admin-section-header">
            <h2 class="section-heading">Tindakan Cepat</h2>
        </div>
        <div class="quick-action-strip">
            <a href="{{ route('admin.media.create') }}" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Unggah Media Baru</span>
            </a>
            <a href="{{ route('admin.media.index') }}" class="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>Kelola Semua Media</span>
            </a>
            <a href="{{ route('admin.albums.index') }}" class="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Kelola Album</span>
            </a>
        </div>

        <!-- Recent Media Section -->
        @if($recentMedia->count() > 0)
        <div class="admin-section-header" style="margin-top: 40px;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <h2 class="section-heading">Unggahan Terbaru</h2>
                <a href="{{ route('admin.media.index') }}" class="section-link">Lihat semua &rarr;</a>
            </div>
        </div>

        <div class="photo-wall-grid" id="media-grid">
            @foreach($recentMedia as $item)
            <div class="media-card"
                 data-media="{{ json_encode($item->toLightboxData()) }}"
                 id="admin-media-{{ $item->id }}"
                 tabindex="0"
                 role="button"
                 aria-label="{{ $item->title }}">
                <div class="media-card-thumb-wrap">
                    <img class="media-card-image"
                         data-src="{{ $item->thumbnailUrl() }}"
                         src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23121318'/%3E%3C/svg%3E"
                         alt="{{ $item->title }}"
                         loading="lazy">

                    @if($item->isVideo())
                    <div class="video-indicator-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="6 3 20 12 6 21 6 3"/>
                        </svg>
                        <span>Video</span>
                    </div>
                    @endif

                    <div class="card-quick-actions">
                        <a href="{{ route('media.download', $item) }}"
                           class="card-action-download"
                           title="Unduh {{ $item->title }} ({{ $item->formattedSize() }})"
                           download
                           onclick="event.stopPropagation()">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            <span class="sr-only">Unduh</span>
                        </a>
                    </div>

                    <div class="media-card-overlay">
                        <div class="media-card-title">{{ $item->title }}</div>
                        <div class="media-card-meta">{{ $item->formattedSize() }} • {{ $item->created_at->diffForHumans() }}</div>
                    </div>
                </div>
            </div>
            @endforeach
        </div>
        @endif
    </div>
</div>
@endsection
