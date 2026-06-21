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
        Schema::table('fee_types', function (Blueprint $table) {
            // Remove old amount column if it still exists (we already dropped it earlier, but just to be safe)
            if (Schema::hasColumn('fee_types', 'amount')) {
                $table->dropColumn('amount');
            }
            // Add category and make name unique per category? Actually we'll keep name as free text.
            $table->string('category')->default('Other');   // Trip, School Fees, Bus Fare, School Fund, Other
            // name is already there, we'll just keep it
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
