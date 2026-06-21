<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassRoom extends Model
{
    protected $table = 'classes';
    protected $fillable = ['name'];

    /**
     * Streams attached to this class (many-to-many via class_stream).
     */
    public function streams()
    {
        return $this->belongsToMany(Stream::class, 'class_stream', 'class_id', 'stream_id')
            ->using(ClassStream::class)
            ->withPivot('id')
            ->withTimestamps();
    }

    /**
     * Subjects assigned directly to the class (class-level, not per stream).
     */
    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'class_subject', 'class_id', 'subject_id');
    }

    public function teachers()
    {
        return $this->belongsToMany(User::class, 'class_teacher', 'class_id', 'user_id');
    }
}