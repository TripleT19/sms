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
        Schema::table('student_fees', function (Blueprint $table) {
            $table->foreignId('term_id')->nullable()->constrained()->nullOnDelete();
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('term_id')->nullable()->constrained()->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('student_fees', function (Blueprint $table) {
            $table->dropForeign(['term_id']);
            $table->dropColumn('term_id');
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['term_id']);
            $table->dropColumn('term_id');
        });
    }
};
