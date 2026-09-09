<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\TotpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Authenticate user and issue Sanctum personal access token.
     * Supports 2FA verification if enabled.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'two_factor_code' => 'nullable|string',
            'device_name' => 'nullable|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau password yang Anda masukkan salah.',
            ], 401);
        }

        // Check 2FA if user has confirmed 2FA
        if ($user->hasTwoFactorEnabled()) {
            if (!$request->filled('two_factor_code')) {
                return response()->json([
                    'success' => false,
                    'two_factor_required' => true,
                    'message' => 'Kode autentikasi 2-faktor (2FA) diperlukan.',
                ], 200);
            }

            // Verify 2FA code or recovery code
            $code = trim($request->two_factor_code);
            $valid = $this->verifyTwoFactorCode($user, $code);

            if (!$valid) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kode 2FA atau kode pemulihan salah.',
                ], 422);
            }
        }

        $deviceName = $request->input('device_name', 'Mobile App (Apple Photos Style)');
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            ],
        ]);
    }

    /**
     * Get authenticated user profile.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        $pinSyncRequested = (bool) (\App\Models\Setting::get('mobile_pin_sync_requested') ?: \App\Models\Setting::get('mobile_pin_reset_requested', false));
        $action = \App\Models\Setting::get('mobile_pin_action', 'set_new_pin');
        $newMasterPin = $action === 'set_new_pin' ? (string) \App\Models\Setting::get('mobile_new_master_pin', '') : '';
        $newDecoyPin = $action === 'set_new_pin' ? (string) \App\Models\Setting::get('mobile_new_decoy_pin', '') : '';

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
                'mobile_security' => [
                    'pin_reset_requested' => $pinSyncRequested,
                    'pin_sync_requested' => $pinSyncRequested,
                    'action' => $action,
                    'new_master_pin' => $newMasterPin,
                    'new_decoy_pin' => $newDecoyPin,
                ],
            ],
        ]);
    }

    /**
     * Acknowledge and clear remote mobile PIN reset/sync request.
     */
    public function ackPinReset(Request $request): JsonResponse
    {
        \App\Models\Setting::set('mobile_pin_reset_requested', '0');
        \App\Models\Setting::set('mobile_pin_sync_requested', '0');
        \App\Models\Setting::set('mobile_pin_action', '');
        \App\Models\Setting::set('mobile_new_master_pin', '');
        \App\Models\Setting::set('mobile_new_decoy_pin', '');

        return response()->json([
            'success' => true,
            'message' => 'PIN sync acknowledged successfully.',
        ]);
    }

    /**
     * Revoke current access token (logout).
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->attributes->get('current_api_token');
        if ($token) {
            $token->delete();
        } else {
            $bearer = $request->bearerToken();
            if ($bearer) {
                $record = \App\Models\PersonalAccessToken::findToken($bearer);
                if ($record) $record->delete();
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ]);
    }

    /**
     * Verify TOTP code or recovery code.
     */
    protected function verifyTwoFactorCode(User $user, string $code): bool
    {
        $code = trim($code);

        // 1. Verify standard 6-digit TOTP
        if (strlen($code) === 6 && ctype_digit($code)) {
            $secret = $user->two_factor_secret;
            if ($secret && app(TotpService::class)->verifyCode($secret, $code)) {
                return true;
            }
        }

        // 2. Check recovery codes (case-insensitive)
        $recoveryCodes = $user->two_factor_recovery_codes ?? [];
        $normalizedCode = strtoupper($code);
        if (in_array($normalizedCode, $recoveryCodes, true)) {
            $user->two_factor_recovery_codes = array_values(array_diff($recoveryCodes, [$normalizedCode]));
            $user->save();
            return true;
        }

        return false;
    }
}
