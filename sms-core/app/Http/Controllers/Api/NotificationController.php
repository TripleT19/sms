<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user (newest first).
     */
    public function index(Request $request)
    {
        $notifications = Notification::with([
            'event' => function ($q) {
                $q->select('id', 'title', 'description', 'type', 'start_date', 'end_date',
                        'target_parents', 'target_teachers', 'target_staff', 'class_id', 'stream_id');
            },
            'event.class:id,name',
            'event.stream:id,name',
        ])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($notifications);
    }

    /**
     * Get unread notification count.
     */
    public function unreadCount(Request $request)
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->unread()
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Request $request, $id)
    {
        $notification = Notification::where('user_id', $request->user()->id)->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['message' => 'Marked as read']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All marked as read']);
    }

    public function unreadList(Request $request)
    {
        $notifications = Notification::with([
            'event' => function ($q) {
                $q->select('id', 'title', 'description', 'type', 'start_date', 'end_date',
                        'target_parents', 'target_teachers', 'target_staff', 'class_id', 'stream_id');
            },
            'event.class:id,name',
            'event.stream:id,name',
        ])
            ->where('user_id', $request->user()->id)
            ->unread()
            ->latest()
            ->take(5)
            ->get();

        return response()->json($notifications);
    }
}