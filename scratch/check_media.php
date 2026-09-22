<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$medias = \App\Models\Media::latest('id')->take(10)->get();
foreach ($medias as $m) {
    echo "ID: {$m->id} | Type: {$m->type} | Title: {$m->title} | Size: {$m->size}\n";
}
