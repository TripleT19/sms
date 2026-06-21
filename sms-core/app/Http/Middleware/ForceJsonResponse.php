<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ForceJsonResponse
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        // Only force JSON for API routes – leave web routes alone
        if ($request->is('api/*') || $request->expectsJson()) {
            $request->headers->set('Accept', 'application/json');

            $response = $next($request);

            // If the response is HTML, change it to JSON (handles edge cases)
            $ctype = $response->headers->get('Content-Type', '');
            if (!$ctype || str_contains($ctype, 'text/html')) {
                $response->headers->set('Content-Type', 'application/json');
            }
        } else {
            $response = $next($request);
        }

        return $response;
    }
}