<?php

namespace App\Services;

/**
 * FileEncryptionService
 *
 * Handles AES-256-GCM encryption/decryption of files in chunks.
 * This allows large files to be encrypted without loading them entirely into memory,
 * and enables seeking within encrypted files for video streaming.
 *
 * File format:
 * [4 bytes: chunk size (uint32)] [12 bytes: master IV]
 * [chunk1: 12-byte IV + encrypted data + 16-byte GCM tag]
 * [chunk2: 12-byte IV + encrypted data + 16-byte GCM tag]
 * ...
 */
class FileEncryptionService
{
    private string $key;
    private int $chunkSize;

    // Overhead per chunk: 12 bytes IV + 16 bytes GCM tag
    private const IV_LENGTH = 12;
    private const TAG_LENGTH = 16;
    private const HEADER_SIZE = 16; // 4 bytes chunk size + 12 bytes master IV
    private const CIPHER = 'aes-256-gcm';

    public function __construct()
    {
        $appKey = config('app.key');
        // Derive a 32-byte key from APP_KEY
        if (str_starts_with($appKey, 'base64:')) {
            $this->key = base64_decode(substr($appKey, 7));
        } else {
            $this->key = hash('sha256', $appKey, true);
        }

        // 1MB chunks — good balance between memory usage and seek performance
        $this->chunkSize = 1024 * 1024;
    }

    /**
     * Encrypt a file and return the encrypted content as a temporary file path.
     */
    public function encryptFile(string $inputPath): string
    {
        $outputPath = tempnam(sys_get_temp_dir(), 'enc_');
        $input = fopen($inputPath, 'rb');
        $output = fopen($outputPath, 'wb');

        if (!$input || !$output) {
            throw new \RuntimeException('Cannot open files for encryption');
        }

        // Write header: chunk size + master IV
        $masterIv = random_bytes(self::IV_LENGTH);
        fwrite($output, pack('N', $this->chunkSize));
        fwrite($output, $masterIv);

        $chunkIndex = 0;
        while (!feof($input)) {
            $plaintext = fread($input, $this->chunkSize);
            if ($plaintext === false || $plaintext === '') {
                break;
            }

            // Generate unique IV per chunk using master IV + chunk index
            $chunkIv = $this->deriveChunkIv($masterIv, $chunkIndex);

            $tag = '';
            $ciphertext = openssl_encrypt(
                $plaintext,
                self::CIPHER,
                $this->key,
                OPENSSL_RAW_DATA,
                $chunkIv,
                $tag,
                '', // aad
                self::TAG_LENGTH
            );

            if ($ciphertext === false) {
                throw new \RuntimeException('Encryption failed at chunk ' . $chunkIndex);
            }

            // Write: IV + ciphertext + tag
            fwrite($output, $chunkIv);
            fwrite($output, $ciphertext);
            fwrite($output, $tag);

            $chunkIndex++;
        }

        fclose($input);
        fclose($output);

        return $outputPath;
    }

    /**
     * Decrypt an encrypted file to a temporary file.
     */
    public function decryptFile(string $inputPath): string
    {
        $outputPath = tempnam(sys_get_temp_dir(), 'dec_');
        $input = fopen($inputPath, 'rb');
        $output = fopen($outputPath, 'wb');

        if (!$input || !$output) {
            throw new \RuntimeException('Cannot open files for decryption');
        }

        // Read header
        $header = fread($input, self::HEADER_SIZE);
        $chunkSize = unpack('N', substr($header, 0, 4))[1];

        // Encrypted chunk size = IV + encrypted data (same as plaintext chunk) + tag
        $encryptedChunkSize = self::IV_LENGTH + $chunkSize + self::TAG_LENGTH;

        $chunkIndex = 0;
        while (!feof($input)) {
            $encryptedChunk = fread($input, $encryptedChunkSize);
            if ($encryptedChunk === false || $encryptedChunk === '') {
                break;
            }

            $chunkLen = strlen($encryptedChunk);

            // Extract IV, ciphertext, and tag
            $chunkIv = substr($encryptedChunk, 0, self::IV_LENGTH);
            $tag = substr($encryptedChunk, -self::TAG_LENGTH);
            $ciphertext = substr($encryptedChunk, self::IV_LENGTH, $chunkLen - self::IV_LENGTH - self::TAG_LENGTH);

            $plaintext = openssl_decrypt(
                $ciphertext,
                self::CIPHER,
                $this->key,
                OPENSSL_RAW_DATA,
                $chunkIv,
                $tag
            );

            if ($plaintext === false) {
                throw new \RuntimeException('Decryption failed at chunk ' . $chunkIndex . '. File may be corrupted or key is wrong.');
            }

            fwrite($output, $plaintext);
            $chunkIndex++;
        }

        fclose($input);
        fclose($output);

        return $outputPath;
    }

    /**
     * Decrypt from a stream resource and return decrypted temp file path.
     */
    public function decryptStream($inputStream): string
    {
        $tempInput = tempnam(sys_get_temp_dir(), 'drv_');
        $tempOutput = fopen($tempInput, 'wb');

        while (!feof($inputStream)) {
            fwrite($tempOutput, fread($inputStream, 8192));
        }

        fclose($tempOutput);

        $decryptedPath = $this->decryptFile($tempInput);
        @unlink($tempInput);

        return $decryptedPath;
    }

    /**
     * Derive a unique IV for each chunk to ensure no IV reuse.
     */
    private function deriveChunkIv(string $masterIv, int $chunkIndex): string
    {
        // XOR the last 4 bytes of master IV with the chunk index
        $iv = $masterIv;
        $indexBytes = pack('N', $chunkIndex);
        for ($i = 0; $i < 4; $i++) {
            $iv[self::IV_LENGTH - 4 + $i] = chr(ord($iv[self::IV_LENGTH - 4 + $i]) ^ ord($indexBytes[$i]));
        }
        return $iv;
    }
}
