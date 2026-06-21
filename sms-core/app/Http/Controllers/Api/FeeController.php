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
            $query->whereHas('student', fn($q) => $q->where('class_id', $request->class_id));
        }
        if ($request->stream_id) {
            $query->whereHas('student', fn($q) => $q->where('stream_id', $request->stream_id));
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
        $termId   = $request->term_id;
        $assigned = [];

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
        $amount = $this->getAmountForClass($feeType, $request->class_id, $request->stream_id);

        $students = Student::where('class_id', $request->class_id)
            ->when($request->stream_id, fn($q) => $q->where('stream_id', $request->stream_id))
            ->pluck('id');

        $count = 0;
        foreach ($students as $studentId) {
            StudentFee::firstOrCreate(
                [
                    'student_id'  => $studentId,
                    'fee_type_id' => $feeType->id,
                    'term_id'     => $request->term_id,
                ],
                [
                    'total_amount' => $amount,
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
    // PAYMENTS
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
        $studentFee = StudentFee::with('student', 'feeType', 'payments', 'term')->findOrFail($studentFeeId);

        if (!$studentFee->invoice_number) {
            $studentFee->invoice_number = $this->generateInvoiceNumber($studentFee->id);
            $studentFee->save();
        }

        $html = $this->generateInvoiceHtml($studentFee);
        $pdf = Pdf::loadHTML($html);

        return $pdf->download('Invoice_' . $studentFee->invoice_number . '.pdf');
    }

    public function downloadFeeReceipt($studentFeeId)
    {
        $studentFee = StudentFee::with('student', 'feeType', 'payments', 'term')->findOrFail($studentFeeId);

        if ($studentFee->status !== 'paid') {
            return response()->json(['message' => 'Receipt available only when fee is fully paid.'], 422);
        }

        $html = $this->generateReceiptHtml($studentFee);
        $pdf = Pdf::loadHTML($html);

        return $pdf->download('Receipt_' . $studentFee->student->first_name . '_' . $studentFee->student->last_name . '.pdf');
    }

    // Legacy per‑payment receipt (kept for backward compatibility, not used by current frontend)
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
        return response()->json(BankDetail::all());
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
        return 'INV-' . strtoupper(Str::random(4)) . '-' . str_pad($feeId, 6, '0', STR_PAD_LEFT);
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

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ' . $studentFee->invoice_number . '</title>
        <style>
            body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 30px; color: #1f2937; }
            .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .school-logo { width: 100px; height: 100px; object-fit: contain; margin-right: 20px; }
            .school-name { font-size: 24px; font-weight: 700; color: #1e3a8a; margin: 0 0 5px 0; }
            .school-details { font-size: 12px; color: #4b5563; line-height: 1.5; }
            .invoice-title { text-align: right; }
            .invoice-title h2 { font-size: 28px; color: #2563eb; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .invoice-meta { font-size: 12px; color: #6b7280; margin-top: 5px; }
            .section-title { font-size: 16px; font-weight: 600; color: #1e3a8a; background: #eff6ff; padding: 8px 15px; border-radius: 6px; margin: 25px 0 15px 0; }
            .two-columns { display: flex; gap: 30px; }
            .two-columns > div { flex: 1; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #374151; border-bottom: 2px solid #e5e7eb; }
            td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
            .status-paid { background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px; }
            .status-partial { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px; }
            .status-pending { background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px; }
            .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 11px; color: #9ca3af; text-align: center; }
            .bank-details { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-top: 20px; }
        </style></head><body>
        <div class="invoice-container">
            <div class="header">
                <div style="display: flex; align-items: center;">';
                if ($logoBase64) {
                    $html .= '<img src="' . $logoBase64 . '" class="school-logo" alt="Logo">';
                }
                $html .= '<div><h1 class="school-name">' . ($school->school_name ?? 'School Name') . '</h1><div class="school-details">';
                if ($school->postal_address) $html .= $school->postal_address . '<br>';
                if ($school->phone_primary) $html .= '📞 ' . $school->phone_primary . '<br>';
                if ($school->email_primary) $html .= '✉️ ' . $school->email_primary;
                $html .= '</div></div></div>
                <div class="invoice-title"><h2>Invoice</h2><div class="invoice-meta">' . $studentFee->invoice_number . '<br>Term: ' . ($term ? $term->name : 'N/A') . '</div></div>
            </div>

            <div class="section-title">Student & Fee Details</div>
            <div class="two-columns">
                <div>
                    <table>
                        <tr><td width="130"><strong>Student Name</strong></td><td>' . $student->first_name . ' ' . $student->last_name . '</td></tr>
                        <tr><td><strong>Student Number</strong></td><td>' . $student->student_number . '</td></tr>
                        <tr><td><strong>Term</strong></td><td>' . ($term ? $term->name : 'N/A') . '</td></tr>
                    </table>
                </div>
                <div>
                    <table>
                        <tr><td width="120"><strong>Fee Type</strong></td><td>' . $feeType->name . '</td></tr>
                        <tr><td><strong>Invoice #</strong></td><td>' . $studentFee->invoice_number . '</td></tr>
                    </table>
                </div>
            </div>

            <div class="section-title">Payment Summary</div>
            <table>
                <thead><tr><th>Total Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                <tbody><tr>
                    <td>MK ' . number_format($studentFee->total_amount, 2) . '</td>
                    <td>MK ' . number_format($studentFee->paid_amount, 2) . '</td>
                    <td>MK ' . number_format($balance, 2) . '</td>
                    <td>';
                    if ($studentFee->status === 'paid') $html .= '<span class="status-paid">Paid</span>';
                    elseif ($studentFee->status === 'partial') $html .= '<span class="status-partial">Partial</span>';
                    else $html .= '<span class="status-pending">Pending</span>';
        $html .= '</td></tr></tbody></table>';

        if ($studentFee->payments->isNotEmpty()) {
            $html .= '<div class="section-title">Payment History</div><table><thead><tr><th>Date</th><th>Amount</th><th>Receipt</th><th>Method</th></tr></thead><tbody>';
            foreach ($studentFee->payments as $p) {
                $html .= '<tr><td>' . $p->payment_date . '</td><td>MK ' . number_format($p->amount, 2) . '</td><td>' . $p->receipt_number . '</td><td>' . $p->method . '</td></tr>';
            }
            $html .= '</tbody></table>';
        }

        $bankDetails = BankDetail::all();
        if ($bankDetails->isNotEmpty()) {
            $html .= '<div class="section-title">Payment Methods</div>';
            foreach ($bankDetails as $bank) {
                $html .= '<div class="bank-details"><strong>' . $bank->bank_name . '</strong><br>Account Name: ' . $bank->account_name . '<br>Account Number: ' . $bank->account_number;
                if ($bank->branch) $html .= '<br>Branch: ' . $bank->branch;
                if ($bank->swift_code) $html .= '<br>Swift Code: ' . $bank->swift_code;
                $html .= '</div>';
            }
        }

        $html .= '<div class="footer">' . ($school->school_name ?? '') . ' – ' . ($school->motto ?? '') . '<br>This invoice is computer-generated and does not require a signature.</div></div></body></html>';

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

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fee Receipt</title>
        <style>
            body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 30px; color: #1f2937; }
            .receipt-container { max-width: 600px; margin: 0 auto; border: 2px solid #10b981; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
            .receipt-header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 25px; }
            .school-logo { width: 90px; height: 90px; object-fit: contain; margin-bottom: 10px; }
            .school-name { font-size: 22px; font-weight: 700; color: #1e3a8a; margin: 0; }
            .receipt-title { font-size: 26px; font-weight: 800; color: #10b981; letter-spacing: 1px; margin: 15px 0 5px 0; }
            .receipt-number { font-size: 14px; color: #6b7280; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: left; margin: 25px 0; }
            .info-grid div { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
            .info-grid .label { font-weight: 600; color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-grid .value { font-size: 14px; color: #1f2937; }
            .amount-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin-top: 20px; }
            .amount-paid { font-size: 32px; font-weight: 800; color: #065f46; }
            .footer { margin-top: 30px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
        </style></head><body>
        <div class="receipt-container">
            <div class="receipt-header">';
                if ($logoBase64) {
                    $html .= '<img src="' . $logoBase64 . '" class="school-logo" alt="Logo">';
                }
                $html .= '<h1 class="school-name">' . ($school->school_name ?? 'School Name') . '</h1><div class="receipt-title">PAID RECEIPT</div><div class="receipt-number">Receipt #: ' . $receiptNumber . '</div>
            </div>

            <div class="info-grid">
                <div><div class="label">Student</div><div class="value">' . $student->first_name . ' ' . $student->last_name . '</div></div>
                <div><div class="label">Student Number</div><div class="value">' . $student->student_number . '</div></div>
                <div><div class="label">Fee Type</div><div class="value">' . $feeType->name . '</div></div>
                <div><div class="label">Term</div><div class="value">' . ($term ? $term->name : 'N/A') . '</div></div>
                <div><div class="label">Total Fee</div><div class="value">MK ' . number_format($studentFee->total_amount, 2) . '</div></div>
                <div><div class="label">Paid On</div><div class="value">' . ($studentFee->payments->last() ? $studentFee->payments->last()->payment_date : now()->toDateString()) . '</div></div>
            </div>

            <div class="amount-box"><div style="font-size:14px; color:#065f46; margin-bottom:5px;">Total Amount Paid</div><div class="amount-paid">MK ' . number_format($studentFee->paid_amount, 2) . '</div></div>

            <div class="footer">' . ($school->school_name ?? '') . ' – ' . ($school->motto ?? '') . '<br>This receipt is computer-generated and does not require a signature.</div>
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
}