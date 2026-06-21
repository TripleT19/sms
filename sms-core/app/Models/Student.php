<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $fillable = [
        'first_name', 'middle_name', 'last_name', 'preferred_name',
        'gender', 'date_of_birth', 'nationality',
        'admission_date', 'class_id', 'stream_id', 'academic_year',
        'enrollment_status', 'student_number',
        'residential_address', 'city_town', 'district_region',
        'student_phone', 'student_email', 'photo', 'photo_upload_date',
        'blood_group', 'allergies', 'medical_conditions', 'disabilities',
        'current_medication', 'emergency_medical_notes',
        'uses_school_transport', 'pickup_location', 'transport_route', 'bus_number',
    ];

    public function class()
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    public function stream()
    {
        return $this->belongsTo(Stream::class);
    }

    public function guardians()
    {
        return $this->belongsToMany(Guardian::class, 'guardian_student');
    }
}