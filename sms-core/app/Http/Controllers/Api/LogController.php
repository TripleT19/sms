<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class LogController extends Controller
{
    public function recent(Request $request)
    {
        $user = $request->user();
        $limit = $request->input('limit', 5);

        // If admin / director, show all logs; otherwise show only user's own
        $isAdmin = $user->roles()->whereIn('name', ['Admin', 'Director'])->exists();

        $query = ActivityLog::with('user:id,first_name,last_name')
            ->latest();

        if (!$isAdmin) {
            $query->where('user_id', $user->id);
        }

        return response()->json($query->take($limit)->get());
    }
}