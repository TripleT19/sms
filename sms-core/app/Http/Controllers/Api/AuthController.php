<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use LogsActivity;

    /**
     * Login with email or username + password.
     */
    public function login(Request $request)
    {
        $request->validate([
            'identifier' => 'required|string',
            'password'   => 'required|string',
        ]);

        $field = filter_var($request->identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user = User::where($field, $request->identifier)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            // Log failed login
            self::log('failed_login', "Failed login attempt with identifier: {$request->identifier}", [
                'identifier' => $request->identifier,
                'field'      => $field,
            ]);

            throw ValidationException::withMessages([
                'identifier' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Successful login
        $token = $user->createToken('auth_token', ['*'], now()->addMinutes(15))->plainTextToken;

        self::log('login', 'User logged in successfully.', null, $user->id);

        return response()->json([
            'message' => 'Login successful',
            'user'    => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'username' => $user->username,
                'roles'    => $user->roles->pluck('name'),   // ← add role names
            ],
            'token'   => $token,
        ]);
    }

    /**
     * Forgot password – send reset link.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        // Find the user to log the request
        $user = User::where('email', $request->email)->first();

        // Send the reset link
        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            self::log('forgot_password', "Password reset link requested for {$request->email}", null, $user->id);
            return response()->json(['message' => 'Password reset link sent to your email.']);
        }

        return response()->json(['message' => 'Unable to send reset link.'], 500);
    }

    /**
     * Reset password – set a new password using the token from the email.
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'    => 'required',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        // Perform the actual reset
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            $user = User::where('email', $request->email)->first();
            self::log('password_reset', 'User reset their password.', null, $user->id);
            return response()->json(['message' => 'Password reset successfully.']);
        }

        return response()->json(['message' => __($status)], 500);
    }

    /**
     * Manual logout.
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            self::log('logout', 'User logged out manually.', null, $user->id);
        }

        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }
}