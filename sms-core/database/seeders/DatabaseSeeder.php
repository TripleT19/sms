<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            QualificationSeeder::class,
        ]);

        // Admin
        $admin = User::firstOrCreate(
            ['email' => 'admin@nzerutechsolutions.com'],
            [
                'first_name' => 'Admin',
                'last_name'  => 'User',
                'name'       => 'Admin User',               // ← required
                'username'   => 'admin',
                'password'   => bcrypt('password'),
            ]
        );
        $admin->roles()->sync(Role::where('name', 'Admin')->first());

        // Director
        $director = User::firstOrCreate(
            ['email' => 'director@example.com'],
            [
                'first_name' => 'Director',
                'last_name'  => 'User',
                'name'       => 'Director User',
                'username'   => 'director',
                'password'   => bcrypt('password'),
            ]
        );
        $director->roles()->sync(Role::where('name', 'Director')->first());

        // Teacher
        $teacher = User::firstOrCreate(
            ['email' => 'teacher@example.com'],
            [
                'first_name' => 'Jane',
                'last_name'  => 'Smith',
                'name'       => 'Jane Smith',
                'username'   => 'teacher',
                'password'   => bcrypt('password'),
            ]
        );
        $teacher->roles()->sync(Role::where('name', 'Teacher')->first());
        $teacher->qualifications()->sync([1, 2]);

        // Parent
        $parent = User::firstOrCreate(
            ['email' => 'parent@example.com'],
            [
                'first_name' => 'Parent',
                'last_name'  => 'Doe',
                'name'       => 'Parent Doe',
                'username'   => 'parent',
                'password'   => bcrypt('password'),
            ]
        );
        $parent->roles()->sync(Role::where('name', 'Parent')->first());

        // Head of Department (multiple roles)
        $hod = User::firstOrCreate(
            ['email' => 'hod@example.com'],
            [
                'first_name' => 'Head',
                'last_name'  => 'Of Dept',
                'name'       => 'Head Of Dept',
                'username'   => 'hod',
                'password'   => bcrypt('password'),
            ]
        );
        $hod->roles()->sync([
            Role::where('name', 'Teacher')->first()->id,
            Role::where('name', 'Head of Department')->first()->id,
        ]);
    }
}