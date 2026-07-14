<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Term extends Model
{
    protected $fillable = ['name', 'start_date', 'end_date', 'academic_year_id','next_opening_date'];

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class);
    }
}