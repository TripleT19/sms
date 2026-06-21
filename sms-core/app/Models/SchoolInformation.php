<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolInformation extends Model
{
    protected $table = 'school_information';

    protected $fillable = [
        'school_name', 'email_primary', 'email_secondary',
        'phone_primary', 'phone_secondary', 'postal_address',
        'website', 'headteacher_name', 'motto', 'logo',
    ];
}