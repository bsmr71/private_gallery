<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#090a0d" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)">
    <meta name="description" content="Private Media Gallery — Secure encrypted media storage">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Media Gallery')</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/app.css') }}?v={{ file_exists(public_path('css/app.css')) ? filemtime(public_path('css/app.css')) : time() }}">
    <script>
        (function() {
            const savedTheme = localStorage.getItem('gallery_theme');
            if (savedTheme) {
                document.documentElement.setAttribute('data-theme', savedTheme);
            } else {
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            }
        })();
    </script>
    @stack('styles')
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar" id="main-navbar">
        <div class="nav-container">
            <a href="{{ route('gallery.index') }}" class="nav-brand" style="display: flex; align-items: center; gap: 10px;">
                <img src="/images/logo.png" alt="Gallery Logo" style="width: 28px; height: 28px; object-fit: contain; border-radius: 6px;">
                <span class="brand-text">Gallery</span>
            </a>

            <div class="nav-links">
                <a href="{{ route('gallery.index') }}" class="nav-link {{ request()->routeIs('gallery.index') ? 'active' : '' }}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    Gallery
                </a>
                <a href="{{ route('gallery.albums') }}" class="nav-link {{ request()->routeIs('gallery.album*') ? 'active' : '' }}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    Albums
                </a>
                @auth
                <a href="{{ route('admin.dashboard') }}" class="nav-link {{ request()->routeIs('admin.dashboard') ? 'active' : '' }}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Admin
                </a>
                <a href="{{ route('admin.settings') }}" class="nav-link {{ request()->routeIs('admin.settings') ? 'active' : '' }}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
                    Settings
                </a>
                <form method="POST" action="{{ route('logout') }}" class="nav-logout-form">
                    @csrf
                    <button type="submit" class="nav-link nav-logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Logout
                    </button>
                </form>
                @else
                <a href="{{ route('login') }}" class="nav-link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    Login
                </a>
                @endauth

                <!-- Theme Toggle Button -->
                <button type="button" class="nav-theme-toggle" id="theme-toggle" aria-label="Ganti Tema" title="Ganti Mode Terang / Gelap" onclick="toggleTheme()">
                    <svg class="theme-icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="4"/>
                        <path d="M12 2v2"/><path d="M12 20v2"/>
                        <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                        <path d="M2 12h2"/><path d="M20 12h2"/>
                        <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                    </svg>
                    <svg class="theme-icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                    </svg>
                </button>
            </div>

            <button class="nav-mobile-toggle" id="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('show')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
        @if(session('success'))
        <div class="alert alert-success" id="flash-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {{ session('success') }}
            <button onclick="this.parentElement.remove()" class="alert-close">×</button>
        </div>
        @endif

        @if(session('error'))
        <div class="alert alert-error" id="flash-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            {{ session('error') }}
            <button onclick="this.parentElement.remove()" class="alert-close">×</button>
        </div>
        @endif

        @yield('content')
    </main>

    <!-- Modern Ambient Lightbox Modal -->
    <div class="lightbox" id="lightbox" style="display:none">
        <div class="lightbox-backdrop" onclick="closeLightbox()"></div>

        <!-- Slideshow Progress Bar -->
        <div class="slideshow-progress-bar" id="slideshow-progress" style="display:none;"><div class="slideshow-fill"></div></div>

        <!-- Floating Top Bar (Apple Photos Style) -->
        <div class="lightbox-topbar">
            <!-- Left: Back to Gallery -->
            <button type="button" class="lightbox-nav-back" onclick="closeLightbox()" title="Tutup / Kembali ke Galeri (Esc)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
                <span class="back-text">Galeri</span>
            </button>

            <!-- Center: Title & Date (Apple Typography) -->
            <div class="lightbox-header-center">
                <div class="lightbox-title-row">
                    <span class="lightbox-title" id="lightbox-title">Loading...</span>
                    @auth
                    <button type="button" class="lightbox-inline-rename-btn" onclick="renameCurrentLightboxMedia()" title="Ganti Nama Judul">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    @endauth
                </div>
                <div class="lightbox-meta-row" id="lightbox-meta">
                    <span id="lightbox-date">-</span>
                    <span class="meta-dot">•</span>
                    <span id="lightbox-album">-</span>
                    <span class="meta-dot">•</span>
                    <span id="lightbox-size">-</span>
                </div>
            </div>

            <!-- Right: Slideshow, Fullscreen, Close & Counter -->
            <div class="lightbox-header-actions">
                <div class="lightbox-counter-pill" id="lightbox-counter">1 / 1</div>

                <!-- Slideshow Play / Pause -->
                <button type="button" class="lightbox-action-btn icon-only" id="lightbox-slideshow-btn" onclick="toggleLightboxSlideshow()" title="Slideshow Otomatis (S)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" id="slideshow-icon-svg">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </button>

                <!-- Fullscreen Toggle -->
                <button type="button" class="lightbox-action-btn icon-only" onclick="toggleLightboxFullscreen()" id="lightbox-fs-btn" title="Layar Penuh (F)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 3 21 3 21 9"/>
                        <polyline points="9 21 3 21 3 15"/>
                        <line x1="21" y1="3" x2="14" y2="10"/>
                        <line x1="3" y1="21" x2="10" y2="14"/>
                    </svg>
                </button>

                <!-- Close Button -->
                <button type="button" class="lightbox-action-btn close-btn icon-only" onclick="closeLightbox()" title="Tutup (Esc)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Media Stage & Inspector Drawer Wrapper -->
        <div class="lightbox-main-body">
            <div class="lightbox-stage">
                <button class="lightbox-nav-btn prev-btn" onclick="navigateLightbox(-1)" id="lightbox-prev" title="Sebelumnya (Panah Kiri)">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>

                <div class="lightbox-media-viewport" id="lightbox-media"></div>

                <button class="lightbox-nav-btn next-btn" onclick="navigateLightbox(1)" id="lightbox-next" title="Selanjutnya (Panah Kanan)">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
            </div>

            <!-- Slide-Over Metadata Info Drawer (Google / Apple Photos Style) -->
            <aside class="lightbox-info-drawer" id="lightbox-info-drawer" aria-label="Informasi Detail Media">
                <div class="drawer-header">
                    <h3 class="drawer-title">Info Media</h3>
                    <button type="button" class="drawer-close-btn" onclick="toggleLightboxInfoDrawer(false)">✕</button>
                </div>

                <div class="drawer-content">
                    <div class="info-section">
                        <h4 class="info-sec-title">Informasi Berkas</h4>
                        <div class="info-data-grid">
                            <div class="info-row">
                                <span class="info-label">Judul</span>
                                <span class="info-val" id="info-title">-</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Nama File Asli</span>
                                <span class="info-val" id="info-filename">-</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Format / Tipe</span>
                                <span class="info-val" id="info-type">-</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Ukuran Berkas</span>
                                <span class="info-val" id="info-size">-</span>
                            </div>
                            <div class="info-row" id="info-resolution-row">
                                <span class="info-label">Dimensi / Resolusi</span>
                                <span class="info-val" id="info-resolution">-</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Tanggal Unggah</span>
                                <span class="info-val" id="info-date">-</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Album</span>
                                <span class="info-val" id="info-album">-</span>
                            </div>
                        </div>
                    </div>

                    <div class="info-section">
                        <h4 class="info-sec-title">Keamanan &amp; Penyimpanan</h4>
                        <div class="info-storage-card">
                            <div class="storage-badge-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                    <polyline points="9 12 11 14 15 10"/>
                                </svg>
                            </div>
                            <div class="storage-badge-text">
                                <strong>Penyimpanan Google Drive</strong>
                                <p>Terenkripsi AES-256-CBC End-to-End dengan Private Encryption Key.</p>
                            </div>
                        </div>
                    </div>

                    <div class="info-actions-bottom">
                        <button type="button" class="btn btn-secondary btn-block" onclick="renameCurrentLightboxMedia()">
                            ✏️ Ubah Judul Media
                        </button>
                    </div>
                </div>
            </aside>
        </div>

        <!-- Apple Photos Bottom Section: Filmstrip Scroller & Floating Action Dock -->
        <div class="lightbox-bottom-section" id="lightbox-bottom-section">
            <!-- Filmstrip Scroller -->
            <div class="lightbox-filmstrip-bar" id="lightbox-filmstrip-bar" aria-label="Filmstrip Pratinjau Cepat">
                <div class="lightbox-filmstrip-track" id="lightbox-filmstrip-track">
                    <!-- Dynamic mini thumbnails injected via JS -->
                </div>
            </div>

            <!-- Apple Photos Action Dock -->
            <div class="lightbox-apple-dock" id="lightbox-apple-dock">
                <!-- Share / Copy Link -->
                <button type="button" class="dock-btn" onclick="shareCurrentLightboxMedia()" title="Salin Tautan Media">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                        <polyline points="16 6 12 2 8 6"/>
                        <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                    <span>Bagikan</span>
                </button>

                <!-- Favorite Toggle Button -->
                <button type="button" class="dock-btn" id="lightbox-favorite-btn" onclick="toggleCurrentLightboxFavorite()" title="Favorit (Tombol L / Spasi)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="lightbox-favorite-icon">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span>Favorit</span>
                </button>

                <!-- Info Drawer Toggle -->
                <button type="button" class="dock-btn" id="lightbox-info-btn" onclick="toggleLightboxInfoDrawer()" title="Detail & Info Media (I)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>Info</span>
                </button>

                <!-- Download Button -->
                <a href="#" class="dock-btn" id="lightbox-download-btn" download title="Unduh File Asli (D)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Unduh</span>
                </a>

                @auth
                <!-- Move to Album Button -->
                <button type="button" class="dock-btn" id="lightbox-move-btn" onclick="moveCurrentLightboxMedia()" title="Pindahkan ke Album Lain">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Pindah</span>
                </button>

                <!-- Copy to Album Button -->
                <button type="button" class="dock-btn" id="lightbox-copy-btn" onclick="copyCurrentLightboxMedia()" title="Salin ke Album Lain">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Salin</span>
                </button>

                <!-- Delete Button -->
                <button type="button" class="dock-btn dock-btn-danger" id="lightbox-delete-btn" onclick="deleteCurrentLightboxMedia()" title="Hapus Foto/Video (Del)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    <span>Hapus</span>
                </button>
                @endauth
            </div>
        </div>

        <!-- Bottom Keyboard Shortcuts Hint -->
        <div class="lightbox-bottom-hint">
            <span><strong>D</strong> Unduh</span>
            <span class="hint-dot">•</span>
            <span><strong>F</strong> Fullscreen</span>
            <span class="hint-dot">•</span>
            <span><strong>I</strong> Info</span>
            <span class="hint-dot">•</span>
            <span><strong>S</strong> Slideshow</span>
            <span class="hint-dot">•</span>
            <span><strong>&larr; / &rarr;</strong> Navigasi</span>
            <span class="hint-dot">•</span>
            <span><strong>Esc</strong> Tutup</span>
            @auth
            <span class="hint-dot">•</span>
            <span><strong>Del</strong> Hapus</span>
            @endauth
        </div>
    </div>

    @auth
    <!-- Mobile Bottom Navigation Bar (Native iOS / Android Style) -->
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Navigasi Mobile">
        <a href="{{ route('gallery.index') }}" class="mobile-nav-item {{ request()->routeIs('gallery.index') ? 'active' : '' }}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Galeri</span>
        </a>

        <a href="{{ route('gallery.albums') }}" class="mobile-nav-item {{ request()->routeIs('gallery.album*') ? 'active' : '' }}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Album</span>
        </a>

        <a href="{{ route('admin.media.create') }}" class="mobile-nav-item upload-center {{ request()->routeIs('admin.media.create') ? 'active' : '' }}" title="Unggah Media">
            <div class="mobile-upload-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </div>
            <span>Unggah</span>
        </a>

        <a href="{{ route('admin.media.index') }}" class="mobile-nav-item {{ request()->routeIs('admin.media.index') ? 'active' : '' }}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span>Kelola</span>
        </a>

        <a href="{{ route('admin.settings') }}" class="mobile-nav-item {{ request()->routeIs('admin.settings*') ? 'active' : '' }}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Setelan</span>
        </a>
    </nav>
    @endauth

    <script src="{{ asset('js/app.js') }}?v={{ file_exists(public_path('js/app.js')) ? filemtime(public_path('js/app.js')) : time() }}"></script>
    @stack('scripts')
</body>
</html>
