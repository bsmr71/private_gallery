@extends('layouts.app')
@section('title', 'Atur Ulang Kata Sandi — Private Gallery')

@section('content')
<div class="login-page">
    <div class="login-card">
        <div class="login-header">
            <img src="/images/logo.png" alt="Gallery Logo" style="width: 54px; height: 54px; object-fit: contain; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <h1 class="login-title">Kata Sandi Baru</h1>
            <p class="login-subtitle">Silakan buat kata sandi baru untuk akun Galeri Anda</p>
        </div>

        <form method="POST" action="{{ route('password.update') }}">
            @csrf

            <!-- Password Reset Token -->
            <input type="hidden" name="token" value="{{ $token }}">

            <div class="form-group">
                <label class="form-label" for="email">Email Akun</label>
                <input type="email"
                       class="form-input"
                       id="email"
                       name="email"
                       value="{{ old('email', $email) }}"
                       required
                       readonly
                       style="background: rgba(255, 255, 255, 0.04); color: var(--text-secondary); cursor: not-allowed;">
                @error('email')
                    <p class="form-error">{{ $message }}</p>
                @enderror
            </div>

            <div class="form-group">
                <label class="form-label" for="password">Kata Sandi Baru</label>
                <input type="password"
                       class="form-input"
                       id="password"
                       name="password"
                       required
                       autofocus
                       autocomplete="new-password"
                       placeholder="Minimal 8 karakter">
                @error('password')
                    <p class="form-error">{{ $message }}</p>
                @enderror
            </div>

            <div class="form-group">
                <label class="form-label" for="password_confirmation">Ulangi Kata Sandi Baru</label>
                <input type="password"
                       class="form-input"
                       id="password_confirmation"
                       name="password_confirmation"
                       required
                       autocomplete="new-password"
                       placeholder="Ketik ulang kata sandi baru">
            </div>

            <button type="submit" class="btn btn-primary login-btn" style="margin-top: 8px;">
                Perbarui &amp; Simpan Kata Sandi
            </button>

            <div style="text-align: center; margin-top: 20px;">
                <a href="{{ route('login') }}" style="color: var(--accent, #0A84FF); font-size: 13px; text-decoration: none; font-weight: 500;">
                    &larr; Batal dan Kembali ke Login
                </a>
            </div>
        </form>
    </div>
</div>
@endsection
