<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_fees', function (Blueprint $table) {
            $table->foreignId('class_id')->nullable()->after('term_id')->constrained('classes')->nullOnDelete();
            $table->foreignId('stream_id')->nullable()->after('class_id')->constrained('streams')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('student_fees', function (Blueprint $table) {
            $table->dropForeign(['class_id']);
            $table->dropForeign(['stream_id']);
            $table->dropColumn(['class_id', 'stream_id']);
        });
    }
};