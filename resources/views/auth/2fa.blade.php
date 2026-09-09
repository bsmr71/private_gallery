@extends('layouts.app')
@section('title', 'Two-Factor Authentication — Gallery')

@section('content')
<div class="login-page">
    <div class="login-card" style="max-width: 420px;">
        <div class="login-header">
            <img src="/images/logo.png" alt="Gallery Logo" style="width: 54px; height: 54px; object-fit: contain; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <h1 class="login-title" style="font-size: 1.25rem;">Autentikasi 2 Langkah</h1>
            <p class="login-subtitle">Buka aplikasi <strong>Google Authenticator</strong> di HP Anda dan masukkan kode 6-digit.</p>
        </div>

        @if ($errors->any())
        <div class="alert alert-error" style="margin-bottom: 20px;">
            @foreach ($errors->all() as $error)
                <div>{{ $error }}</div>
            @endforeach
        </div>
        @endif

        <form method="POST" action="{{ route('login.2fa.verify') }}">
            @csrf

            <div class="form-group" style="margin-bottom: 24px; text-align: center;">
                <label class="form-label" for="code" style="margin-bottom: 10px; display: block;">Kode 6-Digit</label>
                <input type="text"
                       class="form-input"
                       id="code"
                       name="code"
                       placeholder="000000"
                       maxlength="10"
                       required
                       autofocus
                       autocomplete="one-time-code"
                       style="font-size: 1.6rem; letter-spacing: 8px; text-align: center; font-family: monospace; font-weight: bold; padding: 12px;">
                <small style="display: block; color: var(--text-muted); font-size: 0.75rem; margin-top: 8px;">
                    Atau masukkan kode pemulihan (contoh: <code>ABCD-1234</code>)
                </small>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; margin-bottom: 16px;">
                Verifikasi &amp; Masuk
            </button>

            <div style="text-align: center; font-size: 0.8125rem;">
                <a href="{{ route('login') }}" style="color: var(--text-muted); text-decoration: none;">
                    &larr; Kembali ke Halaman Login
                </a>
            </div>
        </form>
    </div>
</div>
@endsection
