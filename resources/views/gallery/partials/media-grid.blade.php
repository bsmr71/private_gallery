@foreach($media as $index => $item)
<div class="media-card"
     data-media="{{ json_encode($item->toLightboxData()) }}"
     id="media-item-{{ $item->id }}"
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
        <!-- Subtle iOS / Google Photos style video indicator -->
        <div class="video-indicator-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
            <span>Video</span>
        </div>
        @endif

        <!-- Floating Quick Action: Download & Delete buttons on hover -->
        <div class="card-quick-actions">
            <a href="{{ route('media.download', $item) }}"
               class="card-action-btn btn-download"
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

            @auth
            <button type="button"
                    class="card-action-btn btn-delete"
                    title="Hapus {{ $item->title }}"
                    onclick="event.stopPropagation(); deleteGalleryItem({{ $item->id }}, '{{ route('admin.media.destroy', $item) }}', '{{ addslashes($item->title) }}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span class="sr-only">Hapus</span>
            </button>
            @endauth
        </div>

        <!-- Clean Bottom Meta Overlay on Hover -->
        <div class="media-card-overlay">
            <div class="media-card-title" title="{{ $item->title }}">{{ $item->title }}</div>
            <div class="media-card-meta">
                <span>{{ $item->formattedSize() }}</span>
                @if($item->album)
                    <span class="meta-dot">•</span>
                    <span class="meta-album-name">{{ $item->album->name }}</span>
                @endif
                @if($item->created_at)
                    <span class="meta-dot">•</span>
                    <span>{{ $item->created_at->format('d M') }}</span>
                @endif
            </div>
        </div>
    </div>
</div>
@endforeach
