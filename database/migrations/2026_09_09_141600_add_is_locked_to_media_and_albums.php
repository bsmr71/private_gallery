<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->boolean('is_locked')->default(false)->after('is_favorite')->index();
        });

        Schema::table('albums', function (Blueprint $table) {
            $table->boolean('is_locked')->default(false)->after('cover_media_id')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->dropColumn('is_locked');
        });

        Schema::table('albums', function (Blueprint $table) {
            $table->dropColumn('is_locked');
        });
    }
};
