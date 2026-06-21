<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentComment extends Model
{
    protected $fillable = [
        'student_id', 'term_id', 'class_id', 'stream_id',
        'comment', 'include_attendance', 'submitted_at', 'published_at', 'entered_by',
    ];

    protected $casts = [
        'include_attendance' => 'boolean',
        'submitted_at' => 'datetime',
        'published_at' => 'datetime',
    ];

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