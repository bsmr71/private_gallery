<?php

use App\Providers\AppServiceProvider;

$providers = [
    AppServiceProvider::class,
];

if (class_exists(\Laravel\Sanctum\SanctumServiceProvider::class)) {
    $providers[] = \Laravel\Sanctum\SanctumServiceProvider::class;
}

return $providers;
