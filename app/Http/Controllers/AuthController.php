<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\TotpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Maximum failed login attempts before lockout.
     */
    private const MAX_LOGIN_ATTEMPTS = 5;

    /**
     * Lockout duration in seconds (15 minutes).
     */
    private const LOCKOUT_SECONDS = 900;

    public function showLogin()
    {
        if (Auth::check()) {
            return redirect()->route('admin.dashboard');
        }

        return view('auth.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $throttleKey = $this->throttleKey($request);

        // Check if user is currently locked out
        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_LOGIN_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            $minutes = ceil($seconds / 60);

            throw ValidationException::withMessages([
                'email' => "Terlalu banyak percobaan login gagal. Demi keamanan, akun dikunci selama {$minutes} menit.",
            ]);
        }

        $user = User::where('email', $credentials['email'])->first();

        // Verify password
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            RateLimiter::hit($throttleKey, self::LOCKOUT_SECONDS);
            $attemptsLeft = self::MAX_LOGIN_ATTEMPTS - RateLimiter::attempts($throttleKey);

            $msg = 'Email atau password salah.';
            if ($attemptsLeft > 0) {
                $msg .= " Sisa percobaan: {$attemptsLeft}x.";
            }

            return back()->withErrors(['email' => $msg])->onlyInput('email');
        }

        // Password is correct: clear the failed attempts throttle
        RateLimiter::clear($throttleKey);

        // Check if user has Two-Factor Authentication enabled
        if ($user->hasEnabledTwoFactor()) {
            $request->session()->put('login.id', $user->id);
            $request->session()->put('login.remember', $request->boolean('remember'));

            return redirect()->route('login.2fa');
        }

        // Direct login if 2FA is not enabled
        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return redirect()->intended(route('admin.dashboard'));
    }

    /**
     * Show 2FA challenge form during login.
     */
    public function show2fa(Request $request)
    {
        if (!Auth::check() && !$request->session()->has('login.id')) {
            return redirect()->route('login');
        }

        if (Auth::check()) {
            return redirect()->route('admin.dashboard');
        }

        return view('auth.2fa');
    }

    /**
     * Verify 2FA code during login.
     */
    public function verify2fa(Request $request, TotpService $totp)
    {
        $userId = $request->session()->get('login.id');
        if (!$userId) {
            return redirect()->route('login');
        }

        $request->validate([
            'code' => 'required|string',
        ]);

        $user = User::findOrFail($userId);
        $code = trim($request->input('code'));

        $throttleKey = '2fa:throttle:' . $user->id;
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return back()->withErrors(['code' => "Terlalu banyak percobaan kode 2FA. Tunggu {$seconds} detik."]);
        }

        // 1. Check if it's a valid 6-digit TOTP code
        if (strlen($code) === 6 && ctype_digit($code) && $totp->verifyCode($user->two_factor_secret, $code)) {
            RateLimiter::clear($throttleKey);
            return $this->complete2faLogin($request, $user);
        }

        // 2. Check if it's a valid recovery code (e.g. ABCD-1234)
        $recoveryCodes = $user->two_factor_recovery_codes ?? [];
        $normalizedCode = strtoupper($code);

        if (in_array($normalizedCode, $recoveryCodes)) {
            // Remove used recovery code
            $recoveryCodes = array_values(array_diff($recoveryCodes, [$normalizedCode]));
            $user->two_factor_recovery_codes = $recoveryCodes;
            $user->save();

            RateLimiter::clear($throttleKey);
            $request->session()->flash('warning', 'Anda login menggunakan kode pemulihan cadangan. Sisa kode: ' . count($recoveryCodes));
            return $this->complete2faLogin($request, $user);
        }

        RateLimiter::hit($throttleKey, 300);
        return back()->withErrors(['code' => 'Kode autentikasi 6-digit atau kode pemulihan salah.']);
    }

    /**
     * Setup 2FA: Generate secret key and QR code data.
     */
    public function setup2fa(TotpService $totp)
    {
        $user = Auth::user();

        // If not already set or unconfirmed, generate a new secret
        if (!$user->two_factor_secret || !$user->two_factor_confirmed_at) {
            $secret = $totp->generateSecretKey();
            $user->two_factor_secret = $secret;
            $user->save();
        } else {
            $secret = $user->two_factor_secret;
        }

        $appName = config('app.name', 'Media Gallery');
        $otpauthUri = $totp->getOtpauthUri($appName, $user->email, $secret);

        return response()->json([
            'secret' => $secret,
            'otpauth' => $otpauthUri,
        ]);
    }

    /**
     * Confirm and activate 2FA with the first 6-digit code.
     */
    public function confirm2fa(Request $request, TotpService $totp)
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = Auth::user();

        if (!$user->two_factor_secret) {
            return back()->with('error', 'Silakan klik Aktifkan 2FA terlebih dahulu.');
        }

        if (!$totp->verifyCode($user->two_factor_secret, $request->code)) {
            return back()->with('error', 'Kode autentikasi salah. Pastikan waktu di HP Anda akurat.');
        }

        $recoveryCodes = $totp->generateRecoveryCodes(8);

        $user->two_factor_confirmed_at = now();
        $user->two_factor_recovery_codes = $recoveryCodes;
        $user->save();

        return back()->with('success', 'Google Authenticator (2FA) berhasil diaktifkan!')
            ->with('show_recovery_codes', $recoveryCodes);
    }

    /**
     * Disable 2FA (requires current password).
     */
    public function disable2fa(Request $request)
    {
        $request->validate([
            'password' => 'required',
        ]);

        $user = Auth::user();

        if (!Hash::check($request->password, $user->password)) {
            return back()->with('error', 'Password salah. Gagal menonaktifkan 2FA.');
        }

        $user->two_factor_secret = null;
        $user->two_factor_confirmed_at = null;
        $user->two_factor_recovery_codes = null;
        $user->save();

        return back()->with('success', 'Two-Factor Authentication (2FA) telah dinonaktifkan.');
    }

    /**
     * Regenerate recovery codes.
     */
    public function regenerateRecoveryCodes(Request $request, TotpService $totp)
    {
        $user = Auth::user();

        if (!$user->hasEnabledTwoFactor()) {
            return back()->with('error', '2FA belum diaktifkan.');
        }

        $codes = $totp->generateRecoveryCodes(8);
        $user->two_factor_recovery_codes = $codes;
        $user->save();

        return back()->with('success', 'Kode pemulihan baru berhasil dibuat!')
            ->with('show_recovery_codes', $codes);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    private function complete2faLogin(Request $request, User $user)
    {
        $remember = $request->session()->get('login.remember', false);
        $request->session()->forget(['login.id', 'login.remember']);

        Auth::login($user, $remember);
        $request->session()->regenerate();

        return redirect()->intended(route('admin.dashboard'));
    }

    private function throttleKey(Request $request): string
    {
        return 'login:throttle:' . Str::transliterate(Str::lower($request->input('email')) . '|' . $request->ip());
    }
}
