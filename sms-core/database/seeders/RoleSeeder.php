<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Admin',              'level' => 110],
            ['name' => 'Director',           'level' => 100],
            ['name' => 'Headteacher',        'level' => 90],
            ['name' => 'Deputy Headteacher', 'level' => 85],
            ['name' => 'Finance Officer',    'level' => 80],
            ['name' => 'Head of Department', 'level' => 70],
            ['name' => 'Teacher',            'level' => 50],
            ['name' => 'Parent',             'level' => 10],
        ];

        foreach ($roles as $role) {
            Role::create($role);
        }
    }
}