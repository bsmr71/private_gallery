@extends('layouts.app')
@section('title', 'Manage Albums — Admin')

@section('content')
<div class="admin-shell">
<div class="page-header">
    <h1 class="page-title">Albums</h1>
    <p class="page-subtitle">Organize your media into collections</p>
</div>

<div class="admin-content">
    <div class="admin-toolbar">
        <a href="{{ route('admin.albums.create') }}" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Album
        </a>
    </div>

    @if($albums->count() > 0)
    <div class="album-grid">
        @foreach($albums as $album)
        <div class="album-card">
            <div class="album-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="album-info">
                <div class="album-name">{{ $album->name }}</div>
                <div class="album-count">{{ $album->media_count }} items</div>
            </div>
            <div class="album-actions">
                <a href="{{ route('admin.albums.edit', $album) }}" class="action-btn action-btn-edit" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </a>
                <button class="action-btn action-btn-delete"
                        onclick="confirmDelete('{{ route('admin.albums.destroy', $album) }}', '{{ addslashes($album->name) }}')"
                        title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>
        @endforeach
    </div>
    @else
    <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <h3 class="empty-state-title">No albums yet</h3>
        <p>Create your first album to organize your media.</p>
        <a href="{{ route('admin.albums.create') }}" class="btn btn-primary mt-24">Create Album</a>
    </div>
    @endif
</div>
</div>
@endsection
