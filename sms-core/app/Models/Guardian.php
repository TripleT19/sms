<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Guardian extends Model
{
    protected $fillable = [
        'user_id', 'first_name', 'last_name', 'relationship',
        'phone', 'alt_phone', 'email', 'occupation',
        'residential_address', 'is_emergency_contact',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function students()
    {
        // ✅ Removed withPivot('relationship') – the column doesn't exist
        return $this->belongsToMany(Student::class, 'guardian_student', 'guardian_id', 'student_id');
    }
}