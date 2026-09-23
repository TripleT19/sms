<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\ClassStream;
use App\Models\Competency;
use App\Models\Grade;
use App\Models\Skill;
use App\Models\Student;
use App\Models\StudentSkillAssessment;
use App\Models\Subject;
use App\Models\Term;
use App\Models\TeacherSubjectAssignment;
use App\Models\StudentComment;
use App\Models\AttendanceRecord;
use App\Models\Stream;
use App\Models\Guardian;
use App\Models\Notification;
use App\Models\Role;
use App\Models\User;
use App\Models\PublishedReport;
use App\Models\StudentFee;
use App\Traits\LogsActivity;
use App\Notifications\ResultsPublished;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GradeController extends Controller
{
    use LogsActivity;

    // -------------------------------------------------
    // GRADING SCALE
    // -------------------------------------------------
    private function calculateGradeAndRemarks($score)
    {
        if ($score >= 80 && $score <= 100) return ['grade' => 'A', 'remarks' => 'Excellent'];
        if ($score >= 70 && $score <= 79)  return ['grade' => 'B', 'remarks' => 'Very Good'];
        if ($score >= 55 && $score <= 69)  return ['grade' => 'C', 'remarks' => 'Good'];
        if ($score >= 40 && $score <= 54)  return ['grade' => 'D', 'remarks' => 'Average'];
        return ['grade' => 'N', 'remarks' => 'Need Support'];
    }

    // -------------------------------------------------
    // ALLOWED SUBJECTS
    // -------------------------------------------------
    public function allowedSubjects(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $user  = $request->user();
        $class = ClassRoom::with('subjects:id,name')->find($request->class_id);

        if ($user->roles()->where('name', 'Admin')->exists()) return response()->json($class->subjects);
        if ($user->taughtClasses()->where('classes.id', $request->class_id)->exists()) return response()->json($class->subjects);

        $isStreamTeacher = ClassStream::where('class_id', $request->class_id)
            ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
            ->exists();
        if ($isStreamTeacher) return response()->json($class->subjects);

        $hasSubjectAssignment = TeacherSubjectAssignment::where('user_id', $user->id)
            ->where('class_id', $request->class_id)
            ->exists();
        if ($hasSubjectAssignment) return response()->json($class->subjects);

        return response()->json([]);
    }

    // -------------------------------------------------
    // INDEX (student list with numeric grades)
    // -------------------------------------------------
    public function index(Request $request)
    {
        $request->validate([
            'class_id'        => 'required|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'subject_id'      => 'required|exists:subjects,id',
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'nullable|in:mid_term,end_term',
        ]);

        $user    = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();
        $assessmentType = $request->assessment_type ?? 'end_term';

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
            ->where('class_id', $request->class_id)
            ->where('assessment_type', $assessmentType)
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
            if ($a['score'] === $b['score']) return strcmp($a['name'], $b['name']);
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

    // -------------------------------------------------
    // SKILL INDEX (for skill‑based classes – no subject needed)
    // -------------------------------------------------
    public function skillIndex(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'term_id'   => 'required|exists:terms,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $class = ClassRoom::findOrFail($request->class_id);
        if ($class->grading_type !== 'skill') {
            return response()->json(['message' => 'Not a skill‑based class'], 400);
        }

        $studentsQuery = Student::where('class_id', $request->class_id);
        if ($request->stream_id) {
            $studentsQuery->where('stream_id', $request->stream_id);
        }
        $students = $studentsQuery->get(['id', 'first_name', 'last_name', 'student_number']);

        // Load ALL competencies (global + every subject)
        $competencies = Competency::with('skills')->orderBy('name')->get();

        // Existing assessments
        $studentIds = $students->pluck('id');
        $assessments = StudentSkillAssessment::whereIn('student_id', $studentIds)
            ->where('term_id', $request->term_id)
            ->get()
            ->groupBy('student_id');

        $data = $students->map(function ($student) use ($competencies, $assessments) {
            $studentAssessments = $assessments->get($student->id, collect())->keyBy('skill_id');

            $competenciesData = $competencies->map(function ($comp) use ($studentAssessments) {
                $skillsData = $comp->skills->map(function ($skill) use ($studentAssessments) {
                    $assess = $studentAssessments->get($skill->id);
                    return [
                        'skill_id'    => $skill->id,
                        'name'        => $skill->name,
                        'description' => $skill->description,
                        'rating'      => $assess->rating ?? null,
                        'comment'     => $assess->areas_for_improvement ?? null,
                    ];
                });
                return [
                    'competency_id'   => $comp->id,
                    'competency_name' => $comp->name,
                    'skills'          => $skillsData->values(),
                ];
            });

            return [
                'student_id'    => $student->id,
                'name'          => $student->first_name . ' ' . $student->last_name,
                'student_number'=> $student->student_number,
                'competencies'  => $competenciesData->values(),
            ];
        });

        return response()->json($data);
    }

    // -------------------------------------------------
    // SAVE NUMERIC GRADES
    // -------------------------------------------------
    public function store(Request $request)
    {
        Log::info('Grade store request received', [
            'class_id'        => $request->class_id,
            'subject_id'      => $request->subject_id,
            'term_id'         => $request->term_id,
            'assessment_type' => $request->assessment_type,
            'grades_count'    => count($request->grades ?? []),
        ]);

        $validated = $request->validate([
            'class_id'        => 'required|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'subject_id'      => 'required|exists:subjects,id',
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'nullable|in:mid_term,end_term',
            'grades'          => 'required|array',
            'grades.*.student_id' => 'required|exists:students,id',
            'grades.*.score'      => 'nullable|numeric|min:0|max:100',
        ]);

        $assessmentType = $request->assessment_type ?? 'end_term';

        // Determine which submission timestamp column to check
        $timestampColumn = $assessmentType === 'mid_term' ? 'submitted_mid_term_at' : 'submitted_end_term_at';

        // Lock check per assessment type
        $submittedCount = StudentComment::where('class_id', $request->class_id)
            ->where('term_id', $request->term_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereNotNull($timestampColumn)
            ->count();

        $totalStudents = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->count();

        if ($totalStudents > 0 && $submittedCount === $totalStudents) {
            return response()->json(['message' => 'Grades are locked because this assessment type has been submitted.'], 423);
        }

        $user  = $request->user();
        $saved = 0;

        foreach ($request->grades as $gradeData) {
            $score = $gradeData['score'] !== null ? (int) round($gradeData['score']) : null;

            if (is_null($score)) {
                Grade::where([
                    'student_id'      => $gradeData['student_id'],
                    'subject_id'      => $request->subject_id,
                    'term_id'         => $request->term_id,
                    'assessment_type' => $assessmentType,
                ])->delete();
                continue;
            }

            $computed = $this->calculateGradeAndRemarks($score);
            Grade::updateOrCreate(
                [
                    'student_id'      => $gradeData['student_id'],
                    'subject_id'      => $request->subject_id,
                    'term_id'         => $request->term_id,
                    'assessment_type' => $assessmentType,
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

    // -------------------------------------------------
    // SAVE SKILL ASSESSMENTS
    // -------------------------------------------------
    public function saveSkillAssessments(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
            'assessments' => 'required|array',
            'assessments.*.student_id' => 'required|exists:students,id',
            'assessments.*.skill_id'   => 'required|exists:skills,id',
            'assessments.*.rating'     => 'nullable|in:EE,A,D,B',
            'assessments.*.comment'    => 'nullable|string|max:500',
        ]);

        $class = ClassRoom::findOrFail($request->class_id);
        if ($class->grading_type !== 'skill') {
            return response()->json(['message' => 'Not a skill‑based class'], 400);
        }

        $user  = $request->user();
        $saved = 0;

        foreach ($request->assessments as $data) {
            $rating  = $data['rating'] ?? null;
            $comment = $data['comment'] ?? '';

            if (is_null($rating) && empty($comment)) {
                StudentSkillAssessment::where([
                    'student_id' => $data['student_id'],
                    'term_id'    => $request->term_id,
                    'skill_id'   => $data['skill_id'],
                ])->delete();
                continue;
            }

            $achievementsText = $rating ? "Rating: $rating" : '';
            if ($comment) {
                $achievementsText .= ($achievementsText ? ' - ' : '') . $comment;
            }

            $skill = Skill::find($data['skill_id']);
            StudentSkillAssessment::updateOrCreate(
                [
                    'student_id' => $data['student_id'],
                    'term_id'    => $request->term_id,
                    'skill_id'   => $data['skill_id'],
                ],
                [
                    'subject_id'   => null,
                    'competency_id' => $skill->competency_id ?? null,
                    'class_id'      => $request->class_id,
                    'stream_id'     => $request->stream_id,
                    'rating'        => $rating,
                    'achievements'  => $achievementsText,
                    'areas_for_improvement' => $comment ?: null,
                    'entered_by'    => $user->id,
                ]
            );
            $saved++;
        }

        return response()->json(['message' => "{$saved} skill assessment(s) saved."]);
    }

    // -------------------------------------------------
    // DOWNLOAD
    // -------------------------------------------------
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
            ->orderBy('name')->get();

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
                $row = [$student->student_number, $student->first_name . ' ' . $student->last_name];
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

    // -------------------------------------------------
    // UPLOAD
    // -------------------------------------------------
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
            ->orderBy('name')->get();

        $subjectMap = [];
        foreach ($header as $index => $col) {
            if (str_ends_with($col, ' Score')) {
                $subjectName = substr($col, 0, -6);
                $subject = $subjects->firstWhere('name', $subjectName);
                if ($subject) $subjectMap[$index] = ['subject_id' => $subject->id, 'type' => 'score'];
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
                        ['student_id' => $student->id, 'subject_id' => $info['subject_id'], 'term_id' => $request->term_id],
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

    // -------------------------------------------------
    // TEACHER CLASSES (includes grading_type)
    // -------------------------------------------------
    public function teacherClasses(Request $request)
    {
        $user    = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();

        if ($isAdmin) {
            $classes = ClassRoom::with('streams:id,name')->get()->map(fn($class) => [
                'id'           => $class->id,
                'name'         => $class->name,
                'grading_type' => $class->grading_type,
                'streams'      => $class->streams->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
            ]);
            return response()->json($classes);
        }

        $directClassIds   = $user->taughtClasses()->pluck('classes.id');
        $subjectClassIds  = TeacherSubjectAssignment::where('user_id', $user->id)->pluck('class_id');
        $streamClassIds   = ClassStream::whereHas('teachers', fn($q) => $q->where('users.id', $user->id))->pluck('class_id');

        $allClassIds = $directClassIds->merge($subjectClassIds)->merge($streamClassIds)->unique()->values();
        $classes = ClassRoom::whereIn('id', $allClassIds)->get(['id', 'name', 'grading_type']);

        $result = $classes->map(function ($class) use ($user) {
            $streamIds = collect();
            $directStreamIds = ClassStream::where('class_id', $class->id)
                ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
                ->pluck('stream_id');
            $streamIds = $streamIds->merge($directStreamIds);

            $subjectStreamIds = TeacherSubjectAssignment::where('user_id', $user->id)
                ->where('class_id', $class->id)->whereNotNull('stream_id')->pluck('stream_id');
            $streamIds = $streamIds->merge($subjectStreamIds)->unique()->values();

            $hasNullStreamAssignment = TeacherSubjectAssignment::where('user_id', $user->id)
                ->where('class_id', $class->id)->whereNull('stream_id')->exists();

            $streams = $hasNullStreamAssignment
                ? Stream::whereHas('classes', fn($q) => $q->where('classes.id', $class->id))->get(['id', 'name'])
                : Stream::whereIn('id', $streamIds)->get(['id', 'name']);

            return [
                'id'           => $class->id,
                'name'         => $class->name,
                'grading_type' => $class->grading_type,
                'streams'      => $streams->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
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
            'class_id'        => 'required|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'nullable|in:mid_term,end_term',
        ]);

        $user    = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();
        $assessmentType = $request->assessment_type ?? 'end_term';

        $studentsQuery = Student::where('class_id', $request->class_id);

        if ($request->stream_id) {
            $studentsQuery->where('stream_id', $request->stream_id);
        } elseif (!$isAdmin) {
            $allowedStreamIds = $this->getTeacherStreamIdsForClass($user, $request->class_id);
            if ($allowedStreamIds->isNotEmpty()) {
                $studentsQuery->whereIn('stream_id', $allowedStreamIds);
            } else {
                return response()->json([]);
            }
        }

        $students = $studentsQuery->get(['id', 'first_name', 'last_name', 'student_number', 'gender']);

        // Grades for the requested assessment type
        $grades = Grade::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->where('class_id', $request->class_id)
            ->where('assessment_type', $assessmentType)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get()
            ->groupBy('student_id');

        $term      = Term::find($request->term_id);
        $start     = Carbon::parse($term->start_date)->startOfDay();
        $end       = min(now()->endOfDay(), Carbon::parse($term->end_date)->endOfDay());
        $weekdays  = 0;
        $current   = $start->copy();
        while ($current->lte($end)) {
            if ($current->isWeekday()) $weekdays++;
            $current->addDay();
        }

        $attendance = AttendanceRecord::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereIn('status', ['P', 'L'])
            ->get()
            ->groupBy('student_id');

        $existingComments = StudentComment::whereIn('student_id', $students->pluck('id'))
            ->where('term_id', $request->term_id)
            ->where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get()
            ->keyBy('student_id');

        $timestampColumn = $assessmentType === 'mid_term' ? 'submitted_mid_term_at' : 'submitted_end_term_at';

        $data = $students->map(function ($student) use ($grades, $attendance, $weekdays, $existingComments, $timestampColumn) {
            $studentGrades = $grades->get($student->id, collect());
            $avgScore      = $studentGrades->avg('score');
            $presentDays   = $attendance->get($student->id, collect())->count();
            $attendancePct = $weekdays > 0 ? round(($presentDays / $weekdays) * 100, 1) : 0;

            $comment = $existingComments->get($student->id);
            $isSubmitted = $comment && $comment->{$timestampColumn} ? true : false;

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
                'submitted'        => $isSubmitted,
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
            ->where('term_id', $request->term_id)->first();
        if ($existing && $existing->submitted_at) {
            return response()->json(['message' => 'Comment already submitted and cannot be edited.'], 422);
        }

        $comment = StudentComment::updateOrCreate(
            ['student_id' => $request->student_id, 'term_id' => $request->term_id],
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
        $validated = $request->validate([
            'comments'                     => 'required|array',
            'comments.*.student_id'        => 'required|exists:students,id',
            'comments.*.comment'           => 'nullable|string',
            'comments.*.include_attendance'=> 'boolean',
            'term_id'   => 'required|exists:terms,id',
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        if (isset($validated['stream_id']) && $validated['stream_id'] === '') {
            $validated['stream_id'] = null;
        }

        $saved = 0;
        foreach ($validated['comments'] as $data) {
            $existing = StudentComment::where('student_id', $data['student_id'])
                ->where('term_id', $validated['term_id'])
                ->first();
            if ($existing && $existing->submitted_at) continue;

            $comment = StudentComment::firstOrNew([
                'student_id' => $data['student_id'],
                'term_id'    => $validated['term_id'],
            ]);

            $comment->forceFill([
                'class_id'           => $validated['class_id'],
                'stream_id'          => $validated['stream_id'],
                'comment'            => $data['comment'] ?? '',
                'include_attendance' => $data['include_attendance'] ?? false,
                'entered_by'         => $request->user()->id,
            ]);
            $comment->save();

            $saved++;
        }

        return response()->json(['message' => "{$saved} comment(s) saved."]);
    }

    /**
     * Submit comments for a specific assessment type.
     */
    public function submitComments(Request $request)
    {
        $request->validate([
            'class_id'        => 'required|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'required|in:mid_term,end_term',
        ]);

        $class = ClassRoom::findOrFail($request->class_id);
        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'stream_id']);

        $assessmentType = $request->assessment_type;
        $timestampColumn = $assessmentType === 'mid_term' ? 'submitted_mid_term_at' : 'submitted_end_term_at';

        // Prevent mid‑term submission if end‑term is already submitted
        if ($assessmentType === 'mid_term') {
            $endTermSubmitted = StudentComment::where('class_id', $request->class_id)
                ->where('term_id', $request->term_id)
                ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
                ->whereNotNull('submitted_end_term_at')
                ->exists();
            if ($endTermSubmitted) {
                return response()->json(['message' => 'Mid‑term cannot be submitted after end‑term has been submitted.'], 422);
            }
        }

        foreach ($students as $student) {
            StudentComment::updateOrCreate(
                ['student_id' => $student->id, 'term_id' => $request->term_id],
                [
                    'class_id'   => $request->class_id,
                    'stream_id'  => $student->stream_id,   // always store the student's actual stream
                    $timestampColumn => now(),
                    'entered_by' => $request->user()->id,
                ]
            );
        }

        // Notify admins (unchanged)
        $adminRole = Role::where('name', 'Admin')->first();
        if ($adminRole) {
            $adminIds = User::whereHas('roles', fn($q) => $q->where('roles.id', $adminRole->id))->pluck('id');
            if ($adminIds->isNotEmpty()) {
                $teacherName = $request->user()->first_name . ' ' . $request->user()->last_name;
                $message = "Grades submitted for {$class->name}";
                if ($request->stream_id) {
                    $message .= " (" . Stream::find($request->stream_id)->name . ")";
                }
                $message .= " - " . Term::find($request->term_id)->name . " by {$teacherName}";
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

    /**
     * Check if all students have submitted for a given assessment type.
     */
    public function submissionStatus(Request $request)
    {
        $request->validate([
            'class_id'        => 'required|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'required|in:mid_term,end_term',
        ]);

        $timestampColumn = $request->assessment_type === 'mid_term' ? 'submitted_mid_term_at' : 'submitted_end_term_at';

        $totalStudents = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->count();

        $submittedCount = StudentComment::where('class_id', $request->class_id)
            ->where('term_id', $request->term_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->whereNotNull($timestampColumn)
            ->count();

        return response()->json(['all_submitted' => $totalStudents > 0 && $submittedCount === $totalStudents]);
    }

    // -------------------------------------------------
    // PUBLISH & PROMOTE (includes snapshots for both types)
    // -------------------------------------------------
    public function publishComments(Request $request)
    {
        $request->validate([
            'class_id'        => 'required|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'nullable|in:mid_term,end_term',
        ]);

        $assessmentType = $request->assessment_type ?? 'end_term';
        $classId        = $request->class_id;
        $streamId       = $request->stream_id;
        $termId         = $request->term_id;

        // Mark comments as published
        StudentComment::where('class_id', $classId)
            ->where('term_id', $termId)
            ->when($streamId, fn($q) => $q->where('stream_id', $streamId))
            ->whereNotNull('submitted_at')
            ->whereNull('published_at')
            ->update(['published_at' => now()]);

        // Create published snapshots
        $this->createPublishedSnapshots($classId, $streamId, $termId, $assessmentType);

        // Notify parents
        $this->notifyParentsAboutPublication($classId, $streamId, $termId, $assessmentType);

        return response()->json(['message' => 'Comments published.']);
    }

    public function publishAndPromote(Request $request)
    {
        $request->validate([
            'class_id'          => 'required|exists:classes,id',
            'stream_id'         => 'nullable|exists:streams,id',
            'term_id'           => 'required|exists:terms,id',
            'assessment_type'   => 'nullable|in:mid_term,end_term',
            'threshold'         => 'nullable|numeric|min:0|max:100',
            'next_opening_date' => 'nullable|date',
        ]);

        $termId           = $request->term_id;
        $classId          = $request->class_id;
        $streamId         = $request->stream_id;
        $assessmentType   = $request->assessment_type ?? 'end_term';
        $threshold        = $request->threshold ?? 50;
        $nextOpeningDate  = $request->next_opening_date;

        // Publish comments
        StudentComment::where('class_id', $classId)
            ->where('term_id', $termId)
            ->when($streamId, fn($q) => $q->where('stream_id', $streamId))
            ->whereNotNull('submitted_at')
            ->whereNull('published_at')
            ->update(['published_at' => now()]);

        // Save next opening date if provided
        if ($nextOpeningDate) {
            Term::where('id', $termId)->update(['next_opening_date' => $nextOpeningDate]);
        }

        // Create snapshots
        $this->createPublishedSnapshots($classId, $streamId, $termId, $assessmentType);

        $class  = ClassRoom::find($classId);
        $stream = $streamId ? Stream::find($streamId) : null;
        $term   = Term::find($termId);

        if ($this->isFinalTerm($termId) && $assessmentType === 'end_term') {
            // Promotion block
            $currentClass = ClassRoom::find($classId);
            $nextClass    = ClassRoom::where('order', '>', $currentClass->order)->orderBy('order')->first();

            $students = Student::where('class_id', $classId)
                ->when($streamId, fn($q) => $q->where('stream_id', $streamId))
                ->get();

            $promotedIds = [];
            foreach ($students as $student) {
                $avg = Grade::where('student_id', $student->id)
                    ->where('term_id', $termId)->avg('score');
                if ($avg >= $threshold) {
                    $promotedIds[] = $student->id;
                    if ($nextClass) {
                        $newStreamId = $this->assignStreamForPromotion($student, $nextClass, $streamId);
                        $student->class_id  = $nextClass->id;
                        $student->stream_id = $newStreamId;
                        $student->save();
                    }
                }
            }
            if (!empty($promotedIds)) {
                $this->notifyParentsAboutPromotion($promotedIds, $nextClass?->id, $nextOpeningDate);
            }
        } else {
            // No promotion – notify parents about publication
            $this->notifyParentsAboutPublication($classId, $streamId, $termId, $assessmentType);
        }

        return response()->json(['message' => 'Published successfully.']);
    }

    /**
     * Send in-app and email notifications to all parents of published students.
     * Ensures emails are sent even if only the Guardian record holds the email address.
     */
    private function notifyParentsAboutPublication($classId, $streamId, $termId, $assessmentType)
    {
        $class = ClassRoom::find($classId);
        $term  = Term::find($termId);
        $streamName = $streamId ? Stream::find($streamId)->name : '';

        // 1. Get all student IDs for this class/stream
        $studentIds = Student::where('class_id', $classId)
            ->when($streamId, fn($q) => $q->where('stream_id', $streamId))
            ->pluck('id');

        if ($studentIds->isEmpty()) {
            Log::warning("No students found for class {$classId}, term {$termId}");
            return;
        }

        // 2. Get all guardians linked to these students (with user_id)
        $guardians = Guardian::whereHas('students', fn($q) => $q->whereIn('students.id', $studentIds))
            ->whereNotNull('user_id')
            ->get(['user_id', 'email']);

        if ($guardians->isEmpty()) {
            Log::warning("No guardians with user_id found for students in class {$classId}");
            return;
        }

        // 3. Build a map of user_id => best available email (prefer User email, fallback to Guardian email)
        $userIds = $guardians->pluck('user_id')->unique();
        $users = User::whereIn('id', $userIds)->get()->keyBy('id');

        $parentIdsWithEmail = [];
        foreach ($guardians as $guardian) {
            $userId = $guardian->user_id;
            $user = $users->get($userId);
            if (!$user) continue;

            // Use the User's email if present; otherwise, use the Guardian's email
            $email = $user->email ?: $guardian->email;
            if (empty($email)) continue;

            // Temporarily set the email on the User model for the notification
            $user->email = $email;
            $parentIdsWithEmail[$userId] = $user; // use user_id as key to avoid duplicates
        }

        $parents = collect($parentIdsWithEmail)->values();
        Log::info("Publishing results for {$class->name}, found {$parents->count()} parents with email.");

        if ($parents->isEmpty()) return;

        // 4. Create in-app notifications
        $message = "Report cards published for {$class->name}";
        if ($streamName) $message .= " ({$streamName})";
        $message .= " - {$term->name}";

        if ($this->isFinalTerm($termId)) {
            $termModel = Term::find($termId);
            if ($termModel->next_opening_date) {
                $message .= ". Next opening: " . Carbon::parse($termModel->next_opening_date)->format('d M Y');
            }
        }

        $insertData = [];
        $now = now();
        foreach ($parents as $user) {
            $insertData[] = [
                'user_id'    => $user->id,
                'type'       => 'publication',
                'message'    => $message,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        Notification::insert($insertData);

        // 5. Send email notifications
        try {
            \Illuminate\Support\Facades\Notification::sendNow(
                $parents,
                new ResultsPublished($class, $term, $assessmentType)
            );
            Log::info("Successfully dispatched results published emails to {$parents->count()} parents.");
        } catch (\Exception $e) {
            Log::error("Failed to send results published emails: " . $e->getMessage());
        }
    }

    private function createPublishedSnapshots($classId, $streamId, $termId, $assessmentType = 'end_term')
    {
        $class = ClassRoom::find($classId);

        $students = Student::where('class_id', $classId)
            ->when($streamId, fn($q) => $q->where('stream_id', $streamId))
            ->get();

        $classStudents = Student::where('class_id', $classId)->pluck('id');

        foreach ($students as $student) {

            // --------------------------------------------------
            // 1. Calculate current fee balance for this student & term
            // --------------------------------------------------
            $totalFees = StudentFee::where('student_id', $student->id)
                ->where('term_id', $termId)
                ->sum('total_amount');
            $paidFees = StudentFee::where('student_id', $student->id)
                ->where('term_id', $termId)
                ->sum('paid_amount');
            $feesBalance = $totalFees - $paidFees;
            $resultsWithheld = $feesBalance > 0;

            // --------------------------------------------------
            // 2. Fetch the comment
            // --------------------------------------------------
            $comment = StudentComment::where('student_id', $student->id)
                ->where('term_id', $termId)
                ->first();

            // --------------------------------------------------
            // 3. Branch on grading type
            // --------------------------------------------------
            if ($class->grading_type === 'skill') {

                // Skill‑based snapshot
                $assessments = StudentSkillAssessment::where('student_id', $student->id)
                    ->where('term_id', $termId)
                    ->with('skill:id,competency_id,name', 'skill.competency:id,name')
                    ->get();

                $skillsSnapshot = $assessments->map(function ($a) {
                    return [
                        'competency'             => $a->skill->competency->name ?? '',
                        'competency_description' => $a->skill->competency->description ?? '',
                        'skill'                  => $a->skill->name,
                        'skill_description'      => $a->skill->description ?? '',
                        'rating'                 => $a->rating,
                        'comment'                => $a->areas_for_improvement,
                    ];
                })->values();

                PublishedReport::updateOrCreate(
                    ['student_id' => $student->id, 'term_id' => $termId, 'assessment_type' => $assessmentType],
                    [
                        'class_id'         => $classId,
                        'stream_id'        => $streamId,
                        'average'          => null,
                        'class_position'   => null,
                        'class_total'      => null,
                        'stream_position'  => null,
                        'grades'           => $skillsSnapshot,
                        'comment'          => $comment->comment ?? null,
                        'fees_balance'     => $feesBalance,        // <-- stored
                        'results_withheld' => $resultsWithheld,    // <-- stored
                    ]
                );

            } else {

                // Numeric snapshot
                $grades = Grade::where('student_id', $student->id)
                    ->where('term_id', $termId)
                    ->where('assessment_type', $assessmentType)
                    ->with('subject:id,name')
                    ->get();

                $avg = $grades->avg('score');

                $allAverages = Grade::whereIn('student_id', $classStudents)
                    ->where('term_id', $termId)
                    ->where('assessment_type', $assessmentType)
                    ->get()
                    ->groupBy('student_id')
                    ->map(fn($gs) => $gs->avg('score'))
                    ->sortDesc();
                $classPosition = $allAverages->search($avg) + 1;
                $classTotal    = $allAverages->count();

                $streamPosition = null;
                if ($streamId) {
                    $streamStudentIds = Student::where('stream_id', $streamId)->pluck('id');
                    $streamAverages   = Grade::whereIn('student_id', $streamStudentIds)
                        ->where('term_id', $termId)
                        ->where('assessment_type', $assessmentType)
                        ->get()
                        ->groupBy('student_id')
                        ->map(fn($gs) => $gs->avg('score'))
                        ->sortDesc();
                    $streamPosition = $streamAverages->search($avg) + 1;
                }

                $gradesSnapshot = $grades->map(function ($g) use ($classStudents, $termId, $assessmentType) {
                    $scores = Grade::whereIn('student_id', $classStudents)
                        ->where('term_id', $termId)
                        ->where('subject_id', $g->subject_id)
                        ->where('assessment_type', $assessmentType)
                        ->orderByDesc('score')
                        ->pluck('score');
                    $subjectPosition = $scores->search($g->score) + 1;
                    return [
                        'subject'   => $g->subject->name,
                        'score'     => $g->score,
                        'grade'     => $g->grade,
                        'remarks'   => $g->remarks,
                        'position'  => $subjectPosition,
                    ];
                });

                PublishedReport::updateOrCreate(
                    ['student_id' => $student->id, 'term_id' => $termId, 'assessment_type' => $assessmentType],
                    [
                        'class_id'         => $classId,
                        'stream_id'        => $streamId,
                        'average'          => $avg ? round($avg, 2) : null,
                        'class_position'   => $classPosition,
                        'class_total'      => $classTotal,
                        'stream_position'  => $streamPosition,
                        'grades'           => $gradesSnapshot,
                        'comment'          => $comment ? $comment->comment : null,
                        'fees_balance'     => $feesBalance,        // <-- stored
                        'results_withheld' => $resultsWithheld,    // <-- stored
                    ]
                );
            }
        }
    }

    // -------------------------------------------------
    // STATUS CHECKS
    // -------------------------------------------------
    public function gradingStatus(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $class = ClassRoom::with('subjects:id,name')->find($request->class_id);

        if ($class->grading_type === 'skill') {
            $students = Student::where('class_id', $request->class_id)
                ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
                ->pluck('id');

            $hasAssessments = StudentSkillAssessment::whereIn('student_id', $students)
                ->where('term_id', $request->term_id)
                ->exists();

            return response()->json([
                'all_graded'      => $hasAssessments,
                'total_subjects'  => null,
                'graded_subjects' => null,
            ]);
        }

        $subjects = $class->subjects;
        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->pluck('id');

        if ($subjects->isEmpty() || $students->isEmpty()) {
            return response()->json([
                'all_graded'      => false,
                'total_subjects'  => $subjects->count(),
                'graded_subjects' => 0,
            ]);
        }

        $gradedCount = 0;
        foreach ($subjects as $subject) {
            $gradedStudents = Grade::where('subject_id', $subject->id)
                ->where('term_id', $request->term_id)
                ->where('class_id', $request->class_id)
                ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
                ->whereIn('student_id', $students)
                ->whereNotNull('score')
                ->distinct('student_id')
                ->count('student_id');

            if ($gradedStudents === $students->count()) {
                $gradedCount++;
            }
        }

        $allGraded = $gradedCount === $subjects->count();

        return response()->json([
            'all_graded'      => $allGraded,
            'total_subjects'  => $subjects->count(),
            'graded_subjects' => $gradedCount,
        ]);
    }

    // public function submissionStatus(Request $request)
    // {
    //     $request->validate([
    //         'class_id'        => 'required|exists:classes,id',
    //         'stream_id'       => 'nullable|exists:streams,id',
    //         'term_id'         => 'required|exists:terms,id',
    //         'assessment_type' => 'required|in:mid_term,end_term',
    //     ]);

    //     $timestampColumn = $request->assessment_type === 'mid_term' ? 'submitted_mid_term_at' : 'submitted_end_term_at';

    //     $submittedCount = StudentComment::where('class_id', $request->class_id)
    //         ->where('term_id', $request->term_id)
    //         ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
    //         ->whereNotNull($timestampColumn)
    //         ->count();

    //     $totalStudents = Student::where('class_id', $request->class_id)
    //         ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
    //         ->count();

    //     return response()->json(['all_submitted' => $totalStudents > 0 && $submittedCount === $totalStudents]);
    // }
    
    public function submissionsList(Request $request)
    {
        $request->validate([
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'nullable|in:mid_term,end_term',
        ]);

        $termId         = $request->term_id;
        $assessmentType = $request->assessment_type ?? 'end_term';
        $timestampCol   = $assessmentType === 'mid_term' ? 'submitted_mid_term_at' : 'submitted_end_term_at';

        $classes = ClassRoom::with('streams')->get();
        $result  = [];

        foreach ($classes as $class) {
            $streams = $class->streams;

            if ($streams->isEmpty()) {
                // No streams – single entry for the whole class
                $total = Student::where('class_id', $class->id)->count();
                $submitted = StudentComment::where('class_id', $class->id)
                    ->where('term_id', $termId)
                    ->whereNotNull($timestampCol)
                    ->count();
                $published = StudentComment::where('class_id', $class->id)
                    ->where('term_id', $termId)
                    ->whereNotNull('published_at')
                    ->exists();

                if ($total > 0 && $submitted === $total && !$published) {
                    $result[] = [
                        'class_id'        => $class->id,
                        'class_name'      => $class->name,
                        'stream_id'       => null,
                        'stream_name'     => null,
                        'total_students'  => $total,
                        'submitted_count' => $submitted,
                    ];
                }
            } else {
                // Add a whole‑class entry (all streams combined)
                $totalAll     = Student::where('class_id', $class->id)->count();
                $submittedAll = StudentComment::where('class_id', $class->id)
                    ->where('term_id', $termId)
                    ->whereNotNull($timestampCol)
                    ->count();
                $publishedAll = StudentComment::where('class_id', $class->id)
                    ->where('term_id', $termId)
                    ->whereNotNull('published_at')
                    ->exists();

                if ($totalAll > 0 && $submittedAll === $totalAll && !$publishedAll) {
                    $result[] = [
                        'class_id'        => $class->id,
                        'class_name'      => $class->name,
                        'stream_id'       => null,
                        'stream_name'     => null,
                        'total_students'  => $totalAll,
                        'submitted_count' => $submittedAll,
                    ];
                }

                // Also add per‑stream entries
                foreach ($streams as $stream) {
                    $total = Student::where('class_id', $class->id)
                        ->where('stream_id', $stream->id)
                        ->count();
                    $submitted = StudentComment::where('class_id', $class->id)
                        ->where('stream_id', $stream->id)
                        ->where('term_id', $termId)
                        ->whereNotNull($timestampCol)
                        ->count();
                    $published = StudentComment::where('class_id', $class->id)
                        ->where('stream_id', $stream->id)
                        ->where('term_id', $termId)
                        ->whereNotNull('published_at')
                        ->exists();

                    if ($total > 0 && $submitted === $total && !$published) {
                        $result[] = [
                            'class_id'        => $class->id,
                            'class_name'      => $class->name,
                            'stream_id'       => $stream->id,
                            'stream_name'     => $stream->name,
                            'total_students'  => $total,
                            'submitted_count' => $submitted,
                        ];
                    }
                }
            }
        }

        return response()->json($result);
    }

    public function promotionData(Request $request)
    {
        $request->validate([
            'term_id'         => 'required|exists:terms,id',
            'class_id'        => 'nullable|exists:classes,id',
            'assessment_type' => 'nullable|in:mid_term,end_term',
        ]);

        $termId = $request->term_id;
        $assessmentType = $request->assessment_type ?? 'end_term';

        // Only final term + end_term assessment should trigger promotion
        if (!$this->isFinalTerm($termId) || $assessmentType !== 'end_term') {
            return response()->json([]);
        }

        // Get distinct class/stream combinations that have a published end‑term report
        $reportsQuery = PublishedReport::where('term_id', $termId)
            ->where('assessment_type', 'end_term')
            ->when($request->class_id, fn($q) => $q->where('class_id', $request->class_id))
            ->select('class_id', 'stream_id')
            ->distinct();

        $classStreams = $reportsQuery->get();

        $result = [];

        foreach ($classStreams as $cs) {
            $class = ClassRoom::find($cs->class_id);
            if (!$class) continue;

            $streamName = $cs->stream_id ? Stream::find($cs->stream_id)->name ?? null : null;

            $students = Student::where('class_id', $cs->class_id)
                ->when($cs->stream_id, fn($q) => $q->where('stream_id', $cs->stream_id))
                ->get();

            // Get the published reports for these students (end‑term)
            $studentIds = $students->pluck('id');
            $reports = PublishedReport::whereIn('student_id', $studentIds)
                ->where('term_id', $termId)
                ->where('assessment_type', 'end_term')
                ->get()
                ->keyBy('student_id');

            $isSkillClass = $class->grading_type === 'skill';

            $studentData = $students->map(function ($student) use ($reports, $isSkillClass) {
                $report = $reports->get($student->id);

                $average = null;
                if ($report && !$isSkillClass) {
                    $average = $report->average;
                }

                return [
                    'student_id'    => $student->id,
                    'first_name'    => $student->first_name,
                    'last_name'     => $student->last_name,
                    'student_number'=> $student->student_number,
                    'average'       => $average !== null ? round($average, 1) : null,
                ];
            });

            // Sort numeric classes by average descending; skill classes stay as is
            if (!$isSkillClass) {
                $studentData = $studentData->sortByDesc('average')->values();
            } else {
                $studentData = $studentData->values();
            }

            // Next possible classes (all except current class)
            $nextClasses = ClassRoom::where('id', '!=', $cs->class_id)
                ->orderBy('order')
                ->get()
                ->map(fn($c) => [
                    'id'      => $c->id,
                    'name'    => $c->name,
                    'streams' => $c->streams->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
                ]);

            $result[] = [
                'class_id'      => $cs->class_id,
                'class_name'    => $class->name,
                'stream_id'     => $cs->stream_id,
                'stream_name'   => $streamName,
                'students'      => $studentData,
                'next_classes'  => $nextClasses,
            ];
        }

        return response()->json($result);
    }

    public function promoteStudents(Request $request)
    {
        $request->validate([
            'term_id'           => 'required|exists:terms,id',
            'class_id'          => 'required|exists:classes,id',
            'stream_id'         => 'nullable|exists:streams,id',
            'next_class_id'     => 'required|exists:classes,id|different:class_id',
            'student_ids'       => 'required|array|min:1',
            'student_ids.*'     => 'exists:students,id',
            'next_opening_date' => 'nullable|date',
        ]);

        $termId = $request->term_id;
        $currentClassId = $request->class_id;
        $currentStreamId = $request->stream_id;
        $nextClassId = $request->next_class_id;
        $studentIds = $request->student_ids;
        $nextOpeningDate = $request->next_opening_date;

        if ($nextOpeningDate) {
            Term::where('id', $termId)->update(['next_opening_date' => $nextOpeningDate]);
        }

        $nextClass = ClassRoom::with('streams')->find($nextClassId);
        $hasStreams = $nextClass->streams->isNotEmpty();
        $students = Student::whereIn('id', $studentIds)->get();

        if ($hasStreams) {
            if ($currentStreamId) {
                $currentStreamName = Stream::find($currentStreamId)->name;
                $matching = $nextClass->streams->firstWhere('name', $currentStreamName);
                $newStreamId = $matching ? $matching->id : $nextClass->streams->first()->id;
                foreach ($students as $student) {
                    $student->class_id = $nextClassId;
                    $student->stream_id = $newStreamId;
                    $student->save();
                }
            } else {
                $this->balanceStudentsAcrossStreams($students, $nextClass);
            }
        } else {
            foreach ($students as $student) {
                $student->class_id = $nextClassId;
                $student->stream_id = null;
                $student->save();
            }
        }

        $this->notifyParentsAboutPromotion($studentIds, $nextClassId, $nextOpeningDate);

        return response()->json(['message' => 'Students promoted.']);
    }

    // -------------------------------------------------
    // RESET GRADES
    // -------------------------------------------------
    public function resetGrades(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $classId  = $request->class_id;
        $streamId = $request->stream_id;
        $termId   = $request->term_id;

        $studentIds = Student::where('class_id', $classId)
            ->when($streamId, fn($q) => $q->where('stream_id', $streamId))
            ->pluck('id');

        Grade::whereIn('student_id', $studentIds)->where('term_id', $termId)->delete();
        StudentComment::whereIn('student_id', $studentIds)->where('term_id', $termId)->delete();
        PublishedReport::whereIn('student_id', $studentIds)->where('term_id', $termId)->delete();

        $this->log('grades_reset', "Grades reset for class {$classId}, term {$termId} by {$request->user()->email}");

        return response()->json(['message' => 'All grades, comments, and published reports have been cleared.']);
    }

    // -------------------------------------------------
    // PRIVATE HELPERS
    // -------------------------------------------------
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
        return $streamIds->merge($subjectStreamIds)->unique()->values();
    }

    private function getTeacherStreamIdsForClass($user, $classId): \Illuminate\Support\Collection
    {
        return ClassStream::where('class_id', $classId)
            ->whereHas('teachers', fn($q) => $q->where('users.id', $user->id))
            ->pluck('stream_id')
            ->unique()
            ->values();
    }

    private function isFinalTerm($termId)
    {
        $term = Term::findOrFail($termId);
        $academicYear = $term->academicYear;
        if (!$academicYear) return false;
        $terms = $academicYear->terms()->orderBy('end_date')->get();
        return $terms->last()->id === $term->id;
    }

    private function balanceStudentsAcrossStreams($students, ClassRoom $nextClass)
    {
        $streams = $nextClass->streams;
        $streamCount = $streams->count();
        $streamIndex = 0;

        $males = $students->filter(fn($s) => $s->gender === 'Male');
        $females = $students->filter(fn($s) => $s->gender === 'Female');

        foreach ([$males, $females] as $group) {
            foreach ($group as $student) {
                $stream = $streams[$streamIndex % $streamCount];
                $student->class_id = $nextClass->id;
                $student->stream_id = $stream->id;
                $student->save();
                $streamIndex++;
            }
        }
    }

    private function notifyParentsAboutPromotion($studentIds, $nextClassId, $nextOpeningDate)
    {
        $parentIds = Guardian::whereHas('students', fn($q) => $q->whereIn('students.id', $studentIds))
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->unique();

        if ($parentIds->isEmpty()) return;

        $message = "Your child has been promoted.";
        if ($nextClassId) {
            $class = ClassRoom::find($nextClassId);
            $message = "Your child has been promoted to {$class->name}.";
        }
        if ($nextOpeningDate) {
            $message .= " Next opening: " . Carbon::parse($nextOpeningDate)->format('d M Y');
        }

        $insertData = [];
        $now = now();
        foreach ($parentIds as $uid) {
            $insertData[] = [
                'user_id'    => $uid,
                'type'       => 'promotion',
                'message'    => $message,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        if (!empty($insertData)) Notification::insert($insertData);
    }

    private function assignStreamForPromotion($student, $nextClass, $currentStreamId)
    {
        if ($nextClass->streams->isEmpty()) return null;
        if ($currentStreamId) {
            $currentStreamName = Stream::find($currentStreamId)->name;
            $matching = $nextClass->streams->firstWhere('name', $currentStreamName);
            return $matching ? $matching->id : $nextClass->streams->first()->id;
        }
        $streams = $nextClass->streams;
        $count = Student::where('class_id', $nextClass->id)->count();
        return $streams[$count % $streams->count()]->id;
    }
}