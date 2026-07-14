<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('student_skill_assessments', function (Blueprint $table) {
            // Make subject_id nullable
            $table->foreignId('subject_id')->nullable()->change();
        });
    }

    public function down()
    {
        Schema::table('student_skill_assessments', function (Blueprint $table) {
            // Revert to NOT NULL (be careful – existing nulls will cause an error)
            $table->foreignId('subject_id')->nullable(false)->change();
        });
    }
};