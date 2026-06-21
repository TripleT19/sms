<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Qualification;

class QualificationSeeder extends Seeder
{
    public function run(): void
    {
        $quals = ['B.Ed', 'M.Ed', 'B.Sc', 'M.Sc', 'Ph.D', 'MBA', 'PGCE', 'TEFL', 'TESOL'];
        foreach ($quals as $q) {
            Qualification::create(['name' => $q]);
        }
    }
}