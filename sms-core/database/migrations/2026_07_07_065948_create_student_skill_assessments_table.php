<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('student_skill_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')
                  ->constrained()
                  ->onDelete('cascade');
            $table->foreignId('subject_id')
                  ->constrained()
                  ->onDelete('cascade');
            $table->foreignId('term_id')
                  ->constrained()
                  ->onDelete('cascade');
            $table->foreignId('class_id')
                  ->constrained('classes')
                  ->onDelete('cascade');
            $table->foreignId('stream_id')
                  ->nullable()
                  ->constrained()
                  ->onDelete('set null');
            $table->text('achievements')->nullable();         // what the child can do
            $table->text('areas_for_improvement')->nullable(); // what the child can do better
            $table->foreignId('entered_by')
                  ->constrained('users')
                  ->onDelete('cascade');
            $table->timestamps();

            // A student can only have one skill assessment per subject per term
            $table->unique(['student_id', 'subject_id', 'term_id'], 'unique_skill_assessment');
        });
    }

    public function down()
    {
        Schema::dropIfExists('student_skill_assessments');
    }
};