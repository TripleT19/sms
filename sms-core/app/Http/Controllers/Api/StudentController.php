<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Guardian;
use App\Models\ClassRoom;
use App\Models\Stream;
use App\Models\User;
use App\Models\Role;
use App\Notifications\GuardianAccountNotification;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class StudentController extends Controller
{
    use LogsActivity;

    /**
     * List students grouped by class.
     */
    public function index(Request $request)
    {
        $query = Student::with([
            'class:id,name',
            'stream:id,name',
            'guardians'
        ]);

        if ($request->class_id) {
            $query->where('class_id', $request->class_id);
        }

        $students = $query->get()->groupBy('class_id');

        return response()->json($students);
    }

    /**
     * Prepare data – convert empty strings to null for nullable fields.
     */
    protected function prepareForValidation(Request $request)
    {
        // stream_id
        if ($request->has('stream_id') && $request->input('stream_id') === '') {
            $request->merge(['stream_id' => null]);
        }

        // guardians – clean empty email/phone etc.
        if ($request->has('guardians')) {
            $guardians = $request->input('guardians');
            foreach ($guardians as &$guardian) {
                $guardian['email']   = empty($guardian['email'])   ? null : $guardian['email'];
                $guardian['phone']   = empty($guardian['phone'])   ? null : $guardian['phone'];
                $guardian['alt_phone'] = empty($guardian['alt_phone']) ? null : $guardian['alt_phone'];
                $guardian['occupation'] = empty($guardian['occupation']) ? null : $guardian['occupation'];
                $guardian['residential_address'] = empty($guardian['residential_address']) ? null : $guardian['residential_address'];
            }
            $request->merge(['guardians' => $guardians]);
        }
    }

    /**
     * Store a new student with all details and guardians.
     */
    public function store(Request $request)
    {
        $this->prepareForValidation($request);

        $validated = $request->validate([
            // Personal
            'first_name'       => 'required|string|max:255',
            'middle_name'      => 'nullable|string|max:255',
            'last_name'        => 'required|string|max:255',
            'preferred_name'   => 'nullable|string|max:255',
            'gender'           => 'required|in:Male,Female',
            'date_of_birth'    => 'nullable|date',
            'nationality'      => 'nullable|string|max:100',

            // Enrollment
            'admission_date'   => 'nullable|date',
            'class_id'         => 'required|exists:classes,id',
            'stream_id'        => 'nullable|exists:streams,id',
            'academic_year'    => 'nullable|string|max:20',
            'enrollment_status'=> 'required|in:Active,Graduated,Transferred,Suspended,Withdrawn',
            'auto_assign'      => 'boolean',

            // Contact
            'residential_address'=> 'nullable|string',
            'city_town'         => 'nullable|string|max:100',
            'district_region'   => 'nullable|string|max:100',
            'student_phone'     => 'nullable|string|max:20',
            'student_email'     => 'nullable|email',

            // Medical
            'blood_group'          => 'nullable|string|max:5',
            'allergies'            => 'nullable|string',
            'medical_conditions'   => 'nullable|string',
            'disabilities'         => 'nullable|string',
            'current_medication'   => 'nullable|string',
            'emergency_medical_notes'=> 'nullable|string',

            // Transport
            'uses_school_transport'=> 'boolean',
            'pickup_location'      => 'nullable|string',
            'transport_route'      => 'nullable|string',
            'bus_number'           => 'nullable|string',

            // Guardians
            'guardians'                   => 'array',
            'guardians.*.id'              => 'nullable|integer|exists:guardians,id',
            'guardians.*.user_id'         => 'nullable|exists:users,id',
            'guardians.*.first_name'      => 'required|string|max:255',
            'guardians.*.last_name'       => 'required|string|max:255',
            'guardians.*.relationship'    => 'required|string|max:50',
            'guardians.*.phone'           => 'nullable|string|max:20',
            'guardians.*.alt_phone'       => 'nullable|string|max:20',
            'guardians.*.email'           => 'nullable|email',
            'guardians.*.occupation'      => 'nullable|string|max:100',
            'guardians.*.residential_address'=> 'nullable|string',
            'guardians.*.is_emergency_contact'=> 'boolean',
            'guardians.*.create_account'  => 'boolean',
        ]);

        // Auto-assign stream if requested
        if ($request->auto_assign && $request->has('class_id')) {
            $validated['stream_id'] = $this->autoAssignStream($validated['class_id'], $validated['gender']);
        }

        // Generate student number
        $validated['student_number'] = $this->generateStudentNumber($validated['class_id']);

        // Handle photo upload (if added)
        if ($request->hasFile('photo')) {
            $validated['photo'] = $request->file('photo')->store('students/photos', 'public');
            $validated['photo_upload_date'] = now();
        }

        $student = Student::create($validated);

        // Process guardians
        $guardianIds = [];
        foreach ($request->guardians as $guardianData) {
            // Ensure empty strings are null for optional fields
            $guardianData = array_map(function ($value) {
                return $value === '' ? null : $value;
            }, $guardianData);

            if (!empty($guardianData['id'])) {
                $guardian = Guardian::find($guardianData['id']);
                if ($guardian) {
                    $guardian->update([
                        'first_name'   => $guardianData['first_name'],
                        'last_name'    => $guardianData['last_name'],
                        'relationship' => $guardianData['relationship'],
                        'phone'        => $guardianData['phone'] ?? null,
                        'alt_phone'    => $guardianData['alt_phone'] ?? null,
                        'email'        => $guardianData['email'] ?? null,
                        'occupation'   => $guardianData['occupation'] ?? null,
                        'residential_address' => $guardianData['residential_address'] ?? null,
                        'is_emergency_contact' => $guardianData['is_emergency_contact'] ?? false,
                    ]);
                }
            } else {
                $guardian = Guardian::create([
                    'user_id'       => $guardianData['user_id'] ?? null,
                    'first_name'    => $guardianData['first_name'],
                    'last_name'     => $guardianData['last_name'],
                    'relationship'  => $guardianData['relationship'],
                    'phone'         => $guardianData['phone'] ?? null,
                    'alt_phone'     => $guardianData['alt_phone'] ?? null,
                    'email'         => $guardianData['email'] ?? null,
                    'occupation'    => $guardianData['occupation'] ?? null,
                    'residential_address' => $guardianData['residential_address'] ?? null,
                    'is_emergency_contact' => $guardianData['is_emergency_contact'] ?? false,
                ]);

                // Create user account if requested and email provided
                if (!empty($guardianData['create_account']) && !empty($guardianData['email'])) {
                    $user = User::where('email', $guardianData['email'])->first();
                    if (!$user) {
                        $username = Str::slug($guardianData['first_name'] . '.' . $guardianData['last_name']);
                        $baseUsername = $username;
                        $counter = 1;
                        while (User::where('username', $username)->exists()) {
                            $username = $baseUsername . $counter;
                            $counter++;
                        }
                        $user = User::create([
                            'first_name' => $guardianData['first_name'],
                            'last_name'  => $guardianData['last_name'],
                            'name'       => $guardianData['first_name'] . ' ' . $guardianData['last_name'],
                            'email'      => $guardianData['email'],
                            'username'   => $username,
                            'password'   => Hash::make(Str::random(16)),
                        ]);
                        $parentRole = Role::where('name', 'Parent')->first();
                        if ($parentRole) {
                            $user->roles()->sync([$parentRole->id]);
                        }
                    }
                    // Generate password reset token and send custom notification
                    $token = Password::createToken($user);
                    $studentName = $student->first_name . ' ' . $student->last_name;
                    $user->notify(new GuardianAccountNotification($token, $studentName));

                    $guardian->user_id = $user->id;
                    $guardian->save();
                }
            }
            $guardianIds[] = $guardian->id;
        }

        $student->guardians()->sync($guardianIds);

        $this->log('student_created', "Student {$student->first_name} {$student->last_name} enrolled");

        return response()->json($student->load(['class', 'stream', 'guardians']), 201);
    }

    /**
     * Update a student (similar to store).
     */
    public function update(Request $request, $id)
    {
        $student = Student::findOrFail($id);
        $this->prepareForValidation($request);

        $validated = $request->validate([
            // same as store, but with student_number unique ignoring current
            'first_name'       => 'sometimes|string|max:255',
            'middle_name'      => 'nullable|string|max:255',
            'last_name'        => 'sometimes|string|max:255',
            'preferred_name'   => 'nullable|string|max:255',
            'gender'           => 'sometimes|in:Male,Female',
            'date_of_birth'    => 'nullable|date',
            'nationality'      => 'nullable|string|max:100',
            'admission_date'   => 'nullable|date',
            'class_id'         => 'sometimes|exists:classes,id',
            'stream_id'        => 'nullable|exists:streams,id',
            'academic_year'    => 'nullable|string|max:20',
            'enrollment_status'=> 'sometimes|in:Active,Graduated,Transferred,Suspended,Withdrawn',
            'auto_assign'      => 'boolean',
            'student_number'   => 'nullable|string|unique:students,student_number,' . $student->id,
            'residential_address'=> 'nullable|string',
            'city_town'         => 'nullable|string|max:100',
            'district_region'   => 'nullable|string|max:100',
            'student_phone'     => 'nullable|string|max:20',
            'student_email'     => 'nullable|email',
            'blood_group'       => 'nullable|string|max:5',
            'allergies'         => 'nullable|string',
            'medical_conditions'=> 'nullable|string',
            'disabilities'      => 'nullable|string',
            'current_medication'=> 'nullable|string',
            'emergency_medical_notes'=> 'nullable|string',
            'uses_school_transport'=> 'boolean',
            'pickup_location'   => 'nullable|string',
            'transport_route'   => 'nullable|string',
            'bus_number'        => 'nullable|string',
            'guardians'         => 'array',
            'guardians.*.id'    => 'nullable|integer|exists:guardians,id',
            'guardians.*.user_id'=> 'nullable|exists:users,id',
            'guardians.*.first_name'   => 'required|string|max:255',
            'guardians.*.last_name'    => 'required|string|max:255',
            'guardians.*.relationship' => 'required|string|max:50',
            'guardians.*.phone'        => 'nullable|string|max:20',
            'guardians.*.alt_phone'    => 'nullable|string|max:20',
            'guardians.*.email'        => 'nullable|email',
            'guardians.*.occupation'   => 'nullable|string|max:100',
            'guardians.*.residential_address'=> 'nullable|string',
            'guardians.*.is_emergency_contact'=> 'boolean',
            'guardians.*.create_account'=> 'boolean',
        ]);

        // Handle photo upload
        if ($request->hasFile('photo')) {
            $validated['photo'] = $request->file('photo')->store('students/photos', 'public');
            $validated['photo_upload_date'] = now();
        }

        // Auto-assign stream if requested
        if ($request->auto_assign && $request->has('class_id')) {
            $validated['stream_id'] = $this->autoAssignStream($validated['class_id'], $validated['gender']);
        }

        $student->update($validated);

        // Sync guardians
        if ($request->has('guardians')) {
            $guardianIds = [];
            foreach ($request->guardians as $guardianData) {
                $guardianData = array_map(function ($value) {
                    return $value === '' ? null : $value;
                }, $guardianData);

                if (!empty($guardianData['id'])) {
                    $guardian = Guardian::find($guardianData['id']);
                    if ($guardian) {
                        $guardian->update([
                            'first_name'   => $guardianData['first_name'],
                            'last_name'    => $guardianData['last_name'],
                            'relationship' => $guardianData['relationship'],
                            'phone'        => $guardianData['phone'] ?? null,
                            'alt_phone'    => $guardianData['alt_phone'] ?? null,
                            'email'        => $guardianData['email'] ?? null,
                            'occupation'   => $guardianData['occupation'] ?? null,
                            'residential_address' => $guardianData['residential_address'] ?? null,
                            'is_emergency_contact' => $guardianData['is_emergency_contact'] ?? false,
                        ]);
                    }
                } else {
                    $guardian = Guardian::create([
                        'user_id'       => $guardianData['user_id'] ?? null,
                        'first_name'    => $guardianData['first_name'],
                        'last_name'     => $guardianData['last_name'],
                        'relationship'  => $guardianData['relationship'],
                        'phone'         => $guardianData['phone'] ?? null,
                        'alt_phone'     => $guardianData['alt_phone'] ?? null,
                        'email'         => $guardianData['email'] ?? null,
                        'occupation'    => $guardianData['occupation'] ?? null,
                        'residential_address' => $guardianData['residential_address'] ?? null,
                        'is_emergency_contact' => $guardianData['is_emergency_contact'] ?? false,
                    ]);

                    // Create user account if requested
                    if (!empty($guardianData['create_account']) && !empty($guardianData['email'])) {
                        $user = User::where('email', $guardianData['email'])->first();
                        if (!$user) {
                            $username = Str::slug($guardianData['first_name'] . '.' . $guardianData['last_name']);
                            $baseUsername = $username;
                            $counter = 1;
                            while (User::where('username', $username)->exists()) {
                                $username = $baseUsername . $counter;
                                $counter++;
                            }
                            $user = User::create([
                                'first_name' => $guardianData['first_name'],
                                'last_name'  => $guardianData['last_name'],
                                'name'       => $guardianData['first_name'] . ' ' . $guardianData['last_name'],
                                'email'      => $guardianData['email'],
                                'username'   => $username,
                                'password'   => Hash::make(Str::random(16)),
                            ]);
                            $parentRole = Role::where('name', 'Parent')->first();
                            if ($parentRole) {
                                $user->roles()->sync([$parentRole->id]);
                            }
                        }
                        $token = Password::createToken($user);
                        $studentName = $student->first_name . ' ' . $student->last_name;
                        $user->notify(new GuardianAccountNotification($token, $studentName));

                        $guardian->user_id = $user->id;
                        $guardian->save();
                    }
                }
                $guardianIds[] = $guardian->id;
            }
            $student->guardians()->sync($guardianIds);
        }

        return response()->json($student->load(['class', 'stream', 'guardians']));
    }

    /**
     * Delete a student.
     */
    public function destroy($id)
    {
        $student = Student::findOrFail($id);
        $student->delete();
        return response()->json(['message' => 'Student removed']);
    }

    /**
     * Import students from CSV (all fields).
     */
    public function import(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($handle); // skip header

        $imported = 0;
        while (($row = fgetcsv($handle)) !== false) {
            // Map CSV columns to fields (order matches the template)
            $data = [
                'first_name'       => $row[0] ?? null,
                'middle_name'      => $row[1] ?? null,
                'last_name'        => $row[2] ?? null,
                'preferred_name'   => $row[3] ?? null,
                'gender'           => $row[4] ?? 'Male',
                'date_of_birth'    => $row[5] ?? null,
                'nationality'      => $row[6] ?? null,
                'admission_date'   => $row[7] ?? now()->toDateString(),
                'class_name'       => $row[8] ?? null,
                'stream_name'      => $row[9] ?? null,
                'academic_year'    => $row[10] ?? null,
                'enrollment_status'=> $row[11] ?? 'Active',
                'residential_address' => $row[12] ?? null,
                'city_town'        => $row[13] ?? null,
                'district_region'  => $row[14] ?? null,
                'student_phone'    => $row[15] ?? null,
                'student_email'    => $row[16] ?? null,
                'blood_group'      => $row[17] ?? null,
                'allergies'        => $row[18] ?? null,
                'medical_conditions' => $row[19] ?? null,
                'disabilities'     => $row[20] ?? null,
                'current_medication' => $row[21] ?? null,
                'emergency_medical_notes' => $row[22] ?? null,
                'uses_school_transport' => ($row[23] ?? 'No') === 'Yes',
                'pickup_location'  => $row[24] ?? null,
                'transport_route'  => $row[25] ?? null,
                'bus_number'       => $row[26] ?? null,
            ];

            // Skip if missing first/last name or gender
            if (empty($data['first_name']) || empty($data['last_name']) || empty($data['gender'])) continue;

            // Find class
            $class = ClassRoom::where('name', $data['class_name'])->first();
            if (!$class) continue;

            // Find or create stream
            $streamId = null;
            if (!empty($data['stream_name'])) {
                $stream = Stream::firstOrCreate(['name' => $data['stream_name']]);
                $streamId = $stream->id;
            }

            // Generate student number
            $studentNumber = $this->generateStudentNumber($class->id);

            Student::create([
                'first_name'       => $data['first_name'],
                'middle_name'      => $data['middle_name'],
                'last_name'        => $data['last_name'],
                'preferred_name'   => $data['preferred_name'],
                'gender'           => $data['gender'],
                'date_of_birth'    => $data['date_of_birth'] ? date('Y-m-d', strtotime($data['date_of_birth'])) : null,
                'nationality'      => $data['nationality'],
                'admission_date'   => $data['admission_date'] ? date('Y-m-d', strtotime($data['admission_date'])) : now()->toDateString(),
                'class_id'         => $class->id,
                'stream_id'        => $streamId,
                'academic_year'    => $data['academic_year'],
                'enrollment_status'=> $data['enrollment_status'],
                'student_number'   => $studentNumber,
                'residential_address'=> $data['residential_address'],
                'city_town'        => $data['city_town'],
                'district_region'  => $data['district_region'],
                'student_phone'    => $data['student_phone'],
                'student_email'    => $data['student_email'],
                'blood_group'      => $data['blood_group'],
                'allergies'        => $data['allergies'],
                'medical_conditions'=> $data['medical_conditions'],
                'disabilities'     => $data['disabilities'],
                'current_medication'=> $data['current_medication'],
                'emergency_medical_notes' => $data['emergency_medical_notes'],
                'uses_school_transport' => $data['uses_school_transport'],
                'pickup_location'  => $data['pickup_location'],
                'transport_route'  => $data['transport_route'],
                'bus_number'       => $data['bus_number'],
            ]);
            $imported++;
        }
        fclose($handle);

        return response()->json(['message' => "{$imported} students imported."]);
    }

    /**
     * Download CSV template with all fields and sample data.
     */
    public function downloadTemplate()
    {
        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="student_import_template.csv"',
        ];

        // Column headers (same order as import mapping)
        $columns = [
            'first_name', 'middle_name', 'last_name', 'preferred_name',
            'gender', 'date_of_birth', 'nationality', 'admission_date',
            'class_name', 'stream_name', 'academic_year', 'enrollment_status',
            'residential_address', 'city_town', 'district_region',
            'student_phone', 'student_email',
            'blood_group', 'allergies', 'medical_conditions', 'disabilities',
            'current_medication', 'emergency_medical_notes',
            'uses_school_transport', 'pickup_location', 'transport_route', 'bus_number',
        ];

        // Sample data rows
        $sampleRows = [
            [
                'John', 'Edward', 'Doe', 'Johnny',
                'Male', '2010-05-12', 'Malawian', date('Y-m-d'),
                'Grade 1', 'East', '2026/2027', 'Active',
                '123 Main St', 'Lilongwe', 'Central',
                '0888123456', 'john.doe@example.com',
                'A+', 'Peanuts', 'Asthma', 'None', 'Inhaler', 'Carry inhaler at all times',
                'Yes', 'Main Gate', 'Route 1', 'BUS-001',
            ],
            [
                'Jane', '', 'Smith', 'Janey',
                'Female', '2011-08-22', 'Malawian', date('Y-m-d'),
                'Grade 1', 'West', '2026/2027', 'Active',
                '456 Oak Ave', 'Blantyre', 'Southern',
                '0999234567', 'jane.smith@example.com',
                'B+', 'None', 'None', 'None', 'None', 'None',
                'No', '', '', '',
            ],
        ];

        $callback = function () use ($columns, $sampleRows) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);
            foreach ($sampleRows as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    // -------------------------
    // HELPERS
    // -------------------------
    private function generateStudentNumber($classId)
    {
        $class = ClassRoom::find($classId);
        $words = explode(' ', $class->name);
        $prefix = '';
        foreach ($words as $word) {
            $prefix .= strtoupper(substr($word, 0, 1));
        }
        $count = Student::where('class_id', $classId)->count() + 1;
        $number = $prefix . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
        while (Student::where('student_number', $number)->exists()) {
            $count++;
            $number = $prefix . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
        }
        return $number;
    }

    private function autoAssignStream($classId, $gender)
    {
        $streams = ClassRoom::find($classId)->streams;
        if ($streams->isEmpty()) return null;

        $counts = [];
        foreach ($streams as $stream) {
            $male = Student::where('class_id', $classId)->where('stream_id', $stream->id)->where('gender', 'Male')->count();
            $female = Student::where('class_id', $classId)->where('stream_id', $stream->id)->where('gender', 'Female')->count();
            $counts[$stream->id] = ['male' => $male, 'female' => $female, 'total' => $male + $female];
        }

        $targetStream = null;
        $minTotal = PHP_INT_MAX;
        $minGenderCount = PHP_INT_MAX;
        foreach ($counts as $streamId => $data) {
            $genderCount = $gender === 'Male' ? $data['male'] : $data['female'];
            if ($data['total'] < $minTotal || ($data['total'] === $minTotal && $genderCount < $minGenderCount)) {
                $minTotal = $data['total'];
                $minGenderCount = $genderCount;
                $targetStream = $streamId;
            }
        }
        return $targetStream;
    }
}