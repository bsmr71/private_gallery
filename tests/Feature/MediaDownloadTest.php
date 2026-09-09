<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use App\Services\CacheService;
use App\Services\GoogleDriveService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Mockery;
use Tests\TestCase;

class MediaDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_download_media(): void
    {
        $user = User::factory()->create();
        $media = Media::create([
            'user_id' => $user->id,
            'drive_file_id' => 'fake_drive_id_123',
            'title' => 'Test Landscape',
            'filename' => 'test-landscape.jpg',
            'original_filename' => 'landscape-original.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'type' => 'image',
        ]);

        $response = $this->get(route('media.download', $media));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_user_can_download_cached_media(): void
    {
        $user = User::factory()->create();
        $media = Media::create([
            'user_id' => $user->id,
            'drive_file_id' => 'fake_drive_id_456',
            'title' => 'Vacation Photo',
            'filename' => 'vacation.jpg',
            'original_filename' => 'my-vacation-original.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 2048,
            'type' => 'image',
        ]);

        // Create dummy source file and cache it via MediaCacheService
        $tempFile = tempnam(sys_get_temp_dir(), 'test_img_');
        file_put_contents($tempFile, 'fake-binary-image-content');
        app(\App\Services\MediaCacheService::class)->cacheFile($media, $tempFile);

        $response = $this->actingAs($user)->get(route('media.download', $media));

        $response->assertOk();
        $this->assertTrue($response->headers->has('content-disposition'));
        $this->assertStringContainsString('my-vacation-original.jpg', $response->headers->get('content-disposition'));
    }

    public function test_media_lightbox_data_contains_download_url(): void
    {
        $user = User::factory()->create();
        $media = Media::create([
            'user_id' => $user->id,
            'drive_file_id' => 'fake_drive_id_789',
            'title' => 'Sample Video',
            'filename' => 'video.mp4',
            'original_filename' => 'sunset-video.mp4',
            'mime_type' => 'video/mp4',
            'size' => 10485760,
            'type' => 'video',
        ]);

        $lightboxData = $media->toLightboxData();

        $this->assertArrayHasKey('downloadUrl', $lightboxData);
        $this->assertEquals(route('media.download', $media), $lightboxData['downloadUrl']);
        $this->assertArrayHasKey('created_at', $lightboxData);
    }

    public function test_authenticated_user_can_view_redesigned_gallery_with_stats(): void
    {
        $user = User::factory()->create();
        Media::create([
            'user_id' => $user->id,
            'drive_file_id' => 'fake_drive_id_999',
            'title' => 'Sample Media',
            'filename' => 'sample.jpg',
            'original_filename' => 'sample.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 5000,
            'type' => 'image',
        ]);

        $response = $this->actingAs($user)->get(route('gallery.index'));

        $response->assertOk();
        $response->assertSee('Galeri Foto &amp; Video Pribadi', false);
        $response->assertSee('Total Media');
        $response->assertSee('Unduh');
    }
}
