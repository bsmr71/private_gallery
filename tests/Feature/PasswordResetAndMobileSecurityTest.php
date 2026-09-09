<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetAndMobileSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'owner@example.com',
            'password' => Hash::make('SecretPassword123!'),
        ]);
    }

    public function test_forgot_password_page_is_accessible(): void
    {
        $response = $this->get(route('password.request'));
        $response->assertStatus(200);
        $response->assertSee('Lupa Kata Sandi');
        $response->assertSee('Kirim Tautan Reset');
    }

    public function test_user_can_request_password_reset_link(): void
    {
        Notification::fake();

        $response = $this->post(route('password.email'), [
            'email' => 'owner@example.com',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('status');

        Notification::assertSentTo(
            $this->user,
            ResetPasswordNotification::class,
            function ($notification) {
                return !empty($notification->token);
            }
        );
    }

    public function test_reset_password_page_is_accessible_with_token(): void
    {
        $token = Password::broker()->createToken($this->user);

        $response = $this->get(route('password.reset', ['token' => $token, 'email' => 'owner@example.com']));
        $response->assertStatus(200);
        $response->assertSee('Kata Sandi Baru');
        $response->assertSee('Perbarui &amp; Simpan Kata Sandi', false);
    }

    public function test_user_can_reset_password_with_valid_token(): void
    {
        $token = Password::broker()->createToken($this->user);

        $response = $this->post(route('password.update'), [
            'token' => $token,
            'email' => 'owner@example.com',
            'password' => 'NewSecurePassword2026!',
            'password_confirmation' => 'NewSecurePassword2026!',
        ]);

        $response->assertRedirect(route('login'));
        $response->assertSessionHas('status');

        $this->user->refresh();
        $this->assertTrue(Hash::check('NewSecurePassword2026!', $this->user->password));
    }

    public function test_admin_can_request_mobile_pin_reset(): void
    {
        $this->actingAs($this->user);

        $response = $this->post(route('admin.mobile.reset-pin'));
        $response->assertRedirect(route('admin.settings'));
        $response->assertSessionHas('success');

        $this->assertEquals('1', Setting::get('mobile_pin_reset_requested'));
        $this->assertNotNull(Setting::get('mobile_pin_reset_at'));
    }

    public function test_admin_can_cancel_mobile_pin_reset(): void
    {
        $this->actingAs($this->user);
        Setting::set('mobile_pin_reset_requested', '1');

        $response = $this->post(route('admin.mobile.cancel-reset-pin'));
        $response->assertRedirect(route('admin.settings'));
        $response->assertSessionHas('info');

        $this->assertEquals('0', Setting::get('mobile_pin_reset_requested'));
    }

    public function test_mobile_api_detects_pin_reset_and_can_acknowledge(): void
    {
        $tokenObj = $this->user->createToken('Test Mobile App');
        $plainToken = $tokenObj->plainTextToken;

        // 1. Initial state: no reset requested
        $res = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/auth/user');
        $res->assertStatus(200);
        $res->assertJsonPath('user.mobile_security.pin_reset_requested', false);

        // 2. Request reset from web dashboard
        Setting::set('mobile_pin_reset_requested', '1');

        $res = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/auth/user');
        $res->assertStatus(200);
        $res->assertJsonPath('user.mobile_security.pin_reset_requested', true);

        // 3. Mobile app acknowledges the reset
        $ackRes = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->postJson('/api/auth/ack-pin-reset');
        $ackRes->assertStatus(200);
        $ackRes->assertJsonPath('success', true);

        // 4. Verify setting cleared
        $this->assertEquals('0', Setting::get('mobile_pin_reset_requested'));

        $resAfter = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/auth/user');
        $resAfter->assertStatus(200);
        $resAfter->assertJsonPath('user.mobile_security.pin_reset_requested', false);
    }

    public function test_admin_can_revoke_mobile_device_token(): void
    {
        $this->actingAs($this->user);

        $tokenObj = $this->user->createToken('Ponsel Android (Samsung)');
        $tokenId = $tokenObj->accessToken->id;
        $plainToken = $tokenObj->plainTextToken;

        // Device can access API before revocation
        $resBefore = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/auth/user');
        $resBefore->assertStatus(200);

        // Revoke via web dashboard
        $response = $this->delete(route('admin.mobile.revoke-device', $tokenId));
        $response->assertRedirect(route('admin.settings'));
        $response->assertSessionHas('success');

        // Device is immediately 401 Unauthenticated
        $resAfter = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/auth/user');
        $resAfter->assertStatus(401);
    }

    public function test_admin_can_revoke_all_mobile_devices(): void
    {
        $this->actingAs($this->user);

        $token1 = $this->user->createToken('iPhone 15 Pro')->plainTextToken;
        $token2 = $this->user->createToken('iPad Air')->plainTextToken;

        $this->assertEquals(2, $this->user->tokens()->count());

        // Revoke all
        $response = $this->post(route('admin.mobile.revoke-all'));
        $response->assertRedirect(route('admin.settings'));
        $response->assertSessionHas('success');

        $this->assertEquals(0, $this->user->tokens()->count());

        // Both tokens are 401 Unauthenticated
        $res1 = $this->withHeader('Authorization', 'Bearer ' . $token1)->getJson('/api/auth/user');
        $res1->assertStatus(401);

        $res2 = $this->withHeader('Authorization', 'Bearer ' . $token2)->getJson('/api/auth/user');
        $res2->assertStatus(401);
    }
}
