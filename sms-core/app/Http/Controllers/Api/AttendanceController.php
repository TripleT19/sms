<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\ClassRoom;
use App\Models\ClassStream;
use App\Models\NonTeachingDay;
use App\Models\Student;
use App\Models\Term;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    /**
     * Get the classes/streams assigned to the authenticated teacher.
     */
    public function teacherAssignments(Request $request)
    {
        $user = $request->user();

        // 1. Find class-stream pivots where the user is a teacher
        $classStreamPivots = ClassStream::whereHas('teachers', function ($q) use ($user) {
            $q->where('users.id', $user->id);
        })
            ->with(['class', 'stream'])
            ->get();

        $classesMap = [];

        foreach ($classStreamPivots as $pivot) {
            $class = $pivot->class;
            $stream = $pivot->stream;

            if (!isset($classesMap[$class->id])) {
                $classesMap[$class->id] = [
                    'id'      => $class->id,
                    'name'    => $class->name,
                    'streams' => [],
                ];
            }

            if ($stream) {
                $alreadyAdded = false;
                foreach ($classesMap[$class->id]['streams'] as $existingStream) {
                    if ($existingStream['id'] === $stream->id) {
                        $alreadyAdded = true;
                        break;
                    }
                }
                if (!$alreadyAdded) {
                    $classesMap[$class->id]['streams'][] = [
                        'id'   => $stream->id,
                        'name' => $stream->name,
                    ];
                }
            }
        }

        // 2. Add classes where teacher is directly assigned (via class_teacher pivot)
        $directClasses = $user->taughtClasses()->get();
        foreach ($directClasses as $class) {
            if (!isset($classesMap[$class->id])) {
                $classStreams = $class->streams()->get()->map(fn($s) => [
                    'id'   => $s->id,
                    'name' => $s->name,
                ]);
                $classesMap[$class->id] = [
                    'id'      => $class->id,
                    'name'    => $class->name,
                    'streams' => $classStreams->values()->toArray(),
                ];
            }
        }

        return response()->json(array_values($classesMap));
    }

    /**
     * Get students in a class/stream with their attendance summary for a term.
     */
    public function index(Request $request)
    {
        $request->validate([
            'term_id'   => 'required|exists:terms,id',
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $term  = Term::findOrFail($request->term_id);
        $today = Carbon::today();
        $start = Carbon::parse($term->start_date)->startOfDay();
        $end   = min($today, Carbon::parse($term->end_date)->endOfDay());

        // Count weekdays from start to today (excluding non-teaching days)
        $nonTeachingDates = NonTeachingDay::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->pluck('date');

        $weekdaysCount = 0;
        $current = $start->copy();
        while ($current->lte($end)) {
            if ($current->isWeekday() && !$nonTeachingDates->contains($current->toDateString())) {
                $weekdaysCount++;
            }
            $current->addDay();
        }

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'first_name', 'last_name', 'student_number']);

        $studentData = $students->map(function ($student) use ($term, $weekdaysCount) {
            $presentCount = AttendanceRecord::where('student_id', $student->id)
                ->where('term_id', $term->id)
                ->whereIn('status', ['P', 'L'])
                ->count();

            $percentage = $weekdaysCount > 0
                ? round(($presentCount / $weekdaysCount) * 100, 1)
                : 0;

            return [
                'id'             => $student->id,
                'name'           => $student->first_name . ' ' . $student->last_name,
                'student_number' => $student->student_number,
                'attendance_pct' => $percentage,
            ];
        });

        return response()->json($studentData);
    }

    /**
     * Get weekly attendance grid for a term/class/stream.
     */
    public function getWeeks(Request $request)
    {
        $request->validate([
            'term_id'   => 'required|exists:terms,id',
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $term = Term::findOrFail($request->term_id);
        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'first_name', 'last_name', 'student_number']);

        $startDate = Carbon::parse($term->start_date)->startOfDay();
        $endDate   = Carbon::parse($term->end_date)->endOfDay();
        $today     = Carbon::today();

        // Build weeks (Mon‑Fri)
        $weeks = [];
        $current = $startDate->copy()->startOfWeek(Carbon::MONDAY);
        $weekNumber = 1;

        while ($current->lte($endDate)) {
            $weekDays = [];
            for ($i = 0; $i < 5; $i++) {
                $day = $current->copy()->addDays($i);
                if ($day->between($startDate, $endDate) && $day->isWeekday()) {
                    $weekDays[] = [
                        'date'     => $day->toDateString(),
                        'label'    => $day->format('D')[0],
                        'is_today' => $day->isSameDay($today),
                    ];
                }
            }

            if (!empty($weekDays)) {
                $weeks[] = [
                    'week_number' => $weekNumber,
                    'days'        => $weekDays,
                ];
                $weekNumber++;
            }

            $current->addWeek();
        }

        // Fetch existing attendance records
        $records = AttendanceRecord::where('term_id', $term->id)
            ->where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get()
            ->groupBy('student_id')
            ->map(fn($recs) => $recs->keyBy('date'));

        // Map students with their daily statuses
        $studentsData = $students->map(function ($student) use ($records) {
            $studentRecords = $records->get($student->id, collect());
            $dailyStatus = [];
            foreach ($studentRecords as $date => $record) {
                $dailyStatus[$date] = $record->status;
            }
            return [
                'id'             => $student->id,
                'name'           => $student->first_name . ' ' . $student->last_name,
                'student_number' => $student->student_number,
                'records'        => $dailyStatus,
            ];
        });

        // Get non-teaching days for this class/stream
        $nonTeachingDates = NonTeachingDay::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->pluck('date');

        return response()->json([
            'weeks'             => $weeks,
            'students'          => $studentsData,
            'non_teaching_days' => $nonTeachingDates,
        ]);
    }

    /**
     * Mark (create/update) a single attendance record.
     * Always stores the student's actual stream.
     */
    public function mark(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:students,id',
            'date'       => 'required|date',
            'status'     => 'required|in:P,L,A,S',
            'term_id'    => 'required|exists:terms,id',
            'class_id'   => 'required|exists:classes,id',
            'stream_id'  => 'nullable|exists:streams,id',
        ]);

        $user = $request->user();

        // Use the student's actual stream if none provided
        $streamId = $request->stream_id ?: null;
        if (empty($streamId)) {
            $student = Student::find($request->student_id);
            $streamId = $student ? $student->stream_id : null;
        }

        $record = AttendanceRecord::updateOrCreate(
            ['student_id' => $request->student_id, 'date' => $request->date],
            [
                'status'    => $request->status,
                'term_id'   => $request->term_id,
                'class_id'  => $request->class_id,
                'stream_id' => $streamId,
                'marked_by' => $user->id,
            ]
        );

        return response()->json($record);
    }

    /**
     * Get non-teaching days for a class/stream.
     */
    public function nonTeachingDays(Request $request)
    {
        $request->validate([
            'class_id'   => 'required|exists:classes,id',
            'stream_id'  => 'nullable|exists:streams,id',
            'start_date' => 'required|date',
            'end_date'   => 'required|date',
        ]);

        $days = NonTeachingDay::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereBetween('date', [$request->start_date, $request->end_date])
            ->pluck('date');

        return response()->json($days);
    }

    /**
     * Toggle a non-teaching day (add/remove).
     */
    public function toggleNonTeachingDay(Request $request)
    {
        $request->validate([
            'date'      => 'required|date',
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'reason'    => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $data = [
            'date'      => $request->date,
            'class_id'  => $request->class_id,
            'stream_id' => $request->stream_id,
        ];

        $existing = NonTeachingDay::where($data)->first();

        if ($existing) {
            $existing->delete();
            return response()->json(['status' => 'removed']);
        } else {
            NonTeachingDay::create($data + [
                'added_by' => $user->id,
                'reason'   => $request->reason,
            ]);
            return response()->json(['status' => 'added']);
        }
    }
}