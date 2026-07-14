<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('published_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('term_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('stream_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('average', 8, 2)->nullable();
            $table->integer('class_position')->nullable();
            $table->integer('class_total')->nullable();
            $table->integer('stream_position')->nullable();
            $table->json('grades');
            $table->text('comment')->nullable();
            $table->decimal('fees_balance', 10, 2)->default(0);
            $table->boolean('results_withheld')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('published_reports');
    }
};