<?php
require_once __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Media;

echo "=== SIMULATING MOBILE APP SYNC & UPLOAD FLOW ===\n";

$user = User::first();
if (!$user) {
    echo "ERROR: User not found.\n";
    exit(1);
}

$token = $user->createToken('mobile-sync-test')->plainTextToken;
echo "1. User authenticated: {$user->email}\n";
echo "   Token: {$token}\n\n";

// Create test image
$testImg = __DIR__ . '/mobile_test_image.jpg';
$im = imagecreatetruecolor(200, 200);
$col = imagecolorallocate($im, 0, 122, 255);
imagefill($im, 0, 0, $col);
imagejpeg($im, $testImg, 90);
imagedestroy($im);

// Create test video (500KB fake mp4)
$testVid = __DIR__ . '/mobile_test_video.mp4';
file_put_contents($testVid, "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00isommp42" . str_repeat("\x00", 1024 * 500));

function runUploadRequest($url, $token, $filePath, $mimeType, $title, $albumId = null) {
    $ch = curl_init();
    $cFile = new CURLFile($filePath, $mimeType, basename($filePath));
    $postFields = [
        'file' => $cFile,
        'title' => $title,
    ];
    if ($albumId) {
        $postFields['album_id'] = $albumId;
    }

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            "Authorization: Bearer {$token}",
        ],
    ]);

    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    return ['status' => $status, 'body' => $res, 'error' => $err];
}

$baseApi = 'http://private_gallery.test/api';

echo "2. Uploading Photo via Mobile API...\n";
$imgRes = runUploadRequest("{$baseApi}/media/upload", $token, $testImg, 'image/jpeg', 'Photo from Vault');
echo "   Status: {$imgRes['status']}\n";
echo "   Body: {$imgRes['body']}\n\n";

$imgData = json_decode($imgRes['body'], true);
$imgId = $imgData['uploaded'][0]['id'] ?? null;

echo "3. Uploading Video via Mobile API...\n";
$vidRes = runUploadRequest("{$baseApi}/media/upload", $token, $testVid, 'video/mp4', 'Video from Vault');
echo "   Status: {$vidRes['status']}\n";
echo "   Body: {$vidRes['body']}\n\n";

$vidData = json_decode($vidRes['body'], true);
$vidId = $vidData['uploaded'][0]['id'] ?? null;

if ($vidId) {
    echo "4. Testing Video Streaming (Range Request)...\n";
    $ch = curl_init("{$baseApi}/media/{$vidId}/stream?token={$token}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => ['Range: bytes=0-1024'],
    ]);
    $streamRes = curl_exec($ch);
    $streamStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "   Stream HTTP Status: {$streamStatus}\n";
}

@unlink($testImg);
@unlink($testVid);

echo "\n=== LOCAL TEST FINISHED ===\n";
