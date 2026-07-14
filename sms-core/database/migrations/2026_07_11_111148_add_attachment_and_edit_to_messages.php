<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('attachment')->nullable()->after('body');
            $table->string('attachment_name')->nullable()->after('attachment');
            $table->string('attachment_type')->nullable()->after('attachment_name');
            $table->boolean('edited')->default(false)->after('attachment_type');
        });
    }

    public function down()
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['attachment', 'attachment_name', 'attachment_type', 'edited']);
        });
    }
};