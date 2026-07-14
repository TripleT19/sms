<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\ClassStream;
use App\Models\Competency;
use App\Models\Skill;
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
        ])->orderBy('order')->get();

        $data = $classes->map(function ($class) {
            return $this->formatClassData($class);
        });

        return response()->json($data);
    }

    public function updateOrder(Request $request)
    {
        $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:classes,id',
            'orders.*.order' => 'required|integer',
        ]);
        foreach ($request->orders as $item) {
            ClassRoom::where('id', $item['id'])->update(['order' => $item['order']]);
        }
        return response()->json(['message' => 'Order updated']);
    }

    public function storeClass(Request $request)
    {
        $data = $request->validate([
            'name'         => 'required|string|max:255',
            'order'        => 'nullable|integer',
            'grading_type' => 'nullable|in:numeric,skill',
        ]);
        $class = ClassRoom::create(array_merge($data, [
            'grading_type' => $data['grading_type'] ?? 'numeric',
        ]));
        $this->log('class_created', "Class {$class->name} created");
        return response()->json($this->formatClassData($class->fresh()), 201);
    }

    public function updateClass(Request $request, $id)
    {
        $class = ClassRoom::findOrFail($id);
        $data = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'order'        => 'nullable|integer',
            'grading_type' => 'nullable|in:numeric,skill',
        ]);
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
    // COMPETENCIES (Skills for skill‑based grading)
    // -------------------------------------------------

    /**
     * Get all competencies (admins) or competencies for the teacher's skill‑based subjects.
     * Includes nested skills.
     */
    public function competencies(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();

        if ($isAdmin) {
            $competencies = Competency::with('skills')->orderBy('name')->get();
        } else {
            $skillClassIds = ClassRoom::where('grading_type', 'skill')->pluck('id');

            $taughtSubjectIds = TeacherSubjectAssignment::where('user_id', $user->id)
                ->whereIn('class_id', $skillClassIds)
                ->pluck('subject_id')
                ->unique();

            $classSubjectIds = $user->taughtClasses()
                ->where('grading_type', 'skill')
                ->with('subjects:id')
                ->get()
                ->pluck('subjects.*.id')
                ->flatten()
                ->unique();

            $allowedSubjectIds = $taughtSubjectIds->merge($classSubjectIds)->unique();

            $competencies = Competency::with('skills')
                ->where(function ($query) use ($allowedSubjectIds) {
                    $query->whereIn('subject_id', $allowedSubjectIds)
                          ->orWhereNull('subject_id');
                })
                ->orderBy('name')
                ->get();
        }

        $data = $competencies->map(function ($c) {
            return [
                'id'          => $c->id,
                'name'        => $c->name,
                'description' => $c->description,
                'subject_id'  => $c->subject_id,
                'subject_name'=> $c->subject ? $c->subject->name : null,
                'skills'      => $c->skills->map(fn($s) => [
                    'id'          => $s->id,
                    'name'        => $s->name,
                    'description' => $s->description,
                ])->values(),
            ];
        });

        return response()->json($data);
    }

    /**
     * Get competencies with skills for a specific class/subject – used by teacher grading.
     */
    public function classCompetencies(Request $request)
    {
        $request->validate([
            'class_id'   => 'required|exists:classes,id',
            'subject_id' => 'required|exists:subjects,id',
        ]);

        $class = ClassRoom::find($request->class_id);
        if ($class->grading_type !== 'skill') {
            return response()->json([]);
        }

        $competencies = Competency::where('subject_id', $request->subject_id)
            ->orWhereNull('subject_id')
            ->with('skills')
            ->orderBy('name')
            ->get();

        return response()->json($competencies->map(fn($c) => [
            'id'          => $c->id,
            'name'        => $c->name,
            'description' => $c->description,
            'skills'      => $c->skills->map(fn($s) => [
                'id'          => $s->id,
                'name'        => $s->name,
                'description' => $s->description,
            ])->values(),
        ]));
    }

    /**
     * Store a new competency.
     */
    public function storeCompetency(Request $request)
    {
        $this->authorizeCompetencyAction($request);

        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
            'subject_id'  => 'nullable|exists:subjects,id',
        ]);

        $competency = Competency::create($data);
        $this->log('competency_created', "Competency {$competency->name} created");

        return response()->json($competency->load('subject'), 201);
    }

    /**
     * Update a competency.
     */
    public function updateCompetency(Request $request, $id)
    {
        $competency = Competency::findOrFail($id);
        $this->authorizeCompetencyAction($request, $competency);

        $data = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'subject_id'  => 'nullable|exists:subjects,id',
        ]);

        $competency->update($data);
        return response()->json($competency->fresh('subject'));
    }

    /**
     * Delete a competency.
     */
    public function deleteCompetency($id)
    {
        $competency = Competency::findOrFail($id);
        $this->authorizeCompetencyAction(request(), $competency);

        $competency->delete();
        $this->log('competency_deleted', "Competency {$competency->name} deleted");
        return response()->json(['message' => 'Competency deleted']);
    }

    // -------------------------------------------------
    // SKILLS (within competencies)
    // -------------------------------------------------
    public function skills(Request $request)
    {
        $request->validate([
            'competency_id' => 'required|exists:competencies,id',
        ]);

        $skills = Skill::where('competency_id', $request->competency_id)
            ->orderBy('name')
            ->get();

        return response()->json($skills);
    }

    public function storeSkill(Request $request)
    {
        $this->authorizeCompetencyAction($request);

        $data = $request->validate([
            'competency_id' => 'required|exists:competencies,id',
            'name'          => 'required|string|max:255',
            'description'   => 'nullable|string',
        ]);

        $skill = Skill::create($data);
        $this->log('skill_created', "Skill {$skill->name} created");
        return response()->json($skill, 201);
    }

    public function updateSkill(Request $request, $id)
    {
        $skill = Skill::findOrFail($id);
        $competency = $skill->competency;
        $this->authorizeCompetencyAction($request, $competency);

        $data = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string',
        ]);
        $skill->update($data);
        return response()->json($skill);
    }

    public function deleteSkill($id)
    {
        $skill = Skill::findOrFail($id);
        $competency = $skill->competency;
        $this->authorizeCompetencyAction(request(), $competency);

        $skill->delete();
        $this->log('skill_deleted', "Skill {$skill->name} deleted");
        return response()->json(['message' => 'Skill deleted']);
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
            'id'          => $class->id,
            'name'        => $class->name,
            'order'       => $class->order,
            'grading_type'=> $class->grading_type,
            'subjects'    => $class->subjects->map(fn($s) => ['id' => $s->id, 'name' => $s->name])->values(),
            'has_streams' => $hasStreams,
            'teachers'    => !$hasStreams
                ? $class->teachers->map(fn($t) => ['id' => $t->id, 'name' => $t->first_name . ' ' . $t->last_name])->values()
                : [],
            'streams'     => $classStreams,
        ];
    }

    private function authorizeCompetencyAction(Request $request, Competency $competency = null)
    {
        $user = $request->user();
        $isAdmin = $user->roles()->where('name', 'Admin')->exists();
        if ($isAdmin) return;

        $subjectId = $competency ? $competency->subject_id : $request->subject_id;

        if (is_null($subjectId)) {
            abort(403, 'Only admins can manage global competencies.');
        }

        $skillClassIds = ClassRoom::where('grading_type', 'skill')->pluck('id');

        $teachesSubject = TeacherSubjectAssignment::where('user_id', $user->id)
            ->where('subject_id', $subjectId)
            ->whereIn('class_id', $skillClassIds)
            ->exists();

        if (!$teachesSubject) {
            $teachesSubject = $user->taughtClasses()
                ->where('grading_type', 'skill')
                ->whereHas('subjects', fn($q) => $q->where('subjects.id', $subjectId))
                ->exists();
        }

        if (!$teachesSubject) {
            abort(403, 'You are not authorized to manage competencies for this subject.');
        }
    }
}