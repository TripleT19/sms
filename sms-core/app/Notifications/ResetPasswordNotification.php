<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Auth\Notifications\ResetPassword;

class ResetPasswordNotification extends ResetPassword
{
    use Queueable;

    /**
     * Get the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        // Personalise the greeting
        $salutation = $notifiable->salutation ?? '';
        $firstName  = $notifiable->first_name ?? $notifiable->name ?? '';
        $greeting   = 'Dear';
        if ($salutation && $firstName) {
            $greeting = "Dear {$salutation} {$firstName}";
        } elseif ($firstName) {
            $greeting = "Dear {$firstName}";
        }

        // Build the reset URL pointing to your React app
        $frontendUrl = config('app.frontend_url') . '/password-reset';
        $resetUrl = $frontendUrl . '?token=' . $this->token . '&email=' . urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reset Your Password – ' . config('app.name'))
            ->greeting($greeting . ',')
            ->line('We received a request to reset the password for your account.')
            ->line('Click the button below to choose a new password:')
            ->action('Reset Password', $resetUrl)
            ->line('If you didn’t request a password reset, please ignore this email.')
            ->line('This link will expire in '.config('auth.passwords.users.expire').' minutes.')
            ->salutation('Warm regards,<br>' . config('app.name') . ' Team');
    }
}