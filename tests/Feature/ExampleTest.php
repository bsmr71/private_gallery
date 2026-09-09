<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        $response = $this->get('/');
        $response->assertRedirect('/login');
    }

    public function test_login_page_is_accessible(): void
    {
        $response = $this->get('/login');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_view_gallery(): void
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get('/');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_view_admin_dashboard(): void
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get('/admin');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_view_media_management(): void
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get('/admin/media');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_view_albums(): void
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get('/admin/albums');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_view_settings(): void
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get('/admin/settings');
        $response->assertStatus(200);
    }
}
