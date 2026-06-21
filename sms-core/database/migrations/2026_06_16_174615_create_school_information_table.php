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
        Schema::create('school_information', function (Blueprint $table) {
            $table->id();
            $table->string('school_name');
            $table->string('email_primary')->nullable();
            $table->string('email_secondary')->nullable();
            $table->string('phone_primary')->nullable();
            $table->string('phone_secondary')->nullable();
            $table->string('postal_address')->nullable();
            $table->string('website')->nullable();
            $table->string('headteacher_name')->nullable();
            $table->string('motto')->nullable();
            $table->string('logo')->nullable();   // path to stored logo
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('school_information');
    }
};
