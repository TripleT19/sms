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
        Schema::table('grades', function (Blueprint $table) {
            $table->string('remarks', 50)->nullable()->after('grade');
            $table->decimal('out_of', 5, 2)->default(100.00)->after('grade');
        });
    }

    public function down()
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropColumn(['remarks', 'out_of']);
        });
    }
};
