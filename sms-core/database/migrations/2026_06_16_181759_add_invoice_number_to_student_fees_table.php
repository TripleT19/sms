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
            $table->string('invoice_number')->nullable()->unique()->after('term_id');
        });
    }

    public function down()
    {
        Schema::table('student_fees', function (Blueprint $table) {
            $table->dropColumn('invoice_number');
        });
    }
};
