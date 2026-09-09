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

function openLightbox(index) {
    lightboxIndex = index;
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateLightboxContent();
    // Animate in
    requestAnimationFrame(() => lightbox.classList.add('active'));
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('active');
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

    if (titleEl) titleEl.textContent = item.title;
    if (sizeEl) sizeEl.textContent = item.size || '';
    if (albumEl) {
        albumEl.textContent = item.album ? item.album : 'Umum';
        albumEl.style.display = item.album ? 'inline' : 'none';
    }
    if (dateEl) dateEl.textContent = item.created_at || '';
    if (counterEl) counterEl.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;

    if (downloadBtn) {
        const url = item.downloadUrl || `/media/${item.id}/download`;
        downloadBtn.href = url;
        downloadBtn.setAttribute('download', item.title || 'media');
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
    } else {
        mediaContainer.innerHTML = `
            <div class="lightbox-image-frame">
                <img src="${item.streamUrl}" alt="${item.title}" class="lightbox-image-element" loading="eager">
            </div>
        `;
    }

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

// Keyboard navigation & shortcuts
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || lightbox.style.display === 'none') return;

    // Ignore if typing inside input/textarea
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    switch (e.key) {
        case 'Escape':
            closeLightbox();
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
                // Don't open lightbox if clicking action buttons or links
                if (e.target.closest('.card-action-download') || e.target.closest('.card-quick-actions') || e.target.closest('.media-card-actions') || e.target.closest('a') || e.target.closest('button')) return;
                openLightbox(idx);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(idx);
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
// INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initMediaGrid();
    initLazyLoading();
    initUploadZone();
    initFilters();
    initCardAnimations();
    initAlerts();
    initLightboxTouchGestures();
});
