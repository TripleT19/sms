<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankDetail;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\PublishedReport;
use App\Models\SchoolInformation;
use App\Models\Stream;
use App\Models\Student;
use App\Models\StudentComment;
use App\Models\StudentFee;
use App\Models\Term;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class ParentController extends Controller
{
    /**
     * Return all children of the authenticated parent with their latest published report,
     * or dynamic data if no report has been published yet.
     */
    public function children(Request $request)
    {
        $user = $request->user();
        $guardians = Guardian::where('user_id', $user->id)
            ->with(['students' => function ($q) {
                $q->select('id', 'first_name', 'last_name', 'class_id', 'stream_id', 'student_number');
            }])
            ->get();

        if ($guardians->isEmpty()) {
            return response()->json([
                'children'     => [],
                'bank_details' => BankDetail::all(),
            ]);
        }

        $children = [];

        foreach ($guardians as $guardian) {
            foreach ($guardian->students as $student) {

                $class  = $student->class;
                $stream = $student->stream;

                // 1. Try to get the latest published report (prefer end_term)
                $report = PublishedReport::where('student_id', $student->id)
                    ->orderByDesc('term_id')
                    ->orderByDesc('assessment_type')
                    ->first();

                // 2. Determine term and academic year from the report or from dynamic data
                if ($report) {
                    $term = Term::find($report->term_id);
                    $termId = $report->term_id;
                    $termName = $term ? $term->name : '';
                    $academicYear = $term && $term->academicYear ? $term->academicYear->name : '';
                } else {
                    // No published report – fall back to the latest term that has grades
                    $latestTermId = Grade::where('student_id', $student->id)
                        ->orderBy('term_id', 'desc')
                        ->value('term_id');

                    $term = $latestTermId ? Term::find($latestTermId) : null;
                    $termId = $latestTermId;
                    $termName = $term ? $term->name : '';
                    $academicYear = $term && $term->academicYear ? $term->academicYear->name : '';
                }

                // 3. Calculate fee balance for that term
                $feesBalance = 0;
                if ($termId) {
                    $totalFees = StudentFee::where('student_id', $student->id)
                        ->where('term_id', $termId)->sum('total_amount');
                    $paidFees = StudentFee::where('student_id', $student->id)
                        ->where('term_id', $termId)->sum('paid_amount');
                    $feesBalance = $totalFees - $paidFees;
                }

                // 4. Build the child array
                $child = [
                    'student_id'       => $student->id,
                    'name'             => $student->first_name . ' ' . $student->last_name,
                    'student_number'   => $student->student_number,
                    'class_name'       => $class ? $class->name : '',
                    'stream_name'      => $stream ? $stream->name : null,
                    'term_id'          => $termId,
                    'term_name'        => $termName,
                    'academic_year'    => $academicYear,
                    'grading_type'     => $class ? $class->grading_type : 'numeric',
                    'no_grades'        => true,
                    'fees_balance'     => $feesBalance,
                    'results_withheld' => $feesBalance > 0,
                    'promotion'        => null,
                    'comment'          => null,
                ];

                // 5. If a published report exists, use its data
                if ($report) {
                    $child['no_grades'] = false;

                    if ($class && $class->grading_type === 'skill') {
                        $child['skills']           = $report->grades;
                        $child['average']          = null;
                        $child['position']         = null;
                        $child['total_in_class']   = null;
                    } else {
                        $child['average']          = $report->average;
                        $child['position']         = $report->class_position;
                        $child['total_in_class']   = $report->class_total;
                        $child['stream_position']  = $report->stream_position;
                        $child['grades']           = $report->grades;
                    }

                    $child['comment'] = $report->comment;

                    // Promotion only for final term + end_term
                    if ($term && $this->isFinalTerm($termId) && $report->assessment_type === 'end_term') {
                        $child['promotion'] = $this->getPromotionInfo($student, $class, $report);
                    }
                }
                // 6. No report – try dynamic numeric fallback
                elseif ($termId) {
                    $firstGrade = Grade::where('student_id', $student->id)
                        ->where('term_id', $termId)->first();

                    if ($firstGrade) {
                        $classId  = $firstGrade->class_id;
                        $streamId = $firstGrade->stream_id;
                        $class    = ClassRoom::find($classId);
                        $stream   = $streamId ? Stream::find($streamId) : null;

                        $grades = Grade::where('student_id', $student->id)
                            ->where('term_id', $termId)
                            ->with('subject:id,name')->get();

                        $avg = $grades->avg('score');
                        $gradesData = $grades->map(fn($g) => [
                            'subject' => $g->subject->name,
                            'score'   => $g->score,
                            'grade'   => $g->grade,
                            'remarks' => $g->remarks,
                        ]);

                        $classStudents = Student::where('class_id', $classId)->pluck('id');
                        $allAverages = Grade::whereIn('student_id', $classStudents)
                            ->where('term_id', $termId)
                            ->get()
                            ->groupBy('student_id')
                            ->map(fn($gs) => $gs->avg('score'))
                            ->sortDesc();
                        $position = $allAverages->search($avg) + 1;
                        $totalInClass = $allAverages->count();

                        $streamPosition = null;
                        if ($streamId) {
                            $streamStudentIds = Student::where('stream_id', $streamId)->pluck('id');
                            $streamAverages = Grade::whereIn('student_id', $streamStudentIds)
                                ->where('term_id', $termId)
                                ->get()
                                ->groupBy('student_id')
                                ->map(fn($gs) => $gs->avg('score'))
                                ->sortDesc();
                            $streamPosition = $streamAverages->search($avg) + 1;
                        }

                        $comment = StudentComment::where('student_id', $student->id)
                            ->where('term_id', $termId)->first();

                        $child['no_grades']       = false;
                        $child['grades']          = $gradesData;
                        $child['average']         = $avg ? round($avg, 1) : null;
                        $child['position']        = $position;
                        $child['total_in_class']  = $totalInClass;
                        $child['stream_position'] = $streamPosition;
                        $child['comment']         = $comment ? $comment->comment : null;
                        $child['class_name']      = $class->name;
                        $child['stream_name']     = $stream ? $stream->name : null;

                        if ($term && $this->isFinalTerm($termId)) {
                            $nextClass = ClassRoom::where('order', '>', $class->order)
                                ->orderBy('order')->first();
                            $child['promotion'] = $nextClass
                                ? ['promoted' => $avg >= 50, 'next_class' => $nextClass->name, 'next_opening_date' => $term->next_opening_date]
                                : ['promoted' => $avg >= 50, 'graduating' => true, 'next_opening_date' => $term->next_opening_date];
                        }
                    }
                }

                $children[] = $child;
            }
        }

        return response()->json([
            'children'     => $children,
            'bank_details' => BankDetail::all(),
        ]);
    }

    /**
     * Download a student's report card as PDF.
     */
    public function downloadReportCard(Request $request, $studentId)
    {
        $user = $request->user();
        $student = Student::with('class', 'stream')->findOrFail($studentId);

        $isGuardian = Guardian::where('user_id', $user->id)
            ->whereHas('students', fn($q) => $q->where('students.id', $studentId))
            ->exists();
        if (!$isGuardian) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        $termId = $request->term_id;
        $term   = Term::findOrFail($termId);
        $academicYear = $term->academicYear ? $term->academicYear->name : '';

        $class  = $student->class;
        $stream = $student->stream;
        $school = SchoolInformation::first();
        $logoBase64 = $this->getLogoBase64();

        // Try to get the published snapshot for this term
        $snapshot = PublishedReport::where('student_id', $studentId)
            ->where('term_id', $termId)
            ->first();

        // Determine assessment type
        if ($snapshot) {
            $assessmentType = $snapshot->assessment_type;
        } else {
            // Fallback – assume end_term
            $assessmentType = 'end_term';
        }

        if ($snapshot) {
            if ($class && $class->grading_type === 'skill') {
                $html = $this->generateSkillReportCardHtml(
                    $student,
                    $snapshot->grades,
                    $snapshot->comment,
                    $term,
                    $class,
                    $stream,
                    $school,
                    $logoBase64,
                    $academicYear,
                    $assessmentType
                );
            } else {
                $html = $this->generateNumericReportCardHtml(
                    $student,
                    $snapshot->grades,
                    $snapshot->average,
                    $snapshot->comment,
                    $term,
                    $class,
                    $stream,
                    $school,
                    $logoBase64,
                    $academicYear,
                    $assessmentType
                );
            }
        } else {
            // Dynamic fallback (numeric only)
            $grades = Grade::where('student_id', $studentId)
                ->where('term_id', $termId)
                ->with('subject:id,name')->get();

            if ($grades->isEmpty()) {
                return response()->json(['message' => 'No grades available for this term.'], 404);
            }

            $avg = $grades->avg('score');
            $comment = StudentComment::where('student_id', $studentId)
                ->where('term_id', $termId)->first();

            $html = $this->generateNumericReportCardHtml(
                $student,
                $grades,
                $avg,
                $comment,
                $term,
                $class,
                $stream,
                $school,
                $logoBase64,
                $academicYear,
                $assessmentType
            );
        }

        $pdf = Pdf::loadHTML($html);

        // Build filename: Report_FirstName_LastName_TermName_AssessmentType.pdf
        $assessmentLabel = $assessmentType === 'mid_term' ? 'MidTerm' : 'EndOfTerm';
        $fileName = 'Report_' . $student->first_name . '_' . $student->last_name . '_' . $term->name . '_' . $assessmentLabel . '.pdf';
        // Remove spaces from filename for safety
        $fileName = str_replace(' ', '_', $fileName);

        return $pdf->download($fileName);
    }

    // -------------------------------------------------
    // HELPERS
    // -------------------------------------------------
    private function isFinalTerm($termId)
    {
        $term = Term::findOrFail($termId);
        $academicYear = $term->academicYear;
        if (!$academicYear) return false;
        $terms = $academicYear->terms()->orderBy('end_date')->get();
        return $terms->last()->id === $term->id;
    }

    private function getPromotionInfo($student, $class, $report)
    {
        $threshold = 50;
        $promoted = false;

        if ($class->grading_type === 'numeric') {
            $avg = $report->average;
            $promoted = $avg !== null && $avg >= $threshold;
        } else {
            // Skill‑based: promoted if report exists
            $promoted = true;
        }

        $nextClass = $promoted ? ClassRoom::where('order', '>', $class->order)->orderBy('order')->first() : null;
        $graduating = $promoted && !$nextClass;

        $nextOpeningDate = Term::find($report->term_id)->next_opening_date ?? null;

        return [
            'promoted'          => $promoted,
            'next_class'        => $nextClass ? $nextClass->name : null,
            'graduating'        => $graduating,
            'next_opening_date' => $nextOpeningDate
                ? \Carbon\Carbon::parse($nextOpeningDate)->format('d M Y')
                : null,
        ];
    }

    private function getLogoBase64()
    {
        $school = SchoolInformation::first();
        if ($school && $school->logo) {
            $path = storage_path('app/public/' . $school->logo);
            if (file_exists($path)) {
                $mime = mime_content_type($path);
                $data = base64_encode(file_get_contents($path));
                return 'data:' . $mime . ';base64,' . $data;
            }
        }
        return null;
    }

    private function buildContactHtml($school)
    {
        $lines = [];
        if ($school) {
            if ($school->postal_address) {
                $lines[] = $school->postal_address;
            }
            $phones = [];
            if ($school->phone_primary) $phones[] = $school->phone_primary;
            if ($school->phone_secondary) $phones[] = $school->phone_secondary;
            if (!empty($phones)) {
                $lines[] = 'Phone: ' . implode(' | ', $phones);
            }
            $emails = [];
            if ($school->email_primary) $emails[] = $school->email_primary;
            if ($school->email_secondary) $emails[] = $school->email_secondary;
            if (!empty($emails)) {
                $lines[] = 'Email: ' . implode(' | ', $emails);
            }
        }
        return implode('<br>', $lines);
    }

    /**
     * Generate numeric report card HTML.
     */
    private function generateNumericReportCardHtml($student, $grades, $avgScore, $comment, $term, $class, $stream, $school, $logoBase64, $academicYear = '', $assessmentType = 'end_term')
    {
        $contactHtml = $this->buildContactHtml($school);

        $gradesTable = '';
        foreach ($grades as $g) {
            $subject = is_object($g) ? $g->subject : ($g['subject'] ?? '');
            $score   = is_object($g) ? $g->score : ($g['score'] ?? '');
            $grade   = is_object($g) ? $g->grade : ($g['grade'] ?? '');
            $remarks = is_object($g) ? $g->remarks : ($g['remarks'] ?? '');
            $gradesTable .= '<tr>
                <td>' . $subject . '</td>
                <td>' . ($score ?? '-') . '</td>
                <td>' . ($grade ?? '-') . '</td>
                <td>' . ($remarks ?? '-') . '</td>
            </tr>';
        }

        $content = '<div class="grades-section">
                <div class="section-title">Grades</div>
                <table>
                    <thead><tr><th>Subject</th><th>Score</th><th>Grade</th><th>Remarks</th></tr></thead>
                    <tbody>' . $gradesTable . '</tbody>
                </table>
                <div style="margin-top:20px;">
                    <span class="label">Average Score:</span> <span class="value">' . round($avgScore, 1) . '</span>
                </div>
            </div>';

        $teacherComment = is_object($comment) ? ($comment->comment ?? '') : ($comment['comment'] ?? '');

        return $this->baseHtml(
            $student, $term, $class, $stream, $school, $logoBase64, $contactHtml,
            $content, $teacherComment, $academicYear, $assessmentType
        );
    }

    /**
     * Generate skill‑based report card HTML.
     */
    private function generateSkillReportCardHtml($student, $skills, $comment, $term, $class, $stream, $school, $logoBase64, $academicYear = '', $assessmentType = 'end_term')
    {
        $contactHtml = $this->buildContactHtml($school);

        // Group skills by competency
        $competencies = [];
        if (is_array($skills) || is_object($skills)) {
            foreach ($skills as $skill) {
                $skill = (array) $skill;
                $compName = $skill['competency'] ?? 'General';
                if (!isset($competencies[$compName])) {
                    $competencies[$compName] = [
                        'description' => $skill['competency_description'] ?? '',
                        'skills'      => [],
                    ];
                }
                $competencies[$compName]['skills'][] = $skill;
            }
        }

        $skillsHtml = '';
        foreach ($competencies as $compName => $compData) {
            $skillsHtml .= '<div style="margin-bottom:20px;">
                <h3 style="font-size:16px; font-weight:600; color:#1e40af; margin-bottom:4px;">' . $compName . '</h3>';
            if (!empty($compData['description'])) {
                $skillsHtml .= '<p style="font-size:12px; color:#64748b; margin-bottom:10px;">' . $compData['description'] . '</p>';
            }
            $skillsHtml .= '<table>
                    <thead><tr><th>Skill</th><th>Description</th><th>Rating</th><th>Comment</th></tr></thead>
                    <tbody>';
            foreach ($compData['skills'] as $s) {
                $skillsHtml .= '<tr>
                    <td>' . ($s['skill'] ?? '') . '</td>
                    <td>' . ($s['skill_description'] ?? '') . '</td>
                    <td>' . ($s['rating'] ?? '-') . '</td>
                    <td>' . ($s['comment'] ?? '') . '</td>
                </tr>';
            }
            $skillsHtml .= '</tbody></table></div>';
        }

        $content = '<div class="grades-section">
                <div class="section-title">Skill Assessments</div>
                ' . $skillsHtml . '
            </div>';

        $teacherComment = is_object($comment) ? ($comment->comment ?? '') : ($comment['comment'] ?? '');

        return $this->baseHtml(
            $student, $term, $class, $stream, $school, $logoBase64, $contactHtml,
            $content, $teacherComment, $academicYear, $assessmentType
        );
    }

    /**
     * Shared HTML skeleton.
     */
    private function baseHtml($student, $term, $class, $stream, $school, $logoBase64, $contactHtml, $content, $teacherComment, $academicYear = '', $assessmentType = 'end_term')
    {
        $assessmentLabel = $assessmentType === 'mid_term' ? 'Mid-Term Report' : 'End of Term Report';

        $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Report Card</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:"Inter", "Segoe UI", sans-serif; background:#f8fafc; color:#1e293b; padding:40px 20px; }
            .card { max-width:800px; margin:0 auto; background:#fff; border-radius:20px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.05); overflow:hidden; }
            .header { padding:30px 40px 20px; border-bottom:1px solid #e2e8f0; text-align:center; }
            .school-logo { width:80px; height:80px; object-fit:contain; margin-bottom:15px; }
            .school-name { font-size:24px; font-weight:700; color:#0f172a; margin-bottom:8px; }
            .school-contact { font-size:13px; color:#64748b; line-height:1.6; }
            .report-type { margin-top:10px; font-size:18px; font-weight:600; color:#2563eb; }
            .student-section { padding:20px 40px; background:#f8fafc; border-bottom:1px solid #f1f5f9; display:flex; gap:40px; flex-wrap:wrap; }
            .student-section div { flex:1; min-width:120px; }
            .label { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:4px; }
            .value { font-size:16px; font-weight:600; color:#0f172a; }
            .grades-section { padding:20px 40px; }
            .section-title { font-size:18px; font-weight:700; color:#0f172a; margin-bottom:20px; }
            table { width:100%; border-collapse:collapse; }
            th { background:#f1f5f9; padding:12px 16px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:#475569; font-weight:600; }
            td { padding:14px 16px; font-size:15px; border-bottom:1px solid #f1f5f9; }
            .comment-box { padding:0 40px 30px; }
            .footer { padding:20px 40px; border-top:1px solid #f1f5f9; background:#f8fafc; text-align:center; font-size:12px; color:#94a3b8; }
        </style></head><body>
        <div class="card">
            <div class="header">';
            if ($logoBase64) {
                $html .= '<img src="' . $logoBase64 . '" class="school-logo" alt="Logo">';
            }
            $html .= '<div class="school-name">' . ($school->school_name ?? 'School Name') . '</div>
                <div class="school-contact">' . $contactHtml . '</div>
                <div class="report-type">' . $assessmentLabel . '</div>
            </div>

            <div class="student-section">
                <div>
                    <div class="label">Student</div>
                    <div class="value">' . $student->first_name . ' ' . $student->last_name . '</div>
                </div>
                <div>
                    <div class="label">Student Number</div>
                    <div class="value">' . $student->student_number . '</div>
                </div>
                <div>
                    <div class="label">Class</div>
                    <div class="value">' . $class->name . ($stream ? ' (' . $stream->name . ')' : '') . '</div>
                </div>
                <div>
                    <div class="label">Term</div>
                    <div class="value">' . $term->name . '</div>
                </div>';
            if ($academicYear) {
                $html .= '<div>
                    <div class="label">Academic Year</div>
                    <div class="value">' . $academicYear . '</div>
                </div>';
            }
            $html .= '</div>
            ' . $content;

            if (!empty($teacherComment)) {
                $html .= '<div class="comment-box">
                    <div class="section-title">Class Teacher\'s Comment</div>
                    <p>' . nl2br(e($teacherComment)) . '</p>
                </div>';
            }

            $html .= '<div class="footer">' . ($school->school_name ?? '') . ' – ' . ($school->motto ?? '') . '<br>This report is computer-generated.</div>
        </div></body></html>';

        return $html;
    }
}