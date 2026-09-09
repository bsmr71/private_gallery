@php
    $lastGroupDate = null;
    $today = now()->format('Y-m-d');
    $yesterday = now()->subDay()->format('Y-m-d');
@endphp

@foreach($media as $index => $item)
    @php
        $itemDate = $item->created_at ? $item->created_at->format('Y-m-d') : 'unknown';
    @endphp

    @if($itemDate !== $lastGroupDate && !request('search'))
        @php
            $lastGroupDate = $itemDate;
            if ($itemDate === $today) {
                $dateTitle = 'Hari Ini';
                $dateSubtitle = now()->translatedFormat('l, d M Y');
            } elseif ($itemDate === $yesterday) {
                $dateTitle = 'Kemarin';
                $dateSubtitle = now()->subDay()->translatedFormat('l, d M Y');
            } elseif ($item->created_at) {
                $dateTitle = $item->created_at->translatedFormat('d M Y');
                $dateSubtitle = $item->created_at->translatedFormat('l');
            } else {
                $dateTitle = 'Koleksi Media';
                $dateSubtitle = '';
            }
        @endphp
        <div class="gallery-date-section-header">
            <div class="date-header-left">
                <span class="date-header-title">{{ $dateTitle }}</span>
                @if($dateSubtitle)
                    <span class="date-header-subtitle">{{ $dateSubtitle }}</span>
                @endif
            </div>
        </div>
    @endif

    <div class="media-card"
         data-media="{{ json_encode($item->toLightboxData()) }}"
         data-id="{{ $item->id }}"
         data-album-id="{{ $item->album_id }}"
         data-title="{{ $item->title }}"
         id="media-item-{{ $item->id }}"
         tabindex="0"
         role="button"
         aria-label="{{ $item->title }}">

        <div class="media-card-thumb-wrap">
            <!-- Multi-Select Checkmark Circle -->
            <div class="card-select-checkbox"
                 onclick="event.stopPropagation(); toggleCardSelection({{ $item->id }}, event)"
                 title="Pilih item ini">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>

            <!-- Favorite Badge (Top Right) -->
            <button type="button"
                    class="card-action-btn card-favorite-badge {{ $item->is_favorite ? 'is-active' : '' }}"
                    title="{{ $item->is_favorite ? 'Hapus dari Favorit' : 'Tandai Favorit' }}"
                    onclick="event.stopPropagation(); toggleItemFavorite({{ $item->id }}, '{{ route('media.favorite', $item) }}', this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="{{ $item->is_favorite ? '#ef4444' : 'none' }}" stroke="{{ $item->is_favorite ? '#ef4444' : 'currentColor' }}" stroke-width="2.2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>

            <img class="media-card-image"
                 data-src="{{ $item->thumbnailUrl() }}"
                 src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23121318'/%3E%3C/svg%3E"
                 alt="{{ $item->title }}"
                 loading="lazy">

            @if($item->isVideo())
            <!-- Video indicator badge -->
            <div class="video-indicator-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6 3 20 12 6 21 6 3"/>
                </svg>
                <span>Video</span>
            </div>
            @endif

            <!-- Floating Quick Action Buttons on hover -->
            <div class="card-quick-actions">
                <!-- Move / Copy Button -->
                @auth
                <button type="button"
                        class="card-action-btn btn-organize"
                        title="Pindahkan atau Salin ke Album"
                        onclick="event.stopPropagation(); openMoveCopyModal([{{ $item->id }}], '{{ addslashes($item->title) }}', {{ $item->album_id ?? 'null' }})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>

                <!-- Quick Rename Button -->
                <button type="button"
                        class="card-action-btn btn-rename"
                        title="Ganti Nama"
                        onclick="event.stopPropagation(); openQuickRenameModal({{ $item->id }}, '{{ addslashes($item->title) }}', '{{ route('media.quick-rename', $item) }}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </button>
                @endauth

                <!-- Share Link Button -->
                <button type="button"
                        class="card-action-btn btn-share"
                        title="Salin Tautan Media"
                        onclick="event.stopPropagation(); copyMediaLink('{{ $item->streamUrl() }}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                </button>

                <!-- Download Button -->
                <a href="{{ route('media.download', $item) }}"
                   class="card-action-btn btn-download"
                   title="Unduh {{ $item->title }} ({{ $item->formattedSize() }})"
                   download
                   onclick="event.stopPropagation()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </a>

                <!-- Delete Button -->
                @auth
                <button type="button"
                        class="card-action-btn btn-delete"
                        title="Hapus {{ $item->title }}"
                        onclick="event.stopPropagation(); deleteGalleryItem({{ $item->id }}, '{{ route('admin.media.destroy', $item) }}', '{{ addslashes($item->title) }}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
                @endauth
            </div>

            <!-- Clean Bottom Meta Overlay on Hover -->
            <div class="media-card-overlay">
                <div class="media-card-title" id="media-card-title-{{ $item->id }}" title="{{ $item->title }}">{{ $item->title }}</div>
                <div class="media-card-meta">
                    <span>{{ $item->formattedSize() }}</span>
                    @if($item->album)
                        <span class="meta-dot">•</span>
                        <span class="meta-album-name" id="media-card-album-{{ $item->id }}">{{ $item->album->name }}</span>
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
