<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OverpaymentTransfer extends Model
{
    protected $fillable = ['from_student_fee_id', 'to_student_fee_id', 'amount'];

    public function fromFee()
    {
        return $this->belongsTo(StudentFee::class, 'from_student_fee_id');
    }

    public function toFee()
    {
        return $this->belongsTo(StudentFee::class, 'to_student_fee_id');
    }
}