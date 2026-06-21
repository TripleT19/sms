<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class FeeTypeAmount extends Model
{
   protected $fillable = ['fee_type_id', 'location', 'amount', 'class_id', 'stream_id'];

    public function class() { return $this->belongsTo(ClassRoom::class); }
    public function stream() { return $this->belongsTo(Stream::class); }
    public function feeType() { return $this->belongsTo(FeeType::class); }
}