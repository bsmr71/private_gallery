<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MobileSecurityController extends Controller
{
    /**
     * Trigger remote PIN reset for mobile application.
     */
    public function resetMobilePin(Request $request): RedirectResponse
    {
        Setting::set('mobile_pin_reset_requested', '1');
        Setting::set('mobile_pin_reset_at', now()->toDateTimeString());

        return redirect()->route('admin.settings')
            ->with('success', 'Permintaan reset PIN aplikasi mobile berhasil dikirim. Saat aplikasi dibuka berikutnya, PIN keamanan akan dihapus secara otomatis sehingga Anda dapat masuk dan membuat PIN baru.');
    }

    /**
     * Cancel pending mobile PIN reset request.
     */
    public function cancelResetMobilePin(Request $request): RedirectResponse
    {
        Setting::set('mobile_pin_reset_requested', '0');

        return redirect()->route('admin.settings')
            ->with('info', 'Permintaan reset PIN aplikasi mobile telah dibatalkan.');
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
