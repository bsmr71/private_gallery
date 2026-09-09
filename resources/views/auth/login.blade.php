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
                <label class="form-label" for="password">Password</label>
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
