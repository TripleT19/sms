<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('student_skill_assessments', function (Blueprint $table) {
            $table->enum('rating', ['EE', 'A', 'D', 'B'])->nullable()->after('areas_for_improvement');
        });
    }

    public function down()
    {
        Schema::table('student_skill_assessments', function (Blueprint $table) {
            $table->dropColumn('rating');
        });
    }
};