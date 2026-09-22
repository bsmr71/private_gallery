<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$all = App\Models\Media::all();
echo json_encode($all, JSON_PRETTY_PRINT);
