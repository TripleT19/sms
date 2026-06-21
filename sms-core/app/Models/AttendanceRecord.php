<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceRecord extends Model
{
    protected $fillable = ['student_id', 'date', 'status', 'class_id', 'stream_id', 'term_id', 'marked_by'];
}