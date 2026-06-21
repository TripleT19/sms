<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('non_teaching_days', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('stream_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('added_by')->constrained('users')->cascadeOnDelete();
            $table->string('reason')->nullable(); // e.g., "Holiday", "Exam"
            $table->timestamps();
            $table->unique(['date', 'class_id', 'stream_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('non_teaching_days');
    }
};
