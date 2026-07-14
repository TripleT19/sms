<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Competency extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'subject_id'];

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function skills()
    {
        return $this->hasMany(Skill::class);
    }
}