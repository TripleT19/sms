<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('student_skill_assessments', function (Blueprint $table) {
            // 1. Add competency_id if it does not already exist
            if (!Schema::hasColumn('student_skill_assessments', 'competency_id')) {
                $table->foreignId('competency_id')
                      ->nullable()
                      ->after('subject_id')
                      ->constrained()
                      ->onDelete('cascade');
            }

            // 2. Create individual indexes for all foreign‑key columns
            //    (InnoDB needs an index for each foreign key)
            $table->index('student_id');
            $table->index('subject_id');
            $table->index('term_id');
            $table->index('class_id');
            $table->index('entered_by');
            // stream_id already has its own foreign key with index

            // 3. Now we can safely drop the old unique constraint
            $table->dropUnique('unique_skill_assessment');

            // 4. Add the new composite unique key
            $table->unique(
                ['student_id', 'subject_id', 'term_id', 'competency_id'],
                'unique_skill_competency'
            );
        });
    }

    public function down()
    {
        Schema::table('student_skill_assessments', function (Blueprint $table) {
            // Reverse the operations
            $table->dropForeign(['competency_id']);
            $table->dropColumn('competency_id');
            $table->dropUnique('unique_skill_competency');
            $table->unique(['student_id', 'subject_id', 'term_id'], 'unique_skill_assessment');
        });
    }
};