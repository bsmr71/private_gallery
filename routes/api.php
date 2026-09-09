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
    Route::delete('/media/{media}', [MediaApiController::class, 'destroy']);
    Route::post('/media/batch-delete', [MediaApiController::class, 'batchDelete']);

    // Albums Resource Endpoints
    Route::get('/albums', [AlbumApiController::class, 'index']);
    Route::post('/albums', [AlbumApiController::class, 'store']);
    Route::put('/albums/{album}', [AlbumApiController::class, 'update']);
    Route::delete('/albums/{album}', [AlbumApiController::class, 'destroy']);
});
