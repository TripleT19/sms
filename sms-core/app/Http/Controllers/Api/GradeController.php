<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\ClassStream;
use App\Models\Grade;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\TeacherSubjectAssignment;
use App\Models\StudentComment;
use App\Models\AttendanceRecord;
use App\Models\Stream;
use App\Models\Notification;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class GradeController extends Controller
{
    /**
     * Grading scale helper.
     */
    private function calculateGradeAndRemarks($score)
    {
        if ($score >= 80 && $score <= 100) {
            return ['grade' => 'A', 'remarks' => 'Excellent'];
        } elseif ($score >= 70 && $score <= 79) {
            return ['grade' => 'B', 'remarks' => 'Very Good'];
        } elseif ($score >= 55 && $score <= 69) {
            return ['grade' => 'C', 'remarks' => 'Good'];
        } elseif ($score >= 40 && $score <= 54) {
            return ['grade' => 'D', 'remarks' => 'Average'];
        } else { // 0–39
            return ['grade' => 'N', 'remarks' => 'Need Support'];
        }
    }

    /**
     * Get the subjects the teacher is allowed to grade for a given class.
     */
    public function allowedSubjects(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $user = $request->user();
        $class = ClassRoom::with('subjects:id,name')->find($request->class_id);

        // Admin sees everything
        if ($user->roles()->where('name', 'Admin')->exists()) {
            return response()->json($class->subjects);
        }

        // Direct class teacher
        if ($user->taughtClasses()->where('classes.id', $request->class_id)->exists()) {
            return response()->json($class->subjects);
        }

        // Stream teacher (assigned via class_stream_teacher pivot)
        $isStreamTeacher = ClassStream::where('class_id', $request->class_id)
            ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
            ->exists();
        if ($isStreamTeacher) {
            return response()->json($class->subjects);
        }

        // Teacher with any subject assignment for this class
        $hasSubjectAssignment = TeacherSubjectAssignment::where('user_id', $user->id)
            ->where('class_id', $request->class_id)
            ->exists();
        if ($hasSubjectAssignment) {
            return response()->json($class->subjects);
        }

        return response()->json([]);
    }

    /**
     * Get students with their grades, positions, and computed grade/remarks.
     */
    public function index(Request $request)
    {
        $request->validate([
            'class_id'   => 'required|exists:classes,id',
            'stream_id'  => 'nullable|exists:streams,id',
            'subject_id' => 'required|exists:subjects,id',
            'term_id'    => 'required|exists:terms,id',
        ]);

        $user = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();

        $studentsQuery = Student::where('class_id', $request->class_id);

        if ($request->stream_id) {
            $studentsQuery->where('stream_id', $request->stream_id);
        } elseif (!$isAdmin) {
            $allowedStreamIds = $this->getTeacherStreamIdsForSubject($user, $request->class_id, $request->subject_id);

            if ($allowedStreamIds->isNotEmpty()) {
                $studentsQuery->whereIn('stream_id', $allowedStreamIds);
            } else {
                return response()->json([]);
            }
        }

        $students = $studentsQuery->get(['id', 'first_name', 'last_name', 'student_number']);

        $grades = Grade::where('subject_id', $request->subject_id)
            ->where('term_id', $request->term_id)
            ->whereIn('student_id', $students->pluck('id'))
            ->get()
            ->keyBy('student_id');

        $data = $students->map(function ($student) use ($grades) {
            $grade = $grades->get($student->id);
            return [
                'student_id'    => $student->id,
                'name'          => $student->first_name . ' ' . $student->last_name,
                'student_number'=> $student->student_number,
                'score'         => $grade->score ?? null,
                'out_of'        => $grade->out_of ?? 100,
                'grade'         => $grade->grade ?? null,
                'remarks'       => $grade->remarks ?? null,
            ];
        })->values();

        $sorted = $data->sort(function ($a, $b) {
            if ($a['score'] === $b['score']) {
                return strcmp($a['name'], $b['name']);
            }
            if (is_null($a['score']) && is_null($b['score'])) return 0;
            if (is_null($a['score'])) return 1;
            if (is_null($b['score'])) return -1;
            return $b['score'] <=> $a['score'];
        })->values();

        $rank = 1;
        $prevScore = null;
        $sorted->transform(function ($item, $key) use (&$rank, &$prevScore) {
            if (is_null($item['score'])) {
                $item['position'] = null;
                return $item;
            }
            if ($prevScore !== null && $item['score'] < $prevScore) {
                $rank = $key + 1;
            }
            $item['position'] = $rank;
            $prevScore = $item['score'];
            return $item;
        });

        return response()->json($sorted);
    }

    /**
     * Save or update grades – compute grade/remarks automatically.
     */
    public function store(Request $request)
    {
        $request->validate([
            'class_id'   => 'required|exists:classes,id',
            'stream_id'  => 'nullable|exists:streams,id',
            'subject_id' => 'required|exists:subjects,id',
            'term_id'    => 'required|exists:terms,id',
            'grades'     => 'required|array',
            'grades.*.student_id' => 'required|exists:students,id',
            'grades.*.score'      => 'nullable|numeric|min:0|max:100',
        ]);

        $submittedCount = StudentComment::where('class_id', $request->class_id)
            ->where('term_id', $request->term_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereNotNull('submitted_at')
            ->count();

        $totalStudents = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->count();

        if ($totalStudents > 0 && $submittedCount === $totalStudents) {
            return response()->json(['message' => 'Grades are locked because the report has been submitted.'], 423);
        }

        $user = $request->user();
        $saved = 0;

        foreach ($request->grades as $gradeData) {
            $score = $gradeData['score'];

            if (is_null($score)) {
                Grade::where([
                    'student_id' => $gradeData['student_id'],
                    'subject_id' => $request->subject_id,
                    'term_id'    => $request->term_id,
                ])->delete();
                continue;
            }

            $computed = $this->calculateGradeAndRemarks($score);

            Grade::updateOrCreate(
                [
                    'student_id' => $gradeData['student_id'],
                    'subject_id' => $request->subject_id,
                    'term_id'    => $request->term_id,
                ],
                [
                    'class_id'   => $request->class_id,
                    'stream_id'  => $request->stream_id,
                    'score'      => $score,
                    'grade'      => $computed['grade'],
                    'remarks'    => $computed['remarks'],
                    'out_of'     => 100,
                    'entered_by' => $user->id,
                ]
            );
            $saved++;
        }

        return response()->json(['message' => "{$saved} grade(s) saved."]);
    }

    /**
     * Download grades as CSV.
     */
    public function download(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'first_name', 'last_name', 'student_number']);

        $subjects = Subject::whereHas('classes', fn($q) => $q->where('classes.id', $request->class_id))
            ->orderBy('name')
            ->get();

        $grades = Grade::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->get()
            ->groupBy('student_id');

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="grades.csv"',
        ];

        $columns = ['Student Number', 'Student Name'];
        foreach ($subjects as $subject) {
            $columns[] = $subject->name . ' Score';
            $columns[] = $subject->name . ' Grade';
        }

        $callback = function () use ($students, $subjects, $grades, $columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);

            foreach ($students as $student) {
                $row = [
                    $student->student_number,
                    $student->first_name . ' ' . $student->last_name,
                ];
                $studentGrades = $grades->get($student->id, collect());

                foreach ($subjects as $subject) {
                    $grade = $studentGrades->firstWhere('subject_id', $subject->id);
                    $row[] = $grade->score ?? '';
                    $row[] = $grade->grade ?? '';
                }
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Upload grades from CSV.
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file'      => 'required|file|mimes:csv,txt',
            'term_id'   => 'required|exists:terms,id',
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($handle);

        $subjects = Subject::whereHas('classes', fn($q) => $q->where('classes.id', $request->class_id))
            ->orderBy('name')
            ->get();

        $subjectMap = [];
        foreach ($header as $index => $col) {
            if (str_ends_with($col, ' Score')) {
                $subjectName = substr($col, 0, -6);
                $subject = $subjects->firstWhere('name', $subjectName);
                if ($subject) {
                    $subjectMap[$index] = ['subject_id' => $subject->id, 'type' => 'score'];
                }
            }
        }

        $imported = 0;
        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 2) continue;
            $studentNumber = $row[0];
            $student = Student::where('student_number', $studentNumber)->first();
            if (!$student) continue;

            foreach ($subjectMap as $colIndex => $info) {
                $score = $row[$colIndex] ?? null;
                if (is_numeric($score)) {
                    $computed = $this->calculateGradeAndRemarks($score);
                    Grade::updateOrCreate(
                        [
                            'student_id' => $student->id,
                            'subject_id' => $info['subject_id'],
                            'term_id'    => $request->term_id,
                        ],
                        [
                            'class_id'   => $request->class_id,
                            'stream_id'  => $request->stream_id,
                            'score'      => $score,
                            'grade'      => $computed['grade'],
                            'remarks'    => $computed['remarks'],
                            'out_of'     => 100,
                            'entered_by' => $request->user()->id,
                        ]
                    );
                    $imported++;
                }
            }
        }
        fclose($handle);

        return response()->json(['message' => "{$imported} grades imported."]);
    }

    /**
     * Get the teacher's classes/streams for the filter dropdown.
     */
    public function teacherClasses(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();

        if ($isAdmin) {
            $classes = ClassRoom::with('streams:id,name')->get()->map(function ($class) {
                return [
                    'id'      => $class->id,
                    'name'    => $class->name,
                    'streams' => $class->streams->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
                ];
            });
            return response()->json($classes);
        }

        $directClassIds = $user->taughtClasses()->pluck('classes.id');
        $subjectClassIds = TeacherSubjectAssignment::where('user_id', $user->id)->pluck('class_id');
        $streamClassIds = ClassStream::whereHas('teachers', fn($q) => $q->where('users.id', $user->id))->pluck('class_id');

        $allClassIds = $directClassIds->merge($subjectClassIds)->merge($streamClassIds)->unique()->values();
        $classes = ClassRoom::whereIn('id', $allClassIds)->get(['id', 'name']);

        $result = $classes->map(function ($class) use ($user) {
            $streamIds = collect();

            $directStreamIds = ClassStream::where('class_id', $class->id)
                ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
                ->pluck('stream_id');
            $streamIds = $streamIds->merge($directStreamIds);

            $subjectStreamIds = TeacherSubjectAssignment::where('user_id', $user->id)
                ->where('class_id', $class->id)
                ->whereNotNull('stream_id')
                ->pluck('stream_id');
            $streamIds = $streamIds->merge($subjectStreamIds)->unique()->values();

            $hasNullStreamAssignment = TeacherSubjectAssignment::where('user_id', $user->id)
                ->where('class_id', $class->id)
                ->whereNull('stream_id')
                ->exists();

            if ($hasNullStreamAssignment) {
                $streams = Stream::whereHas('classes', fn($q) => $q->where('classes.id', $class->id))->get(['id', 'name']);
            } else {
                $streams = Stream::whereIn('id', $streamIds)->get(['id', 'name']);
            }

            return [
                'id'      => $class->id,
                'name'    => $class->name,
                'streams' => $streams->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
            ];
        });

        return response()->json($result);
    }

    // -------------------------------------------------
    // COMMENTS & SUBMISSION
    // -------------------------------------------------

    public function comments(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $user = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();

        $studentsQuery = Student::where('class_id', $request->class_id);

        if ($request->stream_id) {
            // Explicit stream selected – respect it
            $studentsQuery->where('stream_id', $request->stream_id);
        } elseif (!$isAdmin) {
            // Auto‑filter by teacher’s assigned streams (ONLY class_stream_teacher pivot)
            $allowedStreamIds = $this->getTeacherStreamIdsForClass($user, $request->class_id);

            if ($allowedStreamIds->isNotEmpty()) {
                $studentsQuery->whereIn('stream_id', $allowedStreamIds);
            } else {
                // No streams assigned – return empty list
                return response()->json([]);
            }
        }

        $students = $studentsQuery->get(['id', 'first_name', 'last_name', 'student_number', 'gender']);

        $grades = Grade::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->get()
            ->groupBy('student_id');

        $term = Term::find($request->term_id);
        $start = Carbon::parse($term->start_date)->startOfDay();
        $end = min(now()->endOfDay(), Carbon::parse($term->end_date)->endOfDay());
        $weekdays = 0;
        $current = $start->copy();
        while ($current->lte($end)) {
            if ($current->isWeekday()) $weekdays++;
            $current->addDay();
        }

        $attendance = AttendanceRecord::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->whereIn('status', ['P', 'L'])
            ->get()
            ->groupBy('student_id');

        $existingComments = StudentComment::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->get()
            ->keyBy('student_id');

        $data = $students->map(function ($student) use ($grades, $attendance, $weekdays, $existingComments) {
            $studentGrades = $grades->get($student->id, collect());
            $avgScore = $studentGrades->avg('score');
            $presentDays = $attendance->get($student->id, collect())->count();
            $attendancePct = $weekdays > 0 ? round(($presentDays / $weekdays) * 100, 1) : 0;

            $comment = $existingComments->get($student->id);
            return [
                'student_id'       => $student->id,
                'first_name'       => $student->first_name,
                'last_name'        => $student->last_name,
                'name'             => $student->first_name . ' ' . $student->last_name,
                'student_number'   => $student->student_number,
                'gender'           => $student->gender,
                'average_score'    => $avgScore ? round($avgScore, 1) : null,
                'attendance_pct'   => $attendancePct,
                'comment'          => $comment->comment ?? '',
                'include_attendance' => $comment->include_attendance ?? false,
                'submitted'        => $comment && $comment->submitted_at ? true : false,
                'published'        => $comment && $comment->published_at ? true : false,
            ];
        });

        return response()->json($data);
    }

    public function saveComment(Request $request)
    {
        $request->validate([
            'student_id'        => 'required|exists:students,id',
            'term_id'           => 'required|exists:terms,id',
            'class_id'          => 'required|exists:classes,id',
            'stream_id'         => 'nullable|exists:streams,id',
            'comment'           => 'nullable|string',
            'include_attendance'=> 'boolean',
        ]);

        $existing = StudentComment::where('student_id', $request->student_id)
            ->where('term_id', $request->term_id)
            ->first();

        if ($existing && $existing->submitted_at) {
            return response()->json(['message' => 'Comment already submitted and cannot be edited.'], 422);
        }

        $comment = StudentComment::updateOrCreate(
            [
                'student_id' => $request->student_id,
                'term_id'    => $request->term_id,
            ],
            [
                'class_id'   => $request->class_id,
                'stream_id'  => $request->stream_id,
                'comment'    => $request->comment,
                'include_attendance' => $request->include_attendance ?? false,
                'entered_by' => $request->user()->id,
            ]
        );

        return response()->json($comment);
    }

    public function saveAllComments(Request $request)
    {
        $request->validate([
            'comments' => 'required|array',
            'comments.*.student_id' => 'required|exists:students,id',
            'comments.*.comment'   => 'nullable|string',
            'comments.*.include_attendance' => 'boolean',
            'term_id'   => 'required|exists:terms,id',
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $saved = 0;
        foreach ($request->comments as $data) {
            $existing = StudentComment::where('student_id', $data['student_id'])
                ->where('term_id', $request->term_id)
                ->first();
            if ($existing && $existing->submitted_at) continue;

            StudentComment::updateOrCreate(
                [
                    'student_id' => $data['student_id'],
                    'term_id'    => $request->term_id,
                ],
                [
                    'class_id'   => $request->class_id,
                    'stream_id'  => $request->stream_id,
                    'comment'    => $data['comment'],
                    'include_attendance' => $data['include_attendance'] ?? false,
                    'entered_by' => $request->user()->id,
                ]
            );
            $saved++;
        }

        return response()->json(['message' => "{$saved} comment(s) saved."]);
    }

    public function submitComments(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        // Mark comments as submitted
        StudentComment::where('class_id', $request->class_id)
            ->where('term_id', $request->term_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereNull('submitted_at')
            ->update(['submitted_at' => now()]);

        // ---------- Notify all Admins ----------
        $adminRole = Role::where('name', 'Admin')->first();
        if ($adminRole) {
            $adminIds = User::whereHas('roles', fn($q) => $q->where('roles.id', $adminRole->id))->pluck('id');

            if ($adminIds->isNotEmpty()) {
                $class = ClassRoom::find($request->class_id);
                $term  = Term::find($request->term_id);
                $teacherName = $request->user()->first_name . ' ' . $request->user()->last_name;

                $message = "Grades submitted for {$class->name}";
                if ($request->stream_id) {
                    $stream = Stream::find($request->stream_id);
                    $message .= " ({$stream->name})";
                }
                $message .= " - {$term->name} by {$teacherName}";

                $insertData = [];
                $now = now();
                foreach ($adminIds as $uid) {
                    $insertData[] = [
                        'user_id'    => $uid,
                        'type'       => 'submission',
                        'message'    => $message,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                Notification::insert($insertData);
            }
        }

        return response()->json(['message' => 'Comments submitted to admin.']);
    }

    public function publishComments(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        StudentComment::where('class_id', $request->class_id)
            ->where('term_id', $request->term_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereNotNull('submitted_at')
            ->whereNull('published_at')
            ->update(['published_at' => now()]);

        return response()->json(['message' => 'Comments published.']);
    }

    public function gradingStatus(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $class = ClassRoom::with('subjects:id,name')->find($request->class_id);
        $subjects = $class->subjects;

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->pluck('id');

        $gradedSubjects = Grade::where('term_id', $request->term_id)
            ->whereIn('student_id', $students)
            ->whereNotNull('score')
            ->distinct('subject_id')
            ->pluck('subject_id');

        $allGraded = $subjects->every(fn($subject) => $gradedSubjects->contains($subject->id));

        return response()->json([
            'all_graded'      => $allGraded,
            'total_subjects'  => $subjects->count(),
            'graded_subjects' => $gradedSubjects->count(),
        ]);
    }

    public function submissionStatus(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $submittedCount = StudentComment::where('class_id', $request->class_id)
            ->where('term_id', $request->term_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereNotNull('submitted_at')
            ->count();

        $totalStudents = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->count();

        $allSubmitted = $totalStudents > 0 && $submittedCount === $totalStudents;

        return response()->json(['all_submitted' => $allSubmitted]);
    }

    // -------------------------------------------------
    // PRIVATE HELPERS
    // -------------------------------------------------

    /**
     * Stream IDs the teacher is allowed to see for a specific subject.
     */
    private function getTeacherStreamIdsForSubject($user, $classId, $subjectId): \Illuminate\Support\Collection
    {
        $streamIds = collect();

        $streamIds = $streamIds->merge(
            ClassStream::where('class_id', $classId)
                ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
                ->pluck('stream_id')
        );

        $subjectStreamIds = TeacherSubjectAssignment::where('user_id', $user->id)
            ->where('class_id', $classId)
            ->where('subject_id', $subjectId)
            ->whereNotNull('stream_id')
            ->pluck('stream_id');

        $streamIds = $streamIds->merge($subjectStreamIds)->unique()->values();

        return $streamIds;
    }

    /**
     * Stream IDs the teacher is allowed to see for a class (for comments).
     * ONLY streams where the teacher is explicitly assigned as a stream teacher.
     */
    private function getTeacherStreamIdsForClass($user, $classId): \Illuminate\Support\Collection
    {
        return ClassStream::where('class_id', $classId)
            ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
            ->pluck('stream_id')
            ->unique()
            ->values();
    }
}