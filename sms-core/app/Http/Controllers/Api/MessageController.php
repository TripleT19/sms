<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Guardian;
use App\Models\Message;
use App\Models\Notification;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TeacherSubjectAssignment;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    use LogsActivity;

    /** List conversations for the logged‑in user. */
    public function index(Request $request)
    {
        $user = $request->user();
        $conversations = $user->conversations()
            ->with(['participants:id,first_name,last_name', 'latestMessage.sender:id,first_name,last_name'])
            ->orderByDesc('updated_at')
            ->get();

        $data = $conversations->map(function ($conv) use ($user) {
            $other = $conv->participants->firstWhere('id', '!=', $user->id);
            $lastRead = $conv->pivot ? $conv->pivot->last_read_at : null;
            $latestMsg = $conv->latestMessage;

            $unread = false;
            if ($latestMsg && $latestMsg->sender_id !== $user->id) {
                if ($lastRead === null || $lastRead < $latestMsg->created_at) {
                    $unread = true;
                }
            }

            return [
                'id'           => $conv->id,
                'subject'      => $conv->subject,
                'student_id'   => $conv->student_id,
                'other_user'   => $other ? $other->first_name . ' ' . $other->last_name : 'Unknown',
                'last_message' => $latestMsg ? [
                    'body'        => $latestMsg->trashed() ? 'This message was deleted' : $latestMsg->body,
                    'sender_id'   => $latestMsg->sender_id,                          // ← new
                    'sender_name' => $latestMsg->sender->first_name . ' ' . $latestMsg->sender->last_name,
                    'read_at'     => $latestMsg->read_at ? (string) $latestMsg->read_at : null,   // ← new
                    'created_at'  => $latestMsg->created_at->diffForHumans(),
                ] : null,
                'unread'       => $unread,
            ];
        });

        return response()->json($data);
    }

    /** Show a single conversation with messages. */
    public function show($id, Request $request)
    {
        $user = $request->user();
        $conversation = Conversation::with(['messages' => function ($q) {
                $q->withTrashed()->with('sender:id,first_name,last_name');
            }, 'participants:id,first_name,last_name'])
            ->findOrFail($id);

        // Mark unread messages as read
        $conversation->messages()
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $conversation->participants()->updateExistingPivot($user->id, ['last_read_at' => now()]);

        $messages = $conversation->messages->map(function ($m) {
            return [
                'id'              => $m->id,
                'body'            => $m->trashed() ? null : $m->body,
                'is_deleted'      => $m->trashed(),
                'attachment' => $m->attachment ? 'storage/' . $m->attachment : null,
                'attachment_name' => $m->attachment_name,
                'attachment_type' => $m->attachment_type,
                'edited'          => $m->edited,
                'sender_id'       => $m->sender_id,
                'sender_name'     => $m->sender->first_name . ' ' . $m->sender->last_name,
                'created_at'      => $m->created_at->format('M d, Y H:i'),
                'read_at'         => $m->read_at ? (string) $m->read_at : null,
            ];
        });

        return response()->json([
            'conversation' => [
                'id' => $conversation->id,
                'subject' => $conversation->subject,
                'student_id' => $conversation->student_id,
                'participants' => $conversation->participants->map(fn($p) => [
                    'id' => $p->id,
                    'name' => $p->first_name . ' ' . $p->last_name,
                ]),
                'messages' => $messages,
            ],
        ]);
    }

    /** Start a new conversation. sender_role: parent / teacher */
    public function store(Request $request)
    {
        // Base rules
        $rules = [
            'sender_role'    => 'required|in:parent,teacher',
            'recipient_type' => 'required|in:class_teacher,subject_teacher,headteacher,finance_officer,staff_member',
            'recipient_id'   => 'required_if:sender_role,teacher|exists:users,id',
            'subject_id'     => 'nullable|exists:subjects,id|required_if:recipient_type,subject_teacher',
            'message'        => 'nullable|string|max:2000',
            'attachment'     => 'nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ];

        // Only require student_id for parents
        if ($request->sender_role === 'parent') {
            $rules['student_id'] = 'required|exists:students,id';
        }

        $request->validate($rules);

        $user = $request->user();
        $senderRole = $request->sender_role;

        // ---------- Parent verification ----------
        if ($senderRole === 'parent') {
            $isGuardian = Guardian::where('user_id', $user->id)
                ->whereHas('students', fn($q) => $q->where('students.id', $request->student_id))
                ->exists();
            if (!$isGuardian) abort(403, 'You are not a guardian of this student.');
        } else {
            if (!$user->roles()->where('name', 'Teacher')->exists()) {
                abort(403, 'You do not have the Teacher role.');
            }
        }

        // ---------- Find recipient(s) ----------
        $recipients = collect();
        $subject = '';

        if ($senderRole === 'teacher') {
            $recipient = User::findOrFail($request->recipient_id);
            $recipients->push($recipient);
            $subject = 'Staff Message';
        } else {
            switch ($request->recipient_type) {
                case 'class_teacher':
                    $student = Student::findOrFail($request->student_id);
                    $class = $student->class;
                    if ($class->streams->isNotEmpty()) {
                        $stream = $student->stream;
                        if ($stream) {
                            $pivot = $class->streams()->where('streams.id', $stream->id)->first();
                            if ($pivot && $pivot->pivot) {
                                $pivotModel = \App\Models\ClassStream::find($pivot->pivot->id);
                                $recipients = $pivotModel ? $pivotModel->teachers : collect();
                            }
                        }
                    } else {
                        $recipients = $class->teachers;
                    }
                    $subject = 'Question for Class Teacher';
                    break;

                case 'subject_teacher':
                    // ... existing code (unchanged)
                    break;

                case 'headteacher':
                    $recipients = User::whereHas('roles', fn($q) => $q->where('name', 'Headteacher'))->get();
                    $subject = 'Message for Headteacher';
                    break;

                case 'finance_officer':
                    $recipients = User::whereHas('roles', fn($q) => $q->where('name', 'Finance Officer'))->get();
                    $subject = 'Message for Finance Officer';
                    break;

                case 'staff_member':
                    // fallback for parent sending to a general staff member (unlikely but kept)
                    $recipients = User::whereHas('roles', fn($q) => $q->whereIn('name', ['Teacher', 'Headteacher', 'Finance Officer']))
                        ->get();
                    $subject = 'Staff Message';
                    break;
            }
        }

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'No recipient found.'], 404);
        }

        // ---------- Create conversation ----------
        $conversation = Conversation::create([
            'subject'    => $subject,
            'student_id' => $request->student_id ?? null,
        ]);

        $conversation->participants()->attach($user->id, ['role' => $senderRole]);
        foreach ($recipients as $recipient) {
            $conversation->participants()->attach($recipient->id, ['role' => 'teacher']);
        }

        // Handle file upload
        $attachmentPath = null;
        $attachmentName = null;
        $attachmentType = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('messages', 'public');
            $attachmentName = $file->getClientOriginalName();
            $attachmentType = $file->getMimeType();
        }

        $conversation->messages()->create([
            'sender_id'       => $user->id,
            'body'            => $request->message ?? '',
            'attachment'      => $attachmentPath,
            'attachment_name' => $attachmentName,
            'attachment_type' => $attachmentType,
        ]);

        // Log & notify
        $this->log('message_sent', "User {$user->id} started conversation #{$conversation->id} as {$senderRole}");
        $this->notifyParticipants($recipients->pluck('id'), $user, $subject, $conversation);

        return response()->json(['conversation_id' => $conversation->id], 201);
    }

    /** Reply to a conversation (also supports attachments). */
    public function reply(Request $request, $conversationId)
    {
        $request->validate([
            'body'       => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ]);

        $user = $request->user();
        $conversation = Conversation::findOrFail($conversationId);

        if (!$conversation->participants()->where('user_id', $user->id)->exists()) {
            abort(403, 'You are not part of this conversation.');
        }

        $attachmentPath = null;
        $attachmentName = null;
        $attachmentType = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('messages', 'public');
            $attachmentName = $file->getClientOriginalName();
            $attachmentType = $file->getMimeType();
        }

        $conversation->messages()->create([
            'sender_id'       => $user->id,
            'body'            => $request->body ?? '',
            'attachment'      => $attachmentPath,
            'attachment_name' => $attachmentName,
            'attachment_type' => $attachmentType,
        ]);

        $conversation->touch();

        // Log & notify other participants
        $this->log('message_replied', "User {$user->id} replied in conversation #{$conversationId}");
        $otherIds = $conversation->participants->pluck('id')->filter(fn($id) => $id != $user->id);
        if ($otherIds->isNotEmpty()) {
            $studentName = '';
            if ($conversation->student_id) {
                $student = Student::find($conversation->student_id);
                if ($student) $studentName = ' about ' . $student->first_name . ' ' . $student->last_name;
            }
            $insertData = [];
            $now = now();
            foreach ($otherIds as $uid) {
                $insertData[] = [
                    'user_id'    => $uid,
                    'type'       => 'message',
                    'message'    => "New reply from {$user->first_name} {$user->last_name}{$studentName}",
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            //Notification::insert($insertData);
        }

        return response()->json(['message' => 'Reply sent']);
    }

    /** Edit a message (own only). */
    public function update(Request $request, $id)
    {
        $request->validate(['body' => 'required|string|max:2000']);
        $user = $request->user();
        $message = Message::findOrFail($id);
        if ($message->sender_id !== $user->id) abort(403);
        $message->body = $request->body;
        $message->edited = true;
        $message->save();
        return response()->json(['message' => 'Updated']);
    }

    /** Soft delete a message (own only). */
    public function destroy($id, Request $request)
    {
        $user = $request->user();
        $message = Message::findOrFail($id);
        if ($message->sender_id !== $user->id) abort(403);
        $message->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /** Get possible recipients based on sender_role. */
    public function recipients(Request $request)
    {
        $request->validate(['sender_role' => 'required|in:parent,teacher']);
        $user = $request->user();
        $senderRole = $request->sender_role;

        if ($senderRole === 'parent') {
            $guardians = Guardian::where('user_id', $user->id)
                ->with('students.class.streams')
                ->get();
            $children = $guardians->pluck('students')->flatten()->unique('id');

            $data = [];
            foreach ($children as $student) {
                $class  = $student->class;
                $stream = $student->stream;

                // Class teacher(s)
                $classTeachers = [];
                if ($class->streams->isNotEmpty() && $stream) {
                    $pivot = $class->streams()->where('streams.id', $stream->id)->first();
                    if ($pivot && $pivot->pivot) {
                        $pivotModel = \App\Models\ClassStream::find($pivot->pivot->id);
                        $classTeachers = $pivotModel ? $pivotModel->teachers->pluck('id') : [];
                    }
                } else {
                    $classTeachers = $class->teachers->pluck('id');
                }

                // Subject teachers
                $subjectAssignments = TeacherSubjectAssignment::where('class_id', $class->id)
                    ->where(function ($q) use ($stream) {
                        $q->whereNull('stream_id')
                        ->orWhere('stream_id', $stream->id ?? 0);
                    })
                    ->with('subject', 'teacher')
                    ->get()
                    ->map(fn($a) => [
                        'subject_id'   => $a->subject_id,
                        'subject_name' => $a->subject->name,
                        'teacher_id'   => $a->teacher_id,
                        'teacher_name' => $a->teacher->first_name . ' ' . $a->teacher->last_name,
                    ]);

                // Headteacher(s)
                $headteachers = User::whereHas('roles', fn($q) => $q->where('name', 'Headteacher'))
                    ->pluck('id');

                // Finance Officer(s)
                $financeOfficers = User::whereHas('roles', fn($q) => $q->where('name', 'Finance Officer'))
                    ->pluck('id');

                $data[] = [
                    'student_id'          => $student->id,
                    'student_name'        => $student->first_name . ' ' . $student->last_name,
                    'class_name'          => $class->name,
                    'stream_name'         => $stream ? $stream->name : null,
                    'class_teachers'      => $classTeachers,
                    'subject_teachers'    => $subjectAssignments->values(),
                    'headteacher_ids'     => $headteachers,
                    'finance_officer_ids' => $financeOfficers,
                ];
            }

            return response()->json($data);
        }

        // Teacher (staff member) – return all non‑parent users
        $staff = User::whereHas('roles', function ($q) {
                $q->whereIn('name', ['Teacher', 'Headteacher', 'Finance Officer']);
            })
            ->where('id', '!=', $user->id)   // exclude the sender themselves
            ->with('roles:id,name')
            ->get()
            ->map(fn($u) => [
                'id'   => $u->id,
                'name' => $u->first_name . ' ' . $u->last_name,
                'role' => $u->roles->pluck('name')->first() ?? 'Staff',
            ])
            ->values();

        return response()->json(['staff_members' => $staff]);
    }

    private function notifyParticipants($recipientIds, $sender, $subject, $conversation)
    {
        $studentName = '';
        if ($conversation->student_id) {
            $student = Student::find($conversation->student_id);
            if ($student) $studentName = ' about ' . $student->first_name . ' ' . $student->last_name;
        }
        $insertData = [];
        $now = now();
        foreach ($recipientIds as $uid) {
            $insertData[] = [
                'user_id'    => $uid,
                'type'       => 'message',
                'message'    => "New message from {$sender->first_name} {$sender->last_name}{$studentName} – {$subject}",
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        if (!empty($insertData)) Notification::insert($insertData);
    }

    /**
     * Forward a message to other staff (teacher only).
     */
    public function forward(Request $request)
    {
        $request->validate([
            'message_id'   => 'required|exists:messages,id',
            'recipient_id' => 'required|exists:users,id',   // single recipient for simplicity
            'comment'      => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        if (!$user->roles()->where('name', 'Teacher')->exists()) {
            abort(403, 'Only teachers can forward messages.');
        }

        $original = Message::with('conversation')->findOrFail($request->message_id);
        $recipient = User::findOrFail($request->recipient_id);

        // Create a new conversation between the teacher and the recipient
        $conversation = Conversation::create([
            'subject'    => 'Forwarded message',
            'student_id' => $original->conversation->student_id ?? null,
        ]);
        $conversation->participants()->attach($user->id, ['role' => 'teacher']);
        $conversation->participants()->attach($recipient->id, ['role' => 'teacher']);

        // Build forwarded message body
        $body = "Forwarded message:\n\"" . $original->body . "\"";
        if ($request->comment) {
            $body .= "\n\nComment: " . $request->comment;
        }

        // Copy attachment if any (store the same file path, but do not duplicate the file)
        $attachment = $original->attachment;
        $attachmentName = $original->attachment_name;
        $attachmentType = $original->attachment_type;

        $conversation->messages()->create([
            'sender_id'       => $user->id,
            'body'            => $body,
            'attachment'      => $attachment,
            'attachment_name' => $attachmentName,
            'attachment_type' => $attachmentType,
        ]);

        // Log & notify
        $this->log('message_forwarded', "User {$user->id} forwarded message #{$original->id} to {$recipient->id}");
        Notification::create([
            'user_id' => $recipient->id,
            'type'    => 'message',
            'message' => "{$user->first_name} {$user->last_name} forwarded a message to you.",
        ]);

        return response()->json(['conversation_id' => $conversation->id]);
    }

    /**
    * Return the number of conversations with unread messages for the logged‑in user.
    */
    public function unreadCount(Request $request)
    {
        $user = $request->user();
        $count = 0;

        $conversations = $user->conversations()
            ->with('latestMessage')
            ->get();

        foreach ($conversations as $conv) {
            $lastRead = $conv->pivot->last_read_at;
            $latest = $conv->latestMessage;

            if (!$latest) continue;

            // Unread if the latest message was sent by someone else and
            // the user hasn't read it (last_read_at is null or older than the message)
            if ($latest->sender_id !== $user->id) {
                if ($lastRead === null || $lastRead < $latest->created_at) {
                    $count++;
                }
            }
        }

        return response()->json(['count' => $count]);
    }
}