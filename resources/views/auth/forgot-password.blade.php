@extends('layouts.app')
@section('title', 'Lupa Kata Sandi — Private Gallery')

@section('content')
<div class="login-page">
    <div class="login-card">
        <div class="login-header">
            <img src="/images/logo.png" alt="Gallery Logo" style="width: 54px; height: 54px; object-fit: contain; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <h1 class="login-title">Lupa Kata Sandi</h1>
            <p class="login-subtitle">Masukkan email terdaftar untuk menerima tautan pemulihan kata sandi Anda</p>
        </div>

        @if (session('status'))
            <div style="background: rgba(48, 209, 88, 0.12); border: 1px solid rgba(48, 209, 88, 0.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; color: #30D158; font-size: 13px; font-weight: 500; line-height: 1.5;">
                {{ session('status') }}
            </div>
        @endif

        <form method="POST" action="{{ route('password.email') }}">
            @csrf

            <div class="form-group">
                <label class="form-label" for="email">Alamat Email</label>
                <input type="email"
                       class="form-input"
                       id="email"
                       name="email"
                       value="{{ old('email') }}"
                       required
                       autofocus
                       autocomplete="email"
                       placeholder="you@example.com">
                @error('email')
                    <p class="form-error">{{ $message }}</p>
                @enderror
            </div>

            <button type="submit" class="btn btn-primary login-btn" style="margin-top: 8px;">
                Kirim Tautan Reset ke Email
            </button>

            <div style="text-align: center; margin-top: 20px;">
                <a href="{{ route('login') }}" style="color: var(--accent, #0A84FF); font-size: 13px; text-decoration: none; font-weight: 500;">
                    &larr; Kembali ke Halaman Masuk
                </a>
            </div>
        </form>
    </div>
</div>
@endsection
