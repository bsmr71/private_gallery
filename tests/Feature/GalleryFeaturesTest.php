<?php

namespace Tests\Feature;

use App\Models\Album;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GalleryFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_user_can_toggle_favorite_status(): void
    {
        $media = Media::create([
            'title' => 'Pemandangan Pantai',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_fav_1',
            'is_favorite' => false,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson(route('media.favorite', $media));

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_favorite' => true,
            ]);

        $this->assertTrue($media->fresh()->is_favorite);

        // Toggle again to unfavorite
        $response = $this->actingAs($this->user)
            ->postJson(route('media.favorite', $media));

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_favorite' => false,
            ]);

        $this->assertFalse($media->fresh()->is_favorite);
    }

    public function test_user_can_quick_rename_media(): void
    {
        $media = Media::create([
            'title' => 'DSC_0001.JPG',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 2048,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_rename_1',
        ]);

        $response = $this->actingAs($this->user)
            ->postJson(route('media.quick-rename', $media), [
                'title' => 'Foto Sunset Bali',
                'description' => 'Diambil saat liburan musim panas',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'media' => [
                    'id' => $media->id,
                    'title' => 'Foto Sunset Bali',
                    'description' => 'Diambil saat liburan musim panas',
                ],
            ]);

        $this->assertEquals('Foto Sunset Bali', $media->fresh()->title);
        $this->assertEquals('Diambil saat liburan musim panas', $media->fresh()->description);
    }

    public function test_user_can_move_media_to_album(): void
    {
        $album = Album::create(['name' => 'Liburan', 'slug' => 'liburan']);
        $media = Media::create([
            'title' => 'Pantai Kuta',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_move_1',
            'album_id' => null,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson(route('media.move'), [
                'media_ids' => [$media->id],
                'album_id' => $album->id,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'album_id' => $album->id,
                'count' => 1,
            ]);

        $this->assertEquals($album->id, $media->fresh()->album_id);
    }

    public function test_user_can_move_media_to_new_dynamically_created_album(): void
    {
        $media = Media::create([
            'title' => 'Gunung Bromo',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_move_2',
            'album_id' => null,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson(route('media.move'), [
                'media_ids' => [$media->id],
                'new_album_name' => 'Wisata Bromo',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'album_name' => 'Wisata Bromo',
                'count' => 1,
            ]);

        $createdAlbum = Album::where('name', 'Wisata Bromo')->first();
        $this->assertNotNull($createdAlbum);
        $this->assertEquals($createdAlbum->id, $media->fresh()->album_id);
    }

    public function test_user_can_copy_media_to_album(): void
    {
        $album = Album::create(['name' => 'Keluarga', 'slug' => 'keluarga']);
        $media = Media::create([
            'title' => 'Ulang Tahun',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_copy_1',
            'album_id' => null,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson(route('media.copy'), [
                'media_ids' => [$media->id],
                'album_id' => $album->id,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'album_id' => $album->id,
                'count' => 1,
            ]);

        // Original media still exists and has null album_id
        $this->assertNull($media->fresh()->album_id);

        // Cloned media exists with target album_id and same drive_file_id
        $cloned = Media::where('album_id', $album->id)->first();
        $this->assertNotNull($cloned);
        $this->assertEquals($media->drive_file_id, $cloned->drive_file_id);
        $this->assertNotEquals($media->id, $cloned->id);
    }

    public function test_gallery_index_filters_favorites(): void
    {
        $favMedia = Media::create([
            'title' => 'Foto Favorit',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_fav_a',
            'is_favorite' => true,
        ]);

        $normalMedia = Media::create([
            'title' => 'Foto Biasa',
            'type' => 'image',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'original_filename' => 'photo.jpg',
            'drive_file_id' => 'drv_normal_b',
            'is_favorite' => false,
        ]);

        // Access favorite tab
        $response = $this->actingAs($this->user)
            ->get(route('gallery.index', ['favorite' => '1']));

        $response->assertStatus(200)
            ->assertSee('Foto Favorit')
            ->assertDontSee('Foto Biasa');
    }

    public function test_user_can_view_visual_albums_showcase(): void
    {
        $album = Album::create(['name' => 'Album Kenangan', 'slug' => 'album-kenangan']);

        $response = $this->actingAs($this->user)
            ->get(route('gallery.albums'));

        $response->assertStatus(200)
            ->assertSee('Koleksi Album')
            ->assertSee('Album Kenangan')
            ->assertSee('Buat Album Baru');
    }
}
