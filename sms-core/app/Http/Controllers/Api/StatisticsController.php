<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\PublishedReport;
use App\Models\Student;
use App\Models\StudentComment;
use App\Models\StudentFee;
use App\Models\Term;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StatisticsController extends Controller
{
    /**
     * Performance statistics – latest published term average scores per class.
     */
    public function performance(Request $request)
    {
        $term = $request->filled('term_id')
            ? Term::findOrFail($request->term_id)
            : Term::orderBy('end_date', 'desc')->first();

        if (!$term) {
            return response()->json([]);
        }

        $reports = PublishedReport::where('term_id', $term->id)
            ->where('assessment_type', 'end_term')
            ->with('student:id,class_id')
            ->get();

        $classStats = [];

        foreach ($reports as $report) {
            $classId = $report->student->class_id;
            if (!isset($classStats[$classId])) {
                $classStats[$classId] = ['total' => 0, 'count' => 0];
            }
            if ($report->average !== null) {
                $classStats[$classId]['total'] += $report->average;
                $classStats[$classId]['count']++;
            }
        }

        $result = [];
        foreach ($classStats as $classId => $stats) {
            $class = ClassRoom::find($classId);
            $result[] = [
                'class_id'   => $classId,
                'class_name' => $class ? $class->name : 'Unknown',
                'average'    => $stats['count'] > 0 ? round($stats['total'] / $stats['count'], 2) : null,
                'students'   => $stats['count'],
            ];
        }

        return response()->json([
            'term'    => $term->name,
            'classes' => $result,
        ]);
    }

    /**
     * Financial summary – total fees collected and outstanding per term.
     */
    public function financeSummary(Request $request)
    {
        $term = $request->filled('term_id')
            ? Term::findOrFail($request->term_id)
            : Term::orderBy('end_date', 'desc')->first();

        if (!$term) {
            return response()->json([]);
        }

        $fees = StudentFee::where('term_id', $term->id)->get();

        $totalAmount = $fees->sum('total_amount');
        $paidAmount  = $fees->sum('paid_amount');
        $balance     = $totalAmount - $paidAmount;

        return response()->json([
            'term'        => $term->name,
            'total_fees'  => $totalAmount,
            'collected'   => $paidAmount,
            'outstanding' => $balance,
        ]);
    }

    /**
     * Admin dashboard statistics.
     */
    public function adminStats(Request $request)
    {
        // Total counts
        $parents  = User::whereHas('roles', fn($q) => $q->where('name', 'Parent'))->count();
        $staff    = User::whereHas('roles', fn($q) => $q->whereNotIn('name', ['Parent', 'Student']))->count();
        $totalStudents = Student::count();
        $classes  = ClassRoom::count();

        // Active / inactive users (placeholder)
        $activeStaff   = $staff;
        $inactiveStaff = 0;

        // Find the current active term, or the most recent term that has started
        $currentTerm = Term::where('start_date', '<=', now())
            ->where('end_date', '>=', now())
            ->first();
        if (!$currentTerm) {
            $currentTerm = Term::where('start_date', '<=', now())
                ->orderByDesc('start_date')
                ->first();
        }

        // Submitted / published results (based on the latest term by end_date)
        $latestTerm       = Term::orderByDesc('end_date')->first();
        $submittedResults = StudentComment::where('term_id', $latestTerm?->id)
            ->whereNotNull('submitted_at')
            ->whereNull('published_at')
            ->distinct('class_id')
            ->count('class_id');
        $publishedResults = StudentComment::where('term_id', $latestTerm?->id)
            ->whereNotNull('published_at')
            ->distinct('class_id')
            ->count('class_id');

        // New students this term (admitted since the start of the current/active term)
        $newStudents = 0;
        if ($currentTerm) {
            $newStudents = Student::where('admission_date', '>=', $currentTerm->start_date)->count();
        }

        // Monthly admissions (all time, up to today)
        $admissions = Student::selectRaw("DATE_FORMAT(admission_date, '%Y-%m') as month, COUNT(*) as count")
            ->where('admission_date', '<=', now())
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn($item) => [
                'month' => Carbon::createFromFormat('Y-m', $item->month)->format('M Y'),
                'count' => $item->count,
            ]);

        // Cumulative student growth (total students at the end of each month)
        $cumulativeGrowth  = collect();
        $cumulative        = 0;
        $allStudentsByMonth = Student::selectRaw("DATE_FORMAT(admission_date, '%Y-%m') as month")
            ->where('admission_date', '<=', now())
            ->orderBy('admission_date')
            ->get()
            ->groupBy('month')
            ->map->count();

        $allStudentsByMonth->sortKeys()->each(function ($count, $month) use (&$cumulative, &$cumulativeGrowth) {
            $cumulative += $count;
            $cumulativeGrowth->push([
                'month' => Carbon::createFromFormat('Y-m', $month)->format('M Y'),
                'total' => $cumulative,
            ]);
        });

        return response()->json([
            'parents'            => $parents,
            'staff'              => $staff,
            'students'           => $totalStudents,       // total students
            'active_users'       => $activeStaff,
            'inactive_users'     => $inactiveStaff,
            'classes'            => $classes,
            'submitted_results'  => $submittedResults,
            'published_results'  => $publishedResults,
            'new_students'       => $newStudents,          // new this term
            'monthly_admissions' => $admissions->values(),
            'student_growth'     => $cumulativeGrowth->values(),
        ]);
    }
}