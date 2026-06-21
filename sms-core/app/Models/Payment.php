<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = ['student_fee_id', 'amount', 'payment_date', 'receipt_number', 'method', 'notes'];

    public function studentFee() { return $this->belongsTo(StudentFee::class); }
}