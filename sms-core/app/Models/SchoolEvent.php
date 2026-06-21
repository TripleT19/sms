<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolEvent extends Model
{
    protected $fillable = [
        'title', 'description', 'type', 'start_date', 'end_date',
        'deadline', 'target_parents', 'target_teachers', 'target_staff',
        'class_id', 'stream_id', 'created_by', 'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date'   => 'date',
        'deadline'   => 'datetime',
        'target_parents' => 'boolean',
        'target_teachers' => 'boolean',
        'target_staff'    => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function class()
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    public function stream()
    {
        return $this->belongsTo(Stream::class);
    }

    public function teachers()
    {
        return $this->belongsToMany(User::class, 'event_teacher', 'school_event_id', 'user_id');
    }
}