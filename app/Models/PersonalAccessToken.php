<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PersonalAccessToken extends Model
{
    protected $table = 'personal_access_tokens';

    protected $fillable = [
        'name',
        'token',
        'abilities',
        'last_used_at',
        'expires_at',
    ];

    protected $casts = [
        'abilities' => 'json',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function tokenable()
    {
        return $this->morphTo();
    }

    /**
     * Find token by plain text bearer string.
     */
    public static function findToken(string $token): ?self
    {
        if (str_contains($token, '|')) {
            [$id, $token] = explode('|', $token, 2);
        }

        return static::where('token', hash('sha256', $token))->first();
    }
}
