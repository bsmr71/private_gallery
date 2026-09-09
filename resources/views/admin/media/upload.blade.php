@extends('layouts.app')
@section('title', 'Upload Media — Admin')

@section('content')
<div class="admin-shell">
<div class="page-header">
    <h1 class="page-title">Upload Media</h1>
    <p class="page-subtitle">Drag & drop or click to upload images and videos</p>
</div>

<div class="admin-content">
    <!-- Album Selection -->
    <div style="max-width:800px;margin:0 auto 24px;">
        <div class="form-group">
            <label class="form-label">Upload to Album (optional)</label>
            <select class="form-select" id="upload-album">
                <option value="">No Album</option>
                @foreach($albums as $album)
                <option value="{{ $album->id }}">{{ $album->name }}</option>
                @endforeach
            </select>
        </div>
    </div>

    <!-- Upload Zone -->
    <div class="upload-zone" id="upload-zone">
        <input type="file"
               class="upload-input"
               id="file-input"
               multiple
               accept="image/*,video/*">
        <div class="upload-zone-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
        </div>
        <div class="upload-zone-text">Drop files here or click to browse</div>
        <div class="upload-zone-hint">
            Supports: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV • Max 500MB per file
        </div>
    </div>

    <!-- Upload Progress List -->
    <div class="upload-progress-list" id="upload-progress-list"></div>

    <!-- Back button -->
    <div style="max-width:800px;margin:32px auto 0;text-align:center;">
        <a href="{{ route('admin.media.index') }}" class="btn btn-secondary">
            ← Back to Media
        </a>
    </div>
</div>
</div>
@endsection
