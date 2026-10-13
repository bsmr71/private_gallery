<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$enc = $app->make(\App\Services\FileEncryptionService::class);

$sample = json_encode(['title' => 'Foto Rahasia', 'album' => 'Liburan 2026', 'time' => time()]);
$cipher = $enc->encryptString($sample);
echo "Cipher Base64: " . $cipher . "\n";
$dec = $enc->decryptString($cipher);
echo "Decrypted: " . $dec . "\n";
if ($dec === $sample) {
    echo "SUCCESS: Roundtrip encryption & decryption verified!\n";
} else {
    echo "ERROR: Mismatch!\n";
}
