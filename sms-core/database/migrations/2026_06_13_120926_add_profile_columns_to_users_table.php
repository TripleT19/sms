<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
// database/migrations/xxxx_add_profile_columns_to_users_table.php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->string('first_name')->nullable()->after('name');
        $table->string('last_name')->nullable()->after('first_name');
        $table->string('salutation')->nullable()->after('last_name'); // Mr, Mrs, Ms, Dr, Prof, etc.
        $table->string('phone')->nullable()->after('email');
        $table->string('profile_pic')->nullable()->after('phone');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            //
        });
    }
};
