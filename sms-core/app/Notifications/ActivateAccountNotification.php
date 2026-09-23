<?php

namespace App\Notifications;

use App\Models\SchoolInformation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ActivateAccountNotification extends Notification
{
    use Queueable;

    protected $token;

    public function __construct($token)
    {
        $this->token = $token;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $school   = SchoolInformation::first();
        $appName  = $school->school_name ?? config('app.name', 'School Management System');

        $salutation = $notifiable->salutation ?? '';
        $firstName  = $notifiable->first_name ?? $notifiable->name ?? '';
        $greeting   = 'Dear';
        if ($salutation && $firstName) {
            $greeting = "Dear {$salutation} {$firstName}";
        } elseif ($firstName) {
            $greeting = "Dear {$firstName}";
        }

        $frontendUrl = config('app.frontend_url') . '/password-reset';
        $resetUrl = $frontendUrl . '?token=' . $this->token . '&email=' . urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Activate Your Account – ' . $appName)
            ->greeting($greeting . ',')
            ->line('An account has been created for you on the ' . $appName . ' platform.')
            ->line('Click the button below to set your password and activate your account:')
            ->action('Set Your Password', $resetUrl)
            ->line('This link will expire in ' . config('auth.passwords.users.expire') . ' minutes.')
            ->salutation('Warm regards,<br>' . $appName . ' Team');
    }
}