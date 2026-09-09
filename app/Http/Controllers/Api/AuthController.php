<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
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

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            ],
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
        // Check recovery codes
        $recoveryCodes = $user->two_factor_recovery_codes ?? [];
        if (in_array($code, $recoveryCodes, true)) {
            $user->two_factor_recovery_codes = array_values(array_diff($recoveryCodes, [$code]));
            $user->save();
            return true;
        }

        // Verify standard TOTP
        $secret = $user->two_factor_secret;
        if (!$secret) return false;

        $authController = app(\App\Http\Controllers\AuthController::class);
        return $authController->verifyTotp($secret, $code);
    }
}
