@extends('layouts.app')
@section('title', 'Login — Gallery')

@section('content')
<div class="login-page">
    <div class="login-card">
        <div class="login-header">
            <img src="/images/logo.png" alt="Gallery Logo" style="width: 54px; height: 54px; object-fit: contain; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <h1 class="login-title">Sign in</h1>
            <p class="login-subtitle">Enter your credentials to continue</p>
        </div>

        @if (session('status'))
            <div style="background: rgba(48, 209, 88, 0.12); border: 1px solid rgba(48, 209, 88, 0.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; color: #30D158; font-size: 13px; font-weight: 500; line-height: 1.5;">
                {{ session('status') }}
            </div>
        @endif

        <form method="POST" action="{{ route('login') }}">
            @csrf

            <div class="form-group">
                <label class="form-label" for="email">Email</label>
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

            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label class="form-label" for="password" style="margin-bottom: 0;">Password</label>
                    <a href="{{ route('password.request') }}" style="font-size: 12px; color: var(--accent, #0A84FF); text-decoration: none; font-weight: 500;">Lupa password?</a>
                </div>
                <input type="password"
                       class="form-input"
                       id="password"
                       name="password"
                       required
                       autocomplete="current-password"
                       placeholder="••••••••">
                @error('password')
                    <p class="form-error">{{ $message }}</p>
                @enderror
            </div>

            <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" name="remember" id="remember" style="accent-color:var(--accent);">
                <label for="remember" style="font-size:13px;color:var(--text-secondary);cursor:pointer;">Remember me</label>
            </div>

            <button type="submit" class="btn btn-primary login-btn">Sign In</button>
        </form>
    </div>
</div>
@endsection
