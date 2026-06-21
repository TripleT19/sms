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
        Schema::create('overpayment_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_student_fee_id')->constrained('student_fees');
            $table->foreignId('to_student_fee_id')->constrained('student_fees');
            $table->decimal('amount', 10, 2);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('overpayment_transfers');
    }
};
