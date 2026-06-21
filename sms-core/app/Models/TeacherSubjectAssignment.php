<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherSubjectAssignment extends Model
{
    protected $fillable = ['user_id', 'subject_id', 'class_id', 'stream_id'];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function class()
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    public function stream()
    {
        return $this->belongsTo(Stream::class);
    }
}