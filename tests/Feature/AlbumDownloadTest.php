<?php

namespace Tests\Feature;

use App\Models\Album;
use App\Models\Media;
use App\Models\User;
use App\Services\MediaCacheService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlbumDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_download_album(): void
    {
        $album = Album::create([
            'name' => 'Liburan Bali',
            'slug' => 'liburan-bali',
        ]);

        $response = $this->get(route('gallery.album.download', $album));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_user_can_download_album_as_zip(): void
    {
        $user = User::factory()->create();
        $album = Album::create([
            'name' => 'Family Trip',
            'slug' => 'family-trip',
        ]);

        $media1 = Media::create([
            'user_id' => $user->id,
            'album_id' => $album->id,
            'drive_file_id' => 'fake_drive_1',
            'title' => 'Beach Sunset',
            'filename' => 'beach.jpg',
            'original_filename' => 'beach-sunset.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'type' => 'image',
        ]);

        $media2 = Media::create([
            'user_id' => $user->id,
            'album_id' => $album->id,
            'drive_file_id' => 'fake_drive_2',
            'title' => 'Hotel Room',
            'filename' => 'hotel.jpg',
            'original_filename' => 'hotel-room.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 2048,
            'type' => 'image',
        ]);

        // Cache fake files so download can package them
        $cacheService = app(MediaCacheService::class);
        $temp1 = tempnam(sys_get_temp_dir(), 'test_img1_');
        file_put_contents($temp1, 'fake-jpeg-image-1');
        $cacheService->cacheFile($media1, $temp1);

        $temp2 = tempnam(sys_get_temp_dir(), 'test_img2_');
        file_put_contents($temp2, 'fake-jpeg-image-2');
        $cacheService->cacheFile($media2, $temp2);

        $response = $this->actingAs($user)->get(route('gallery.album.download', $album));

        $response->assertOk();
        $this->assertEquals('application/zip', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('family_trip.zip', $response->headers->get('Content-Disposition'));
    }

    public function test_empty_album_returns_error(): void
    {
        $user = User::factory()->create();
        $album = Album::create([
            'name' => 'Empty Album',
            'slug' => 'empty-album',
        ]);

        $response = $this->actingAs($user)->get(route('gallery.album.download', $album));
        $response->assertRedirect(route('gallery.album', $album));
        $response->assertSessionHas('error');
    }

    public function test_api_download_album_with_bearer_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;

        $album = Album::create([
            'name' => 'API Album',
            'slug' => 'api-album',
        ]);

        $media = Media::create([
            'user_id' => $user->id,
            'album_id' => $album->id,
            'drive_file_id' => 'fake_drive_api',
            'title' => 'Photo In Album',
            'filename' => 'photo.jpg',
            'original_filename' => 'photo.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'type' => 'image',
        ]);

        $cacheService = app(MediaCacheService::class);
        $temp = tempnam(sys_get_temp_dir(), 'test_api_img_');
        file_put_contents($temp, 'fake-binary-content');
        $cacheService->cacheFile($media, $temp);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/albums/{$album->id}/download");

        $response->assertOk();
        $this->assertEquals('application/zip', $response->headers->get('Content-Type'));
    }
}
