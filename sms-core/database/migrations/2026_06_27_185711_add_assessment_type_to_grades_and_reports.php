<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->string('assessment_type')->nullable()->after('term_id');
        });

        Schema::table('published_reports', function (Blueprint $table) {
            $table->string('assessment_type')->nullable()->after('term_id');
        });
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropColumn('assessment_type');
        });
        Schema::table('published_reports', function (Blueprint $table) {
            $table->dropColumn('assessment_type');
        });
    }
};