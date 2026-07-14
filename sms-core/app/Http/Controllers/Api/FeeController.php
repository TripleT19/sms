<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankDetail;
use App\Models\FeeType;
use App\Models\FeeTypeAmount;
use App\Models\StudentFee;
use App\Models\Payment;
use App\Models\OverpaymentTransfer;
use App\Models\Student;
use App\Models\ClassRoom;
use App\Models\Stream;
use App\Models\Term;
use App\Models\SchoolInformation;
use App\Traits\LogsActivity;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FeeController extends Controller
{
    use LogsActivity;

    private const CATEGORIES = ['School Fees', 'Bus Fare', 'Trip', 'School Fund', 'Other'];

    // -------------------------------------------------
    // FEE TYPES
    // -------------------------------------------------
    public function feeTypes()
    {
        $types = FeeType::with(['amounts.class', 'amounts.stream', 'class:id,name', 'stream:id,name'])->get();
        return response()->json($types);
    }

    public function storeFeeType(Request $request)
    {
        $validated = $request->validate([
            'name'          => 'required|string|max:255',
            'category'      => 'required|in:' . implode(',', self::CATEGORIES),
            'description'   => 'nullable|string',
            'is_mandatory'  => 'boolean',
            'class_id'      => 'nullable|exists:classes,id',
            'stream_id'     => 'nullable|exists:streams,id',
            'amounts'       => 'required|array|min:1',
            'amounts.*.class_id'  => 'nullable|exists:classes,id',
            'amounts.*.stream_id' => 'nullable|exists:streams,id',
            'amounts.*.location'  => 'nullable|string|max:255',
            'amounts.*.amount'    => 'required|numeric|min:0',
        ]);

        $feeType = FeeType::create([
            'name'          => $validated['name'],
            'category'      => $validated['category'],
            'description'   => $validated['description'] ?? null,
            'is_mandatory'  => $validated['is_mandatory'] ?? false,
            'class_id'      => $validated['class_id'] ?? null,
            'stream_id'     => $validated['stream_id'] ?? null,
            'has_variations'=> count($validated['amounts']) > 1 || !is_null($validated['amounts'][0]['class_id']),
        ]);

        foreach ($validated['amounts'] as $amt) {
            FeeTypeAmount::create([
                'fee_type_id' => $feeType->id,
                'location'    => $amt['location'] ?? null,
                'amount'      => $amt['amount'],
                'class_id'    => $amt['class_id'] ?? null,
                'stream_id'   => $amt['stream_id'] ?? null,
            ]);
        }

        $this->log('fee_type_created', "Fee type '{$feeType->name}' created by {$request->user()->email}");

        return response()->json($feeType->load('amounts'), 201);
    }

    public function updateFeeType(Request $request, $id)
    {
        $feeType = FeeType::findOrFail($id);
        $validated = $request->validate([
            'name'          => 'sometimes|string|max:255',
            'category'      => 'sometimes|in:' . implode(',', self::CATEGORIES),
            'description'   => 'nullable|string',
            'is_mandatory'  => 'sometimes|boolean',
            'class_id'      => 'nullable|exists:classes,id',
            'stream_id'     => 'nullable|exists:streams,id',
            'amounts'       => 'sometimes|array|min:1',
            'amounts.*.class_id'  => 'nullable|exists:classes,id',
            'amounts.*.stream_id' => 'nullable|exists:streams,id',
            'amounts.*.location'  => 'nullable|string|max:255',
            'amounts.*.amount'    => 'required|numeric|min:0',
        ]);

        $feeType->update($request->only(['name', 'category', 'description', 'is_mandatory', 'class_id', 'stream_id']));

        if ($request->has('amounts')) {
            $feeType->amounts()->delete();
            foreach ($validated['amounts'] as $amt) {
                FeeTypeAmount::create([
                    'fee_type_id' => $feeType->id,
                    'location'    => $amt['location'] ?? null,
                    'amount'      => $amt['amount'],
                    'class_id'    => $amt['class_id'] ?? null,
                    'stream_id'   => $amt['stream_id'] ?? null,
                ]);
            }
            $feeType->has_variations = count($validated['amounts']) > 1 || !is_null($validated['amounts'][0]['class_id']);
            $feeType->save();

            $feeType->load('amounts');
        }

        // Update all existing StudentFee records for this fee type using frozen class/stream
        $studentFees = StudentFee::where('fee_type_id', $feeType->id)->get();
        foreach ($studentFees as $sf) {
            $newAmount = $this->getAmountForClass($feeType, $sf->class_id, $sf->stream_id);
            if ($newAmount != $sf->total_amount) {
                $sf->total_amount = $newAmount;
                $sf->status = $sf->paid_amount >= $newAmount ? 'paid' : ($sf->paid_amount > 0 ? 'partial' : 'pending');
                $sf->save();
            }
        }

        $this->log('fee_type_updated', "Fee type '{$feeType->name}' updated by {$request->user()->email}");

        return response()->json($feeType->load('amounts'));
    }

    public function deleteFeeType(Request $request, $id)
    {
        $feeType = FeeType::findOrFail($id);
        $feeType->delete();

        $this->log('fee_type_deleted', "Fee type '{$feeType->name}' deleted by {$request->user()->email}");

        return response()->json(['message' => 'Fee type deleted']);
    }

    // -------------------------------------------------
    // STUDENTS BY CLASS
    // -------------------------------------------------
    public function studentsByClass(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
        ]);

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'first_name', 'last_name', 'student_number']);

        return response()->json($students);
    }

    // -------------------------------------------------
    // STUDENT FEES (term‑aware)
    // -------------------------------------------------
    public function studentFees(Request $request)
    {
        $request->validate([
            'class_id'   => 'nullable|exists:classes,id',
            'stream_id'  => 'nullable|exists:streams,id',
            'student_id' => 'nullable|exists:students,id',
            'term_id'    => 'nullable|exists:terms,id',
        ]);

        $query = StudentFee::with([
            'student:id,first_name,last_name,student_number',
            'feeType.amounts',
            'payments',
            'term:id,name',
        ]);

        if ($request->class_id) {
            $query->where('class_id', $request->class_id);   // frozen class
        }
        if ($request->stream_id) {
            $query->where('stream_id', $request->stream_id);
        }
        if ($request->student_id) {
            $query->where('student_id', $request->student_id);
        }
        if ($request->term_id) {
            $query->where('term_id', $request->term_id);
        }

        $fees = $query->get();
        return response()->json($fees);
    }

    // -------------------------------------------------
    // ENSURE MANDATORY FEES EXIST FOR A CLASS/TERM
    // -------------------------------------------------
    public function ensureMandatoryFees(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'required|exists:terms,id',
        ]);

        $feeTypes = FeeType::where('is_mandatory', true)
            ->where(function ($q) use ($request) {
                $q->whereNull('class_id')
                  ->orWhere('class_id', $request->class_id);
            })
            ->when($request->stream_id, fn($q) => $q->where(function ($q) use ($request) {
                $q->whereNull('stream_id')
                  ->orWhere('stream_id', $request->stream_id);
            }))
            ->get();

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'class_id', 'stream_id']);

        $created = 0;
        foreach ($students as $student) {
            foreach ($feeTypes as $feeType) {
                $amount = $this->getAmountForClass($feeType, $student->class_id, $student->stream_id);

                $exists = StudentFee::where('student_id', $student->id)
                    ->where('fee_type_id', $feeType->id)
                    ->where('term_id', $request->term_id)
                    ->exists();

                if (!$exists) {
                    StudentFee::create([
                        'student_id'  => $student->id,
                        'fee_type_id' => $feeType->id,
                        'total_amount'=> $amount,
                        'term_id'     => $request->term_id,
                        'class_id'    => $student->class_id,     // freeze
                        'stream_id'   => $student->stream_id,    // freeze
                        'status'      => 'pending',
                    ]);
                    $created++;
                }
            }
        }

        $this->log('mandatory_fees_ensured', "Mandatory fees ensured for class {$request->class_id}, term {$request->term_id} by {$request->user()->email}");

        return response()->json(['message' => "{$created} mandatory fee(s) created/verified."]);
    }

    // -------------------------------------------------
    // ASSIGN FEES (single student)
    // -------------------------------------------------
    public function assignFeesToStudent(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:students,id',
            'term_id'    => 'nullable|exists:terms,id',
            'fees'       => 'required|array|min:1',
            'fees.*.fee_type_id' => 'required|exists:fee_types,id',
            'fees.*.amount'      => 'required|numeric|min:0',
            'fees.*.location'    => 'nullable|string',
        ]);

        $studentId = $request->student_id;
        $termId    = $request->term_id;
        $student   = Student::find($studentId);
        $assigned  = [];

        foreach ($request->fees as $feeData) {
            $feeType = FeeType::find($feeData['fee_type_id']);

            $studentFee = StudentFee::updateOrCreate(
                [
                    'student_id'  => $studentId,
                    'fee_type_id' => $feeType->id,
                    'term_id'     => $termId,
                ],
                [
                    'total_amount' => $feeData['amount'],
                    'class_id'     => $student->class_id,
                    'stream_id'    => $student->stream_id,
                ]
            );

            $studentFee->status = $studentFee->paid_amount >= $studentFee->total_amount ? 'paid' :
                ($studentFee->paid_amount > 0 ? 'partial' : 'pending');
            $studentFee->save();

            $assigned[] = $studentFee->load('feeType.amounts', 'student', 'term');
        }

        $this->log('fees_assigned', "Fees assigned to student ID {$studentId} by {$request->user()->email}");

        return response()->json($assigned, 201);
    }

    // -------------------------------------------------
    // ASSIGN FEE TO CLASS
    // -------------------------------------------------
    public function assignFeeToClass(Request $request)
    {
        $request->validate([
            'class_id'    => 'required|exists:classes,id',
            'stream_id'   => 'nullable|exists:streams,id',
            'fee_type_id' => 'required|exists:fee_types,id',
            'term_id'     => 'nullable|exists:terms,id',
        ]);

        $feeType = FeeType::with('amounts')->find($request->fee_type_id);
        $amount  = $this->getAmountForClass($feeType, $request->class_id, $request->stream_id);

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->get(['id', 'class_id', 'stream_id']);

        $count = 0;
        foreach ($students as $student) {
            StudentFee::firstOrCreate(
                [
                    'student_id'  => $student->id,
                    'fee_type_id' => $feeType->id,
                    'term_id'     => $request->term_id,
                ],
                [
                    'total_amount' => $amount,
                    'class_id'     => $student->class_id,
                    'stream_id'    => $student->stream_id,
                    'status'       => 'pending',
                ]
            );
            $count++;
        }

        $this->log('fees_assigned_class', "Fee type ID {$request->fee_type_id} assigned to {$count} students by {$request->user()->email}");

        return response()->json(['message' => "Assigned to {$count} students"]);
    }

    // -------------------------------------------------
    // UPDATE PAID AMOUNT (adjustment)
    // -------------------------------------------------
    public function updateStudentFee(Request $request, $id)
    {
        $request->validate([
            'new_paid_amount' => 'required|numeric|min:0',
        ]);

        $fee = StudentFee::findOrFail($id);
        $oldPaid = $fee->paid_amount;
        $newPaid = $request->new_paid_amount;

        if ($newPaid > $fee->total_amount) {
            return response()->json(['message' => 'Paid amount cannot exceed the total fee amount.'], 422);
        }

        $fee->paid_amount = $newPaid;
        $fee->status = $newPaid >= $fee->total_amount ? 'paid' : ($newPaid > 0 ? 'partial' : 'pending');
        $fee->save();

        $this->log('student_fee_paid_amount_updated', "Fee ID {$id} paid amount changed from MK {$oldPaid} to MK {$newPaid} by {$request->user()->email}");

        return response()->json($fee->load('feeType', 'student', 'term'));
    }

    // -------------------------------------------------
    // DELETE STUDENT FEE (only if no payments and optional)
    // -------------------------------------------------
    public function deleteStudentFee(Request $request, $id)
    {
        $fee = StudentFee::with('feeType', 'payments')->findOrFail($id);

        if ($fee->payments()->exists()) {
            return response()->json(['message' => 'Cannot delete this fee because payments have already been recorded.'], 422);
        }

        if ($fee->feeType->is_mandatory) {
            return response()->json(['message' => 'Mandatory fees cannot be deleted.'], 422);
        }

        $fee->delete();

        $this->log('student_fee_deleted', "Student fee ID {$id} deleted by {$request->user()->email}");

        return response()->json(['message' => 'Fee assignment removed.']);
    }

    // -------------------------------------------------
    // PAYMENTS (with term‑order enforcement)
    // -------------------------------------------------
    public function recordPayment(Request $request)
    {
        $request->validate([
            'student_fee_id' => 'required|exists:student_fees,id',
            'amount'         => 'required|numeric|min:0.01',
            'payment_date'   => 'required|date',
            'method'         => 'nullable|string|max:50',
            'notes'          => 'nullable|string',
        ]);

        $studentFee = StudentFee::with('term')->findOrFail($request->student_fee_id);
        $studentId  = $studentFee->student_id;
        $termId     = $studentFee->term_id;

        // Check if there are earlier unpaid terms
        $earliestUnpaid = StudentFee::where('student_id', $studentId)
            ->where('status', '!=', 'paid')
            ->with('term')
            ->get()
            ->sortBy(fn($fee) => $fee->term->start_date)
            ->first();

        if ($earliestUnpaid && $earliestUnpaid->term_id !== $termId) {
            return response()->json([
                'message' => "Please clear fees for {$earliestUnpaid->term->name} before paying for this term.",
            ], 422);
        }

        $newPaid = $studentFee->paid_amount + $request->amount;

        if ($newPaid > $studentFee->total_amount) {
            return response()->json([
                'message'     => 'Payment exceeds the outstanding balance.',
                'overpayment' => $newPaid - $studentFee->total_amount,
            ], 422);
        }

        $receiptNumber = 'RCT-' . strtoupper(Str::random(8));
        $payment = Payment::create([
            'student_fee_id' => $studentFee->id,
            'term_id'        => $studentFee->term_id,
            'amount'         => $request->amount,
            'payment_date'   => $request->payment_date,
            'receipt_number' => $receiptNumber,
            'method'         => $request->method ?? 'Cash',
            'notes'          => $request->notes ?? null,
        ]);

        $studentFee->paid_amount = $newPaid;
        $studentFee->status = $newPaid >= $studentFee->total_amount ? 'paid' : 'partial';
        $studentFee->save();

        $this->log('payment_recorded', "Payment of {$request->amount} recorded for fee ID {$studentFee->id} by {$request->user()->email}");

        return response()->json($payment->load('studentFee'), 201);
    }

    // -------------------------------------------------
    // OVERPAYMENT TRANSFER
    // -------------------------------------------------
    public function transferOverpayment(Request $request)
    {
        $request->validate([
            'from_student_fee_id' => 'required|exists:student_fees,id',
            'to_student_fee_id'   => 'required|exists:student_fees,id|different:from_student_fee_id',
            'amount'              => 'required|numeric|min:0.01',
        ]);

        $fromFee = StudentFee::findOrFail($request->from_student_fee_id);
        $toFee   = StudentFee::findOrFail($request->to_student_fee_id);

        $overpayment = $fromFee->paid_amount - $fromFee->total_amount;
        if ($overpayment <= 0) {
            return response()->json(['message' => 'No overpayment available.'], 422);
        }
        if ($request->amount > $overpayment) {
            return response()->json(['message' => 'Transfer amount exceeds overpayment.'], 422);
        }

        $fromFee->paid_amount -= $request->amount;
        $fromFee->status = $fromFee->paid_amount >= $fromFee->total_amount ? 'paid' : ($fromFee->paid_amount > 0 ? 'partial' : 'pending');
        $fromFee->save();

        $toFee->paid_amount += $request->amount;
        $toFee->status = $toFee->paid_amount >= $toFee->total_amount ? 'paid' : ($toFee->paid_amount > 0 ? 'partial' : 'pending');
        $toFee->save();

        OverpaymentTransfer::create([
            'from_student_fee_id' => $fromFee->id,
            'to_student_fee_id'   => $toFee->id,
            'amount'              => $request->amount,
        ]);

        $this->log('overpayment_transferred', "Overpayment of {$request->amount} transferred from fee ID {$fromFee->id} to {$toFee->id} by {$request->user()->email}");

        return response()->json(['message' => 'Overpayment transferred.']);
    }

    // -------------------------------------------------
    // INVOICE / RECEIPT PDF DOWNLOADS
    // -------------------------------------------------
    public function downloadInvoice($studentFeeId)
    {
        $studentFee = StudentFee::with(['student.class', 'feeType', 'payments', 'term'])->findOrFail($studentFeeId);

        if (!$studentFee->invoice_number) {
            $studentFee->invoice_number = $this->generateInvoiceNumber($studentFee->id);
            $studentFee->save();
        }

        $html = $this->generateInvoiceHtml($studentFee);
        $pdf = Pdf::loadHTML($html);

        $student = $studentFee->student;
        $class = $student->class->name ?? 'Class';
        $fileName = 'Invoice_' . $student->first_name . '_' . $student->last_name . '_' . $class . '.pdf';

        return $pdf->download($fileName);
    }

    public function downloadFeeReceipt($studentFeeId)
    {
        $studentFee = StudentFee::with(['student.class', 'feeType', 'payments', 'term'])->findOrFail($studentFeeId);

        if ($studentFee->status !== 'paid') {
            return response()->json(['message' => 'Receipt available only when fee is fully paid.'], 422);
        }

        $html = $this->generateReceiptHtml($studentFee);
        $pdf = Pdf::loadHTML($html);

        $student = $studentFee->student;
        $class = $student->class->name ?? 'Class';
        $fileName = 'Receipt_' . $student->first_name . '_' . $student->last_name . '_' . $class . '.pdf';

        return $pdf->download($fileName);
    }

    // Legacy per‑payment receipt (kept for backward compatibility)
    public function downloadReceipt($paymentId)
    {
        $payment = Payment::with('studentFee.student', 'studentFee.feeType')->findOrFail($paymentId);
        $html = $this->generatePaymentReceiptHtml($payment);
        $pdf = Pdf::loadHTML($html);

        return $pdf->download('Receipt_' . $payment->receipt_number . '.pdf');
    }

    // -------------------------------------------------
    // MANDATORY CHECK
    // -------------------------------------------------
    public function checkMandatoryFees(Request $request)
    {
        $request->validate([
            'class_id'  => 'required|exists:classes,id',
            'stream_id' => 'nullable|exists:streams,id',
            'term_id'   => 'nullable|exists:terms,id',
        ]);

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->pluck('id');

        $query = StudentFee::whereIn('student_id', $students)
            ->whereHas('feeType', fn($q) => $q->where('is_mandatory', true))
            ->where('status', '!=', 'paid');

        if ($request->term_id) {
            $query->where('term_id', $request->term_id);
        }

        return response()->json(['has_unpaid' => $query->exists()]);
    }

    // -------------------------------------------------
    // BANKING DETAILS
    // -------------------------------------------------
    public function bankDetails()
    {
        return response()->json(BankDetail::all() ?? []);
    }

    public function storeBankDetail(Request $request)
    {
        $validated = $request->validate([
            'bank_name'       => 'required|string|max:255',
            'account_name'    => 'required|string|max:255',
            'account_number'  => 'required|string|max:50',
            'branch'          => 'nullable|string|max:255',
            'swift_code'      => 'nullable|string|max:50',
        ]);
        $bank = BankDetail::create($validated);
        $this->log('bank_detail_created', "Bank detail {$bank->bank_name} created by {$request->user()->email}");
        return response()->json($bank, 201);
    }

    public function updateBankDetail(Request $request, $id)
    {
        $bank = BankDetail::findOrFail($id);
        $validated = $request->validate([
            'bank_name'       => 'sometimes|string|max:255',
            'account_name'    => 'sometimes|string|max:255',
            'account_number'  => 'sometimes|string|max:50',
            'branch'          => 'nullable|string|max:255',
            'swift_code'      => 'nullable|string|max:50',
        ]);
        $bank->update($validated);
        $this->log('bank_detail_updated', "Bank detail {$bank->bank_name} updated by {$request->user()->email}");
        return response()->json($bank);
    }

    public function deleteBankDetail(Request $request, $id)
    {
        $bank = BankDetail::findOrFail($id);
        $bank->delete();
        $this->log('bank_detail_deleted', "Bank detail {$bank->bank_name} deleted by {$request->user()->email}");
        return response()->json(['message' => 'Bank detail deleted']);
    }

    // -------------------------------------------------
    // HELPERS
    // -------------------------------------------------
    private function generateInvoiceNumber($feeId)
    {
        $school = SchoolInformation::first();
        $prefix = 'INV';
        if ($school && $school->school_name) {
            $words = explode(' ', $school->school_name);
            $initials = '';
            foreach ($words as $word) {
                if (strlen($word) > 0) {
                    $initials .= strtoupper($word[0]);
                }
            }
            $initials = substr($initials, 0, 3);
            $prefix = 'INV-' . $initials;
        }
        return $prefix . '-' . str_pad($feeId, 6, '0', STR_PAD_LEFT);
    }

    private function getAmountForClass(FeeType $feeType, $classId, $streamId = null)
    {
        $amount = $feeType->amounts->first(fn($amt) => $amt->class_id == $classId && ($streamId ? $amt->stream_id == $streamId : true));
        if (!$amount) {
            $amount = $feeType->amounts->first(fn($amt) => $amt->class_id == $classId && is_null($amt->stream_id));
        }
        if (!$amount) {
            $amount = $feeType->amounts->first();
        }
        return $amount ? $amount->amount : 0;
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

    private function generateInvoiceHtml($studentFee)
    {
        $student = $studentFee->student;
        $feeType = $studentFee->feeType;
        $term    = $studentFee->term;
        $balance = $studentFee->total_amount - $studentFee->paid_amount;
        $school  = SchoolInformation::first();
        $logoBase64 = $this->getLogoBase64();

        $contactLines = [];
        if ($school) {
            if ($school->postal_address) $contactLines[] = $school->postal_address;
            $phones = [];
            if ($school->phone_primary) $phones[] = $school->phone_primary;
            if ($school->phone_secondary) $phones[] = $school->phone_secondary;
            if (!empty($phones)) $contactLines[] = '📞 ' . implode(' | ', $phones);
            $emails = [];
            if ($school->email_primary) $emails[] = $school->email_primary;
            if ($school->email_secondary) $emails[] = $school->email_secondary;
            if (!empty($emails)) $contactLines[] = '✉️ ' . implode(' | ', $emails);
        }
        $contactHtml = implode('<br>', $contactLines);

        $statusClass = $studentFee->status === 'paid' ? 'status-paid' : ($studentFee->status === 'partial' ? 'status-partial' : 'status-pending');

        $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Invoice ' . $studentFee->invoice_number . '</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; }
            .invoice-card { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.02); overflow: hidden; }
            .invoice-header { padding: 30px 40px 20px; border-bottom: 1px solid #e2e8f0; text-align: center; }
            .school-logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 15px; }
            .school-name { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
            .school-contact { font-size: 13px; color: #64748b; line-height: 1.6; }
            .invoice-badge { margin-top: 20px; }
            .invoice-badge .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
            .invoice-badge .number { font-size: 28px; font-weight: 800; color: #2563eb; margin: 5px 0; }
            .invoice-badge .term { font-size: 13px; color: #64748b; }
            .student-section { padding: 20px 40px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; }
            .student-grid { display: flex; gap: 40px; }
            .student-grid div { flex: 1; }
            .student-grid .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
            .student-grid .value { font-size: 16px; font-weight: 600; color: #0f172a; }
            .fee-details { padding: 30px 40px; }
            .section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 20px; }
            .fee-table { width: 100%; border-collapse: collapse; }
            .fee-table th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; font-weight: 600; }
            .fee-table td { padding: 14px 16px; font-size: 15px; border-bottom: 1px solid #f1f5f9; }
            .status-badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .status-paid { background: #d1fae5; color: #065f46; }
            .status-partial { background: #fef3c7; color: #92400e; }
            .status-pending { background: #fee2e2; color: #991b1b; }
            .payment-history { padding: 0 40px 30px; }
            .bank-details { padding: 0 40px 30px; }
            .bank-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 10px; }
            .bank-item strong { display: block; margin-bottom: 4px; color: #0f172a; }
            .footer { padding: 20px 40px; border-top: 1px solid #f1f5f9; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8; }
        </style></head><body>
        <div class="invoice-card">
            <div class="invoice-header">
                <div>';
                if ($logoBase64) {
                    $html .= '<img src="' . $logoBase64 . '" class="school-logo" alt="Logo">';
                }
                $html .= '</div>
                <div class="school-name">' . ($school->school_name ?? 'School Name') . '</div>
                <div class="school-contact">' . $contactHtml . '</div>
                <div class="invoice-badge">
                    <div class="label">Invoice</div>
                    <div class="number">' . $studentFee->invoice_number . '</div>
                    <div class="term">' . ($term ? $term->name : 'N/A') . '</div>
                </div>
            </div>

            <div class="student-section">
                <div class="student-grid">
                    <div>
                        <div class="label">Student Name</div>
                        <div class="value">' . $student->first_name . ' ' . $student->last_name . '</div>
                    </div>
                    <div>
                        <div class="label">Student Number</div>
                        <div class="value">' . $student->student_number . '</div>
                    </div>
                    <div>
                        <div class="label">Term</div>
                        <div class="value">' . ($term ? $term->name : 'N/A') . '</div>
                    </div>
                </div>
            </div>

            <div class="fee-details">
                <div class="section-title">Fee Summary</div>
                <table class="fee-table">
                    <thead><tr><th>Fee Type</th><th>Total Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                    <tbody><tr>
                        <td>' . $feeType->name . '</td>
                        <td>MK ' . number_format($studentFee->total_amount, 2) . '</td>
                        <td>MK ' . number_format($studentFee->paid_amount, 2) . '</td>
                        <td>MK ' . number_format($balance, 2) . '</td>
                        <td><span class="status-badge ' . $statusClass . '">' . ucfirst($studentFee->status) . '</span></td>
                    </tr></tbody>
                </table>
            </div>';

        if ($studentFee->payments->isNotEmpty()) {
            $html .= '<div class="payment-history">
                <div class="section-title">Payment History</div>
                <table class="fee-table">
                    <thead><tr><th>Date</th><th>Amount</th><th>Receipt</th><th>Method</th></tr></thead>
                    <tbody>';
            foreach ($studentFee->payments as $p) {
                $html .= '<tr><td>' . $p->payment_date . '</td><td>MK ' . number_format($p->amount, 2) . '</td><td>' . $p->receipt_number . '</td><td>' . $p->method . '</td></tr>';
            }
            $html .= '</tbody></table></div>';
        }

        $bankDetails = BankDetail::all();
        if ($bankDetails->isNotEmpty()) {
            $html .= '<div class="bank-details"><div class="section-title">Payment Methods</div>';
            foreach ($bankDetails as $bank) {
                $html .= '<div class="bank-item">
                    <strong>' . $bank->bank_name . '</strong>
                    Account Name: ' . $bank->account_name . '<br>
                    Account Number: ' . $bank->account_number .
                    ($bank->branch ? '<br>Branch: ' . $bank->branch : '') .
                    ($bank->swift_code ? '<br>Swift Code: ' . $bank->swift_code : '') .
                '</div>';
            }
            $html .= '</div>';
        }

        $html .= '<div class="footer">' . ($school->school_name ?? '') . ' – ' . ($school->motto ?? '') . '<br>This invoice is computer-generated and does not require a signature.</div>
        </div></body></html>';

        return $html;
    }

    private function generateReceiptHtml($studentFee)
    {
        $student = $studentFee->student;
        $feeType = $studentFee->feeType;
        $term    = $studentFee->term;
        $school  = SchoolInformation::first();
        $logoBase64 = $this->getLogoBase64();

        $receiptNumber = 'RCT-' . strtoupper(Str::random(8));

        $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Receipt</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; background: #f0fdf4; color: #1e293b; padding: 40px 20px; }
            .receipt-card { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.02); overflow: hidden; }
            .receipt-header { padding: 30px 40px; text-align: center; border-bottom: 2px solid #10b981; }
            .school-logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 15px; }
            .school-name { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
            .school-contact { font-size: 13px; color: #64748b; line-height: 1.6; }
            .receipt-badge { margin: 20px 0 10px; }
            .receipt-badge .label { font-size: 28px; font-weight: 800; color: #10b981; }
            .receipt-number { font-size: 13px; color: #64748b; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 30px 40px; background: #f8fafc; }
            .info-grid .item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
            .info-grid .item .value { font-size: 16px; font-weight: 600; color: #0f172a; }
            .amount-box { margin: 30px 40px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 30px; text-align: center; }
            .amount-box .label { font-size: 14px; color: #065f46; margin-bottom: 8px; }
            .amount-box .value { font-size: 36px; font-weight: 800; color: #065f46; }
            .footer { padding: 20px 40px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; }
        </style></head><body>
        <div class="receipt-card">
            <div class="receipt-header">
                <div>';
                if ($logoBase64) {
                    $html .= '<img src="' . $logoBase64 . '" class="school-logo" alt="Logo">';
                }
                $html .= '</div>
                <div class="school-name">' . ($school->school_name ?? 'School Name') . '</div>
                <div class="school-contact">' . $this->getContactHtml($school) . '</div>
                <div class="receipt-badge"><div class="label">PAID RECEIPT</div></div>
                <div class="receipt-number">Receipt #: ' . $receiptNumber . '</div>
            </div>

            <div class="info-grid">
                <div class="item">
                    <div class="label">Student</div>
                    <div class="value">' . $student->first_name . ' ' . $student->last_name . '</div>
                </div>
                <div class="item">
                    <div class="label">Student Number</div>
                    <div class="value">' . $student->student_number . '</div>
                </div>
                <div class="item">
                    <div class="label">Fee Type</div>
                    <div class="value">' . $feeType->name . '</div>
                </div>
                <div class="item">
                    <div class="label">Term</div>
                    <div class="value">' . ($term ? $term->name : 'N/A') . '</div>
                </div>
                <div class="item">
                    <div class="label">Total Fee</div>
                    <div class="value">MK ' . number_format($studentFee->total_amount, 2) . '</div>
                </div>
                <div class="item">
                    <div class="label">Paid On</div>
                    <div class="value">' . ($studentFee->payments->last() ? $studentFee->payments->last()->payment_date : now()->toDateString()) . '</div>
                </div>
            </div>

            <div class="amount-box">
                <div class="label">Total Amount Paid</div>
                <div class="value">MK ' . number_format($studentFee->paid_amount, 2) . '</div>
            </div>

            <div class="footer">' . ($school->school_name ?? '') . ' – ' . ($school->motto ?? '') . '<br>This receipt is computer-generated.</div>
        </div></body></html>';

        return $html;
    }

    private function generatePaymentReceiptHtml($payment)
    {
        $studentFee = $payment->studentFee;
        $student = $studentFee->student;
        $feeType = $studentFee->feeType;
        $school = SchoolInformation::first();
        $logoBase64 = $this->getLogoBase64();

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Receipt</title>
        <style>
            body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 30px; color: #1f2937; }
            .receipt-container { max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
            .school-logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px; }
            .school-name { font-size: 20px; font-weight: 700; color: #1e3a8a; margin: 0; }
            .receipt-title { font-size: 22px; font-weight: 800; color: #10b981; margin: 10px 0 5px 0; }
            .receipt-number { font-size: 13px; color: #6b7280; }
            .info-table { width: 100%; margin: 20px 0; border-collapse: collapse; }
            .info-table td { padding: 8px 5px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
            .info-table .label { font-weight: 600; color: #4b5563; width: 110px; }
            .amount-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 15px; text-align: center; margin-top: 20px; }
            .amount { font-size: 28px; font-weight: 800; color: #065f46; }
            .footer { margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 11px; color: #9ca3af; text-align: center; }
        </style></head><body>
        <div class="receipt-container">
            <div class="header">';
                if ($logoBase64) {
                    $html .= '<img src="' . $logoBase64 . '" class="school-logo" alt="Logo">';
                }
                $html .= '<h1 class="school-name">' . ($school->school_name ?? 'School Name') . '</h1><div class="receipt-title">Payment Receipt</div><div class="receipt-number">Receipt #: ' . $payment->receipt_number . '</div>
            </div>

            <table class="info-table">
                <tr><td class="label">Student</td><td>' . $student->first_name . ' ' . $student->last_name . '</td></tr>
                <tr><td class="label">Student No</td><td>' . $student->student_number . '</td></tr>
                <tr><td class="label">Fee Type</td><td>' . $feeType->name . '</td></tr>
                <tr><td class="label">Date</td><td>' . $payment->payment_date . '</td></tr>
                <tr><td class="label">Method</td><td>' . $payment->method . '</td></tr>
            </table>

            <div class="amount-box"><div style="font-size:13px; color:#065f46; margin-bottom:5px;">Amount Paid</div><div class="amount">MK ' . number_format($payment->amount, 2) . '</div></div>

            <div class="footer">' . ($school->school_name ?? '') . ' – ' . ($school->motto ?? '') . '<br>This receipt is computer-generated.</div>
        </div></body></html>';

        return $html;
    }

    private function getContactHtml($school)
    {
        $lines = [];
        if ($school) {
            if ($school->postal_address) $lines[] = $school->postal_address;
            $phones = [];
            if ($school->phone_primary) $phones[] = $school->phone_primary;
            if ($school->phone_secondary) $phones[] = $school->phone_secondary;
            if (!empty($phones)) $lines[] = '📞 ' . implode(' | ', $phones);
            $emails = [];
            if ($school->email_primary) $emails[] = $school->email_primary;
            if ($school->email_secondary) $emails[] = $school->email_secondary;
            if (!empty($emails)) $lines[] = '✉️ ' . implode(' | ', $emails);
        }
        return implode('<br>', $lines);
    }
}