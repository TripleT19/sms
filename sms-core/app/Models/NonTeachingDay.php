<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class NonTeachingDay extends Model
{
    protected $fillable = ['date', 'class_id', 'stream_id', 'added_by', 'reason'];
}