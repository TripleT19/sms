<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\PublishedReport;
use App\Models\SchoolInformation;
use App\Models\Student;
use App\Models\StudentComment;
use App\Models\Term;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use ZipArchive;

class AdminReportController extends Controller
{
    public function downloadBulk(Request $request)
    {
        $request->validate([
            'term_id'         => 'required|exists:terms,id',
            'assessment_type' => 'required|in:mid_term,end_term',
            'student_ids'     => 'nullable|array',
            'student_ids.*'   => 'exists:students,id',
            'class_id'        => 'nullable|exists:classes,id',
            'stream_id'       => 'nullable|exists:streams,id',
            'all_classes'     => 'nullable|boolean',
        ]);

        $term           = Term::findOrFail($request->term_id);
        $assessmentType = $request->assessment_type;
        $school         = SchoolInformation::first();
        $logoBase64     = $this->getLogoBase64();

        // Determine students
        if (!empty($request->student_ids)) {
            $students = Student::whereIn('id', $request->student_ids)->get();
        } elseif ($request->class_id) {
            $students = Student::where('class_id', $request->class_id)
                ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
                ->get();
        } else {
            $students = Student::all();
        }

        if ($students->isEmpty()) {
            return response()->json(['message' => 'No students found.'], 404);
        }

        $zipFileName = 'reports_' . now()->format('Ymd_His') . '.zip';
        $zipPath     = storage_path('app/' . $zipFileName);
        $zip         = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return response()->json(['message' => 'Could not create ZIP file.'], 500);
        }

        foreach ($students as $student) {
            $class  = $student->class;
            $stream = $student->stream;

            $snapshot = PublishedReport::where('student_id', $student->id)
                ->where('term_id', $term->id)
                ->where('assessment_type', $assessmentType)
                ->first();

            if ($snapshot) {
                if ($class && $class->grading_type === 'skill') {
                    $html = $this->generateSkillReportCardHtml(
                        $student, $snapshot->grades, $snapshot->comment,
                        $term, $class, $stream, $school, $logoBase64
                    );
                } else {
                    $html = $this->generateNumericReportCardHtml(
                        $student, $snapshot->grades, $snapshot->average,
                        $snapshot->comment, $term, $class, $stream, $school, $logoBase64
                    );
                }
            } else {
                if ($class && $class->grading_type === 'skill') continue;

                $grades = Grade::where('student_id', $student->id)
                    ->where('term_id', $term->id)
                    ->where('assessment_type', $assessmentType)
                    ->with('subject:id,name')
                    ->get();

                if ($grades->isEmpty()) continue;

                $avg     = $grades->avg('score');
                $comment = StudentComment::where('student_id', $student->id)
                    ->where('term_id', $term->id)
                    ->first();

                $html = $this->generateNumericReportCardHtml(
                    $student, $grades, $avg, $comment,
                    $term, $class, $stream, $school, $logoBase64
                );
            }

            $pdf      = Pdf::loadHTML($html);
            $fileName = $this->sanitizeFileName(
                "Report_{$student->first_name}_{$student->last_name}_{$term->name}_{$assessmentType}.pdf"
            );
            $zip->addFromString($fileName, $pdf->output());
        }

        $zip->close();

        return response()->download($zipPath)->deleteFileAfterSend(true);
    }

    /**
     * Safely extract a value from an item that may be a string, array, object,
     * or a JSON string representing an array/object.
     */
    private function getValue($item, $key, $default = '')
    {
        $val = null;

        if (is_object($item)) {
            $val = $item->{$key} ?? $default;
        } elseif (is_array($item)) {
            $val = $item[$key] ?? $default;
        } else {
            // Might be a JSON string
            if (is_string($item) && ($json = json_decode($item, true)) !== null) {
                $val = $json[$key] ?? $default;
            } else {
                return $default;
            }
        }

        // If the extracted value is an array/object with a 'name' key, return that
        if (is_array($val) && array_key_exists('name', $val)) {
            return $val['name'];
        }
        if (is_object($val) && isset($val->name)) {
            return $val->name;
        }

        return $val ?? $default;
    }

    // ------------------------------------------------------------
    // PDF helpers (same as ParentController)
    // ------------------------------------------------------------
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
            if ($school->postal_address) $lines[] = $school->postal_address;
            $phones = [];
            if ($school->phone_primary) $phones[] = $school->phone_primary;
            if ($school->phone_secondary) $phones[] = $school->phone_secondary;
            if (!empty($phones)) $lines[] = 'Phone: ' . implode(' | ', $phones);
            $emails = [];
            if ($school->email_primary) $emails[] = $school->email_primary;
            if ($school->email_secondary) $emails[] = $school->email_secondary;
            if (!empty($emails)) $lines[] = 'Email: ' . implode(' | ', $emails);
        }
        return implode('<br>', $lines);
    }

    private function generateNumericReportCardHtml($student, $grades, $avgScore, $comment, $term, $class, $stream, $school, $logoBase64)
    {
        $contactHtml = $this->buildContactHtml($school);
        $gradesTable = '';

        foreach ($grades as $g) {
            $subject = $this->getValue($g, 'subject', '');
            $score   = $this->getValue($g, 'score', '');
            $grade   = $this->getValue($g, 'grade', '');
            $remarks = $this->getValue($g, 'remarks', '');

            $gradesTable .= '<tr>
                <td>' . e($subject) . '</td>
                <td>' . ($score !== '' ? $score : '-') . '</td>
                <td>' . ($grade !== '' ? $grade : '-') . '</td>
                <td>' . ($remarks !== '' ? $remarks : '-') . '</td>
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
            $content, $teacherComment
        );
    }

    private function generateSkillReportCardHtml($student, $skills, $comment, $term, $class, $stream, $school, $logoBase64)
    {
        $contactHtml = $this->buildContactHtml($school);

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
                <h3 style="font-size:16px; font-weight:600; color:#1e40af; margin-bottom:4px;">' . e($compName) . '</h3>';
            if (!empty($compData['description'])) {
                $skillsHtml .= '<p style="font-size:12px; color:#64748b; margin-bottom:10px;">' . e($compData['description']) . '</p>';
            }
            $skillsHtml .= '<table>
                    <thead><tr><th>Skill</th><th>Description</th><th>Rating</th><th>Comment</th></tr></thead>
                    <tbody>';
            foreach ($compData['skills'] as $s) {
                $skillsHtml .= '<tr>
                    <td>' . e($s['skill'] ?? '') . '</td>
                    <td>' . e($s['skill_description'] ?? '') . '</td>
                    <td>' . e($s['rating'] ?? '-') . '</td>
                    <td>' . e($s['comment'] ?? '') . '</td>
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
            $content, $teacherComment
        );
    }

    private function baseHtml($student, $term, $class, $stream, $school, $logoBase64, $contactHtml, $content, $teacherComment)
    {
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
            $html .= '<div class="school-name">' . e($school->school_name ?? 'School Name') . '</div>
                <div class="school-contact">' . $contactHtml . '</div>
            </div>

            <div class="student-section">
                <div>
                    <div class="label">Student</div>
                    <div class="value">' . e($student->first_name . ' ' . $student->last_name) . '</div>
                </div>
                <div>
                    <div class="label">Student Number</div>
                    <div class="value">' . e($student->student_number) . '</div>
                </div>
                <div>
                    <div class="label">Class</div>
                    <div class="value">' . e($class->name . ($stream ? ' (' . $stream->name . ')' : '')) . '</div>
                </div>
                <div>
                    <div class="label">Term</div>
                    <div class="value">' . e($term->name) . '</div>
                </div>
            </div>
            ' . $content;

            if (!empty($teacherComment)) {
                $html .= '<div class="comment-box">
                    <div class="section-title">Class Teacher\'s Comment</div>
                    <p>' . nl2br(e($teacherComment)) . '</p>
                </div>';
            }

            $html .= '<div class="footer">' . e($school->school_name ?? '') . ' – ' . e($school->motto ?? '') . '<br>This report is computer-generated.</div>
        </div></body></html>';

        return $html;
    }

    private function sanitizeFileName($name)
    {
        return str_replace(['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>', ' '], '_', $name);
    }
}