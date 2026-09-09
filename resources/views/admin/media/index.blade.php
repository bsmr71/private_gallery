@extends('layouts.app')
@section('title', 'Manage Media — Admin')

@section('content')
<div class="admin-shell">
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

    <!-- Batch Actions Bar -->
    <div id="batch-actions-bar" style="display:none; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.25); padding:10px 18px; border-radius:12px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span style="font-size:0.875rem; font-weight:600; color:#ef4444;"><span id="selected-count">0</span> media dipilih</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-secondary" style="padding:6px 12px; font-size:0.8125rem;" onclick="toggleSelectAll()">Pilih Semua</button>
            <button type="button" class="btn btn-secondary" style="padding:6px 12px; font-size:0.8125rem;" onclick="clearSelection()">Batal</button>
            <button type="button" class="btn" style="background:#dc2626; color:#ffffff; padding:6px 16px; font-size:0.8125rem; font-weight:600;" onclick="submitBatchDelete()">
                🗑️ Hapus Terpilih
            </button>
        </div>
    </div>

    <!-- Media Grid with Admin Actions -->
    @if($media->count() > 0)
    <div class="media-grid">
        @foreach($media as $item)
        <div class="media-card"
             id="admin-media-{{ $item->id }}"
             data-media="{{ json_encode($item->toLightboxData()) }}">

            <!-- Checkbox Selection -->
            <label class="media-card-checkbox-label" onclick="event.stopPropagation()">
                <input type="checkbox" class="media-select-cb" value="{{ $item->id }}" onchange="handleItemSelect(this)">
            </label>

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

function getSelectedIds() {
    return Array.from(document.querySelectorAll('.media-select-cb:checked')).map(cb => cb.value);
}

function handleItemSelect(cb) {
    if (cb) {
        const label = cb.closest('.media-card-checkbox-label');
        if (label) label.classList.toggle('is-checked', cb.checked);
    }
    const count = getSelectedIds().length;
    const bar = document.getElementById('batch-actions-bar');
    const countEl = document.getElementById('selected-count');
    if (bar && countEl) {
        countEl.textContent = count;
        bar.style.display = count > 0 ? 'flex' : 'none';
    }
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.media-select-cb');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const label = cb.closest('.media-card-checkbox-label');
        if (label) label.classList.toggle('is-checked', cb.checked);
    });
    handleItemSelect();
}

function clearSelection() {
    document.querySelectorAll('.media-select-cb').forEach(cb => {
        cb.checked = false;
        const label = cb.closest('.media-card-checkbox-label');
        if (label) label.classList.remove('is-checked');
    });
    handleItemSelect();
}

function submitBatchDelete() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;

    if (!confirm(`Yakin ingin menghapus ${ids.length} media terpilih?\n\nBerkas akan dihapus permanen dari Google Drive dan database.`)) {
        return;
    }

    fetch('{{ route('admin.media.batch-delete') }}', {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: ids }),
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || `${data.deleted} media berhasil dihapus!`, 'success');
            ids.forEach(id => {
                const card = document.getElementById(`admin-media-${id}`);
                if (card) card.remove();
            });
            clearSelection();
            setTimeout(() => location.reload(), 600);
        } else {
            showNotification(data.error || 'Gagal menghapus media terpilih', 'error');
        }
    })
    .catch(() => {
        showNotification('Terjadi kesalahan jaringan saat menghapus media', 'error');
    });
}
</script>
@endpush
@endsection
