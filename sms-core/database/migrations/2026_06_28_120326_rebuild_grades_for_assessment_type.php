<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create the new table with the correct structure
        Schema::create('grades_new', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('stream_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('term_id')->constrained()->cascadeOnDelete();
            $table->string('assessment_type')->nullable()->index();
            $table->decimal('score', 8, 2)->nullable();
            $table->string('grade', 10)->nullable();
            $table->decimal('out_of', 5, 2)->default(100.00);
            $table->string('remarks', 50)->nullable();
            $table->foreignId('entered_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            // The new unique index – includes assessment_type
            $table->unique(
                ['student_id', 'subject_id', 'term_id', 'assessment_type'],
                'grades_student_subject_term_assessment_unique'
            );
        });

        // Copy all data from the old table
        DB::statement('INSERT INTO grades_new (id, student_id, subject_id, class_id, stream_id, term_id, assessment_type, score, grade, out_of, remarks, entered_by, created_at, updated_at) SELECT id, student_id, subject_id, class_id, stream_id, term_id, assessment_type, score, grade, IFNULL(out_of, 100), remarks, entered_by, created_at, updated_at FROM grades');

        // Drop the old table and rename the new one
        Schema::drop('grades');
        Schema::rename('grades_new', 'grades');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Rebuild the old table structure (without assessment_type) if needed
        Schema::create('grades_old', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('stream_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('term_id')->constrained()->cascadeOnDelete();
            $table->decimal('score', 8, 2)->nullable();
            $table->string('grade', 10)->nullable();
            $table->decimal('out_of', 5, 2)->default(100.00);
            $table->string('remarks', 50)->nullable();
            $table->foreignId('entered_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            // The old unique index (without assessment_type)
            $table->unique(['student_id', 'subject_id', 'term_id']);
        });

        // Copy data back, omitting assessment_type
        DB::statement('INSERT INTO grades_old (id, student_id, subject_id, class_id, stream_id, term_id, score, grade, out_of, remarks, entered_by, created_at, updated_at) SELECT id, student_id, subject_id, class_id, stream_id, term_id, score, grade, out_of, remarks, entered_by, created_at, updated_at FROM grades');

        // Swap the tables back
        Schema::drop('grades');
        Schema::rename('grades_old', 'grades');
    }
};