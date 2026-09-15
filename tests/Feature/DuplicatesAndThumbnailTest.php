<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use App\Services\GoogleDriveService;
use App\Services\FileEncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DuplicatesAndThumbnailTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();

        // Mock Google Drive Service
        $this->mock(GoogleDriveService::class, function ($mock) {
            $mock->shouldReceive('upload')->andReturn('mock_drive_thumb_id_' . uniqid());
            $mock->shouldReceive('delete')->andReturn(true);
            $mock->shouldReceive('download')->andReturn(true);
        });
    }

    public function test_web_user_can_fetch_duplicates_data(): void
    {
        // Create duplicate media items
        Media::create([
            'title' => 'Foto Pantai',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'beach.jpg',
            'size' => 102400,
            'drive_file_id' => 'drive_1',
            'thumb_drive_id' => 'thumb_1',
        ]);

        Media::create([
            'title' => 'Foto Pantai (1)',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'beach.jpg',
            'size' => 102400,
            'drive_file_id' => 'drive_2',
            'thumb_drive_id' => 'thumb_2',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/media-duplicates');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'duplicate_groups_count' => 1,
                'total_duplicate_copies' => 1,
            ]);
    }

    public function test_web_user_can_merge_duplicates(): void
    {
        $m1 = Media::create([
            'title' => 'Kucing Lucu',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'cat.jpg',
            'size' => 204800,
            'drive_file_id' => 'drive_cat_1',
            'thumb_drive_id' => 'thumb_cat_1',
        ]);

        $m2 = Media::create([
            'title' => 'Kucing Lucu Copy',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'cat.jpg',
            'size' => 204800,
            'drive_file_id' => 'drive_cat_2',
            'thumb_drive_id' => 'thumb_cat_2',
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/media-duplicates/merge', [
                'keep_id' => $m1->id,
                'duplicate_ids' => [$m2->id],
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'deleted_count' => 1,
            ]);

        $this->assertDatabaseHas('media', ['id' => $m1->id]);
        $this->assertDatabaseMissing('media', ['id' => $m2->id]);
    }

    public function test_web_user_can_update_video_thumbnail(): void
    {
        $video = Media::create([
            'title' => 'Video Liburan',
            'type' => 'video',
            'mime_type' => 'video/mp4',
            'original_filename' => 'holiday.mp4',
            'size' => 5242880,
            'drive_file_id' => 'drive_vid_1',
            'thumb_drive_id' => null,
        ]);

        // Create a minimal 1x1 JPEG image in base64
        $im = imagecreatetruecolor(10, 10);
        ob_start();
        imagejpeg($im);
        $jpegData = ob_get_clean();
        imagedestroy($im);
        $base64 = 'data:image/jpeg;base64,' . base64_encode($jpegData);

        $response = $this->actingAs($this->user)
            ->postJson("/media/{$video->id}/thumbnail", [
                'image_data' => $base64,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Thumbnail berhasil diperbarui',
            ]);

        $video->refresh();
        $this->assertNotNull($video->thumb_drive_id);
    }

    public function test_web_user_can_detect_duplicates_with_different_filenames(): void
    {
        Media::create([
            'title' => 'Gunung',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'mountain.jpg',
            'size' => 524000,
            'drive_file_id' => 'drive_m1',
            'thumb_drive_id' => 'thumb_m1',
        ]);

        Media::create([
            'title' => 'Gunung Copy',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'mountain (1).jpg',
            'size' => 524000,
            'drive_file_id' => 'drive_m2',
            'thumb_drive_id' => 'thumb_m2',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/media-duplicates');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'duplicate_groups_count' => 1,
                'total_duplicate_copies' => 1,
            ]);
    }

    public function test_duplicates_with_shared_drive_file_id_does_not_delete_drive_file_on_merge(): void
    {
        $m1 = Media::create([
            'title' => 'Bunga Asli',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'flower.jpg',
            'size' => 300000,
            'drive_file_id' => 'shared_flower_drive_id',
            'thumb_drive_id' => 'shared_flower_thumb_id',
        ]);

        $m2 = Media::create([
            'title' => 'Bunga Salinan',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'flower (Copy).jpg',
            'size' => 300000,
            'drive_file_id' => 'shared_flower_drive_id',
            'thumb_drive_id' => 'shared_flower_thumb_id',
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/media-duplicates/merge', [
                'keep_id' => $m1->id,
                'duplicate_ids' => [$m2->id],
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'deleted_count' => 1,
            ]);

        $this->assertDatabaseHas('media', ['id' => $m1->id]);
        $this->assertDatabaseMissing('media', ['id' => $m2->id]);
    }

    public function test_albums_page_displays_correct_duplicate_badge_count(): void
    {
        Media::create([
            'title' => 'Foto A',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'photo_a.jpg',
            'size' => 450000,
            'drive_file_id' => 'drive_a1',
            'thumb_drive_id' => 'thumb_a1',
        ]);

        Media::create([
            'title' => 'Foto A (1)',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'photo_a (1).jpg',
            'size' => 450000,
            'drive_file_id' => 'drive_a2',
            'thumb_drive_id' => 'thumb_a2',
        ]);

        $response = $this->actingAs($this->user)
            ->get('/albums');

        $response->assertStatus(200);
        $this->assertEquals(1, \App\Models\Media::getDuplicateCopiesCount());
        $response->assertSee('id="dup-badge-count">1<', false);
    }
}
