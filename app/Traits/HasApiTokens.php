<?php

namespace App\Traits;

use App\Models\PersonalAccessToken;
use Illuminate\Support\Str;

trait HasApiTokens
{
    /**
     * Get all personal access tokens for the model.
     */
    public function tokens()
    {
        return $this->morphMany(PersonalAccessToken::class, 'tokenable');
    }

    /**
     * Create a new personal access token.
     */
    public function createToken(string $name, array $abilities = ['*'], $expiresAt = null)
    {
        $plainTextToken = Str::random(40);

        $token = $this->tokens()->create([
            'name' => $name,
            'token' => hash('sha256', $plainTextToken),
            'abilities' => $abilities,
            'expires_at' => $expiresAt,
        ]);

        return new class($token, $plainTextToken) {
            public $accessToken;
            public $plainTextToken;

            public function __construct($token, $plainTextToken)
            {
                $this->accessToken = $token;
                $this->plainTextToken = $token->getKey() . '|' . $plainTextToken;
            }
        };
    }
}
