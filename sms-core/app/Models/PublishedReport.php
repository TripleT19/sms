<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublishedReport extends Model
{
    protected $fillable = [
        'student_id', 'term_id', 'class_id', 'stream_id',
        'average', 'class_position', 'class_total',
        'stream_position', 'grades', 'comment',
        'fees_balance', 'results_withheld',
    ];

    protected $casts = [
        'grades'           => 'array',
        'results_withheld' => 'boolean',
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
        return $this->belongsTo(ClassRoom::class);
    }

    public function stream()
    {
        return $this->belongsTo(Stream::class);
    }
}