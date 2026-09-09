<?php

namespace App\Http\Middleware;

use App\Models\PersonalAccessToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    /**
     * Handle an incoming API request authenticated by Bearer token.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $bearer = $request->bearerToken();

        if (!$bearer) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $tokenRecord = PersonalAccessToken::findToken($bearer);

        if (!$tokenRecord || ($tokenRecord->expires_at && $tokenRecord->expires_at->isPast())) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $tokenRecord->update(['last_used_at' => now()]);
        $request->attributes->set('current_api_token', $tokenRecord);

        // Bind user to request
        $user = $tokenRecord->tokenable;
        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
