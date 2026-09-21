<?php

namespace Tests\Feature;

use App\Models\Album;
use App\Models\Media;
use App\Models\User;
use App\Services\GoogleDriveService;
use App\Services\FileEncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ChunkUploadTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => bcrypt('password123'),
        ]);
        $this->token = $this->user->createToken('test')->plainTextToken;
    }

    protected function tearDown(): void
    {
        // Clean up test chunk directory
        $chunkDir = storage_path('app/chunks');
        if (is_dir($chunkDir)) {
            File::deleteDirectory($chunkDir);
        }
        parent::tearDown();
    }

    public function test_guest_cannot_access_chunk_endpoints(): void
    {
        $response = $this->postJson('/api/media/upload-chunk/init', []);
        $response->assertStatus(401);
    }

    public function test_chunk_init_creates_session_successfully(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/init', [
                'filename' => 'large_video_test.mp4',
                'total_size' => 4 * 1024 * 1024,
                'chunk_size' => 2 * 1024 * 1024,
                'total_chunks' => 2,
                'mime_type' => 'video/mp4',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['upload_id', 'chunk_size', 'total_chunks', 'uploaded_chunks']);

        $uploadId = $response->json('upload_id');
        $this->assertNotEmpty($uploadId);
        $this->assertDirectoryExists(storage_path("app/chunks/{$uploadId}"));
    }

    public function test_chunk_init_detects_existing_duplicate(): void
    {
        Media::create([
            'title' => 'Existing Video',
            'type' => 'video',
            'mime_type' => 'video/mp4',
            'original_filename' => 'duplicate_video.mp4',
            'size' => 8000000,
            'drive_file_id' => 'drive_duplicate_123',
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/init', [
                'filename' => 'duplicate_video.mp4',
                'total_size' => 8000000,
                'chunk_size' => 2 * 1024 * 1024,
                'total_chunks' => 4,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('is_duplicate', true)
            ->assertJsonPath('media.original_filename', 'duplicate_video.mp4');
    }

    public function test_chunk_upload_and_status_tracking(): void
    {
        // 1. Init
        $initResp = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/init', [
                'filename' => 'sample_file.mp4',
                'total_size' => 2048,
                'chunk_size' => 1024,
                'total_chunks' => 2,
                'mime_type' => 'video/mp4',
            ]);

        $initResp->assertStatus(200)->assertJsonPath('success', true);
        $uploadId = $initResp->json('upload_id');

        // 2. Upload Chunk 0
        $chunk0 = UploadedFile::fake()->create('chunk0.bin', 1024, 'application/octet-stream');
        $upResp0 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->post('/api/media/upload-chunk', [
                'upload_id' => $uploadId,
                'chunk_index' => 0,
                'chunk' => $chunk0,
            ], ['Accept' => 'application/json']);

        $upResp0->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('chunk_index', 0)
            ->assertJsonPath('uploaded_chunks_count', 1);

        // 3. Status check
        $statusResp = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/media/upload-chunk/{$uploadId}/status");

        $statusResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('uploaded_chunks', [0])
            ->assertJsonPath('is_complete', false);

        // 4. Upload Chunk 1
        $chunk1 = UploadedFile::fake()->create('chunk1.bin', 1024, 'application/octet-stream');
        $upResp1 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->post('/api/media/upload-chunk', [
                'upload_id' => $uploadId,
                'chunk_index' => 1,
                'chunk' => $chunk1,
            ], ['Accept' => 'application/json']);

        $upResp1->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('chunk_index', 1)
            ->assertJsonPath('uploaded_chunks_count', 2);

        // 5. Final Status check
        $statusResp2 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/media/upload-chunk/{$uploadId}/status");

        $statusResp2->assertStatus(200)
            ->assertJsonPath('is_complete', true)
            ->assertJsonPath('uploaded_count', 2);
    }

    public function test_chunk_complete_merges_chunks_and_creates_media(): void
    {
        // Mock Drive & Encryption services
        $driveMock = $this->mock(GoogleDriveService::class);
        $driveMock->shouldReceive('uploadLarge')->andReturn('drive_chunk_large_123');
        $driveMock->shouldReceive('upload')->andReturn('drive_uploaded_file_id');

        $encMock = $this->mock(FileEncryptionService::class);
        $encMock->shouldReceive('encryptFile')->andReturnUsing(function ($filePath) {
            $encPath = $filePath . '.enc';
            file_put_contents($encPath, file_get_contents($filePath));
            return $encPath;
        });

        // 1. Init (simulate a 6MB file with two 3MB chunks so uploadLarge is triggered)
        $chunkSize = 3 * 1024 * 1024;
        $totalSize = 6 * 1024 * 1024;

        $initResp = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/init', [
                'filename' => 'chunk_merged_video.mp4',
                'total_size' => $totalSize,
                'chunk_size' => $chunkSize,
                'total_chunks' => 2,
                'mime_type' => 'video/mp4',
                'title' => 'Merged Video Title',
            ]);

        $initResp->assertStatus(200)->assertJsonPath('success', true);
        $uploadId = $initResp->json('upload_id');

        // 2. Upload Chunk 0 (create a 3MB dummy chunk)
        $chunk0 = UploadedFile::fake()->createWithContent('chunk0.bin', str_repeat('A', 1024));
        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->post('/api/media/upload-chunk', [
                'upload_id' => $uploadId,
                'chunk_index' => 0,
                'chunk' => $chunk0,
            ], ['Accept' => 'application/json'])->assertStatus(200);
        unset($chunk0);

        // 3. Upload Chunk 1
        $chunk1 = UploadedFile::fake()->createWithContent('chunk1.bin', str_repeat('B', 1024));
        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->post('/api/media/upload-chunk', [
                'upload_id' => $uploadId,
                'chunk_index' => 1,
                'chunk' => $chunk1,
            ], ['Accept' => 'application/json'])->assertStatus(200);
        unset($chunk1);
        gc_collect_cycles();

        // 4. Complete
        $completeResp = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/complete', [
                'upload_id' => $uploadId,
                'title' => 'Final Merged Video',
            ]);

        $completeResp->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('media.title', 'Final Merged Video')
            ->assertJsonPath('media.original_filename', 'chunk_merged_video.mp4')
            ->assertJsonPath('media.type', 'video');

        $createdMediaId = $completeResp->json('media.id');
        $this->assertDatabaseHas('media', [
            'id' => $createdMediaId,
            'title' => 'Final Merged Video',
            'type' => 'video',
        ]);

        // Chunk directory should be cleaned up
        clearstatcache();
        $this->assertDirectoryDoesNotExist(storage_path("app/chunks/{$uploadId}"));
    }

    public function test_chunk_cancel_cleans_up_directory(): void
    {
        $initResp = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/init', [
                'filename' => 'cancel_video.mp4',
                'total_size' => 2048,
                'chunk_size' => 1024,
                'total_chunks' => 2,
            ]);

        $initResp->assertStatus(200)->assertJsonPath('success', true);
        $uploadId = $initResp->json('upload_id');
        $this->assertDirectoryExists(storage_path("app/chunks/{$uploadId}"));

        $cancelResp = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/media/upload-chunk/cancel', [
                'upload_id' => $uploadId,
            ]);

        $cancelResp->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDirectoryDoesNotExist(storage_path("app/chunks/{$uploadId}"));
    }
}
