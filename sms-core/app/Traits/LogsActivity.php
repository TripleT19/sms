<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Request;

trait LogsActivity
{
    public static function log(string $action, ?string $description = null, ?array $metadata = null, ?int $userId = null): void
    {
        ActivityLog::create([
            'user_id'    => $userId,
            'action'     => $action,
            'description'=> $description,
            'metadata'   => $metadata,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }
}