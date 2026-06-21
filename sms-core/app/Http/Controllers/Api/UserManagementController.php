<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Notifications\ActivateAccountNotification;
use App\Notifications\EmailChangedNotification;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    use LogsActivity;

    /**
     * List all users with their roles.
     */
    public function index()
    {
        $users = User::with('roles')->get()->map(function ($user) {
            return [
                'id'           => $user->id,
                'first_name'   => $user->first_name,
                'last_name'    => $user->last_name,
                'salutation'   => $user->salutation,
                'username'     => $user->username,
                'email'        => $user->email,
                'phone'        => $user->phone,
                'roles'        => $user->roles->pluck('name')->toArray(),
                'highest_role' => $user->highestRole() ? $user->highestRole()->name : 'None',
                'full_name'    => $user->full_name,
            ];
        });

        return response()->json(['users' => $users]);
    }

    /**
     * Create a new user and send activation email.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'salutation' => 'nullable|string|max:50',
            'first_name' => 'required|string|max:255',
            'last_name'  => 'required|string|max:255',
            'email'      => 'required|email|unique:users',
            'roles'      => 'required|array',
            'roles.*'    => 'exists:roles,id',
        ]);

        // Generate a unique username from the email
        $username = explode('@', $validated['email'])[0];
        $base = $username;
        $counter = 1;
        while (User::where('username', $username)->exists()) {
            $username = $base . $counter;
            $counter++;
        }

        $user = User::create([
            'salutation' => $validated['salutation'],
            'first_name' => $validated['first_name'],
            'last_name'  => $validated['last_name'],
            'name'       => $validated['first_name'] . ' ' . $validated['last_name'],
            'username'   => $username,
            'email'      => $validated['email'],
            'password'   => bcrypt(Str::random(32)),
        ]);

        $user->roles()->sync($validated['roles']);

        // Send activation email
        $token = Password::createToken($user);
        $user->notify(new ActivateAccountNotification($token));

        // Log
        $this->log('user_created', "User {$user->email} created by " . $request->user()->email, [
            'created_by'  => $request->user()->id,
            'new_user_id' => $user->id,
            'roles'       => $user->roles->pluck('name'),
        ]);

        return response()->json([
            'message' => 'User created successfully. Activation email sent.',
            'user'    => $this->formatUser($user),
        ], 201);
    }

    /**
     * Update a user (profile, roles, email).
     */
    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'salutation' => 'nullable|string|max:50',
            'first_name' => 'sometimes|string|max:255',
            'last_name'  => 'sometimes|string|max:255',
            'email'      => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'roles'      => 'sometimes|array',
            'roles.*'    => 'exists:roles,id',
        ]);

        $oldEmail = $user->email;
        $emailChanged = false;

        if (isset($validated['email']) && $validated['email'] !== $oldEmail) {
            $emailChanged = true;
        }

        $user->update($validated);

        if ($request->has('roles')) {
            $user->roles()->sync($request->roles);
        }

        // If email changed, notify the new email
        if ($emailChanged) {
            $user->notify(new EmailChangedNotification());
            $this->log('email_changed', "Email changed from {$oldEmail} to {$user->email}", null, $user->id);
        }

        // Log update
        $this->log('user_updated', "User {$user->email} updated by " . $request->user()->email, [
            'updated_by' => $request->user()->id,
            'user_id'    => $user->id,
            'changes'    => array_keys($validated),
        ]);

        return response()->json([
            'message' => 'User updated.',
            'user'    => $this->formatUser($user),
        ]);
    }

    /**
     * Delete a user.
     */
    public function destroy(Request $request, User $user)
    {
        $email = $user->email;
        $user->delete();

        $this->log('user_deleted', "User {$email} deleted by " . $request->user()->email, [
            'deleted_by' => $request->user()->id,
            'deleted_user_email' => $email,
        ]);

        return response()->json(['message' => 'User deleted.']);
    }

    /**
     * Send a password reset link to the user (admin action).
     */
    public function resetPassword(Request $request, User $user)
    {
        // Generate token and send reset email
        $token = Password::createToken($user);
        $user->sendPasswordResetNotification($token); // uses the custom notification

        $this->log('password_reset_link_sent', "Password reset link sent to {$user->email} by admin " . $request->user()->email, [
            'admin_id' => $request->user()->id,
            'target_user_id' => $user->id,
        ]);

        return response()->json(['message' => 'Password reset link sent to the user.']);
    }

    /**
     * Helper to format user for responses.
     */
    private function formatUser(User $user)
    {
        return [
            'id'           => $user->id,
            'first_name'   => $user->first_name,
            'last_name'    => $user->last_name,
            'salutation'   => $user->salutation,
            'username'     => $user->username,
            'email'        => $user->email,
            'phone'        => $user->phone,
            'roles'        => $user->roles->pluck('name')->toArray(),
            'highest_role' => $user->highestRole() ? $user->highestRole()->name : 'None',
            'full_name'    => $user->full_name,
        ];
    }

    public function search(Request $request)
    {
        $query = $request->query('q', '');
        $users = User::where('first_name', 'like', "%{$query}%")
            ->orWhere('last_name', 'like', "%{$query}%")
            ->orWhere('email', 'like', "%{$query}%")
            ->limit(20)
            ->get(['id', 'first_name', 'last_name', 'email']);

        return response()->json($users);
    }
}