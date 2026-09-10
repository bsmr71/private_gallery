<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use App\Services\GoogleDriveService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ThumbnailDebugRealTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_returns_video_thumbnail_and_serves_it(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test_mobile')->plainTextToken;

        // Mock Google Drive Service
        $this->mock(GoogleDriveService::class, function ($mock) {
            $mock->shouldReceive('upload')->andReturn('mock_drive_id');
            $mock->shouldReceive('delete')->andReturn(true);
            $mock->shouldReceive('download')->andReturn(true);
        });

        // 1. Create a video
        $video = Media::create([
            'title' => 'Sample Video Test',
            'type' => 'video',
            'mime_type' => 'video/mp4',
            'original_filename' => 'my_video.mp4',
            'size' => 1024000,
            'drive_file_id' => 'drive_video_test_1',
            'thumb_drive_id' => 'drive_thumb_test_1',
            'cache_key' => 'vid_test_123',
        ]);

        // 2. Call GET /api/media
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/media');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $videoItem = collect($data)->firstWhere('id', $video->id);
        $this->assertNotNull($videoItem);

        // 3. Request thumbnail via the returned URL
        $thumbRes = $this->get($videoItem['thumbnail_url']);
        $thumbRes->assertStatus(200);
        $this->assertStringContainsString('image/', $thumbRes->headers->get('Content-Type'));
    }
}
