<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Role;
use App\Models\SchoolEvent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;      // ← added import

class SchoolEventController extends Controller
{
    public function index(Request $request)
    {
        $query = SchoolEvent::with([
            'creator:id,first_name,last_name',
            'class:id,name',
            'stream:id,name',
            'teachers:id,first_name,last_name',
        ]);

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($qry) use ($q) {
                $qry->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $events = $query->orderBy('start_date', 'desc')->get();

        $events->transform(function ($event) {
            if ($event->deadline && $event->deadline < now() && $event->status === 'active') {
                $event->status = 'expired';
                $event->save();
            }
            return $event;
        });

        return response()->json($events);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'           => 'required|string|max:255',
            'description'     => 'nullable|string',
            'type'            => 'required|in:exam,task,holiday,trip,announcement',
            'start_date'      => 'nullable|date',
            'end_date'        => 'nullable|date|after_or_equal:start_date',
            'deadline'        => 'nullable|date',
            'target_parents'  => 'boolean',
            'target_teachers' => 'boolean',
            'target_staff'    => 'boolean',
            'class_id'        => 'nullable|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'teachers'        => 'array',
            'teachers.*'      => 'exists:users,id',
        ]);

        $validated['created_by'] = $request->user()->id;
        $validated['status'] = 'active';

        $event = SchoolEvent::create($validated);

        if ($request->type === 'task' && $request->has('teachers')) {
            $event->teachers()->sync($request->teachers);
        }

        $this->dispatchEventNotifications($event);

        return response()->json($event->load('teachers'), 201);
    }

    public function update(Request $request, $id)
    {
        $event = SchoolEvent::findOrFail($id);

        if ($event->status === 'expired') {
            return response()->json(['message' => 'Cannot edit an expired event.'], 422);
        }

        $validated = $request->validate([
            'title'           => 'sometimes|string|max:255',
            'description'     => 'nullable|string',
            'type'            => 'sometimes|in:exam,task,holiday,trip,announcement',
            'start_date'      => 'nullable|date',
            'end_date'        => 'nullable|date|after_or_equal:start_date',
            'deadline'        => 'nullable|date',
            'target_parents'  => 'boolean',
            'target_teachers' => 'boolean',
            'target_staff'    => 'boolean',
            'class_id'        => 'nullable|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'teachers'        => 'array',
            'teachers.*'      => 'exists:users,id',
        ]);

        $event->update($validated);

        if ($request->has('teachers')) {
            $event->teachers()->sync($request->teachers);
        }

        return response()->json($event->load('teachers'));
    }

    public function destroy($id)
    {
        $event = SchoolEvent::findOrFail($id);
        $event->delete();
        return response()->json(['message' => 'Event deleted']);
    }

    public function teachersList()
    {
        $teachers = User::whereHas('roles', function ($q) {
            $q->whereIn('name', ['Teacher', 'Headteacher', 'Deputy Headteacher', 'Head of Department']);
        })->get(['id', 'first_name', 'last_name', 'email']);
        return response()->json($teachers);
    }

    private function dispatchEventNotifications(SchoolEvent $event)
    {
        $userIds = collect();

        // ---- Teachers (when target_teachers is checked OR event is a task) ----
        if ($event->target_teachers || $event->type === 'task') {
            $teacherRoleIds = Role::whereIn('name', [
                'Teacher', 'Headteacher', 'Deputy Headteacher', 'Head of Department',
            ])->pluck('id');

            $teacherIds = User::whereHas('roles', function ($q) use ($teacherRoleIds) {
                $q->whereIn('role_user.role_id', $teacherRoleIds);
            })->pluck('id');

            $userIds = $userIds->merge($teacherIds);
        }

        // ---- Parents (when target_parents is checked) ----
        if ($event->target_parents) {
            $parentRole = Role::where('name', 'Parent')->first();
            if ($parentRole) {
                $parentIds = User::whereHas('roles', function ($q) use ($parentRole) {
                    $q->where('role_user.role_id', $parentRole->id);
                })->pluck('id');
                $userIds = $userIds->merge($parentIds);
            }
        }

        // ---- Staff (when target_staff is checked) ----
        if ($event->target_staff) {
            $staffRoleIds = Role::whereNotIn('name', ['Parent', 'Student'])->pluck('id');
            $staffIds = User::whereHas('roles', function ($q) use ($staffRoleIds) {
                $q->whereIn('role_user.role_id', $staffRoleIds);
            })->pluck('id');
            $userIds = $userIds->merge($staffIds);
        }

        // ---- Parents of a specific class/stream ----
        if ($event->class_id) {
            $parentRoleId = Role::where('name', 'Parent')->value('id');
            if ($parentRoleId) {
                $guardianIds = User::whereHas('guardianOf', function ($q) use ($event) {
                    $q->where('class_id', $event->class_id);
                    if ($event->stream_id) {
                        $q->where('stream_id', $event->stream_id);
                    }
                })->pluck('id');
                $userIds = $userIds->merge($guardianIds);
            }
        }

        // ---- Remove duplicates ----
        $userIds = $userIds->unique()->values();

        Log::info('Event notification recipients', [
            'event_id' => $event->id,
            'user_ids' => $userIds->toArray(),
        ]);

        if ($userIds->isEmpty()) {
            return;
        }

        $message = "New {$event->type}: {$event->title}";
        $now = now();
        $insertData = [];

        foreach ($userIds as $uid) {
            $insertData[] = [
                'user_id'         => $uid,
                'school_event_id' => $event->id,
                'type'            => 'event',
                'message'         => $message,
                'created_at'      => $now,
                'updated_at'      => $now,
            ];
        }

        Notification::insert($insertData);
    }
}