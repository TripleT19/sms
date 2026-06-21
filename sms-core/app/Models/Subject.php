<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    protected $fillable = ['name', 'description'];

    public function classes() {
        return $this->belongsToMany(ClassRoom::class, 'class_subject', 'subject_id', 'class_id');
    }
}