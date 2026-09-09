@extends('layouts.app')
@section('title', 'Pengaturan & Keamanan — Admin')

@section('content')
<div class="settings-shell">

    <!-- Page Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 16px;">
        <div>
            <h1 class="page-title" style="margin-bottom: 6px;">Pengaturan &amp; Keamanan Sistem</h1>
            <p class="page-subtitle" style="margin: 0;">Konfigurasi penyimpanan cloud Google Drive, autentikasi 2FA, dan enkripsi data database</p>
        </div>
        <div>
            <form action="{{ route('admin.settings.test') }}" method="POST" style="margin: 0;">
                @csrf
                <button type="submit" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 500;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Uji Coba Koneksi Drive
                </button>
            </form>
        </div>
    </div>

    <!-- Status Overview Grid -->
    <div class="settings-card">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <!-- Status 1: Google One OAuth -->
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Penyimpanan Google One</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    @if($isOauthConnected || request('connected'))
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a;"></span>
                            Terhubung &amp; Siap Digunakan
                        </span>
                    @elseif($clientId && $clientSecret)
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></span>
                            Menunggu Otorisasi
                        </span>
                    @else
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span>
                            Belum Diatur
                        </span>
                    @endif
                </div>
            </div>

            <!-- Status 2: Two-Factor Authentication -->
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Keamanan 2FA (Authenticator)</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    @if($user && $user->hasEnabledTwoFactor())
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a;"></span>
                            Aktif &amp; Terlindungi
                        </span>
                    @else
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #dc2626;"></span>
                            Nonaktif (Belum Terpasang)
                        </span>
                    @endif
                </div>
            </div>

            <!-- Status 3: Database Encryption -->
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Enkripsi Database Hosting</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #0284c7;"></span>
                        AES-256 (Terenkripsi)
                    </span>
                </div>
            </div>

            <!-- Status 4: Brute-Force Rate Limiting -->
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Proteksi Brute-Force</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #166534; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
                        Aktif (Maks. 5x / 15 Menit)
                    </span>
                </div>
            </div>

            <!-- Status 5: Mobile App Security -->
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Keamanan Mobile App</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    @if($mobilePinSyncRequested)
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></span>
                            {{ $mobilePinAction === 'set_new_pin' ? 'Menunggu Pasang PIN Baru' : 'Menunggu Hapus PIN' }}
                        </span>
                    @elseif($mobileTokens->isNotEmpty())
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a;"></span>
                            {{ $mobileTokens->count() }} Sesi HP Aktif
                        </span>
                    @else
                        <span style="display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span>
                            Tidak Ada Sesi Aktif
                        </span>
                    @endif
                </div>
            </div>
        </div>

        @if($clientId && $clientSecret && !$isOauthConnected && !request('connected'))
            <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: #fffbeb; padding: 12px 16px; border-radius: 8px; border: 1px solid #fef3c7;">
                <div style="font-size: 0.875rem; color: #92400e;">
                    <strong>Langkah Terakhir:</strong> Kredensial OAuth tersimpan. Klik tombol di samping untuk otorisasi akun Google One kamu.
                </div>
                <a href="{{ route('admin.google.connect') }}" class="btn btn-primary" style="font-size: 0.875rem; padding: 8px 18px; white-space: nowrap;">
                    🔗 Hubungkan Akun Google Sekarang →
                </a>
            </div>
        @endif
    </div>

    <!-- RECOVERY CODES FLASH BANNER -->
    @if(session('show_recovery_codes'))
        <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 12px; padding: 24px; margin-bottom: 28px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);">
            <div style="display: flex; align-items: flex-start; gap: 14px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #d1fae5; color: #047857; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div style="flex: 1;">
                    <h3 style="font-size: 1.05rem; font-weight: 700; color: #065f46; margin: 0 0 6px 0;">
                        Simpan Kode Pemulihan Cadangan (Recovery Codes) Ini Sekarang!
                    </h3>
                    <p style="font-size: 0.875rem; color: #047857; line-height: 1.5; margin: 0 0 16px 0;">
                        Kode-kode ini <strong>hanya ditampilkan saat ini</strong>. Jika ponsel Anda hilang atau tidak dapat membuka Google Authenticator, Anda dapat menggunakan salah satu kode di bawah ini untuk login. Setiap kode hanya berlaku untuk 1 kali pakai.
                    </p>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px;">
                        @foreach(session('show_recovery_codes') as $code)
                            <div style="background: #ffffff; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 12px; font-family: monospace; font-size: 0.95rem; font-weight: 700; color: #065f46; text-align: center; letter-spacing: 1px;">
                                {{ $code }}
                            </div>
                        @endforeach
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="copyRecoveryCodes('{{ implode('\n', session('show_recovery_codes')) }}')" style="background: #ffffff; border-color: #a7f3d0; color: #047857; font-weight: 600;">
                            📋 Salin Semua Kode ke Clipboard
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="downloadRecoveryCodes('{{ implode("\r\n", session('show_recovery_codes')) }}')" style="background: #ffffff; border-color: #a7f3d0; color: #047857; font-weight: 600;">
                            💾 Unduh sebagai File Teks (.txt)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    @endif

    <!-- SECTION 1: TWO-FACTOR AUTHENTICATION (GOOGLE AUTHENTICATOR) -->
    <div class="settings-card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                    <h2 style="font-size: 1.125rem; font-weight: 600; color: #0f172a; margin: 0 0 2px 0;">Autentikasi 2-Langkah (Google Authenticator)</h2>
                    <p style="font-size: 0.8125rem; color: #64748b; margin: 0;">Mencegah pihak lain membobol akun meskipun mengetahui password Anda</p>
                </div>
            </div>

            @if($user && $user->hasEnabledTwoFactor())
                <span style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                    ✓ 2FA Aktif
                </span>
            @else
                <span style="display: inline-flex; align-items: center; gap: 6px; background: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                    Belum Terpasang
                </span>
            @endif
        </div>

        @if($user && $user->hasEnabledTwoFactor())
            <!-- 2FA Is Enabled State -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 14px;">
                    <div style="color: #16a34a; margin-top: 2px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.9375rem; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                            Akun Anda saat ini terlindungi dengan verifikasi 2 langkah
                        </div>
                        <div style="font-size: 0.8125rem; color: #64748b; line-height: 1.5;">
                            Setiap kali login, sistem akan meminta 6-digit kode acak dari aplikasi Google Authenticator di ponsel Anda.<br>
                            Aktif sejak: <strong>{{ $user->two_factor_confirmed_at ? $user->two_factor_confirmed_at->format('d F Y, H:i') : '-' }}</strong>.
                        </div>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <!-- Regenerate Recovery Codes Form -->
                <form action="{{ route('admin.2fa.recovery-codes') }}" method="POST" onsubmit="return confirm('Buat 8 kode pemulihan baru? Kode lama Anda tidak akan bisa digunakan lagi.');" style="margin: 0;">
                    @csrf
                    <button type="submit" class="btn btn-secondary" style="font-size: 0.875rem; padding: 8px 16px;">
                        🔄 Buat Ulang Kode Pemulihan Cadangan
                    </button>
                </form>

                <!-- Disable 2FA Dropdown/Modal Trigger -->
                <button type="button" onclick="document.getElementById('disable-2fa-form-wrapper').style.display = document.getElementById('disable-2fa-form-wrapper').style.display === 'none' ? 'block' : 'none'" class="btn btn-secondary" style="font-size: 0.875rem; padding: 8px 16px; color: #b91c1c; border-color: #fecaca; background: #fff5f5;">
                    Nonaktifkan 2FA
                </button>
            </div>

            <!-- Expandable Disable Form -->
            <div id="disable-2fa-form-wrapper" style="display: none; margin-top: 18px; padding-top: 18px; border-top: 1px solid #fee2e2; background: #fef2f2; padding: 18px; border-radius: 8px; border: 1px solid #fecaca;">
                <div style="font-size: 0.875rem; font-weight: 600; color: #991b1b; margin-bottom: 8px;">
                    Konfirmasi Penonaktifan Verifikasi 2 Langkah
                </div>
                <p style="font-size: 0.8125rem; color: #7f1d1d; margin-bottom: 14px;">
                    Untuk alasan keamanan, masukkan password akun admin Anda untuk menonaktifkan fitur 2FA:
                </p>
                <form action="{{ route('admin.2fa.disable') }}" method="POST" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    @csrf
                    <input type="password" name="password" placeholder="Masukkan password Anda" required class="form-input" style="max-width: 280px; font-size: 0.875rem; padding: 8px 12px;">
                    <button type="submit" class="btn btn-danger" style="background: #dc2626; color: #fff; padding: 8px 16px; font-size: 0.875rem;">
                        Ya, Nonaktifkan 2FA
                    </button>
                    <button type="button" onclick="document.getElementById('disable-2fa-form-wrapper').style.display = 'none'" class="btn btn-secondary btn-sm" style="padding: 8px 14px;">
                        Batal
                    </button>
                </form>
            </div>

        @else
            <!-- 2FA Not Enabled State -->
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 0.875rem; color: #92400e; line-height: 1.6;">
                    <strong>Peringatan Keamanan:</strong> Akun Anda saat ini hanya dilindungi oleh password tunggal. Sangat disarankan untuk mengaktifkan Google Authenticator (TOTP) agar akun tidak bisa ditembus oleh pihak lain atau serangan brute force.
                </div>
            </div>

            <!-- Button to open Setup -->
            <div id="2fa-start-btn-box">
                <button type="button" onclick="start2faSetup()" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; font-weight: 600;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Aktifkan Google Authenticator Sekarang
                </button>
            </div>

            <!-- Dynamic Setup Box (Hidden by default, opened on click) -->
            <div id="2fa-setup-card" style="display: none; margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 24px; background: #f8fafc;">
                <h3 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">
                    Setup Google Authenticator (Hanya 1 Menit)
                </h3>

                <div style="display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: start;" class="setup-grid">
                    <!-- Left: QR Code Canvas -->
                    <div style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; text-align: center;">
                        <div id="qrcode-container" style="min-width: 180px; min-height: 180px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 0.8125rem; color: #94a3b8;">Menyiapkan kunci keamanan...</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 8px; font-weight: 500;">
                            Pindai dengan aplikasi Authenticator
                        </div>
                    </div>

                    <!-- Right: Secret Key & Verification Form -->
                    <div>
                        <!-- Manual Key Box -->
                        <div style="margin-bottom: 18px;">
                            <div style="font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                                Atau ketik kode rahasia secara manual jika kamera tidak bisa memindai:
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <code id="2fa-secret-text" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 0.9375rem; font-weight: 700; letter-spacing: 1.5px; color: #0f172a;">
                                    ...
                                </code>
                                <button type="button" onclick="copy2faSecret()" class="btn btn-secondary btn-sm" style="padding: 7px 12px; font-size: 0.8125rem;">
                                    Salin Kunci
                                </button>
                            </div>
                        </div>

                        <!-- Step Instructions -->
                        <div style="font-size: 0.8125rem; color: #475569; line-height: 1.6; margin-bottom: 20px;">
                            <strong>Langkah Aktivasi:</strong><br>
                            1. Buka aplikasi <strong>Google Authenticator</strong> (atau Microsoft Authenticator) di HP Anda.<br>
                            2. Klik tombol <strong>+</strong> lalu pilih <strong>Scan a QR code</strong> (atau Masukkan kunci penyiapan).<br>
                            3. Masukkan 6 angka kode yang muncul di HP Anda ke kolom di bawah ini:
                        </div>

                        <!-- Confirmation Form -->
                        <form action="{{ route('admin.2fa.confirm') }}" method="POST" style="margin: 0;">
                            @csrf
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <div>
                                    <input type="text" name="code" id="2fa-input-code" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="123456" required class="form-input" style="font-size: 1.25rem; font-weight: 700; letter-spacing: 4px; text-align: center; width: 140px; padding: 8px 10px;">
                                </div>
                                <button type="submit" class="btn btn-primary" style="padding: 10px 20px; font-weight: 600;">
                                    Verifikasi &amp; Aktifkan 2FA
                                </button>
                                <button type="button" onclick="cancel2faSetup()" class="btn btn-secondary btn-sm" style="padding: 9px 14px;">
                                    Batal
                                </button>
                            </div>
                            <small style="font-size: 0.75rem; color: #64748b; margin-top: 6px; display: block;">
                                *Masukkan 6 angka sebelum penghitung waktu di aplikasi habis.
                            </small>
                        </form>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <!-- SECTION 2: ENCRYPTION & SECURITY (DATABASE SECURITY) -->
    <div class="settings-card">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
                <h2 style="font-size: 1.125rem; font-weight: 600; color: #0f172a; margin: 0 0 2px 0;">Keamanan Kredensial &amp; Privasi dari Pihak Hosting</h2>
                <p style="font-size: 0.8125rem; color: #64748b; margin: 0;">Seluruh API Key, Secret Token, dan Kunci 2FA dienkripsi berlapis (AES-256-CBC)</p>
            </div>
        </div>

        <div style="font-size: 0.875rem; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Sistem telah dirancang agar pihak teknisi atau pengelola server hosting <strong>tidak dapat membaca kredensial rahasia Anda</strong>. Setiap data sensitif yang disimpan ke database dienkripsi secara otomatis menggunakan algoritma <code>AES-256-CBC</code> dengan kunci enkripsi aplikasi.
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px;">Kredensial Google OAuth</div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #0f172a; margin-bottom: 4px;">Client Secret &amp; Refresh Token</div>
                <div style="font-size: 0.8125rem; color: #15803d; font-weight: 500;">🔒 Tersimpan Terenkripsi di Database</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px;">Kunci Otentikasi 2FA</div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #0f172a; margin-bottom: 4px;">TOTP Secret &amp; Recovery Codes</div>
                <div style="font-size: 0.8125rem; color: #15803d; font-weight: 500;">🔒 Tersimpan Terenkripsi di Database</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px;">Proteksi Percobaan Login</div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #0f172a; margin-bottom: 4px;">Brute-Force Rate Limiting</div>
                <div style="font-size: 0.8125rem; color: #0369a1; font-weight: 500;">🛡️ Lockout 15 Menit setelah 5x Salah</div>
            </div>
        </div>
    </div>

    <!-- SECTION: MOBILE SECURITY & REMOTE CONTROLS -->
    <div class="settings-card" id="mobile-security-section">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <div>
                    <h2 style="font-size: 1.125rem; font-weight: 600; color: #0f172a; margin: 0 0 2px 0;">Keamanan Aplikasi Mobile &amp; Kontrol Perangkat Terhubung</h2>
                    <p style="font-size: 0.8125rem; color: #64748b; margin: 0;">Kontrol jarak jauh untuk aplikasi HP (Apple Photos Style): Reset PIN jika lupa, atau cabut sesi login jika HP hilang.</p>
                </div>
            </div>

            <div>
                @if($mobileTokens->isNotEmpty())
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #15803d; padding: 5px 14px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a;"></span>
                        {{ $mobileTokens->count() }} Perangkat Terhubung
                    </span>
                @else
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; color: #64748b; padding: 5px 14px; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600;">
                        Belum Ada Perangkat Terhubung
                    </span>
                @endif
            </div>
        </div>

        @if($mobilePinSyncRequested)
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.4rem;">⚠️</span>
                    <div>
                        <div style="font-size: 0.875rem; font-weight: 700; color: #92400e;">
                            {{ $mobilePinAction === 'set_new_pin' ? 'Pembaruan PIN Baru Sedang Menunggu Eksekusi di Ponsel' : 'Instruksi Penghapusan PIN Sedang Menunggu Eksekusi' }}
                        </div>
                        <div style="font-size: 0.8125rem; color: #b45309; margin-top: 2px;">
                            Diminta pada: <strong>{{ $mobilePinSyncAt ? \Carbon\Carbon::parse($mobilePinSyncAt)->format('d M Y H:i:s') : 'Baru saja' }}</strong>. 
                            {{ $mobilePinAction === 'set_new_pin' ? 'Saat aplikasi ponsel Anda dibuka kembali, 6-digit PIN baru akan langsung dipasang otomatis.' : 'Saat aplikasi ponsel dibuka kembali, PIN keamanan akan dinonaktifkan.' }}
                        </div>
                    </div>
                </div>
                <form action="{{ route('admin.mobile.cancel-reset-pin') }}" method="POST" style="margin: 0;">
                    @csrf
                    <button type="submit" class="btn btn-secondary btn-sm" style="background: #ffffff; border-color: #fcd34d; color: #92400e; font-weight: 600;">
                        Batalkan Perubahan PIN
                    </button>
                </form>
            </div>
        @endif

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-bottom: 24px;">
            <!-- Column 1: Remote PIN Setup & Reset -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h3 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0;">Atur Ulang / Pasang PIN Mobile Baru</h3>
                    </div>
                    <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.5; margin-bottom: 16px;">
                        Anda dapat langsung menetapkan 6-digit Master PIN (dan Decoy PIN) baru dari sini tanpa harus mengingat PIN lama di ponsel Anda.
                    </p>

                    <!-- Set New PIN Form -->
                    <form action="{{ route('admin.mobile.update-pin') }}" method="POST" style="margin-bottom: 16px;">
                        @csrf
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Master PIN (6 Digit) *</label>
                                <input type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" name="master_pin" placeholder="123456" required class="form-input" style="width: 100%; font-family: monospace; font-size: 1rem; letter-spacing: 2px; text-align: center; padding: 8px;">
                                @error('master_pin')
                                    <span style="color: #ef4444; font-size: 0.7rem;">{{ $message }}</span>
                                @enderror
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Decoy PIN (Opsional)</label>
                                <input type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" name="decoy_pin" placeholder="654321" class="form-input" style="width: 100%; font-family: monospace; font-size: 1rem; letter-spacing: 2px; text-align: center; padding: 8px;">
                                @error('decoy_pin')
                                    <span style="color: #ef4444; font-size: 0.7rem;">{{ $message }}</span>
                                @enderror
                            </div>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Password Akun Web (Verifikasi Pemilik) *</label>
                            <input type="password" name="web_password" placeholder="Masukkan password login web Anda" required class="form-input" style="width: 100%; font-size: 0.8125rem; padding: 8px 12px;">
                            @error('mobile_pin_password')
                                <span style="color: #ef4444; font-size: 0.75rem; display: block; margin-top: 4px; font-weight: 500;">{{ $message }}</span>
                            @enderror
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; font-weight: 600;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                            </svg>
                            Terapkan PIN Baru ke Ponsel
                        </button>
                    </form>
                </div>

                <div style="padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 0.75rem; color: #64748b;">Hanya ingin mematikan kunci PIN?</span>
                    <form action="{{ route('admin.mobile.reset-pin') }}" method="POST" onsubmit="return confirm('Hapus kunci PIN pada aplikasi ponsel? Kunci keamanan ponsel akan dimatikan.');" style="margin: 0;">
                        @csrf
                        <button type="submit" class="btn btn-secondary btn-sm" style="color: #64748b; font-size: 0.75rem; padding: 4px 10px;">
                            Nonaktifkan / Hapus PIN
                        </button>
                    </form>
                </div>
            </div>

            <!-- Column 2: Remote Logout / Lost Phone Emergency -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                                <line x1="12" y1="2" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <h3 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0;">Kontrol Darurat: HP Hilang atau Dicuri</h3>
                    </div>
                    <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin-bottom: 16px;">
                        Jika ponsel Anda hilang, dicuri, atau dipinjam orang tanpa izin, cabut semua sesi login mobile seketika. Siapa pun yang memegang ponsel Anda tidak akan dapat melihat media galeri karena aplikasi akan langsung terkunci dan meminta login ulang password utama.
                    </p>
                </div>

                <div>
                    @if($mobileTokens->isNotEmpty())
                        <form action="{{ route('admin.mobile.revoke-all') }}" method="POST" onsubmit="return confirm('PERINGATAN DARURAT:\nApakah Anda yakin ingin mencabut SEMUA sesi mobile ({{ $mobileTokens->count() }} perangkat)?\nSemua aplikasi ponsel yang sedang terhubung akan langsung terputus (logout) seketika.');">
                            @csrf
                            <button type="submit" class="btn btn-danger" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; font-weight: 600; background: #dc2626;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                </svg>
                                Cabut Akses SEMUA Perangkat Ponsel
                            </button>
                        </form>
                    @else
                        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; text-align: center; font-size: 0.8125rem; color: #94a3b8; font-weight: 500;">
                            Tidak ada sesi ponsel aktif saat ini
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <!-- Connected Devices List -->
        <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Daftar Sesi Ponsel yang Sedang Login</h4>
            @if($mobileTokens->isEmpty())
                <div style="background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 24px; text-align: center; color: #64748b; font-size: 0.875rem;">
                    📱 Belum ada perangkat ponsel yang terhubung. Silakan login melalui aplikasi Android / iOS untuk menghubungkan perangkat Anda.
                </div>
            @else
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; text-align: left;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">
                                    <th style="padding: 12px 16px;">Nama Perangkat</th>
                                    <th style="padding: 12px 16px;">Status</th>
                                    <th style="padding: 12px 16px;">Terakhir Digunakan</th>
                                    <th style="padding: 12px 16px;">Waktu Login Pertama</th>
                                    <th style="padding: 12px 16px; text-align: right;">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($mobileTokens as $token)
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 16px; font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                                <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                            </svg>
                                            {{ $token->name }}
                                        </td>
                                        <td style="padding: 12px 16px;">
                                            <span style="display: inline-flex; align-items: center; gap: 4px; color: #16a34a; font-weight: 600;">
                                                <span style="width: 6px; height: 6px; border-radius: 50%; background: #16a34a;"></span>
                                                Aktif
                                            </span>
                                        </td>
                                        <td style="padding: 12px 16px; color: #475569;">
                                            {{ $token->last_used_at ? $token->last_used_at->diffForHumans() : 'Baru saja dibuat' }}
                                        </td>
                                        <td style="padding: 12px 16px; color: #64748b;">
                                            {{ $token->created_at->format('d M Y H:i') }}
                                        </td>
                                        <td style="padding: 12px 16px; text-align: right;">
                                            <form action="{{ route('admin.mobile.revoke-device', $token->id) }}" method="POST" onsubmit="return confirm('Cabut akses untuk perangkat \'{{ $token->name }}\'? Ponsel ini akan langsung ter-logout.');" style="margin: 0; display: inline;">
                                                @csrf
                                                @method('DELETE')
                                                <button type="submit" class="btn btn-secondary btn-sm" style="color: #dc2626; border-color: #fecaca; background: #fef2f2; font-size: 0.75rem; padding: 4px 10px;">
                                                    Cabut Sesi HP
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            @endif
        </div>
    </div>

    <!-- SECTION 3: OAUTH 2.0 (GOOGLE DRIVE STORAGE) -->
    <div class="settings-card">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem;">
                G
            </div>
            <div>
                <h2 style="font-size: 1.125rem; font-weight: 600; color: #0f172a; margin: 0 0 2px 0;">Otorisasi Akun Google Drive</h2>
                <p style="font-size: 0.8125rem; color: #64748b; margin: 0;">Gunakan kredensial OAuth agar berkas tersimpan langsung di akun Google Drive pribadi Anda</p>
            </div>
        </div>

        <!-- Redirect URI Banner -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
            <div style="font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 6px;">
                Authorized Redirect URI (Masukkan ini di Google Cloud Console):
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px;">
                <code style="color: #2563eb; font-size: 0.8125rem; word-break: break-all;">{{ $redirectUri }}</code>
                <button type="button" onclick="navigator.clipboard.writeText('{{ $redirectUri }}'); alert('Redirect URI berhasil disalin!');" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.75rem; white-space: nowrap;">
                    Salin URI
                </button>
            </div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 6px;">
                *Google melarang domain <code>.test</code>. Sistem otomatis menggunakan <code>{{ $redirectUri }}</code> yang diizinkan oleh Google Cloud.
            </div>
        </div>

        <form action="{{ route('admin.settings.save') }}" method="POST">
            @csrf

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="client_id" class="form-label" style="font-size: 0.875rem; font-weight: 500; margin-bottom: 6px; display: block;">
                        Google Client ID <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="text" id="client_id" name="client_id" class="form-input" value="{{ old('client_id', $clientId) }}" placeholder="xxxx.apps.googleusercontent.com" required style="width: 100%;">
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label for="client_secret" class="form-label" style="font-size: 0.875rem; font-weight: 500; margin-bottom: 6px; display: block;">
                        Google Client Secret <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="password" id="client_secret" name="client_secret" class="form-input" value="{{ old('client_secret', $clientSecret) }}" placeholder="GOCSPX-xxxx" required style="width: 100%;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="folder_id" class="form-label" style="font-size: 0.875rem; font-weight: 500; margin-bottom: 6px; display: block;">
                        Google Drive Folder ID (Opsional)
                    </label>
                    <input type="text" id="folder_id" name="folder_id" class="form-input" value="{{ old('folder_id', $folderId) }}" placeholder="13u23imTo1hYn7DflOefkN0uNErF5g75m" style="width: 100%;">
                    <small style="font-size: 0.75rem; color: #64748b; margin-top: 4px; display: block;">
                        Bisa dikosongkan jika ingin folder dibuatkan otomatis oleh sistem.
                    </small>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label for="folder_name" class="form-label" style="font-size: 0.875rem; font-weight: 500; margin-bottom: 6px; display: block;">
                        Nama Folder Cadangan
                    </label>
                    <input type="text" id="folder_name" name="folder_name" class="form-input" value="{{ old('folder_name', $folderName) }}" placeholder="MediaGalleryEncrypted" style="width: 100%;">
                </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <button type="submit" class="btn btn-primary" style="padding: 9px 20px;">
                    Simpan Konfigurasi
                </button>

                @if($clientId && $clientSecret)
                    <a href="{{ route('admin.google.connect') }}" class="btn btn-secondary" style="padding: 9px 20px; color: #1e40af; border-color: #bfdbfe; background: #eff6ff;">
                        {{ ($isOauthConnected || request('connected')) ? '✓ Hubungkan Ulang Akun Google' : '🔗 Hubungkan Akun Google Drive →' }}
                    </a>
                @endif
            </div>
        </form>
    </div>

    <!-- SECTION 4: OPTIONAL SERVICE ACCOUNT JSON UPLOAD -->
    <div class="settings-card">
        <details>
            <summary style="font-size: 0.9375rem; font-weight: 600; color: #334155; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span>📁 Opsi Tambahan: Upload File Kredensial Service Account (.json)</span>
            </summary>
            <div style="padding-top: 20px;">
                <p style="font-size: 0.8125rem; color: #64748b; margin-bottom: 16px;">
                    Jika kamu memiliki Google Workspace atau Shared Drive perusahaan, kamu juga dapat menggunakan Service Account JSON sebagai alternatif.
                </p>
                <form action="{{ route('admin.settings.save') }}" method="POST" enctype="multipart/form-data">
                    @csrf
                    <div style="margin-bottom: 16px;">
                        <input type="file" name="credential_file" accept=".json,application/json" class="form-input" style="width: 100%; padding: 8px;">
                    </div>
                    @if($credentialsExists && $credentialsInfo)
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 0.8125rem; margin-bottom: 16px;">
                            <div><strong>Project ID:</strong> {{ $credentialsInfo['project_id'] ?? '-' }}</div>
                            <div><strong>Email Service Account:</strong> <code>{{ $credentialsInfo['client_email'] ?? '-' }}</code></div>
                        </div>
                    @endif
                    <button type="submit" class="btn btn-secondary btn-sm">Upload File JSON</button>
                </form>
            </div>
        </details>
    </div>

    <!-- SECTION 5: STEP BY STEP TUTORIAL GUIDE -->
    <div class="settings-card">
        <h3 style="font-size: 1.05rem; font-weight: 700; color: #0f172a; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Panduan 3 Langkah Mudah Menghubungkan Google Drive
        </h3>

        <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Step 1 -->
            <div style="display: gap: 14px; display: flex; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8125rem; flex-shrink: 0;">1</div>
                <div style="font-size: 0.875rem; color: #334155; line-height: 1.6;">
                    <strong>Publishing Status di Google Cloud:</strong><br>
                    Di <a href="https://console.cloud.google.com/" target="_blank" style="color: #2563eb; text-decoration: underline;">Google Cloud Console</a> &rarr; buka menu <strong>Google Auth Platform &rarr; Audience</strong> &rarr; pastikan status aplikasi telah diubah menjadi <strong>In production</strong> (atau tambahkan email Google One kamu di Test Users).
                </div>
            </div>

            <!-- Step 2 -->
            <div style="display: flex; gap: 14px; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8125rem; flex-shrink: 0;">2</div>
                <div style="font-size: 0.875rem; color: #334155; line-height: 1.6;">
                    <strong>Buat OAuth Client ID:</strong><br>
                    Buka menu <strong>Google Auth Platform &rarr; Clients</strong> &rarr; klik <strong>+ Create Client</strong> &rarr; pilih <strong>Web application</strong>.<br>
                    Pada bagian <strong>Authorized redirect URIs</strong>, masukkan:
                    <div style="background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-family: monospace; display: inline-block; color: #0f172a; margin: 4px 0;">
                        {{ $redirectUri }}
                    </div>
                    <br>Klik <strong>Create</strong>, lalu salin <strong>Client ID</strong> &amp; <strong>Client Secret</strong> ke formulir di atas.
                </div>
            </div>

            <!-- Step 3 -->
            <div style="display: flex; gap: 14px; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8125rem; flex-shrink: 0;">3</div>
                <div style="font-size: 0.875rem; color: #334155; line-height: 1.6;">
                    <strong>Otorisasi &amp; Selesai:</strong><br>
                    Klik tombol <strong>"🔗 Hubungkan Akun Google Drive"</strong> di atas &rarr; kamu akan diarahkan ke halaman login Google &rarr; pilih akun Google kamu &rarr; klik <strong>Continue / Izinkan</strong>.<br>
                    Setelah itu, akun resmi terhubung dan penyimpanan Google Drive langsung aktif untuk upload foto &amp; video terenkripsi!
                </div>
            </div>
        </div>
    </div>

</div>

<!-- QR Code Library for Client-Side Zero-Network Generation with Cache Busting -->
<script src="{{ asset('js/qrcode.min.js') }}?v={{ filemtime(public_path('js/qrcode.min.js')) }}"></script>

<script>
let current2faSecret = '';

function renderQrCode(container, otpauth) {
    container.innerHTML = '';
    try {
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: otpauth,
                width: 180,
                height: 180,
                colorDark: '#0f172a',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            return;
        }
    } catch (e) {
        console.warn('QRCode JS render failed, using fallback image:', e);
    }

    // High-reliability fallback image
    const encoded = encodeURIComponent(otpauth);
    container.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encoded + '" alt="QR Code" width="180" height="180" style="display:block; margin: 0 auto; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">';
}

function start2faSetup() {
    const btnBox = document.getElementById('2fa-start-btn-box');
    const setupCard = document.getElementById('2fa-setup-card');
    const qrContainer = document.getElementById('qrcode-container');
    const secretText = document.getElementById('2fa-secret-text');

    btnBox.style.display = 'none';
    setupCard.style.display = 'block';
    qrContainer.innerHTML = '<span style="font-size: 0.8125rem; color: #94a3b8;">Menyiapkan kunci keamanan...</span>';

    fetch('{{ route("admin.2fa.setup") }}')
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(data => {
            current2faSecret = data.secret;
            // Format secret with space every 4 chars for readability
            secretText.textContent = data.secret.match(/.{1,4}/g).join(' ');

            renderQrCode(qrContainer, data.otpauth);

            document.getElementById('2fa-input-code').focus();
        })
        .catch(err => {
            console.error('2FA setup error:', err);
            qrContainer.innerHTML = '<span style="color: #ef4444; font-size: 0.8125rem;">Gagal memuat QR code. Silakan coba lagi.</span>';
        });
}

function cancel2faSetup() {
    document.getElementById('2fa-setup-card').style.display = 'none';
    document.getElementById('2fa-start-btn-box').style.display = 'block';
}

function copy2faSecret() {
    if (!current2faSecret) return;
    navigator.clipboard.writeText(current2faSecret).then(() => {
        alert('Secret key berhasil disalin: ' + current2faSecret);
    });
}

function copyRecoveryCodes(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Semua kode pemulihan berhasil disalin ke clipboard!');
    });
}

function downloadRecoveryCodes(text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'media-gallery-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
</script>

<style>
@media (max-width: 640px) {
    .setup-grid {
        grid-template-columns: 1fr !important;
    }
}
</style>
@endsection
