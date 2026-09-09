<?php
require_once __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$user = User::first();
if (!$user) {
    echo "No user found in database!\n";
    exit(1);
}

echo "Testing with user: {$user->email}\n";
$token = $user->createToken('test-upload-token')->plainTextToken;
echo "Generated token: {$token}\n";

// 1. Create a dummy test image
$testImgPath = __DIR__ . '/dummy_test.jpg';
$im = imagecreatetruecolor(100, 100);
$bg = imagecolorallocate($im, 10, 132, 255);
imagefilledrectangle($im, 0, 0, 99, 99, $bg);
imagejpeg($im, $testImgPath);
imagedestroy($im);

// 2. Create a dummy test video
$testVidPath = __DIR__ . '/dummy_test.mp4';
file_put_contents($testVidPath, "fake mp4 video content " . str_repeat("A", 1024 * 50));

echo "Testing upload to local Apache: http://private_gallery.test/api/media/upload\n";

function uploadFile($url, $filePath, $token, $mimeType, $fieldName = 'file') {
    $ch = curl_init();
    $cFile = new CURLFile($filePath, $mimeType, basename($filePath));
    $postData = [
        $fieldName => $cFile,
        'title' => 'Test ' . basename($filePath),
    ];
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        "Authorization: Bearer {$token}",
    ]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['code' => $httpCode, 'body' => $res, 'error' => $err];
}

echo "\n--- 1. Testing Image Upload ---\n";
$resImg = uploadFile('http://private_gallery.test/api/media/upload', $testImgPath, $token, 'image/jpeg');
echo "HTTP Code: {$resImg['code']}\n";
echo "Response: {$resImg['body']}\n";
if ($resImg['error']) echo "Curl error: {$resImg['error']}\n";

echo "\n--- 2. Testing Video Upload ---\n";
$resVid = uploadFile('http://private_gallery.test/api/media/upload', $testVidPath, $token, 'video/mp4');
echo "HTTP Code: {$resVid['code']}\n";
echo "Response: {$resVid['body']}\n";
if ($resVid['error']) echo "Curl error: {$resVid['error']}\n";

@unlink($testImgPath);
@unlink($testVidPath);
