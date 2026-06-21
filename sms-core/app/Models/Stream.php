<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stream extends Model
{
    protected $fillable = ['name'];

    public function classes()
    {
        return $this->belongsToMany(ClassRoom::class, 'class_stream', 'stream_id', 'class_id')
            ->using(ClassStream::class)
            ->withPivot('id');
    }
}