<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class UpdateSanctumExpiration
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()) {
            $token = $request->user()->currentAccessToken();

            if ($token instanceof PersonalAccessToken) {
                $token->forceFill([
                    'expires_at' => now()->addMinutes(15),
                ])->save();
            }
        }

        return $next($request);
    }
}