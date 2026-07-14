<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentSkillAssessment extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'subject_id',
        'competency_id',
        'skill_id',
        'term_id',
        'class_id',
        'stream_id',
        'achievements',
        'areas_for_improvement',
        'rating',
        'entered_by',
    ];

    protected $casts = [
        'rating' => 'string',
    ];

    public function skill()
    {
        return $this->belongsTo(Skill::class);
    }

    public function competency()
    {
        return $this->belongsTo(Competency::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function term()
    {
        return $this->belongsTo(Term::class);
    }

    public function class()
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    public function stream()
    {
        return $this->belongsTo(Stream::class);
    }

    public function enteredBy()
    {
        return $this->belongsTo(User::class, 'entered_by');
    }
}