<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('type', ['image', 'video']);
            $table->string('mime_type');
            $table->string('original_filename');
            $table->unsignedBigInteger('size'); // bytes
            $table->string('drive_file_id'); // Google Drive file ID (encrypted file)
            $table->string('thumb_drive_id')->nullable(); // thumbnail Drive file ID
            $table->string('cache_key')->unique(); // unique key for cache file naming
            $table->unsignedBigInteger('album_id')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('album_id')->references('id')->on('albums')->onDelete('set null');
        });

        // Add cover_media_id foreign key to albums
        Schema::table('albums', function (Blueprint $table) {
            $table->foreign('cover_media_id')->references('id')->on('media')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('albums', function (Blueprint $table) {
            $table->dropForeign(['cover_media_id']);
        });
        Schema::dropIfExists('media');
    }
};
