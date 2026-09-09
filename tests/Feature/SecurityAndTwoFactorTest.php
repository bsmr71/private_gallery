<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\TotpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecurityAndTwoFactorTest extends TestCase
{
    use RefreshDatabase;

    public function test_sensitive_settings_are_stored_encrypted_in_raw_database(): void
    {
        $plainSecret = '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y_9988';
        Setting::set('google_client_secret', $plainSecret);

        // 1. In the database, the raw string MUST NOT contain the plain secret
        $rawRow = DB::table('settings')->where('key', 'google_client_secret')->first();
        $this->assertNotNull($rawRow);
        $this->assertNotEquals($plainSecret, $rawRow->value);
        $this->assertFalse(str_contains($rawRow->value, 'super_confidential_secret_key_9988'));

        // 2. Setting::get() should transparently decrypt the value
        $retrieved = Setting::get('google_client_secret');
        $this->assertEquals($plainSecret, $retrieved);
    }

    public function test_user_two_factor_secret_is_encrypted_in_raw_database(): void
    {
        $user = User::factory()->create([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => ['ABCD-1234', 'WXYZ-5678'],
        ]);

        // In raw database, two_factor_secret and recovery codes must not be plain text
        $rawUser = DB::table('users')->where('id', $user->id)->first();
        $this->assertNotEquals('JBSWY3DPEHPK3PXP', $rawUser->two_factor_secret);
        $this->assertFalse(str_contains($rawUser->two_factor_recovery_codes, 'ABCD-1234'));

        // Reloaded model decrypts correctly
        $freshUser = User::find($user->id);
        $this->assertEquals('JBSWY3DPEHPK3PXP', $freshUser->two_factor_secret);
        $this->assertContains('ABCD-1234', $freshUser->two_factor_recovery_codes);
    }

    public function test_login_rate_limiting_locks_out_after_5_failed_attempts(): void
    {
        $user = User::factory()->create([
            'email' => 'victim@gallery.com',
            'password' => Hash::make('correct_password'),
        ]);

        // Attempt 5 failed logins
        for ($i = 1; $i <= 5; $i++) {
            $response = $this->post('/login', [
                'email' => 'victim@gallery.com',
                'password' => 'wrong_password',
            ]);
            $response->assertSessionHasErrors('email');
        }

        // 6th attempt must be locked out by rate limiter
        $response = $this->post('/login', [
            'email' => 'victim@gallery.com',
            'password' => 'even_if_correct_now',
        ]);

        $response->assertSessionHasErrors('email');
        $errors = session('errors')->get('email');
        $this->assertTrue(str_contains($errors[0], 'Terlalu banyak percobaan login') || str_contains($errors[0], 'menit'));
    }

    public function test_user_with_2fa_is_redirected_to_2fa_challenge(): void
    {
        $user = User::factory()->create([
            'email' => 'admin2fa@gallery.com',
            'password' => Hash::make('secret123'),
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->post('/login', [
            'email' => 'admin2fa@gallery.com',
            'password' => 'secret123',
        ]);

        $response->assertRedirect('/login/2fa');
        $this->assertGuest(); // Not fully authenticated yet
        $this->assertEquals($user->id, session('login.id'));
    }

    public function test_user_can_verify_2fa_with_valid_totp_code(): void
    {
        $totp = app(TotpService::class);
        $secret = $totp->generateSecretKey();
        $validCode = $totp->getTotpCode($secret);

        $user = User::factory()->create([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        // Start 2FA session
        $response = $this->withSession(['login.id' => $user->id])
            ->post('/login/2fa', [
                'code' => $validCode,
            ]);

        $response->assertRedirect('/admin');
        $this->assertAuthenticatedAs($user);
    }

    public function test_user_can_verify_2fa_with_recovery_code_and_it_is_consumed(): void
    {
        $user = User::factory()->create([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => ['RECV-1111', 'RECV-2222'],
        ]);

        $response = $this->withSession(['login.id' => $user->id])
            ->post('/login/2fa', [
                'code' => 'RECV-1111',
            ]);

        $response->assertRedirect('/admin');
        $this->assertAuthenticatedAs($user);

        // Verify the code RECV-1111 was consumed and only RECV-2222 remains
        $freshUser = User::find($user->id);
        $this->assertNotContains('RECV-1111', $freshUser->two_factor_recovery_codes);
        $this->assertContains('RECV-2222', $freshUser->two_factor_recovery_codes);
    }

    public function test_admin_can_initialize_2fa_setup(): void
    {
        $user = User::factory()->create([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
        ]);

        $response = $this->actingAs($user)->getJson('/admin/2fa/setup');

        $response->assertOk();
        $response->assertJsonStructure(['secret', 'otpauth']);
        $this->assertNotEmpty($response->json('secret'));
        $this->assertStringStartsWith('otpauth://totp/', $response->json('otpauth'));
    }
}
