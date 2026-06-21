<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\AcademicController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\SchoolEventController;
use App\Http\Controllers\Api\GradeController;
use App\Http\Controllers\Api\FeeController;
use App\Http\Controllers\Api\SchoolInformationController;
use App\Http\Controllers\Api\NotificationController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

// ------------------------------
// PUBLIC ROUTES (no authentication)
// ------------------------------
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/password-reset', [AuthController::class, 'resetPassword']);
Route::get('/roles', [RoleController::class, 'index']);

// ------------------------------
// PROTECTED ROUTES (Sanctum)
// ------------------------------
Route::middleware('auth:sanctum')->group(function () {
    // Auth / Logout
    Route::post('/logout', [AuthController::class, 'logout']);

    // ✅ Changed: load user roles so frontend can build role‑based sidebar
    Route::get('/user', fn(Request $request) => $request->user()->load('roles'));

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::post('/profile/update', [ProfileController::class, 'update']);
    Route::post('/profile/change-password', [ProfileController::class, 'changePassword']);

    // User Management (search must be BEFORE the resource)
    Route::get('/users/search', [UserManagementController::class, 'search']);
    Route::apiResource('users', UserManagementController::class)->except(['show']);
    Route::post('/users/{user}/reset-password', [UserManagementController::class, 'resetPassword']);

    Route::get('/teacher/assignments', [AttendanceController::class, 'teacherAssignments']);
    Route::get('/attendance/students', [AttendanceController::class, 'index']);
    Route::get('/attendance/weeks', [AttendanceController::class, 'getWeeks']);
    Route::post('/attendance/mark', [AttendanceController::class, 'mark']);
    Route::get('/attendance/non-teaching-days', [AttendanceController::class, 'nonTeachingDays']);
    Route::post('/attendance/non-teaching-day/toggle', [AttendanceController::class, 'toggleNonTeachingDay']);

    Route::prefix('events')->group(function () {
        Route::get('/', [SchoolEventController::class, 'index']);
        Route::post('/', [SchoolEventController::class, 'store']);
        Route::put('/{id}', [SchoolEventController::class, 'update']);
        Route::delete('/{id}', [SchoolEventController::class, 'destroy']);
        Route::get('/teachers/list', [SchoolEventController::class, 'teachersList']);
    });

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    Route::get('/notifications/unread', [NotificationController::class, 'unreadList']);

    Route::prefix('grades')->group(function () {
        Route::get('/classes', [GradeController::class, 'teacherClasses']);
        Route::get('/allowed-subjects', [GradeController::class, 'allowedSubjects']);
        Route::get('/students', [GradeController::class, 'index']);
        Route::post('/save', [GradeController::class, 'store']);
        Route::get('/comments', [GradeController::class, 'comments']);
        Route::post('/comments', [GradeController::class, 'saveComment']);
        Route::post('/comments/submit', [GradeController::class, 'submitComments']);
        Route::post('/comments/publish', [GradeController::class, 'publishComments']);
        Route::get('/grading-status', [GradeController::class, 'gradingStatus']);
        Route::get('/download', [GradeController::class, 'download']);
        Route::post('/upload', [GradeController::class, 'upload']);
        Route::post('/comments/save-all', [GradeController::class, 'saveAllComments']);
        Route::get('/submission-status', [GradeController::class, 'submissionStatus']);
    });

    Route::prefix('fees')->group(function () {
        Route::get('/fee-types', [FeeController::class, 'feeTypes']);
        Route::post('/fee-types', [FeeController::class, 'storeFeeType']);
        Route::put('/fee-types/{id}', [FeeController::class, 'updateFeeType']);
        Route::delete('/fee-types/{id}', [FeeController::class, 'deleteFeeType']);
        Route::get('/students-by-class', [FeeController::class, 'studentsByClass']);
        Route::post('/assign-fees', [FeeController::class, 'assignFeesToStudent']);
        Route::get('/student-balances', [FeeController::class, 'studentBalances']);
        Route::post('/transfer-overpayment', [FeeController::class, 'transferOverpayment']);
        Route::post('/fees/reassign-mandatory', [FeeController::class, 'reassignMandatory']);
        Route::delete('/student-fee/{id}', [FeeController::class, 'deleteStudentFee']);
        Route::post('/ensure-mandatory', [FeeController::class, 'ensureMandatoryFees']);
        Route::put('/student-fee/{id}', [FeeController::class, 'updateStudentFee']);

        Route::get('/student-fees', [FeeController::class, 'studentFees']);
        Route::post('/assign', [FeeController::class, 'assignFee']);
        Route::post('/assign-class', [FeeController::class, 'assignFeeToClass']);

        Route::post('/payments', [FeeController::class, 'recordPayment']);

        Route::get('/invoice/{studentFeeId}/download', [FeeController::class, 'downloadInvoice']);
        // Route::get('/receipt/{paymentId}/download', [FeeController::class, 'downloadReceipt']);
        Route::get('/receipt/{studentFeeId}/download', [FeeController::class, 'downloadFeeReceipt']);

        Route::get('/check-mandatory', [FeeController::class, 'checkMandatoryFees']);

        Route::get('/bank-details', [FeeController::class, 'bankDetails']);
        Route::post('/bank-details', [FeeController::class, 'storeBankDetail']);
        Route::put('/bank-details/{id}', [FeeController::class, 'updateBankDetail']);
        Route::delete('/bank-details/{id}', [FeeController::class, 'deleteBankDetail']);
    });

    Route::get('/school-info', [SchoolInformationController::class, 'show']);
    Route::post('/school-info', [SchoolInformationController::class, 'update']);

    // -------------------------------------------------
    // ACADEMIC MANAGEMENT
    // -------------------------------------------------
    Route::prefix('academic')->group(function () {
        // Classes
        Route::get('/classes', [AcademicController::class, 'classes']);
        Route::post('/classes', [AcademicController::class, 'storeClass']);
        Route::put('/classes/{id}', [AcademicController::class, 'updateClass']);
        Route::delete('/classes/{id}', [AcademicController::class, 'deleteClass']);
        Route::post('/classes/{classId}/streams', [AcademicController::class, 'assignStreams']);
        Route::get('/classes/{classId}/streams', [AcademicController::class, 'classStreams']);
        Route::post('/classes/{classId}/subjects', [AcademicController::class, 'assignSubjects']);
        Route::post('/classes/{classId}/teachers', [AcademicController::class, 'assignClassTeachers']);

        // Streams
        Route::get('/streams', [AcademicController::class, 'streams']);
        Route::post('/streams', [AcademicController::class, 'storeStream']);
        Route::put('/streams/{id}', [AcademicController::class, 'updateStream']);
        Route::delete('/streams/{id}', [AcademicController::class, 'deleteStream']);

        // Teacher assignment to class‑stream pivot
        Route::post('/class-streams/{classStreamId}/teachers', [AcademicController::class, 'assignClassStreamTeachers']);

        // Subjects
        Route::get('/subjects', [AcademicController::class, 'subjects']);
        Route::post('/subjects', [AcademicController::class, 'storeSubject']);
        Route::put('/subjects/{id}', [AcademicController::class, 'updateSubject']);
        Route::delete('/subjects/{id}', [AcademicController::class, 'deleteSubject']);
        Route::get('/subjects/template', [AcademicController::class, 'downloadSubjectTemplate']);
        Route::post('/subjects/import', [AcademicController::class, 'importSubjects']);

        // Academic Years
        Route::get('/years', [AcademicController::class, 'years']);
        Route::post('/years', [AcademicController::class, 'storeYear']);
        Route::put('/years/{id}', [AcademicController::class, 'updateYear']);
        Route::delete('/years/{id}', [AcademicController::class, 'deleteYear']);

        // Terms
        Route::get('/terms/all', [AcademicController::class, 'allTerms']);
        Route::post('/terms', [AcademicController::class, 'storeTermStandalone']);
        Route::put('/terms/{termId}', [AcademicController::class, 'updateTerm']);
        Route::delete('/terms/{termId}', [AcademicController::class, 'deleteTerm']);

        // Teacher Subject Assignments (class/stream context)
        Route::get('/teacher-subjects', [AcademicController::class, 'teacherSubjectAssignments']);
        Route::post('/teacher-subjects', [AcademicController::class, 'storeTeacherSubjectAssignment']);
        Route::delete('/teacher-subjects/{id}', [AcademicController::class, 'deleteTeacherSubjectAssignment']);
        Route::get('/classes-with-streams', [AcademicController::class, 'classesWithStreams']);

        // Teachers list (all teaching roles)
        Route::get('/teachers', [AcademicController::class, 'teachersList']);
    });

    // -------------------------------------------------
    // STUDENT ENROLLMENT
    // -------------------------------------------------
    Route::prefix('students')->group(function () {
        Route::get('/', [StudentController::class, 'index']);
        Route::post('/', [StudentController::class, 'store']);
        Route::put('/{id}', [StudentController::class, 'update']);
        Route::delete('/{id}', [StudentController::class, 'destroy']);
        Route::post('/import', [StudentController::class, 'import']);
        Route::get('/template', [StudentController::class, 'downloadTemplate']);
    });
});