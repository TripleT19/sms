<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\ClassStream;
use App\Models\Stream;
use App\Models\Subject;
use App\Models\TeacherSubjectAssignment;
use App\Models\Term;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class AcademicController extends Controller
{
    use LogsActivity;

    // -------------------------------------------------
    // CLASSES
    // -------------------------------------------------
    public function classes()
    {
        $classes = ClassRoom::with([
            'subjects:id,name',
            'streams:id,name',
            'teachers:id,first_name,last_name'
        ])->get();

        $data = $classes->map(function ($class) {
            $hasStreams = $class->streams->isNotEmpty();

            $classStreams = $hasStreams
                ? $class->streams()->withPivot('id')->get()->map(function ($stream) {
                    $pivot = ClassStream::find($stream->pivot->id);
                    $teachers = $pivot ? $pivot->teachers()->get(['users.id', 'users.first_name', 'users.last_name'])->map(fn($t) => [
                        'id'   => $t->id,
                        'name' => $t->first_name . ' ' . $t->last_name,
                    ]) : [];
                    return [
                        'id'          => $pivot->id,
                        'stream_id'   => $stream->id,
                        'stream_name' => $stream->name,
                        'teachers'    => $teachers,
                    ];
                })
                : [];

            return [
                'id'         => $class->id,
                'name'       => $class->name,
                'subjects'   => $class->subjects->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
                'has_streams'=> $hasStreams,
                'teachers'   => !$hasStreams
                    ? $class->teachers->map(fn($t) => ['id' => $t->id, 'name' => $t->first_name . ' ' . $t->last_name])->values()
                    : [],
                'streams'    => $classStreams,
            ];
        });

        return response()->json($data);
    }

    public function storeClass(Request $request)
    {
        $data = $request->validate(['name' => 'required|string|max:255']);
        $class = ClassRoom::create($data);
        $this->log('class_created', "Class {$class->name} created");
        return response()->json($this->formatClassData($class), 201);
    }

    public function updateClass(Request $request, $id)
    {
        $class = ClassRoom::findOrFail($id);
        $data = $request->validate(['name' => 'required|string|max:255']);
        $class->update($data);
        return response()->json($this->formatClassData($class->fresh()));
    }

    public function deleteClass($id)
    {
        $class = ClassRoom::findOrFail($id);
        $class->delete();
        $this->log('class_deleted', "Class {$class->name} deleted");
        return response()->json(['message' => 'Class deleted']);
    }

    // -------------------------------------------------
    // CLASS–STREAM ASSIGNMENT
    // -------------------------------------------------
    public function assignStreams(Request $request, $classId)
    {
        $class = ClassRoom::findOrFail($classId);
        $request->validate(['streams' => 'array', 'streams.*' => 'exists:streams,id']);
        $class->streams()->sync($request->streams);
        return response()->json(['message' => 'Streams updated']);
    }

    public function classStreams($classId)
    {
        $class = ClassRoom::findOrFail($classId);
        $classStreams = $class->streams()->withPivot('id')->get()->map(function ($stream) {
            $pivot = ClassStream::find($stream->pivot->id);
            $teachers = $pivot ? $pivot->teachers()->get(['users.id', 'users.first_name', 'users.last_name'])->map(fn($t) => [
                'id'   => $t->id,
                'name' => $t->first_name . ' ' . $t->last_name,
            ]) : [];
            return [
                'id'          => $pivot->id,
                'class_id'    => $pivot->class_id,
                'stream_id'   => $pivot->stream_id,
                'stream_name' => $stream->name,
                'teachers'    => $teachers,
            ];
        });
        return response()->json($classStreams);
    }

    // -------------------------------------------------
    // TEACHER ASSIGNMENT (to class or class‑stream pivot)
    // -------------------------------------------------
    public function assignClassTeachers(Request $request, $classId)
    {
        $class = ClassRoom::findOrFail($classId);
        $request->validate(['teachers' => 'array', 'teachers.*' => 'exists:users,id']);
        $class->teachers()->sync($request->teachers);
        return response()->json(['teachers' => $class->teachers()->get(['users.id', 'users.first_name', 'users.last_name'])]);
    }

    public function assignClassStreamTeachers(Request $request, $classStreamId)
    {
        $pivot = ClassStream::findOrFail($classStreamId);
        $request->validate(['teachers' => 'array', 'teachers.*' => 'exists:users,id']);
        $pivot->teachers()->sync($request->teachers);
        return response()->json(['teachers' => $pivot->teachers()->get(['users.id', 'users.first_name', 'users.last_name'])]);
    }

    // -------------------------------------------------
    // STREAMS (global)
    // -------------------------------------------------
    public function streams()
    {
        return response()->json(Stream::orderBy('name')->get());
    }

    public function storeStream(Request $request)
    {
        $data = $request->validate(['name' => 'required|string|max:255|unique:streams']);
        $stream = Stream::create($data);
        $this->log('stream_created', "Stream {$stream->name} created");
        return response()->json($stream, 201);
    }

    public function updateStream(Request $request, $id)
    {
        $stream = Stream::findOrFail($id);
        $data = $request->validate(['name' => 'required|string|max:255|unique:streams,name,' . $id]);
        $stream->update($data);
        return response()->json($stream);
    }

    public function deleteStream($id)
    {
        Stream::findOrFail($id)->delete();
        return response()->json(['message' => 'Stream deleted']);
    }

    // -------------------------------------------------
    // SUBJECTS
    // -------------------------------------------------
    public function subjects()
    {
        return response()->json(Subject::orderBy('name')->get());
    }

    public function storeSubject(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);
        $subject = Subject::create($data);
        $this->log('subject_created', "Subject {$subject->name} created");
        return response()->json($subject, 201);
    }

    public function updateSubject(Request $request, $id)
    {
        $subject = Subject::findOrFail($id);
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);
        $subject->update($data);
        return response()->json($subject);
    }

    public function deleteSubject($id)
    {
        Subject::findOrFail($id)->delete();
        return response()->json(['message' => 'Subject deleted']);
    }

    public function assignSubjects(Request $request, $classId)
    {
        $class = ClassRoom::findOrFail($classId);
        $request->validate(['subjects' => 'array', 'subjects.*' => 'exists:subjects,id']);
        $class->subjects()->sync($request->subjects);
        $this->log('subjects_assigned', "Subjects assigned to class {$class->name}");
        return response()->json(['subjects' => $class->fresh('subjects')->subjects]);
    }

    // -------------------------------------------------
    // SUBJECT IMPORT / EXPORT
    // -------------------------------------------------
    public function downloadSubjectTemplate()
    {
        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="subject_template.csv"',
        ];
        $columns = ['name', 'description'];
        $callback = function () use ($columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);
            fclose($file);
        };
        return response()->stream($callback, 200, $headers);
    }

    public function importSubjects(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        fgetcsv($handle); // skip header
        $created = 0;
        while (($row = fgetcsv($handle)) !== false) {
            if (empty($row[0])) continue;
            Subject::create(['name' => $row[0], 'description' => $row[1] ?? null]);
            $created++;
        }
        fclose($handle);
        return response()->json(['message' => "{$created} subjects imported."]);
    }

    // -------------------------------------------------
    // ACADEMIC YEARS
    // -------------------------------------------------
    public function years()
    {
        return response()->json(AcademicYear::orderBy('start_date')->get());
    }

    public function storeYear(Request $request)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:255',
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
        ]);
        $year = AcademicYear::create($data);
        $this->log('academic_year_created', "Academic year {$year->name} created");
        return response()->json($year, 201);
    }

    public function updateYear(Request $request, $id)
    {
        $year = AcademicYear::findOrFail($id);
        $data = $request->validate([
            'name'       => 'sometimes|string|max:255',
            'start_date' => 'sometimes|date',
            'end_date'   => 'sometimes|date|after_or_equal:start_date',
        ]);
        $year->update($data);
        return response()->json($year);
    }

    public function deleteYear($id)
    {
        AcademicYear::findOrFail($id)->delete();
        return response()->json(['message' => 'Year deleted']);
    }

    // -------------------------------------------------
    // TERMS
    // -------------------------------------------------
    public function allTerms()
    {
        return response()->json(Term::with('academicYear')->orderBy('start_date')->get());
    }

    public function storeTermStandalone(Request $request)
    {
        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'start_date'       => 'required|date',
            'end_date'         => 'required|date|after_or_equal:start_date',
            'academic_year_id' => 'required|exists:academic_years,id',
        ]);
        $term = Term::create($data);
        $this->log('term_created', "Term {$term->name} created");
        return response()->json($term->load('academicYear'), 201);
    }

    public function updateTerm(Request $request, $termId)
    {
        $term = Term::findOrFail($termId);
        $data = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'start_date'       => 'sometimes|date',
            'end_date'         => 'sometimes|date|after_or_equal:start_date',
            'academic_year_id' => 'sometimes|exists:academic_years,id',
        ]);
        $term->update($data);
        return response()->json($term->fresh('academicYear'));
    }

    public function deleteTerm($termId)
    {
        Term::findOrFail($termId)->delete();
        return response()->json(['message' => 'Term deleted']);
    }

    // -------------------------------------------------
    // TEACHER SUBJECT ASSIGNMENTS (class/stream context)
    // -------------------------------------------------
    public function teacherSubjectAssignments()
    {
        $assignments = TeacherSubjectAssignment::with([
            'teacher:id,first_name,last_name',
            'subject:id,name',
            'class:id,name',
            'stream:id,name'
        ])->get();

        $data = $assignments->map(function ($a) {
            return [
                'id'            => $a->id,
                'teacher_id'    => $a->user_id,
                'teacher_name'  => $a->teacher->first_name . ' ' . $a->teacher->last_name,
                'subject_id'    => $a->subject_id,
                'subject_name'  => $a->subject->name,
                'class_id'      => $a->class_id,
                'class_name'    => $a->class->name,
                'stream_id'     => $a->stream_id,
                'stream_name'   => $a->stream ? $a->stream->name : null,
            ];
        });

        return response()->json($data);
    }

    public function storeTeacherSubjectAssignment(Request $request)
    {
        $validated = $request->validate([
            'user_id'    => 'required|exists:users,id',
            'subject_id' => 'required|exists:subjects,id',
            'class_id'   => 'required|exists:classes,id',
            'stream_id'  => 'nullable|exists:streams,id',
        ]);

        $assignment = TeacherSubjectAssignment::create($validated);
        $this->log('teacher_subject_assigned', "Subject assigned to teacher");

        return response()->json($assignment->load(['teacher', 'subject', 'class', 'stream']), 201);
    }

    public function deleteTeacherSubjectAssignment($id)
    {
        $assignment = TeacherSubjectAssignment::findOrFail($id);
        $assignment->delete();
        return response()->json(['message' => 'Assignment removed']);
    }

    // -------------------------------------------------
    // CLASSES WITH STREAMS (for dropdowns)
    // -------------------------------------------------
    public function classesWithStreams()
    {
        $classes = ClassRoom::with('streams:id,name')->get()->map(fn($c) => [
            'id'      => $c->id,
            'name'    => $c->name,
            'streams' => $c->streams->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
        ]);
        return response()->json($classes);
    }

    // -------------------------------------------------
    // TEACHERS LIST (all teaching roles)
    // -------------------------------------------------
    public function teachersList()
    {
        $teachingRoles = ['Teacher', 'Headteacher', 'Deputy Headteacher', 'Head of Department'];
        $teachers = User::whereHas('roles', fn($q) => $q->whereIn('name', $teachingRoles))
            ->get(['id', 'first_name', 'last_name', 'email']);
        return response()->json($teachers);
    }

    // -------------------------------------------------
    // HELPERS
    // -------------------------------------------------
    private function formatClassData(ClassRoom $class)
    {
        $hasStreams = $class->streams->isNotEmpty();

        $classStreams = $hasStreams
            ? $class->streams()->withPivot('id')->get()->map(function ($stream) {
                $pivot = ClassStream::find($stream->pivot->id);
                $teachers = $pivot ? $pivot->teachers()->get(['users.id', 'users.first_name', 'users.last_name'])->map(fn($t) => [
                    'id'   => $t->id,
                    'name' => $t->first_name . ' ' . $t->last_name,
                ]) : [];
                return [
                    'id'          => $pivot->id,
                    'stream_id'   => $stream->id,
                    'stream_name' => $stream->name,
                    'teachers'    => $teachers,
                ];
            })
            : [];

        return [
            'id'         => $class->id,
            'name'       => $class->name,
            'subjects'   => $class->subjects->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
            'has_streams'=> $hasStreams,
            'teachers'   => !$hasStreams
                ? $class->teachers->map(fn($t) => ['id' => $t->id, 'name' => $t->first_name . ' ' . $t->last_name])->values()
                : [],
            'streams'    => $classStreams,
        ];
    }
}