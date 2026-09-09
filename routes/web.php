<?php

use App\Http\Controllers\GalleryController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\AlbumController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GoogleAuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Private Gallery Routes (Login required)
|--------------------------------------------------------------------------
*/

Route::middleware('auth')->group(function () {
    Route::get('/', [GalleryController::class, 'index'])->name('gallery.index');
    Route::get('/album/{album:slug}', [GalleryController::class, 'album'])->name('gallery.album');
    Route::get('/media/{media}/stream', [MediaController::class, 'stream'])->name('media.stream');
    Route::get('/media/{media}/thumbnail', [MediaController::class, 'thumbnail'])->name('media.thumbnail');
    Route::get('/media/{media}/download', [MediaController::class, 'download'])->name('media.download');
});

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::get('/login/2fa', [AuthController::class, 'show2fa'])->name('login.2fa');
Route::post('/login/2fa', [AuthController::class, 'verify2fa'])->name('login.2fa.verify');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

/*
|--------------------------------------------------------------------------
| Admin Routes (Protected by auth middleware)
|--------------------------------------------------------------------------
*/

Route::middleware('auth')->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [AdminController::class, 'dashboard'])->name('dashboard');

    // Media management
    Route::get('/media', [MediaController::class, 'index'])->name('media.index');
    Route::get('/media/upload', [MediaController::class, 'create'])->name('media.create');
    Route::post('/media', [MediaController::class, 'store'])->name('media.store');
    Route::post('/media/batch-delete', [MediaController::class, 'batchDelete'])->name('media.batch-delete');
    Route::put('/media/{media}', [MediaController::class, 'update'])->name('media.update');
    Route::delete('/media/{media}', [MediaController::class, 'destroy'])->name('media.destroy');

    // Album management
    Route::resource('albums', AlbumController::class)->except(['show']);

    // Google Drive Settings & OAuth
    Route::get('/settings', [GoogleAuthController::class, 'settings'])->name('settings');
    Route::post('/settings', [GoogleAuthController::class, 'saveSettings'])->name('settings.save');
    Route::post('/settings/test', [GoogleAuthController::class, 'testConnection'])->name('settings.test');
    Route::get('/google/connect', [GoogleAuthController::class, 'connect'])->name('google.connect');
    Route::get('/google/callback', [GoogleAuthController::class, 'callback'])->name('google.callback');

    // Two-Factor Authentication Management
    Route::get('/2fa/setup', [AuthController::class, 'setup2fa'])->name('2fa.setup');
    Route::post('/2fa/confirm', [AuthController::class, 'confirm2fa'])->name('2fa.confirm');
    Route::post('/2fa/disable', [AuthController::class, 'disable2fa'])->name('2fa.disable');
    Route::post('/2fa/recovery-codes', [AuthController::class, 'regenerateRecoveryCodes'])->name('2fa.recovery-codes');
});
