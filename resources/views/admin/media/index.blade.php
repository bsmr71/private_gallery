@extends('layouts.app')
@section('title', 'Manage Media — Admin')

@section('content')
<div class="page-header">
    <h1 class="page-title">Manage Media</h1>
    <p class="page-subtitle">{{ $media->total() }} media items</p>
</div>

<!-- Hidden album options for edit modal -->
<select id="album-options" style="display:none">
    @foreach($albums as $album)
    <option value="{{ $album->id }}">{{ $album->name }}</option>
    @endforeach
</select>

<!-- Toolbar -->
<div class="admin-content">
    <div class="admin-toolbar">
        <div class="flex gap-12 flex-wrap items-center">
            <a href="{{ route('admin.media.create') }}" class="btn btn-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Upload
            </a>

            <!-- Filter by album -->
            <select class="form-select" style="width:auto;min-width:160px;" onchange="filterByAlbum(this.value)">
                <option value="">All Albums</option>
                @foreach($albums as $album)
                <option value="{{ $album->id }}" {{ request('album_id') == $album->id ? 'selected' : '' }}>
                    {{ $album->name }}
                </option>
                @endforeach
            </select>

            <!-- Filter by type -->
            <select class="form-select" style="width:auto;min-width:120px;" onchange="filterByType(this.value)">
                <option value="">All Types</option>
                <option value="image" {{ request('type') === 'image' ? 'selected' : '' }}>Images</option>
                <option value="video" {{ request('type') === 'video' ? 'selected' : '' }}>Videos</option>
            </select>
        </div>

        <input type="text"
               class="search-input"
               style="max-width:280px;"
               placeholder="Search media..."
               value="{{ request('search') }}"
               onkeyup="debounceSearch(this.value)">
    </div>

    <!-- Media Grid with Admin Actions -->
    @if($media->count() > 0)
    <div class="media-grid">
        @foreach($media as $item)
        <div class="media-card"
             data-media="{{ json_encode($item->toLightboxData()) }}">

            <img class="media-card-image"
                 data-src="{{ $item->thumbnailUrl() }}"
                 src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a1a25'/%3E%3C/svg%3E"
                 alt="{{ $item->title }}"
                 loading="lazy">

            @if($item->isVideo())
            <div class="media-card-play">
                <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <div class="media-card-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                VIDEO
            </div>
            @endif

            <!-- Admin Actions -->
            <div class="media-card-actions">
                <a href="{{ route('media.download', $item) }}"
                   class="action-btn action-btn-download"
                   onclick="event.stopPropagation()"
                   download
                   title="Download Original File">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
                <button class="action-btn action-btn-edit"
                        onclick="event.stopPropagation(); openEditModal({{ $item->id }}, '{{ addslashes($item->title) }}', '{{ addslashes($item->description) }}', '{{ $item->album_id }}')"
                        title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="action-btn action-btn-delete"
                        onclick="event.stopPropagation(); confirmDelete('{{ route('admin.media.destroy', $item) }}', '{{ addslashes($item->title) }}')"
                        title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>

            <div class="media-card-overlay">
                <div class="media-card-title">{{ $item->title }}</div>
                <div class="media-card-meta">
                    {{ $item->formattedSize() }}
                    @if($item->album) · {{ $item->album->name }} @endif
                    · {{ $item->created_at->diffForHumans() }}
                </div>
            </div>
        </div>
        @endforeach
    </div>

    <div class="pagination-wrapper">
        {{ $media->appends(request()->query())->links() }}
    </div>
    @else
    <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <h3 class="empty-state-title">No media found</h3>
        <p>Upload your first media file to get started.</p>
        <a href="{{ route('admin.media.create') }}" class="btn btn-primary mt-24">Upload Media</a>
    </div>
    @endif
</div>

@push('scripts')
<script>
let searchDebounce;
function debounceSearch(value) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        const url = new URL(window.location);
        if (value) url.searchParams.set('search', value);
        else url.searchParams.delete('search');
        window.location = url;
    }, 500);
}

function filterByAlbum(value) {
    const url = new URL(window.location);
    if (value) url.searchParams.set('album_id', value);
    else url.searchParams.delete('album_id');
    window.location = url;
}

function filterByType(value) {
    const url = new URL(window.location);
    if (value) url.searchParams.set('type', value);
    else url.searchParams.delete('type');
    window.location = url;
}
</script>
@endpush
@endsection
