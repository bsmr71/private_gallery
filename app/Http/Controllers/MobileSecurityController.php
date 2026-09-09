<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class MobileSecurityController extends Controller
{
    /**
     * Set a new 6-digit Master PIN (and optional Decoy PIN) from Web Dashboard.
     */
    public function updateMobilePin(Request $request): RedirectResponse
    {
        $request->validate([
            'web_password' => 'required|string',
            'master_pin' => 'required|digits:6',
            'decoy_pin' => 'nullable|digits:6|different:master_pin',
        ], [
            'web_password.required' => 'Password akun web wajib dimasukkan sebagai verifikasi keamanan.',
            'master_pin.required' => 'Master PIN 6-digit wajib diisi.',
            'master_pin.digits' => 'Master PIN harus tepat 6 digit angka.',
            'decoy_pin.digits' => 'Decoy PIN harus tepat 6 digit angka.',
            'decoy_pin.different' => 'Decoy PIN tidak boleh sama dengan Master PIN.',
        ]);

        $user = Auth::user();
        if (!Hash::check($request->web_password, $user->password)) {
            return redirect()->route('admin.settings')
                ->withErrors(['mobile_pin_password' => 'Password akun web yang Anda masukkan salah. Perubahan PIN dibatalkan.'])
                ->withInput();
        }

        Setting::set('mobile_new_master_pin', (string) $request->master_pin);
        Setting::set('mobile_new_decoy_pin', (string) ($request->decoy_pin ?? ''));
        Setting::set('mobile_pin_action', 'set_new_pin');
        Setting::set('mobile_pin_sync_requested', '1');
        Setting::set('mobile_pin_sync_at', now()->toDateTimeString());

        return redirect()->route('admin.settings')
            ->with('success', 'PIN baru berhasil disimpan! Saat aplikasi HP dibuka berikutnya, 6-digit PIN baru akan langsung diterapkan secara otomatis.');
    }

    /**
     * Trigger remote PIN reset/disable for mobile application.
     */
    public function resetMobilePin(Request $request): RedirectResponse
    {
        Setting::set('mobile_pin_action', 'reset_to_none');
        Setting::set('mobile_new_master_pin', '');
        Setting::set('mobile_new_decoy_pin', '');
        Setting::set('mobile_pin_sync_requested', '1');
        Setting::set('mobile_pin_sync_at', now()->toDateTimeString());

        return redirect()->route('admin.settings')
            ->with('success', 'Instruksi hapus PIN berhasil dikirim. Saat aplikasi dibuka berikutnya, kunci PIN akan dinonaktifkan sehingga Anda dapat masuk langsung.');
    }

    /**
     * Cancel pending mobile PIN sync/reset request.
     */
    public function cancelResetMobilePin(Request $request): RedirectResponse
    {
        Setting::set('mobile_pin_sync_requested', '0');
        Setting::set('mobile_pin_action', '');
        Setting::set('mobile_new_master_pin', '');
        Setting::set('mobile_new_decoy_pin', '');

        return redirect()->route('admin.settings')
            ->with('info', 'Permintaan sinkronisasi/reset PIN aplikasi mobile telah dibatalkan.');
    }

    /**
     * Revoke access for a specific mobile device token.
     */
    public function revokeDevice(Request $request, int|string $tokenId): RedirectResponse
    {
        $user = Auth::user();
        $token = $user->tokens()->where('id', $tokenId)->first();

        if (!$token) {
            return redirect()->route('admin.settings')
                ->with('error', 'Perangkat tidak ditemukan atau sudah tidak aktif.');
        }

        $deviceName = $token->name;
        $token->delete();

        return redirect()->route('admin.settings')
            ->with('success', "Akses untuk perangkat '{$deviceName}' berhasil dicabut. Sesi login di perangkat tersebut telah dinonaktifkan.");
    }

    /**
     * Revoke all mobile device tokens (remote wipe / lost phone emergency).
     */
    public function revokeAllDevices(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $count = $user->tokens()->count();
        $user->tokens()->delete();

        return redirect()->route('admin.settings')
            ->with('success', "Semua sesi mobile ({$count} perangkat) berhasil dicabut. Semua perangkat yang terhubung kini harus login kembali.");
    }
}
