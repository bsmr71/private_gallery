/* ============================================================
   MEDIA GALLERY — JavaScript
   Lightbox, Drag & Drop Upload, Infinite Scroll, Lazy Loading
   ============================================================ */

// CSRF Token for AJAX requests
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

// ============================================================
// LIGHTBOX
// ============================================================
let lightboxItems = [];
let lightboxIndex = 0;
let isSlideshowActive = false;
let slideshowTimer = null;

function openLightbox(index) {
    lightboxIndex = index;
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    lightbox.classList.remove('chrome-hidden');
    buildLightboxFilmstrip();
    updateLightboxContent();
    requestAnimationFrame(() => lightbox.classList.add('active'));
}

function closeLightbox() {
    stopLightboxSlideshow();
    toggleLightboxInfoDrawer(false);
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('active');
    lightbox.classList.remove('chrome-hidden');
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
    // Stop any playing video
    const video = lightbox.querySelector('video');
    if (video) video.pause();
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
}

function navigateLightbox(direction) {
    if (lightboxItems.length === 0) return;
    lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    updateLightboxContent();

    if (isSlideshowActive) {
        resetSlideshowTimer();
    }
}

function jumpToLightbox(index) {
    if (index < 0 || index >= lightboxItems.length) return;
    lightboxIndex = index;
    updateLightboxContent();

    if (isSlideshowActive) {
        resetSlideshowTimer();
    }
}

let isFilmstripMinimized = localStorage.getItem('gallery_filmstrip_minimized') === 'true';

function applyFilmstripMinimizedState() {
    const container = document.getElementById('lightbox-filmstrip-container');
    const bar = document.getElementById('lightbox-filmstrip-bar');
    const restorePill = document.getElementById('filmstrip-restore-pill');
    const restoreText = document.getElementById('filmstrip-restore-text');
    const toggleDockBtn = document.getElementById('lightbox-filmstrip-toggle-dock');

    if (!bar) return;

    if (lightboxItems.length <= 1) {
        if (container) container.style.display = 'none';
        else bar.style.display = 'none';
        if (toggleDockBtn) toggleDockBtn.style.display = 'none';
        return;
    }
    if (container) container.style.display = 'flex';
    if (toggleDockBtn) toggleDockBtn.style.display = 'flex';

    if (isFilmstripMinimized) {
        bar.classList.add('minimized');
        if (restorePill) {
            restorePill.classList.add('visible');
            if (restoreText) {
                restoreText.textContent = `Pratinjau (${lightboxIndex + 1}/${lightboxItems.length})`;
            }
        }
        if (toggleDockBtn) {
            toggleDockBtn.classList.remove('active');
            toggleDockBtn.title = 'Tampilkan Pratinjau Foto (Spasi / T)';
        }
    } else {
        bar.classList.remove('minimized');
        if (restorePill) restorePill.classList.remove('visible');
        if (toggleDockBtn) {
            toggleDockBtn.classList.add('active');
            toggleDockBtn.title = 'Minimalkan Pratinjau Foto (Spasi / T)';
        }
    }
}

function minimizeLightboxFilmstrip() {
    isFilmstripMinimized = true;
    localStorage.setItem('gallery_filmstrip_minimized', 'true');
    applyFilmstripMinimizedState();
}

function expandLightboxFilmstrip() {
    isFilmstripMinimized = false;
    localStorage.setItem('gallery_filmstrip_minimized', 'false');
    applyFilmstripMinimizedState();
    updateLightboxFilmstrip();
}

function toggleLightboxFilmstrip(force) {
    if (typeof force === 'boolean') {
        isFilmstripMinimized = !force;
    } else {
        isFilmstripMinimized = !isFilmstripMinimized;
    }
    localStorage.setItem('gallery_filmstrip_minimized', isFilmstripMinimized ? 'true' : 'false');
    applyFilmstripMinimizedState();
    if (!isFilmstripMinimized) {
        updateLightboxFilmstrip();
    }
}

function buildLightboxFilmstrip() {
    const track = document.getElementById('lightbox-filmstrip-track');
    const bar = document.getElementById('lightbox-filmstrip-bar');
    if (!track || !bar) return;

    if (lightboxItems.length <= 1) {
        bar.style.display = 'none';
        applyFilmstripMinimizedState();
        return;
    }
    bar.style.display = 'flex';
    applyFilmstripMinimizedState();

    track.innerHTML = '';
    lightboxItems.forEach((item, idx) => {
        const thumb = document.createElement('div');
        thumb.className = `filmstrip-item ${idx === lightboxIndex ? 'active' : ''}`;
        thumb.dataset.index = idx;
        thumb.title = item.title || `Item ${idx + 1}`;

        if (item.type === 'video') {
            const videoBadge = document.createElement('span');
            videoBadge.className = 'filmstrip-video-indicator';
            videoBadge.innerHTML = '▶';
            thumb.appendChild(videoBadge);
        }

        const img = document.createElement('img');
        img.src = item.thumbnailUrl || item.streamUrl;
        img.alt = item.title || '';
        img.loading = 'lazy';
        thumb.appendChild(img);

        thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            jumpToLightbox(idx);
        });

        track.appendChild(thumb);
    });
}

function updateLightboxFilmstrip() {
    const track = document.getElementById('lightbox-filmstrip-track');
    if (!track) return;

    // Sync active class
    const items = track.querySelectorAll('.filmstrip-item');
    items.forEach((item, idx) => {
        if (idx === lightboxIndex) {
            item.classList.add('active');
            item.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        } else {
            item.classList.remove('active');
        }
    });

    const restoreText = document.getElementById('filmstrip-restore-text');
    if (restoreText) {
        restoreText.textContent = `Pratinjau (${lightboxIndex + 1}/${lightboxItems.length})`;
    }
}

function updateLightboxContent() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;

    const mediaContainer = document.getElementById('lightbox-media');
    const titleEl = document.getElementById('lightbox-title');
    const sizeEl = document.getElementById('lightbox-size');
    const albumEl = document.getElementById('lightbox-album');
    const dateEl = document.getElementById('lightbox-date');
    const counterEl = document.getElementById('lightbox-counter');
    const downloadBtn = document.getElementById('lightbox-download-btn');
    const favBtn = document.getElementById('lightbox-favorite-btn');
    const favIcon = document.getElementById('lightbox-favorite-icon');

    if (titleEl) titleEl.textContent = item.title;
    if (sizeEl) sizeEl.textContent = item.size || '';
    if (albumEl) {
        albumEl.textContent = item.album ? item.album : 'Tanpa Album';
        albumEl.style.display = 'inline';
    }
    if (dateEl) dateEl.textContent = item.created_date || item.created_at || '';
    if (counterEl) counterEl.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;

    // Update Favorite Icon
    if (favBtn && favIcon) {
        if (item.is_favorite) {
            favBtn.classList.add('is-active');
            favIcon.setAttribute('fill', '#ef4444');
            favIcon.setAttribute('stroke', '#ef4444');
        } else {
            favBtn.classList.remove('is-active');
            favIcon.setAttribute('fill', 'none');
            favIcon.setAttribute('stroke', 'currentColor');
        }
    }

    if (downloadBtn) {
        const url = item.downloadUrl || `/media/${item.id}/download`;
        downloadBtn.href = url;
        downloadBtn.setAttribute('download', item.original_filename || item.title || 'media');
    }

    if (item.type === 'video') {
        mediaContainer.innerHTML = `
            <div class="lightbox-video-frame">
                <video class="lightbox-video-element" controls autoplay preload="auto" playsinline>
                    <source src="${item.streamUrl}" type="${item.mimeType || 'video/mp4'}">
                    Browser Anda tidak mendukung pemutaran video langsung.
                </video>
            </div>
        `;
        const vid = mediaContainer.querySelector('video');
        if (vid) {
            vid.addEventListener('loadedmetadata', () => {
                const resEl = document.getElementById('info-resolution');
                if (resEl && vid.videoWidth) {
                    resEl.textContent = `${vid.videoWidth} × ${vid.videoHeight} px`;
                }
            });
        }
    } else {
        mediaContainer.innerHTML = `
            <div class="lightbox-image-frame">
                <img src="${item.streamUrl}" alt="${item.title}" class="lightbox-image-element" loading="eager">
            </div>
        `;
        const img = mediaContainer.querySelector('img');
        if (img) {
            img.addEventListener('load', () => {
                const resEl = document.getElementById('info-resolution');
                if (resEl && img.naturalWidth) {
                    resEl.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
                }
            });
        }
    }

    // Update filmstrip highlight & center scroll
    updateLightboxFilmstrip();

    // Update info drawer if currently open
    updateLightboxInfoDrawer(item);

    // Update nav visibility
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    if (prevBtn) prevBtn.style.display = lightboxItems.length > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = lightboxItems.length > 1 ? 'flex' : 'none';
}

function toggleLightboxFullscreen() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    if (!document.fullscreenElement) {
        lightbox.requestFullscreen().catch(err => {
            console.warn('Fullscreen error', err);
        });
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

// Info / Metadata Drawer
function toggleLightboxInfoDrawer(forceState) {
    const drawer = document.getElementById('lightbox-info-drawer');
    const btn = document.getElementById('lightbox-info-btn');
    if (!drawer) return;

    const isOpen = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');
    drawer.classList.toggle('open', isOpen);
    if (btn) btn.classList.toggle('is-active', isOpen);

    if (isOpen && lightboxItems[lightboxIndex]) {
        updateLightboxInfoDrawer(lightboxItems[lightboxIndex]);
    }
}

function updateLightboxInfoDrawer(item) {
    const drawer = document.getElementById('lightbox-info-drawer');
    if (!drawer || !drawer.classList.contains('open')) return;

    const title = document.getElementById('info-title');
    const filename = document.getElementById('info-filename');
    const type = document.getElementById('info-type');
    const size = document.getElementById('info-size');
    const date = document.getElementById('info-date');
    const album = document.getElementById('info-album');

    if (title) title.textContent = item.title || '-';
    if (filename) filename.textContent = item.original_filename || '-';
    if (type) type.textContent = (item.mimeType || item.type || '-').toUpperCase();
    if (size) size.textContent = item.size || '-';
    if (date) date.textContent = item.created_at || item.created_date || '-';
    if (album) album.textContent = item.album || 'Tanpa Album (Umum)';
}

// Slideshow
function toggleLightboxSlideshow() {
    isSlideshowActive = !isSlideshowActive;
    const btn = document.getElementById('lightbox-slideshow-btn');
    const prog = document.getElementById('slideshow-progress');
    const icon = document.getElementById('slideshow-icon-svg');

    if (isSlideshowActive) {
        if (btn) btn.classList.add('is-active');
        if (prog) {
            prog.style.display = 'block';
            startSlideshowAnimation();
        }
        if (icon) {
            icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        }
        showNotification('Slideshow dimulai ▶️ (Tekan S untuk jeda)', 'success');
        slideshowTimer = setTimeout(() => {
            navigateLightbox(1);
        }, 4500);
    } else {
        stopLightboxSlideshow();
        showNotification('Slideshow dijeda ⏸️', 'info');
    }
}

function startSlideshowAnimation() {
    const fill = document.querySelector('.slideshow-fill');
    if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        requestAnimationFrame(() => {
            fill.style.transition = 'width 4.5s linear';
            fill.style.width = '100%';
        });
    }
}

function resetSlideshowTimer() {
    if (!isSlideshowActive) return;
    clearTimeout(slideshowTimer);
    startSlideshowAnimation();
    slideshowTimer = setTimeout(() => {
        navigateLightbox(1);
    }, 4500);
}

function stopLightboxSlideshow() {
    isSlideshowActive = false;
    clearTimeout(slideshowTimer);
    const btn = document.getElementById('lightbox-slideshow-btn');
    const prog = document.getElementById('slideshow-progress');
    const icon = document.getElementById('slideshow-icon-svg');
    if (btn) btn.classList.remove('is-active');
    if (prog) prog.style.display = 'none';
    if (icon) {
        icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
}

// Keyboard navigation & shortcuts
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || lightbox.style.display === 'none') return;

    // Ignore if typing inside input/textarea
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    switch (e.key) {
        case 'Escape':
            const drawer = document.getElementById('lightbox-info-drawer');
            if (drawer && drawer.classList.contains('open')) {
                toggleLightboxInfoDrawer(false);
            } else {
                closeLightbox();
            }
            break;
        case 'ArrowLeft':
            navigateLightbox(-1);
            break;
        case 'ArrowRight':
            navigateLightbox(1);
            break;
        case 'f':
        case 'F':
            toggleLightboxFullscreen();
            break;
        case 'i':
        case 'I':
            toggleLightboxInfoDrawer();
            break;
        case 's':
        case 'S':
            toggleLightboxSlideshow();
            break;
        case 'l':
        case 'L':
            toggleCurrentLightboxFavorite();
            break;
        case 't':
        case 'T':
            toggleLightboxFilmstrip();
            break;
        case 'd':
        case 'D':
            const dlBtn = document.getElementById('lightbox-download-btn');
            if (dlBtn && dlBtn.href) {
                window.location.href = dlBtn.href;
            }
            break;
        case 'Delete':
        case 'Backspace':
            deleteCurrentLightboxMedia();
            break;
    }
});

// ============================================================
// MEDIA GRID — Initialize lightbox items
// ============================================================
function initMediaGrid() {
    lightboxItems = [];
    document.querySelectorAll('.media-card[data-media]').forEach((card, idx) => {
        try {
            const data = JSON.parse(card.dataset.media);
            lightboxItems.push(data);
            card.addEventListener('click', (e) => {
                if (isSelectionMode) {
                    toggleCardSelection(data.id, e);
                    return;
                }
                // Don't open lightbox if clicking action buttons or links
                if (e.target.closest('.card-action-btn') ||
                    e.target.closest('.card-select-checkbox') ||
                    e.target.closest('.card-favorite-badge') ||
                    e.target.closest('.card-quick-actions') ||
                    e.target.closest('a') ||
                    e.target.closest('button')) {
                    return;
                }
                openLightbox(idx);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isSelectionMode) {
                        toggleCardSelection(data.id, e);
                    } else {
                        openLightbox(idx);
                    }
                }
            });
        } catch (err) {
            console.error('Invalid media data', err);
        }
    });
}

// ============================================================
// LAZY LOADING IMAGES
// ============================================================
function initLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    img.addEventListener('load', () => img.classList.add('loaded'));
                    observer.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });

        lazyImages.forEach(img => observer.observe(img));
    } else {
        // Fallback
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
}

// ============================================================
// DRAG & DROP UPLOAD
// ============================================================
function initUploadZone() {
    const zone = document.getElementById('upload-zone');
    if (!zone) return;

    const input = zone.querySelector('input[type="file"]');
    const progressList = document.getElementById('upload-progress-list');

    ['dragenter', 'dragover'].forEach(event => {
        zone.addEventListener(event, (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        zone.addEventListener(event, (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
        });
    });

    zone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });

    if (input) {
        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                handleFileUpload(input.files);
            }
        });
    }
}

function handleFileUpload(files) {
    const progressList = document.getElementById('upload-progress-list');
    const albumId = document.getElementById('upload-album')?.value || '';

    Array.from(files).forEach((file) => {
        // Validate file type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            showNotification(`"${file.name}" is not a valid image or video file.`, 'error');
            return;
        }

        // Create progress item
        const item = document.createElement('div');
        item.className = 'upload-progress-item';
        item.innerHTML = `
            <span class="upload-progress-name">${file.name}</span>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
            <span class="upload-progress-status">0%</span>
        `;
        progressList.appendChild(item);

        const fill = item.querySelector('.upload-progress-fill');
        const status = item.querySelector('.upload-progress-status');

        // Upload via AJAX
        const formData = new FormData();
        formData.append('files[]', file);
        if (albumId) formData.append('album_id', albumId);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/admin/media');

        xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                fill.style.width = percent + '%';
                status.textContent = percent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                fill.style.width = '100%';
                status.textContent = '✓';
                status.className = 'upload-progress-status success';
                item.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            } else {
                status.textContent = '✗';
                status.className = 'upload-progress-status error';
                item.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                try {
                    const resp = JSON.parse(xhr.responseText);
                    showNotification(resp.message || 'Upload failed', 'error');
                } catch (e) {
                    showNotification('Upload failed: ' + file.name, 'error');
                }
            }
        });

        xhr.addEventListener('error', () => {
            status.textContent = '✗';
            status.className = 'upload-progress-status error';
            showNotification('Network error uploading: ' + file.name, 'error');
        });

        xhr.send(formData);
    });
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function showNotification(message, type = 'success') {
    const container = document.querySelector('.main-content');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        ${message}
        <button onclick="this.parentElement.remove()" class="alert-close">×</button>
    `;
    container.insertBefore(alert, container.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 300);
        }
    }, 5000);
}

// ============================================================
// DELETE CONFIRMATION & ACTIONS (GALLERY, LIGHTBOX, ADMIN)
// ============================================================
function confirmDelete(url, name) {
    if (confirm(`Yakin ingin menghapus "${name}"?\n\nFoto/video ini akan dihapus dari Google Drive dan database.`)) {
        fetch(url, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': csrfToken,
                'Accept': 'application/json',
            },
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showNotification(data.message || 'Berhasil dihapus!', 'success');
                setTimeout(() => location.reload(), 600);
            } else {
                showNotification(data.error || 'Gagal menghapus', 'error');
            }
        })
        .catch(() => showNotification('Terjadi kesalahan jaringan saat menghapus', 'error'));
    }
}

function deleteGalleryItem(id, url, title) {
    if (!confirm(`Yakin ingin menghapus "${title}"?\n\nBerkas akan dihapus permanen dari Google Drive dan database.`)) {
        return;
    }

    const card = document.getElementById(`media-item-${id}`) || document.querySelector(`.media-card[data-media*='"id":${id}']`);
    if (card) {
        card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
    }

    fetch(url, {
        method: 'DELETE',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Media berhasil dihapus!', 'success');
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.85)';
                setTimeout(() => {
                    card.remove();
                    // Update lightboxItems array
                    lightboxItems = lightboxItems.filter(item => item.id != id);
                    // Check if gallery is now empty
                    const remaining = document.querySelectorAll('.media-card');
                    if (remaining.length === 0) {
                        location.reload();
                    }
                }, 320);
            }
        } else {
            if (card) {
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            }
            showNotification(data.error || 'Gagal menghapus media', 'error');
        }
    })
    .catch(() => {
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
        showNotification('Terjadi kesalahan jaringan saat menghapus media', 'error');
    });
}

function deleteCurrentLightboxMedia() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;

    const url = item.deleteUrl || `/admin/media/${item.id}`;
    if (!confirm(`Yakin ingin menghapus "${item.title}"?\n\nBerkas akan dihapus permanen dari Google Drive dan database.`)) {
        return;
    }

    const deleteBtn = document.getElementById('lightbox-delete-btn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.5';
    }

    fetch(url, {
        method: 'DELETE',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    })
    .then(res => res.json())
    .then(data => {
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = '1';
        }

        if (data.success) {
            showNotification(data.message || 'Media berhasil dihapus!', 'success');

            // Remove card from DOM
            const card = document.getElementById(`media-item-${item.id}`) || document.querySelector(`.media-card[data-media*='"id":${item.id}']`);
            if (card) card.remove();

            // Remove from lightboxItems array
            lightboxItems.splice(lightboxIndex, 1);

            if (lightboxItems.length === 0) {
                closeLightbox();
                setTimeout(() => location.reload(), 500);
            } else {
                lightboxIndex = lightboxIndex % lightboxItems.length;
                updateLightboxContent();
            }
        } else {
            showNotification(data.error || 'Gagal menghapus media', 'error');
        }
    })
    .catch(() => {
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = '1';
        }
        showNotification('Terjadi kesalahan jaringan saat menghapus media', 'error');
    });
}

// ============================================================
// ADMIN: EDIT MEDIA MODAL
// ============================================================
function openEditModal(mediaId, title, description, albumId) {
    // Create modal dynamically
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Edit Media</h3>
                <button class="modal-close" onclick="document.getElementById('edit-modal').remove()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <form id="edit-form">
                <div class="form-group">
                    <label class="form-label">Title</label>
                    <input type="text" class="form-input" name="title" value="${escapeHtml(title)}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" name="description">${escapeHtml(description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Album</label>
                    <select class="form-select" name="album_id" id="edit-album-select">
                        <option value="">No Album</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Populate album select
    const select = document.getElementById('edit-album-select');
    document.querySelectorAll('#album-options option').forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.textContent;
        if (opt.value == albumId) option.selected = true;
        select.appendChild(option);
    });

    // Handle form submit
    document.getElementById('edit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        fetch(`/admin/media/${mediaId}`, {
            method: 'PUT',
            headers: {
                'X-CSRF-TOKEN': csrfToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(Object.fromEntries(formData)),
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showNotification('Media updated!', 'success');
                modal.remove();
                setTimeout(() => location.reload(), 1000);
            }
        })
        .catch(() => showNotification('Update failed', 'error'));
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// MULTI-SELECTION MODE & FLOATING ACTION BAR
// ============================================================
let isSelectionMode = false;
let selectedMediaIds = new Set();

function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    const btn = document.getElementById('btn-toggle-select');
    const label = document.getElementById('select-mode-text');

    if (isSelectionMode) {
        document.body.classList.add('selection-active');
        if (btn) btn.classList.add('active');
        if (label) label.textContent = 'Selesai';
        showNotification('Mode seleksi aktif. Klik foto untuk memilih.', 'info');
    } else {
        exitSelectionMode();
    }
}

function toggleCardSelection(id, event) {
    if (event) event.stopPropagation();

    id = parseInt(id, 10);
    const card = document.getElementById(`media-item-${id}`);

    if (selectedMediaIds.has(id)) {
        selectedMediaIds.delete(id);
        if (card) card.classList.remove('is-selected');
    } else {
        selectedMediaIds.add(id);
        if (card) card.classList.add('is-selected');
        // Auto-activate selection mode if user clicked checkbox directly
        if (!isSelectionMode) {
            isSelectionMode = true;
            document.body.classList.add('selection-active');
            const btn = document.getElementById('btn-toggle-select');
            const label = document.getElementById('select-mode-text');
            if (btn) btn.classList.add('active');
            if (label) label.textContent = 'Selesai';
        }
    }

    updateSelectionBarUI();
}

function updateSelectionBarUI() {
    const bar = document.getElementById('floating-selection-bar');
    const badge = document.getElementById('selection-count-badge');
    const selectAllLabel = document.getElementById('select-all-label');
    const count = selectedMediaIds.size;

    if (!bar) return;

    if (count > 0) {
        bar.style.display = 'block';
        if (badge) badge.textContent = count;
    } else {
        bar.style.display = 'none';
    }

    const allCards = document.querySelectorAll('.media-card');
    if (selectAllLabel) {
        selectAllLabel.textContent = (count > 0 && count >= allCards.length) ? 'Batal' : 'Semua';
    }
}

function toggleSelectAll() {
    const allCards = document.querySelectorAll('.media-card');
    if (selectedMediaIds.size >= allCards.length) {
        // Deselect all
        selectedMediaIds.clear();
        allCards.forEach(c => c.classList.remove('is-selected'));
    } else {
        // Select all
        allCards.forEach(c => {
            const id = parseInt(c.dataset.id, 10);
            if (id) {
                selectedMediaIds.add(id);
                c.classList.add('is-selected');
            }
        });
    }
    updateSelectionBarUI();
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedMediaIds.clear();
    document.body.classList.remove('selection-active');
    document.querySelectorAll('.media-card.is-selected').forEach(c => c.classList.remove('is-selected'));

    const bar = document.getElementById('floating-selection-bar');
    if (bar) bar.style.display = 'none';

    const btn = document.getElementById('btn-toggle-select');
    const label = document.getElementById('select-mode-text');
    if (btn) btn.classList.remove('active');
    if (label) label.textContent = 'Pilih';
}

// ============================================================
// MOVE & COPY TO ALBUM
// ============================================================
function openMoveCopyModal(ids, titleHint, currentAlbumId, defaultMode = 'move') {
    if (!ids || ids.length === 0) return;

    const modal = document.getElementById('organize-modal');
    if (!modal) return;

    document.getElementById('organize-mode').value = defaultMode;
    document.getElementById('organize-media-ids').value = JSON.stringify(ids);

    const titleEl = document.getElementById('organize-modal-title');
    const subtitleEl = document.getElementById('organize-modal-subtitle');
    const submitText = document.getElementById('organize-submit-text');
    const count = ids.length;

    if (defaultMode === 'move') {
        if (titleEl) titleEl.textContent = `Pindahkan ${count > 1 ? count + ' Media' : 'Foto'} ke Album`;
        if (subtitleEl) subtitleEl.textContent = `Foto akan dipindahkan ke album yang Anda pilih`;
        if (submitText) submitText.textContent = 'Pindahkan';
    } else {
        if (titleEl) titleEl.textContent = `Salin / Duplikasi ${count > 1 ? count + ' Media' : 'Foto'} ke Album`;
        if (subtitleEl) subtitleEl.textContent = `Foto akan diduplikasi ke album yang Anda pilih`;
        if (submitText) submitText.textContent = 'Salin ke Album';
    }

    // Populate radio selection
    const radios = document.querySelectorAll('input[name="target_album_id"]');
    radios.forEach(radio => {
        if (currentAlbumId && radio.value == currentAlbumId) {
            radio.checked = true;
        } else if (!currentAlbumId && radio.value === 'none') {
            radio.checked = true;
        }
    });

    const newAlbumInput = document.getElementById('organize-new-album-name');
    if (newAlbumInput) newAlbumInput.value = '';

    modal.style.display = 'flex';
}

function openMoveCopyFromSelection(mode) {
    if (selectedMediaIds.size === 0) {
        showNotification('Pilih setidaknya 1 foto/video terlebih dahulu', 'error');
        return;
    }
    openMoveCopyModal(Array.from(selectedMediaIds), '', null, mode);
}

function closeMoveCopyModal() {
    const modal = document.getElementById('organize-modal');
    if (modal) modal.style.display = 'none';
}

function submitMoveCopyForm(event) {
    event.preventDefault();

    const mode = document.getElementById('organize-mode').value;
    const ids = JSON.parse(document.getElementById('organize-media-ids').value || '[]');
    const selectedRadio = document.querySelector('input[name="target_album_id"]:checked');
    const targetAlbumId = selectedRadio ? selectedRadio.value : 'none';
    const newAlbumName = document.getElementById('organize-new-album-name')?.value || '';

    const submitBtn = document.getElementById('organize-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
    }

    const endpoint = mode === 'copy' ? '/media/copy-album' : '/media/move-album';

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            media_ids: ids,
            album_id: targetAlbumId,
            new_album_name: newAlbumName,
        }),
    })
    .then(res => res.json())
    .then(data => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }

        if (data.success) {
            showNotification(data.message || 'Berhasil disimpan!', 'success');
            closeMoveCopyModal();
            exitSelectionMode();

            // Refresh page to display updated albums and media
            setTimeout(() => location.reload(), 700);
        } else {
            showNotification(data.error || 'Gagal memproses permintaan', 'error');
        }
    })
    .catch(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
        showNotification('Terjadi kesalahan jaringan', 'error');
    });
}

function moveCurrentLightboxMedia() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    openMoveCopyModal([item.id], item.title, item.album_id, 'move');
}

function copyCurrentLightboxMedia() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    openMoveCopyModal([item.id], item.title, item.album_id, 'copy');
}

// ============================================================
// QUICK RENAME
// ============================================================
function openQuickRenameModal(id, title, url) {
    const modal = document.getElementById('rename-modal');
    if (!modal) return;

    document.getElementById('rename-media-id').value = id;
    document.getElementById('rename-url').value = url || `/media/${id}/quick-rename`;
    document.getElementById('rename-input-title').value = title || '';
    document.getElementById('rename-input-desc').value = '';

    modal.style.display = 'flex';
    setTimeout(() => {
        document.getElementById('rename-input-title')?.focus();
        document.getElementById('rename-input-title')?.select();
    }, 100);
}

function renameCurrentLightboxMedia() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    openQuickRenameModal(item.id, item.title, item.renameUrl);
}

function closeQuickRenameModal() {
    const modal = document.getElementById('rename-modal');
    if (modal) modal.style.display = 'none';
}

function submitQuickRenameForm(event) {
    event.preventDefault();

    const id = document.getElementById('rename-media-id').value;
    const url = document.getElementById('rename-url').value;
    const title = document.getElementById('rename-input-title').value;
    const desc = document.getElementById('rename-input-desc').value;

    const btn = document.getElementById('rename-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
    }

    fetch(url, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, description: desc }),
    })
    .then(res => res.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }

        if (data.success) {
            showNotification(data.message || 'Judul berhasil diperbarui!', 'success');
            closeQuickRenameModal();

            // Update DOM title on card
            const titleEl = document.getElementById(`media-card-title-${id}`);
            if (titleEl) titleEl.textContent = title;

            // Update active lightbox item if open
            if (lightboxItems[lightboxIndex] && lightboxItems[lightboxIndex].id == id) {
                lightboxItems[lightboxIndex].title = title;
                lightboxItems[lightboxIndex].description = desc;
                const lt = document.getElementById('lightbox-title');
                if (lt) lt.textContent = title;
                const it = document.getElementById('info-title');
                if (it) it.textContent = title;
            }
        } else {
            showNotification(data.error || 'Gagal mengubah judul', 'error');
        }
    })
    .catch(() => {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
        showNotification('Terjadi kesalahan jaringan', 'error');
    });
}

// ============================================================
// FAVORITES (❤️)
// ============================================================
function toggleItemFavorite(id, url, btnElement) {
    url = url || `/media/${id}/favorite`;

    fetch(url, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const isFav = data.is_favorite;

            if (btnElement) {
                btnElement.classList.toggle('is-active', isFav);
                const svg = btnElement.querySelector('svg');
                if (svg) {
                    svg.setAttribute('fill', isFav ? '#ef4444' : 'none');
                    svg.setAttribute('stroke', isFav ? '#ef4444' : 'currentColor');
                }
            }

            // Sync with Lightbox items
            const found = lightboxItems.find(it => it.id == id);
            if (found) {
                found.is_favorite = isFav;
                if (lightboxItems[lightboxIndex] && lightboxItems[lightboxIndex].id == id) {
                    const favBtn = document.getElementById('lightbox-favorite-btn');
                    const favIcon = document.getElementById('lightbox-favorite-icon');
                    if (favBtn && favIcon) {
                        favBtn.classList.toggle('is-active', isFav);
                        favIcon.setAttribute('fill', isFav ? '#ef4444' : 'none');
                        favIcon.setAttribute('stroke', isFav ? '#ef4444' : 'currentColor');
                    }
                }
            }

            showNotification(data.message, 'success');
        } else {
            showNotification(data.error || 'Gagal memperbarui status favorit', 'error');
        }
    })
    .catch(() => showNotification('Terjadi kesalahan jaringan', 'error'));
}

function toggleCurrentLightboxFavorite() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;

    const url = item.favoriteUrl || `/media/${item.id}/favorite`;
    const btn = document.getElementById('lightbox-favorite-btn');

    toggleItemFavorite(item.id, url, btn);

    // Also update the card badge on the wall
    const cardBadge = document.querySelector(`#media-item-${item.id} .card-favorite-badge`);
    if (cardBadge) {
        cardBadge.classList.toggle('is-active', !item.is_favorite);
        const svg = cardBadge.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', !item.is_favorite ? '#ef4444' : 'none');
            svg.setAttribute('stroke', !item.is_favorite ? '#ef4444' : 'currentColor');
        }
    }
}

// ============================================================
// SHARE & COPY LINK (🔗)
// ============================================================
function copyMediaLink(url) {
    const fullUrl = new URL(url, window.location.origin).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl)
            .then(() => showNotification('Tautan media disalin ke clipboard! 📋', 'success'))
            .catch(() => fallbackCopyText(fullUrl));
    } else {
        fallbackCopyText(fullUrl);
    }
}

function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showNotification('Tautan disalin ke clipboard! 📋', 'success');
    } catch {
        showNotification('Gagal menyalin tautan', 'error');
    }
    document.body.removeChild(ta);
}

function shareCurrentLightboxMedia() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    copyMediaLink(item.streamUrl || item.downloadUrl);
}

// ============================================================
// BATCH DELETE FROM SELECTION
// ============================================================
function batchDeleteSelected() {
    const ids = Array.from(selectedMediaIds);
    if (ids.length === 0) {
        showNotification('Pilih media yang ingin dihapus', 'error');
        return;
    }

    if (!confirm(`Yakin ingin menghapus ${ids.length} media terpilih?\n\nBerkas akan dihapus permanen dari Google Drive dan database.`)) {
        return;
    }

    fetch('/admin/media/batch-delete', {
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
            showNotification(data.message || `${ids.length} media berhasil dihapus!`, 'success');
            ids.forEach(id => {
                const card = document.getElementById(`media-item-${id}`);
                if (card) card.remove();
            });
            exitSelectionMode();
            const remaining = document.querySelectorAll('.media-card');
            if (remaining.length === 0) {
                location.reload();
            }
        } else {
            showNotification(data.error || 'Gagal menghapus media terpilih', 'error');
        }
    })
    .catch(() => showNotification('Terjadi kesalahan jaringan', 'error'));
}

// ============================================================
// GALLERY: FILTER BUTTONS
// ============================================================
function initFilters() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = new URL(window.location);
            const filter = btn.dataset.filter;
            const value = btn.dataset.value;

            if (btn.classList.contains('active')) {
                url.searchParams.delete(filter);
            } else {
                url.searchParams.set(filter, value);
            }

            window.location = url;
        });
    });

    // Search input
    const searchInput = document.getElementById('gallery-search');
    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const url = new URL(window.location);
                if (searchInput.value) {
                    url.searchParams.set('search', searchInput.value);
                } else {
                    url.searchParams.delete('search');
                }
                window.location = url;
            }, 500);
        });
    }
}

// ============================================================
// STAGGERED ANIMATION
// ============================================================
function initCardAnimations() {
    document.querySelectorAll('.media-card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
    });
}

// ============================================================
// AUTO-DISMISS ALERTS
// ============================================================
function initAlerts() {
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                alert.style.opacity = '0';
                alert.style.transform = 'translateY(-10px)';
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    });
}

// ============================================================
// THEME SWITCHER (DARK / LIGHT MODE)
// ============================================================
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('gallery_theme', next);
}

if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('gallery_theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
}

// ============================================================
// MOBILE TOUCH GESTURES (SWIPE NAVIGATION IN LIGHTBOX)
// ============================================================
function initLightboxTouchGestures() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let touchStartTime = 0;

    lightbox.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
            touchEndX = e.changedTouches[0].clientX;
            touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            const timeElapsed = Date.now() - touchStartTime;

            // Don't trigger if interacting with video controls or buttons
            if (e.target.closest('video') || e.target.closest('.lightbox-topbar') || e.target.closest('button') || e.target.closest('a')) {
                return;
            }

            // Horizontal Swipe (Next / Prev)
            if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.4 && timeElapsed < 500) {
                if (diffX < 0) {
                    navigateLightbox(1); // Swipe left -> Next
                } else {
                    navigateLightbox(-1); // Swipe right -> Prev
                }
            }

            // Vertical Swipe Down (Dismiss Lightbox like iOS)
            if (diffY > 80 && Math.abs(diffY) > Math.abs(diffX) * 1.5 && timeElapsed < 450) {
                closeLightbox();
            }
        }
    }, { passive: true });
}

// ============================================================
// LIGHTBOX CINEMA MODE & FILMSTRIP SCROLLING
// ============================================================
function initLightboxStageInteractions() {
    const stage = document.querySelector('.lightbox-stage');
    if (stage) {
        stage.addEventListener('click', (e) => {
            if (e.target.closest('button') ||
                e.target.closest('a') ||
                e.target.closest('video') ||
                e.target.closest('.lightbox-info-drawer') ||
                e.target.closest('.lightbox-nav-btn')) {
                return;
            }
            const lightbox = document.getElementById('lightbox');
            if (lightbox) {
                lightbox.classList.toggle('chrome-hidden');
            }
        });
    }

    const filmstripBar = document.getElementById('lightbox-filmstrip-bar');
    if (filmstripBar) {
        filmstripBar.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                filmstripBar.scrollLeft += e.deltaY;
            }
        }, { passive: false });

        // Touch swipe-down on filmstrip on mobile to minimize it
        let touchStartY = 0;
        let touchStartX = 0;
        filmstripBar.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0]) {
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
            }
        }, { passive: true });

        filmstripBar.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
                const touchEndY = e.changedTouches[0].clientY;
                const touchEndX = e.changedTouches[0].clientX;
                const dy = touchEndY - touchStartY;
                const dx = touchEndX - touchStartX;
                if (dy > 35 && Math.abs(dy) > Math.abs(dx) * 1.2) {
                    minimizeLightboxFilmstrip();
                }
            }
        }, { passive: true });
    }
}

// ============================================================
// CLIENT-SIDE VIDEO THUMBNAIL FRAME EXTRACTOR & AUTO-REPAIR
// ============================================================
const videoThumbQueue = [];
let activeVideoExtractors = 0;
const MAX_CONCURRENT_VIDEO_EXTRACTS = 2;

function enqueueVideoThumbnailExtraction(card) {
    if (card.dataset.thumbExtracted === '1') return;
    card.dataset.thumbExtracted = '1';

    const id = card.dataset.id;
    const streamUrl = card.dataset.streamUrl;
    if (!id || !streamUrl) return;

    // Check localStorage cache first
    try {
        const cached = localStorage.getItem('vthumb_' + id);
        if (cached) {
            const img = card.querySelector('.media-card-image');
            if (img) {
                img.src = cached;
                img.classList.add('loaded');
            }
            return;
        }
    } catch (e) {}

    videoThumbQueue.push({ card, id, streamUrl });
    processVideoThumbQueue();
}

function processVideoThumbQueue() {
    if (activeVideoExtractors >= MAX_CONCURRENT_VIDEO_EXTRACTS || videoThumbQueue.length === 0) {
        return;
    }

    const { card, id, streamUrl } = videoThumbQueue.shift();
    activeVideoExtractors++;

    const img = card.querySelector('.media-card-image');
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    let finished = false;
    const timeout = setTimeout(() => {
        cleanup();
    }, 12000);

    function cleanup() {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.src = '';
        video.load();
        activeVideoExtractors--;
        processVideoThumbQueue();
    }

    function captureFrame() {
        try {
            const w = video.videoWidth || 480;
            const h = video.videoHeight || 360;
            const targetW = Math.min(480, w);
            const targetH = Math.round(targetW * (h / w));

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, targetW, targetH);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

            if (img) {
                img.src = dataUrl;
                img.classList.add('loaded');
            }

            // Cache in browser
            try {
                localStorage.setItem('vthumb_' + id, dataUrl);
            } catch (e) {}

            // Auto-heal server & Google Drive if thumb was placeholder or missing
            if (card.dataset.hasThumb !== '1') {
                const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
                fetch('/media/' + id + '/thumbnail', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf || '',
                    },
                    body: JSON.stringify({ image_data: dataUrl }),
                }).then(res => res.json()).then(res => {
                    if (res && res.success) {
                        card.dataset.hasThumb = '1';
                    }
                }).catch(() => {});
            }
        } catch (err) {
            console.warn('Frame capture failed for video ' + id, err);
        } finally {
            cleanup();
        }
    }

    video.onloadeddata = () => {
        try {
            video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
        } catch (e) {
            captureFrame();
        }
    };

    video.onseeked = () => {
        captureFrame();
    };

    video.onerror = () => {
        cleanup();
    };

    video.src = streamUrl + '#t=0.5';
}

function initVideoThumbnailExtractor() {
    const videoCards = document.querySelectorAll('.media-card[data-is-video="1"]');
    if (videoCards.length === 0) return;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    enqueueVideoThumbnailExtraction(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '300px' });

        videoCards.forEach(card => observer.observe(card));
    } else {
        videoCards.forEach(card => enqueueVideoThumbnailExtraction(card));
    }
}

// ============================================================
// APPLE PHOTOS DUPLICATES MODAL (WEB)
// ============================================================
function openDuplicatesModal() {
    const modal = document.getElementById('duplicates-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadDuplicatesData();
}

function closeDuplicatesModal() {
    const modal = document.getElementById('duplicates-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

async function loadDuplicatesData() {
    const container = document.getElementById('duplicates-container');
    const summaryText = document.getElementById('dup-summary-text');
    const mergeAllBtn = document.getElementById('btn-merge-all-web');

    if (!container) return;

    container.innerHTML = `
        <div style="text-align:center; padding: 48px 20px; color: rgba(255,255,255,0.6);">
            <div class="spinner" style="margin: 0 auto 14px;"></div>
            <span>Memindai pustaka untuk menemukan media duplikat...</span>
        </div>
    `;

    try {
        const res = await fetch('/media-duplicates', {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();

        if (!data.success || !data.groups || data.groups.length === 0) {
            summaryText.innerHTML = 'Tidak ada duplikat ditemukan.';
            if (mergeAllBtn) mergeAllBtn.style.display = 'none';
            const badge = document.getElementById('dup-badge-count');
            if (badge) badge.textContent = '0';

            container.innerHTML = `
                <div class="dup-empty-state">
                    <div class="dup-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h3 class="dup-empty-title">Galeri Bersih & Rapi!</h3>
                    <p class="dup-empty-desc">Tidak ada berkas duplikat yang terdeteksi di galeri Anda. Seluruh media tersimpan secara efisien.</p>
                </div>
            `;
            return;
        }

        const totalCopies = data.total_duplicate_copies || 0;
        const totalWasted = data.formatted_total_wasted || '0 B';
        summaryText.innerHTML = `Ditemukan <strong>${totalCopies} salinan duplikat</strong> • Hemat potensi <strong>${totalWasted}</strong> ruang penyimpanan`;

        if (mergeAllBtn) {
            mergeAllBtn.style.display = 'inline-flex';
            mergeAllBtn.textContent = `Gabung Semua (${totalCopies})`;
        }

        const badge = document.getElementById('dup-badge-count');
        if (badge) badge.textContent = totalCopies;

        let html = '';
        data.groups.forEach((group, idx) => {
            const groupKey = group.group_key;
            const duplicateIds = group.items.filter(item => !item.is_keeper).map(item => item.id);
            const keeperId = group.keeper_id;

            html += `
                <div class="dup-group-card" id="dup-group-${groupKey}">
                    <div class="dup-group-header">
                        <div>
                            <div class="dup-group-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>${escapeHtml(group.filename)}</span>
                            </div>
                            <div class="dup-group-meta">
                                ${group.formatted_size} per file • ${group.copy_count} salinan identik • Potensi hemat ${group.formatted_wasted}
                            </div>
                        </div>
                        <button type="button" class="btn-merge-group" onclick="mergeDuplicateGroup('${groupKey}', ${keeperId}, ${JSON.stringify(duplicateIds)})">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                            </svg>
                            Gabungkan ${duplicateIds.length} Salinan
                        </button>
                    </div>

                    <div class="dup-items-row">
            `;

            group.items.forEach(item => {
                const isKeeper = item.is_keeper;
                const isVid = item.type === 'video';
                html += `
                    <div class="dup-item-card" id="dup-item-${item.id}">
                        <div class="dup-item-thumb-wrap">
                            <img src="${item.thumbnail_url || ('/media/' + item.id + '/thumbnail')}"
                                 class="dup-item-img"
                                 alt="${escapeHtml(item.title)}"
                                 loading="lazy"
                                 onerror="if(this.src!=='/media/${item.id}/thumbnail'){this.src='/media/${item.id}/thumbnail';}">
                            <span class="dup-badge ${isKeeper ? 'dup-badge-keeper' : 'dup-badge-copy'}">
                                ${isKeeper ? '✓ Simpan (Asli)' : 'Duplikat'}
                            </span>
                            ${isVid ? '<span style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.65); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">VIDEO</span>' : ''}
                        </div>
                        <div class="dup-item-info">
                            <span class="dup-item-date">${item.formatted_date || '-'}</span>
                            <span class="dup-item-album">${item.album_name ? '📁 ' + escapeHtml(item.album_name) : 'Semua Foto'}</span>
                            ${!isKeeper ? `
                                <button type="button" class="dup-delete-btn" onclick="deleteSingleDuplicate(${item.id}, '${groupKey}')" title="Hapus salinan ini">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Hapus
                                </button>
                            ` : '<span style="font-size:10.5px; color:#10b981; margin-top:4px;">Berkas dipertahankan</span>'}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color:#ef4444;">
                <p>Gagal memuat data duplikat: ${e.message}</p>
                <button type="button" class="btn btn-secondary" onclick="loadDuplicatesData()" style="margin-top:12px;">Coba Lagi</button>
            </div>
        `;
    }
}

async function mergeDuplicateGroup(groupKey, keepId, duplicateIds) {
    const card = document.getElementById('dup-group-' + groupKey);
    if (card) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
    }

    try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        const res = await fetch('/media-duplicates/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf || '',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                keep_id: keepId,
                duplicate_ids: duplicateIds
            })
        });

        const data = await res.json();
        if (data.success) {
            if (card) {
                card.style.transition = 'all 0.3s ease';
                card.style.transform = 'scale(0.95)';
                card.style.opacity = '0';
                setTimeout(() => card.remove(), 300);
            }
            showAppNotification(`Berhasil menggabungkan ${data.deleted_count} salinan duplikat.`);
            // Refresh counts
            setTimeout(loadDuplicatesData, 400);
        } else {
            alert('Gagal menggabungkan: ' + (data.message || 'Error'));
            if (card) {
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            }
        }
    } catch (e) {
        alert('Gagal: ' + e.message);
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
    }
}

async function mergeAllDuplicatesWeb() {
    if (!confirm('Gabungkan semua duplikat sekarang?\nSemua salinan identik akan dihapus permanen dari Google Drive dan 1 salinan asli akan dipertahankan.')) {
        return;
    }

    const btn = document.getElementById('btn-merge-all-web');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menggabungkan...';
    }

    try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        const res = await fetch('/media-duplicates/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf || '',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ all: true })
        });

        const data = await res.json();
        if (data.success) {
            showAppNotification(`Selesai! ${data.deleted_count} berkas duplikat berhasil dibersihkan 🎉`);
            loadDuplicatesData();
        } else {
            alert('Gagal: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (e) {
        alert('Gagal: ' + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function deleteSingleDuplicate(mediaId, groupKey) {
    if (!confirm('Hapus salinan duplikat ini secara permanen?')) return;

    try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        const res = await fetch('/media-duplicates/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf || '',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ media_id: mediaId })
        });

        const data = await res.json();
        if (data.success) {
            const itemEl = document.getElementById('dup-item-' + mediaId);
            if (itemEl) itemEl.remove();
            showAppNotification('Salinan duplikat berhasil dihapus.');
            loadDuplicatesData();
        }
    } catch (e) {
        alert('Gagal menghapus: ' + e.message);
    }
}

// ============================================================
// VIDEO THUMBNAIL REPAIR MODAL (WEB)
// ============================================================
function openVideoRepairModal() {
    const modal = document.getElementById('video-repair-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const btn = document.getElementById('btn-start-video-repair');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Mulai Perbaikan';
            btn.onclick = startVideoThumbnailAutoExtraction;
        }
        const statusText = document.getElementById('v-repair-status-text');
        if (statusText) statusText.textContent = '';
        const progressBar = document.getElementById('v-repair-progress-bar');
        if (progressBar) progressBar.style.display = 'none';
        const progressFill = document.getElementById('v-repair-progress-fill');
        if (progressFill) progressFill.style.width = '0%';
    }
}

function closeVideoRepairModal() {
    const modal = document.getElementById('video-repair-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

async function startVideoThumbnailAutoExtraction() {
    const btn = document.getElementById('btn-start-video-repair');
    const progressBar = document.getElementById('v-repair-progress-bar');
    const progressFill = document.getElementById('v-repair-progress-fill');
    const statusText = document.getElementById('v-repair-status-text');

    if (btn) btn.disabled = true;
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '5%';

    statusText.textContent = 'Memeriksa video yang memerlukan thumbnail...';

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

    try {
        // 1. Get list of videos needing thumbnails (force=1 to include videos with old GD placeholders)
        const infoResp = await fetch('/media-videos-needing-thumbnails?force=1');
        const info = await infoResp.json();

        if (!info.success) {
            throw new Error(info.message || 'Gagal mengambil data video');
        }

        if (info.count === 0) {
            statusText.textContent = '✓ Seluruh video sudah memiliki thumbnail asli! Tidak ada yang perlu diperbaiki.';
            if (progressFill) progressFill.style.width = '100%';
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Tutup';
                btn.onclick = closeVideoRepairModal;
            }
            return;
        }

        const total = info.count;
        statusText.textContent = `Menemukan ${total} video untuk diproses...`;
        if (progressFill) progressFill.style.width = '10%';

        let hasFfmpeg = info.ffmpeg_available;

        // 2. If FFmpeg not available on server, attempt automatic server installation
        if (!hasFfmpeg) {
            statusText.textContent = 'FFmpeg server belum terdeteksi. Mengunduh FFmpeg ke server...';
            try {
                const instResp = await fetch('/media/install-ffmpeg', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf,
                        'Accept': 'application/json'
                    }
                });
                const instData = await instResp.json();
                if (instData.success) {
                    hasFfmpeg = true;
                    statusText.textContent = '✓ FFmpeg berhasil dipasang di server! Melanjutkan perbaikan...';
                }
            } catch (instErr) {
                console.warn('Server FFmpeg auto-install skipped:', instErr);
            }
        }

        // 3. Process via Server FFmpeg in batches if available
        if (hasFfmpeg) {
            let processed = 0;
            let afterId = null;
            while (processed < total) {
                statusText.textContent = `Memproses di server via FFmpeg (${processed}/${total} selesai)...`;
                const batchResp = await fetch('/media/batch-generate-thumbnails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ limit: 5, force: true, after_id: afterId })
                });
                const batchData = await batchResp.json();

                if (!batchData.success || batchData.processed === 0) {
                    break;
                }

                processed += batchData.processed;
                afterId = batchData.last_id;
                const pct = Math.min(100, Math.round((processed / total) * 100));
                if (progressFill) progressFill.style.width = pct + '%';

                if (!afterId || batchData.remaining === 0) {
                    break;
                }
            }

            statusText.textContent = `Selesai! ${processed} thumbnail video berhasil diperbarui 🎉`;
            if (progressFill) progressFill.style.width = '100%';
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Tutup';
                btn.onclick = closeVideoRepairModal;
            }
            showAppNotification(`Berhasil memperbarui thumbnail ${processed} video!`);
            return;
        }

        // 4. Fallback: Process via Client Browser Canvas (sequential for smooth performance)
        statusText.textContent = `Mengekstrak frame via browser (0/${total})...`;
        let extractedCount = 0;

        for (let i = 0; i < info.videos.length; i++) {
            const vItem = info.videos[i];
            statusText.textContent = `Mengekstrak frame via browser (${i + 1}/${total}): ${escapeHtml(vItem.title)}...`;

            try {
                await extractAndUploadSingleVideoFrame(vItem, csrf);
                extractedCount++;
            } catch (err) {
                console.warn(`Frame extraction failed for video ${vItem.id}:`, err);
            }

            const pct = Math.min(100, Math.round(((i + 1) / total) * 100));
            if (progressFill) progressFill.style.width = pct + '%';
        }

        statusText.textContent = `Selesai! ${extractedCount} dari ${total} thumbnail video berhasil diperbarui via browser 🎉`;
        if (progressFill) progressFill.style.width = '100%';
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Tutup';
            btn.onclick = closeVideoRepairModal;
        }
        showAppNotification(`Berhasil memperbarui ${extractedCount} thumbnail video!`);
    } catch (e) {
        statusText.textContent = 'Terjadi kesalahan: ' + e.message;
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Coba Lagi';
            btn.onclick = startVideoThumbnailAutoExtraction;
        }
    }
}

function extractAndUploadSingleVideoFrame(vItem, csrf) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';

        let done = false;
        const timer = setTimeout(() => {
            finish(null);
        }, 12000);

        function finish(dataUrl) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            video.onloadeddata = null;
            video.onseeked = null;
            video.onerror = null;
            video.src = '';
            video.load();

            if (!dataUrl) {
                resolve(false);
                return;
            }

            // Cache in browser
            try { localStorage.setItem('vthumb_' + vItem.id, dataUrl); } catch (e) {}

            // Send to server
            fetch('/media/' + vItem.id + '/thumbnail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf || '',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ image_data: dataUrl })
            }).then(() => resolve(true)).catch(() => resolve(false));
        }

        function capture() {
            try {
                const w = video.videoWidth || 480;
                const h = video.videoHeight || 360;
                const targetW = Math.min(480, w);
                const targetH = Math.round(targetW * (h / w));

                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, targetW, targetH);
                finish(canvas.toDataURL('image/jpeg', 0.82));
            } catch (e) {
                finish(null);
            }
        }

        video.onloadeddata = () => {
            try {
                video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
            } catch (e) {
                capture();
            }
        };

        video.onseeked = () => capture();
        video.onerror = () => finish(null);
        video.src = vItem.stream_url + '#t=0.5';
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showAppNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(16, 185, 129, 0.95);
        color: #fff;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13.5px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(12px);
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// ============================================================
// INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initMediaGrid();
    initLazyLoading();
    initVideoThumbnailExtractor();
    initUploadZone();
    initFilters();
    initCardAnimations();
    initAlerts();
    initLightboxTouchGestures();
    initLightboxStageInteractions();
});
