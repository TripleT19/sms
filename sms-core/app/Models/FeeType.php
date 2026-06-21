<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class FeeType extends Model
{
    protected $fillable = ['name', 'description', 'is_mandatory', 'class_id', 'stream_id', 'has_variations', 'category'];


    protected $casts = ['is_mandatory' => 'boolean'];

    public function class() { return $this->belongsTo(ClassRoom::class); }
    public function stream() { return $this->belongsTo(Stream::class); }
    public function studentFees() { return $this->hasMany(StudentFee::class); }
    public function amounts() { return $this->hasMany(FeeTypeAmount::class); }
}