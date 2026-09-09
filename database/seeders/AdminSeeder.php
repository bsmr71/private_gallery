<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'bismar71@gmail.com');
        $password = env('ADMIN_PASSWORD', 'Z@buza71');

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Bismar',
                'password' => Hash::make($password),
            ]
        );
    }
}
