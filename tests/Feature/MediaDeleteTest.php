<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use App\Services\GoogleDriveService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class MediaDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_delete_media(): void
    {
        $user = User::factory()->create();
        $media = Media::create([
            'drive_file_id' => 'fake_drive_id_123',
            'title' => 'Sample Image',
            'original_filename' => 'sample.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'type' => 'image',
        ]);

        $response = $this->delete(route('admin.media.destroy', $media));
        $response->assertRedirect(route('login'));
        $this->assertDatabaseHas('media', ['id' => $media->id]);
    }

    public function test_authenticated_user_can_delete_media_via_ajax(): void
    {
        $user = User::factory()->create();
        $media = Media::create([
            'drive_file_id' => 'fake_drive_id_456',
            'thumb_drive_id' => 'fake_thumb_id_456',
            'title' => 'Delete Me',
            'original_filename' => 'delete-me.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 2048,
            'type' => 'image',
        ]);

        // Mock GoogleDriveService
        $mockDrive = Mockery::mock(GoogleDriveService::class);
        $mockDrive->shouldReceive('delete')->with('fake_drive_id_456')->once();
        $mockDrive->shouldReceive('delete')->with('fake_thumb_id_456')->once();
        $this->app->instance(GoogleDriveService::class, $mockDrive);

        $response = $this->actingAs($user)
            ->deleteJson(route('admin.media.destroy', $media));

        $response->assertOk();
        $response->assertJson(['success' => true]);
        $this->assertDatabaseMissing('media', ['id' => $media->id]);
    }

    public function test_authenticated_user_can_batch_delete_media(): void
    {
        $user = User::factory()->create();
        $media1 = Media::create([
            'drive_file_id' => 'drive_1',
            'title' => 'Item 1',
            'original_filename' => 'item1.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'type' => 'image',
        ]);
        $media2 = Media::create([
            'drive_file_id' => 'drive_2',
            'title' => 'Item 2',
            'original_filename' => 'item2.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'type' => 'image',
        ]);

        // Mock GoogleDriveService
        $mockDrive = Mockery::mock(GoogleDriveService::class);
        $mockDrive->shouldReceive('delete')->with('drive_1')->once();
        $mockDrive->shouldReceive('delete')->with('drive_2')->once();
        $this->app->instance(GoogleDriveService::class, $mockDrive);

        $response = $this->actingAs($user)
            ->postJson(route('admin.media.batch-delete'), [
                'ids' => [$media1->id, $media2->id],
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'deleted' => 2,
        ]);
        $this->assertDatabaseMissing('media', ['id' => $media1->id]);
        $this->assertDatabaseMissing('media', ['id' => $media2->id]);
    }
}
