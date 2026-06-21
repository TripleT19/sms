<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class ClassStream extends Pivot
{
    protected $table = 'class_stream';
    protected $fillable = ['class_id', 'stream_id'];

    public function teachers()
    {
        return $this->belongsToMany(User::class, 'class_stream_teacher', 'class_stream_id', 'user_id');
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