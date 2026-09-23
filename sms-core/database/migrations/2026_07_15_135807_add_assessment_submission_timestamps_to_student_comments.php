<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('student_comments', function (Blueprint $table) {
            $table->timestamp('submitted_mid_term_at')->nullable()->after('submitted_at');
            $table->timestamp('submitted_end_term_at')->nullable()->after('submitted_mid_term_at');
        });
    }

    public function down()
    {
        Schema::table('student_comments', function (Blueprint $table) {
            $table->dropColumn(['submitted_mid_term_at', 'submitted_end_term_at']);
        });
    }
};