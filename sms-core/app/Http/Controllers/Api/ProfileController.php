<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Qualification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Show the authenticated user's profile.
     */
    public function show(Request $request)
    {
        $user = $request->user()->load('roles', 'qualifications');

        return response()->json([
            'user' => array_merge($user->toArray(), [
                'full_name' => $user->full_name,
                'highest_role' => $user->highestRole() ? $user->highestRole()->name : null,
                'profile_pic_url' => $user->profile_pic
                    ? $user->profile_pic   // ← return only the path
                    : null,
            ]),
            'all_qualifications' => \App\Models\Qualification::all(),
            'roles' => $user->roles,
        ]);
    }

    /**
     * Update profile (name, username, phone, salutation, profile pic, qualifications).
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name'  => 'required|string|max:255',
            'salutation' => 'nullable|string|max:50',
            'username'   => ['required', 'string', 'max:255', Rule::unique('users')->ignore($user->id)],
            'email'      => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone'      => 'nullable|string|max:20',
            'profile_pic'=> 'nullable|image|mimes:jpg,jpeg,png|max:2048',
            'qualifications' => 'nullable|array',
            'qualifications.*' => 'exists:qualifications,id',
        ]);

        // Handle profile picture upload
        if ($request->hasFile('profile_pic')) {
            if ($user->profile_pic) {
                \Storage::disk('public')->delete($user->profile_pic);
            }
            $validated['profile_pic'] = $request->file('profile_pic')->store('profile_pics', 'public');
        }

        $user->update($validated);

        // Sync qualifications if not a parent
        if (!$user->isParent() && $request->has('qualifications')) {
            $user->qualifications()->sync($request->qualifications);
        }

        // Reload user with relationships
        $user = $user->fresh()->load('roles', 'qualifications');

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => array_merge($user->toArray(), [
                'full_name'      => $user->full_name,
                'highest_role'   => $user->highestRole() ? $user->highestRole()->name : null,
                'profile_pic_url'=> $user->profile_pic ? $user->profile_pic : null,
            ]),
        ]);
    }

    /**
     * Change password – requires current password.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->password = $request->new_password;
        $user->save();

        return response()->json(['message' => 'Password changed successfully.']);
    }
}