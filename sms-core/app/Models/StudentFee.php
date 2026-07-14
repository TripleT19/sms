<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentFee extends Model
{
    protected $fillable = [
        'student_id', 'fee_type_id', 'term_id', 'class_id', 'stream_id',
        'total_amount', 'paid_amount', 'status', 'invoice_number',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function feeType()
    {
        return $this->belongsTo(FeeType::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function term()
    {
        return $this->belongsTo(Term::class);
    }
}