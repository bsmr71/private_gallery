<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$settings = \App\Models\Setting::all()->pluck('value', 'key');
foreach ($settings as $k => $v) {
    if (str_contains($k, 'secret') || str_contains($k, 'token') || str_contains($k, 'key')) {
        echo "$k: " . substr($v, 0, 8) . "...\n";
    } else {
        echo "$k: $v\n";
    }
}
