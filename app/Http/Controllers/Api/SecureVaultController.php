<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\User;
use App\Services\TotpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SecureVaultController extends Controller
{
    public function __construct(
        protected TotpService $totpService
    ) {}

    /**
     * Get Secure Vault status and available verification methods.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $lockedCount = 0;
        try {
            $lockedCount = Media::where('is_locked', true)->count();
        } catch (\Throwable $e) {}

        return response()->json([
            'success' => true,
            'data' => [
                'email' => $user->email,
                'has_authenticator' => $user->hasTwoFactorEnabled(),
                'locked_count' => $lockedCount,
            ],
        ]);
    }

    /**
     * Request an OTP code sent to user's email.
     */
    public function requestEmailOtp(Request $request): JsonResponse
    {
        $user = $request->user();

        // Rate limit: 1 OTP request every 45 seconds
        $rateKey = 'vault_otp_rate_' . $user->id;
        if (Cache::has($rateKey)) {
            $secondsRemaining = Cache::get($rateKey) - time();
            if ($secondsRemaining > 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Harap tunggu {$secondsRemaining} detik sebelum meminta kode OTP baru.",
                ], 429);
            }
        }

        $code = str_pad((string)random_int(100000, 999999), 6, '0', STR_PAD_LEFT);

        // Store OTP for 5 minutes
        Cache::put('vault_email_otp_' . $user->id, $code, now()->addMinutes(5));
        Cache::put($rateKey, time() + 45, 45);

        Log::info("Secure Vault Email OTP generated for {$user->email}: {$code}");

        // Attempt to send email
        try {
            Mail::raw(
                "Halo {$user->name},\n\nKode verifikasi OTP untuk membuka Brankas Terkunci (Secure Vault) di aplikasi Lumina Anda adalah:\n\n{$code}\n\nKode ini berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.",
                function ($message) use ($user) {
                    $message->to($user->email)
                        ->subject('Kode OTP Brankas Terkunci Lumina');
                }
            );
        } catch (\Throwable $e) {
            Log::warning("Could not send Secure Vault email OTP: " . $e->getMessage());
        }

        $response = [
            'success' => true,
            'message' => 'Kode OTP telah dikirimkan ke email ' . $this->maskEmail($user->email) . '.',
        ];

        // Provide debug code in local development / debug mode for convenience
        if (config('app.debug')) {
            $response['debug_otp'] = $code;
        }

        return response()->json($response);
    }

    /**
     * Unlock the Secure Vault using Password + (Authenticator OTP or Email OTP).
     */
    public function unlock(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
            'otp_code' => 'required|string|size:6',
            'otp_type' => 'required|in:authenticator,email',
        ]);

        $user = $request->user();

        // 1. Verify Password
        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Kata sandi yang Anda masukkan salah.',
            ], 401);
        }

        $code = trim($request->otp_code);

        // 2. Verify OTP
        if ($request->otp_type === 'authenticator') {
            if (!$user->hasTwoFactorEnabled() || empty($user->two_factor_secret)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Autentikator 2FA belum diaktifkan pada akun Anda. Silakan gunakan verifikasi OTP Email.',
                ], 422);
            }

            $valid = $this->totpService->verifyCode($user->two_factor_secret, $code);

            // Also check emergency recovery codes
            if (!$valid && !empty($user->two_factor_recovery_codes)) {
                $recoveryCodes = $user->two_factor_recovery_codes;
                if (is_array($recoveryCodes) && in_array($code, $recoveryCodes, true)) {
                    $valid = true;
                }
            }

            if (!$valid) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kode Authenticator (TOTP) salah atau kedaluwarsa.',
                ], 422);
            }
        } elseif ($request->otp_type === 'email') {
            $cachedCode = Cache::get('vault_email_otp_' . $user->id);

            if (!$cachedCode || !hash_equals((string)$cachedCode, (string)$code)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kode OTP Email salah atau sudah kedaluwarsa. Silakan minta kode baru.',
                ], 422);
            }

            // Consume the OTP so it cannot be reused
            Cache::forget('vault_email_otp_' . $user->id);
        }

        // 3. Issue Temporary Vault Token (Valid for 15 minutes)
        $vaultToken = Str::random(64);
        Cache::put('vault_session_' . $vaultToken, $user->id, now()->addMinutes(15));

        return response()->json([
            'success' => true,
            'message' => 'Brankas Terkunci berhasil dibuka.',
            'vault_token' => $vaultToken,
            'expires_in_minutes' => 15,
        ]);
    }

    /**
     * Get media items inside Secure Vault.
     */
    public function media(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeVaultSession($request, $user);

        $query = Media::with('album')->where('is_locked', true)->latest();

        if ($request->filled('type') && in_array($request->type, ['image', 'video'])) {
            $query->where('type', $request->type);
        }

        $perPage = min((int)$request->input('per_page', 40), 100);
        $paginated = $query->paginate($perPage);

        $token = $request->attributes->get('plain_api_token') ?: $request->bearerToken() ?: $request->query('token');
        $tokenParam = $token ? '?token=' . urlencode($token) : '';
        $baseApiUrl = rtrim($request->getSchemeAndHttpHost(), '/') . '/api';

        $items = collect($paginated->items())->map(function ($m) use ($baseApiUrl, $tokenParam) {
            return [
                'id' => $m->id,
                'title' => $m->title,
                'description' => $m->description,
                'type' => $m->type,
                'mime_type' => $m->mime_type,
                'original_filename' => $m->original_filename,
                'size' => $m->size,
                'formatted_size' => $m->formattedSize(),
                'is_favorite' => (bool)$m->is_favorite,
                'is_locked' => (bool)$m->is_locked,
                'album' => $m->album ? [
                    'id' => $m->album->id,
                    'name' => $m->album->name,
                ] : null,
                'thumbnail_url' => "{$baseApiUrl}/media/{$m->id}/thumbnail{$tokenParam}",
                'stream_url' => "{$baseApiUrl}/media/{$m->id}/stream{$tokenParam}",
                'download_url' => "{$baseApiUrl}/media/{$m->id}/download{$tokenParam}",
                'created_at' => $m->created_at ? $m->created_at->toIso8601String() : null,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $items,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'total_locked' => Media::where('is_locked', true)->count(),
        ]);
    }

    /**
     * Move media items into Secure Vault (Lock).
     */
    public function lockMedia(Request $request): JsonResponse
    {
        $request->validate([
            'media_ids' => 'required|array|min:1',
            'media_ids.*' => 'integer|exists:media,id',
        ]);

        $count = Media::whereIn('id', $request->media_ids)->update(['is_locked' => true]);

        return response()->json([
            'success' => true,
            'message' => "{$count} media berhasil dipindahkan ke Brankas Terkunci.",
            'locked_count' => Media::where('is_locked', true)->count(),
        ]);
    }

    /**
     * Move media items out of Secure Vault back to public gallery (Unlock).
     */
    public function unlockMedia(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeVaultSession($request, $user);

        $request->validate([
            'media_ids' => 'required|array|min:1',
            'media_ids.*' => 'integer|exists:media,id',
        ]);

        $count = Media::whereIn('id', $request->media_ids)->update(['is_locked' => false]);

        return response()->json([
            'success' => true,
            'message' => "{$count} media berhasil dikembalikan ke galeri utama.",
            'locked_count' => Media::where('is_locked', true)->count(),
        ]);
    }

    /**
     * Validate active vault token session.
     */
    protected function authorizeVaultSession(Request $request, User $user): void
    {
        $vaultToken = $request->header('X-Vault-Token') ?: $request->query('vault_token');

        if (!$vaultToken || Cache::get('vault_session_' . $vaultToken) !== $user->id) {
            abort(response()->json([
                'success' => false,
                'session_expired' => true,
                'message' => 'Sesi Brankas Terkunci telah kedaluwarsa. Silakan masukkan kata sandi & OTP kembali.',
            ], 403));
        }
    }

    /**
     * Mask email for privacy (e.g. b***r@gmail.com).
     */
    protected function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) return $email;

        $name = $parts[0];
        $domain = $parts[1];

        if (strlen($name) <= 2) {
            $maskedName = substr($name, 0, 1) . '*';
        } else {
            $maskedName = substr($name, 0, 1) . str_repeat('*', strlen($name) - 2) . substr($name, -1);
        }

        return "{$maskedName}@{$domain}";
    }
}
