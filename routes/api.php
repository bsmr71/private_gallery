<?php

use App\Http\Controllers\Api\AlbumApiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MediaApiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| REST API Routes for Mobile (Apple Photos Experience) & Web Integrations
|--------------------------------------------------------------------------
*/

// Public Authentication
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});

// Protected Endpoints (Bearer Token Authentication)
Route::middleware(\App\Http\Middleware\AuthenticateApiToken::class)->group(function () {
    // Current User Profile & Logout
    Route::prefix('auth')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/ack-pin-reset', [AuthController::class, 'ackPinReset']);
    });

    // Media Resource Endpoints
    Route::get('/media', [MediaApiController::class, 'index']);
    Route::get('/media/{media}', [MediaApiController::class, 'show']);
    Route::get('/media/{media}/stream', [MediaApiController::class, 'stream'])->name('api.media.stream');
    Route::get('/media/{media}/thumbnail', [MediaApiController::class, 'thumbnail'])->name('api.media.thumbnail');
    Route::get('/media/{media}/download', [MediaApiController::class, 'download'])->name('api.media.download');
    Route::post('/media/upload', [MediaApiController::class, 'upload']);
    Route::post('/media/{media}/favorite', [MediaApiController::class, 'toggleFavorite']);
    Route::post('/media/{media}/rename', [MediaApiController::class, 'rename']);
    Route::post('/media/move', [MediaApiController::class, 'move']);
    Route::post('/media/copy', [MediaApiController::class, 'copy']);
    Route::post('/media/{media}/thumbnail', [MediaApiController::class, 'updateThumbnail']);
    Route::delete('/media/{media}', [MediaApiController::class, 'destroy']);
    Route::post('/media/batch-delete', [MediaApiController::class, 'batchDelete']);

    // Duplicate Media Detection & Merge Endpoints
    Route::get('/media-duplicates', [MediaApiController::class, 'duplicates']);
    Route::post('/media-duplicates/merge', [MediaApiController::class, 'mergeDuplicates']);
    Route::post('/media-duplicates/delete', [MediaApiController::class, 'deleteDuplicate']);

    // Albums Resource Endpoints
    Route::get('/albums', [AlbumApiController::class, 'index']);
    Route::post('/albums', [AlbumApiController::class, 'store']);
    Route::put('/albums/{album}', [AlbumApiController::class, 'update']);
    Route::delete('/albums/{album}', [AlbumApiController::class, 'destroy']);

    // Secure Vault (Brankas Terkunci - Password & OTP Protected)
    Route::prefix('secure-vault')->group(function () {
        Route::get('/status', [\App\Http\Controllers\Api\SecureVaultController::class, 'status']);
        Route::post('/request-email-otp', [\App\Http\Controllers\Api\SecureVaultController::class, 'requestEmailOtp']);
        Route::post('/unlock', [\App\Http\Controllers\Api\SecureVaultController::class, 'unlock']);
        Route::get('/media', [\App\Http\Controllers\Api\SecureVaultController::class, 'media']);
        Route::post('/lock-media', [\App\Http\Controllers\Api\SecureVaultController::class, 'lockMedia']);
        Route::post('/unlock-media', [\App\Http\Controllers\Api\SecureVaultController::class, 'unlockMedia']);
    });
});
