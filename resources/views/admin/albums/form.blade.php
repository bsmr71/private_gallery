@extends('layouts.app')
@section('title', ($album ? 'Edit' : 'Create') . ' Album — Admin')

@section('content')
<div class="admin-shell">
<div class="page-header">
    <h1 class="page-title">{{ $album ? 'Edit Album' : 'New Album' }}</h1>
    <p class="page-subtitle">{{ $album ? 'Update album details' : 'Create a new album to organize your media' }}</p>
</div>

<div class="admin-content">
    <div style="max-width:600px;">
        <form method="POST" action="{{ $album ? route('admin.albums.update', $album) : route('admin.albums.store') }}">
            @csrf
            @if($album) @method('PUT') @endif

            <div class="form-group">
                <label class="form-label" for="name">Album Name</label>
                <input type="text"
                       class="form-input"
                       id="name"
                       name="name"
                       value="{{ old('name', $album?->name) }}"
                       required
                       placeholder="e.g., Vacation Photos">
                @error('name')
                    <p class="form-error">{{ $message }}</p>
                @enderror
            </div>

            <div class="form-group">
                <label class="form-label" for="description">Description (optional)</label>
                <textarea class="form-textarea"
                          id="description"
                          name="description"
                          placeholder="Describe this album...">{{ old('description', $album?->description) }}</textarea>
                @error('description')
                    <p class="form-error">{{ $message }}</p>
                @enderror
            </div>

            <div class="flex gap-12">
                <button type="submit" class="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {{ $album ? 'Update Album' : 'Create Album' }}
                </button>
                <a href="{{ route('admin.albums.index') }}" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>
</div>
@endsection
