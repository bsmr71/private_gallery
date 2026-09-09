<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    /**
     * The value attribute is automatically encrypted using AES-256.
     */
    protected $casts = [
        'value' => 'encrypted',
    ];

    /**
     * Get a setting value by key, returning default if not found.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        try {
            $setting = static::where('key', $key)->first();
            return $setting ? $setting->value : $default;
        } catch (\Throwable $e) {
            return $default;
        }
    }

    /**
     * Store or update an encrypted setting.
     */
    public static function set(string $key, mixed $value): static
    {
        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );
    }

    /**
     * Check if a setting exists and is not null.
     */
    public static function has(string $key): bool
    {
        $val = static::get($key);
        return !is_null($val) && $val !== '';
    }

    /**
     * Delete a setting by key.
     */
    public static function forget(string $key): bool
    {
        return (bool) static::where('key', $key)->delete();
    }
}
