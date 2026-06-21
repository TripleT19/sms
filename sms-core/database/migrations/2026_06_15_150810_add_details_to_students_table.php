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
        Schema::table('students', function (Blueprint $table) {
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('preferred_name')->nullable()->after('last_name');
            $table->string('nationality')->nullable()->after('date_of_birth');
            $table->date('admission_date')->nullable();
            $table->string('academic_year')->nullable();
            $table->string('enrollment_status')->default('Active'); // Active, Graduated, Transferred, Suspended, Withdrawn
            $table->text('residential_address')->nullable();
            $table->string('city_town')->nullable();
            $table->string('district_region')->nullable();
            $table->string('student_phone')->nullable();
            $table->string('student_email')->nullable();
            $table->string('photo')->nullable(); // path to profile picture
            $table->date('photo_upload_date')->nullable();

            // Medical
            $table->string('blood_group')->nullable();
            $table->text('allergies')->nullable();
            $table->text('medical_conditions')->nullable();
            $table->text('disabilities')->nullable();
            $table->text('current_medication')->nullable();
            $table->text('emergency_medical_notes')->nullable();

            // Transport
            $table->boolean('uses_school_transport')->default(false);
            $table->string('pickup_location')->nullable();
            $table->string('transport_route')->nullable();
            $table->string('bus_number')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            //
        });
    }
};
