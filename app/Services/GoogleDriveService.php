<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Illuminate\Support\Facades\Log;

/**
 * GoogleDriveService
 *
 * Handles all interactions with Google Drive API using a Service Account.
 * Files are uploaded/downloaded as binary blobs (they're encrypted before upload).
 */
class GoogleDriveService
{
    private ?GoogleClient $client = null;
    private ?GoogleDrive $driveService = null;

    /**
     * Get authenticated Google Client using OAuth 2.0 or Service Account credentials.
     */
    public function getClient(): GoogleClient
    {
        if ($this->client) {
            return $this->client;
        }

        $this->client = new GoogleClient();

        // Read from encrypted database settings first (for hosting privacy), fallback to config/.env
        $clientId = \App\Models\Setting::get('google_client_id') ?: config('services.google_drive.client_id');
        $clientSecret = \App\Models\Setting::get('google_client_secret') ?: config('services.google_drive.client_secret');
        $refreshToken = \App\Models\Setting::get('google_refresh_token') ?: config('services.google_drive.refresh_token');

        // Prefer OAuth 2.0 if refresh_token is configured (essential for Google One / personal accounts)
        if ($clientId && $clientSecret && $refreshToken) {
            $this->client->setClientId($clientId);
            $this->client->setClientSecret($clientSecret);
            $this->client->addScope(GoogleDrive::DRIVE);
            $this->client->setAccessType('offline');
            $this->client->refreshToken($refreshToken);

            return $this->client;
        }

        // Fallback to Service Account
        $credentialsPath = \App\Models\Setting::get('google_credentials_path') ?: config('services.google_drive.credentials_path');

        if ($credentialsPath && file_exists($credentialsPath)) {
            $this->client->setAuthConfig($credentialsPath);
            $this->client->addScope(GoogleDrive::DRIVE);

            return $this->client;
        }

        throw new \RuntimeException(
            'Google Drive credentials not configured. ' .
            'Please configure OAuth 2.0 credentials or GOOGLE_DRIVE_CREDENTIALS_PATH in your .env file.'
        );
    }

    /**
     * Get Google Drive service instance.
     */
    private function getDriveService(): GoogleDrive
    {
        if ($this->driveService) {
            return $this->driveService;
        }

        $this->driveService = new GoogleDrive($this->getClient());
        return $this->driveService;
    }

    /**
     * Get the folder ID for storing media, creating it if necessary.
     */
    private function getFolderId(): string
    {
        $folderId = \App\Models\Setting::get('google_folder_id') ?: config('services.google_drive.folder_id');

        if ($folderId) {
            return $folderId;
        }

        // Create a folder if none specified
        $folderName = \App\Models\Setting::get('google_folder_name') ?: config('services.google_drive.folder_name', 'MediaGalleryEncrypted');
        $drive = $this->getDriveService();

        // Check if folder already exists
        $response = $drive->files->listFiles([
            'q' => "name='{$folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            'spaces' => 'drive',
            'fields' => 'files(id, name)',
        ]);

        if (count($response->getFiles()) > 0) {
            return $response->getFiles()[0]->getId();
        }

        // Create the folder
        $folderMetadata = new DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
        ]);

        $folder = $drive->files->create($folderMetadata, ['fields' => 'id']);
        return $folder->getId();
    }

    /**
     * Upload a file to Google Drive.
     *
     * @param string $filePath Local file path to upload
     * @param string $fileName Name for the file on Drive
     * @param string $mimeType MIME type (will be application/octet-stream since encrypted)
     * @return string Google Drive file ID
     */
    public function upload(string $filePath, string $fileName, string $mimeType = 'application/octet-stream'): string
    {
        $drive = $this->getDriveService();
        $folderId = $this->getFolderId();

        $fileMetadata = new DriveFile([
            'name' => $fileName,
            'parents' => [$folderId],
        ]);

        $content = file_get_contents($filePath);

        $file = $drive->files->create($fileMetadata, [
            'data' => $content,
            'mimeType' => $mimeType,
            'uploadType' => 'multipart',
            'fields' => 'id',
        ]);

        Log::info('File uploaded to Google Drive', [
            'drive_file_id' => $file->getId(),
            'file_name' => $fileName,
        ]);

        return $file->getId();
    }

    /**
     * Upload a large file using resumable upload (for files > 5MB).
     *
     * @param string $filePath Local file path
     * @param string $fileName Name on Drive
     * @return string Google Drive file ID
     */
    public function uploadLarge(string $filePath, string $fileName): string
    {
        $drive = $this->getDriveService();
        $folderId = $this->getFolderId();
        $client = $this->getClient();

        $fileMetadata = new DriveFile([
            'name' => $fileName,
            'parents' => [$folderId],
        ]);

        $fileSize = filesize($filePath);
        $chunkSizeBytes = 5 * 1024 * 1024; // 5MB chunks

        // Set deferred to true for chunked upload
        $client->setDefer(true);
        $request = $drive->files->create($fileMetadata);

        $media = new \Google\Http\MediaFileUpload(
            $client,
            $request,
            'application/octet-stream',
            null,
            true,
            $chunkSizeBytes
        );
        $media->setFileSize($fileSize);

        $handle = fopen($filePath, 'rb');
        $status = false;

        while (!$status && !feof($handle)) {
            $chunk = fread($handle, $chunkSizeBytes);
            $status = $media->nextChunk($chunk);
        }

        fclose($handle);
        $client->setDefer(false);

        if ($status instanceof DriveFile) {
            Log::info('Large file uploaded to Google Drive', [
                'drive_file_id' => $status->getId(),
                'file_name' => $fileName,
                'file_size' => $fileSize,
            ]);
            return $status->getId();
        }

        throw new \RuntimeException('Failed to upload large file to Google Drive');
    }

    /**
     * Download a file from Google Drive and save to local path.
     *
     * @param string $fileId Google Drive file ID
     * @param string $outputPath Local path to save the file
     * @return string The output path
     */
    public function download(string $fileId, string $outputPath): string
    {
        $drive = $this->getDriveService();

        $response = $drive->files->get($fileId, ['alt' => 'media']);
        $content = $response->getBody()->getContents();

        file_put_contents($outputPath, $content);

        return $outputPath;
    }

    /**
     * Download a file from Google Drive and return the content as a stream.
     *
     * @param string $fileId Google Drive file ID
     * @return resource Stream resource
     */
    public function downloadStream(string $fileId)
    {
        $drive = $this->getDriveService();
        $response = $drive->files->get($fileId, ['alt' => 'media']);

        $stream = $response->getBody()->detach();
        if (!$stream) {
            // Fallback: write to temp file and return handle
            $tempPath = tempnam(sys_get_temp_dir(), 'gdl_');
            file_put_contents($tempPath, $response->getBody()->getContents());
            return fopen($tempPath, 'rb');
        }

        return $stream;
    }

    /**
     * Delete a file from Google Drive.
     *
     * @param string $fileId Google Drive file ID
     * @return bool
     */
    public function delete(string $fileId): bool
    {
        try {
            $drive = $this->getDriveService();
            $drive->files->delete($fileId);

            Log::info('File deleted from Google Drive', ['drive_file_id' => $fileId]);
            return true;
        } catch (\Exception $e) {
            Log::error('Failed to delete file from Google Drive', [
                'drive_file_id' => $fileId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get file metadata from Google Drive.
     *
     * @param string $fileId Google Drive file ID
     * @return DriveFile|null
     */
    public function getFileInfo(string $fileId): ?DriveFile
    {
        try {
            $drive = $this->getDriveService();
            return $drive->files->get($fileId, [
                'fields' => 'id, name, size, mimeType, createdTime',
            ]);
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Get storage usage info.
     *
     * @return array{used: int, limit: int}
     */
    public function getStorageInfo(): array
    {
        try {
            $drive = $this->getDriveService();
            $about = $drive->about->get(['fields' => 'storageQuota']);
            $quota = $about->getStorageQuota();

            return [
                'used' => (int)$quota->getUsage(),
                'limit' => (int)$quota->getLimit(),
            ];
        } catch (\Exception $e) {
            return ['used' => 0, 'limit' => 0];
        }
    }
}
