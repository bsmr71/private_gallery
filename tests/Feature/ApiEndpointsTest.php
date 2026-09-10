<?php

namespace Tests\Feature;

use App\Models\Album;
use App\Models\Media;
use App\Models\User;
use App\Services\TotpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => bcrypt('password123'),
        ]);
    }

    public function test_guest_cannot_access_protected_api_media(): void
    {
        $response = $this->getJson('/api/media');
        $response->assertStatus(401);
    }

    public function test_user_can_login_via_api_and_receive_token(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'token',
                'user' => ['id', 'name', 'email'],
            ]);

        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('token'));
    }

    public function test_api_login_fails_with_wrong_password(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'wrongpass',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_api_login_prompts_for_2fa_when_enabled(): void
    {
        $this->user->update([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => false,
                'two_factor_required' => true,
            ]);
    }

    public function test_api_login_succeeds_with_valid_totp_code(): void
    {
        $secret = 'JBSWY3DPEHPK3PXP';
        $this->user->update([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        $totp = app(TotpService::class);
        $code = $totp->getTotpCode($secret);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password123',
            'two_factor_code' => $code,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_api_login_fails_with_invalid_totp_code(): void
    {
        $this->user->update([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password123',
            'two_factor_code' => '000000',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Kode 2FA atau kode pemulihan salah.');
    }

    public function test_api_login_succeeds_with_recovery_code(): void
    {
        $this->user->update([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => ['ABCD-1234', 'EFGH-5678'],
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password123',
            'two_factor_code' => 'abcd-1234',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $freshUser = $this->user->fresh();
        $this->assertNotContains('ABCD-1234', $freshUser->two_factor_recovery_codes);
        $this->assertContains('EFGH-5678', $freshUser->two_factor_recovery_codes);
    }

    public function test_authenticated_user_can_fetch_profile_and_logout(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/user');

        $response->assertStatus(200)
            ->assertJsonPath('user.email', 'admin@example.com');

        $logoutResp = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/auth/logout');

        $logoutResp->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_authenticated_user_can_fetch_media_list_with_stats(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        Media::create([
            'title' => 'Photo Test 1',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'photo1.jpg',
            'size' => 102400,
            'drive_file_id' => 'drive_123',
            'is_favorite' => true,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/media');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data',
                'pagination',
                'stats' => ['total', 'images', 'videos', 'favorites', 'albums'],
            ]);

        $this->assertEquals(1, count($response->json('data')));
        $this->assertEquals('Photo Test 1', $response->json('data.0.title'));
        $this->assertTrue($response->json('data.0.is_favorite'));
        $this->assertStringContainsString('/api/media/', $response->json('data.0.thumbnail_url'));
        $this->assertStringContainsString('token=' . urlencode($token), $response->json('data.0.thumbnail_url'));
    }

    public function test_media_thumbnail_accessible_with_token_query_parameter(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $media = Media::create([
            'title' => 'Thumb Test',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'thumb.jpg',
            'size' => 1024,
            'drive_file_id' => 'drive_thumb',
            'is_favorite' => false,
        ]);

        // Access via API route with query token
        $response = $this->get("/api/media/{$media->id}/thumbnail?token={$token}");
        // Returns placeholder SVG (200) since drive file is mocked/dummy
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_toggle_favorite_via_api(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $media = Media::create([
            'title' => 'Sample Image',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'sample.jpg',
            'size' => 2048,
            'drive_file_id' => 'drive_456',
            'is_favorite' => false,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/media/{$media->id}/favorite");

        $response->assertStatus(200)
            ->assertJsonPath('is_favorite', true);

        $this->assertTrue($media->fresh()->is_favorite);
    }

    public function test_authenticated_user_can_manage_albums_via_api(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        // Create Album
        $createResp = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/albums', [
                'name' => 'Liburan Bali 2026',
                'description' => 'Foto liburan keluarga',
            ]);

        $createResp->assertStatus(201)
            ->assertJsonPath('data.name', 'Liburan Bali 2026');

        $albumId = $createResp->json('data.id');

        // Fetch Albums
        $listResp = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/albums');

        $listResp->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($listResp->json('data'));

        // Update Album
        $updateResp = $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/albums/{$albumId}", [
                'name' => 'Liburan Bali Update',
            ]);

        $updateResp->assertStatus(200)
            ->assertJsonPath('data.name', 'Liburan Bali Update');

        // Delete Album
        $deleteResp = $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/albums/{$albumId}");

        $deleteResp->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_duplicate_media_detection_and_merging(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        // Create 3 identical media items (1 original + 2 duplicates)
        $orig = Media::create([
            'title' => 'Foto Pantai',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'IMG_9999.JPG',
            'size' => 4500000,
            'drive_file_id' => 'drive_1',
            'is_favorite' => true,
        ]);

        $dup1 = Media::create([
            'title' => 'Foto Pantai Salinan 1',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'IMG_9999.JPG',
            'size' => 4500000,
            'drive_file_id' => 'drive_2',
            'is_favorite' => false,
        ]);

        $dup2 = Media::create([
            'title' => 'Foto Pantai Salinan 2',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'IMG_9999.JPG',
            'size' => 4500000,
            'drive_file_id' => 'drive_3',
            'is_favorite' => false,
        ]);

        // 1. Fetch Duplicates List
        $resp = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/media-duplicates');

        $resp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('duplicate_groups_count', 1)
            ->assertJsonPath('total_duplicate_copies', 2);

        $this->assertEquals($orig->id, $resp->json('groups.0.keeper_id'));

        // 2. Merge Duplicates (Keep keeper, delete dup1 & dup2)
        $mergeResp = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/media-duplicates/merge', [
                'keep_id' => $orig->id,
                'duplicate_ids' => [$dup1->id, $dup2->id],
            ]);

        $mergeResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('deleted_count', 2);

        // Assert database now only contains the original keeper
        $this->assertDatabaseHas('media', ['id' => $orig->id]);
        $this->assertDatabaseMissing('media', ['id' => $dup1->id]);
        $this->assertDatabaseMissing('media', ['id' => $dup2->id]);
    }

    public function test_upload_skips_duplicate_files(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        // Existing media in DB
        $existing = Media::create([
            'title' => 'My Picture',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'original_filename' => 'photo_unique.jpg',
            'size' => 1024,
            'drive_file_id' => 'existing_drive_id',
        ]);

        // Upload a file with exact same size (1024 bytes) and same filename
        $file = \Illuminate\Http\UploadedFile::fake()->create('photo_unique.jpg', 1); // 1 KB = 1024 bytes

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->post('/api/media/upload', [
                'file' => $file,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('uploaded.0.id', $existing->id)
            ->assertJsonPath('uploaded.0.is_duplicate', true);

        // Ensure no second record was created in database
        $this->assertEquals(1, Media::where('original_filename', 'photo_unique.jpg')->count());
    }
}
